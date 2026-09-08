import { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import {
  X,
  SunMedium,
  Moon,
  Monitor,
  Download,
  Upload,
  Calendar,
  Hash,
  Trash2,
  Edit2,
  Check,
  Plus,
  Star,
  Keyboard,
} from "lucide-react";

const ipc = window.electron?.ipcRenderer;
const isMac =
  window.electron?.process?.platform === "darwin" ||
  /Mac/.test(navigator.userAgent);

function formatAcceleratorForDisplay(acc) {
  if (!acc) return "—";
  return acc
    .replace(/CommandOrControl/g, isMac ? "⌘" : "Ctrl")
    .replace(/CmdOrCtrl/g, isMac ? "⌘" : "Ctrl")
    .replace(/Command/g, isMac ? "⌘" : "Win")
    .replace(/Control/g, isMac ? "⌃" : "Ctrl")
    .replace(/Shift/g, "⇧")
    .replace(/Alt/g, isMac ? "⌥" : "Alt")
    .replace(/\+/g, isMac ? "" : " + ")
    .replace(/Space/, "␣");
}

/**
 * A global shortcut has to carry a real modifier — binding a bare "Shift+A"
 * would swallow that key in every other app on the machine.
 */
function keyEventToAccelerator(e) {
  const parts = [];
  if (e.ctrlKey && !e.metaKey) parts.push("Control");
  if (e.metaKey) parts.push("CommandOrControl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  const ignore = ["Meta", "Control", "Alt", "Shift", "Dead"];
  if (ignore.includes(e.key)) return null;

  const hasRealModifier = e.ctrlKey || e.metaKey || e.altKey;
  if (!hasRealModifier) return null;

  let key = e.key;
  if (key === " ") key = "Space";
  else if (key.length === 1) key = key.toUpperCase();
  else if (key.startsWith("Arrow")) key = key.slice(5);
  parts.push(key);

  return parts.length >= 2 ? parts.join("+") : null;
}

function Toggle({ on, onClick, label }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none ${
        on ? "bg-green-500" : "bg-neutral-300 dark:bg-neutral-700"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ${
          on ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

Toggle.propTypes = {
  on: PropTypes.bool,
  onClick: PropTypes.func,
  label: PropTypes.string,
};

export default function SettingsPanel({
  settings: initialSettings,
  onClose,
  onExport,
  onImport,
  onSettingsUpdate,
  onToast,
}) {
  const [settings, setSettings] = useState(initialSettings || {});
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [editingProjectIdx, setEditingProjectIdx] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [activeTab, setActiveTab] = useState("general");
  const recorderRef = useRef(null);

  const [gcalStatus, setGcalStatus] = useState({
    configured: false,
    connected: false,
  });
  const [jiraStatus, setJiraStatus] = useState({
    configured: false,
    connected: false,
  });

  useEffect(() => {
    ipc?.invoke("get-settings").then((s) => s && setSettings(s));
    ipc?.invoke("google-calendar-status").then((s) => s && setGcalStatus(s));
    ipc?.invoke("jira-status").then((s) => s && setJiraStatus(s));

    const refreshGcal = () =>
      ipc?.invoke("google-calendar-status").then(setGcalStatus);
    const refreshJira = () => ipc?.invoke("jira-status").then(setJiraStatus);
    ipc?.on("google-calendar-connected", refreshGcal);
    ipc?.on("jira-connected", refreshJira);
    return () => {
      ipc?.removeAllListeners("google-calendar-connected");
      ipc?.removeAllListeners("jira-connected");
    };
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape" && !recording) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose, recording]);

  useEffect(() => {
    if (recording) recorderRef.current?.focus();
  }, [recording]);

  const updateSetting = useCallback(
    async (partial) => {
      const updated = await ipc?.invoke("update-settings", partial);
      if (!updated) return null;
      setSettings(updated);
      onSettingsUpdate?.(updated);
      return updated;
    },
    [onSettingsUpdate],
  );

  const handleKeyCapture = useCallback(
    async (e) => {
      if (!recording) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecording(false);
        return;
      }
      const acc = keyEventToAccelerator(e);
      if (!acc) {
        setRecordError(
          "Use at least one of ⌘, ⌃ or ⌥ together with another key.",
        );
        return;
      }
      setRecording(false);
      setRecordError("");
      const updated = await updateSetting({ hotkey: acc });
      if (updated && updated.hotkeyOk === false) {
        setRecordError(
          "Another app already owns that shortcut — kept the previous one.",
        );
        onToast?.("That shortcut is taken by another app", "error");
      } else {
        onToast?.("Shortcut updated");
      }
    },
    [recording, updateSetting, onToast],
  );

  const projects = settings.projects || [];

  const handleAddProject = () => {
    const name = newProjectName.trim();
    if (!name) return;
    const exists = projects.some(
      (p) => (typeof p === "string" ? p : p.name) === name,
    );
    if (exists) {
      onToast?.("That project already exists", "error");
      return;
    }
    updateSetting({ projects: [...projects, { name, isFavorite: false }] });
    setNewProjectName("");
  };

  const tabs = [
    { id: "general", label: "General", Icon: SunMedium },
    { id: "projects", label: "Projects", Icon: Hash },
    { id: "integrations", label: "Integrations", Icon: Calendar },
    { id: "data", label: "Data", Icon: Download },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[620px] w-full max-w-4xl overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-64 border-r border-neutral-200 bg-neutral-50/50 p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-black text-white dark:bg-white dark:text-black">
              <SunMedium size={18} />
            </div>
            <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-100">
              Settings
            </h2>
          </div>

          <nav className="space-y-1.5">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  activeTab === id
                    ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-800 dark:text-white dark:ring-neutral-700"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
                }`}
              >
                <Icon size={18} strokeWidth={activeTab === id ? 2.5 : 2} />
                {label}
              </button>
            ))}
          </nav>

          <div className="absolute bottom-6 left-6">
            <button
              onClick={onClose}
              className="btn-tactile flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-600 shadow-sm transition-all hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"
            >
              <X size={16} />
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-10">
          {activeTab === "general" && (
            <div>
              <h3 className="mb-8 text-2xl font-bold text-neutral-800 dark:text-neutral-100">
                General
              </h3>

              <section className="mb-10">
                <label className="mb-4 block text-xs font-bold uppercase tracking-widest text-neutral-400">
                  Appearance
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: "light", label: "Light", Icon: SunMedium },
                    { value: "dark", label: "Dark", Icon: Moon },
                    { value: "system", label: "System", Icon: Monitor },
                  ].map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      onClick={() => updateSetting({ theme: value })}
                      className={`btn-tactile flex flex-col items-center justify-center gap-3 rounded-2xl border p-5 transition-all ${
                        settings.theme === value
                          ? "border-neutral-900 bg-neutral-900 text-white shadow-lg dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                          : "border-neutral-100 bg-neutral-50/50 text-neutral-500 hover:border-neutral-200 hover:bg-white dark:border-neutral-800 dark:bg-neutral-800/30 dark:text-neutral-400"
                      }`}
                    >
                      <Icon size={24} />
                      <span className="text-sm font-semibold">{label}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="mb-8">
                <label className="mb-4 block text-xs font-bold uppercase tracking-widest text-neutral-400">
                  Global Shortcut
                </label>
                <div className="rounded-2xl border border-neutral-100 bg-neutral-50/50 p-6 dark:border-neutral-800 dark:bg-neutral-800/30">
                  {recording ? (
                    <div
                      ref={recorderRef}
                      tabIndex={0}
                      onKeyDown={handleKeyCapture}
                      onBlur={() => setRecording(false)}
                      className="flex h-14 items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-white text-sm text-neutral-500 outline-none ring-4 ring-neutral-100 dark:border-neutral-600 dark:bg-neutral-900 dark:ring-neutral-800/50"
                    >
                      <span className="animate-pulse font-medium">
                        Press the new combination… (Esc to cancel)
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="flex flex-1 items-center gap-3 rounded-xl border border-neutral-200 bg-white px-5 py-3.5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
                        <Keyboard size={16} className="text-neutral-400" />
                        <span className="font-mono text-base font-bold tracking-widest text-neutral-800 dark:text-neutral-100">
                          {formatAcceleratorForDisplay(settings.hotkey)}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setRecordError("");
                          setRecording(true);
                        }}
                        className="btn-tactile rounded-xl bg-neutral-900 px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
                      >
                        Change
                      </button>
                    </div>
                  )}
                  <p
                    className={`mt-4 text-sm ${recordError ? "text-red-500" : "text-neutral-500 dark:text-neutral-400"}`}
                  >
                    {recordError ||
                      "Press this combination from any app to show or hide Stepler."}
                  </p>
                </div>
              </section>

              <section>
                <label className="mb-4 block text-xs font-bold uppercase tracking-widest text-neutral-400">
                  Behaviour
                </label>
                <div className="flex items-center justify-between rounded-2xl border border-neutral-100 bg-neutral-50/50 p-6 dark:border-neutral-800 dark:bg-neutral-800/30">
                  <div>
                    <div className="text-base font-bold text-neutral-800 dark:text-neutral-100">
                      Hide with Esc
                    </div>
                    <div className="text-sm text-neutral-500">
                      Press Esc on an empty input to send the window away.
                    </div>
                  </div>
                  <Toggle
                    on={!!settings.escToHide}
                    label="Hide with Esc"
                    onClick={() =>
                      updateSetting({ escToHide: !settings.escToHide })
                    }
                  />
                </div>
              </section>
            </div>
          )}

          {activeTab === "projects" && (
            <div>
              <h3 className="mb-8 text-2xl font-bold text-neutral-800 dark:text-neutral-100">
                Projects
              </h3>
              <div className="mb-8 flex gap-3">
                <input
                  type="text"
                  placeholder="Enter project name…"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddProject()}
                  className="w-full flex-1 rounded-2xl border border-neutral-200 bg-neutral-50/50 px-5 py-3.5 text-sm font-medium text-neutral-800 outline-none transition-all focus:border-neutral-400 focus:bg-white dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-100"
                />
                <button
                  onClick={handleAddProject}
                  disabled={!newProjectName.trim()}
                  className="btn-tactile flex items-center justify-center rounded-2xl bg-black px-6 text-sm font-bold text-white transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black"
                >
                  <Plus size={20} />
                </button>
              </div>

              <div className="space-y-3">
                {projects.length === 0 && (
                  <p className="text-sm text-neutral-400">
                    No saved projects yet. Projects you type on a task show up
                    here automatically.
                  </p>
                )}
                {projects.map((project, idx) => {
                  const name =
                    typeof project === "string" ? project : project.name;
                  const favorite =
                    typeof project === "object" && project.isFavorite;
                  return (
                    <div
                      key={`${name}-${idx}`}
                      className="group flex items-center justify-between rounded-2xl border border-neutral-100 bg-neutral-50/30 px-5 py-4 transition-all hover:border-neutral-200 hover:bg-white dark:border-neutral-800 dark:bg-neutral-800/20"
                    >
                      {editingProjectIdx === idx ? (
                        <div className="flex flex-1 items-center gap-3">
                          <input
                            type="text"
                            autoFocus
                            value={editingProjectName}
                            onChange={(e) =>
                              setEditingProjectName(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const next = editingProjectName.trim();
                                if (next) {
                                  const updated = [...projects];
                                  updated[idx] = {
                                    name: next,
                                    isFavorite: !!favorite,
                                  };
                                  updateSetting({ projects: updated });
                                }
                                setEditingProjectIdx(null);
                              }
                              if (e.key === "Escape")
                                setEditingProjectIdx(null);
                            }}
                            className="flex-1 bg-transparent text-base font-bold text-neutral-800 outline-none dark:text-neutral-100"
                          />
                          <button
                            onClick={() => {
                              const next = editingProjectName.trim();
                              if (next) {
                                const updated = [...projects];
                                updated[idx] = {
                                  name: next,
                                  isFavorite: !!favorite,
                                };
                                updateSetting({ projects: updated });
                              }
                              setEditingProjectIdx(null);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-900/30"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            onClick={() => setEditingProjectIdx(null)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-neutral-100 dark:bg-neutral-800 dark:ring-neutral-700">
                              <Hash size={18} className="text-neutral-400" />
                            </div>
                            <span className="text-base font-bold text-neutral-800 dark:text-neutral-100">
                              {name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => {
                                const updated = [...projects];
                                updated[idx] = { name, isFavorite: !favorite };
                                updateSetting({ projects: updated });
                              }}
                              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                                favorite
                                  ? "bg-amber-50 text-amber-500 dark:bg-amber-900/20"
                                  : "text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                              }`}
                              title="Pin to the top"
                            >
                              <Star
                                size={18}
                                fill={favorite ? "currentColor" : "none"}
                              />
                            </button>
                            <button
                              onClick={() => {
                                setEditingProjectIdx(idx);
                                setEditingProjectName(name);
                              }}
                              className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                              title="Rename"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() =>
                                updateSetting({
                                  projects: projects.filter(
                                    (_, i) => i !== idx,
                                  ),
                                })
                              }
                              className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                              title="Remove from the saved list"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "integrations" && (
            <div>
              <h3 className="mb-2 text-2xl font-bold text-neutral-800 dark:text-neutral-100">
                Integrations
              </h3>
              <p className="mb-8 text-sm text-neutral-500">
                Everything here is off until you turn it on. Nothing leaves this
                machine otherwise.
              </p>

              <div className="space-y-4">
                {/* Google Calendar */}
                <div className="rounded-2xl border border-neutral-100 bg-neutral-50/50 p-6 dark:border-neutral-800 dark:bg-neutral-800/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-neutral-100 dark:bg-neutral-900 dark:ring-neutral-700">
                        <Calendar size={24} className="text-[#4285F4]" />
                      </div>
                      <div>
                        <div className="text-lg font-bold text-neutral-800 dark:text-neutral-100">
                          Google Calendar
                        </div>
                        <div className="text-sm text-neutral-500">
                          {!gcalStatus.configured
                            ? "Not set up on this machine — see the README to add credentials."
                            : gcalStatus.connected
                              ? gcalStatus.email || "Connected"
                              : "Create an event for tasks that have a date."}
                        </div>
                      </div>
                    </div>
                    {gcalStatus.connected ? (
                      <button
                        onClick={async () => {
                          await ipc?.invoke("google-calendar-disconnect");
                          setGcalStatus((p) => ({
                            ...p,
                            connected: false,
                            email: null,
                          }));
                          onToast?.("Disconnected from Google Calendar");
                        }}
                        className="rounded-xl px-5 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/10"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          const res = await ipc?.invoke("google-calendar-auth");
                          if (!res?.success)
                            onToast?.(
                              res?.error || "Could not start sign-in",
                              "error",
                            );
                        }}
                        disabled={!gcalStatus.configured}
                        className={`rounded-xl px-6 py-2.5 text-sm font-bold shadow-sm transition-all ${
                          gcalStatus.configured
                            ? "bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black"
                            : "cursor-not-allowed bg-neutral-200 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-600"
                        }`}
                      >
                        Connect
                      </button>
                    )}
                  </div>
                  {gcalStatus.connected && (
                    <div className="mt-5 flex items-center justify-between border-t border-neutral-200 pt-5 dark:border-neutral-700/50">
                      <div>
                        <div className="text-sm font-bold text-neutral-800 dark:text-neutral-100">
                          Create events automatically
                        </div>
                        <div className="text-sm text-neutral-500">
                          Only for tasks that carry a date.
                        </div>
                      </div>
                      <Toggle
                        on={!!settings.calendarSync}
                        label="Create calendar events automatically"
                        onClick={() =>
                          updateSetting({
                            calendarSync: !settings.calendarSync,
                          })
                        }
                      />
                    </div>
                  )}
                </div>

                {/* Jira */}
                <div className="rounded-2xl border border-neutral-100 bg-neutral-50/50 p-6 dark:border-neutral-800 dark:bg-neutral-800/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0052CC] shadow-sm">
                        <span className="text-lg font-black text-white">J</span>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-neutral-800 dark:text-neutral-100">
                          Jira
                        </div>
                        <div className="text-sm text-neutral-500">
                          {!jiraStatus.configured
                            ? "Not set up on this machine — see the README to add credentials."
                            : jiraStatus.connected
                              ? "Connected"
                              : "Create Jira issues straight from a note."}
                        </div>
                      </div>
                    </div>
                    {jiraStatus.connected ? (
                      <button
                        onClick={async () => {
                          await ipc?.invoke("jira-disconnect");
                          setJiraStatus((p) => ({ ...p, connected: false }));
                          onToast?.("Disconnected from Jira");
                        }}
                        className="rounded-xl px-5 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          const res = await ipc?.invoke("jira-auth");
                          if (!res?.success)
                            onToast?.(
                              res?.error || "Could not start sign-in",
                              "error",
                            );
                        }}
                        disabled={!jiraStatus.configured}
                        className={`rounded-xl px-6 py-2.5 text-sm font-bold shadow-sm transition-all ${
                          jiraStatus.configured
                            ? "bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black"
                            : "cursor-not-allowed bg-neutral-200 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-600"
                        }`}
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>

                {/* Apple Reminders */}
                {isMac && (
                  <div className="flex items-center justify-between rounded-2xl border border-neutral-100 bg-neutral-50/50 p-6 dark:border-neutral-800 dark:bg-neutral-800/30">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-neutral-100 dark:bg-neutral-900 dark:ring-neutral-700">
                        <Calendar size={24} className="text-[#FF3B30]" />
                      </div>
                      <div>
                        <div className="text-lg font-bold text-neutral-800 dark:text-neutral-100">
                          Apple Reminders
                        </div>
                        <div className="text-sm text-neutral-500">
                          Mirror dated tasks into Reminders.
                        </div>
                      </div>
                    </div>
                    <Toggle
                      on={!!settings.appleReminders}
                      label="Apple Reminders"
                      onClick={() =>
                        updateSetting({
                          appleReminders: !settings.appleReminders,
                        })
                      }
                    />
                  </div>
                )}

                {/* Local API */}
                <div className="flex items-center justify-between rounded-2xl border border-neutral-100 bg-neutral-50/50 p-6 dark:border-neutral-800 dark:bg-neutral-800/30">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-neutral-100 dark:bg-neutral-900 dark:ring-neutral-700">
                      <span className="font-mono text-sm font-black text-neutral-500">
                        {">_"}
                      </span>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-neutral-800 dark:text-neutral-100">
                        Command line access
                      </div>
                      <div className="max-w-md text-sm text-neutral-500">
                        Lets the bundled CLI add and list tasks on 127.0.0.1.
                        Requires a token that only apps on this Mac can read.
                      </div>
                    </div>
                  </div>
                  <Toggle
                    on={!!settings.apiEnabled}
                    label="Command line access"
                    onClick={async () => {
                      await updateSetting({ apiEnabled: !settings.apiEnabled });
                      onToast?.("Restart Stepler to apply this change");
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "data" && (
            <div>
              <h3 className="mb-8 text-2xl font-bold text-neutral-800 dark:text-neutral-100">
                Data Management
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <button
                  onClick={onExport}
                  className="group rounded-3xl border border-neutral-100 bg-neutral-50/50 p-8 text-left transition-all hover:border-neutral-900 hover:bg-neutral-900 dark:border-neutral-800 dark:bg-neutral-800/30 dark:hover:border-white dark:hover:bg-white"
                >
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-neutral-900 shadow-sm transition-all group-hover:scale-110 dark:bg-neutral-900 dark:text-white">
                    <Download size={28} />
                  </div>
                  <h4 className="mb-2 text-xl font-bold text-neutral-800 group-hover:text-white dark:text-neutral-100 dark:group-hover:text-neutral-900">
                    Export
                  </h4>
                  <p className="text-sm text-neutral-500 group-hover:text-neutral-400 dark:group-hover:text-neutral-500">
                    One JSON file with every task, including the attachments
                    themselves.
                  </p>
                </button>

                <button
                  onClick={onImport}
                  className="group rounded-3xl border border-neutral-100 bg-neutral-50/50 p-8 text-left transition-all hover:border-neutral-900 hover:bg-neutral-900 dark:border-neutral-800 dark:bg-neutral-800/30 dark:hover:border-white dark:hover:bg-white"
                >
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-neutral-900 shadow-sm transition-all group-hover:scale-110 dark:bg-neutral-900 dark:text-white">
                    <Upload size={28} />
                  </div>
                  <h4 className="mb-2 text-xl font-bold text-neutral-800 group-hover:text-white dark:text-neutral-100 dark:group-hover:text-neutral-900">
                    Import
                  </h4>
                  <p className="text-sm text-neutral-500 group-hover:text-neutral-400 dark:group-hover:text-neutral-500">
                    Merge an export back in. Existing tasks are never
                    overwritten.
                  </p>
                </button>
              </div>

              <p className="mt-8 text-sm text-neutral-500">
                Stepler keeps a backup copy of the previous data file every time
                it starts, next to your tasks in the app data folder.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

SettingsPanel.propTypes = {
  settings: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onExport: PropTypes.func,
  onImport: PropTypes.func,
  onSettingsUpdate: PropTypes.func,
  onToast: PropTypes.func,
};
