import PropTypes from "prop-types";
import { AtSign } from "lucide-react";
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
export function MentionTaskItem({ mention, onMarkRead }) {
  const t = useT();
  const who = mention.fromUsername
    ? `@${mention.fromUsername}`
    : mention.fromName || mention.fromEmail;

  return (
    <div
      className={`group relative flex items-start gap-3 rounded-xl border-l-2 py-2 pl-3 pr-2 transition-colors ${
        mention.read
          ? "border-l-neutral-200 dark:border-l-neutral-700"
          : "border-l-orange-500 bg-orange-50/50 dark:bg-orange-500/[0.06]"
      }`}
    >
      <span
        aria-hidden="true"
        className="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border border-dashed border-neutral-300 text-neutral-400 dark:border-neutral-600 dark:text-neutral-500"
      >
        <AtSign size={11} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="mb-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-orange-600 dark:text-orange-400">
          <span>{who}</span>
          <span className="font-normal text-neutral-400 dark:text-neutral-500">
            {t("collab.mentionedYou")}
          </span>
        </p>
        <div
          className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${
            mention.completed
              ? "text-neutral-400 line-through dark:text-neutral-600"
              : "text-neutral-800 dark:text-neutral-100"
          }`}
        >
          {formatTaskText(mention.text)}
        </div>
      </div>

      {!mention.read && (
        <button
          type="button"
          onClick={() => onMarkRead(mention.id)}
          className="shrink-0 cursor-pointer self-center rounded-lg px-2 py-1 text-[11px] font-semibold text-neutral-500 opacity-0 transition-all hover:bg-neutral-200 hover:text-neutral-800 focus:opacity-100 group-hover:opacity-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
        >
          {t("collab.markRead")}
        </button>
      )}
    </div>
  );
}

MentionTaskItem.propTypes = {
  mention: PropTypes.shape({
    id: PropTypes.string.isRequired,
    text: PropTypes.string,
    read: PropTypes.bool,
    completed: PropTypes.bool,
    fromUsername: PropTypes.string,
    fromName: PropTypes.string,
    fromEmail: PropTypes.string,
  }).isRequired,
  onMarkRead: PropTypes.func.isRequired,
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
