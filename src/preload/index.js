import { contextBridge, ipcRenderer } from "electron";

// Only the capabilities the app uses cross the isolation boundary. Never
// expose process.env, raw IPC events (which carry a sender), or arbitrary IPC.
const invocations = new Set([
  "agent-setup",
  "apple-reminders-create-event",
  "apple-reminders-delete-event",
  "apple-reminders-update-event",
  "check-for-update",
  "collab-accept",
  "collab-add-mention-subtask",
  "collab-dismiss-mention",
  "collab-edit-mention",
  "collab-invite",
  "collab-mark-read",
  "collab-remove",
  "collab-search",
  "collab-snapshot",
  "collab-toggle-mention-subtask",
  "copy-attachment-file",
  "copy-attachment-image",
  "copy-task",
  "copy-text",
  "export-tasks",
  "get-app-version",
  "get-settings",
  "get-update-state",
  "google-calendar-auth",
  "google-calendar-create-event",
  "google-calendar-delete-event",
  "google-calendar-disconnect",
  "google-calendar-status",
  "google-calendar-update-event",
  "hide-window",
  "import-tasks",
  "install-update",
  "jira-auth",
  "jira-connect-token",
  "jira-create-issue",
  "jira-disconnect",
  "jira-fetch-projects",
  "jira-get-boards",
  "jira-get-projects",
  "jira-get-sprints",
  "jira-status",
  "load-app-data",
  "mutate-project",
  "open-data-folder",
  "open-external",
  "open-file-attachment",
  "purge-deleted-tasks",
  "read-attachment",
  "reveal-downloaded-update",
  "save-app-data",
  "save-attachment",
  "save-attachment-to-disk",
  "show-notification",
  "start-dictation",
  "sync-set-password",
  "sync-signin-email",
  "sync-signin-google",
  "sync-signout",
  "sync-status",
  "update-settings",
]);
const events = new Set([
  "app-data-updated",
  "captured-selection",
  "collab-snapshot",
  "focus-input",
  "google-calendar-connected",
  "jira-connected",
  "needs-accessibility",
  "open-search",
  "open-settings",
  "project-changed",
  "settings-updated",
  "sync-status",
  "update-state",
]);
const listeners = new Map();
const subscribe = (channel, listener, once = false) => {
  if (!events.has(channel) || typeof listener !== "function")
    throw new Error("Unsupported IPC event");
  const wrapped = (_event, ...args) => listener(null, ...args);
  const entries = listeners.get(channel) || new Map();
  entries.set(listener, wrapped);
  listeners.set(channel, entries);
  (once ? ipcRenderer.once : ipcRenderer.on).call(
    ipcRenderer,
    channel,
    wrapped,
  );
  return () => {
    ipcRenderer.removeListener(channel, wrapped);
    entries.delete(listener);
  };
};
contextBridge.exposeInMainWorld("electron", {
  process: { platform: process.platform },
  ipcRenderer: {
    invoke: (channel, ...args) => {
      if (!invocations.has(channel))
        return Promise.reject(new Error("Unsupported IPC request"));
      return ipcRenderer.invoke(channel, ...args);
    },
    on: (channel, listener) => subscribe(channel, listener),
    once: (channel, listener) => subscribe(channel, listener, true),
    removeListener: (channel, listener) => {
      const wrapped = listeners.get(channel)?.get(listener);
      if (wrapped) ipcRenderer.removeListener(channel, wrapped);
      listeners.get(channel)?.delete(listener);
    },
    removeAllListeners: (channel) => {
      if (!events.has(channel)) return;
      ipcRenderer.removeAllListeners(channel);
      listeners.delete(channel);
    },
  },
});
