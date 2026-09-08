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
  protocol,
  net,
  clipboard,
  systemPreferences,
  nativeImage,
  safeStorage,
  Tray,
} from "electron";
import { join, basename, extname } from "path";
import { pathToFileURL } from "url";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  renameSync,
  copyFileSync,
  statSync,
  openSync,
  readSync,
  closeSync,
} from "fs";
import { tmpdir } from "os";
import { randomUUID, randomBytes, createHash, timingSafeEqual } from "crypto";
import { execFile } from "child_process";
import http from "http";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";

// ---------------------------------------------------------------------------
// Custom scheme for attachments. Registered before app is ready so the
// renderer can load <img src="stepler-file://attachments/<id>"> without ever
// holding megabytes of base64 in memory or in the data file.
// ---------------------------------------------------------------------------

const ATTACH_SCHEME = "stepler-file";
protocol.registerSchemesAsPrivileged([
  {
    scheme: ATTACH_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

let mainWindow = null;
let tray = null;
let autoUpdater = null;
/** What the header pill is showing right now, replayed to a fresh window. */
let updateState = { status: "idle" };

function sendUpdateState(next) {
  updateState = { ...next };
  if (mainWindow && !mainWindow.isDestroyed())
    mainWindow.webContents.send("update-state", updateState);
}

const isMac = process.platform === "darwin";
const USER_DATA = app.getPath("userData");
const settingsPath = join(USER_DATA, "stepler-settings.json");
const dataPath = join(USER_DATA, "stepler-data.json");
const backupPath = join(USER_DATA, "stepler-data.backup.json");
const apiInfoPath = join(USER_DATA, "stepler-api.json");
const attachDir = join(USER_DATA, "attachments");

// --------------- small helpers ---------------

function writeJsonAtomic(path, obj) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2));
  renameSync(tmp, path);
}

function safeExt(name) {
  const ext = extname(String(name || "")).toLowerCase();
  return /^\.[a-z0-9]{1,12}$/.test(ext) ? ext : "";
}

const UNSAFE_NAME_CHARS = '\\/:*?"<>| ';

/**
 * Strip any directory component, control character and path separator, so a
 * crafted attachment name cannot escape the folder it belongs in.
 */
function sanitizeFileName(name) {
  const raw = basename(String(name || "file"));
  let out = "";
  for (const ch of raw) {
    const code = ch.codePointAt(0);
    out +=
      code < 0x20 || code === 0x7f || UNSAFE_NAME_CHARS.includes(ch) ? "_" : ch;
  }
  const clean = out.replace(/^\.+/, "").slice(0, 120);
  return clean || "file";
}

/** AppleScript string literal escaping (\\, ", newlines). */
function escapeAppleScript(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

const REMINDER_ID_RE = /^x-apple-reminder:\/\/[0-9A-Fa-f-]{10,60}$/;

/** Stepler keeps its mirrored tasks in its own list rather than the default
 * one, so a user's existing reminders never get mixed in with ours. */
const REMINDER_LIST = "Stepler";
const ATTACH_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;

function attachmentPath(id) {
  if (typeof id !== "string" || !ATTACH_ID_RE.test(id) || id.includes(".."))
    return null;
  return join(attachDir, id);
}

function ensureAttachDir() {
  if (!existsSync(attachDir)) mkdirSync(attachDir, { recursive: true });
}

/** Only ever hand user-controlled URLs to the OS when they are plainly safe. */
function isSafeExternalUrl(value) {
  try {
    const u = new URL(String(value));
    return (
      u.protocol === "https:" ||
      u.protocol === "http:" ||
      u.protocol === "mailto:"
    );
  } catch {
    return false;
  }
}

function localYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// --------------- Settings persistence ---------------

const defaults = {
  hotkey: isMac ? "Shift+Command+Space" : "Ctrl+Shift+Space",
  theme: "dark",
  appleReminders: false,
  captureSelection: true,
  calendarSync: false,
  escToHide: true,
  apiEnabled: true,
  apiPort: 3000,
  apiToken: "",
  projects: [],
  projectsBackfilled: false,
  windowBounds: null,
};

let settingsCache = null;

function loadSettings() {
  if (settingsCache) return settingsCache;
  try {
    settingsCache = {
      ...defaults,
      ...JSON.parse(readFileSync(settingsPath, "utf-8")),
    };
  } catch {
    settingsCache = { ...defaults };
  }
  return settingsCache;
}

function saveSettings(partial) {
  const merged = { ...loadSettings(), ...partial };
  settingsCache = merged;
  try {
    writeJsonAtomic(settingsPath, merged);
  } catch (err) {
    console.error("Failed to persist settings:", err.message);
  }
  return merged;
}

/** Settings safe to hand to the renderer (never the API token). */
function publicSettings(s = loadSettings()) {
  const { apiToken, windowBounds, ...rest } = s; // eslint-disable-line no-unused-vars
  return { ...rest, apiConfigured: !!apiToken };
}

// --------------- App data persistence ---------------

const dataDefaults = {
  tasks: [],
  history: [],
  deletedTasks: [],
  currentDate: null,
  firedReminders: [],
};

let dataCache = null;
let saveTimer = null;
let dirty = false;
let loadedFromBackup = false;

function readDataFile(path) {
  const raw = readFileSync(path, "utf-8");
  if (!raw.trim()) throw new Error("empty");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") throw new Error("not an object");
  return parsed;
}

function loadAppData() {
  if (dataCache) return dataCache;
  let parsed = null;
  try {
    parsed = readDataFile(dataPath);
  } catch (err) {
    console.warn("Data file unreadable:", err.message);
    loadedFromBackup = true;
    try {
      parsed = readDataFile(backupPath);
      console.warn("Recovered tasks from the backup file.");
    } catch {
      parsed = null;
      console.warn("No usable backup either — starting empty.");
    }
  }
  dataCache = { ...dataDefaults, ...(parsed || {}) };
  return dataCache;
}

function flushAppData() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!dirty || !dataCache) return;
  dirty = false;
  try {
    writeJsonAtomic(dataPath, dataCache);
  } catch (err) {
    console.error("Failed to write data file:", err.message);
    dirty = true;
  }
}

/**
 * Tell the window about a change made outside it (the CLI). Always the whole
 * picture: the renderer rebuilds its list from this, so a partial payload
 * would look like "everything else was deleted".
 */
function broadcastData() {
  if (!mainWindow || mainWindow.isDestroyed() || !dataCache) return;
  mainWindow.webContents.send("app-data-updated", {
    tasks: dataCache.tasks,
    history: dataCache.history,
    deletedTasks: dataCache.deletedTasks,
  });
}

/**
 * Merge a partial update into the in-memory cache and schedule one atomic
 * write. The old code re-read, re-parsed and rewrote the whole file on every
 * keystroke-sized change; this keeps a single copy in memory instead.
 */
function saveAppData(partial) {
  dataCache = { ...loadAppData(), ...partial };
  dirty = true;
  if (!saveTimer) saveTimer = setTimeout(flushAppData, 400);
  return dataCache;
}

// --------------- Attachments on disk ---------------

function writeAttachmentBytes(bytes, name) {
  ensureAttachDir();
  const id = `${randomUUID()}${safeExt(name)}`;
  writeFileSync(join(attachDir, id), Buffer.from(bytes));
  return id;
}

/** Decode an image the slow way, only when the cheap header read fails. */
function loadNativeImage(path) {
  let img = nativeImage.createFromPath(path);
  if (img.isEmpty()) {
    try {
      img = nativeImage.createFromBuffer(readFileSync(path));
    } catch {
      /* leave it empty */
    }
  }
  return img;
}

/**
 * Pull width and height straight out of the file header. Fully decoding a few
 * dozen screenshots to learn their size made the one-off migration take
 * several seconds; reading 64 KB per file takes milliseconds.
 */
function dimensionsFromHeader(path) {
  let head;
  try {
    const fd = openSync(path, "r");
    head = Buffer.alloc(65536);
    const read = readSync(fd, head, 0, head.length, 0);
    closeSync(fd);
    head = head.subarray(0, read);
  } catch {
    return null;
  }
  if (head.length < 16) return null;

  // PNG: IHDR always comes first.
  if (
    head
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { w: head.readUInt32BE(16), h: head.readUInt32BE(20) };
  }
  // GIF
  if (head.subarray(0, 3).toString("latin1") === "GIF") {
    return { w: head.readUInt16LE(6), h: head.readUInt16LE(8) };
  }
  // WebP (VP8X / VP8 / VP8L)
  if (
    head.subarray(0, 4).toString("latin1") === "RIFF" &&
    head.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    const chunk = head.subarray(12, 16).toString("latin1");
    if (chunk === "VP8X")
      return {
        w: (head.readUIntLE(24, 3) & 0xffffff) + 1,
        h: (head.readUIntLE(27, 3) & 0xffffff) + 1,
      };
    if (chunk === "VP8 " && head.length > 30)
      return {
        w: head.readUInt16LE(26) & 0x3fff,
        h: head.readUInt16LE(28) & 0x3fff,
      };
  }
  // JPEG: walk the segment chain to the frame header.
  if (head[0] === 0xff && head[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < head.length) {
      if (head[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = head[offset + 1];
      const length = head.readUInt16BE(offset + 2);
      const isFrame =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isFrame)
        return {
          h: head.readUInt16BE(offset + 5),
          w: head.readUInt16BE(offset + 7),
        };
      if (length < 2) break;
      offset += 2 + length;
    }
  }
  return null;
}

/**
 * Intrinsic size, stored alongside the attachment so the renderer can reserve
 * the right box before the image loads — without it, lazily loaded pictures
 * pop in and shove the timeline around under the reader.
 */
function imageDimensions(id) {
  const p = attachmentPath(id);
  if (!p || !existsSync(p)) return null;
  const fromHeader = dimensionsFromHeader(p);
  if (fromHeader?.w > 0 && fromHeader?.h > 0) return fromHeader;
  try {
    const img = loadNativeImage(p);
    if (img.isEmpty()) return null;
    const { width, height } = img.getSize();
    return width > 0 && height > 0 ? { w: width, h: height } : null;
  } catch {
    return null;
  }
}

function writeAttachmentFromDataUrl(dataUrl, name) {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) throw new Error("not a data url");
  return writeAttachmentBytes(
    Buffer.from(dataUrl.slice(comma + 1), "base64"),
    name,
  );
}

/** Inline an attachment again, for a portable export file. */
function attachmentToDataUrl(att) {
  const p = attachmentPath(att?.id);
  if (!p || !existsSync(p)) return null;
  const ext = safeExt(att.name || att.id).replace(".", "");
  const mime =
    att.type === "image"
      ? `image/${ext === "jpg" ? "jpeg" : ext || "png"}`
      : "application/octet-stream";
  return `data:${mime};base64,${readFileSync(p).toString("base64")}`;
}

function withDimensions(att) {
  if (att.type !== "image" || !att.id || (att.w && att.h)) return att;
  const dims = imageDimensions(att.id);
  return dims ? { ...att, ...dims } : att;
}

function sanitizeAttachment(a) {
  if (!a || typeof a !== "object") return null;
  const name = sanitizeFileName(a.name || "attachment");
  const type = a.type === "image" ? "image" : "file";
  if (typeof a.id === "string" && ATTACH_ID_RE.test(a.id)) {
    const base = { id: a.id, name, type };
    if (Number.isFinite(a.w) && Number.isFinite(a.h))
      return { ...base, w: a.w, h: a.h };
    return withDimensions(base);
  }
  if (typeof a.url === "string" && a.url.startsWith("data:")) {
    try {
      return withDimensions({
        id: writeAttachmentFromDataUrl(a.url, name),
        name,
        type,
      });
    } catch {
      return { name, type, missing: true };
    }
  }
  return { name, type, missing: true };
}

function sanitizeSubtask(st) {
  if (!st || typeof st !== "object") return null;
  const out = {
    id: st.id != null ? String(st.id) : String(Date.now()),
    text: typeof st.text === "string" ? st.text.slice(0, 20000) : "",
    completed: !!st.completed,
  };
  const att = sanitizeAttachment(st.attachment);
  if (att) out.attachment = att;
  return out;
}

function sanitizeTask(t) {
  if (!t || typeof t !== "object") return null;
  const out = {
    id: t.id != null ? String(t.id) : String(Date.now()),
    text:
      typeof t.text === "string"
        ? t.text.slice(0, 20000)
        : typeof t.title === "string"
          ? t.title.slice(0, 20000)
          : "",
    completed: !!t.completed,
    priority: !!t.priority,
  };
  // Normalise the legacy singular `project` into the `projects` array so search
  // and the sidebar stop disagreeing about which tasks belong to a project.
  const projects = Array.isArray(t.projects)
    ? t.projects
    : typeof t.project === "string" && t.project
      ? [t.project]
      : [];
  const cleanProjects = [
    ...new Set(
      projects
        .filter((p) => typeof p === "string" && p.trim())
        .map((p) => p.slice(0, 80)),
    ),
  ].slice(0, 25);
  if (cleanProjects.length) out.projects = cleanProjects;
  if (typeof t.dueDate === "string" && t.dueDate)
    out.dueDate = t.dueDate.slice(0, 40);
  if (typeof t.reminder === "string" && /^\d{1,2}:\d{2}$/.test(t.reminder))
    out.reminder = t.reminder;
  if (typeof t.deletedAt === "number") out.deletedAt = t.deletedAt;
  if (typeof t.gcalEventId === "string" && /^[\w-]{1,200}$/.test(t.gcalEventId))
    out.gcalEventId = t.gcalEventId;
  if (typeof t.gcalLink === "string" && isSafeExternalUrl(t.gcalLink))
    out.gcalLink = t.gcalLink;
  if (
    typeof t.appleReminderId === "string" &&
    REMINDER_ID_RE.test(t.appleReminderId)
  )
    out.appleReminderId = t.appleReminderId;
  if (typeof t.jiraLink === "string" && isSafeExternalUrl(t.jiraLink))
    out.jiraLink = t.jiraLink;
  if (
    typeof t.jiraKey === "string" &&
    /^[A-Za-z][A-Za-z0-9_]*-\d+$/.test(t.jiraKey)
  )
    out.jiraKey = t.jiraKey;
  const att = sanitizeAttachment(t.attachment);
  if (att) out.attachment = att;
  if (Array.isArray(t.subtasks)) {
    const subs = t.subtasks.map(sanitizeSubtask).filter(Boolean).slice(0, 500);
    if (subs.length) out.subtasks = subs;
  }
  return out;
}

function sanitizeDataShape(data) {
  return {
    ...dataDefaults,
    ...data,
    tasks: (Array.isArray(data.tasks) ? data.tasks : [])
      .map(sanitizeTask)
      .filter(Boolean),
    history: (Array.isArray(data.history) ? data.history : [])
      .map((day) => {
        if (!day || typeof day !== "object") return null;
        const tasks = (Array.isArray(day.tasks) ? day.tasks : [])
          .map(sanitizeTask)
          .filter(Boolean);
        if (!tasks.length) return null;
        return {
          date: typeof day.date === "string" ? day.date.slice(0, 40) : "",
          ...(typeof day.ymd === "string" ? { ymd: day.ymd } : {}),
          tasks,
        };
      })
      .filter(Boolean),
    deletedTasks: (Array.isArray(data.deletedTasks) ? data.deletedTasks : [])
      .map(sanitizeTask)
      .filter(Boolean),
    firedReminders: Array.isArray(data.firedReminders)
      ? data.firedReminders.filter((k) => typeof k === "string").slice(-500)
      : [],
  };
}

/**
 * One-time migration: pull base64 attachments out of the JSON blob into real
 * files, drop dead blob: URLs, and fold `project` into `projects`.
 */
function migrateAppData() {
  const before = loadAppData();
  let inlineBytes = 0;
  const countInline = (holder) => {
    if (holder?.attachment && typeof holder.attachment.url === "string")
      inlineBytes += holder.attachment.url.length;
  };
  const walk = (t) => {
    countInline(t);
    (t?.subtasks || []).forEach(countInline);
  };
  (before.tasks || []).forEach(walk);
  (before.history || []).forEach((d) => (d?.tasks || []).forEach(walk));
  (before.deletedTasks || []).forEach(walk);

  const everyTask = [
    ...(before.tasks || []),
    ...(before.history || []).flatMap((d) => d?.tasks || []),
    ...(before.deletedTasks || []),
  ].filter(Boolean);
  const hasLegacyProject = everyTask.some((t) => t.project && !t.projects);
  const missingDims = everyTask.some((t) => {
    const holders = [t, ...(t.subtasks || [])];
    return holders.some(
      (h) =>
        h?.attachment?.id && h.attachment.type === "image" && !h.attachment.w,
    );
  });

  if (!inlineBytes && !hasLegacyProject && !missingDims)
    return { migrated: false };

  try {
    if (existsSync(dataPath)) copyFileSync(dataPath, backupPath);
  } catch (err) {
    console.warn("Could not write pre-migration backup:", err.message);
  }
  dataCache = sanitizeDataShape(before);
  dirty = true;
  flushAppData();
  const size = existsSync(dataPath) ? statSync(dataPath).size : 0;
  console.log(
    `Migrated attachments to disk: ${(inlineBytes / 1048576).toFixed(1)} MB of inline data removed, data file is now ${(size / 1024).toFixed(0)} KB`,
  );
  return { migrated: true };
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
    currentHotkey = null;
  }
  let ok = false;
  try {
    ok = globalShortcut.register(accelerator, toggleWindowFromHotkey);
  } catch {
    ok = false;
  }
  if (ok && globalShortcut.isRegistered(accelerator)) {
    currentHotkey = accelerator;
    return true;
  }
  // Registration failed (taken by another app) — fall back to the default so
  // the user is never left without a way to summon the window.
  try {
    globalShortcut.unregister(accelerator);
  } catch {
    /* ignore */
  }
  if (accelerator !== defaults.hotkey) {
    try {
      if (globalShortcut.register(defaults.hotkey, toggleWindow))
        currentHotkey = defaults.hotkey;
    } catch {
      /* ignore */
    }
  }
  return false;
}

// --------------- Theme ---------------

function applyTheme(theme) {
  nativeTheme.themeSource = ["light", "dark", "system"].includes(theme)
    ? theme
    : "system";
}

// --------------- Window toggle ---------------

/**
 * What is selected in whatever app is in front, on the way to showing the
 * window. macOS has no way to read another app's selection, so this copies it
 * — and puts the clipboard back the way it was, because taking someone's
 * clipboard to be helpful is not a fair trade.
 *
 * Returns null when nothing is selected, when the copy changed nothing, or on
 * any refusal at all: this must never be the reason the window fails to open.
 */
/**
 * Copying from another app means synthesising a keystroke, and macOS only
 * lets an app do that once it is ticked in Privacy & Security →
 * Accessibility. Ask the first time, then stay quiet: nagging on every
 * hotkey press would be worse than the feature being off.
 */
let accessibilityAsked = false;

function canSendKeystrokes() {
  if (!isMac) return false;
  if (systemPreferences.isTrustedAccessibilityClient(false)) return true;
  if (!accessibilityAsked) {
    accessibilityAsked = true;
    // `true` puts up the system dialog with the button that opens the pane.
    systemPreferences.isTrustedAccessibilityClient(true);
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send(
        "needs-accessibility",
        "To bring selected text with you, tick Stepler in System Settings → Privacy & Security → Accessibility, then try again.",
      );
  }
  return false;
}

/**
 * Ask the frontmost app what is selected, through the accessibility API. No
 * keystroke, no clipboard, nothing to put back — most native apps answer
 * this directly.
 */
async function readSelectionDirectly() {
  const res = await runAppleScript(`
tell application "System Events"
try
set frontApp to first application process whose frontmost is true
set el to value of attribute "AXFocusedUIElement" of frontApp
set sel to value of attribute "AXSelectedText" of el
if sel is missing value then return ""
return sel
on error
return ""
end try
end tell`);
  return res.ok ? res.out : "";
}

/**
 * The fallback for apps that do not publish their selection: copy it, then
 * put the clipboard back exactly as it was, images included.
 */
async function copySelectionViaClipboard() {
  const before = clipboard.readText();
  const beforeImage = clipboard.readImage();
  try {
    // Comparing before with after cannot tell "copied the same words again"
    // from "copied nothing", so start from empty.
    clipboard.clear();
    // The shortcut that got us here still has its modifiers down; Cmd+C on
    // top of Shift+Cmd is Shift+Cmd+C, which copies nothing.
    await new Promise((r) => setTimeout(r, 200));
    const res = await runAppleScript(
      'tell application "System Events" to keystroke "c" using command down',
    );
    if (!res.ok) {
      console.warn("Selection capture: copy refused —", res.error);
      return null;
    }
    let after = "";
    for (let i = 0; i < 12; i += 1) {
      await new Promise((r) => setTimeout(r, 50));
      after = clipboard.readText();
      if (after) break;
    }
    return after || null;
  } catch (err) {
    console.warn("Selection capture failed:", err.message);
    return null;
  } finally {
    if (before) clipboard.writeText(before);
    else if (!beforeImage.isEmpty()) clipboard.writeImage(beforeImage);
    else clipboard.clear();
  }
}

async function grabSelectedText() {
  if (!isMac || !loadSettings().captureSelection) return null;
  if (!canSendKeystrokes()) return null;
  let text = await readSelectionDirectly();
  if (!text) text = (await copySelectionViaClipboard()) || "";
  text = text.trim();
  if (!text) {
    console.warn("Selection capture: nothing was selected.");
    return null;
  }
  console.log("Selection capture: got", text.length, "characters");
  return text.length > 5000 ? text.slice(0, 5000) : text;
}

function showWindow() {
  if (!mainWindow) createWindow();
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  if (isMac) app.focus({ steal: true });
}

function hideWindow() {
  if (!mainWindow) return;
  if (isMac) app.hide();
  else mainWindow.hide();
}

function toggleWindow() {
  if (!mainWindow) return createWindow();
  if (mainWindow.isVisible() && mainWindow.isFocused()) return hideWindow();
  return showWindow();
}

/**
 * The hotkey specifically: take whatever is selected with us, so the thought
 * you were reading is already in the box.
 */
async function toggleWindowFromHotkey() {
  if (!mainWindow) return createWindow();
  if (mainWindow.isVisible() && mainWindow.isFocused()) return hideWindow();
  const selected = await grabSelectedText();
  showWindow();
  if (selected && mainWindow && !mainWindow.isDestroyed())
    mainWindow.webContents.send("captured-selection", selected);
  return undefined;
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
    { label: "Edit", role: "editMenu" },
    {
      label: "View",
      submenu: [
        {
          label: "Search Tasks",
          accelerator: "CmdOrCtrl+F",
          click: () => mainWindow?.webContents.send("open-search"),
        },
        {
          label: "New Task",
          accelerator: "CmdOrCtrl+N",
          click: () => mainWindow?.webContents.send("focus-input"),
        },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        ...(is.dev
          ? [
              { type: "separator" },
              { role: "toggleDevTools" },
              { role: "reload" },
            ]
          : []),
      ],
    },
    { label: "Window", submenu: [{ role: "minimize" }, { role: "close" }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function buildTray() {
  if (isMac || tray) return; // macOS already has a Dock icon
  try {
    const img = nativeImage
      .createFromPath(icon)
      .resize({ width: 16, height: 16 });
    tray = new Tray(img);
    tray.setToolTip("Stepler");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Show Stepler", click: showWindow },
        { type: "separator" },
        {
          label: "Quit",
          click: () => {
            app.isQuitting = true;
            app.quit();
          },
        },
      ]),
    );
    tray.on("click", toggleWindow);
  } catch (err) {
    console.warn("Tray unavailable:", err.message);
  }
}

// --------------- Window creation ---------------

function createWindow() {
  const saved = loadSettings().windowBounds;
  mainWindow = new BrowserWindow({
    width: saved?.width || 1000,
    height: saved?.height || 800,
    ...(saved && Number.isInteger(saved.x) ? { x: saved.x, y: saved.y } : {}),
    show: false,
    titleBarStyle: "hiddenInset",
    vibrancy: "under-window",
    visualEffectState: "active",
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#171717" : "#ffffff",
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      plugins: true, // required for the built-in PDF viewer used by previews
      spellcheck: true,
    },
  });

  mainWindow.on("ready-to-show", () => mainWindow.show());

  const persistBounds = () => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized())
      return;
    const b = mainWindow.getNormalBounds();
    saveSettings({ windowBounds: b });
  };
  mainWindow.on("resized", persistBounds);
  mainWindow.on("moved", persistBounds);

  mainWindow.on("close", (e) => {
    persistBounds();
    if (!app.isQuitting) {
      e.preventDefault();
      hideWindow();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isSafeExternalUrl(details.url)) shell.openExternal(details.url);
    else console.warn("Blocked window.open for unsafe URL:", details.url);
    return { action: "deny" };
  });

  // Never let the app frame itself navigate away from the local bundle.
  mainWindow.webContents.on("will-navigate", (e, url) => {
    const current = mainWindow.webContents.getURL();
    if (url !== current) {
      e.preventDefault();
      if (isSafeExternalUrl(url)) shell.openExternal(url);
    }
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// --------------- Token storage (encrypted at rest when available) ---------------

function saveSecret(path, obj) {
  try {
    const json = JSON.stringify(obj);
    if (safeStorage.isEncryptionAvailable()) {
      writeFileSync(
        path,
        JSON.stringify({
          v: 1,
          enc: safeStorage.encryptString(json).toString("base64"),
        }),
      );
    } else {
      writeFileSync(path, json);
    }
  } catch (err) {
    console.error("Failed to store credentials:", err.message);
  }
}

function loadSecret(path) {
  try {
    const raw = readFileSync(path, "utf-8");
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.enc) {
      if (!safeStorage.isEncryptionAvailable()) return null;
      return JSON.parse(
        safeStorage.decryptString(Buffer.from(parsed.enc, "base64")),
      );
    }
    // Legacy plaintext token — re-save it encrypted on the way through.
    if (parsed && typeof parsed === "object") {
      saveSecret(path, parsed);
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function clearSecret(path) {
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    /* ignore */
  }
}

// --------------- Integration credentials ---------------

const CREDENTIALS_PATH = join(USER_DATA, "stepler-integrations.json");

/**
 * Client credentials come from the environment in development, or from a
 * user-owned file in a packaged build (the .env is deliberately not shipped).
 */
function loadIntegrationConfig() {
  let fromFile = {};
  try {
    fromFile = JSON.parse(readFileSync(CREDENTIALS_PATH, "utf-8")) || {};
  } catch {
    fromFile = {};
  }
  if (is.dev) {
    try {
      const envRaw = readFileSync(join(app.getAppPath(), ".env"), "utf-8");
      for (const line of envRaw.split("\n")) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
        if (m && !process.env[m[1]])
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch {
      /* no .env, fine */
    }
  }
  return {
    googleClientId:
      fromFile.googleClientId || process.env.GOOGLE_CLIENT_ID || "",
    googleClientSecret:
      fromFile.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET || "",
    jiraClientId: fromFile.jiraClientId || process.env.JIRA_CLIENT_ID || "",
    jiraClientSecret:
      fromFile.jiraClientSecret || process.env.JIRA_CLIENT_SECRET || "",
  };
}

let integrationConfig = {
  googleClientId: "",
  googleClientSecret: "",
  jiraClientId: "",
  jiraClientSecret: "",
};

// --------------- Google Calendar ---------------

const GCAL_TOKEN_PATH = join(USER_DATA, "step-gcal-token.json");
let oAuth2Client = null;
let googleApi = null; // lazily required: importing googleapis costs ~0.5s

async function getGoogle() {
  if (!googleApi) ({ google: googleApi } = await import("googleapis"));
  return googleApi;
}

async function initGoogleAuth() {
  const { googleClientId, googleClientSecret } = integrationConfig;
  if (!googleClientId || !googleClientSecret) {
    console.log("Google Calendar: not configured (no client id/secret).");
    return;
  }
  const google = await getGoogle();
  oAuth2Client = new google.auth.OAuth2(
    googleClientId,
    googleClientSecret,
    `http://127.0.0.1:${apiInfo.port || loadSettings().apiPort}/oauth2callback`,
  );
  oAuth2Client.on("tokens", (tokens) => {
    const merged = { ...oAuth2Client.credentials, ...tokens };
    oAuth2Client.setCredentials(merged);
    saveSecret(GCAL_TOKEN_PATH, merged);
  });
  const token = loadSecret(GCAL_TOKEN_PATH);
  if (token?.access_token || token?.refresh_token) {
    oAuth2Client.setCredentials(token);
    console.log("Google Calendar: loaded saved token");
  }
}

// --------------- Jira ---------------

const JIRA_TOKEN_PATH = join(USER_DATA, "step-jira-token.json");
const JIRA_BASIC_PATH = join(USER_DATA, "step-jira-basic.json");
let jiraAuthToken = null;
/** { siteUrl, email, token } when signed in with an Atlassian API token. */
let jiraBasic = null;

/** Accepts "acme", "acme.atlassian.net" or a full URL; returns the origin. */
function parseJiraSite(value) {
  let raw = String(value || "").trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw))
    raw = `https://${raw.includes(".") ? raw : `${raw}.atlassian.net`}`;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    if (!/^[a-z0-9.-]+$/i.test(u.hostname)) return null;
    return `https://${u.hostname}`;
  } catch {
    return null;
  }
}

function jiraFetch(creds, path, init = {}) {
  const auth = Buffer.from(`${creds.email}:${creds.token}`).toString("base64");
  return fetch(`${creds.siteUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

/**
 * One way in for every Jira call, whichever sign-in is in play. Basic auth
 * talks to the site directly; OAuth goes through api.atlassian.com and needs
 * the cloud id first.
 */
async function jiraApi(path, init = {}) {
  if (jiraBasic) {
    const res = await jiraFetch(jiraBasic, path, init);
    const body = await res.json().catch(() => null);
    return {
      ok: res.ok,
      status: res.status,
      body,
      error: res.ok ? null : jiraHttpError(res.status, body),
    };
  }

  const token = await getJiraAccessToken();
  if (!token)
    return { ok: false, status: 0, body: null, error: "Not connected" };
  const sites = await fetch(
    "https://api.atlassian.com/oauth/token/accessible-resources",
    { headers: { Authorization: `Bearer ${token}` } },
  ).then((r) => r.json());
  if (!Array.isArray(sites) || !sites.length)
    return {
      ok: false,
      status: 0,
      body: null,
      error: "No accessible Jira sites",
    };
  const cloudId = sites[0].id;
  const res = await fetch(
    `https://api.atlassian.com/ex/jira/${cloudId}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    },
  );
  const body = await res.json().catch(() => null);
  return {
    ok: res.ok,
    status: res.status,
    body,
    cloudId,
    error: res.ok ? null : jiraHttpError(res.status, body),
  };
}

/** Jira's own message when it gives one, and something actionable when not. */
function jiraHttpError(status, body) {
  const said =
    body?.errorMessages?.join(", ") ||
    Object.values(body?.errors || {}).join(", ") ||
    "";
  if (said) return said;
  if (status === 401)
    return "Jira rejected the sign-in. Reconnect in Settings.";
  if (status === 403) return "Your Jira account is not allowed to do that.";
  if (status === 404)
    return "Jira could not find that. Is the site address right?";
  return `Jira answered ${status}.`;
}

function initJiraAuth() {
  jiraBasic = loadSecret(JIRA_BASIC_PATH);
  if (!integrationConfig.jiraClientId || !integrationConfig.jiraClientSecret)
    return;
  jiraAuthToken = loadSecret(JIRA_TOKEN_PATH);
}

function saveJiraToken(token) {
  if (token.expires_in) token.expires_at = Date.now() + token.expires_in * 1000;
  jiraAuthToken = token;
  saveSecret(JIRA_TOKEN_PATH, token);
}

async function refreshJiraToken() {
  if (!jiraAuthToken?.refresh_token) return null;
  try {
    const response = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: integrationConfig.jiraClientId,
        client_secret: integrationConfig.jiraClientSecret,
        refresh_token: jiraAuthToken.refresh_token,
      }),
    });
    const data = await response.json();
    if (data.access_token) {
      saveJiraToken(data);
      return data.access_token;
    }
  } catch (err) {
    console.error("Jira: refresh token error", err.message);
  }
  return null;
}

async function getJiraAccessToken() {
  if (!jiraAuthToken) return null;
  if (
    jiraAuthToken.expires_at &&
    Date.now() > jiraAuthToken.expires_at - 60_000
  )
    return await refreshJiraToken();
  return jiraAuthToken.access_token;
}

// --------------- OAuth CSRF state ---------------

const pendingOAuthStates = new Map(); // state -> { kind, expires }

function newOAuthState(kind) {
  const state = randomBytes(16).toString("hex");
  pendingOAuthStates.set(state, { kind, expires: Date.now() + 10 * 60 * 1000 });
  for (const [k, v] of pendingOAuthStates)
    if (v.expires < Date.now()) pendingOAuthStates.delete(k);
  return state;
}

function consumeOAuthState(state, kind) {
  const entry = pendingOAuthStates.get(state);
  if (!entry || entry.kind !== kind || entry.expires < Date.now()) return false;
  pendingOAuthStates.delete(state);
  return true;
}

function redirectUri(path) {
  return `http://127.0.0.1:${apiInfo.port || loadSettings().apiPort}${path}`;
}

function jiraAuthUrl() {
  const { jiraClientId } = integrationConfig;
  if (!jiraClientId) return null;
  const scopes = [
    "read:jira-work",
    "write:jira-work",
    "read:jira-user",
    // Boards and sprints live behind their own scopes; without these the
    // agile endpoints answer with an insufficient-scope error.
    "read:project:jira",
    "read:board-scope:jira-software",
    "read:sprint:jira-software",
    "write:sprint:jira-software",
    "offline_access",
  ].join(" ");
  const state = newOAuthState("jira");
  return `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${encodeURIComponent(
    jiraClientId,
  )}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(
    redirectUri("/jira-callback"),
  )}&state=${state}&response_type=code&prompt=consent`;
}

/**
 * PKCE, one verifier per authorization attempt. Google documents that an
 * installed app "cannot keep secrets", so the proof is what actually ties the
 * code back to this process rather than a client secret on disk.
 */
let googleCodeVerifier = null;

function googleAuthUrl() {
  if (!oAuth2Client) return null;
  googleCodeVerifier = randomBytes(48).toString("base64url").slice(0, 128);
  const challenge = createHash("sha256")
    .update(googleCodeVerifier)
    .digest("base64url");
  return oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    state: newOAuthState("google"),
    code_challenge: challenge,
    code_challenge_method: "S256",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
  });
}

// --------------- Date helpers shared by calendar + reminders ---------------

/**
 * Accepts an ISO `YYYY-MM-DD`, or the legacy "Today"/"Tomorrow"/"Next Week"
 * labels, and returns a local Date at midnight (or null).
 */
function resolveDate(dateString) {
  if (!dateString) return null;
  const now = new Date();
  const at = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [y, m, d] = dateString.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  if (dateString === "Today") return at(now);
  if (dateString === "Tomorrow") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return at(d);
  }
  if (dateString === "Next Week") {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    return at(d);
  }
  const parsed = new Date(dateString);
  return isNaN(parsed.getTime()) ? null : at(parsed);
}

function applyTime(date, timeString) {
  const d = new Date(date);
  if (typeof timeString === "string" && /^\d{1,2}:\d{2}$/.test(timeString)) {
    const [h, m] = timeString.split(":").map(Number);
    d.setHours(h, m, 0, 0);
    return { date: d, hasTime: true };
  }
  d.setHours(9, 0, 0, 0);
  return { date: d, hasTime: false };
}

// --------------- Apple Reminders ---------------

function runAppleScript(script) {
  return new Promise((resolve) => {
    execFile(
      "osascript",
      ["-e", script],
      { timeout: 15000 },
      (error, stdout, stderr) => {
        if (error)
          resolve({
            ok: false,
            error: error.message,
            out: String(stdout || ""),
          });
        else
          resolve({
            ok: true,
            out: String(stdout || "").trim(),
            stderr: String(stderr || ""),
          });
      },
    );
  });
}

async function remindersCreate({ text, dateString, reminderTime }) {
  if (!isMac) return { success: false, error: "Apple Reminders is macOS only" };
  if (!loadSettings().appleReminders)
    return { success: false, error: "Apple Reminders disabled in settings" };
  const base = resolveDate(dateString) || new Date();
  const { date } = applyTime(base, reminderTime);
  const script = `
set targetDate to (current date)
set year of targetDate to ${date.getFullYear()}
set month of targetDate to ${date.getMonth() + 1}
set day of targetDate to ${date.getDate()}
set hours of targetDate to ${date.getHours()}
set minutes of targetDate to ${date.getMinutes()}
set seconds of targetDate to 0
tell application "Reminders"
if not (exists list "${REMINDER_LIST}") then
make new list with properties {name:"${REMINDER_LIST}"}
end if
set newRem to make new reminder at end of list "${REMINDER_LIST}" with properties {name:"${escapeAppleScript(text)}", remind me date:targetDate}
return id of newRem
end tell`;
  const res = await runAppleScript(script);
  if (!res.ok || !REMINDER_ID_RE.test(res.out)) {
    console.error("Apple Reminders create failed:", res.error || res.out);
    return { success: false, error: res.error || "Could not create reminder" };
  }
  return { success: true, appleReminderId: res.out };
}

async function remindersUpdate({
  reminderId,
  text,
  dateString,
  reminderTime,
  completed,
}) {
  if (!isMac) return { success: false, error: "Apple Reminders is macOS only" };
  if (!loadSettings().appleReminders)
    return { success: false, error: "Apple Reminders disabled in settings" };
  if (!REMINDER_ID_RE.test(String(reminderId || "")))
    return { success: false, error: "Invalid reminder id" };

  const base = resolveDate(dateString);
  let dateScript = "";
  if (base) {
    const { date } = applyTime(base, reminderTime);
    dateScript = `
set targetDate to (current date)
set year of targetDate to ${date.getFullYear()}
set month of targetDate to ${date.getMonth() + 1}
set day of targetDate to ${date.getDate()}
set hours of targetDate to ${date.getHours()}
set minutes of targetDate to ${date.getMinutes()}
set seconds of targetDate to 0
set remind me date of theReminder to targetDate`;
  }
  const script = `
tell application "Reminders"
try
set theReminder to reminder id "${escapeAppleScript(reminderId)}"
${text ? `set name of theReminder to "${escapeAppleScript(text)}"` : ""}
${completed === true ? "set completed of theReminder to true" : ""}
${completed === false ? "set completed of theReminder to false" : ""}
${dateScript}
return "ok"
on error errMsg
return "error: " & errMsg
end try
end tell`;
  const res = await runAppleScript(script);
  if (!res.ok || res.out.startsWith("error:"))
    return { success: false, error: res.error || res.out || "Not found" };
  return { success: true };
}

async function remindersDelete(reminderId) {
  if (!isMac || !REMINDER_ID_RE.test(String(reminderId || "")))
    return { success: false, error: "Invalid reminder id" };
  if (!loadSettings().appleReminders)
    return { success: false, error: "disabled" };
  const res = await runAppleScript(`
tell application "Reminders"
try
delete (reminder id "${escapeAppleScript(reminderId)}")
return "ok"
on error errMsg
return "error: " & errMsg
end try
end tell`);
  return { success: res.ok && !res.out.startsWith("error:") };
}

// --------------- IPC handlers ---------------

function setupIPC() {
  ipcMain.handle("get-settings", () => publicSettings());

  ipcMain.handle("update-settings", (_, partial) => {
    if (!partial || typeof partial !== "object") return publicSettings();
    const allowed = [
      "hotkey",
      "theme",
      "appleReminders",
      "captureSelection",
      "calendarSync",
      "escToHide",
      "apiEnabled",
      "projects",
      "projectsBackfilled",
    ];
    const clean = {};
    for (const key of allowed) if (key in partial) clean[key] = partial[key];
    const settings = saveSettings(clean);
    let hotkeyOk = true;
    if (clean.hotkey !== undefined) hotkeyOk = registerHotkey(settings.hotkey);
    if (clean.theme !== undefined) applyTheme(settings.theme);
    return { ...publicSettings(settings), hotkeyOk };
  });

  ipcMain.handle("hide-window", () => {
    hideWindow();
    return true;
  });

  ipcMain.handle("load-app-data", () => loadAppData());

  ipcMain.handle("save-app-data", (_, partial) => {
    if (!partial || typeof partial !== "object") return { ok: false };
    saveAppData(partial);
    return { ok: true };
  });

  // ---- attachments ----

  ipcMain.handle("save-attachment", (_, { bytes, name, type }) => {
    try {
      if (!bytes || bytes.byteLength === undefined)
        return { success: false, error: "no data" };
      if (bytes.byteLength > 64 * 1024 * 1024)
        return { success: false, error: "File is larger than 64 MB" };
      const clean = sanitizeFileName(name);
      const id = writeAttachmentBytes(bytes, clean);
      const attachment = withDimensions({
        id,
        name: clean,
        type: type === "image" ? "image" : "file",
      });
      return { success: true, attachment };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("read-attachment", (_, { id }) => {
    const p = attachmentPath(id);
    if (!p || !existsSync(p)) return { success: false, error: "missing" };
    return { success: true, bytes: readFileSync(p) };
  });

  ipcMain.handle("copy-attachment-image", (_, { id }) => {
    const p = attachmentPath(id);
    if (!p || !existsSync(p)) return { success: false, error: "missing" };
    const img = loadNativeImage(p);
    if (img.isEmpty()) return { success: false, error: "not an image" };
    clipboard.writeImage(img);
    return { success: true };
  });

  ipcMain.handle("copy-task", (_, { text, attachmentId }) => {
    const body = String(text || "");
    const p = attachmentId ? attachmentPath(attachmentId) : null;
    if (p && existsSync(p)) {
      const img = loadNativeImage(p);
      if (!img.isEmpty()) {
        clipboard.write({ text: body, image: img });
        return { success: true, withImage: true };
      }
    }
    clipboard.writeText(body);
    return { success: true, withImage: false };
  });

  ipcMain.handle("copy-attachment-file", (_, { id, name }) => {
    const p = attachmentPath(id);
    if (!p || !existsSync(p)) return { success: false, error: "missing" };
    try {
      // Copy out under the original filename so a paste in Finder/Explorer
      // produces a sensibly named file.
      const dir = join(tmpdir(), "stepler-clipboard");
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const target = join(dir, sanitizeFileName(name || basename(p)));
      copyFileSync(p, target);
      if (isMac) {
        clipboard.writeBuffer(
          "public.file-url",
          Buffer.from(pathToFileURL(target).toString(), "utf8"),
        );
        return { success: true, mode: "file" };
      }
      clipboard.writeText(target);
      return { success: true, mode: "path" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("save-attachment-to-disk", async (_, { id, name }) => {
    const p = attachmentPath(id);
    if (!p || !existsSync(p)) return { success: false, error: "missing" };
    const fileName = sanitizeFileName(name || basename(p));
    const ext = extname(fileName).replace(".", "") || "bin";
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Save Attachment",
      defaultPath: fileName,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    });
    if (canceled || !filePath) return { success: false, canceled: true };
    try {
      copyFileSync(p, filePath);
      return { success: true, filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("open-file-attachment", async (_, { id, name }) => {
    const p = attachmentPath(id);
    if (!p || !existsSync(p)) return { success: false, error: "missing" };
    try {
      const dir = join(tmpdir(), "stepler-attachments");
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const target = join(dir, sanitizeFileName(name || basename(p)));
      copyFileSync(p, target);
      const err = await shell.openPath(target);
      if (err) return { success: false, error: err };
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("open-external", (_, url) => {
    if (!isSafeExternalUrl(url)) return { success: false, error: "unsafe url" };
    shell.openExternal(url);
    return { success: true };
  });

  ipcMain.handle("get-update-state", () => updateState);

  /** Relaunch into the downloaded build. Only meaningful once it is ready. */
  ipcMain.handle("install-update", () => {
    if (!autoUpdater || updateState.status !== "ready")
      return { success: false, error: "No update is ready yet." };
    app.isQuitting = true;
    setImmediate(() => autoUpdater.quitAndInstall());
    return { success: true };
  });

  /** Where to send someone whose update could not install itself. */
  ipcMain.handle("open-releases-page", () => {
    shell.openExternal("https://github.com/gepran/stepler/releases/latest");
    return { success: true };
  });

  /** Reveal the data folder, so "put your credentials here" is one click. */
  ipcMain.handle("open-data-folder", async () => {
    const err = await shell.openPath(USER_DATA);
    return err ? { success: false, error: err } : { success: true };
  });

  // ---- misc ----

  ipcMain.handle("start-dictation", async () => {
    if (!isMac) return { success: false, error: "macOS only" };
    if (!canSendKeystrokes())
      return {
        success: false,
        error:
          "Tick Stepler in System Settings → Privacy & Security → Accessibility first.",
      };
    const res = await runAppleScript(
      'tell application "System Events"\nkey code 63\ndelay 0.05\nkey code 63\nend tell',
    );
    return { success: res.ok, error: res.error };
  });

  ipcMain.handle("show-notification", (_, { title, body }) => {
    if (!Notification.isSupported()) return false;
    const n = new Notification({
      title: String(title || "Stepler").slice(0, 120),
      body: String(body || "").slice(0, 500),
      silent: false,
    });
    n.on("click", showWindow);
    n.show();
    return true;
  });

  ipcMain.handle("export-tasks", async (_, data) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Export Tasks",
      defaultPath: `stepler-export-${localYMD(new Date())}.json`,
      filters: [{ name: "JSON Files", extensions: ["json"] }],
    });
    if (canceled || !filePath) return { success: false, canceled: true };
    try {
      // Inline the attachment files so the export is portable to another machine.
      const inline = (t) => {
        const copy = { ...t };
        const withUrl = (a) => {
          if (!a?.id) return a;
          const url = attachmentToDataUrl(a);
          return url ? { ...a, url } : { ...a, missing: true };
        };
        if (copy.attachment) copy.attachment = withUrl(copy.attachment);
        if (copy.subtasks)
          copy.subtasks = copy.subtasks.map((st) =>
            st.attachment ? { ...st, attachment: withUrl(st.attachment) } : st,
          );
        return copy;
      };
      const payload = {
        version: 2,
        exportedAt: new Date().toISOString(),
        tasks: (data?.tasks || []).map(inline),
        history: (data?.history || []).map((d) => ({
          ...d,
          tasks: (d.tasks || []).map(inline),
        })),
        deletedTasks: (data?.deletedTasks || []).map(inline),
      };
      writeFileSync(filePath, JSON.stringify(payload, null, 2));
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
    if (canceled || !filePaths.length)
      return { success: false, canceled: true };
    try {
      const stat = statSync(filePaths[0]);
      if (stat.size > 512 * 1024 * 1024)
        return { success: false, error: "That file is too large to import." };
      const parsed = JSON.parse(readFileSync(filePaths[0], "utf-8"));
      if (!parsed || typeof parsed !== "object")
        return { success: false, error: "That file is not a Stepler export." };
      // Everything imported is untrusted: normalise it and move any inline
      // attachments into the attachment store before it reaches the UI.
      const clean = sanitizeDataShape(parsed);
      return {
        success: true,
        data: {
          tasks: clean.tasks,
          history: clean.history,
          deletedTasks: clean.deletedTasks,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: `Could not read that file: ${err.message}`,
      };
    }
  });

  // ---- Google Calendar ----

  ipcMain.handle("google-calendar-status", async () => {
    if (!oAuth2Client)
      return {
        configured: false,
        connected: false,
        email: null,
        syncEnabled: loadSettings().calendarSync,
      };
    const connected = !!(
      oAuth2Client.credentials?.access_token ||
      oAuth2Client.credentials?.refresh_token
    );
    let email = null;
    if (connected && oAuth2Client.credentials?.access_token) {
      try {
        const info = await oAuth2Client.getTokenInfo(
          oAuth2Client.credentials.access_token,
        );
        email = info.email;
      } catch {
        /* token may just need a refresh; not worth surfacing */
      }
    }
    return {
      configured: true,
      connected,
      email,
      syncEnabled: loadSettings().calendarSync,
    };
  });

  ipcMain.handle("google-calendar-auth", () => {
    if (!oAuth2Client)
      return {
        success: false,
        error: "Google Calendar is not configured on this machine.",
      };
    if (!apiInfo.port)
      return { success: false, error: "Local callback server is not running." };
    const url = googleAuthUrl();
    if (!url)
      return {
        success: false,
        error: "Could not build the authorisation URL.",
      };
    shell.openExternal(url);
    return { success: true };
  });

  ipcMain.handle("google-calendar-disconnect", () => {
    if (oAuth2Client) oAuth2Client.setCredentials({});
    clearSecret(GCAL_TOKEN_PATH);
    return { success: true };
  });

  /**
   * Google's API errors are written for developers. Say what the person should
   * actually do instead of handing them the raw string.
   */
  function friendlyGcalError(error) {
    const msg = error?.message || "";
    if (/insufficient authentication scopes|insufficient permission/i.test(msg))
      return "Stepler was not given access to your calendar. In Settings, disconnect Google Calendar, connect again, and tick the calendar permission on Google's consent screen.";
    if (/invalid_grant|token has been expired|revoked/i.test(msg))
      return "Your Google sign-in has expired. Disconnect and connect again in Settings.";
    return msg || "Could not add this to Google Calendar.";
  }

  const gcalReady = () =>
    !!(
      oAuth2Client &&
      (oAuth2Client.credentials?.access_token ||
        oAuth2Client.credentials?.refresh_token)
    );

  ipcMain.handle(
    "google-calendar-create-event",
    async (_, { text, dateString, reminderTime }) => {
      if (!loadSettings().calendarSync)
        return { success: false, error: "Calendar sync is off" };
      if (!gcalReady())
        return { success: false, error: "Not connected to Google Calendar." };
      const base = resolveDate(dateString);
      if (!base) return { success: false, error: "No date on this task" };
      const google = await getGoogle();
      const calendar = google.calendar({ version: "v3", auth: oAuth2Client });
      const { date, hasTime } = applyTime(base, reminderTime);
      const body = hasTime
        ? {
            summary: text,
            start: { dateTime: date.toISOString() },
            end: {
              dateTime: new Date(date.getTime() + 3600_000).toISOString(),
            },
          }
        : (() => {
            const next = new Date(date);
            next.setDate(next.getDate() + 1);
            return {
              summary: text,
              start: { date: localYMD(date) },
              end: { date: localYMD(next) },
            };
          })();
      try {
        const res = await calendar.events.insert({
          calendarId: "primary",
          requestBody: body,
        });
        return { success: true, link: res.data.htmlLink, eventId: res.data.id };
      } catch (error) {
        console.error("GCal event creation error:", error.message);
        return { success: false, error: friendlyGcalError(error) };
      }
    },
  );

  ipcMain.handle(
    "google-calendar-update-event",
    async (_, { eventId, text, dateString, reminderTime }) => {
      if (!gcalReady() || !eventId)
        return { success: false, error: "Not connected." };
      const google = await getGoogle();
      const calendar = google.calendar({ version: "v3", auth: oAuth2Client });
      const base = resolveDate(dateString) || new Date();
      const { date, hasTime } = applyTime(base, reminderTime);
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      const body = hasTime
        ? {
            summary: text,
            start: { dateTime: date.toISOString() },
            end: {
              dateTime: new Date(date.getTime() + 3600_000).toISOString(),
            },
          }
        : {
            summary: text,
            start: { date: localYMD(date) },
            end: { date: localYMD(next) },
          };
      try {
        const res = await calendar.events.patch({
          calendarId: "primary",
          eventId,
          requestBody: body,
        });
        return { success: true, link: res.data.htmlLink };
      } catch (error) {
        return { success: false, error: friendlyGcalError(error) };
      }
    },
  );

  ipcMain.handle("google-calendar-delete-event", async (_, { eventId }) => {
    if (!gcalReady() || !eventId)
      return { success: false, error: "Not connected." };
    const google = await getGoogle();
    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });
    try {
      await calendar.events.delete({ calendarId: "primary", eventId });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ---- Apple Reminders ----

  ipcMain.handle("apple-reminders-create-event", (_, payload) =>
    remindersCreate(payload || {}),
  );
  ipcMain.handle("apple-reminders-update-event", (_, payload) =>
    remindersUpdate(payload || {}),
  );
  ipcMain.handle("apple-reminders-delete-event", (_, { reminderId }) =>
    remindersDelete(reminderId),
  );

  // ---- Jira ----

  ipcMain.handle("jira-status", () => ({
    // OAuth needs credentials this machine may not have; an API token needs
    // nothing but the token, so the card is never "not set up" for it.
    configured: true,
    oauthConfigured: !!(
      integrationConfig.jiraClientId && integrationConfig.jiraClientSecret
    ),
    connected: !!(jiraBasic || jiraAuthToken?.access_token),
    mode: jiraBasic ? "token" : jiraAuthToken?.access_token ? "oauth" : null,
    site: jiraBasic?.siteUrl || null,
    email: jiraBasic?.email || null,
  }));

  ipcMain.handle("jira-auth", () => {
    const url = jiraAuthUrl();
    if (!url)
      return {
        success: false,
        error: "Jira OAuth is not configured on this machine.",
      };
    shell.openExternal(url);
    return { success: true };
  });

  /**
   * Sign in with an Atlassian API token instead of OAuth. Atlassian has no
   * public-client OAuth flow, so a distributed copy of Stepler cannot ship a
   * usable client secret; a token the person makes themselves is the honest
   * way in. Verified against /myself before it is stored.
   */
  ipcMain.handle("jira-connect-token", async (_, payload) => {
    const parsed = parseJiraSite(payload?.siteUrl);
    if (!parsed)
      return {
        success: false,
        error: "That does not look like a Jira site address.",
      };
    const email = String(payload?.email || "").trim();
    const token = String(payload?.token || "").trim();
    if (!email.includes("@"))
      return {
        success: false,
        error: "Enter the email of your Atlassian account.",
      };
    if (!token) return { success: false, error: "Paste your API token." };

    const candidate = { siteUrl: parsed, email, token };
    try {
      const res = await jiraFetch(candidate, "/rest/api/3/myself");
      if (res.status === 401 || res.status === 403)
        return {
          success: false,
          error: "Atlassian refused that email and token.",
        };
      if (!res.ok)
        return { success: false, error: `Jira answered ${res.status}.` };
      const me = await res.json();
      jiraBasic = candidate;
      saveSecret(JIRA_BASIC_PATH, candidate);
      return { success: true, displayName: me?.displayName || email };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("jira-disconnect", () => {
    jiraAuthToken = null;
    jiraBasic = null;
    clearSecret(JIRA_TOKEN_PATH);
    clearSecret(JIRA_BASIC_PATH);
    return { success: true };
  });

  const jiraProjects = async () => {
    try {
      const res = await jiraApi("/rest/api/3/project/search?maxResults=100");
      if (!res.ok) return { success: false, error: res.error };
      const body = res.body;
      const projects = Array.isArray(body) ? body : body?.values || [];
      return { success: true, projects, cloudId: res.cloudId || "" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };
  ipcMain.handle("jira-get-projects", jiraProjects);
  ipcMain.handle("jira-fetch-projects", jiraProjects);

  /** Boards a project has, so the sprint list has something to hang off. */
  ipcMain.handle("jira-get-boards", async (_, { projectKey }) => {
    if (!projectKey) return { success: false, error: "No project" };
    try {
      const res = await jiraApi(
        `/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKey)}&maxResults=50`,
      );
      if (!res.ok) return { success: false, error: res.error };
      return { success: true, boards: res.body?.values || [] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  /** Only sprints you can still put work into. */
  ipcMain.handle("jira-get-sprints", async (_, { boardId }) => {
    if (!boardId) return { success: false, error: "No board" };
    try {
      const res = await jiraApi(
        `/rest/agile/1.0/board/${encodeURIComponent(boardId)}/sprint?state=active,future&maxResults=50`,
      );
      if (!res.ok) return { success: false, error: res.error };
      return { success: true, sprints: res.body?.values || [] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(
    "jira-create-issue",
    async (_, { text, projectKey, sprintId }) => {
      if (!projectKey) return { success: false, error: "No project" };
      try {
        const res = await jiraApi("/rest/api/3/issue", {
          method: "POST",
          body: JSON.stringify({
            fields: {
              project: { key: projectKey },
              summary: String(text || "").slice(0, 250),
              issuetype: { name: "Task" },
            },
          }),
        });
        const data = res.body;
        if (!data?.key)
          return {
            success: false,
            error:
              data?.errorMessages?.join(", ") ||
              Object.values(data?.errors || {}).join(", ") ||
              res.error ||
              "Failed to create issue",
          };

        // The sprint is a second call: creating an issue cannot set it
        // directly without knowing the site's sprint custom field id.
        let sprintError = null;
        if (sprintId) {
          const moved = await jiraApi(
            `/rest/agile/1.0/sprint/${encodeURIComponent(sprintId)}/issue`,
            { method: "POST", body: JSON.stringify({ issues: [data.key] }) },
          );
          if (!moved.ok)
            sprintError = moved.error || "could not add it to the sprint";
        }

        const site =
          jiraBasic?.siteUrl ||
          `https://${String(data.self || "").split("/")[2]}`;
        return {
          success: true,
          key: data.key,
          link: site ? `${site}/browse/${data.key}` : null,
          sprintError,
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
  );
}

// --------------- Local HTTP API (for the CLI) ---------------

const apiInfo = { port: null, token: null };

function tokensMatch(provided, expected) {
  const a = Buffer.from(String(provided || ""));
  const b = Buffer.from(String(expected || ""));
  if (a.length !== b.length || !b.length) return false;
  return timingSafeEqual(a, b);
}

function startAPIServer() {
  const settings = loadSettings();
  if (!settings.apiEnabled) {
    console.log("Local API disabled in settings.");
    return;
  }
  let token = settings.apiToken;
  if (!token) {
    token = randomBytes(24).toString("hex");
    saveSettings({ apiToken: token });
  }
  apiInfo.token = token;

  const server = http.createServer((req, res) => {
    const send = (code, body, type = "application/json") => {
      res.writeHead(code, {
        "Content-Type": type,
        "Cache-Control": "no-store",
      });
      res.end(typeof body === "string" ? body : JSON.stringify(body));
    };
    const { method, url } = req;

    // OAuth callbacks are the only unauthenticated routes; they are protected
    // by the one-time `state` value instead.
    if (method === "GET" && url.startsWith("/oauth2callback"))
      return handleGoogleCallback(url, send);
    if (method === "GET" && url.startsWith("/jira-callback"))
      return handleJiraCallback(url, send);

    // No CORS headers at all, and anything a browser sends (Origin present) is
    // rejected outright — a web page must not be able to read local notes.
    if (req.headers.origin) return send(403, { error: "Forbidden" });
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ") || !tokensMatch(auth.slice(7), token))
      return send(401, { error: "Unauthorized" });

    if (method === "GET" && url === "/api/tasks") {
      const data = loadAppData();
      return send(
        200,
        data.tasks.map((t) => ({
          id: t.id,
          text: t.text,
          completed: !!t.completed,
          priority: !!t.priority,
          projects: t.projects || [],
          dueDate: t.dueDate || null,
          reminder: t.reminder || null,
          subtasks: (t.subtasks || []).map((s) => ({
            id: s.id,
            text: s.text,
            completed: !!s.completed,
          })),
          hasAttachment: !!t.attachment,
        })),
      );
    }

    if (method === "POST" && url === "/api/tasks") {
      let body = "";
      let tooBig = false;
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > 1_000_000) {
          tooBig = true;
          req.destroy();
        }
      });
      req.on("end", () => {
        if (tooBig) return send(413, { error: "Body too large" });
        try {
          const payload = JSON.parse(body || "{}");
          const title = payload.title;
          if (!title || typeof title !== "string")
            return send(400, { error: "title required" });
          const data = loadAppData();
          const newTask = sanitizeTask({
            id: String(Date.now()),
            text: title,
            completed: false,
            priority: !!payload.priority,
            ...(Array.isArray(payload.projects) && payload.projects.length
              ? {
                  projects: payload.projects.filter(
                    (x) => typeof x === "string",
                  ),
                }
              : {}),
            ...(typeof payload.dueDate === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(payload.dueDate)
              ? { dueDate: payload.dueDate }
              : {}),
            ...(typeof payload.reminder === "string" &&
            /^\d{1,2}:\d{2}$/.test(payload.reminder)
              ? { reminder: payload.reminder }
              : {}),
          });
          saveAppData({ tasks: [...data.tasks, newTask] });
          flushAppData();
          broadcastData();
          return send(201, newTask);
        } catch {
          return send(400, { error: "Invalid JSON" });
        }
      });
      return undefined;
    }

    if (method === "PATCH" && url.startsWith("/api/tasks/")) {
      const id = decodeURIComponent(url.slice("/api/tasks/".length));
      let body = "";
      req.on("data", (c) => {
        body += c;
        if (body.length > 100_000) req.destroy();
      });
      req.on("end", () => {
        try {
          const patch = JSON.parse(body || "{}");
          const data = loadAppData();
          let found = false;
          const tasks = data.tasks.map((t) => {
            if (t.id !== id) return t;
            found = true;
            return sanitizeTask({
              ...t,
              ...(typeof patch.completed === "boolean"
                ? { completed: patch.completed }
                : {}),
              ...(typeof patch.priority === "boolean"
                ? { priority: patch.priority }
                : {}),
              ...(typeof patch.text === "string" && patch.text.trim()
                ? { text: patch.text.trim() }
                : {}),
            });
          });
          if (!found) return send(404, { error: "Task not found" });
          saveAppData({ tasks });
          flushAppData();
          broadcastData();
          return send(
            200,
            tasks.find((t) => t.id === id),
          );
        } catch {
          return send(400, { error: "Invalid JSON" });
        }
      });
      return undefined;
    }

    if (method === "GET" && url.startsWith("/api/history")) {
      const days = Math.min(
        Number(new URL(url, "http://127.0.0.1").searchParams.get("days")) || 7,
        60,
      );
      const data = loadAppData();
      // The stored order is whatever the file grew into; "recent" has to mean
      // recent by date, so sort before taking a slice.
      const recent = [...(data.history || [])]
        .filter((d) => d && typeof d.ymd === "string")
        .sort((a, b) => (a.ymd < b.ymd ? 1 : -1))
        .slice(0, days);
      return send(
        200,
        recent.map((d) => ({
          date: d.ymd,
          tasks: (d.tasks || []).map((t) => ({
            id: t.id,
            text: t.text,
            completed: !!t.completed,
            projects: t.projects || [],
          })),
        })),
      );
    }

    if (method === "DELETE" && url.startsWith("/api/tasks/")) {
      const id = decodeURIComponent(url.slice("/api/tasks/".length));
      const data = loadAppData();
      const task = data.tasks.find((t) => t.id === id);
      if (!task) return send(404, { error: "Task not found" });
      saveAppData({
        tasks: data.tasks.filter((t) => t.id !== id),
        deletedTasks: [
          { ...task, deletedAt: Date.now() },
          ...data.deletedTasks,
        ],
      });
      flushAppData();
      mainWindow?.webContents.send("app-data-updated", {
        tasks: dataCache.tasks,
        deletedTasks: dataCache.deletedTasks,
      });
      return send(200, { success: true });
    }

    return send(404, { error: "Not Found" });
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.warn(
        `Local API port ${settings.apiPort} is already in use — the CLI and OAuth callbacks are unavailable until it is free.`,
      );
    } else {
      console.error("API server error:", err.message);
    }
    apiInfo.port = null;
  });

  server.listen(settings.apiPort, "127.0.0.1", () => {
    apiInfo.port = server.address().port;
    try {
      writeJsonAtomic(apiInfoPath, { port: apiInfo.port, token });
    } catch {
      /* the CLI can still be pointed at it manually */
    }
    console.log(
      `Local API listening on http://127.0.0.1:${apiInfo.port} (token required)`,
    );
  });
}

async function handleGoogleCallback(url, send) {
  const urlObj = new URL(url, "http://127.0.0.1");
  const code = urlObj.searchParams.get("code");
  const state = urlObj.searchParams.get("state");
  if (!consumeOAuthState(state, "google"))
    return send(
      400,
      "<h1>Authentication failed</h1><p>Invalid or expired request.</p>",
      "text/html",
    );
  if (!code || !oAuth2Client)
    return send(400, "<h1>No code provided</h1>", "text/html");
  try {
    const { tokens } = await oAuth2Client.getToken({
      code,
      ...(googleCodeVerifier ? { codeVerifier: googleCodeVerifier } : {}),
    });
    googleCodeVerifier = null;
    oAuth2Client.setCredentials(tokens);
    saveSecret(GCAL_TOKEN_PATH, tokens);
    // Connecting the account is the whole point of connecting it, so start
    // mirroring straight away rather than making people find a second switch.
    saveSettings({ calendarSync: true });
    mainWindow?.webContents.send("google-calendar-connected", true);
    return send(
      200,
      "<h1>Connected to Google Calendar</h1><p>You can close this tab and return to Stepler.</p>",
      "text/html",
    );
  } catch (err) {
    console.error("Google auth error:", err.message);
    return send(500, "<h1>Authentication error</h1>", "text/html");
  }
}

async function handleJiraCallback(url, send) {
  const urlObj = new URL(url, "http://127.0.0.1");
  const code = urlObj.searchParams.get("code");
  const state = urlObj.searchParams.get("state");
  if (!consumeOAuthState(state, "jira"))
    return send(
      400,
      "<h1>Authentication failed</h1><p>Invalid or expired request.</p>",
      "text/html",
    );
  if (!code) return send(400, "<h1>No code provided</h1>", "text/html");
  try {
    const response = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: integrationConfig.jiraClientId,
        client_secret: integrationConfig.jiraClientSecret,
        code,
        redirect_uri: redirectUri("/jira-callback"),
      }),
    });
    const tokens = await response.json();
    if (!tokens.access_token) throw new Error("No access token in response");
    saveJiraToken(tokens);
    mainWindow?.webContents.send("jira-connected", true);
    return send(
      200,
      "<h1>Connected to Jira</h1><p>You can close this tab and return to Stepler.</p>",
      "text/html",
    );
  } catch (err) {
    console.error("Jira auth error:", err.message);
    return send(500, "<h1>Authentication error</h1>", "text/html");
  }
}

// --------------- App lifecycle ---------------

if (!app.requestSingleInstanceLock()) {
  // A second copy would happily overwrite the first one's tasks.
  app.quit();
} else {
  app.on("second-instance", showWindow);

  app.whenReady().then(async () => {
    electronApp.setAppUserModelId("com.stepler.app");

    protocol.handle(ATTACH_SCHEME, (request) => {
      try {
        const id = decodeURIComponent(
          new URL(request.url).pathname.replace(/^\//, ""),
        );
        const p = attachmentPath(id);
        if (!p || !existsSync(p))
          return new Response("Not found", { status: 404 });
        return net.fetch(pathToFileURL(p).toString());
      } catch {
        return new Response("Bad request", { status: 400 });
      }
    });

    app.on("browser-window-created", (_, window) =>
      optimizer.watchWindowShortcuts(window),
    );

    ensureAttachDir();
    const settings = loadSettings();
    applyTheme(settings.theme);

    // Keep one good copy of the data around before this run can touch it, but
    // only when the file we just read actually parsed — otherwise a
    // half-written file would overwrite the only usable backup.
    loadAppData();
    if (loadedFromBackup) {
      dirty = true;
      flushAppData(); // put the recovered copy back straight away
    } else {
      try {
        if (existsSync(dataPath) && statSync(dataPath).size > 0)
          copyFileSync(dataPath, backupPath);
      } catch {
        /* not fatal */
      }
    }
    migrateAppData();

    integrationConfig = loadIntegrationConfig();

    buildMenu();
    setupIPC();
    startAPIServer();
    createWindow();
    buildTray();
    if (!registerHotkey(settings.hotkey)) {
      console.warn(
        `Global shortcut ${settings.hotkey} is unavailable — another app owns it.`,
      );
    }
    // Reading a saved token goes through safeStorage, and safeStorage is
    // synchronous: if macOS decides to ask permission for the keychain item —
    // which it does whenever the app's signature changes — the main thread
    // stops until someone answers. Do it after the window is on screen, so a
    // prompt lands over a running app instead of freezing a blank launch.
    const initSecrets = () => {
      try {
        initJiraAuth();
      } catch (err) {
        console.error("Jira init failed:", err.message);
      }
      initGoogleAuth().catch((err) =>
        console.error("Google init failed:", err.message),
      );
    };
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.once("did-finish-load", () =>
        setTimeout(initSecrets, 250),
      );
    else setTimeout(initSecrets, 1500);

    if (!is.dev) {
      // electron-updater is CommonJS; once bundled, the named export only
      // shows up under `default`. Read both and skip quietly if neither is
      // there, rather than throwing an unhandled rejection at startup.
      const updaterModule = await import("electron-updater").catch(() => null);
      const found =
        updaterModule?.autoUpdater || updaterModule?.default?.autoUpdater;
      if (!found) {
        console.warn("Updater unavailable — skipping the update check.");
      } else {
        autoUpdater = found;
        const feedUrl = process.env.STEPLER_UPDATE_URL;
        if (feedUrl)
          autoUpdater.setFeedURL({ provider: "generic", url: feedUrl });

        // The window owns the update UI now: a pill in the header rather than
        // a modal that interrupts whatever the person was typing.
        autoUpdater.on("checking-for-update", () =>
          sendUpdateState({ status: "checking" }),
        );
        autoUpdater.on("update-not-available", () =>
          sendUpdateState({ status: "idle" }),
        );
        autoUpdater.on("update-available", (info) =>
          sendUpdateState({ status: "downloading", version: info?.version }),
        );
        autoUpdater.on("download-progress", (p) =>
          sendUpdateState({
            status: "downloading",
            percent: Math.round(p?.percent || 0),
          }),
        );
        autoUpdater.on("update-downloaded", (info) =>
          sendUpdateState({ status: "ready", version: info?.version }),
        );
        autoUpdater.on("error", (err) => {
          console.warn("Updater:", err.message);
          // Keep the version: a failed install still leaves the person with
          // somewhere to go, and the pill turns into that link.
          sendUpdateState({
            status: "error",
            error: err.message,
            version: updateState.version || null,
          });
        });

        const check = () => autoUpdater.checkForUpdates().catch(() => {});
        check();
        // Long-running windows should still notice a release that lands later.
        setInterval(check, 6 * 60 * 60 * 1000);
      }
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else showWindow();
    });
  });
}

app.on("before-quit", () => {
  app.isQuitting = true;
  globalShortcut.unregisterAll();
  flushAppData();
});

app.on("will-quit", flushAppData);

app.on("window-all-closed", () => {
  if (!isMac) app.quit();
});
