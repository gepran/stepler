import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Check, LogOut, Star, Trash2 } from "lucide-react";
import { auth } from "./firebase";
import {
  addTask,
  deleteTask,
  setCompleted,
  setPriority,
  subscribeTasks,
} from "./store";
import AuthScreen from "./AuthScreen";
import SteplerLogo from "../renderer/src/components/SteplerLogo";
import {
  formatTaskText,
  labelForYMD,
  localYMD,
  taskTimestamp,
} from "../renderer/src/lib/format";
import {
  LANGUAGES,
  setLanguage,
  useLanguage,
  useT,
} from "../renderer/src/lib/i18n";

/**
 * A task belongs to the day it was written on and stays there — the same rule
 * the desktop app follows, derived from the timestamp baked into the id, so
 * both clients group an identical list identically.
 */
function groupByDay(tasks, todayYMD) {
  const byDay = new Map();
  for (const task of tasks) {
    const stamp = taskTimestamp(task.id);
    let ymd = task.ymd || (stamp ? localYMD(stamp) : todayYMD);
    if (ymd > todayYMD) ymd = todayYMD; // clock skew should not invent a future
    if (!byDay.has(ymd)) byDay.set(ymd, []);
    byDay.get(ymd).push(task);
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([ymd, list]) => ({ ymd, tasks: orderWithin(list) }));
}

const orderWithin = (list) =>
  [...list].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? -1 : 1;
    if (!!a.priority !== !!b.priority) return a.priority ? 1 : -1;
    return Number(a.id) - Number(b.id);
  });

function TaskRow({ task, uid }) {
  const t = useT();
  return (
    <div className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-neutral-100/70 dark:hover:bg-neutral-800/50">
      <button
        type="button"
        title={task.completed ? t("task.markNotDone") : t("task.markDone")}
        onClick={() => setCompleted(uid, task.id, !task.completed)}
        className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-md border transition-all ${
          task.completed
            ? "border-orange-500 bg-orange-500 text-white"
            : "border-neutral-300 hover:border-orange-400 dark:border-neutral-600"
        }`}
      >
        {task.completed && <Check size={12} strokeWidth={3.5} />}
      </button>

      <div
        className={`min-w-0 flex-1 whitespace-pre-wrap break-words text-[14px] leading-relaxed ${
          task.completed
            ? "text-neutral-400 line-through dark:text-neutral-600"
            : "text-neutral-800 dark:text-neutral-100"
        }`}
      >
        {formatTaskText(task.text)}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          title={t("task.priority")}
          onClick={() => setPriority(uid, task.id, !task.priority)}
          className={`cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700 ${
            task.priority
              ? "text-orange-500"
              : "text-neutral-400 dark:text-neutral-500"
          }`}
        >
          <Star size={14} fill={task.priority ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          title={t("task.remove")}
          onClick={() => deleteTask(uid, task.id)}
          className="cursor-pointer rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-neutral-500 dark:hover:bg-red-950/40"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

TaskRow.propTypes = {
  task: PropTypes.shape({
    id: PropTypes.string.isRequired,
    text: PropTypes.string,
    completed: PropTypes.bool,
    priority: PropTypes.bool,
  }).isRequired,
  uid: PropTypes.string.isRequired,
};

function Timeline({ uid }) {
  const t = useT();
  // Subscribing to the language re-renders the day headings, which are
  // formatted at render time rather than stored on the grouped rows.
  useLanguage();
  const [tasks, setTasks] = useState([]);
  const [trashCount, setTrashCount] = useState(0);
  const [fromCache, setFromCache] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef(null);
  const todayYMD = localYMD(new Date());

  useEffect(() => {
    const stop = subscribeTasks(
      uid,
      ({ tasks: active, deletedTasks, fromCache: cached }) => {
        setTasks(active);
        setTrashCount(deletedTasks.length);
        setFromCache(cached);
        setReady(true);
        setError(null);
      },
      (err) => {
        console.error("Task subscription failed:", err.code, err.message);
        setError(err.message);
        setReady(true);
      },
    );
    return stop;
  }, [uid]);

  const days = useMemo(() => groupByDay(tasks, todayYMD), [tasks, todayYMD]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [days.length]);

  const submit = useCallback(
    async (e) => {
      e.preventDefault();
      const text = draft.trim();
      if (!text) return;
      setDraft("");
      try {
        await addTask(uid, text);
      } catch (err) {
        console.error("Could not add the task:", err.code, err.message);
        setError(err.message);
        setDraft(text); // hand the words back rather than losing them
      }
    },
    [draft, uid],
  );

  const doneToday =
    days.find((d) => d.ymd === todayYMD)?.tasks.filter((x) => x.completed)
      .length ?? 0;
  const totalToday = days.find((d) => d.ymd === todayYMD)?.tasks.length ?? 0;

  return (
    <>
      <div className="mx-auto w-full max-w-[720px] flex-1 overflow-y-auto px-5 pb-6 pt-4">
        {!ready && (
          <p className="py-16 text-center text-sm text-neutral-400">
            {t("auth.working")}
          </p>
        )}

        {ready && error && (
          <p
            role="alert"
            className="my-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </p>
        )}

        {ready && !error && days.length === 0 && (
          <p className="py-16 text-center text-sm text-neutral-400 dark:text-neutral-500">
            {t("app.nothingToday")}
          </p>
        )}

        {days.map((day) => (
          <section key={day.ymd} className="mb-6">
            <h2 className="sticky top-0 z-10 mb-1 bg-neutral-50/90 py-1.5 text-[11px] font-bold uppercase tracking-widest text-neutral-400 backdrop-blur dark:bg-neutral-950/90 dark:text-neutral-500">
              {day.ymd === todayYMD ? t("app.today") : labelForYMD(day.ymd)}
            </h2>
            {day.tasks.map((task) => (
              <TaskRow key={task.id} task={task} uid={uid} />
            ))}
          </section>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* The inline padding keeps the composer clear of the iPhone home
          indicator, and resolves to zero anywhere without an inset. */}
      <div
        className="shrink-0 border-t border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <form
          onSubmit={submit}
          className="mx-auto flex w-full max-w-[720px] items-center gap-2 px-4 py-3 sm:px-5"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            // Implicit form submission on Enter is not reliable here, and
            // typing a line then pressing Enter is how the desktop app is
            // used — so the key is handled outright rather than hoped for.
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                submit(e);
              }
            }}
            placeholder={t("input.prompt")}
            aria-label={t("input.addTask")}
            className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-orange-400 focus:bg-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-orange-500/60"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="cursor-pointer rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-orange-500 dark:hover:bg-orange-400"
          >
            {t("input.addTask")}
          </button>
        </form>
        <div className="mx-auto flex w-full max-w-[720px] items-center justify-between px-5 pb-2.5 text-[11px] text-neutral-400 dark:text-neutral-500">
          <span>
            {t("app.counter", { done: doneToday, total: totalToday })}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                fromCache ? "bg-amber-400" : "bg-emerald-500"
              }`}
            />
            {fromCache ? t("auth.offline") : t("auth.synced")}
            {trashCount > 0 && ` · ${t("trash.title")}: ${trashCount}`}
          </span>
        </div>
      </div>
    </>
  );
}

Timeline.propTypes = { uid: PropTypes.string.isRequired };

/**
 * The account, as a round avatar in the corner — where every other app puts it.
 * The email used to sit spelled out in the bar, which on a phone squeezed the
 * title until neither was readable; behind the avatar it costs no width and is
 * still one tap away.
 */
function UserMenu({ user, onSignOut, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const label = user.email || user.displayName || user.uid;
  // Google gives a photo; email/password accounts get their first letter.
  const initial = (user.displayName || user.email || "?").trim()[0] || "?";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        className="flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-100 text-[13px] font-bold uppercase text-neutral-600 transition-shadow hover:shadow-md dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-30 w-60 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        >
          <p className="truncate border-b border-neutral-100 px-4 py-3 text-[13px] text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
            {label}
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-left text-[13px] text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <LogOut size={15} />
            {t("auth.signOut")}
          </button>
        </div>
      )}
    </div>
  );
}

UserMenu.propTypes = {
  user: PropTypes.shape({
    email: PropTypes.string,
    displayName: PropTypes.string,
    photoURL: PropTypes.string,
    uid: PropTypes.string,
  }).isRequired,
  onSignOut: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
};

export default function App() {
  const t = useT();
  const language = useLanguage();
  const [user, setUser] = useState(undefined); // undefined = still deciding

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <SteplerLogo size={40} className="animate-pulse" />
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  return (
    // `dvh`, not `vh`. On a phone `100vh` is the height with the browser's
    // address bar hidden, so a full-height column overflows the part you can
    // actually see — and with the body set to overflow:hidden there is no way
    // to scroll down to what fell off. The composer at the bottom was the
    // casualty. `dvh` tracks the visible viewport as the chrome comes and goes.
    <div className="flex h-dvh flex-col bg-neutral-50 dark:bg-neutral-950">
      <header
        className="shrink-0 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-14 w-full max-w-[720px] items-center gap-3 px-4 sm:px-5">
          <SteplerLogo size={26} />
          <span className="text-[16px] font-black tracking-tight text-neutral-900 dark:text-neutral-50">
            Stepler
          </span>

          <div className="ml-auto flex items-center gap-2">
            <select
              aria-label="Language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="cursor-pointer rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-[12px] text-neutral-600 outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.native}
                </option>
              ))}
            </select>
            <UserMenu user={user} onSignOut={() => signOut(auth)} t={t} />
          </div>
        </div>
      </header>

      <Timeline uid={user.uid} />
    </div>
  );
}
