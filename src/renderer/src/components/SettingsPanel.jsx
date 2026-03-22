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
} from "lucide-react";

const isMac =
  window.electron?.process?.platform === "darwin" ||
  /Mac/.test(navigator.userAgent);

function formatAcceleratorForDisplay(acc) {
  if (!acc) return "";
  return acc
    .replace(/CommandOrControl/g, isMac ? "⌘" : "Ctrl")
    .replace(/CmdOrCtrl/g, isMac ? "⌘" : "Ctrl")
    .replace(/Command/g, isMac ? "⌘" : "Win")
    .replace(/Control/g, isMac ? "⌃" : "Ctrl")
    .replace(/Shift/g, isMac ? "⇧" : "Shift")
    .replace(/Alt/g, isMac ? "⌥" : "Alt")
    .replace(/\+/g, isMac ? "" : " + ")
    .replace(/Space/, isMac ? "␣" : "Space");
}

function keyEventToAccelerator(e) {
  const parts = [];
  if (e.ctrlKey && !e.metaKey) parts.push("Control");
  if (e.metaKey) parts.push("CommandOrControl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  const ignore = ["Meta", "Control", "Alt", "Shift", "Dead"];
  if (!ignore.includes(e.key)) {
    let key = e.key;
    if (key === " ") key = "Space";
    else if (key.length === 1) key = key.toUpperCase();
    else if (key === "ArrowUp") key = "Up";
    else if (key === "ArrowDown") key = "Down";
    else if (key === "ArrowLeft") key = "Left";
    else if (key === "ArrowRight") key = "Right";
    parts.push(key);
  }

  if (parts.length < 2) return null;
  return parts.join("+");
}

export default function SettingsPanel({
  settings: initialSettings,
  onClose,
  onExport,
  onImport,
  onSettingsUpdate,
}) {
  const [settings, setSettings] = useState(
    initialSettings || { hotkey: "", theme: "dark", projects: [] },
  );
  const [recording, setRecording] = useState(false);
  const [tempKey, setTempKey] = useState(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [editingProjectIdx, setEditingProjectIdx] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [activeTab, setActiveTab] = useState("general");
  const recorderRef = useRef(null);

  useEffect(() => {
    window.electron?.ipcRenderer.invoke("get-settings").then(setSettings);
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape" && !recording) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose, recording]);

  const [gcalStatus, setGcalStatus] = useState({
    configured: false,
    connected: false,
  });
  const [jiraStatus, setJiraStatus] = useState({
    configured: false,
    connected: false,
  });

  useEffect(() => {
    window.electron?.ipcRenderer
      .invoke("google-calendar-status")
      .then(setGcalStatus);
    window.electron?.ipcRenderer.invoke("jira-status").then(setJiraStatus);

    const handleGcalConnected = () => {
      window.electron?.ipcRenderer
        .invoke("google-calendar-status")
        .then(setGcalStatus);
    };
    const handleJiraConnected = () => {
      window.electron?.ipcRenderer.invoke("jira-status").then(setJiraStatus);
    };

    window.electron?.ipcRenderer.on(
      "google-calendar-connected",
      handleGcalConnected,
    );
    window.electron?.ipcRenderer.on("jira-connected", handleJiraConnected);

    return () => {
      window.electron?.ipcRenderer.removeAllListeners(
        "google-calendar-connected",
      );
      window.electron?.ipcRenderer.removeAllListeners("jira-connected");
    };
  }, []);

  const handleGcalAuth = () => {
    window.electron?.ipcRenderer.invoke("google-calendar-auth");
  };

  const handleGcalDisconnect = async () => {
    await window.electron?.ipcRenderer.invoke("google-calendar-disconnect");
    setGcalStatus((prev) => ({ ...prev, connected: false }));
  };

  const handleJiraAuth = () => {
    window.electron?.ipcRenderer.invoke("jira-auth");
  };

  const handleJiraDisconnect = async () => {
    await window.electron?.ipcRenderer.invoke("jira-disconnect");
    setJiraStatus((prev) => ({ ...prev, connected: false }));
  };
  const updateSetting = useCallback(
    async (partial) => {
      const updated = await window.electron?.ipcRenderer.invoke(
        "update-settings",
        partial,
      );
      if (updated) {
        setSettings(updated);
        if (onSettingsUpdate) onSettingsUpdate(updated);
      }
    },
    [onSettingsUpdate],
  );

  const handleAddProject = () => {
    const name = newProjectName.trim();
    if (
      name &&
      !settings.projects?.some((p) => (typeof p === "string" ? p : p.name) === name)
    ) {
      const updatedProjects = [
        ...(settings.projects || []),
        { name, isFavorite: false },
      ];
      updateSetting({ projects: updatedProjects });
      setNewProjectName("");
    }
  };

  const handleDeleteProject = (index) => {
    const updatedProjects = (settings.projects || []).filter(
      (_, i) => i !== index,
    );
    updateSetting({ projects: updatedProjects });
  };

  const handleToggleFavoriteProject = (index) => {
    const updatedProjects = [...(settings.projects || [])];
    const project = updatedProjects[index];
    if (typeof project === "string") {
      updatedProjects[index] = { name: project, isFavorite: true };
    } else {
      updatedProjects[index] = { ...project, isFavorite: !project.isFavorite };
    }
    updateSetting({ projects: updatedProjects });
  };

  const handleStartEditProject = (index, project) => {
    setEditingProjectIdx(index);
    setEditingProjectName(typeof project === "string" ? project : project.name);
  };

  const handleSaveEditProject = () => {
    const name = editingProjectName.trim();
    if (name && editingProjectIdx !== null) {
      const updatedProjects = [...(settings.projects || [])];
      const oldProject = updatedProjects[editingProjectIdx];
      if (typeof oldProject === "string") {
        updatedProjects[editingProjectIdx] = { name, isFavorite: false };
      } else {
        updatedProjects[editingProjectIdx] = { ...oldProject, name };
      }
      updateSetting({ projects: updatedProjects });
      setEditingProjectIdx(null);
      setEditingProjectName("");
    }
  };

  const handleCancelEditProject = () => {
    setEditingProjectIdx(null);
    setEditingProjectName("");
  };

  const handleKeyCapture = useCallback(
    (e) => {
      if (!recording) return;
      e.preventDefault();
      e.stopPropagation();
      const acc = keyEventToAccelerator(e);
      if (acc) {
        setTempKey(acc);
        setRecording(false);
        updateSetting({ hotkey: acc });
      }
    },
    [recording, updateSetting],
  );

  useEffect(() => {
    if (recording && recorderRef.current) {
      recorderRef.current.focus();
    }
  }, [recording]);

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
        className="flex h-[600px] w-full max-w-4xl overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* --- Sidebar Navigation --- */}
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
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                <Icon size={18} strokeWidth={activeTab === id ? 2.5 : 2} />
                {label}
              </button>
            ))}
          </nav>

          <div className="absolute bottom-6 left-6 right-auto">
            <button
              onClick={onClose}
              className="btn-tactile flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-600 shadow-sm transition-all hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
            >
              <X size={16} />
              Close
            </button>
          </div>
        </div>

        {/* --- Content Area --- */}
        <div className="flex-1 overflow-y-auto p-10">
          {activeTab === "general" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h3 className="mb-8 text-2xl font-bold text-neutral-800 dark:text-neutral-100">
                General
              </h3>

              {/* --- Appearance --- */}
              <section className="mb-10">
                <label className="mb-4 block text-xs font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
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
                          : "border-neutral-100 bg-neutral-50/50 text-neutral-500 hover:border-neutral-200 hover:bg-white dark:border-neutral-800 dark:bg-neutral-800/30 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:bg-neutral-800"
                      }`}
                    >
                      <Icon size={24} />
                      <span className="text-sm font-semibold">{label}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* --- Shortcut --- */}
              <section>
                <label className="mb-4 block text-xs font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
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
                      <span className="animate-pulse font-medium">Recording: Press new keys…</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="flex flex-1 items-center rounded-xl border border-neutral-200 bg-white px-5 py-3.5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
                        <span className="font-mono text-base font-bold tracking-widest text-neutral-800 dark:text-neutral-100">
                          {formatAcceleratorForDisplay(tempKey || settings.hotkey)}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setRecording(true);
                          setTempKey(null);
                        }}
                        className="btn-tactile rounded-xl bg-neutral-900 px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
                      >
                        Change
                      </button>
                    </div>
                  )}
                  <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                    Press this key combination from any app to toggle Stepler.
                  </p>
                </div>
              </section>
            </div>
          )}

          {activeTab === "projects" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h3 className="mb-8 text-2xl font-bold text-neutral-800 dark:text-neutral-100">
                Projects
              </h3>
              
              <div className="mb-8">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Enter project name..."
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddProject();
                      }}
                      className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/50 px-5 py-3.5 text-sm font-medium text-neutral-800 outline-none transition-all focus:border-neutral-400 focus:bg-white dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-100 dark:focus:border-neutral-500"
                    />
                  </div>
                  <button
                    onClick={handleAddProject}
                    disabled={!newProjectName.trim()}
                    className="btn-tactile flex items-center justify-center rounded-2xl bg-black px-6 text-sm font-bold text-white transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-neutral-100"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {(settings.projects || []).map((project, idx) => (
                  <div
                    key={idx}
                    className="group flex items-center justify-between rounded-2xl border border-neutral-100 bg-neutral-50/30 px-5 py-4 transition-all hover:border-neutral-200 hover:bg-white dark:border-neutral-800 dark:bg-neutral-800/20 dark:hover:border-neutral-700 dark:hover:bg-neutral-800/40"
                  >
                    {editingProjectIdx === idx ? (
                      <div className="flex flex-1 items-center gap-3">
                        <input
                          type="text"
                          autoFocus
                          value={editingProjectName}
                          onChange={(e) => setEditingProjectName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEditProject();
                            if (e.key === "Escape") handleCancelEditProject();
                          }}
                          className="flex-1 bg-transparent text-base font-bold text-neutral-800 outline-none dark:text-neutral-100"
                        />
                        <button
                          onClick={handleSaveEditProject}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={handleCancelEditProject}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400"
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
                            {typeof project === "string" ? project : project.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => handleToggleFavoriteProject(idx)}
                            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                              (typeof project === "object" && project.isFavorite)
                                ? "bg-amber-50 text-amber-500 dark:bg-amber-900/20 dark:text-amber-400"
                                : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
                            }`}
                          >
                            <Star
                              size={18}
                              fill={(typeof project === "object" && project.isFavorite) ? "currentColor" : "none"}
                            />
                          </button>
                          <button
                            onClick={() => handleStartEditProject(idx, project)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteProject(idx)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "integrations" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h3 className="mb-8 text-2xl font-bold text-neutral-800 dark:text-neutral-100">
                Integrations
              </h3>

              <div className="space-y-4">
                {/* Google Calendar */}
                <div className="flex flex-col gap-4 rounded-2xl border border-neutral-100 bg-neutral-50/50 p-6 dark:border-neutral-800 dark:bg-neutral-800/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-neutral-100 dark:bg-neutral-900 dark:ring-neutral-700">
                        <Calendar size={24} className="text-[#4285F4]" />
                      </div>
                      <div>
                        <div className="text-lg font-bold text-neutral-800 dark:text-neutral-100">Google Calendar</div>
                        <div className="text-sm text-neutral-500">
                          {gcalStatus.connected ? (gcalStatus.email || "Connected") : "Sync tasks to your calendar."}
                        </div>
                      </div>
                    </div>
                    {gcalStatus.connected ? (
                      <button
                        onClick={handleGcalDisconnect}
                        className="rounded-xl px-5 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/10"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={handleGcalAuth}
                        disabled={!gcalStatus.configured}
                        className={`rounded-xl px-6 py-2.5 text-sm font-bold shadow-sm transition-all ${
                          gcalStatus.configured
                            ? "bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-100"
                            : "bg-neutral-200 text-neutral-400 cursor-not-allowed dark:bg-neutral-800 dark:text-neutral-600"
                        }`}
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>

                {/* Jira */}
                <div className="flex flex-col gap-4 rounded-2xl border border-neutral-100 bg-neutral-50/50 p-6 dark:border-neutral-800 dark:bg-neutral-800/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0052CC] shadow-sm">
                        <span className="text-lg font-black text-white">J</span>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-neutral-800 dark:text-neutral-100">Jira</div>
                        <div className="text-sm text-neutral-500">
                          {jiraStatus.connected ? "Connected" : "Import and track Jira issues."}
                        </div>
                      </div>
                    </div>
                    {jiraStatus.connected ? (
                      <button
                        onClick={handleJiraDisconnect}
                        className="rounded-xl px-5 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/10"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={handleJiraAuth}
                        disabled={!jiraStatus.configured}
                        className={`rounded-xl px-6 py-2.5 text-sm font-bold shadow-sm transition-all ${
                          jiraStatus.configured
                            ? "bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-100"
                            : "bg-neutral-200 text-neutral-400 cursor-not-allowed dark:bg-neutral-800 dark:text-neutral-600"
                        }`}
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>

                {/* Apple Reminders */}
                {isMac && (
                  <div className="flex flex-col gap-4 rounded-2xl border border-neutral-100 bg-neutral-50/50 p-6 dark:border-neutral-800 dark:bg-neutral-800/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-neutral-100 dark:bg-neutral-900 dark:ring-neutral-700">
                          <Calendar size={24} className="text-[#FF3B30]" />
                        </div>
                        <div>
                          <div className="text-lg font-bold text-neutral-800 dark:text-neutral-100">Apple Reminders</div>
                          <div className="text-sm text-neutral-500">
                            {settings.appleReminders ? "Enabled" : "Disabled"}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          updateSetting({
                            appleReminders: !settings.appleReminders,
                          })
                        }
                        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none ${
                          settings.appleReminders ? "bg-green-500" : "bg-neutral-300 dark:bg-neutral-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                            settings.appleReminders ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "data" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h3 className="mb-8 text-2xl font-bold text-neutral-800 dark:text-neutral-100">
                Data Management
              </h3>

              <div className="grid grid-cols-2 gap-6">
                <div onClick={onExport} className="group cursor-pointer rounded-3xl border border-neutral-100 bg-neutral-50/50 p-8 transition-all hover:border-neutral-900 hover:bg-neutral-900 dark:border-neutral-800 dark:bg-neutral-800/30 dark:hover:border-white dark:hover:bg-white">
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-neutral-900 shadow-sm transition-all group-hover:scale-110 group-hover:bg-neutral-900 group-hover:text-white dark:bg-neutral-900 dark:text-white dark:group-hover:bg-white dark:group-hover:text-neutral-900">
                    <Download size={28} />
                  </div>
                  <h4 className="mb-2 text-xl font-bold text-neutral-800 group-hover:text-white dark:text-neutral-100 dark:group-hover:text-neutral-900">Export</h4>
                  <p className="text-sm text-neutral-500 group-hover:text-neutral-400 dark:group-hover:text-neutral-500">
                    Download all your tasks, history, and settings as a JSON file.
                  </p>
                </div>

                <div onClick={onImport} className="group cursor-pointer rounded-3xl border border-neutral-100 bg-neutral-50/50 p-8 transition-all hover:border-neutral-900 hover:bg-neutral-900 dark:border-neutral-800 dark:bg-neutral-800/30 dark:hover:border-white dark:hover:bg-white">
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-neutral-900 shadow-sm transition-all group-hover:scale-110 group-hover:bg-neutral-900 group-hover:text-white dark:bg-neutral-900 dark:text-white dark:group-hover:bg-white dark:group-hover:text-neutral-900">
                    <Upload size={28} />
                  </div>
                  <h4 className="mb-2 text-xl font-bold text-neutral-800 group-hover:text-white dark:text-neutral-100 dark:group-hover:text-neutral-900">Import</h4>
                  <p className="text-sm text-neutral-500 group-hover:text-neutral-400 dark:group-hover:text-neutral-500">
                    Restore your data from a previously exported JSON backup.
                  </p>
                </div>
              </div>
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
};
