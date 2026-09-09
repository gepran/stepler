import PropTypes from "prop-types";
import { Undo2, Trash2, AlertCircle } from "lucide-react";
import { formatTaskText } from "../lib/format";
import { formatDate, translatePlural as tPlural, useT } from "../lib/i18n";

/**
 * The trash is somewhere you go looking once in a while, not somewhere you
 * navigate to — so it lives inside Settings and renders without a shell of its
 * own. Settings already owns the overlay, the close button and Escape; a
 * second modal stacked on top of it meant one Escape closed both, because a
 * stopPropagation on one window listener does nothing to a sibling listener on
 * the same target.
 */
export default function DeletedTasksList({
  deletedTasks,
  onRestore,
  onPermanentDelete,
  onClearAll,
}) {
  const t = useT();
  const formatDeletedTime = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60_000) return t("trash.justNow");
    if (diff < 3_600_000)
      return t("trash.minutesAgo", { count: Math.floor(diff / 60_000) });
    if (diff < 86_400_000)
      return t("trash.hoursAgo", { count: Math.floor(diff / 3_600_000) });
    return formatDate(d, { month: "short", day: "numeric" });
  };

  if (deletedTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-neutral-200 py-16 text-neutral-400 dark:border-neutral-800 dark:text-neutral-600">
        <Trash2 size={36} className="mb-3 opacity-30" />
        <p className="text-sm font-medium">{t("trash.empty")}</p>
        <p className="mt-1 text-xs opacity-60">{t("trash.emptyHint")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-neutral-200 dark:border-neutral-800">
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
        {deletedTasks.map((task) => (
          <div
            key={task.id}
            className="group flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
          >
            <div className="min-w-0 flex-1 pt-0.5">
              <span className="block whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                {formatTaskText(task.text)}
              </span>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                  {t("trash.deletedAt", {
                    when: formatDeletedTime(task.deletedAt),
                  })}
                </span>
                {task.completed && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                    {t("trash.completed")}
                  </span>
                )}
                {task.subtasks && task.subtasks.length > 0 && (
                  <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                    · {tPlural("trash.subtaskCount", task.subtasks.length)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 pt-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => onRestore(task.id)}
                className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-blue-50 hover:text-blue-500 dark:text-neutral-500 dark:hover:bg-blue-500/10 dark:hover:text-blue-400"
                title={t("trash.restore")}
              >
                <Undo2 size={15} />
              </button>
              <button
                onClick={() => onPermanentDelete(task.id)}
                className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-neutral-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                title={t("trash.deleteForever")}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-neutral-200 px-5 py-3 dark:border-neutral-800">
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 dark:text-neutral-500">
          <AlertCircle size={12} />
          <span>{t("trash.persistNote")}</span>
        </div>
        <button
          onClick={onClearAll}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
        >
          {t("trash.clearAll")}
        </button>
      </div>
    </div>
  );
}

DeletedTasksList.propTypes = {
  deletedTasks: PropTypes.array.isRequired,
  onRestore: PropTypes.func.isRequired,
  onPermanentDelete: PropTypes.func.isRequired,
  onClearAll: PropTypes.func.isRequired,
};
