import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import {
  Search,
  Briefcase,
  CalendarDays,
  X,
  Circle,
  CheckCircle2,
  Star,
  Copy,
  CornerDownRight,
  Hash,
  Bell,
} from "lucide-react";

export default function FullScreenSearch({
  show,
  onClose,
  tasks,
  history,
  onJumpToTask,
  onToggleTask,
  onTogglePriority,
  onCopyTask,
  onDeleteTask,
  onAddSubtask,
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const resultRefs = useRef([]);

  useEffect(() => {
    if (show) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setTimeout(() => {
        setQuery("");
        setSelectedIndex(-1);
      }, 300);
    }
  }, [show]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const lowerQ = query.toLowerCase();
    const allTasks = [
      ...tasks.map((t) => ({ ...t, dateLabel: "Today" })),
      ...history.flatMap((day) =>
        day.tasks.map((t) => ({ ...t, dateLabel: day.date })),
      ),
    ];

    return allTasks
      .filter(
        (t) =>
          (t.text || t.title || "").toLowerCase().includes(lowerQ) ||
          t.project?.toLowerCase().includes(lowerQ) ||
          t.subtasks?.some((st) =>
            (st.text || "").toLowerCase().includes(lowerQ),
          ),
      )
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const idA = parseInt(a.id || 0, 10);
        const idB = parseInt(b.id || 0, 10);
        return idB - idA;
      });
  }, [tasks, history, query]);

  // Scroll selected result into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultRefs.current[selectedIndex]) {
      resultRefs.current[selectedIndex].scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedIndex]);

  const handleJump = useCallback(
    (task) => {
      onJumpToTask(task.id, task.dateLabel);
    },
    [onJumpToTask],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : prev,
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (selectedIndex >= 0 && searchResults[selectedIndex]) {
          handleJump(searchResults[selectedIndex]);
        }
      }
    },
    [onClose, searchResults, selectedIndex, handleJump],
  );

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center bg-white/80 dark:bg-black/80 backdrop-blur-xl transition-all duration-300 p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl mt-16"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative mb-8">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 w-8 h-8" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search tasks..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-4xl font-medium text-neutral-900 dark:text-white rounded-2xl pl-20 pr-6 py-6 border-none focus:outline-none focus:ring-0 placeholder:text-neutral-300 dark:placeholder:text-neutral-700"
          />
          <div className="absolute bottom-0 left-6 right-6 h-px bg-neutral-200 dark:bg-neutral-800" />
        </div>

        <div className="flex-1 overflow-y-auto max-h-[60vh] custom-scrollbar px-6">
          {query.trim() && searchResults.length === 0 && (
            <div className="text-center text-neutral-400 text-lg mt-12">
              No tasks found
            </div>
          )}

          <div className="space-y-3">
            {searchResults.map((task, idx) => (
              <div
                key={task.id}
                ref={(el) => (resultRefs.current[idx] = el)}
                onClick={() => handleJump(task)}
                className={`bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm border p-5 rounded-2xl flex flex-col gap-2 transition-all cursor-pointer ${
                  selectedIndex === idx
                    ? "border-blue-400 dark:border-blue-500 ring-2 ring-blue-400/30 bg-blue-50/50 dark:bg-blue-900/20"
                    : "border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/80"
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleTask(task.id);
                    }}
                    className="btn-tactile mt-0.5 shrink-0 text-neutral-400 transition-colors hover:text-blue-500 focus:outline-none dark:text-neutral-500 dark:hover:text-blue-400"
                  >
                    {task.completed ? (
                      <CheckCircle2 size={18} className="icon-rubbery text-blue-500" />
                    ) : (
                      <Circle size={18} className="icon-rubbery" />
                    )}
                  </button>
                  <div
                    className={`flex-1 text-lg ${task.completed ? "text-neutral-400 line-through" : "text-neutral-800 dark:text-neutral-200"}`}
                  >
                    {task.text || task.title || ""}
                  </div>
                </div>

                {task.subtasks?.length > 0 && (
                  <div className="pl-9 border-l-2 border-neutral-200 dark:border-neutral-700 space-y-1">
                    {[...task.subtasks]
                      .sort((a, b) =>
                        b.completed === a.completed
                          ? 0
                          : a.completed
                            ? -1
                            : 1,
                      )
                      .map((st) => (
                        <div
                          key={st.id}
                          className={`text-sm ${st.completed ? "text-neutral-400 line-through" : "text-neutral-600 dark:text-neutral-400"}`}
                        >
                          • {st.text}
                        </div>
                      ))}
                  </div>
                )}

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-neutral-400 dark:text-neutral-500 font-medium">
                      {task.dateLabel}
                    </div>
                    {(task.project || task.dueDate) && (
                      <div className="flex flex-wrap items-center gap-2">
                        {task.project && (
                          <div className="flex shrink-0 items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                            <Briefcase size={12} />
                            <span>{task.project}</span>
                          </div>
                        )}
                        {task.dueDate && (
                          <div className="flex shrink-0 items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                            <CalendarDays size={12} />
                            <span>{task.dueDate}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddSubtask(task.id, task.dateLabel);
                      }}
                      className="btn-tactile flex items-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 text-neutral-500 shadow-sm backdrop-blur-md transition-colors hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700/50"
                    >
                      <CornerDownRight size={12} className="icon-rubbery" />
                      <span className="text-[11px] font-medium leading-none">Subtask</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePriority(task.id);
                      }}
                      className={`btn-tactile flex items-center gap-1.5 rounded-full border px-2 py-1 shadow-sm backdrop-blur-md transition-colors ${
                        task.priority
                          ? "border-amber-200/60 bg-amber-100 text-amber-600 dark:border-amber-900/50 dark:bg-amber-900/30 dark:text-amber-400"
                          : "border-neutral-200/60 bg-white/60 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700/50"
                      }`}
                    >
                      <Star size={12} fill={task.priority ? "currentColor" : "none"} className="icon-rubbery" />
                      <span className="text-[11px] font-medium leading-none">Priority</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJump(task);
                      }}
                      className="btn-tactile flex items-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 text-neutral-500 shadow-sm backdrop-blur-md transition-colors hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700/50"
                    >
                      <Hash size={12} className="icon-rubbery" />
                      <span className="text-[11px] font-medium leading-none">Project</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJump(task);
                      }}
                      className="btn-tactile flex items-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 text-neutral-500 shadow-sm backdrop-blur-md transition-colors hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700/50"
                    >
                      <Bell size={12} className="icon-rubbery" />
                      <span className="text-[11px] font-medium leading-none">Remind</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopyTask(e, task);
                      }}
                      className="btn-tactile flex items-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 text-neutral-500 shadow-sm backdrop-blur-md transition-colors hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700/50"
                    >
                      <Copy size={12} className="icon-rubbery" />
                      <span className="text-[11px] font-medium leading-none">Copy</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTask(e, task.id);
                      }}
                      className="btn-tactile flex items-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 text-neutral-500 shadow-sm backdrop-blur-md transition-colors hover:border-red-200/60 hover:bg-red-50 hover:text-red-500 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:border-red-900/50 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                    >
                      <X size={12} className="icon-rubbery" />
                      <span className="text-[11px] font-medium leading-none">Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={onClose}
        className="btn-tactile absolute top-8 right-8 p-3 rounded-full hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 text-neutral-500 transition-colors"
      >
        <X size={24} className="icon-rubbery" />
      </button>
    </div>
  );
}

FullScreenSearch.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  tasks: PropTypes.array.isRequired,
  history: PropTypes.array.isRequired,
  onJumpToTask: PropTypes.func.isRequired,
  onToggleTask: PropTypes.func.isRequired,
  onTogglePriority: PropTypes.func.isRequired,
  onCopyTask: PropTypes.func.isRequired,
  onDeleteTask: PropTypes.func.isRequired,
  onAddSubtask: PropTypes.func.isRequired,
};
