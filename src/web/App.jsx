import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  Check,
  ImageOff,
  LogOut,
  Monitor,
  Moon,
  Paperclip,
  Settings,
  Star,
  SunMedium,
  Trash2,
  X,
} from "lucide-react";
import { auth } from "./firebase";
import {
  addTask,
  deleteTask,
  setAttachment,
  setCompleted,
  setPriority,
  setSubtaskCompleted,
  subscribeTasks,
} from "./store";
import {
  addSubtaskToMention,
  dismissMention,
  editMention,
  markAllMentionsRead,
  markMentionRead,
  toggleMentionSubtask,
  useCollab,
} from "./collab";
import { THEMES, setTheme, useTheme } from "./theme";
import {
  MentionBadge,
  MentionTaskItem,
} from "../renderer/src/components/MentionTaskItem";
import {
  applyMention,
  mentionQueryAt,
  mentionsAsRows,
} from "../renderer/src/lib/collab";
import {
  MAX_ATTACHMENT_BYTES,
  uploadAttachment,
  useAttachmentUrl,
} from "./attachments";
import FileTypeIcon from "../renderer/src/components/FileTypeIcon";
import AuthScreen from "./AuthScreen";
import SettingsModal from "./SettingsModal";
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

/**
 * Finished subtasks settle to the top the way finished tasks do, and the rest
 * keep the order they were written in — Array.prototype.sort is stable, so
 * returning 0 is what preserves that. The same rule TaskItem applies on the
 * desktop, so a list does not reshuffle when you cross between the two.
 */
const orderSubtasks = (list) =>
  [...list].sort((a, b) =>
    a.completed === b.completed ? 0 : a.completed ? -1 : 1,
  );

/**
 * A task's file. The document carries the description; the bytes come from
 * Storage, which is why this has three states — waiting for a URL, a picture,
 * or a chip saying the machine that owns the file has not uploaded it yet.
 */
function Attachment({ att, onOpen }) {
  const t = useT();
  const { url, failed } = useAttachmentUrl(att);
  const [broken, setBroken] = useState(false);

  if (failed || broken)
    return (
      <div className="mt-2 flex w-fit items-center gap-2 rounded-xl border border-dashed border-neutral-300 px-3 py-2 text-[11px] text-neutral-400 dark:border-neutral-700 dark:text-neutral-500">
        <ImageOff size={13} />
        <span className="max-w-[200px] truncate">{att.name}</span>
      </div>
    );

  if (att.type === "image")
    return (
      <button
        type="button"
        onClick={() => onOpen(att)}
        title={t("common.preview")}
        className="mt-2 block cursor-zoom-in overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800"
      >
        {url ? (
          <img
            src={url}
            alt={att.name}
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            {...(att.w && att.h ? { width: att.w, height: att.h } : {})}
            className="max-h-40 w-auto object-cover"
          />
        ) : (
          // The box is reserved at a plausible size rather than the real one:
          // the row must not resize twice on its way to showing the picture.
          <span className="block h-24 w-40 animate-pulse bg-neutral-100 dark:bg-neutral-800" />
        )}
      </button>
    );

  return (
    <button
      type="button"
      onClick={() => onOpen(att)}
      className="mt-2 flex w-fit cursor-pointer items-center gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-400 dark:hover:bg-neutral-800/80"
    >
      <FileTypeIcon fileName={att.name} size={28} />
      <span className="max-w-[200px] truncate">{att.name}</span>
    </button>
  );
}

Attachment.propTypes = {
  att: PropTypes.shape({
    name: PropTypes.string,
    type: PropTypes.string,
    storagePath: PropTypes.string,
    w: PropTypes.number,
    h: PropTypes.number,
  }).isRequired,
  onOpen: PropTypes.func.isRequired,
};

/**
 * Full-screen preview. A phone has no room to look at a screenshot inside a
 * row and no second window to open it in, so tapping one takes over the screen
 * and tapping anywhere gives it back.
 */
function Lightbox({ att, onClose }) {
  const t = useT();
  const { url } = useAttachmentUrl(att);

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={att.name}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onClose}
        title={t("common.close")}
        style={{ marginTop: "env(safe-area-inset-top)" }}
        className="absolute right-4 top-4 cursor-pointer rounded-lg bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
      >
        <X size={18} />
      </button>

      {att.type === "image" && url ? (
        <img
          src={url}
          alt={att.name}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-lg object-contain"
        />
      ) : (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex flex-col items-center gap-4 rounded-2xl bg-white p-6 dark:bg-neutral-900"
        >
          <FileTypeIcon fileName={att.name} size={48} />
          <p className="max-w-[240px] truncate text-sm text-neutral-700 dark:text-neutral-200">
            {att.name}
          </p>
          {url && (
            // A real link rather than a scripted open: a tap on it is a user
            // gesture, which is the only kind Safari lets through.
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white dark:bg-orange-500"
            >
              {t("common.open")}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

Lightbox.propTypes = {
  att: PropTypes.shape({
    name: PropTypes.string,
    type: PropTypes.string,
    storagePath: PropTypes.string,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
};

function TaskRow({ task, uid, onOpen }) {
  const t = useT();
  const subtasks = orderSubtasks(task.subtasks || []);
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

      <div className="min-w-0 flex-1">
        {/* The text gets a box of its own so the tree trunk can start just
            under the parent checkbox and stop exactly where the first subtask
            begins, however many lines the task runs to. */}
        <div
          className={`relative whitespace-pre-wrap break-words text-[14px] leading-relaxed ${
            task.completed
              ? "text-neutral-400 line-through dark:text-neutral-600"
              : "text-neutral-800 dark:text-neutral-100"
          }`}
        >
          {subtasks.length > 0 && (
            <span className="tree-line pointer-events-none absolute -bottom-2 -left-[21px] top-[22px] w-px" />
          )}
          {/* Priority used to be visible as a position — starred tasks sank
              to the bottom. Now that order is purely chronological, the star
              has to be visible on the task itself, the way the desktop app
              has always drawn it. */}
          {task.priority && !task.completed && (
            <Star
              size={14}
              fill="currentColor"
              className="mb-0.5 mr-1.5 inline text-amber-500 dark:text-amber-400"
            />
          )}
          {formatTaskText(task.text)}
        </div>

        {task.attachment && (
          <Attachment
            key={task.attachment.storagePath}
            att={task.attachment}
            onOpen={onOpen}
          />
        )}

        {subtasks.length > 0 && (
          <div className="relative mt-2 space-y-1 pl-1">
            {subtasks.map((st, index) => (
              <div
                key={st.id ?? `st-${index}`}
                className="group/subtask relative flex items-start gap-2 rounded-lg p-1 transition-colors hover:bg-neutral-200/40 dark:hover:bg-neutral-800/60"
              >
                {/* Tree guides: a trunk in the parent checkbox's column and a
                    branch into this row, so the nesting is unmistakable. The
                    last child closes with a rounded elbow instead of a tee. */}
                {index === subtasks.length - 1 ? (
                  <span className="tree-corner pointer-events-none absolute -left-[25px] top-0 h-[14px] w-[25px] transition-[width] group-hover/subtask:w-[8px]" />
                ) : (
                  <>
                    <span className="tree-line pointer-events-none absolute -bottom-1 -left-[25px] top-0 w-px" />
                    <span className="tree-line pointer-events-none absolute -left-[25px] top-[13px] h-px w-[25px] transition-[width] group-hover/subtask:w-[8px]" />
                  </>
                )}

                {/* 14px is the desktop's size and the tree geometry is derived
                    from it, so the finger-sized target is added underneath as
                    a pseudo-element rather than by growing the box. */}
                <button
                  type="button"
                  title={
                    st.completed ? t("task.markNotDone") : t("task.markDone")
                  }
                  onClick={() =>
                    setSubtaskCompleted(
                      uid,
                      task.id,
                      task.subtasks,
                      st.id,
                      !st.completed,
                    )
                  }
                  className={`relative mt-0.5 flex h-[14px] w-[14px] shrink-0 cursor-pointer items-center justify-center rounded border transition-all after:absolute after:-inset-2 after:content-[''] ${
                    st.completed
                      ? "border-orange-500 bg-orange-500 text-white"
                      : "border-neutral-300 hover:border-orange-400 dark:border-neutral-600"
                  }`}
                >
                  {st.completed && <Check size={10} strokeWidth={4} />}
                </button>

                <div
                  className={`min-w-0 flex-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed ${
                    st.completed
                      ? "text-neutral-400 line-through dark:text-neutral-600"
                      : "text-neutral-600 dark:text-neutral-300"
                  }`}
                >
                  {formatTaskText(st.text)}
                  {st.attachment && (
                    <Attachment
                      key={st.attachment.storagePath}
                      att={st.attachment}
                      onOpen={onOpen}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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
    attachment: PropTypes.object,
    subtasks: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        text: PropTypes.string,
        completed: PropTypes.bool,
        attachment: PropTypes.object,
      }),
    ),
  }).isRequired,
  uid: PropTypes.string.isRequired,
  onOpen: PropTypes.func.isRequired,
};

function Timeline({ user, collab, onOpenSettings }) {
  const uid = user.uid;
  const t = useT();
  // Subscribing to the language re-renders the day headings, which are
  // formatted at render time rather than stored on the grouped rows.
  useLanguage();
  const [tasks, setTasks] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [trashCount, setTrashCount] = useState(0);
  const [fromCache, setFromCache] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState("");
  const [composerFocused, setComposerFocused] = useState(false);
  const [pending, setPending] = useState(null);
  const [notice, setNotice] = useState(null);
  const [preview, setPreview] = useState(null);
  // The filter the @ badge toggles: your own list, or only what other people
  // have addressed to you.
  const [mentionsOnly, setMentionsOnly] = useState(false);
  // The handle being typed right now, and the connections that match it.
  const [suggest, setSuggest] = useState(null);
  const fileRef = useRef(null);
  const draftRef = useRef(null);
  const bottomRef = useRef(null);
  const todayYMD = localYMD(new Date());
  const { accepted, mentions, unread, deliver } = collab;

  useEffect(() => {
    const stop = subscribeTasks(
      uid,
      ({ tasks: active, deletedTasks, fromCache: cached }) => {
        setTasks(active);
        // Deleted tasks are kept for the delivery pass below, not for the
        // list: taking a task to the trash has to withdraw the mention it
        // carried, and that needs the tombstone to still be visible here.
        setAllTasks([...active, ...deletedTasks]);
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

  // The preview URL is owned here rather than by an effect on `pending`: the
  // chip re-renders while its file is uploading, and an effect keyed on the
  // object would revoke the URL that very chip is still pointing at.
  const previewRef = useRef(null);
  const releasePreview = useCallback(() => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
  }, []);
  useEffect(() => releasePreview, [releasePreview]);

  const pick = useCallback(
    (file) => {
      if (!file) return;
      if (file.size >= MAX_ATTACHMENT_BYTES) {
        setNotice(t("toast.attachmentFailed"));
        return;
      }
      setNotice(null);
      releasePreview();
      const previewUrl = URL.createObjectURL(file);
      previewRef.current = previewUrl;
      setPending({
        file,
        name: file.name || `pasted-${Date.now()}.png`,
        type: file.type.startsWith("image/") ? "image" : "file",
        previewUrl,
        uploading: false,
      });
    },
    [releasePreview, t],
  );

  /**
   * Deliver whatever this account's tasks currently say.
   *
   * Every task goes in, not just the ones holding an `@`: withdrawing a
   * mention means noticing that a task STOPPED naming somebody, which you
   * cannot see by looking only at the ones that still do. The pass is cheap on
   * the ones that never mentioned anybody — a regex that finds nothing — and
   * the delay collapses a burst of snapshots into one.
   */
  useEffect(() => {
    if (!allTasks.length) return undefined;
    const timer = setTimeout(() => deliver(allTasks), 900);
    return () => clearTimeout(timer);
  }, [allTasks, deliver, accepted.length]);

  /**
   * Recompute the handle menu from where the caret is. Only accepted
   * connections are offered: an invitation nobody answered is not somebody you
   * can address a task to, and offering the name would produce a mention the
   * rules reject in silence.
   */
  const refreshSuggest = useCallback(
    (value, caret) => {
      const range = mentionQueryAt(value, caret ?? value.length);
      if (!range) {
        setSuggest(null);
        return;
      }
      const list = accepted
        .filter((c) => c.username?.startsWith(range.query))
        .slice(0, 6);
      setSuggest(list.length ? { range, list, index: 0 } : null);
    },
    [accepted],
  );

  /**
   * Finish the handle being typed.
   *
   * Deliberately a plain function closing over the current draft rather than a
   * memoised one driving both pieces of state from inside an updater: a state
   * updater has to be pure, and React is free to run it twice or throw the
   * result away — which it did, and the completion silently never happened.
   */
  const choose = (person) => {
    if (!suggest || !person) return;
    const next = applyMention(draft, suggest.range, person.username);
    setDraft(next.text);
    setSuggest(null);
    // React puts the caret at the end of the value when it repaints the
    // field, so it is moved back behind the completed name on the next frame.
    requestAnimationFrame(() => {
      const el = draftRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  };

  /**
   * Every mention edit is fire-and-forget on screen — the row has already
   * changed by the time Firestore answers — so this is the one place a refusal
   * gets noticed rather than disappearing into an unhandled rejection.
   */
  const report = useCallback(
    (promise) =>
      Promise.resolve(promise).catch((err) => {
        console.warn("That change did not land:", err.code || err.message);
        setNotice(t("collab.failed"));
      }),
    [t],
  );

  const days = useMemo(() => {
    const rows = mentionsOnly
      ? mentionsAsRows(mentions)
      : [...tasks, ...mentionsAsRows(mentions)];
    return groupByDay(rows, todayYMD);
  }, [tasks, mentions, mentionsOnly, todayYMD]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [days.length]);

  const submit = useCallback(
    async (e) => {
      e.preventDefault();
      const text = draft.trim();
      const file = pending;
      if (!text && !file) return;
      setDraft("");
      setSuggest(null);
      setNotice(null);

      // The task is written and the file is uploaded independently, and
      // neither waits on the other. Awaiting the write would hang offline —
      // Firestore holds that promise until the server answers — and the file
      // behind it would never be uploaded, silently.
      const { id, written } = addTask(uid, text);
      written.catch((err) => {
        console.error("Could not add the task:", err.code, err.message);
        setError(err.message);
      });

      if (!file) return;
      // The chip stays until the bytes are actually in Storage, so a stalled
      // upload cannot be mistaken for a finished one.
      setPending({ ...file, uploading: true });
      try {
        const att = await uploadAttachment(uid, file.file);
        // Not awaited: the bytes are safe by now, and Firestore keeps writes
        // to one document in order, so this lands after the task itself.
        setAttachment(uid, id, att).catch((err) =>
          console.error("Could not record the file:", err.code, err.message),
        );
        releasePreview();
        setPending(null);
      } catch (err) {
        console.error("Could not upload the file:", err.code, err.message);
        // The task is already written and already on screen, so only the file
        // comes back — handing the words back too would let a second copy of
        // the task be created. The preview URL was never revoked, so the chip
        // still renders.
        setNotice(err.message);
        setPending({ ...file, uploading: false });
      }
    },
    [draft, pending, releasePreview, uid],
  );

  // The counter is a promise about YOUR day, so the rows other people
  // addressed to you are left out of it — they are somebody else's to finish.
  const ownToday =
    days.find((d) => d.ymd === todayYMD)?.tasks.filter((x) => !x.mention) ?? [];
  const doneToday = ownToday.filter((x) => x.completed).length;
  const totalToday = ownToday.length;

  return (
    <>
      <div className="mx-auto w-full max-w-[720px] flex-1 overflow-y-auto px-5 pb-6">
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
            {mentionsOnly ? t("collab.noMentions") : t("app.nothingToday")}
          </p>
        )}

        {days.map((day) => {
          const isToday = day.ymd === todayYMD;
          return (
            <section key={day.ymd} className="mb-6">
              {/* Big enough to read as a heading rather than a caption, with
                  today carrying the app's orange. The dot is an inline flex
                  child, not an absolute one: the sticky bar only blurs what is
                  inside its own box, and anything hanging outside it would
                  have rows sliding visibly underneath. */}
              <h2
                className={`sticky top-0 z-10 mb-1.5 flex items-center gap-2 bg-neutral-50/90 pb-2 pt-4 text-[17px] font-bold backdrop-blur dark:bg-neutral-950/90 ${
                  isToday
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-neutral-900 dark:text-neutral-100"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                    isToday
                      ? "bg-orange-500"
                      : "bg-neutral-300 dark:bg-neutral-700"
                  }`}
                />
                {isToday ? t("app.today") : labelForYMD(day.ymd)}
              </h2>
              {day.tasks.map((task) =>
                task.mention ? (
                  <MentionTaskItem
                    key={`m-${task.mention.id}`}
                    mention={task.mention}
                    onMarkRead={(id) => report(markMentionRead(uid, id))}
                    onToggle={(m, completed) =>
                      report(editMention(uid, m, { completed }))
                    }
                    onPriority={(m, priority) =>
                      report(editMention(uid, m, { priority }))
                    }
                    onSubtaskToggle={(m, stId, done) =>
                      report(toggleMentionSubtask(uid, m, stId, done))
                    }
                    onAddSubtask={(m, text) =>
                      report(addSubtaskToMention(uid, m, text))
                    }
                    onDismiss={(m) => report(dismissMention(uid, m))}
                  />
                ) : (
                  <TaskRow
                    key={task.id}
                    task={task}
                    uid={uid}
                    onOpen={setPreview}
                  />
                ),
              )}
            </section>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* The inline padding keeps the composer clear of the iPhone home
          indicator, and resolves to zero anywhere without an inset. */}
      <div
        className="relative shrink-0 border-t border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Sits above the composer on the right, the corner the desktop app
            keeps its jump-to-newest button in. Shown while anything is unread
            and while the filter is on, so there is always a way back out of
            it. */}
        {/* Always here, so it reads as a filter you can reach rather than a
            notification that appears and vanishes. The count on it is the
            part that comes and goes. */}
        <div className="pointer-events-none absolute -top-14 right-4 z-20 sm:right-5">
          <div className="pointer-events-auto">
            <MentionBadge
              count={unread.length}
              active={mentionsOnly}
              label={
                mentionsOnly
                  ? t("collab.showAll")
                  : t("collab.showMentions", { count: unread.length })
              }
              onClick={() => {
                const next = !mentionsOnly;
                setMentionsOnly(next);
                // Opening the filter is the moment they have been read —
                // they are all on screen and nothing else would ever clear
                // the badge.
                if (next && unread.length)
                  markAllMentionsRead(uid, mentions).catch((err) =>
                    console.warn("Could not mark read:", err.message),
                  );
              }}
            />
          </div>
        </div>
        {notice && (
          <p
            role="alert"
            className="mx-auto w-full max-w-[720px] px-5 pt-2.5 text-[12px] text-red-600 dark:text-red-400"
          >
            {notice}
          </p>
        )}

        {pending && (
          <div className="mx-auto flex w-full max-w-[720px] items-center gap-2 px-4 pt-3 sm:px-5">
            {pending.type === "image" ? (
              <img
                src={pending.previewUrl}
                alt={pending.name}
                className="h-12 w-12 rounded-lg border border-neutral-200 object-cover dark:border-neutral-700"
              />
            ) : (
              <FileTypeIcon fileName={pending.name} size={28} />
            )}
            <span
              className={`min-w-0 flex-1 truncate text-[12px] ${
                pending.uploading
                  ? "animate-pulse text-neutral-400 dark:text-neutral-500"
                  : "text-neutral-500 dark:text-neutral-400"
              }`}
            >
              {pending.name}
            </span>
            <button
              type="button"
              title={t("common.removeAttachment")}
              disabled={pending.uploading}
              onClick={() => {
                releasePreview();
                setPending(null);
              }}
              className="cursor-pointer rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-red-500 dark:hover:bg-neutral-700"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <form
          onSubmit={submit}
          className="mx-auto flex w-full max-w-[720px] items-center gap-3 px-4 py-3 sm:px-5"
        >
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(e) => {
              pick(e.target.files?.[0]);
              // Cleared so picking the same file twice in a row still fires.
              e.target.value = "";
            }}
          />
          <button
            type="button"
            title={t("input.attach")}
            aria-label={t("input.attach")}
            onClick={() => fileRef.current?.click()}
            className="shrink-0 cursor-pointer rounded-xl p-2.5 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
          >
            <Paperclip size={16} />
          </button>
          {/* The travelling ring is a sibling laid over the input's edge, so
              the input needs a positioned box of its own — the arrangement
              the desktop composer uses. The neutral focus border stays
              underneath it: on an engine without @property the ring simply
              does not paint, and the field would otherwise lose every sign
              that it has focus. */}
          <div className="relative flex-1">
            {/* The people this half-typed @ could mean. Above the field
                because the field is already at the bottom of the window. */}
            {suggest && suggest.list.length > 0 && (
              <div
                role="listbox"
                className="absolute bottom-12 left-0 z-30 w-full max-w-[320px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
              >
                {suggest.list.map((person, i) => (
                  <button
                    key={person.uid}
                    type="button"
                    role="option"
                    aria-selected={i === suggest.index}
                    // pointerdown, not click: the input blurs first otherwise
                    // and the menu is gone before the click lands.
                    onPointerDown={(e) => {
                      e.preventDefault();
                      choose(person);
                    }}
                    className={`flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] transition-colors ${
                      i === suggest.index
                        ? "bg-neutral-100 dark:bg-neutral-800"
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-200 text-[10px] font-bold uppercase text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                      {person.photoURL ? (
                        <img
                          src={person.photoURL}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        (person.username || person.email || "?")[0]
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-neutral-800 dark:text-neutral-100">
                      @{person.username}
                    </span>
                    <span className="min-w-0 max-w-[120px] truncate text-[11px] text-neutral-400">
                      {person.email}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <input
              ref={draftRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                refreshSuggest(e.target.value, e.target.selectionStart);
              }}
              onClick={(e) =>
                refreshSuggest(e.target.value, e.target.selectionStart)
              }
              onPaste={(e) => {
                const file = e.clipboardData?.files?.[0];
                if (!file) return;
                e.preventDefault();
                pick(file);
              }}
              onFocus={() => setComposerFocused(true)}
              onBlur={() => {
                setComposerFocused(false);
                setSuggest(null);
              }}
              // Implicit form submission on Enter is not reliable here, and
              // typing a line then pressing Enter is how the desktop app is
              // used — so the key is handled outright rather than hoped for.
              onKeyDown={(e) => {
                // While the handle menu is open it owns the arrows, Enter and
                // Tab: Enter has to finish the name being typed, not send a
                // task addressed to half of it.
                if (suggest && suggest.list.length > 0) {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    const step = e.key === "ArrowDown" ? 1 : -1;
                    setSuggest((cur) =>
                      cur
                        ? {
                            ...cur,
                            index:
                              (cur.index + step + cur.list.length) %
                              cur.list.length,
                          }
                        : cur,
                    );
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    choose(suggest.list[suggest.index]);
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setSuggest(null);
                    return;
                  }
                }
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
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-neutral-600"
            />
            {composerFocused && (
              <span
                aria-hidden="true"
                className="shine-ring"
                // rounded-xl is a 12px corner, and the ring hugs the input
                // from 1.5px outside it.
                style={{ "--shine-radius": "13.5px" }}
              />
            )}
          </div>
          <button
            type="submit"
            disabled={!draft.trim() && !pending}
            className="cursor-pointer rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-orange-500 dark:hover:bg-orange-400"
          >
            {t("input.addTask")}
          </button>
        </form>
        <div className="mx-auto flex w-full max-w-[720px] items-center gap-2.5 px-5 pb-2.5 text-[11px] text-neutral-400 dark:text-neutral-500">
          {/* The account, in the corner a desktop expects it. On a phone the
              header avatar already carries this, and a second copy down here
              would only crowd the counter. */}
          <button
            type="button"
            onClick={onOpenSettings}
            title={t("settings.title")}
            aria-label={t("settings.title")}
            className="hidden h-7 w-7 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-100 text-[11px] font-bold uppercase text-neutral-600 transition-shadow hover:shadow-md sm:flex dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            <Avatar user={user} />
          </button>
          <span>
            {t("app.counter", { done: doneToday, total: totalToday })}
          </span>
          <span className="flex-1" />
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

      {preview && <Lightbox att={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

Timeline.propTypes = {
  user: PropTypes.shape({ uid: PropTypes.string.isRequired }).isRequired,
  collab: PropTypes.shape({
    accepted: PropTypes.array.isRequired,
    mentions: PropTypes.array.isRequired,
    unread: PropTypes.array.isRequired,
    deliver: PropTypes.func.isRequired,
  }).isRequired,
  onOpenSettings: PropTypes.func.isRequired,
};

/**
 * Both corner popovers close the same way — a pointer anywhere else, or
 * Escape. Written once so the two of them cannot drift apart. It takes the
 * setter rather than a close callback because the setter is stable: a fresh
 * `() => setOpen(false)` every render would resubscribe the listeners every
 * render.
 */
function useDismiss(open, setOpen) {
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
  }, [open, setOpen]);
  return ref;
}

/**
 * The face inside the round avatar — the caller owns the circle, because the
 * header draws one and so does the corner of the composer. Google gives a
 * photo; an email/password account gets its first letter.
 */
function Avatar({ user }) {
  return user.photoURL ? (
    <img
      src={user.photoURL}
      alt=""
      referrerPolicy="no-referrer"
      className="h-full w-full object-cover"
    />
  ) : (
    (user.displayName || user.email || "?").trim()[0] || "?"
  );
}

Avatar.propTypes = {
  user: PropTypes.shape({
    email: PropTypes.string,
    displayName: PropTypes.string,
    photoURL: PropTypes.string,
  }).isRequired,
};

/**
 * The language, as a round badge rather than a native dropdown. A `select`
 * spelled the languages out in their own scripts, which at this size was a
 * word of Georgian squeezing the header on a phone; two letters fit the same
 * circle the avatar uses, and the full names are one tap behind it.
 */
function LanguageMenu({ t }) {
  const language = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, setOpen);
  const current = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("settings.general.language")}
        title={current.native}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-[11px] font-black tracking-wide text-neutral-600 transition-shadow hover:shadow-md dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
      >
        {current.short}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-30 w-44 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        >
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="menuitem"
              onClick={() => {
                setLanguage(l.code);
                setOpen(false);
              }}
              className={`flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-left text-[13px] transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                l.code === language
                  ? "font-semibold text-neutral-900 dark:text-neutral-50"
                  : "text-neutral-700 dark:text-neutral-200"
              }`}
            >
              <span className="w-6 shrink-0 text-[11px] font-black tracking-wide text-neutral-400 dark:text-neutral-500">
                {l.short}
              </span>
              {l.native}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

LanguageMenu.propTypes = { t: PropTypes.func.isRequired };

const THEME_ICONS = { light: SunMedium, dark: Moon, system: Monitor };

/**
 * Light, dark, or the machine's choice — as a round badge beside the language
 * one, because they are the same kind of decision and belong in the same
 * corner.
 *
 * The icon shows the PREFERENCE rather than what is currently on screen: on
 * "system" it stays the monitor even while the page is dark, which is the only
 * way to tell "following the machine" apart from "I chose dark".
 */
function ThemeMenu({ t }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, setOpen);
  const Icon = THEME_ICONS[theme] || Monitor;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("settings.general.appearance")}
        title={t(`settings.general.${theme}`)}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-neutral-600 transition-shadow hover:shadow-md dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
      >
        <Icon size={16} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-30 w-44 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        >
          {THEMES.map((mode) => {
            const ModeIcon = THEME_ICONS[mode];
            return (
              <button
                key={mode}
                type="button"
                role="menuitem"
                onClick={() => {
                  setTheme(mode);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-left text-[13px] transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                  mode === theme
                    ? "font-semibold text-neutral-900 dark:text-neutral-50"
                    : "text-neutral-700 dark:text-neutral-200"
                }`}
              >
                <ModeIcon
                  size={15}
                  className="shrink-0 text-neutral-400 dark:text-neutral-500"
                />
                {t(`settings.general.${mode}`)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

ThemeMenu.propTypes = { t: PropTypes.func.isRequired };

/**
 * The account, as a round avatar in the corner — where every other app puts it.
 * The email used to sit spelled out in the bar, which on a phone squeezed the
 * title until neither was readable; behind the avatar it costs no width and is
 * still one tap away. On a phone this menu is also the only way into settings,
 * so Settings sits above Sign out.
 */
function UserMenu({ user, onSignOut, onOpenSettings, t }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, setOpen);

  const label = user.email || user.displayName || user.uid;

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
        <Avatar user={user} />
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
              onOpenSettings();
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 border-b border-neutral-100 px-4 py-3 text-left text-[13px] text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <Settings size={15} />
            {t("settings.title")}
          </button>
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
  onOpenSettings: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
};

/**
 * Two addresses share this bundle: `/app` is the app, `/login` is the way in.
 *
 * Which one you get is decided by the session, not by the URL you typed —
 * opening `/app` signed out lands you on the sign-in page, and opening
 * `/login` with a session already open takes you straight through to the app.
 * The address bar is corrected to match with `replaceState`, so Back still
 * goes back to wherever you came from rather than bouncing between the two.
 *
 * This is a convenience, not a security boundary: a browser can render
 * whatever it likes, and what actually protects the data is the Firestore
 * rules refusing to answer a request without a token.
 */
const LOGIN_PATH = "/login";
const APP_PATH = "/app";

function useAuthRoute(user) {
  useEffect(() => {
    if (user === undefined) return; // still deciding; do not move anybody yet
    const here = window.location.pathname;
    const want = user ? APP_PATH : LOGIN_PATH;
    // `/` is the site, and the site is not ours to redirect. Only the two app
    // addresses are corrected against each other.
    if (here !== APP_PATH && here !== LOGIN_PATH) return;
    if (here !== want) window.history.replaceState(null, "", want);
  }, [user]);
}

export default function App() {
  const t = useT();
  const [user, setUser] = useState(undefined); // undefined = still deciding
  const [showSettings, setShowSettings] = useState(false);
  const collab = useCollab(user || null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useAuthRoute(user);

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
        className="relative z-30 shrink-0 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-14 w-full max-w-[720px] items-center gap-3 px-4 sm:px-5">
          <SteplerLogo size={32} />
          <span className="text-[17px] font-black tracking-tight text-neutral-900 dark:text-neutral-50">
            Stepler
          </span>

          <div className="ml-auto flex items-center gap-2">
            <ThemeMenu t={t} />
            <LanguageMenu t={t} />
            <UserMenu
              user={user}
              onSignOut={() => signOut(auth)}
              onOpenSettings={() => setShowSettings(true)}
              t={t}
            />
          </div>
        </div>
      </header>

      <Timeline
        user={user}
        collab={collab}
        onOpenSettings={() => setShowSettings(true)}
      />

      {showSettings && (
        <SettingsModal
          user={user}
          collab={collab}
          onClose={() => setShowSettings(false)}
          onSignOut={() => signOut(auth)}
        />
      )}
    </div>
  );
}
