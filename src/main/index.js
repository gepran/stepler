import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  Menu,
  nativeTheme,
  Notification,
  dialog,
} from "electron";
import { join } from "path";
import { readFileSync, writeFileSync } from "fs";
import { exec, execFile } from "child_process";
import http from "http";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import { autoUpdater } from "electron-updater";

import { google } from "googleapis";
import dotenv from "dotenv";
let mainWindow = null;

// --------------- Settings persistence ---------------

const settingsPath = join(app.getPath("userData"), "stepler-settings.json");
const isMac = process.platform === "darwin";
const defaults = {
  hotkey: isMac ? "Shift+Command+Space" : "Ctrl+Shift+Space",
  theme: "dark",
  appleReminders: isMac,
  projects: ["Work", "Personal", "Health"],
};

function loadSettings() {
  try {
    return { ...defaults, ...JSON.parse(readFileSync(settingsPath, "utf-8")) };
  } catch {
    return { ...defaults };
  }
}

function saveSettings(partial) {
  const merged = { ...loadSettings(), ...partial };
  writeFileSync(settingsPath, JSON.stringify(merged, null, 2));
  return merged;
}

// --------------- App data persistence (tasks, history) ---------------

const dataPath = join(app.getPath("userData"), "stepler-data.json");
const dataDefaults = {
  tasks: [],
  history: [],
  deletedTasks: [],
  currentDate: null,
  firedReminders: [],
};

function loadAppData() {
  try {
    return { ...dataDefaults, ...JSON.parse(readFileSync(dataPath, "utf-8")) };
  } catch {
    return { ...dataDefaults };
  }
}

function saveAppData(partial) {
  const merged = { ...loadAppData(), ...partial };
  writeFileSync(dataPath, JSON.stringify(merged, null, 2));
  return merged;
}

// --------------- Hotkey management ---------------

let currentHotkey = null;

function registerHotkey(accelerator) {
  if (currentHotkey) {
    try {
      globalShortcut.unregister(currentHotkey);
    } catch {
      /* ignore */
    }
  }
  try {
    globalShortcut.register(accelerator, toggleWindow);
    currentHotkey = accelerator;
    return true;
  } catch {
    if (currentHotkey && currentHotkey !== accelerator) {
      try {
        globalShortcut.register(currentHotkey, toggleWindow);
      } catch {
        /* lost */
      }
    }
    return false;
  }
}

// --------------- Theme ---------------

function applyTheme(theme) {
  nativeTheme.themeSource = theme;
}

// --------------- Window toggle ---------------

function toggleWindow() {
  if (!mainWindow) return;

  const isFocused = mainWindow.isFocused();

  if (mainWindow.isVisible() && isFocused) {
    if (process.platform === "darwin") {
      app.hide();
    } else {
      mainWindow.hide();
    }
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

// --------------- macOS application menu ---------------

function buildMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { label: "About Stepler", role: "about" },
        { type: "separator" },
        {
          label: "Settings…",
          accelerator: "CmdOrCtrl+,",
          click: () => mainWindow?.webContents.send("open-settings"),
        },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      role: "editMenu",
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "close" }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// --------------- Window creation ---------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    titleBarStyle: "hiddenInset",
    vibrancy: "under-window",
    visualEffectState: "active",
    autoHideMenuBar: true,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      if (process.platform === "darwin") {
        app.hide();
      } else {
        mainWindow.hide();
      }
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// --------------- Google Calendar Integration ---------------

const GCAL_TOKEN_PATH = join(app.getPath("userData"), "step-gcal-token.json");

let oAuth2Client = null;

function initGoogleAuth() {
  // Load .env from the app root (works in both dev and production)
  const appRoot = app.getAppPath();
  const envPath = join(appRoot, ".env");
  console.log("Google Calendar: loading .env from", envPath);
  dotenv.config({ path: envPath });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  console.log(
    "Google Calendar: GOOGLE_CLIENT_ID",
    clientId ? `set (${clientId.slice(0, 10)}…)` : "MISSING",
  );
  if (!clientId || !clientSecret) {
    console.warn(
      "Google Calendar: Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in environment.",
    );
    return;
  }

  oAuth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "http://127.0.0.1:3000/oauth2callback",
  );

  // Persist refreshed tokens automatically
  oAuth2Client.on("tokens", (tokens) => {
    console.log("Google Calendar: token refreshed, persisting...");
    const existing = oAuth2Client.credentials;
    const merged = { ...existing, ...tokens };
    oAuth2Client.setCredentials(merged);
    saveGoogleToken(merged);
  });

  try {
    const raw = readFileSync(GCAL_TOKEN_PATH, "utf-8");
    if (raw && raw.trim()) {
      const token = JSON.parse(raw);
      if (token && token.access_token) {
        oAuth2Client.setCredentials(token);
        console.log("Google Calendar: loaded saved token");
      }
    }
  } catch {
    console.log(
      "Google Calendar: no saved token found — user needs to connect",
    );
  }
}
// initGoogleAuth() is called inside app.whenReady() below

function saveGoogleToken(token) {
  writeFileSync(GCAL_TOKEN_PATH, JSON.stringify(token));
}

function authUrl() {
  if (!oAuth2Client) return null;
  return oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email"
    ],
  });
}

// --------------- IPC handlers ---------------

function setupIPC() {
  ipcMain.handle("get-settings", () => loadSettings());

  ipcMain.handle("update-settings", (_, partial) => {
    const settings = saveSettings(partial);
    if (partial.hotkey !== undefined) registerHotkey(settings.hotkey);
    if (partial.theme !== undefined) applyTheme(settings.theme);
    return settings;
  });

  ipcMain.handle("load-app-data", () => loadAppData());

  ipcMain.handle("save-app-data", (_, partial) => {
    return saveAppData(partial);
  });

  ipcMain.handle("start-dictation", () => {
    // The most reliable way to trigger dictation across all macOS contexts
    // is to send the default Dictation shortcut (double tap Fn/Globe key).
    const script = `
      tell application "System Events"
        key code 63
        delay 0.05
        key code 63
      end tell
    `;
    exec(`osascript -e '${script}'`, (error) => {
      if (error) console.error("Dictation AppleScript error:", error);
    });
  });

  ipcMain.handle("show-notification", (_, { title, body }) => {
    if (!Notification.isSupported()) return false;
    const n = new Notification({ title, body, silent: false });
    n.on("click", () => {
      mainWindow?.show();
      mainWindow?.focus();
    });
    n.show();
    return true;
  });

  ipcMain.handle("export-tasks", async (_, data) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Export Tasks",
      defaultPath: `stepler-export-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON Files", extensions: ["json"] }],
    });
    if (canceled || !filePath) return { success: false };
    try {
      writeFileSync(filePath, JSON.stringify(data, null, 2));
      return { success: true, filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("import-tasks", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: "Import Tasks",
      filters: [{ name: "JSON Files", extensions: ["json"] }],
      properties: ["openFile"],
    });
    if (canceled || !filePaths.length) return { success: false };
    try {
      const raw = readFileSync(filePaths[0], "utf-8");
      const data = JSON.parse(raw);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("google-calendar-status", async () => {
    if (!oAuth2Client) return { configured: false, connected: false };
    const connected = !!oAuth2Client.credentials?.access_token;
    let email = null;

    if (connected) {
      try {
        const info = await oAuth2Client.getTokenInfo(oAuth2Client.credentials.access_token);
        email = info.email;
      } catch (err) {
        console.error("Failed to fetch Google account email:", err.message);
      }
    }

    return {
      configured: true,
      connected,
      email,
    };
  });

  ipcMain.handle("google-calendar-auth", async () => {
    if (!oAuth2Client)
      return {
        success: false,
        error: "Not configured. Missing .env variables.",
      };
    const url = authUrl();
    if (url) shell.openExternal(url);
    return { success: true };
  });

  ipcMain.handle("google-calendar-disconnect", () => {
    if (oAuth2Client) {
      oAuth2Client.setCredentials({});
      try {
        writeFileSync(GCAL_TOKEN_PATH, ""); // Clear file
      } catch {
        // ignore
      }
    }
    return { success: true };
  });

  ipcMain.handle(
    "google-calendar-create-event",
    async (_, { text, dateString }) => {
      console.log("GCal create-event called with:", { text, dateString });
      console.log(
        "GCal oAuth2Client exists:",
        !!oAuth2Client,
        "has access_token:",
        !!oAuth2Client?.credentials?.access_token,
      );

      if (!oAuth2Client || !oAuth2Client.credentials?.access_token) {
        console.warn("GCal: Not connected — skipping event creation");
        return { success: false, error: "Not connected to Google Calendar." };
      }

      const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

      let eventDate = new Date();
      if (dateString === "Tomorrow") {
        eventDate.setDate(eventDate.getDate() + 1);
      } else if (dateString === "Next Week") {
        eventDate.setDate(eventDate.getDate() + 7);
      }

      let start, end;
      if (dateString) {
        const ymd = eventDate.toISOString().split("T")[0];
        start = { date: ymd };

        const nextDay = new Date(eventDate);
        nextDay.setDate(nextDay.getDate() + 1);
        end = { date: nextDay.toISOString().split("T")[0] };
      } else {
        start = { dateTime: eventDate.toISOString() };
        const nextHour = new Date(eventDate.getTime() + 60 * 60 * 1000);
        end = { dateTime: nextHour.toISOString() };
      }

      const eventParams = {
        summary: text,
        start,
        end,
      };

      console.log("GCal inserting event:", JSON.stringify(eventParams));

      try {
        const res = await calendar.events.insert({
          calendarId: "primary",
          resource: eventParams,
        });
        console.log("GCal event created:", res.data.htmlLink);
        return { success: true, link: res.data.htmlLink, eventId: res.data.id };
      } catch (error) {
        console.error("GCal event creation error:", error.message);
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle(
    "google-calendar-update-event",
    async (_, { eventId, text, dateString, reminderTime }) => {
      console.log("GCal update-event called with:", { eventId, text, dateString, reminderTime });
      if (!oAuth2Client || !oAuth2Client.credentials?.access_token) {
        return { success: false, error: "Not connected to Google Calendar." };
      }

      const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

      let eventDate = new Date();
      if (dateString === "Tomorrow") {
        eventDate.setDate(eventDate.getDate() + 1);
      } else if (dateString === "Next Week") {
        eventDate.setDate(eventDate.getDate() + 7);
      } else if (dateString) {
        const parsed = new Date(dateString);
        if (!isNaN(parsed.getTime())) eventDate = parsed;
      }

      if (reminderTime) {
        const [hours, minutes] = reminderTime.split(":");
        eventDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      } else {
        eventDate.setHours(12, 0, 0, 0);
      }

      let start, end;
      if (dateString && !reminderTime) {
        const ymd = eventDate.toISOString().split("T")[0];
        start = { date: ymd };

        const nextDay = new Date(eventDate);
        nextDay.setDate(nextDay.getDate() + 1);
        end = { date: nextDay.toISOString().split("T")[0] };
      } else {
        start = { dateTime: eventDate.toISOString() };
        const nextHour = new Date(eventDate.getTime() + 60 * 60 * 1000);
        end = { dateTime: nextHour.toISOString() };
      }

      const eventParams = {
        summary: text,
        start,
        end,
      };

      try {
        const res = await calendar.events.patch({
          calendarId: "primary",
          eventId,
          resource: eventParams,
        });
        console.log("GCal event updated:", res.data.htmlLink);
        return { success: true, link: res.data.htmlLink };
      } catch (error) {
        console.error("GCal event update error:", error.message);
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle(
    "apple-reminders-create-event",
    async (_, { text, dateString, reminderTime }) => {
      console.log("Apple Reminders create-event called with:", { text, dateString, reminderTime });

      const settings = loadSettings();
      if (!settings.appleReminders) return { success: false, error: "Apple Reminders disabled in settings" };

      let eventDate = new Date();
      if (dateString === "Tomorrow") {
        eventDate.setDate(eventDate.getDate() + 1);
      } else if (dateString === "Next Week") {
        eventDate.setDate(eventDate.getDate() + 7);
      } else if (dateString) {
        const parsed = new Date(dateString);
        if (!isNaN(parsed.getTime())) {
          eventDate = parsed;
        }
      }

      if (reminderTime) {
        const [hours, minutes] = reminderTime.split(":");
        eventDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      } else {
        eventDate.setHours(12, 0, 0, 0);
      }

      const escapedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const script = `
set targetDate to (current date)
set year of targetDate to ${eventDate.getFullYear()}
set month of targetDate to ${eventDate.getMonth() + 1}
set day of targetDate to ${eventDate.getDate()}
set hours of targetDate to ${eventDate.getHours()}
set minutes of targetDate to ${eventDate.getMinutes()}
tell application "Reminders"
set newRem to make new reminder with properties {name:"${escapedText}", remind me date:targetDate}
return id of newRem
end tell
`;

      return new Promise((resolve) => {
        execFile("osascript", ["-e", script], (error, stdout) => {
          if (error) {
            console.error("Apple Reminders error:", error);
            resolve({ success: false, error: error.message });
          } else {
            const remId = stdout.trim();
            console.log("Apple Reminders event created, id:", remId);
            resolve({ success: true, appleReminderId: remId });
          }
        });
      });
    }
  );

  ipcMain.handle(
    "apple-reminders-update-event",
    async (_, { reminderId, text, dateString, reminderTime }) => {
      console.log("Apple Reminders update-event called with:", { reminderId, text, dateString, reminderTime });

      const settings = loadSettings();
      if (!settings.appleReminders) return { success: false, error: "Apple Reminders disabled in settings" };

      if (!reminderId) return { success: false, error: "No reminder ID provided" };

      let eventDate = new Date();
      let hasDate = false;

      if (dateString === "Tomorrow") {
        eventDate.setDate(eventDate.getDate() + 1);
        hasDate = true;
      } else if (dateString === "Next Week") {
        eventDate.setDate(eventDate.getDate() + 7);
        hasDate = true;
      } else if (dateString) {
        const parsed = new Date(dateString);
        if (!isNaN(parsed.getTime())) {
          eventDate = parsed;
          hasDate = true;
        }
      }

      if (reminderTime) {
        const [hours, minutes] = reminderTime.split(":");
        eventDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
        hasDate = true;
      } else if (hasDate) {
        eventDate.setHours(12, 0, 0, 0);
      }

      let dateScript = "";
      if (hasDate) {
        dateScript = `
set targetDate to (current date)
set year of targetDate to ${eventDate.getFullYear()}
set month of targetDate to ${eventDate.getMonth() + 1}
set day of targetDate to ${eventDate.getDate()}
set hours of targetDate to ${eventDate.getHours()}
set minutes of targetDate to ${eventDate.getMinutes()}
set remind me date of theReminder to targetDate
`;
      }

      const escapedText = text ? text.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : "";
      const script = `
tell application "Reminders"
try
set theReminder to reminder id "${reminderId}"
${text ? `set name of theReminder to "${escapedText}"` : ""}
${dateScript}
on error
return "error: not found"
end try
end tell
`;

      return new Promise((resolve) => {
        execFile("osascript", ["-e", script], (error, stdout) => {
          if (error || stdout.includes("error: not found")) {
            console.error("Apple Reminders update error:", error || "Not found");
            resolve({ success: false, error: error ? error.message : "Not found" });
          } else {
            console.log("Apple Reminders event updated");
            resolve({ success: true });
          }
        });
      });
    }
  );
}

// --------------- HTTP API Server (for CLI) ---------------

function startAPIServer() {
  const PORT = 3000;
  const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const { method, url } = req;

    // GET /api/tasks
    if (method === "GET" && url === "/api/tasks") {
      const data = loadAppData();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data.tasks));
      return;
    }

    // GET /oauth2callback
    if (method === "GET" && url.startsWith("/oauth2callback")) {
      const urlObj = new URL(url, "http://localhost:3000");
      const code = urlObj.searchParams.get("code");
      if (code && oAuth2Client) {
        try {
          const { tokens } = await oAuth2Client.getToken(code);
          oAuth2Client.setCredentials(tokens);
          saveGoogleToken(tokens);
          if (mainWindow) {
            mainWindow.webContents.send("google-calendar-connected", true);
          }
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(
            "<h1>Authentication successful!</h1><p>You can close this tab and return to Stepler.</p><script>window.setTimeout(()=>window.close(), 2000)</script>",
          );
        } catch {
          res.writeHead(500);
          res.end("Auth Error");
        }
      } else {
        res.writeHead(400);
        res.end("No code provided");
      }
      return;
    }

    // POST /api/tasks
    if (method === "POST" && url === "/api/tasks") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          const { title } = JSON.parse(body || "{}");
          if (!title) {
            res.writeHead(400);
            res.end("Title required");
            return;
          }

          const data = loadAppData();
          const newTask = {
            id: Date.now().toString(),
            text: title,
            completed: false,
            createdAt: new Date().toISOString(),
          };

          data.tasks.push(newTask);
          saveAppData(data);

          // Notify renderer to refresh UI
          mainWindow?.webContents.send("app-data-updated", data);

          res.writeHead(201, { "Content-Type": "application/json" });
          res.end(JSON.stringify(newTask));
        } catch {
          res.writeHead(400);
          res.end("Invalid JSON");
        }
      });
      return;
    }

    // DELETE /api/tasks/:id
    if (method === "DELETE" && url.startsWith("/api/tasks/")) {
      const id = url.split("/").pop();
      const data = loadAppData();
      const originalCount = data.tasks.length;
      data.tasks = data.tasks.filter((t) => t.id !== id);

      if (data.tasks.length === originalCount) {
        res.writeHead(404);
        res.end("Task not found");
        return;
      }

      saveAppData(data);
      // Notify renderer to refresh UI
      mainWindow?.webContents.send("app-data-updated", data);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`API Server running at http://localhost:${PORT}`);
  });

  server.on("error", (err) => {
    console.error("API Server error:", err);
  });
}

// --------------- App lifecycle ---------------

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.stepler.app");

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Initialize Google Auth now that app is ready (needs app.getAppPath())
  initGoogleAuth();

  const settings = loadSettings();
  applyTheme(settings.theme);

  buildMenu();
  setupIPC();
  startAPIServer();
  createWindow();
  registerHotkey(settings.hotkey);

  if (!is.dev) {
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on("update-downloaded", () => {
      dialog
        .showMessageBox({
          type: "info",
          title: "Update Available",
          message:
            "A new version of Stepler has been downloaded. Restart the application to apply the updates.",
          buttons: ["Restart", "Later"],
        })
        .then((returnValue) => {
          if (returnValue.response === 0) {
            autoUpdater.quitAndInstall();
          }
        });
    });
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on("before-quit", () => {
  app.isQuitting = true;
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
