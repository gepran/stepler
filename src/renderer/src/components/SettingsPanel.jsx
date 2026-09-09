import { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import GuideTab from "./GuideTab";
import DeletedTasksList from "./DeletedTasksList";
import CollaborationPanel from "./CollaborationPanel";
import {
  LANGUAGES,
  setLanguage,
  translatePlural as tPlural,
  useLanguage,
  useT,
} from "../lib/i18n";
import {
  BookOpen,
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
  Languages,
  Cloud,
  CloudOff,
  LogOut,
  Users,
  ArrowUpCircle,
  FolderOpen,
  Loader2,
  RefreshCw,
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

/**
 * Signing in is what turns one computer's task list into the same list
 * everywhere. Google opens in the real browser rather than an embedded window:
 * Google refuses to sign people in inside an embedded view, and it is also the
 * only way the person can see the address bar they are typing a password into.
 */
function SyncSection() {
  const t = useT();
  const [status, setStatus] = useState({ signedIn: false, state: "off" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    ipc?.invoke("sync-status").then((s) => s && setStatus(s));
    const onStatus = (_, s) => s && setStatus(s);
    // App listens on this same channel for the sidebar's avatar, and this
    // section unmounts every time you switch tabs — removeAllListeners would
    // take that subscription down with it and freeze the avatar until restart.
    const off = ipc?.on("sync-status", onStatus);
    return () => off?.();
  }, []);

  const withBusy = async (run) => {
    setBusy(true);
    setError(null);
    try {
      const res = await run();
      if (res && res.success === false) setError(res.error || "");
    } finally {
      setBusy(false);
    }
  };

  const dot =
    status.state === "synced"
      ? "bg-emerald-500"
      : status.state === "error"
        ? "bg-red-500"
        : status.state === "off"
          ? "bg-neutral-300 dark:bg-neutral-600"
          : "bg-amber-400";

  return (
    <section className="mb-10">
      <label className="mb-4 block text-xs font-bold uppercase tracking-widest text-neutral-400">
        {t("settings.sync.title")}
      </label>

      <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-700">
        {status.signedIn ? (
          <>
            <div className="flex items-center gap-3">
              <Cloud size={18} className="shrink-0 text-orange-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                  {status.email || t("settings.sync.title")}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`}
                  />
                  {t(`settings.sync.states.${status.state}`)}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => withBusy(() => ipc?.invoke("sync-signout"))}
                title={t("auth.signOut")}
                className="btn-tactile shrink-0 cursor-pointer rounded-xl border border-neutral-200 p-2 text-neutral-500 hover:text-neutral-800 disabled:opacity-50 dark:border-neutral-700 dark:hover:text-neutral-200"
              >
                <LogOut size={15} />
              </button>
            </div>
            {status.error && (
              <p className="mt-3 text-xs leading-snug text-red-600 dark:text-red-400">
                {status.error}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="mb-4 flex items-start gap-3">
              <CloudOff
                size={18}
                className="mt-0.5 shrink-0 text-neutral-400 dark:text-neutral-500"
              />
              <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                {t("settings.sync.blurb")}
              </p>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => withBusy(() => ipc?.invoke("sync-signin-google"))}
              className="btn-tactile mb-3 w-full cursor-pointer rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
            >
              {t("auth.google")}
            </button>
            <p className="mb-4 text-center text-[11px] text-neutral-400">
              {t("settings.sync.browserNote")}
            </p>

            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.email")}
                className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-orange-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.password")}
                className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-orange-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
              <button
                type="button"
                disabled={busy || !email.trim() || password.length < 6}
                onClick={() =>
                  withBusy(() =>
                    ipc?.invoke("sync-signin-email", {
                      email,
                      password,
                      create: creating,
                    }),
                  )
                }
                className="btn-tactile shrink-0 cursor-pointer rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-orange-500"
              >
                {busy
                  ? t("auth.working")
                  : creating
                    ? t("auth.signUp")
                    : t("auth.signIn")}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setCreating(!creating);
                setError(null);
              }}
              className="mt-3 w-full cursor-pointer text-center text-xs text-neutral-500 hover:text-orange-500"
            >
              {creating ? t("auth.toSignIn") : t("auth.toSignUp")}
            </button>

            {error && (
              <p className="mt-3 text-center text-xs leading-snug text-red-600 dark:text-red-400">
                {t(`auth.errors.${ERROR_KEYS[error] || "generic"}`)}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/** Firebase reports failures as machine codes; people need sentences. */
const ERROR_KEYS = {
  "auth/invalid-email": "invalidEmail",
  "auth/invalid-credential": "wrongPassword",
  "auth/wrong-password": "wrongPassword",
  "auth/user-not-found": "wrongPassword",
  "auth/email-already-in-use": "emailInUse",
  "auth/weak-password": "weakPassword",
  "auth/too-many-requests": "tooMany",
  "auth/network-request-failed": "network",
};

/**
 * Version, and the state of the updater, in the corner of the settings window.
 *
 * It subscribes to the same `update-state` channel the header pill uses rather
 * than keeping a second idea of what is happening — the two are looking at one
 * download, and the moment they disagree one of them is lying.
 */
function UpdateCorner({ onRevealed }) {
  const t = useT();
  const [version, setVersion] = useState("");
  const [state, setState] = useState({ status: "idle" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ipc) return undefined;
    ipc.invoke("get-app-version").then((v) => v && setVersion(v));
    ipc.invoke("get-update-state").then((s) => s && setState(s));
    const onState = (_, s) => {
      if (!s) return;
      setState(s);
      // The engine has answered; the button belongs to the person again.
      if (s.status !== "checking") setBusy(false);
    };
    ipc.on("update-state", onState);
    // removeListener, not removeAllListeners: the header pill is listening on
    // this same channel, and tearing the channel down when this panel closes
    // would leave the pill deaf for the rest of the session.
    return () => ipc.removeListener("update-state", onState);
  }, []);

  const status = state.status;
  const checking = busy || status === "checking";
  const downloading = status === "downloading";
  const ready = status === "ready";
  const failed = status === "error";
  // The bytes are on disk in both states — a failed install did not un-download
  // them — so the way to the file is offered in both.
  const downloaded = ready || (failed && !!state.version);

  const [unavailable, setUnavailable] = useState(false);

  const check = async () => {
    setBusy(true);
    const res = await ipc?.invoke("check-for-update");
    if (res?.unavailable) setUnavailable(true);
    if (!res?.success) setBusy(false);
  };

  /** Put the download somewhere findable and open Finder on it. */
  const reveal = async () => {
    const res = await ipc?.invoke("reveal-downloaded-update");
    onRevealed?.(
      res?.success
        ? t("update.revealed", { name: res.name })
        : t("update.revealFailed"),
    );
  };

  const line = unavailable
    ? t("update.unavailable")
    : failed
      ? state.error || t("update.unknownError")
      : downloading
        ? typeof state.percent === "number"
          ? `${t("update.downloading")} — ${state.percent}%`
          : t("update.downloading")
        : ready
          ? t("update.restartTo", {
              version: state.version || t("update.theNewVersion"),
            })
          : checking
            ? t("update.checking")
            : state.checkedAt
              ? t("update.upToDate")
              : t("update.neverChecked");

  // The settings sidebar is 256px wide, so this stacks rather than sitting in
  // a row: side by side, the version truncated to three letters and the button
  // took the rest.
  return (
    <div className="rounded-xl border border-neutral-200 bg-white/60 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-800/40">
      <p className="truncate text-[12.5px] font-semibold text-neutral-700 dark:text-neutral-200">
        {version ? t("update.version", { version }) : "Stepler"}
      </p>
      <p
        className={`mb-2 line-clamp-2 text-[11px] leading-snug ${
          failed || unavailable
            ? "text-amber-600 dark:text-amber-400"
            : "text-neutral-400 dark:text-neutral-500"
        }`}
      >
        {line}
      </p>

      {/* Once a build is downloaded the only useful button is the one that
          restarts into it — offering "check again" beside it would be
          offering to look for something already sitting on the disk.
          Underneath it, always, the way to the file itself: electron-updater
          leaves the download in ~/Library/Caches, and an update you cannot
          find is an update you did not get. */}
      {downloaded ? (
        <div className="space-y-1.5">
          {ready && (
            <button
              onClick={() => ipc?.invoke("install-update")}
              className="btn-tactile flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-500 px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-blue-600"
            >
              <ArrowUpCircle size={14} />
              {t("update.update")}
            </button>
          )}
          <button
            onClick={reveal}
            className="btn-tactile flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[12px] font-semibold text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            <FolderOpen size={14} />
            {t("update.reveal")}
          </button>
        </div>
      ) : (
        <button
          onClick={check}
          disabled={checking || downloading || unavailable}
          className="btn-tactile flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[12px] font-semibold text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-default disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
        >
          {checking || downloading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          {t("update.checkNow")}
        </button>
      )}
    </div>
  );
}

UpdateCorner.propTypes = { onRevealed: PropTypes.func };

export default function SettingsPanel({
  settings: initialSettings,
  onClose,
  onExport,
  onImport,
  onSettingsUpdate,
  onToast,
  deletedTasks = [],
  onRestore,
  onPermanentDelete,
  onClearAll,
  collab,
}) {
  const t = useT();
  const language = useLanguage();
  const [settings, setSettings] = useState(initialSettings || {});
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [editingProjectIdx, setEditingProjectIdx] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [activeTab, setActiveTab] = useState("general");
  const recorderRef = useRef(null);

  // The connect callback fires from a mount-only effect, so read the latest
  // handler through a ref instead of widening that effect's deps.
  const onSettingsUpdateRef = useRef(onSettingsUpdate);
  useEffect(() => {
    onSettingsUpdateRef.current = onSettingsUpdate;
  }, [onSettingsUpdate]);

  const [gcalStatus, setGcalStatus] = useState({
    configured: false,
    connected: false,
  });
  const [jiraStatus, setJiraStatus] = useState({
    configured: false,
    connected: false,
  });
  const [jiraForm, setJiraForm] = useState({
    siteUrl: "",
    email: "",
    token: "",
  });
  const [jiraBusy, setJiraBusy] = useState(false);

  useEffect(() => {
    ipc?.invoke("get-settings").then((s) => s && setSettings(s));
    ipc?.invoke("google-calendar-status").then((s) => s && setGcalStatus(s));
    ipc?.invoke("jira-status").then((s) => s && setJiraStatus(s));

    const refreshGcal = () => {
      ipc?.invoke("google-calendar-status").then(setGcalStatus);
      // Connecting flips calendarSync on in the main process. Pull the
      // settings back so both this panel and the task list see it without a
      // restart — the create path reads calendarSync from the app's copy.
      ipc?.invoke("get-settings").then((s) => {
        if (!s) return;
        setSettings(s);
        onSettingsUpdateRef.current?.(s);
      });
    };
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
        setRecordError(t("settings.general.shortcutError"));
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
    [recording, updateSetting, onToast, t],
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
    { id: "general", label: t("settings.tabs.general"), Icon: SunMedium },
    { id: "projects", label: t("settings.tabs.projects"), Icon: Hash },
    {
      id: "integrations",
      label: t("settings.tabs.integrations"),
      Icon: Calendar,
    },
    {
      id: "collab",
      label: t("settings.tabs.collab"),
      Icon: Users,
      // Somebody waiting on an answer is the one thing in this window worth
      // interrupting for, so it carries the same badge the trash does.
      badge: collab.connections.filter((c) => c.status === "incoming").length,
    },
    { id: "guide", label: t("settings.tabs.guide"), Icon: BookOpen },
    { id: "data", label: t("settings.tabs.data"), Icon: Download },
    {
      id: "trash",
      label: t("settings.tabs.trash"),
      Icon: Trash2,
      badge: deletedTasks.length,
    },
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
              {t("settings.title")}
            </h2>
          </div>

          <nav className="space-y-1.5">
            {tabs.map(({ id, label, Icon, badge }) => (
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
                {badge > 0 && (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-100 px-1.5 text-[11px] font-semibold text-red-500 dark:bg-red-500/10">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* The corner: which build this is, whether there is a newer one,
              and the way out. The version is worth having here rather than
              buried in an About box — it is the first thing anybody is asked
              for when something goes wrong. */}
          <div className="absolute bottom-6 left-6 right-6 space-y-2.5">
            <UpdateCorner onRevealed={onToast} />
            <button
              onClick={onClose}
              className="btn-tactile flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-600 shadow-sm transition-all hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"
            >
              <X size={16} />
              {t("common.close")}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-10">
          {activeTab === "general" && (
            <div>
              <h3 className="mb-8 text-2xl font-bold text-neutral-800 dark:text-neutral-100">
                {t("settings.general.title")}
              </h3>

              <SyncSection />

              <section className="mb-10">
                <label className="mb-4 block text-xs font-bold uppercase tracking-widest text-neutral-400">
                  {t("settings.general.appearance")}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      value: "light",
                      label: t("settings.general.light"),
                      Icon: SunMedium,
                    },
                    {
                      value: "dark",
                      label: t("settings.general.dark"),
                      Icon: Moon,
                    },
                    {
                      value: "system",
                      label: t("settings.general.system"),
                      Icon: Monitor,
                    },
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

              <section className="mb-10">
                <label className="mb-4 block text-xs font-bold uppercase tracking-widest text-neutral-400">
                  {t("settings.general.language")}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {LANGUAGES.map(({ code, native }) => (
                    <button
                      key={code}
                      onClick={() => {
                        setLanguage(code);
                        updateSetting({ language: code });
                      }}
                      className={`btn-tactile flex flex-col items-center justify-center gap-3 rounded-2xl border p-5 transition-all ${
                        language === code
                          ? "border-neutral-900 bg-neutral-900 text-white shadow-lg dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                          : "border-neutral-100 bg-neutral-50/50 text-neutral-500 hover:border-neutral-200 hover:bg-white dark:border-neutral-800 dark:bg-neutral-800/30 dark:text-neutral-400"
                      }`}
                    >
                      <Languages size={24} />
                      <span className="text-sm font-semibold">{native}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-sm text-neutral-500">
                  {t("settings.general.languageHint")}
                </p>
              </section>

              <section className="mb-8">
                <label className="mb-4 block text-xs font-bold uppercase tracking-widest text-neutral-400">
                  {t("settings.general.shortcut")}
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
                        {t("settings.general.recording")}
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
                        {t("settings.general.change")}
                      </button>
                    </div>
                  )}
                  <p
                    className={`mt-4 text-sm ${recordError ? "text-red-500" : "text-neutral-500 dark:text-neutral-400"}`}
                  >
                    {recordError || t("settings.general.shortcutHint")}
                  </p>
                </div>
              </section>

              <section>
                <label className="mb-4 block text-xs font-bold uppercase tracking-widest text-neutral-400">
                  {t("settings.general.behaviour")}
                </label>
                {isMac && (
                  <div className="mb-4 flex items-center justify-between rounded-2xl border border-neutral-100 bg-neutral-50/50 p-6 dark:border-neutral-800 dark:bg-neutral-800/30">
                    <div>
                      <div className="text-base font-bold text-neutral-800 dark:text-neutral-100">
                        {t("settings.general.captureSelection")}
                      </div>
                      <div className="text-sm text-neutral-500">
                        {t("settings.general.captureSelectionHint")}
                      </div>
                    </div>
                    <Toggle
                      on={settings.captureSelection !== false}
                      label={t("settings.general.captureSelection")}
                      onClick={() =>
                        updateSetting({
                          captureSelection: settings.captureSelection === false,
                        })
                      }
                    />
                  </div>
                )}

                <div className="flex items-center justify-between rounded-2xl border border-neutral-100 bg-neutral-50/50 p-6 dark:border-neutral-800 dark:bg-neutral-800/30">
                  <div>
                    <div className="text-base font-bold text-neutral-800 dark:text-neutral-100">
                      {t("settings.general.escToHide")}
                    </div>
                    <div className="text-sm text-neutral-500">
                      {t("settings.general.escToHideHint")}
                    </div>
                  </div>
                  <Toggle
                    on={!!settings.escToHide}
                    label={t("settings.general.escToHide")}
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
                {t("settings.projects.title")}
              </h3>
              <div className="mb-8 flex gap-3">
                <input
                  type="text"
                  placeholder={t("settings.projects.placeholder")}
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
                    {t("settings.projects.empty")}
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
                              title={t("settings.projects.pin")}
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
                              title={t("settings.projects.rename")}
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
                              title={t("settings.projects.removeSaved")}
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
                {t("settings.integrations.title")}
              </h3>
              <p className="mb-8 text-sm text-neutral-500">
                {t("settings.integrations.blurb")}
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
                            ? t("settings.integrations.gcalNeedsCreds")
                            : gcalStatus.connected
                              ? gcalStatus.email ||
                                t("settings.integrations.gcalConnected")
                              : t("settings.integrations.gcalBlurb")}
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
                          onToast?.(t("toast.gcalDisconnected"));
                        }}
                        className="rounded-xl px-5 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/10"
                      >
                        {t("common.disconnect")}
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          const res = await ipc?.invoke("google-calendar-auth");
                          if (!res?.success)
                            onToast?.(
                              res?.error ||
                                t("settings.integrations.signInFailed"),
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
                        {t("common.connect")}
                      </button>
                    )}
                  </div>
                  {!gcalStatus.configured && (
                    <div className="mt-5 border-t border-neutral-200 pt-5 dark:border-neutral-700/50">
                      <div className="text-sm text-neutral-500">
                        {t("settings.integrations.gcalCredsBefore")}{" "}
                        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[13px] dark:bg-neutral-800">
                          stepler-integrations.json
                        </code>{" "}
                        {t("settings.integrations.gcalCredsAfter")}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => ipc?.invoke("open-data-folder")}
                          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        >
                          {t("settings.integrations.openDataFolder")}
                        </button>
                        <button
                          onClick={() =>
                            ipc?.invoke(
                              "open-external",
                              "https://github.com/gepran/stepler#-integrations",
                            )
                          }
                          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        >
                          {t("settings.integrations.setupGuide")}
                        </button>
                      </div>
                    </div>
                  )}
                  {gcalStatus.connected && (
                    <div className="mt-5 flex items-center justify-between border-t border-neutral-200 pt-5 dark:border-neutral-700/50">
                      <div>
                        <div className="text-sm font-bold text-neutral-800 dark:text-neutral-100">
                          {t("settings.integrations.autoEvents")}
                        </div>
                        <div className="text-sm text-neutral-500">
                          {t("settings.integrations.autoEventsHint")}
                        </div>
                      </div>
                      <Toggle
                        on={!!settings.calendarSync}
                        label={t("settings.integrations.autoEvents")}
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
                          {jiraStatus.connected
                            ? jiraStatus.site
                              ? `${jiraStatus.email} at ${jiraStatus.site.replace(/^https:\/\//, "")}`
                              : t("settings.integrations.gcalConnected")
                            : t("settings.integrations.jiraBlurb")}
                        </div>
                      </div>
                    </div>
                    {jiraStatus.connected ? (
                      <button
                        onClick={async () => {
                          await ipc?.invoke("jira-disconnect");
                          setJiraStatus((p) => ({
                            ...p,
                            connected: false,
                            site: null,
                            email: null,
                          }));
                          onToast?.(t("toast.jiraDisconnected"));
                        }}
                        className="rounded-xl px-5 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400"
                      >
                        {t("common.disconnect")}
                      </button>
                    ) : null}
                  </div>

                  {!jiraStatus.connected && (
                    <div className="mt-5 border-t border-neutral-200 pt-5 dark:border-neutral-700/50">
                      <div className="text-sm text-neutral-500">
                        {t("settings.integrations.jiraNote")}
                      </div>

                      <div className="mt-4 grid gap-2">
                        <input
                          value={jiraForm.siteUrl}
                          onChange={(e) =>
                            setJiraForm((f) => ({
                              ...f,
                              siteUrl: e.target.value,
                            }))
                          }
                          placeholder="your-team.atlassian.net"
                          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-neutral-700 dark:bg-neutral-900"
                        />
                        <input
                          value={jiraForm.email}
                          onChange={(e) =>
                            setJiraForm((f) => ({
                              ...f,
                              email: e.target.value,
                            }))
                          }
                          placeholder={t("settings.integrations.jiraEmail")}
                          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-neutral-700 dark:bg-neutral-900"
                        />
                        <input
                          type="password"
                          value={jiraForm.token}
                          onChange={(e) =>
                            setJiraForm((f) => ({
                              ...f,
                              token: e.target.value,
                            }))
                          }
                          placeholder={t("settings.integrations.jiraToken")}
                          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-neutral-700 dark:bg-neutral-900"
                        />
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={async () => {
                            setJiraBusy(true);
                            const res = await ipc?.invoke(
                              "jira-connect-token",
                              jiraForm,
                            );
                            setJiraBusy(false);
                            if (res?.success) {
                              setJiraForm({
                                siteUrl: "",
                                email: "",
                                token: "",
                              });
                              ipc
                                ?.invoke("jira-status")
                                .then((st) => st && setJiraStatus(st));
                              onToast?.(
                                t("toast.jiraConnected", {
                                  name: res.displayName,
                                }),
                              );
                            } else {
                              onToast?.(
                                res?.error ||
                                  t("settings.integrations.jiraConnectFailed"),
                                "error",
                              );
                            }
                          }}
                          disabled={jiraBusy}
                          className="rounded-xl bg-black px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300 dark:bg-white dark:text-black dark:disabled:bg-neutral-700"
                        >
                          {jiraBusy
                            ? t("settings.integrations.jiraChecking")
                            : t("common.connect")}
                        </button>
                        <button
                          onClick={() =>
                            ipc?.invoke(
                              "open-external",
                              "https://id.atlassian.com/manage-profile/security/api-tokens",
                            )
                          }
                          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        >
                          {t("settings.integrations.jiraCreateToken")}
                        </button>
                        {jiraStatus.oauthConfigured && (
                          <button
                            onClick={async () => {
                              const res = await ipc?.invoke("jira-auth");
                              if (!res?.success)
                                onToast?.(
                                  res?.error ||
                                    t("settings.integrations.signInFailed"),
                                  "error",
                                );
                            }}
                            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                          >
                            {t("settings.integrations.jiraUseOauth")}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
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
                          {t("settings.integrations.remindersBlurb")}
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
                        {t("settings.integrations.cli")}
                      </div>
                      <div className="max-w-md text-sm text-neutral-500">
                        {t("settings.integrations.cliBlurb")}
                      </div>
                    </div>
                  </div>
                  <Toggle
                    on={!!settings.apiEnabled}
                    label={t("settings.integrations.cli")}
                    onClick={async () => {
                      await updateSetting({ apiEnabled: !settings.apiEnabled });
                      onToast?.(t("toast.restartToApply"));
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "collab" && (
            <div>
              <h3 className="mb-2 text-2xl font-bold text-neutral-800 dark:text-neutral-100">
                {t("collab.title")}
              </h3>
              <p className="mb-8 text-sm text-neutral-500">
                {t("collab.hint")}
              </p>
              <CollaborationPanel
                profile={collab.profile}
                connections={collab.connections}
                onSearch={collab.search}
                onInvite={collab.invite}
                onAccept={collab.accept}
                onRemove={collab.remove}
                onToast={onToast}
              />
            </div>
          )}

          {activeTab === "guide" && <GuideTab />}

          {activeTab === "data" && (
            <div>
              <h3 className="mb-8 text-2xl font-bold text-neutral-800 dark:text-neutral-100">
                {t("settings.data.title")}
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
                    {t("settings.data.export")}
                  </h4>
                  <p className="text-sm text-neutral-500 group-hover:text-neutral-400 dark:group-hover:text-neutral-500">
                    {t("settings.data.exportBlurb")}
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
                    {t("settings.data.import")}
                  </h4>
                  <p className="text-sm text-neutral-500 group-hover:text-neutral-400 dark:group-hover:text-neutral-500">
                    {t("settings.data.importBlurb")}
                  </p>
                </button>
              </div>

              <p className="mt-8 text-sm text-neutral-500">
                {t("settings.data.backupNote")}
              </p>
            </div>
          )}

          {activeTab === "trash" && (
            <div>
              <h3 className="mb-2 text-2xl font-bold text-neutral-800 dark:text-neutral-100">
                {t("trash.title")}
              </h3>
              <p className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">
                {tPlural("trash.inTrash", deletedTasks.length)}
              </p>
              <DeletedTasksList
                deletedTasks={deletedTasks}
                onRestore={onRestore}
                onPermanentDelete={onPermanentDelete}
                onClearAll={onClearAll}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

SettingsPanel.propTypes = {
  collab: PropTypes.shape({
    profile: PropTypes.object,
    connections: PropTypes.array.isRequired,
    search: PropTypes.func.isRequired,
    invite: PropTypes.func.isRequired,
    accept: PropTypes.func.isRequired,
    remove: PropTypes.func.isRequired,
  }).isRequired,
  settings: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onExport: PropTypes.func,
  onImport: PropTypes.func,
  onSettingsUpdate: PropTypes.func,
  onToast: PropTypes.func,
  deletedTasks: PropTypes.array,
  onRestore: PropTypes.func,
  onPermanentDelete: PropTypes.func,
  onClearAll: PropTypes.func,
};
