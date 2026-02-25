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
import { exec } from "child_process";
import http from "http";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";

let mainWindow = null;

// --------------- Settings persistence ---------------

const settingsPath = join(app.getPath("userData"), "stepler-settings.json");
const isMac = process.platform === "darwin";
const defaults = {
  hotkey: isMac ? "Shift+Command+Space" : "Ctrl+Shift+Space",
  theme: "dark",
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
}

// --------------- HTTP API Server (for CLI) ---------------

function startAPIServer() {
  const PORT = 3000;
  const server = http.createServer((req, res) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

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
            id: Math.random().toString(36).substring(2, 9),
            title,
            done: false,
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

  const settings = loadSettings();
  applyTheme(settings.theme);

  buildMenu();
  setupIPC();
  startAPIServer();
  createWindow();
  registerHotkey(settings.hotkey);

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
