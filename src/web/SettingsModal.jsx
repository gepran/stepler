import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  ArrowUpCircle,
  LogOut,
  Monitor,
  Moon,
  RefreshCw,
  RotateCcw,
  SunMedium,
  X,
} from "lucide-react";
import { restoreTask, subscribeTasks } from "./store";
import CollaborationPanel from "../renderer/src/components/CollaborationPanel";
import {
  acceptInvite,
  removeConnection,
  searchProfiles,
  sendInvite,
} from "./collab";
import { THEMES, setTheme, useTheme } from "./theme";
import { applyUpdate, checkForUpdate } from "./update";
import {
  LANGUAGES,
  setLanguage,
  translatePlural,
  useLanguage,
  useT,
} from "../renderer/src/lib/i18n";

// Borrowed from the timeline's old day heading, which grew up into a real
// heading — the small-caps label still belongs on a settings section.
const THEME_ICONS = { light: SunMedium, dark: Moon, system: Monitor };

const HEADING =
  "mb-2 text-[11px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500";

/**
 * Everything the web app can actually change, in one sheet: the account, the
 * language, and the trash. The desktop settings window is far larger because
 * it owns a file, a global hotkey and a menu bar; a browser tab owns none of
 * those, so offering them here would be offering buttons that do nothing.
 *
 * A sheet from the bottom on a phone, a centred card from `sm` up.
 */
export default function SettingsModal({ user, collab, onClose, onSignOut }) {
  const t = useT();
  const language = useLanguage();
  const theme = useTheme();
  const [deleted, setDeleted] = useState([]);
  const [notice, setNotice] = useState(null);
  // idle → checking → current | available | failed
  const [update, setUpdate] = useState("idle");

  // `me` is the card other people are shown when this account invites them,
  // so it carries the handle as well as the account.
  const me = useMemo(
    () => ({ ...(collab.profile || {}), uid: user.uid, email: user.email }),
    [collab.profile, user.uid, user.email],
  );

  const search = useCallback(
    (term) => searchProfiles(term, { self: user.uid }),
    [user.uid],
  );
  const invite = useCallback((person) => sendInvite(me, person), [me]);
  const accept = useCallback((person) => acceptInvite(me, person), [me]);
  const remove = useCallback((uid) => removeConnection(me, uid), [me]);

  // A sheet has no toast layer of its own, so a one-line note under the
  // heading is where an action reports what it did.
  const toast = useCallback((text) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 2600);
  }, []);

  // Escape closes it, the same contract the account menu already has, so the
  // two overlays in this app cannot behave differently.
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  // Its own subscription rather than a list handed down from the timeline.
  // Firestore keeps one listen per collection however many callers attach to
  // it, so the second subscriber costs nothing on the wire and this file stays
  // something you can read on its own.
  useEffect(() => {
    const stop = subscribeTasks(
      user.uid,
      ({ deletedTasks }) => setDeleted(deletedTasks),
      (err) =>
        console.error("Trash subscription failed:", err.code, err.message),
    );
    return stop;
  }, [user.uid]);

  // Newest first: the id is the millisecond the task was written, so it sorts
  // without a second field.
  const trash = [...deleted].sort((a, b) => Number(b.id) - Number(a.id));

  return (
    // `h-dvh`, not `inset-0`. On a phone the browser's toolbar covers the
    // bottom of `100vh`, and the bottom of this sheet is exactly where its
    // last row and the version line sit — the same trap the composer bar
    // documents.
    <div
      className="fixed inset-x-0 top-0 z-40 flex h-dvh items-end justify-center bg-neutral-950/40 backdrop-blur-sm sm:items-center"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.title")}
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-neutral-200 bg-white shadow-xl sm:max-h-[80dvh] sm:max-w-[440px] sm:rounded-2xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
          <h2 className="text-[15px] font-black tracking-tight text-neutral-900 dark:text-neutral-50">
            {t("settings.title")}
          </h2>
          {/* Focused on open, so Escape and Tab both start inside the dialog. */}
          <button
            type="button"
            autoFocus
            onClick={onClose}
            title={t("common.close")}
            aria-label={t("common.close")}
            className="cursor-pointer rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* The inline padding keeps the last row clear of the iPhone home
            indicator, and resolves to zero anywhere without an inset. */}
        <div
          className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-5 py-5"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
        >
          <section>
            <h3 className={HEADING}>{t("settings.sync.title")}</h3>
            <div className="flex items-center gap-3 rounded-xl border border-neutral-200 px-3.5 py-3 dark:border-neutral-800">
              <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-700 dark:text-neutral-200">
                {user.email || user.displayName || user.uid}
              </span>
              <button
                type="button"
                onClick={onSignOut}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-2 text-[12px] font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-red-600 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-red-400"
              >
                <LogOut size={13} />
                {t("auth.signOut")}
              </button>
            </div>
          </section>

          <section>
            <h3 className={HEADING}>{t("settings.general.language")}</h3>
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLanguage(l.code)}
                  className={`cursor-pointer rounded-xl border px-2 py-2.5 text-[13px] font-medium transition-colors ${
                    language === l.code
                      ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                      : "border-neutral-200 text-neutral-600 hover:border-neutral-300 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-neutral-700"
                  }`}
                >
                  {l.native}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className={HEADING}>{t("collab.title")}</h3>
            {notice && (
              <p className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {notice}
              </p>
            )}
            <CollaborationPanel
              compact
              profile={collab.profile}
              connections={collab.connections}
              onSearch={search}
              onInvite={invite}
              onAccept={accept}
              onRemove={remove}
              onToast={toast}
            />
          </section>

          {/* This used to be a read-only line saying the browser decides.
              Tailwind's `dark:` now answers to an attribute this app writes
              (see theme.js), so there is a real choice to offer. */}
          <section>
            <h3 className={HEADING}>{t("settings.general.appearance")}</h3>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((mode) => {
                const Icon = THEME_ICONS[mode];
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTheme(mode)}
                    className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[13px] font-medium transition-colors ${
                      theme === mode
                        ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                        : "border-neutral-200 text-neutral-600 hover:border-neutral-300 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-neutral-700"
                    }`}
                  >
                    <Icon size={14} />
                    {t(`settings.general.${mode}`)}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className={HEADING}>{t("trash.title")}</h3>
            {trash.length === 0 ? (
              <p className="rounded-xl border border-dashed border-neutral-200 px-3.5 py-6 text-center text-[13px] text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
                {t("trash.empty")}
              </p>
            ) : (
              <>
                <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
                  {/* The raw text, not formatTaskText: a task holding a code
                      fence renders as a whole syntax-highlighted block, which
                      is not what belongs on one line of a trash list. */}
                  {trash.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 border-b border-neutral-100 px-3.5 py-2.5 last:border-b-0 dark:border-neutral-800/70"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-500 dark:text-neutral-400">
                        {task.text}
                      </span>
                      <button
                        type="button"
                        title={t("trash.restore")}
                        aria-label={t("trash.restore")}
                        onClick={() => restoreTask(user.uid, task.id)}
                        className="shrink-0 cursor-pointer rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                      >
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                {/* Restore only, deliberately. Emptying the trash for good has
                    to happen on the desktop: a pull never removes a task the
                    cloud has not heard of, so a computer that still holds this
                    one would push it straight back and the button would have
                    lied. */}
                <p className="mt-2 text-[11px] text-neutral-400 dark:text-neutral-500">
                  {translatePlural("trash.inTrash", deleted.length)}
                </p>
              </>
            )}
          </section>

          {/* Which build this tab is running, and whether the server has a
              newer one. A browser tab has no updater, so the check is a real
              comparison rather than a Reload button wearing a hopeful label —
              see update.js. */}
          <div className="flex items-center gap-3 rounded-xl border border-neutral-200 px-3.5 py-2.5 dark:border-neutral-800">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-neutral-700 dark:text-neutral-200">
                {t("update.version", {
                  version: import.meta.env.VITE_APP_VERSION,
                })}
              </p>
              <p
                className={`truncate text-[11.5px] ${
                  update === "available"
                    ? "font-medium text-orange-600 dark:text-orange-400"
                    : "text-neutral-400 dark:text-neutral-500"
                }`}
              >
                {update === "checking"
                  ? t("update.checking")
                  : update === "available"
                    ? t("update.newAvailable")
                    : update === "current"
                      ? t("update.upToDate")
                      : update === "failed"
                        ? t("update.unknownError")
                        : t("auth.tagline")}
              </p>
            </div>
            <button
              type="button"
              disabled={update === "checking"}
              onClick={
                update === "available"
                  ? applyUpdate
                  : async () => {
                      setUpdate("checking");
                      try {
                        const { available } = await checkForUpdate();
                        setUpdate(available ? "available" : "current");
                      } catch (err) {
                        console.warn("Update check failed:", err.message);
                        setUpdate("failed");
                      }
                    }
              }
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors disabled:cursor-default disabled:opacity-60 ${
                update === "available"
                  ? "bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-orange-500 dark:hover:bg-orange-400"
                  : "border border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              {update === "available" ? (
                <ArrowUpCircle size={14} />
              ) : (
                <RefreshCw
                  size={14}
                  className={update === "checking" ? "animate-spin" : ""}
                />
              )}
              {update === "available"
                ? t("update.update")
                : t("update.checkNow")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

SettingsModal.propTypes = {
  user: PropTypes.shape({
    uid: PropTypes.string.isRequired,
    email: PropTypes.string,
    displayName: PropTypes.string,
  }).isRequired,
  collab: PropTypes.shape({
    profile: PropTypes.object,
    connections: PropTypes.array.isRequired,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  onSignOut: PropTypes.func.isRequired,
};
