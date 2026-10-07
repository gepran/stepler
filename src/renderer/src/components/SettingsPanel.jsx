import { sortProjects } from "../lib/projects";
import { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import GuideTab from "./GuideTab";
import { version } from "../../../../package.json";
import IssueReportModal from "./IssueReportModal";
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
  LABEL_COLORS,
  colorForLabel,
  labelStyle,
  projectName,
} from "../lib/labels";
import {
  BookOpen,
  Keyboard,
  Info,
  Bug,
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
  Languages,
  Cloud,
  CloudOff,
  LogOut,
  Users,
  ArrowUpCircle,
  FolderOpen,
  Loader2,
  RefreshCw,
  Bot,
  Copy,
  Terminal,
  TextCursorInput,
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

// ---------------------------------------------------------------------------
// The panel's vocabulary.
//
// Every section used to invent its own padding, its own corner radius and its
// own idea of how big a title is — a 24px icon here, a 56px one there, p-5
// beside p-8. The result read as a pile of unrelated boxes, and finding a
// setting meant scanning all of them. Four pieces below cover the whole
// window, so anything built out of them lines up with everything else.
// ---------------------------------------------------------------------------

/** Primary action. One size, everywhere. */
const BTN =
  "btn-tactile inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200";

/** Everything secondary: bordered, quiet, same height as the primary. */
const BTN_GHOST =
  "btn-tactile inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700";

const INPUT =
  "min-w-0 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-800 outline-none transition-colors focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

function SectionLabel({ children }) {
  return (
    <h4 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500">
      {children}
    </h4>
  );
}

SectionLabel.propTypes = { children: PropTypes.node };

function Card({ className = "", children }) {
  return (
    <div
      className={`rounded-xl border border-neutral-200/80 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-800/30 ${className}`}
    >
      {children}
    </div>
  );
}

Card.propTypes = { className: PropTypes.string, children: PropTypes.node };

/**
 * A thing you can turn on or set: icon, name, one line saying what it does,
 * and the control that operates it. `children` is for the detail a row grows
 * once it is connected — a form, a sub-toggle, a command to copy.
 */
function Row({ icon, title, hint, action, children }) {
  return (
    <Card className="px-4 py-3.5">
      <div className="flex items-center gap-3.5">
        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-neutral-200/70 dark:bg-neutral-900 dark:ring-neutral-700">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-neutral-800 dark:text-neutral-100">
            {title}
          </div>
          {hint && (
            <div className="mt-0.5 text-[12.5px] leading-snug text-neutral-500 dark:text-neutral-400">
              {hint}
            </div>
          )}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

Row.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.node,
  hint: PropTypes.node,
  action: PropTypes.node,
  children: PropTypes.node,
};

/** One of a set — a theme, a language. Theme and language are the same kind
 *  of choice, so they are the same size and shape. */
function Choice({ selected, onClick, Icon, label }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border py-3 transition-all ${
        selected
          ? "border-orange-400 bg-orange-50 text-orange-700 dark:border-orange-500/50 dark:bg-orange-500/10 dark:text-orange-300"
          : "border-neutral-200/80 bg-neutral-50/60 text-neutral-500 hover:border-neutral-300 hover:bg-white dark:border-neutral-800 dark:bg-neutral-800/30 dark:text-neutral-400 dark:hover:bg-neutral-800"
      }`}
    >
      <Icon size={17} />
      <span className="text-[12.5px] font-semibold">{label}</span>
    </button>
  );
}

Choice.propTypes = {
  selected: PropTypes.bool,
  onClick: PropTypes.func,
  Icon: PropTypes.elementType,
  label: PropTypes.node,
};

/**
 * One keyboard shortcut: the keys, and what they do. Given an onClick it
 * becomes a button — that is the global shortcut, the only one you can change.
 */
function KeyCard({ combo, caption, action, onClick }) {
  return (
    <div className="flex items-center gap-4 py-4">
      <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-300">
        {caption}
      </span>
      <kbd className="shrink-0 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 font-mono text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
        {combo}
      </kbd>
      {onClick && (
        <button
          type="button"
          onClick={onClick}
          className="text-xs font-medium text-orange-600 hover:underline dark:text-orange-300"
        >
          {action}
        </button>
      )}
    </div>
  );
}

KeyCard.propTypes = {
  combo: PropTypes.node,
  caption: PropTypes.node,
  action: PropTypes.node,
  onClick: PropTypes.func,
};

/**
 * Connecting a coding agent.
 *
 * The command is built in the main process, where the real path to the MCP
 * server is known — inside an installed app it lives in app.asar.unpacked,
 * from a clone it sits next to package.json, and asking a person to work that
 * out was the reason this only ever existed in a README on GitHub.
 */
function AgentSetup({ enabled }) {
  const t = useT();
  const [info, setInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    ipc?.invoke("agent-setup").then((r) => r && setInfo(r));
    return () => clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    if (!info?.command) return;
    await ipc?.invoke("copy-text", info.command);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Row
      icon={<Bot size={18} className="text-neutral-500" />}
      title={t("settings.agents.title")}
      hint={t("settings.agents.blurb")}
    >
      <div className="mt-3.5 border-t border-neutral-200/80 pt-3.5 dark:border-neutral-700/50">
        {!enabled ? (
          <p className="text-[12.5px] text-amber-600 dark:text-amber-400">
            {t("settings.agents.needsApi")}
          </p>
        ) : (
          <>
            <p className="mb-2 text-[12.5px] text-neutral-500 dark:text-neutral-400">
              {t("settings.agents.step")}
            </p>
            <div className="flex items-center gap-2">
              {/* The command is long and the panel is not wide: it scrolls
                  sideways rather than wrapping into something that looks like
                  two commands. */}
              <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-neutral-200 bg-white px-3 py-2 font-mono text-[12px] text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                {info?.command || "…"}
              </code>
              <button
                onClick={copy}
                disabled={!info?.command}
                className={BTN_GHOST}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied
                  ? t("settings.agents.copied")
                  : t("settings.agents.copy")}
              </button>
            </div>
            <div className="mt-2.5 flex items-start justify-between gap-3">
              <p className="text-[12px] leading-snug text-neutral-400 dark:text-neutral-500">
                {t("settings.agents.requires")}
              </p>
              <button
                onClick={() =>
                  ipc?.invoke(
                    "open-external",
                    "https://github.com/gepran/stepler#-use-it-from-claude-code-codex-or-cursor",
                  )
                }
                className="shrink-0 cursor-pointer text-[12px] font-semibold text-neutral-500 underline-offset-2 hover:underline dark:text-neutral-400"
              >
                {t("settings.agents.docs")}
              </button>
            </div>
          </>
        )}
      </div>
    </Row>
  );
}

AgentSetup.propTypes = { enabled: PropTypes.bool };

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
  const [errorVars, setErrorVars] = useState(null);
  const [creating, setCreating] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [passwordDone, setPasswordDone] = useState(false);

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
    setErrorVars(null);
    try {
      const res = await run();
      if (res && res.success === false) {
        setError(res.error || "");
        setErrorVars(res.vars || null);
      }
      return res;
    } finally {
      setBusy(false);
    }
  };

  // `providers` is read off the live Firebase user every time the status is
  // built, so this flips the moment a password is linked.
  const hasPassword = (status.providers || []).includes("password");

  const dot =
    status.state === "synced"
      ? "bg-emerald-500"
      : status.state === "error"
        ? "bg-red-500"
        : status.state === "off"
          ? "bg-neutral-300 dark:bg-neutral-600"
          : "bg-amber-400";

  return (
    <section className="mb-7">
      <SectionLabel>{t("settings.sync.title")}</SectionLabel>

      <Card className="p-4">
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

            <button
              type="button"
              disabled={busy}
              onClick={() => withBusy(() => ipc?.invoke("sync-retry"))}
              className={`${BTN_GHOST} mt-3 w-full`}
            >
              <RefreshCw size={14} />
              {t("settings.sync.retry")}
            </button>

            {/* Google and email are one account, not two. Somebody who signed
                in with Google and then tried to sign up with a password was
                told the address was taken — which was true and useless. This
                is the way out: put a password on the account that already
                exists, and either button works afterwards. */}
            <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-700">
              {!showPasswordForm ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordForm(true);
                    setError(null);
                    setPasswordDone(false);
                  }}
                  className="btn-tactile w-full cursor-pointer rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 dark:border-neutral-700 dark:text-neutral-200"
                >
                  {hasPassword
                    ? t("auth.changePassword")
                    : t("auth.setPassword")}
                </button>
              ) : (
                <>
                  <p className="mb-3 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                    {hasPassword
                      ? t("auth.changePasswordBlurb")
                      : t("auth.setPasswordBlurb", {
                          email: status.email || "",
                        })}
                  </p>
                  {hasPassword && (
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder={t("auth.currentPassword")}
                      className="mb-2 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-orange-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                    />
                  )}
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t("auth.newPassword")}
                      className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-orange-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                    />
                    <button
                      type="button"
                      disabled={
                        busy ||
                        newPassword.length < 6 ||
                        (hasPassword && !currentPassword)
                      }
                      onClick={async () => {
                        setPasswordDone(false);
                        const res = await withBusy(() =>
                          ipc?.invoke("sync-set-password", {
                            password: newPassword,
                            current: currentPassword,
                          }),
                        );
                        if (res?.success) {
                          setPasswordDone(true);
                          setNewPassword("");
                          setCurrentPassword("");
                          setShowPasswordForm(false);
                        }
                      }}
                      className="btn-tactile shrink-0 cursor-pointer rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-orange-500"
                    >
                      {busy ? t("auth.working") : t("common.save")}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setNewPassword("");
                      setCurrentPassword("");
                      setError(null);
                    }}
                    className="mt-3 w-full cursor-pointer text-center text-xs text-neutral-500 hover:text-orange-500"
                  >
                    {t("common.cancel")}
                  </button>
                </>
              )}
              {passwordDone && (
                <p className="mt-3 text-center text-xs text-emerald-600 dark:text-emerald-400">
                  {t("auth.passwordSaved")}
                </p>
              )}
              {error && (
                <p className="mt-3 text-center text-xs leading-snug text-red-600 dark:text-red-400">
                  {authErrorText(t, error, errorVars)}
                </p>
              )}
            </div>
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
                {authErrorText(t, error, errorVars)}
              </p>
            )}
          </>
        )}
      </Card>
    </section>
  );
}

/**
 * Every failure that was not a known Firebase code came out as "Sign-in failed.
 * Please try again." — including the two that no amount of trying again would
 * fix. Anything unrecognised is shown as it arrived instead: a sentence someone
 * can act on beats a polished dead end.
 */
function authErrorText(t, error, vars) {
  const key = ERROR_KEYS[error];
  if (key) return t(`auth.errors.${key}`, vars || undefined);
  // An unknown auth/* code is Firebase's own, and its raw form means nothing
  // to the person reading it.
  if (/^auth\//.test(error)) return t("auth.errors.generic");
  return error || t("auth.errors.generic");
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
  // Ours, not Firebase's — raised before the browser is ever opened.
  "sync/google-not-configured": "notConfigured",
  "sync/google-init": "googleInit",
  "sync/callback-server-down": "callbackServerDown",
  "sync/no-signin-url": "generic",
  "sync/current-password-needed": "currentPasswordNeeded",
  "sync/no-email": "generic",
  "auth/requires-recent-login": "requiresRecentLogin",
  "auth/provider-already-linked": "providerAlreadyLinked",
  "auth/credential-already-in-use": "credentialInUse",
  "auth/user-token-expired": "requiresRecentLogin",
  "auth/invalid-user-token": "requiresRecentLogin",
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
  initialTab = "general",
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
  const [reporting, setReporting] = useState(false);
  const [recordError, setRecordError] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  // Keyed by name, not by position: deleting a row shortens the array and
  // shifts every later index, which would leave an open editor or an open
  // palette pointing at whichever project slid into that slot.
  const [editingProjectKey, setEditingProjectKey] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [colorPickerKey, setColorPickerKey] = useState(null);

  const [activeTab, setActiveTab] = useState(initialTab);
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
    // Point listeners, because this panel unmounts every time it is closed and
    // App is listening on jira-connected as well: tearing the channel down
    // left App deaf to it for the rest of the session.
    const offs = [
      ipc?.on("google-calendar-connected", refreshGcal),
      ipc?.on("jira-connected", refreshJira),
      ipc?.on("settings-updated", (_, next) => setSettings(next)),
    ];
    return () => offs.forEach((off) => off?.());
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape" && !recording && !reporting) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose, recording, reporting]);

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

  const projects = sortProjects(settings.projects);

  const changeProject = async (operation) => {
    const result = await ipc?.invoke("mutate-project", operation);
    if (!result?.success) {
      onToast?.(result?.error || t("collab.failed"), "error");
      return false;
    }
    setSettings(result.settings);
    onSettingsUpdate?.(result.settings);
    return true;
  };

  const patchProject = (name, patch) => {
    if (typeof patch === "function")
      return changeProject({ type: "favorite", name });
    if (patch.name)
      return changeProject({ type: "rename", name, nextName: patch.name });
    return changeProject({ type: "color", name, color: patch.color });
  };

  const handleAddProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    if (projects.some((p) => p.name === name)) {
      onToast?.(t("settings.projects.exists"), "error");
      return;
    }
    if (await changeProject({ type: "add", name })) setNewProjectName("");
  };

  const tabs = {
    general: {
      label: t("settings.general.appearance"),
      Icon: SunMedium,
      title: t("settings.general.appearance"),
      subtitle: t("settings.design.appearanceHint"),
    },
    account: {
      label: t("settings.design.account"),
      Icon: Cloud,
      title: t("settings.sync.title"),
      subtitle: t("settings.design.accountHint"),
    },
    shortcuts: {
      label: t("settings.general.shortcut"),
      Icon: Keyboard,
      title: t("settings.general.shortcut"),
      subtitle: t("settings.design.shortcutsHint"),
    },
    about: {
      label: t("settings.design.about"),
      Icon: Info,
      title: t("settings.design.about"),
      subtitle: t("settings.design.aboutHint"),
    },
    projects: {
      label: t("settings.tabs.projects"),
      Icon: Hash,
      title: t("settings.projects.title"),
      subtitle: t("settings.subtitles.projects"),
    },
    integrations: {
      label: t("settings.tabs.integrations"),
      Icon: Calendar,
      title: t("settings.integrations.title"),
      subtitle: t("settings.design.integrationsHint"),
    },
    collab: {
      label: t("settings.tabs.collab"),
      Icon: Users,
      title: t("collab.title"),
      subtitle: t("settings.subtitles.collab"),
      // Somebody waiting on an answer is the one thing in this window worth
      // interrupting for, so it carries the same badge the trash does.
      badge: collab.connections.filter((c) => c.status === "incoming").length,
    },
    data: {
      label: t("settings.tabs.data"),
      Icon: Download,
      title: t("settings.data.title"),
      subtitle: t("settings.subtitles.data"),
    },
    trash: {
      label: t("settings.tabs.trash"),
      Icon: Trash2,
      title: t("trash.title"),
      subtitle: tPlural("trash.inTrash", deletedTasks.length),
      badge: deletedTasks.length,
    },
    guide: {
      label: t("settings.tabs.guide"),
      Icon: BookOpen,
      title: t("guide.heading"),
      subtitle: t("settings.subtitles.guide"),
    },
  };

  // Seven flat rows gave no answer to "where would that setting live?". Four
  // named groups do — and they are ordered the way a person meets the app:
  // how it looks and behaves, what it talks to, what it holds, where to read
  // about it.
  const navGroups = [
    { label: t("settings.nav.app"), ids: ["general", "shortcuts", "projects"] },
    {
      label: t("settings.nav.connections"),
      ids: ["account", "collab", "integrations"],
    },
    { label: t("settings.nav.dataGroup"), ids: ["data", "trash"] },
    { label: t("settings.nav.help"), ids: ["guide", "about"] },
  ];

  const current = tabs[activeTab] || tabs.general;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/35 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.title")}
        className="flex h-[700px] max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl sm:flex-row dark:border-neutral-800 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex w-full shrink-0 flex-col border-b border-neutral-200 bg-neutral-50 sm:w-52 sm:border-r sm:border-b-0 dark:border-neutral-800 dark:bg-neutral-950/60">
          <div className="flex items-center gap-2.5 px-5 py-4 sm:py-6">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-300">
              <SunMedium size={15} />
            </div>
            <h2 className="text-[15px] font-bold text-neutral-800 dark:text-neutral-100">
              {t("settings.title")}
            </h2>
          </div>

          <nav
            aria-label={t("settings.title")}
            className="flex gap-2 overflow-x-auto px-3 pb-3 sm:min-h-0 sm:flex-1 sm:flex-col sm:overflow-y-auto sm:px-3"
          >
            {navGroups.map((group) => (
              <div
                key={group.label}
                className="flex shrink-0 gap-1 sm:mb-3 sm:block sm:last:mb-0"
              >
                <div className="hidden px-2.5 pb-2 text-[10.5px] font-medium text-neutral-400 sm:block dark:text-neutral-500">
                  {group.label}
                </div>
                <div className="flex gap-1 sm:block sm:space-y-1">
                  {group.ids.map((id) => {
                    const { label, Icon, badge } = tabs[id];
                    return (
                      <button
                        key={id}
                        title={label}
                        onClick={() => {
                          setRecording(false);
                          setActiveTab(id);
                        }}
                        aria-current={activeTab === id ? "page" : undefined}
                        className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors ${
                          activeTab === id
                            ? "bg-orange-500/10 text-orange-700 dark:text-orange-300"
                            : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
                        }`}
                      >
                        <Icon
                          size={15}
                          className="shrink-0"
                          strokeWidth={activeTab === id ? 2.5 : 2}
                        />
                        <span className="sm:min-w-0 sm:text-left sm:leading-snug sm:whitespace-normal">
                          {label}
                        </span>
                        {badge > 0 && (
                          <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-100 px-1 text-[10.5px] font-semibold text-red-500 dark:bg-red-500/10">
                            {badge > 99 ? "99+" : badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="hidden shrink-0 border-t border-neutral-200/70 px-5 py-4 text-[11px] text-neutral-400 sm:block dark:border-neutral-800">
            Stepler <span className="float-right tabular-nums">{version}</span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Where you are stays on screen. Scrolling a long tab used to take
              its own title away with it. */}
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200/70 px-6 py-5 dark:border-neutral-800">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                {current.title}
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                {current.subtitle}
              </p>
            </div>
            <button
              type="button"
              autoFocus
              onClick={onClose}
              aria-label={t("common.close")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <X size={18} />
            </button>
          </header>

          <div
            key={activeTab}
            className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-6"
          >
            {activeTab === "account" && <SyncSection />}
            {activeTab === "about" && (
              <div className="space-y-5">
                <UpdateCorner onRevealed={onToast} />
                <Row
                  icon={<Bug size={18} />}
                  title={t("report.title")}
                  action={
                    <button
                      type="button"
                      onClick={() => setReporting(true)}
                      className={BTN_GHOST}
                    >
                      {t("report.title")}
                    </button>
                  }
                />
              </div>
            )}
            {activeTab === "general" && (
              <div>
                {/* Theme and language are the same kind of choice — three
                    tiles, pick one — so they are drawn at the same size and
                    sit side by side rather than stacked down the page. */}
                <div className="space-y-8">
                  <section>
                    <SectionLabel>
                      {t("settings.general.appearance")}
                    </SectionLabel>
                    <div className="grid grid-cols-3 gap-2">
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
                        <Choice
                          key={value}
                          Icon={Icon}
                          label={label}
                          selected={settings.theme === value}
                          onClick={() => updateSetting({ theme: value })}
                        />
                      ))}
                    </div>
                  </section>

                  <section>
                    <SectionLabel>
                      {t("settings.general.language")}
                    </SectionLabel>
                    <div className="grid grid-cols-3 gap-2">
                      {LANGUAGES.map(({ code, native }) => (
                        <Choice
                          key={code}
                          Icon={Languages}
                          label={native}
                          selected={language === code}
                          onClick={() => {
                            setLanguage(code);
                            updateSetting({ language: code });
                          }}
                        />
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            )}
            {activeTab === "shortcuts" && (
              <div>
                {/* Every key the app answers to, in one place. Only the first
                    is yours to change; the other three are fixed, and a person
                    who never opens a menu would otherwise never learn them. */}
                <section className="mb-7">
                  <SectionLabel>{t("settings.general.shortcut")}</SectionLabel>

                  {recording ? (
                    <div
                      ref={recorderRef}
                      tabIndex={0}
                      onKeyDown={handleKeyCapture}
                      onBlur={() => setRecording(false)}
                      className="flex h-[92px] items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-white text-[13px] text-neutral-500 outline-none dark:border-neutral-600 dark:bg-neutral-900"
                    >
                      <span className="animate-pulse font-medium">
                        {t("settings.general.recording")}
                      </span>
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      <KeyCard
                        combo={formatAcceleratorForDisplay(settings.hotkey)}
                        caption={t("settings.general.keyGlobal")}
                        action={t("settings.general.change")}
                        onClick={() => {
                          setRecordError("");
                          setRecording(true);
                        }}
                      />
                      <KeyCard
                        combo={formatAcceleratorForDisplay("CmdOrCtrl+N")}
                        caption={t("settings.general.keyNew")}
                      />
                      <KeyCard
                        combo={formatAcceleratorForDisplay("CmdOrCtrl+F")}
                        caption={t("settings.general.keyFind")}
                      />
                      <KeyCard
                        combo="Esc"
                        caption={t("settings.general.keyEsc")}
                      />
                    </div>
                  )}

                  {/* The one thing about the global shortcut nobody discovers
                      on their own, and the reason it is worth having. */}
                  {isMac && settings.captureSelection !== false && (
                    <Card className="mt-2 flex items-start gap-2.5 px-4 py-3">
                      <TextCursorInput
                        size={15}
                        className="mt-0.5 shrink-0 text-neutral-400"
                      />
                      <p className="text-[12.5px] leading-snug text-neutral-600 dark:text-neutral-300">
                        {t("settings.general.keySelection")}
                      </p>
                    </Card>
                  )}

                  {/* Only when a recording went wrong. The cards already say
                      what each key does, so there is nothing else to add. */}
                  {recordError && (
                    <p className="mt-2 text-[12.5px] leading-snug text-red-500">
                      {recordError}
                    </p>
                  )}
                </section>

                <section>
                  <SectionLabel>{t("settings.general.behaviour")}</SectionLabel>
                  <div className="space-y-2">
                    {isMac && (
                      <Row
                        title={t("settings.general.captureSelection")}
                        hint={t("settings.general.captureSelectionHint")}
                        action={
                          <Toggle
                            on={settings.captureSelection !== false}
                            label={t("settings.general.captureSelection")}
                            onClick={() =>
                              updateSetting({
                                captureSelection:
                                  settings.captureSelection === false,
                              })
                            }
                          />
                        }
                      />
                    )}

                    <Row
                      title={t("settings.general.escToHide")}
                      hint={t("settings.general.escToHideHint")}
                      action={
                        <Toggle
                          on={!!settings.escToHide}
                          label={t("settings.general.escToHide")}
                          onClick={() =>
                            updateSetting({ escToHide: !settings.escToHide })
                          }
                        />
                      }
                    />
                  </div>
                </section>
              </div>
            )}

            {activeTab === "projects" && (
              <div>
                <div className="mb-5 flex gap-2">
                  <input
                    type="text"
                    placeholder={t("settings.projects.placeholder")}
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddProject()}
                    className={`${INPUT} flex-1`}
                  />
                  <button
                    onClick={handleAddProject}
                    disabled={!newProjectName.trim()}
                    className={BTN}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <div data-project-list="settings" className="space-y-2">
                  {projects.length === 0 && (
                    <p className="text-[13px] text-neutral-400">
                      {t("settings.projects.empty")}
                    </p>
                  )}
                  {projects.map((project) => {
                    const name = projectName(project);
                    const favorite =
                      typeof project === "object" && project.isFavorite;
                    const colour = colorForLabel(name, projects);
                    return (
                      <div
                        key={name}
                        data-project-name={name}
                        className="group rounded-xl border border-neutral-200/80 bg-neutral-50/60 px-3.5 py-2.5 transition-colors hover:border-neutral-300 hover:bg-white dark:border-neutral-800 dark:bg-neutral-800/30"
                      >
                        <div className="flex items-center justify-between">
                          {editingProjectKey === name ? (
                            <div className="flex flex-1 items-center gap-2">
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
                                    if (next)
                                      patchProject(name, { name: next });
                                    setEditingProjectKey(null);
                                  }
                                  if (e.key === "Escape")
                                    setEditingProjectKey(null);
                                }}
                                className="flex-1 bg-transparent text-[13.5px] font-semibold text-neutral-800 outline-none dark:text-neutral-100"
                              />
                              <button
                                onClick={() => {
                                  const next = editingProjectName.trim();
                                  if (next) patchProject(name, { name: next });
                                  setEditingProjectKey(null);
                                }}
                                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-900/30"
                              >
                                <Check size={15} />
                              </button>
                              <button
                                onClick={() => setEditingProjectKey(null)}
                                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                              >
                                <X size={15} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-3">
                                {/* The square was decoration; now it is the
                                  colour this label wears everywhere, and
                                  clicking it is how you change that. */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setColorPickerKey(
                                      colorPickerKey === name ? null : name,
                                    )
                                  }
                                  style={labelStyle(colour)}
                                  title={t("settings.projects.color")}
                                  aria-label={t("settings.projects.color")}
                                  className="label-chip flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg shadow-sm"
                                >
                                  <Hash size={15} />
                                </button>
                                <span className="text-[13.5px] font-semibold text-neutral-800 dark:text-neutral-100">
                                  {name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                  onClick={() => {
                                    patchProject(name, (live) => ({
                                      isFavorite: !live.isFavorite,
                                    }));
                                  }}
                                  className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors ${
                                    favorite
                                      ? "bg-amber-50 text-amber-500 dark:bg-amber-900/20"
                                      : "text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                  }`}
                                  title={t("settings.projects.pin")}
                                >
                                  <Star
                                    size={15}
                                    fill={favorite ? "currentColor" : "none"}
                                  />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingProjectKey(name);
                                    setEditingProjectName(name);
                                  }}
                                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                  title={t("settings.projects.rename")}
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  onClick={() =>
                                    changeProject({ type: "remove", name })
                                  }
                                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                                  title={t("settings.projects.removeSaved")}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>

                        {/* The palette opens UNDER the row rather than as a
                            popover over it. The settings body scrolls, and an
                            absolutely positioned menu is painted inside that
                            scroller — z-index does not lift anything out of an
                            overflow box, so the picker on the lower rows would
                            simply have been cut off. */}
                        {colorPickerKey === name && (
                          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-neutral-200/70 pt-2.5 dark:border-neutral-700/60">
                            {LABEL_COLORS.map((swatch) => (
                              <button
                                key={swatch}
                                type="button"
                                onClick={() => {
                                  patchProject(name, { color: swatch });
                                  setColorPickerKey(null);
                                }}
                                style={labelStyle(swatch)}
                                className={`label-dot h-5 w-5 cursor-pointer rounded-full transition-transform hover:scale-110 ${
                                  swatch.toLowerCase() === colour.toLowerCase()
                                    ? "ring-2 ring-neutral-900 ring-offset-2 dark:ring-neutral-100 dark:ring-offset-neutral-800"
                                    : ""
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "integrations" && (
              <div className="space-y-2">
                {/* Google Calendar */}
                <Row
                  icon={<Calendar size={18} className="text-[#4285F4]" />}
                  title="Google Calendar"
                  hint={
                    !gcalStatus.configured
                      ? t("settings.integrations.gcalNeedsCreds")
                      : gcalStatus.connected
                        ? gcalStatus.email ||
                          t("settings.integrations.gcalConnected")
                        : t("settings.integrations.gcalBlurb")
                  }
                  action={
                    gcalStatus.connected ? (
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
                        className="cursor-pointer rounded-lg px-3 py-2 text-[13px] font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/10"
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
                        className={BTN}
                      >
                        {t("common.connect")}
                      </button>
                    )
                  }
                >
                  {!gcalStatus.configured && (
                    <details className="mt-3 border-t border-neutral-200/80 pt-3 dark:border-neutral-700/50">
                      <summary className="cursor-pointer text-[12px] font-medium text-orange-600 dark:text-orange-300">
                        {t("settings.design.setup")}
                      </summary>
                      <div className="pt-3">
                        <div className="text-[12.5px] leading-snug text-neutral-500 dark:text-neutral-400">
                          {t("settings.integrations.gcalCredsBefore")}{" "}
                          <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11.5px] dark:bg-neutral-800">
                            stepler-integrations.json
                          </code>{" "}
                          {t("settings.integrations.gcalCredsAfter")}
                        </div>
                        <div className="mt-2.5 flex gap-2">
                          <button
                            onClick={() => ipc?.invoke("open-data-folder")}
                            className={BTN_GHOST}
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
                            className={BTN_GHOST}
                          >
                            {t("settings.integrations.setupGuide")}
                          </button>
                        </div>
                      </div>
                    </details>
                  )}
                  {gcalStatus.connected && (
                    <div className="mt-3.5 flex items-center justify-between gap-4 border-t border-neutral-200/80 pt-3.5 dark:border-neutral-700/50">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">
                          {t("settings.integrations.autoEvents")}
                        </div>
                        <div className="mt-0.5 text-[12.5px] leading-snug text-neutral-500 dark:text-neutral-400">
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
                </Row>

                {/* Jira */}
                <Row
                  icon={
                    <span className="flex h-full w-full items-center justify-center rounded-lg bg-[#0052CC] text-[15px] font-black text-white">
                      J
                    </span>
                  }
                  title="Jira"
                  hint={
                    jiraStatus.connected
                      ? jiraStatus.site
                        ? `${jiraStatus.email} at ${jiraStatus.site.replace(/^https:\/\//, "")}`
                        : t("settings.integrations.gcalConnected")
                      : t("settings.integrations.jiraBlurb")
                  }
                  action={
                    jiraStatus.connected ? (
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
                        className="cursor-pointer rounded-lg px-3 py-2 text-[13px] font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/10"
                      >
                        {t("common.disconnect")}
                      </button>
                    ) : null
                  }
                >
                  {!jiraStatus.connected && (
                    <details className="mt-3 border-t border-neutral-200/80 pt-3 dark:border-neutral-700/50">
                      <summary className="cursor-pointer text-[12px] font-medium text-orange-600 dark:text-orange-300">
                        {t("settings.design.setup")}
                      </summary>
                      <div className="pt-3">
                        <div className="text-[12.5px] leading-snug text-neutral-500 dark:text-neutral-400">
                          {t("settings.integrations.jiraNote")}
                        </div>

                        <div className="mt-3 grid gap-2">
                          <input
                            value={jiraForm.siteUrl}
                            onChange={(e) =>
                              setJiraForm((f) => ({
                                ...f,
                                siteUrl: e.target.value,
                              }))
                            }
                            placeholder="your-team.atlassian.net"
                            className={INPUT}
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
                            className={INPUT}
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
                            className={INPUT}
                          />
                        </div>

                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
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
                                    t(
                                      "settings.integrations.jiraConnectFailed",
                                    ),
                                  "error",
                                );
                              }
                            }}
                            disabled={jiraBusy}
                            className={BTN}
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
                            className={BTN_GHOST}
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
                              className={BTN_GHOST}
                            >
                              {t("settings.integrations.jiraUseOauth")}
                            </button>
                          )}
                        </div>
                      </div>
                    </details>
                  )}
                </Row>

                {/* Apple Reminders */}
                {isMac && (
                  <Row
                    icon={<Calendar size={18} className="text-[#FF3B30]" />}
                    title="Apple Reminders"
                    hint={t("settings.integrations.remindersBlurb")}
                    action={
                      <Toggle
                        on={!!settings.appleReminders}
                        label="Apple Reminders"
                        onClick={() =>
                          updateSetting({
                            appleReminders: !settings.appleReminders,
                          })
                        }
                      />
                    }
                  />
                )}

                <details className="pt-4">
                  <summary className="cursor-pointer py-2 text-[13px] font-semibold text-neutral-500">
                    {t("settings.design.advanced")}
                  </summary>
                  <div className="mt-3 space-y-3">
                    <Row
                      icon={<Terminal size={17} className="text-neutral-500" />}
                      title={t("settings.integrations.cli")}
                      hint={t("settings.integrations.cliBlurb")}
                      action={
                        <Toggle
                          on={!!settings.apiEnabled}
                          label={t("settings.integrations.cli")}
                          onClick={async () => {
                            await updateSetting({
                              apiEnabled: !settings.apiEnabled,
                            });
                          }}
                        />
                      }
                    />

                    <AgentSetup enabled={!!settings.apiEnabled} />
                  </div>
                </details>
              </div>
            )}

            {activeTab === "collab" && (
              <div>
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
                <div className="space-y-2">
                  <Row
                    icon={<Download size={17} className="text-neutral-500" />}
                    title={t("settings.data.export")}
                    hint={t("settings.data.exportBlurb")}
                    action={
                      <button onClick={onExport} className={BTN}>
                        {t("settings.data.export")}
                      </button>
                    }
                  />
                  <Row
                    icon={<Upload size={17} className="text-neutral-500" />}
                    title={t("settings.data.import")}
                    hint={t("settings.data.importBlurb")}
                    action={
                      <button onClick={onImport} className={BTN_GHOST}>
                        {t("settings.data.import")}
                      </button>
                    }
                  />
                  <Row
                    icon={<FolderOpen size={17} className="text-neutral-500" />}
                    title={t("settings.data.folder")}
                    hint={t("settings.data.backupNote")}
                    action={
                      <button
                        onClick={() => ipc?.invoke("open-data-folder")}
                        className={BTN_GHOST}
                      >
                        {t("settings.integrations.openDataFolder")}
                      </button>
                    }
                  />
                </div>
              </div>
            )}

            {activeTab === "trash" && (
              <DeletedTasksList
                deletedTasks={deletedTasks}
                onRestore={onRestore}
                onPermanentDelete={onPermanentDelete}
                onClearAll={onClearAll}
              />
            )}
          </div>
        </div>
      </div>
      {reporting && <IssueReportModal onClose={() => setReporting(false)} />}
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
  initialTab: PropTypes.string,
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
