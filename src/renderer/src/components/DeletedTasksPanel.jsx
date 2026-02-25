import { useEffect } from "react";
import PropTypes from "prop-types";
import { X, Undo2, Trash2, AlertCircle } from "lucide-react";

export default function DeletedTasksPanel({
  deletedTasks,
  onClose,
  onRestore,
  onPermanentDelete,
  onClearAll,
  formatTaskText,
}) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);
  const formatDeletedTime = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-500/10">
              <Trash2 size={16} className="text-red-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                Deleted Tasks
              </h2>
              <p className="text-xs text-neutral-400 dark:text-neutral-500">
                {deletedTasks.length}{" "}
                {deletedTasks.length === 1 ? "task" : "tasks"} in trash
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          >
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {deletedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-400 dark:text-neutral-600">
              <Trash2 size={36} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">Trash is empty</p>
              <p className="mt-1 text-xs opacity-60">
                Deleted tasks will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {deletedTasks.map((task) => (
                <div
                  key={task.id}
                  className="group flex items-start gap-3 px-6 py-3.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                >
                  <div className="min-w-0 flex-1 pt-0.5">
                    <span className="block whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                      {formatTaskText(task.text)}
                    </span>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                        Deleted {formatDeletedTime(task.deletedAt)}
                      </span>
                      {task.completed && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                          Completed
                        </span>
                      )}
                      {task.subtasks && task.subtasks.length > 0 && (
                        <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                          · {task.subtasks.length} {task.subtasks.length === 1 ? "subtask" : "subtasks"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 pt-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => onRestore(task.id)}
                      className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-blue-50 hover:text-blue-500 dark:text-neutral-500 dark:hover:bg-blue-500/10 dark:hover:text-blue-400"
                      title="Restore task"
                    >
                      <Undo2 size={15} />
                    </button>
                    <button
                      onClick={() => onPermanentDelete(task.id)}
                      className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-neutral-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                      title="Delete forever"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {deletedTasks.length > 0 && (
          <div className="flex items-center justify-between border-t border-neutral-200 px-6 py-3 dark:border-neutral-800">
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 dark:text-neutral-500">
              <AlertCircle size={12} />
              <span>Deleted tasks persist until cleared</span>
            </div>
            <button
              onClick={onClearAll}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              Clear All
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

DeletedTasksPanel.propTypes = {
  deletedTasks: PropTypes.array.isRequired,
  onClose: PropTypes.func.isRequired,
  onRestore: PropTypes.func.isRequired,
  onPermanentDelete: PropTypes.func.isRequired,
  onClearAll: PropTypes.func.isRequired,
  formatTaskText: PropTypes.func.isRequired,
};
