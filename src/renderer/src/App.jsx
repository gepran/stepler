import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import PropTypes from "prop-types";
import Sidebar from "./components/Sidebar";
import UpdatePill from "./components/UpdatePill";
import ParticleCanvas from "./components/ParticleCanvas";
import SettingsPanel from "./components/SettingsPanel";
import FullScreenSearch from "./components/FullScreenSearch";
import TaskItem from "./components/TaskItem";
import TaskInput from "./components/TaskInput";
import FilePreviewModal from "./components/FilePreviewModal";
import Toasts from "./components/Toasts";
import { PanelLeft, ChevronDown } from "lucide-react";
import { localYMD, labelForYMD, taskTimestamp, ymdToDate } from "./lib/format";
import { newTaskId } from "./lib/ids";
import { ipc, persistAttachment } from "./lib/attachments";
import { useCollab } from "./lib/collab-ipc";
import { MentionBadge, MentionTaskItem } from "./components/MentionTaskItem";
import { mentionsAsRows } from "./lib/collab";
import {
  formatDate,
  getLanguage,
  setLanguage,
  translatePlural as tPlural,
  useLanguage,
  useT,
} from "./lib/i18n";

// --------------------------------------------------------------------------
// Day bookkeeping. Days are keyed by a real ISO date rather than a "21 Feb"
// label, so history cannot collide across years and a task can only ever land
// in one bucket.
// --------------------------------------------------------------------------

/** Stored data keeps today and past days apart; in memory it is one list. */
function flattenStored(data) {
  const seen = new Set();
  const out = [];
  const push = (t) => {
    if (!t || seen.has(t.id)) return;
    // A row carrying `mention` is somebody else's task that a bug once wrote
    // into this file. Dropping it on the way in is what lets an already
    // polluted file clean itself up on the next save, without a migration.
    if (t.mention) return;
    seen.add(t.id);
    out.push(t);
  };
  (data?.tasks || []).forEach(push);
  (data?.history || []).forEach((day) => (day?.tasks || []).forEach(push));
  return out;
}

/**
 * A task belongs to the day it was written on and stays there. Days without
 * tasks simply do not exist.
 */
function groupByDay(tasks, todayYMD) {
  const byDay = new Map();
  for (const task of tasks) {
    const stamp = taskTimestamp(task.id);
    let ymd = stamp ? localYMD(stamp) : todayYMD;
    if (ymd > todayYMD) ymd = todayYMD; // clock skew should not invent a future
    if (!byDay.has(ymd)) byDay.set(ymd, []);
    byDay.get(ymd).push(task);
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([ymd, list]) => ({ ymd, date: labelForYMD(ymd), tasks: list }));
}

/**
 * Today, top to bottom: finished things settle up, everything else stays in
 * the order it was written, newest last.
 *
 * Sorting starred tasks to the bottom used to be a third band, and it meant a
 * task you had just written appeared ABOVE the starred ones rather than at the
 * end of the list — which is the one place you look for it. The star is a mark
 * on a task now, not a place in the order.
 *
 * The id starts with the millisecond the task was written, so it sorts
 * chronologically on its own: parseInt reads that prefix and stops at the
 * random tail that keeps ids unique. An id with no leading number falls back
 * to 0 rather than producing NaN, which a comparator treats as "equal to
 * everything" and which scrambles the whole list.
 */
const writtenAt = (task) => parseInt(task.id, 10) || 0;

const orderWithin = (list) =>
  [...list].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? -1 : 1;
    return writtenAt(a) - writtenAt(b);
  });

function minutesOf(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** One day in the jump bar, 30% smaller than the original strip. */
function DayChip({ chip, onClick }) {
  const t = useT();
  const d = ymdToDate(chip.ymd);
  return (
    <button
      onClick={() => onClick(chip.ymd, chip.isToday)}
      title={chip.isToday ? t("app.today") : labelForYMD(chip.ymd)}
      className={`btn-tactile group flex h-[46px] min-w-[36px] shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border bg-white shadow-sm transition-all hover:shadow-md dark:bg-neutral-800 ${
        chip.isToday
          ? "border-orange-300 dark:border-orange-500/50"
          : "border-neutral-200 hover:border-orange-500/50 dark:border-neutral-700 dark:hover:border-orange-500/50"
      }`}
    >
      <span className="text-[9px] font-bold uppercase leading-none tracking-wider text-neutral-400 transition-colors group-hover:text-orange-500/80 dark:text-neutral-500">
        {formatDate(d, { month: "short" })}
      </span>
      <span className="text-sm font-black leading-tight text-neutral-800 transition-colors group-hover:text-orange-500 dark:text-neutral-100">
        {d.getDate()}
      </span>
    </button>
  );
}

DayChip.propTypes = {
  chip: PropTypes.object.isRequired,
  onClick: PropTypes.func.isRequired,
};

/** How far one step back through the timeline reaches. Counted in days that
    exist, because a week of the calendar can hold nothing at all. */
const DAYS_PER_STEP = 7;

let toastSeq = 0;

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [deletedTasks, setDeletedTasks] = useState([]);
  const [todayYMD, setTodayYMD] = useState(() => localYMD(new Date()));
  const [loaded, setLoaded] = useState(false);
  const t = useT();
  const language = useLanguage();
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [toasts, setToasts] = useState([]);

  const [settings, setSettings] = useState({
    hotkey: "",
    theme: "dark",
    appleReminders: false,
    calendarSync: false,
    escToHide: true,
    projects: [],
  });

  const [showCompleted, setShowCompleted] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [account, setAccount] = useState({ signedIn: false, email: null });
  const [showSearch, setShowSearch] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [updateState, setUpdateState] = useState({ status: "idle" });
  const [deleteTrigger, setDeleteTrigger] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [weeksShown, setWeeksShown] = useState(1);
  // The @ badge's filter: your own timeline, or only what other people have
  // addressed to you.
  const [mentionsOnly, setMentionsOnly] = useState(false);
  const collab = useCollab();

  const [editingId, setEditingId] = useState(null);
  const [addingSubtaskId, setAddingSubtaskId] = useState(null);
  const [assigningProjectId, setAssigningProjectId] = useState(null);
  const [settingReminderId, setSettingReminderId] = useState(null);

  const [dragOverId, setDragOverId] = useState(null);
  const [dragOverPosition, setDragOverPosition] = useState(null);

  const [jiraStatus, setJiraStatus] = useState({
    configured: false,
    connected: false,
  });
  const [jiraProjects, setJiraProjects] = useState([]);

  const inputRef = useRef(null);
  const mainScrollRef = useRef(null);
  const todayRef = useRef(null);
  const tasksEndRef = useRef(null);
  const firedRef = useRef(new Set());
  const tasksRef = useRef(tasks);
  const settingsRef = useRef(settings);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const toast = useCallback((message, tone = "info") => {
    const id = ++toastSeq;
    setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      3200,
    );
  }, []);

  const formattedDate = useMemo(
    () =>
      formatDate(new Date(), {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language],
  );

  // --- Projects available across settings, tasks and history ---
  const availableProjects = useMemo(() => {
    const map = new Map();
    (settings.projects || []).forEach((p) => {
      if (typeof p === "string") map.set(p, { name: p, isFavorite: false });
      else if (p?.name) map.set(p.name, { ...p });
    });
    const add = (name) => {
      if (name && !map.has(name)) map.set(name, { name, isFavorite: false });
    };
    tasks.forEach((t) => (t.projects || []).forEach(add));
    return [...map.values()].sort((a, b) => {
      if (!!a.isFavorite !== !!b.isFavorite) return a.isFavorite ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [tasks, settings.projects]);

  const allDays = useMemo(
    () => {
      // A mention rides in the day it was written on, alongside your own
      // rows, so a task somebody sent you sits with the rest of that Tuesday
      // rather than in a second list you have to remember to look at.
      const rows = mentionsOnly
        ? mentionsAsRows(collab.mentions)
        : [...tasks, ...mentionsAsRows(collab.mentions)];
      return groupByDay(rows, todayYMD);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, collab.mentions, mentionsOnly, todayYMD, language],
  );

  const todayTasks = useMemo(
    () => allDays.find((d) => d.ymd === todayYMD)?.tasks || [],
    [allDays, todayYMD],
  );

  /**
   * Today's work, without the rows other people addressed to you.
   *
   * The counter is a promise about YOUR day — "3 of 7 done" — and a task
   * somebody else is responsible for has no business moving it. The list below
   * still shows both.
   */
  const todayOwnTasks = useMemo(
    () => todayTasks.filter((t) => !t.mention),
    [todayTasks],
  );

  const matchesFilters = useCallback(
    (t) =>
      // A mention carries none of this account's own metadata — no projects,
      // and its completed flag belongs to somebody else's list — so the
      // sidebar's filters have nothing to say about it.
      t.mention
        ? true
        : (showCompleted || !t.completed) &&
          (!selectedProject || t.projects?.includes(selectedProject)),
    [showCompleted, selectedProject],
  );

  /** Past days, filtered; a day with nothing left to show is not rendered. */
  const pastDays = useMemo(
    () =>
      allDays
        .filter((d) => d.ymd !== todayYMD)
        .map((d) => ({
          ...d,
          tasks: orderWithin(d.tasks.filter(matchesFilters)),
        }))
        .filter((d) => d.tasks.length > 0),
    [allDays, todayYMD, matchesFilters],
  );

  const sortedTasks = useMemo(
    () => orderWithin(todayTasks.filter(matchesFilters)),
    [todayTasks, matchesFilters],
  );

  /** Only the most recent week is built up front; older days arrive as you
      step back through the timeline.

      A step is counted in days that HAVE something on them, not in days of the
      calendar. Real history is full of gaps — this app opened on 8 September
      with nothing behind it until 5 May — and a cutoff that walked back seven
      calendar days at a time landed inside that gap eighteen times in a row,
      rendering an identical list each time. The button looked broken because
      it was. */
  const visiblePastDays = useMemo(() => {
    const cutoff = ymdToDate(todayYMD);
    cutoff.setDate(cutoff.getDate() - (DAYS_PER_STEP - 1));
    const cutoffYMD = localYMD(cutoff);
    const thisWeek = pastDays.filter((d) => d.ymd >= cutoffYMD).length;
    // A quiet week — or a filter that emptied it — still opens on real
    // history rather than on nothing.
    const count =
      (thisWeek || DAYS_PER_STEP) + (weeksShown - 1) * DAYS_PER_STEP;
    return pastDays.slice(-count);
  }, [pastDays, todayYMD, weeksShown]);

  const hasOlderDays = pastDays.length > visiblePastDays.length;

  const loadMoreRef = useRef(null);
  const keepDistanceRef = useRef(null);

  const showOlderWeek = useCallback(() => {
    const sc = mainScrollRef.current;
    keepDistanceRef.current = sc ? sc.scrollHeight - sc.scrollTop : null;
    setWeeksShown((w) => w + 1);
  }, []);

  // Prepending days would shove the view down; hold the distance to the bottom.
  useLayoutEffect(() => {
    const sc = mainScrollRef.current;
    if (sc && keepDistanceRef.current != null) {
      sc.scrollTop = sc.scrollHeight - keepDistanceRef.current;
      keepDistanceRef.current = null;
    }
  }, [weeksShown]);

  useEffect(() => {
    if (!hasOlderDays || !loadMoreRef.current || !mainScrollRef.current)
      return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) showOlderWeek();
      },
      { root: mainScrollRef.current, rootMargin: "200px 0px 0px 0px" },
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasOlderDays, showOlderWeek, visiblePastDays.length]);

  const dayChips = useMemo(
    () => [
      { key: "today", ymd: todayYMD, isToday: true },
      ...[...pastDays]
        .reverse()
        .map((h) => ({ key: h.ymd, ymd: h.ymd, isToday: false })),
    ],
    [pastDays, todayYMD],
  );

  /** Jumping to a day that has not been built yet must build it first. */
  const revealDay = useCallback(
    (ymd) => {
      const index = pastDays.findIndex((d) => d.ymd === ymd);
      if (index === -1) return;
      const missing = pastDays.length - index - visiblePastDays.length;
      if (missing <= 0) return; // already on screen
      // This path can prepend months of history at once, so it holds the
      // distance to the bottom exactly the way the button does.
      const sc = mainScrollRef.current;
      keepDistanceRef.current = sc ? sc.scrollHeight - sc.scrollTop : null;
      const steps = Math.ceil(missing / DAYS_PER_STEP);
      setWeeksShown((w) => Math.max(w, weeksShown + steps));
    },
    [pastDays, visiblePastDays.length, weeksShown],
  );

  // --- Who is signed in, so the sidebar can show them ---
  useEffect(() => {
    if (!ipc) return undefined;
    ipc.invoke("sync-status").then((s) => s && setAccount(s));
    const onStatus = (_e, s) => s && setAccount(s);
    // Settings listens on this same channel and unmounts on every tab switch;
    // `on` hands back an unsubscribe for exactly this listener, which
    // removeAllListeners would not respect.
    const off = ipc.on("sync-status", onStatus);
    return () => off?.();
  }, []);

  // --- Initial load ---
  useEffect(() => {
    if (!ipc) {
      setLoaded(true);
      setSettingsLoaded(true);
      return;
    }
    ipc.invoke("get-settings").then((s) => {
      if (s) setSettings(s);
      if (s?.language) setLanguage(s.language);
      // First run: keep whatever the renderer detected so the choice survives
      // a reinstall of the settings file.
      else if (s) ipc.invoke("update-settings", { language: getLanguage() });
      setSettingsLoaded(true);
    });
    ipc.invoke("jira-status").then((status) => {
      setJiraStatus(status || { configured: false, connected: false });
      if (status?.connected) {
        ipc.invoke("jira-fetch-projects").then((res) => {
          if (res?.success) {
            setJiraProjects(res.projects || []);
          }
        });
      }
    });

    ipc.invoke("load-app-data").then((data) => {
      setTasks(flattenStored(data));
      setDeletedTasks(data?.deletedTasks || []);
      if (data?.firedReminders?.length)
        firedRef.current = new Set(data.firedReminders);
      setLoaded(true);
    });
  }, []);

  // --- One-time: pull project names that only ever existed on tasks into the
  // saved list, so the composer and Settings show the same thing. Runs once,
  // so removing a project in Settings afterwards sticks. ---
  useEffect(() => {
    if (!loaded || !settingsLoaded || !ipc || settings.projectsBackfilled)
      return;
    const known = new Set(
      (settings.projects || []).map((p) =>
        typeof p === "string" ? p : p.name,
      ),
    );
    const discovered = availableProjects
      .map((p) => p.name)
      .filter((n) => !known.has(n));
    ipc
      .invoke("update-settings", {
        projects: [
          ...(settings.projects || []),
          ...discovered.map((name) => ({ name, isFavorite: false })),
        ],
        projectsBackfilled: true,
      })
      .then((s) => s && setSettings(s));
  }, [
    loaded,
    settingsLoaded,
    settings.projectsBackfilled,
    settings.projects,
    availableProjects,
  ]);

  // --- Text that came in with the hotkey ---
  useEffect(() => {
    if (!ipc) return undefined;
    const onCaptured = (_e, text) => {
      if (typeof text !== "string" || !text.trim()) return;
      inputRef.current?.insertText?.(text.trim());
    };
    const onNeedsAccess = (_e, message) => toast(message, "error");
    ipc.on("captured-selection", onCaptured);
    ipc.on("needs-accessibility", onNeedsAccess);
    return () => {
      ipc.removeAllListeners("captured-selection");
      ipc.removeAllListeners("needs-accessibility");
    };
  }, [toast]);

  // --- Update availability, surfaced as a pill in the header ---
  useEffect(() => {
    if (!ipc) return undefined;
    ipc.invoke("get-update-state").then((s) => s && setUpdateState(s));
    const onUpdate = (_e, next) => next && setUpdateState(next);
    ipc.on("update-state", onUpdate);
    return () => ipc.removeAllListeners("update-state");
  }, []);

  /**
   * What actually belongs to this account.
   *
   * `allDays` is the list on SCREEN, and rows other people addressed to you
   * are part of that — but they are not yours, they live in the cloud under
   * your mentions, and they must never reach the file. Writing them there
   * turned a mention into a task of your own, which was then read back as one,
   * merged with the live mention again, and saved twice; the file grew a copy
   * per pass and sync pushed the lot up as tasks you had written.
   */
  const ownDays = useMemo(
    () =>
      allDays
        .map((day) => ({ ...day, tasks: day.tasks.filter((t) => !t.mention) }))
        // A day that held nothing but mentions is not a day you had anything
        // on, and an empty bucket in the file helps nobody.
        .filter((day) => day.tasks.length > 0),
    [allDays],
  );

  // --- Persist (the main process batches this into one atomic write) ---
  useEffect(() => {
    if (!loaded || !ipc) return;
    // On disk the shape stays "today plus past days" so the CLI and older
    // exports keep working, even though memory holds one flat list.
    ipc.invoke("save-app-data", {
      tasks: ownDays.find((d) => d.ymd === todayYMD)?.tasks || [],
      history: ownDays.filter((d) => d.ymd !== todayYMD),
      deletedTasks,
    });
  }, [ownDays, todayYMD, deletedTasks, loaded]);

  // --- Land on Today once the data is actually on screen ---
  // Images and fonts settle after the first paint and push the timeline
  // around, so re-assert the position a few times and stop the moment the
  // user takes over.
  useEffect(() => {
    if (!loaded) return undefined;
    const scroller = mainScrollRef.current;
    let cancelled = false;
    const stop = () => {
      cancelled = true;
    };
    scroller?.addEventListener("wheel", stop, { passive: true, once: true });
    scroller?.addEventListener("touchstart", stop, {
      passive: true,
      once: true,
    });

    const settle = () => {
      if (cancelled) return;
      todayRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    };
    settle();
    const timers = [60, 250, 700, 1400].map((ms) => setTimeout(settle, ms));
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 80);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(focusTimer);
      scroller?.removeEventListener("wheel", stop);
      scroller?.removeEventListener("touchstart", stop);
    };
  }, [loaded]);

  // --- Focus the input whenever the window comes back ---
  useEffect(() => {
    const focusInput = () => {
      if (!showSettings && !showSearch)
        setTimeout(() => inputRef.current?.focus(), 40);
    };
    window.addEventListener("focus", focusInput);
    return () => window.removeEventListener("focus", focusInput);
  }, [showSettings, showSearch]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setShowSearch(true);
        return;
      }
      if (mod && e.key.toLowerCase() === "n") {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (e.key === "Escape") {
        if (previewFile) {
          setPreviewFile(null);
          return;
        }
        if (showSearch || showSettings) return; // those close themselves
        if (!settingsRef.current.escToHide) return;
        const el = document.activeElement;
        const typing =
          el &&
          (el.tagName === "INPUT" ||
            el.tagName === "TEXTAREA" ||
            el.isContentEditable);
        if (typing && el.value) return; // never throw away a draft
        ipc?.invoke("hide-window");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewFile, showSearch, showSettings]);

  // --- Menu / main-process messages ---
  useEffect(() => {
    if (!ipc) return;
    const onSettings = () => setShowSettings(true);
    const onSearch = () => setShowSearch(true);
    const onFocusInput = () => inputRef.current?.focus();
    const onDataUpdated = (_, data) => {
      // Only a complete picture may replace the list; a partial one would
      // read as "everything else was deleted".
      if (Array.isArray(data?.tasks) && Array.isArray(data?.history))
        setTasks(flattenStored(data));
      if (Array.isArray(data?.deletedTasks)) setDeletedTasks(data.deletedTasks);
    };
    const onJiraConnected = () => {
      ipc.invoke("jira-status").then((status) => {
        setJiraStatus(status);
        if (status?.connected)
          ipc.invoke("jira-fetch-projects").then((res) => {
            if (res?.success) {
              setJiraProjects(res.projects || []);
            }
          });
      });
    };
    ipc.on("open-settings", onSettings);
    ipc.on("open-search", onSearch);
    ipc.on("focus-input", onFocusInput);
    ipc.on("app-data-updated", onDataUpdated);
    ipc.on("jira-connected", onJiraConnected);
    return () => {
      ipc.removeAllListeners("open-settings");
      ipc.removeAllListeners("open-search");
      ipc.removeAllListeners("focus-input");
      ipc.removeAllListeners("app-data-updated");
      ipc.removeAllListeners("jira-connected");
    };
  }, []);

  // --- Reminder notifications (keyed per day, so no midnight reset is needed) ---
  useEffect(() => {
    if (!loaded) return;
    const check = () => {
      const now = new Date();
      const today = localYMD(now);
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      let fired = false;

      tasksRef.current.forEach((t) => {
        if (!t.reminder || t.completed) return;
        const due = minutesOf(t.reminder);
        if (due === null || nowMinutes < due) return;
        const key = `${t.id}-${today}`;
        if (firedRef.current.has(key)) return;
        firedRef.current.add(key);
        fired = true;
        // Only notify near the scheduled minute; anything older was missed
        // while the app was closed and should not stack up on launch.
        if (nowMinutes - due <= 10) {
          ipc?.invoke("show-notification", { title: "Stepler", body: t.text });
        }
      });

      if (fired) {
        const keep = [...firedRef.current].filter((k) => k.endsWith(today));
        firedRef.current = new Set(keep);
        ipc?.invoke("save-app-data", { firedReminders: keep });
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [loaded]);

  // --- A new day simply starts a new section; nothing is ever moved ---
  useEffect(() => {
    const tick = () =>
      setTodayYMD((prev) => {
        const now = localYMD(new Date());
        return now === prev ? prev : now;
      });
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // ------------------------- handlers -------------------------

  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setShowScrollDown(scrollHeight - scrollTop - clientHeight >= 300);
  }, []);

  const scrollToBottom = useCallback(() => {
    tasksEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  /** Remember a project the moment it is used, so Settings lists it too. */
  const rememberProjects = useCallback(async (names) => {
    if (!ipc || !names?.length) return;
    const current = settingsRef.current.projects || [];
    const known = new Set(
      current.map((p) => (typeof p === "string" ? p : p.name)),
    );
    const missing = [...new Set(names.filter((n) => n && !known.has(n)))];
    if (!missing.length) return;
    const updated = await ipc.invoke("update-settings", {
      projects: [
        ...current,
        ...missing.map((name) => ({ name, isFavorite: false })),
      ],
    });
    if (updated) setSettings(updated);
  }, []);

  const addTask = useCallback(
    async ({
      text,
      projects,
      dueDate,
      attachment,
      jiraProjectKey,
      jiraSprintId,
    }) => {
      const stored = attachment ? await persistAttachment(attachment) : null;
      if (attachment && !stored) toast(t("toast.attachmentFailed"), "error");
      const body =
        (text || "").trim() ||
        (stored && stored.type !== "image" ? stored.name : "");
      if (!body && !stored) return;

      const taskId = newTaskId();
      rememberProjects(projects);
      setTasks((prev) => [
        ...prev,
        {
          id: taskId,
          text: body,
          completed: false,
          priority: false,
          ...(stored ? { attachment: stored } : {}),
          ...(projects?.length ? { projects } : {}),
          ...(dueDate ? { dueDate } : {}),
        },
      ]);

      requestAnimationFrame(() =>
        tasksEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        }),
      );

      if (!ipc || !body) return;

      // Only reach out to calendars when the task actually has a date.
      if (dueDate && settingsRef.current.calendarSync) {
        ipc
          .invoke("google-calendar-create-event", {
            text: body,
            dateString: dueDate,
          })
          .then((res) => {
            if (res?.success) {
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === taskId
                    ? { ...t, gcalLink: res.link, gcalEventId: res.eventId }
                    : t,
                ),
              );
              return;
            }
            // Silence here is what makes calendar sync look broken: the task
            // appears, no event does, and nothing says why.
            toast(res?.error || t("toast.gcalFailed"), "error");
          })
          .catch((err) =>
            toast(err?.message || t("toast.gcalUnreachable"), "error"),
          );
      }
      if (dueDate && settingsRef.current.appleReminders) {
        ipc
          .invoke("apple-reminders-create-event", {
            text: body,
            dateString: dueDate,
          })
          .then((res) => {
            if (res?.success && res.appleReminderId)
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === taskId
                    ? { ...t, appleReminderId: res.appleReminderId }
                    : t,
                ),
              );
          })
          .catch(() => {});
      }
      if (jiraProjectKey) {
        ipc
          .invoke("jira-create-issue", {
            text: body,
            projectKey: jiraProjectKey,
            sprintId: jiraSprintId || null,
          })
          .then((res) => {
            if (res?.success) {
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === taskId
                    ? { ...t, jiraLink: res.link, jiraKey: res.key }
                    : t,
                ),
              );
              // The issue exists either way; say so if only the sprint failed.
              if (res.sprintError)
                toast(
                  t("toast.jiraSprint", {
                    key: res.key,
                    error: res.sprintError,
                  }),
                  "error",
                );
            } else
              toast(
                t("toast.jiraFailed", {
                  error: res?.error || t("toast.jiraNoIssue"),
                }),
                "error",
              );
          })
          .catch(() => {});
      }
    },
    [toast, rememberProjects, t],
  );

  const saveEdit = useCallback((id, nextText) => {
    setEditingId(null);
    const newText = (nextText || "").trim();
    if (!newText) return;
    const existing = tasksRef.current.find((t) => t.id === id);
    if (!existing || existing.text === newText) return;

    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, text: newText } : t)),
    );

    if (!ipc) return;
    if (existing.gcalEventId) {
      ipc
        .invoke("google-calendar-update-event", {
          eventId: existing.gcalEventId,
          text: newText,
          dateString: existing.dueDate,
          reminderTime: existing.reminder,
        })
        .catch(() => {});
    }
    if (existing.appleReminderId && settingsRef.current.appleReminders) {
      ipc
        .invoke("apple-reminders-update-event", {
          reminderId: existing.appleReminderId,
          text: newText,
          dateString: existing.dueDate,
          reminderTime: existing.reminder,
        })
        .catch(() => {});
    }
  }, []);

  const saveReminder = useCallback((id, time, clear = false) => {
    setSettingReminderId(null);
    const existing = tasksRef.current.find((t) => t.id === id);
    if (!existing) return;
    const value = clear ? undefined : time;
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, reminder: value } : t)),
    );
    if (!ipc) return;

    if (settingsRef.current.appleReminders) {
      if (!clear && value && !existing.appleReminderId) {
        ipc
          .invoke("apple-reminders-create-event", {
            text: existing.text,
            dateString: existing.dueDate || localYMD(new Date()),
            reminderTime: value,
          })
          .then((res) => {
            if (res?.success && res.appleReminderId)
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === id
                    ? { ...t, appleReminderId: res.appleReminderId }
                    : t,
                ),
              );
          })
          .catch(() => {});
      } else if (existing.appleReminderId) {
        ipc
          .invoke("apple-reminders-update-event", {
            reminderId: existing.appleReminderId,
            text: existing.text,
            dateString: existing.dueDate || localYMD(new Date()),
            reminderTime: value,
          })
          .catch(() => {});
      }
    }
    if (existing.gcalEventId) {
      ipc
        .invoke("google-calendar-update-event", {
          eventId: existing.gcalEventId,
          text: existing.text,
          dateString: existing.dueDate,
          reminderTime: value,
        })
        .catch(() => {});
    }
  }, []);

  const toggleTask = useCallback((id) => {
    const existing = tasksRef.current.find((t) => t.id === id);
    const nowCompleted = !existing?.completed;
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: nowCompleted } : t)),
    );
    // Keep the mirrored reminder in step so a finished task stops nagging.
    if (existing?.appleReminderId && settingsRef.current.appleReminders) {
      ipc
        ?.invoke("apple-reminders-update-event", {
          reminderId: existing.appleReminderId,
          completed: nowCompleted,
        })
        .catch(() => {});
    }
  }, []);

  const togglePriority = useCallback((id) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, priority: !t.priority } : t)),
    );
  }, []);

  const removeAttachment = useCallback((id) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, attachment: undefined } : t)),
    );
  }, []);

  const deleteTask = useCallback((id) => {
    const task = tasksRef.current.find((t) => t.id === id);
    if (!task) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setDeletedTasks((prev) =>
      [{ ...task, deletedAt: Date.now() }, ...prev].slice(0, 500),
    );
    if (!ipc) return;
    if (task.gcalEventId)
      ipc
        .invoke("google-calendar-delete-event", { eventId: task.gcalEventId })
        .catch(() => {});
    if (task.appleReminderId && settingsRef.current.appleReminders)
      ipc
        .invoke("apple-reminders-delete-event", {
          reminderId: task.appleReminderId,
        })
        .catch(() => {});
  }, []);

  const triggerDeleteTask = useCallback(
    (e, id) => {
      e.stopPropagation();
      const el = e.currentTarget.closest(".group\\/task");
      if (el) {
        const rect = el.getBoundingClientRect();
        setDeleteTrigger({
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
          timestamp: Date.now(),
        });
        setTimeout(() => deleteTask(id), 50);
      } else {
        deleteTask(id);
      }
    },
    [deleteTask],
  );

  const restoreTask = useCallback((id) => {
    setDeletedTasks((prev) => {
      const task = prev.find((t) => t.id === id);
      if (task) {
        const restored = { ...task };
        delete restored.deletedAt;
        setTasks((t) => (t.some((x) => x.id === id) ? t : [...t, restored]));
      }
      return prev.filter((t) => t.id !== id);
    });
  }, []);

  const permanentlyDeleteTask = useCallback((id) => {
    setDeletedTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearDeletedTasks = useCallback(() => setDeletedTasks([]), []);

  // --- Subtasks ---

  const addSubtask = useCallback(async (taskId, text, attachment) => {
    const stored = attachment ? await persistAttachment(attachment) : null;
    const body =
      (text || "").trim() ||
      (stored && stored.type !== "image" ? stored.name : "");
    if (!body && !stored) return;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: [
                ...(t.subtasks || []),
                {
                  id: newTaskId(),
                  text: body,
                  completed: false,
                  ...(stored ? { attachment: stored } : {}),
                },
              ],
            }
          : t,
      ),
    );
  }, []);

  const toggleSubtask = useCallback((taskId, subtaskId) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: (t.subtasks || []).map((st) =>
                st.id === subtaskId ? { ...st, completed: !st.completed } : st,
              ),
            }
          : t,
      ),
    );
  }, []);

  const deleteSubtask = useCallback((taskId, subtaskId) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: (t.subtasks || []).filter((st) => st.id !== subtaskId),
            }
          : t,
      ),
    );
  }, []);

  const triggerDeleteSubtask = useCallback(
    (e, taskId, subtaskId) => {
      e.stopPropagation();
      const el = e.currentTarget.closest(".group\\/subtask");
      if (el) {
        const rect = el.getBoundingClientRect();
        setDeleteTrigger({
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
          timestamp: Date.now(),
        });
        setTimeout(() => deleteSubtask(taskId, subtaskId), 50);
      } else {
        deleteSubtask(taskId, subtaskId);
      }
    },
    [deleteSubtask],
  );

  const saveSubtaskEdit = useCallback((taskId, subtaskId, text) => {
    const next = (text || "").trim();
    if (!next) return;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: (t.subtasks || []).map((st) =>
                st.id === subtaskId ? { ...st, text: next } : st,
              ),
            }
          : t,
      ),
    );
  }, []);

  const setTaskProjects = useCallback(
    (taskId, updater) => {
      const current =
        tasksRef.current.find((t) => t.id === taskId)?.projects || [];
      const next = updater(current);
      rememberProjects(next.filter((n) => !current.includes(n)));
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, projects: next.length ? next : undefined }
            : t,
        ),
      );
    },
    [rememberProjects],
  );

  // --- Drag & drop ---

  const handleDragStart = useCallback((e, type, id, parentId = null) => {
    e.stopPropagation();
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type, id, parentId }),
    );
    e.dataTransfer.effectAllowed = "move";
    setDragOverId(null);
    setDragOverPosition(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragOverId(null);
    setDragOverPosition(null);
  }, []);

  const handleDragOverTask = useCallback(
    (e, targetId) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      let position = "child";
      if (y < rect.height * 0.25) position = "top";
      else if (y > rect.height * 0.75) position = "bottom";
      if (dragOverId !== targetId || dragOverPosition !== position) {
        setDragOverId(targetId);
        setDragOverPosition(position);
      }
    },
    [dragOverId, dragOverPosition],
  );

  const handleDragLeaveTask = useCallback((e, targetId) => {
    setDragOverId((prev) => (prev === targetId ? null : prev));
  }, []);

  const handleDragOverTimeline = useCallback(
    (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragOverId !== "timeline") setDragOverId("timeline");
    },
    [dragOverId],
  );

  const handleDragLeaveTimeline = useCallback(() => {
    setDragOverId((prev) => (prev === "timeline" ? null : prev));
  }, []);

  const handleDropAction = useCallback(
    (e, targetType, targetId = null, position = "child") => {
      const dataStr = e.dataTransfer.getData("application/json");
      setDragOverId(null);
      setDragOverPosition(null);
      if (!dataStr) return;

      let payload;
      try {
        payload = JSON.parse(dataStr);
      } catch {
        return;
      }
      const {
        type: sourceType,
        id: sourceId,
        parentId: sourceParentId,
      } = payload;
      if (sourceId === targetId) return;

      setTasks((prev) => {
        let next = [...prev];
        let moved = null;

        if (sourceType === "task") {
          const idx = next.findIndex((t) => t.id === sourceId);
          if (idx === -1) return prev;
          moved = { ...next[idx] };
          next = next.filter((t) => t.id !== sourceId);
        } else {
          const parentIdx = next.findIndex((t) => t.id === sourceParentId);
          if (parentIdx === -1) return prev;
          const sub = (next[parentIdx].subtasks || []).find(
            (st) => st.id === sourceId,
          );
          if (!sub) return prev;
          moved = { ...sub };
          next = next.map((t, i) =>
            i === parentIdx
              ? {
                  ...t,
                  subtasks: t.subtasks.filter((st) => st.id !== sourceId),
                }
              : t,
          );
        }
        if (!moved) return prev;

        if (targetType === "timeline") {
          next.push(moved);
          return next;
        }

        const targetIndex = next.findIndex((t) => t.id === targetId);
        if (targetIndex === -1) return prev;

        if (position === "top" || position === "bottom") {
          next.splice(
            position === "top" ? targetIndex : targetIndex + 1,
            0,
            moved,
          );
          return next;
        }

        // Nesting: a task dragged onto another keeps its own subtasks by
        // flattening them in, instead of silently dropping them.
        // Everything the task carried comes with it, minus the subtasks that
        // are flattened in alongside it. Rebuilding the row from four fields
        // used to discard the due date, the reminder, the star and the
        // projects — and with them the calendar and reminder ids, without
        // which the mirrored event could never be updated or removed again.
        const { subtasks: movedSubtasks, ...movedRest } = moved;
        const incoming =
          sourceType === "task"
            ? [
                { ...movedRest, completed: !!moved.completed },
                ...(movedSubtasks || []),
              ]
            : [moved];
        next[targetIndex] = {
          ...next[targetIndex],
          subtasks: [
            ...(next[targetIndex].subtasks || []),
            ...incoming.filter((s) => s.text || s.attachment),
          ],
        };
        return next;
      });
    },
    [],
  );

  const handleDropOnTask = useCallback(
    (e, targetId) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      let position = "child";
      if (y < rect.height * 0.25) position = "top";
      else if (y > rect.height * 0.75) position = "bottom";
      handleDropAction(e, "task", targetId, position);
    },
    [handleDropAction],
  );

  const handleDropOnTimeline = useCallback(
    (e) => {
      e.preventDefault();
      handleDropAction(e, "timeline");
    },
    [handleDropAction],
  );

  // --- Navigation ---

  const handleDayClick = useCallback(
    (ymd, isToday) => {
      if (isToday) {
        todayRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        return;
      }
      revealDay(ymd);
      requestAnimationFrame(() =>
        document
          .getElementById(`day-${ymd}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    },
    [revealDay],
  );

  const flashTask = useCallback((taskId) => {
    const el = document.getElementById(`task-${taskId}`);
    if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-blue-400/50");
    setTimeout(() => el.classList.remove("ring-2", "ring-blue-400/50"), 2000);
    return true;
  }, []);

  const handleJumpToTask = useCallback(
    (taskId, ymd) => {
      setShowSearch(false);
      if (ymd) revealDay(ymd); // the day may not be built yet
      setTimeout(() => {
        if (flashTask(taskId)) return;
        if (!ymd)
          todayRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        else
          document
            .getElementById(`day-${ymd}`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 250);
    },
    [flashTask, revealDay],
  );

  const searchAction = useCallback(
    (taskId, setter) => {
      setShowSearch(false);
      setTimeout(() => {
        flashTask(taskId);
        setter(taskId);
      }, 250);
    },
    [flashTask],
  );

  // --- Import / export ---

  const handleExportTasks = useCallback(async () => {
    const result = await ipc?.invoke("export-tasks", {
      tasks: allDays.find((d) => d.ymd === todayYMD)?.tasks || [],
      history: allDays.filter((d) => d.ymd !== todayYMD),
      deletedTasks,
    });
    if (result?.success) toast(t("toast.exported"));
    else if (result && !result.canceled)
      toast(result.error || t("toast.exportFailed"), "error");
  }, [allDays, todayYMD, deletedTasks, toast, t]);

  const handleImportTasks = useCallback(async () => {
    const result = await ipc?.invoke("import-tasks");
    if (!result?.success) {
      if (result && !result.canceled)
        toast(result.error || t("toast.importFailed"), "error");
      return;
    }
    const imported = result.data || {};
    let added = 0;
    setTasks((prev) => {
      const known = new Set(prev.map((t) => t.id));
      const incoming = flattenStored(imported).filter((t) => !known.has(t.id));
      added = incoming.length;
      return [...prev, ...incoming];
    });
    setDeletedTasks((prev) => {
      const ids = new Set(prev.map((t) => t.id));
      return [
        ...prev,
        ...(imported.deletedTasks || []).filter((t) => !ids.has(t.id)),
      ];
    });
    setTimeout(
      () =>
        toast(
          added ? tPlural("toast.imported", added) : t("toast.nothingToImport"),
        ),
      0,
    );
  }, [toast, t]);

  // ------------------------- render -------------------------

  const renderTask = (task) => {
    if (task.mention)
      return (
        <MentionTaskItem
          key={`m-${task.mention.id}`}
          mention={task.mention}
          onMarkRead={(id) => collab.markRead(id)}
          onToggle={(m, completed) => collab.editMention(m, { completed })}
          onPriority={(m, priority) => collab.editMention(m, { priority })}
          onSubtaskToggle={(m, stId, done) =>
            collab.toggleMentionSubtask(m, stId, done)
          }
          onAddSubtask={(m, text) => collab.addMentionSubtask(m, text)}
          onDismiss={(m) => collab.dismissMention(m)}
          onCopy={(m) => ipc?.invoke("copy-task", { text: m.text })}
          variant="desktop"
        />
      );
    const dragTarget =
      dragOverId &&
      (dragOverId === task.id ||
        task.subtasks?.some((s) => s.id === dragOverId))
        ? dragOverId
        : null;
    return (
      <TaskItem
        key={task.id}
        task={task}
        showCompleted={showCompleted}
        isEditing={editingId === task.id}
        isAddingSubtask={addingSubtaskId === task.id}
        isAssigningProject={assigningProjectId === task.id}
        isSettingReminder={settingReminderId === task.id}
        dragOverId={dragTarget}
        dragOverPosition={dragTarget === task.id ? dragOverPosition : null}
        availableProjects={availableProjects}
        setEditingId={setEditingId}
        saveEdit={saveEdit}
        setAddingSubtaskId={setAddingSubtaskId}
        addSubtask={addSubtask}
        saveSubtaskEdit={saveSubtaskEdit}
        setAssigningProjectId={setAssigningProjectId}
        setTaskProjects={setTaskProjects}
        setSettingReminderId={setSettingReminderId}
        saveReminder={saveReminder}
        toggleTask={toggleTask}
        togglePriority={togglePriority}
        toggleSubtask={toggleSubtask}
        removeAttachment={removeAttachment}
        triggerDeleteTask={triggerDeleteTask}
        triggerDeleteSubtask={triggerDeleteSubtask}
        onPreview={setPreviewFile}
        onToast={toast}
        handleDragStart={handleDragStart}
        handleDragEnd={handleDragEnd}
        handleDragOverTask={handleDragOverTask}
        handleDragLeaveTask={handleDragLeaveTask}
        handleDropOnTask={handleDropOnTask}
        handleDropAction={handleDropAction}
      />
    );
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white font-sans text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
      <ParticleCanvas trigger={deleteTrigger} />
      <Toasts toasts={toasts} />
      {showSearch && (
        <FullScreenSearch
          onClose={() => setShowSearch(false)}
          tasks={tasks}
          onJumpToTask={handleJumpToTask}
          onToggleTask={toggleTask}
          onTogglePriority={togglePriority}
          onDeleteTask={triggerDeleteTask}
          onAddSubtask={(id) => searchAction(id, setAddingSubtaskId)}
          onRemind={(id) => searchAction(id, setSettingReminderId)}
          onAssignProject={(id) => searchAction(id, setAssigningProjectId)}
        />
      )}
      <Sidebar
        show={showSidebar}
        tasks={tasks}
        onSettingsClick={() => setShowSettings(true)}
        account={account}
        deletedCount={deletedTasks.length}
        availableProjects={availableProjects}
        selectedProject={selectedProject}
        onProjectClick={setSelectedProject}
      />
      <div className="relative flex h-full flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div
          style={{ WebkitAppRegion: "drag" }}
          className="relative z-40 flex h-8 shrink-0 items-center justify-center border-b border-neutral-200 bg-neutral-100/80 px-5 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/80"
        >
          <div className="flex w-full max-w-3xl items-center justify-between">
            <div className="flex items-center pl-2 text-neutral-600 dark:text-neutral-300">
              <button
                onClick={() => setShowSidebar((v) => !v)}
                className="pointer-events-auto rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                style={{ WebkitAppRegion: "no-drag" }}
                title={t("app.toggleSidebar")}
              >
                <PanelLeft size={18} />
              </button>
            </div>
            <div
              style={{ WebkitAppRegion: "no-drag" }}
              className="flex items-center gap-3"
            >
              <UpdatePill
                state={updateState}
                onInstall={() => ipc?.invoke("install-update")}
                onOpenReleases={async () => {
                  const res = await ipc?.invoke("reveal-downloaded-update");
                  toast(
                    res?.success
                      ? `${res.name} is in your Downloads — unzip it and drag Stepler into Applications.`
                      : "Opening the download page.",
                  );
                }}
              />
              <button
                onClick={() => setShowCompleted((v) => !v)}
                className="flex items-center gap-2 text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
              >
                <span>
                  {showCompleted ? t("app.hideCompleted") : t("app.showAll")}
                </span>
                <div
                  className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
                    showCompleted
                      ? "bg-blue-500"
                      : "bg-neutral-300 dark:bg-neutral-700"
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition duration-200 ${
                      showCompleted ? "translate-x-3.5" : "translate-x-0.5"
                    }`}
                  />
                </div>
              </button>
              <div className="border-l border-neutral-300 pl-3 text-sm font-medium text-neutral-400 dark:border-neutral-700 dark:text-neutral-500">
                {t("app.counter", {
                  done: todayOwnTasks.filter((task) => task.completed).length,
                  total: todayOwnTasks.length,
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div
          ref={mainScrollRef}
          onScroll={handleScroll}
          className="custom-scrollbar relative flex-1 overflow-y-auto"
        >
          {/* Day jump bar. No background or divider of its own — the
              timeline reads as one surface until you reach for the corner. */}
          <div className="group/daybar sticky top-0 z-50 w-fit rounded-br-2xl px-2 py-1 transition-[width,background-color] duration-200 hover:w-full hover:rounded-none hover:border-b hover:border-neutral-200 hover:bg-white/90 hover:shadow-sm hover:backdrop-blur-md dark:hover:border-neutral-800 dark:hover:bg-neutral-900/90">
            <div className="flex items-center gap-2">
              {dayChips.slice(0, 1).map((chip) => (
                <DayChip key={chip.key} chip={chip} onClick={handleDayClick} />
              ))}
              {dayChips.length > 1 && (
                <div className="no-scrollbar flex max-w-0 items-center gap-2 overflow-x-auto py-1 opacity-0 transition-all duration-300 ease-out group-hover/daybar:max-w-full group-hover/daybar:opacity-100">
                  {dayChips.slice(1).map((chip) => (
                    <DayChip
                      key={chip.key}
                      chip={chip}
                      onClick={handleDayClick}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mx-auto w-full max-w-3xl px-5 md:px-8">
            <div className="relative pl-2">
              {/* Every past day that still has something on it. Days with
                  nothing to show are not rendered at all. */}
              {hasOlderDays && (
                <div
                  ref={loadMoreRef}
                  className="flex justify-center pb-6 pt-2"
                >
                  <button
                    onClick={showOlderWeek}
                    className="btn-tactile rounded-full border border-neutral-200 bg-white/70 px-4 py-1.5 text-xs font-medium text-neutral-500 shadow-sm transition-colors hover:text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800/70 dark:text-neutral-400"
                  >
                    {t("app.showPreviousWeek")}
                  </button>
                </div>
              )}
              {visiblePastDays.map((day) => (
                <div
                  key={day.ymd}
                  id={`day-${day.ymd}`}
                  className="relative mb-8 scroll-mt-[76px]"
                >
                  <div className="sticky top-0 z-30 bg-white/95 pb-4 pt-3 backdrop-blur-md dark:bg-neutral-900/95">
                    <div className="absolute left-[4px] top-[18px] z-10 h-2 w-2 rounded-full bg-neutral-600 ring-[5px] ring-white dark:bg-neutral-300 dark:ring-neutral-900" />
                    <div className="pl-8">
                      <h2 className="text-lg font-bold leading-none text-neutral-900 dark:text-neutral-100">
                        {day.date}
                      </h2>
                    </div>
                  </div>
                  <div className="relative space-y-0.5 pl-8">
                    <div className="absolute bottom-[-32px] left-[7px] top-0 z-0 w-[2px] bg-neutral-200 dark:bg-neutral-800" />
                    {day.tasks.map(renderTask)}
                  </div>
                </div>
              ))}

              {/* TODAY */}
              <div
                ref={todayRef}
                className={`relative scroll-mt-[76px] pb-10 transition-colors ${
                  dragOverId === "timeline"
                    ? "rounded-xl bg-blue-50/50 dark:bg-blue-900/10"
                    : ""
                }`}
                onDragOver={handleDragOverTimeline}
                onDragLeave={handleDragLeaveTimeline}
                onDrop={handleDropOnTimeline}
              >
                <div className="sticky top-0 z-30 bg-white/95 pb-4 pt-3 backdrop-blur-md dark:bg-neutral-900/95">
                  {pastDays.length > 0 && (
                    <div className="absolute left-[7px] top-0 z-0 h-[18px] w-[2px] bg-neutral-200 dark:bg-neutral-800" />
                  )}
                  <div className="absolute left-[4px] top-[18px] z-10 h-2 w-2 rounded-full bg-neutral-600 ring-[5px] ring-white dark:bg-neutral-300 dark:ring-neutral-900" />
                  <div className="pl-8">
                    <h2 className="text-lg font-bold leading-none text-neutral-900 dark:text-neutral-100">
                      {t("app.today")}
                    </h2>
                    <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                      {formattedDate}
                    </p>
                  </div>
                </div>

                <div className="relative space-y-0.5 pl-8">
                  <div className="absolute bottom-0 left-[7px] top-0 z-0 w-[2px] bg-neutral-200 dark:bg-neutral-800" />
                  {sortedTasks.length === 0 ? (
                    <p className="py-2 text-sm italic text-neutral-400 dark:text-neutral-600">
                      {todayOwnTasks.length > 0
                        ? t("app.allDone")
                        : t("app.nothingToday")}
                    </p>
                  ) : (
                    sortedTasks.map(renderTask)
                  )}
                </div>
              </div>

              <div className="h-[40vh]" />
              <div ref={tasksEndRef} className="h-1" />
            </div>
          </div>
        </div>

        {showScrollDown && (
          <button
            onClick={scrollToBottom}
            className="group absolute right-8 z-50 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-neutral-200 bg-white/80 text-neutral-600 shadow-lg backdrop-blur-md transition-all hover:bg-white hover:text-blue-500 dark:border-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-400"
            style={{ bottom: isExpanded ? "120px" : "160px" }}
            title={t("app.jumpNewest")}
          >
            <ChevronDown size={22} strokeWidth={2.5} />
          </button>
        )}

        {/* The @ badge, in the same column as the jump-to-newest button and
            stacked above it — 52px is that button's 40px plus the gap. When
            the jump button is hidden this drops into its place rather than
            floating on its own. Shown while anything is unread and while the
            filter is on, so there is always a way back out of it. */}
        {/* Always here, so it reads as a filter you can reach rather than a
            notification that appears and vanishes. The count is the part that
            comes and goes. */}
        <MentionBadge
          className="absolute right-8 z-50"
          style={{
            bottom: `${(isExpanded ? 120 : 160) + (showScrollDown ? 52 : 0)}px`,
          }}
          count={collab.unread.length}
          active={mentionsOnly}
          label={
            mentionsOnly
              ? t("collab.showAll")
              : t("collab.showMentions", { count: collab.unread.length })
          }
          onClick={() => {
            const next = !mentionsOnly;
            setMentionsOnly(next);
            // Opening the filter is the moment they have been read: every
            // one of them is on screen, and nothing else would ever clear
            // the badge.
            if (next && collab.unread.length) collab.markRead(null);
          }}
        />

        <TaskInput
          ref={inputRef}
          onSubmit={addTask}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
          availableProjects={availableProjects}
          onOpenSettings={() => setShowSettings(true)}
          onToast={toast}
          jiraStatus={jiraStatus}
          jiraProjects={jiraProjects}
          connections={collab.accepted}
        />

        {showSettings && (
          <SettingsPanel
            settings={settings}
            onClose={() => setShowSettings(false)}
            onExport={handleExportTasks}
            onImport={handleImportTasks}
            onSettingsUpdate={setSettings}
            onToast={toast}
            deletedTasks={deletedTasks}
            onRestore={restoreTask}
            onPermanentDelete={permanentlyDeleteTask}
            onClearAll={clearDeletedTasks}
            collab={collab}
          />
        )}

        <FilePreviewModal
          previewFile={previewFile}
          setPreviewFile={setPreviewFile}
          onToast={toast}
        />
      </div>
    </div>
  );
}
