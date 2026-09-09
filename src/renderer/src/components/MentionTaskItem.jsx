import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { AtSign, Check, Plus, Star, Trash2 } from "lucide-react";
import { formatTaskText } from "../lib/format";
import { useT } from "../lib/i18n";

/**
 * A task somebody else wrote and addressed to you.
 *
 * Read-only, and visibly so: no checkbox to tick, no star, no bin. It is a
 * copy of a line in another person's day, delivered so you can act on it in
 * your own. Ticking it here would change nothing on the machine that owns it,
 * and a control that silently does nothing is worse than no control at all.
 *
 * Shared by the window and the web app so a mention looks the same wherever
 * you happen to read it.
 */
export function MentionTaskItem({
  mention,
  onMarkRead,
  onToggle,
  onPriority,
  onSubtaskToggle,
  onAddSubtask,
  onDismiss,
}) {
  const t = useT();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);
  const who = mention.fromUsername
    ? `@${mention.fromUsername}`
    : mention.fromName || mention.fromEmail;

  // Finished subtasks settle to the top, the way they do everywhere else.
  const subtasks = [...(mention.subtasks || [])].sort((a, b) =>
    a.completed === b.completed ? 0 : a.completed ? -1 : 1,
  );

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const submit = () => {
    const text = draft.trim();
    if (text) onAddSubtask(mention, text);
    setDraft("");
    setAdding(false);
  };

  return (
    // Deliberately the same box as a task you wrote yourself: a coloured bar
    // and a tinted background made these read as a different kind of object,
    // when the only thing that actually differs is that somebody else wrote
    // it — which the line above the text already says.
    <div className="group relative flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-neutral-100/70 dark:hover:bg-neutral-800/50">
      {/* A real checkbox, not the dashed placeholder this used to be: ticking
          a task somebody asked you to do is the whole point of being told
          about it, and it travels back to them. */}
      <button
        type="button"
        title={mention.completed ? t("task.markNotDone") : t("task.markDone")}
        onClick={() => onToggle(mention, !mention.completed)}
        className={`mt-[3px] flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-md border transition-all ${
          mention.completed
            ? "border-orange-500 bg-orange-500 text-white"
            : "border-neutral-300 hover:border-orange-400 dark:border-neutral-600"
        }`}
      >
        {mention.completed && <Check size={12} strokeWidth={3.5} />}
      </button>

      <div className="min-w-0 flex-1">
        {/* Who this came from. Unread is worth showing, but as a shade on
            this one line rather than as a differently-coloured row. */}
        <p
          className={`mb-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold ${
            mention.read
              ? "text-neutral-400 dark:text-neutral-500"
              : "text-orange-600 dark:text-orange-400"
          }`}
        >
          <AtSign size={11} className="shrink-0" />
          <span>{who}</span>
          <span className="font-normal text-neutral-400 dark:text-neutral-500">
            {t("collab.mentionedYou")}
          </span>
        </p>

        {/* The words belong to whoever wrote them — there is no edit here,
            and the rules refuse one. */}
        <div
          className={`relative whitespace-pre-wrap break-words text-sm leading-relaxed ${
            mention.completed
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
          {mention.priority && !mention.completed && (
            <Star
              size={14}
              fill="currentColor"
              className="mb-0.5 mr-1.5 inline text-amber-500 dark:text-amber-400"
            />
          )}
          {formatTaskText(mention.text)}
        </div>

        {subtasks.length > 0 && (
          <div className="relative mt-2 space-y-1 pl-1">
            {subtasks.map((st, index) => (
              <div
                key={st.id ?? `st-${index}`}
                className="group/subtask relative flex items-start gap-2 rounded-lg p-1 transition-colors hover:bg-neutral-200/40 dark:hover:bg-neutral-800/60"
              >
                {index === subtasks.length - 1 ? (
                  <span className="tree-corner pointer-events-none absolute -left-[25px] top-0 h-[14px] w-[25px]" />
                ) : (
                  <>
                    <span className="tree-line pointer-events-none absolute -bottom-1 -left-[25px] top-0 w-px" />
                    <span className="tree-line pointer-events-none absolute -left-[25px] top-[13px] h-px w-[25px]" />
                  </>
                )}
                <button
                  type="button"
                  title={
                    st.completed ? t("task.markNotDone") : t("task.markDone")
                  }
                  onClick={() => onSubtaskToggle(mention, st.id, !st.completed)}
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
                </div>
              </div>
            ))}
          </div>
        )}

        {adding ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
            placeholder={t("task.newSubtask")}
            className="mt-2 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[13px] text-neutral-800 outline-none focus:border-orange-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-1.5 flex cursor-pointer items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-semibold text-neutral-400 opacity-0 transition-all hover:text-orange-500 focus:opacity-100 group-hover:opacity-100 dark:text-neutral-500"
          >
            <Plus size={12} />
            {t("task.addSubtask")}
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          title={t("task.priority")}
          onClick={() => onPriority(mention, !mention.priority)}
          className={`cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700 ${
            mention.priority
              ? "text-orange-500"
              : "text-neutral-400 dark:text-neutral-500"
          }`}
        >
          <Star size={14} fill={mention.priority ? "currentColor" : "none"} />
        </button>

        {/* The bin takes it off YOUR list and leaves the author's task alone —
            deleting somebody else's task is not yours to do, and the rules
            refuse it anyway. The title says so, because a bin icon on its own
            promises rather more than this does. */}
        <button
          type="button"
          title={`${t("collab.dismiss")} — ${t("collab.dismissHint")}`}
          aria-label={t("collab.dismiss")}
          onClick={() => onDismiss(mention)}
          className="cursor-pointer rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-neutral-500 dark:hover:bg-red-950/40"
        >
          <Trash2 size={14} />
        </button>

        {!mention.read && (
          <button
            type="button"
            onClick={() => onMarkRead(mention.id)}
            className="cursor-pointer rounded-lg px-2 py-1 text-[11px] font-semibold text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
          >
            {t("collab.markRead")}
          </button>
        )}
      </div>
    </div>
  );
}

MentionTaskItem.propTypes = {
  mention: PropTypes.shape({
    id: PropTypes.string.isRequired,
    text: PropTypes.string,
    read: PropTypes.bool,
    completed: PropTypes.bool,
    priority: PropTypes.bool,
    subtasks: PropTypes.array,
    fromUid: PropTypes.string,
    fromUsername: PropTypes.string,
    fromName: PropTypes.string,
    fromEmail: PropTypes.string,
  }).isRequired,
  onMarkRead: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired,
  onPriority: PropTypes.func.isRequired,
  onSubtaskToggle: PropTypes.func.isRequired,
  onAddSubtask: PropTypes.func.isRequired,
  onDismiss: PropTypes.func.isRequired,
};

/**
 * The round @ button in the corner: how many people have addressed something
 * to you, and a way to see only those.
 */
export function MentionBadge({
  count,
  active,
  onClick,
  label,
  className,
  style,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      style={style}
      className={`group relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-all ${
        active
          ? "border-orange-500 bg-orange-500 text-white"
          : "border-neutral-200 bg-white/80 text-neutral-600 hover:bg-white hover:text-orange-500 dark:border-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-400"
      } ${className || ""}`}
    >
      {/* The pulse is a sibling ring rather than an animation on the button
          itself, so the thing being aimed at is never mid-scale under the
          pointer. It runs only while something is genuinely unread. */}
      {count > 0 && !active && (
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-ping rounded-full bg-orange-500/30"
        />
      )}
      <AtSign size={18} strokeWidth={2.5} />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-black leading-none text-white ring-2 ring-white dark:ring-neutral-900">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

MentionBadge.propTypes = {
  count: PropTypes.number.isRequired,
  active: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
  label: PropTypes.string.isRequired,
  className: PropTypes.string,
  style: PropTypes.object,
};
