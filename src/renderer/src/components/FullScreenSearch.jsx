import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { labelForYMD, localYMD, taskTimestamp } from "../lib/format";
import { copyTask } from "../lib/attachments";
import {
  Search,
  X,
  Circle,
  CheckCircle2,
  Star,
  Copy,
  CornerDownRight,
  Hash,
  Bell,
  Paperclip,
} from "lucide-react";

export default function FullScreenSearch({
  onClose,
  tasks,
  onJumpToTask,
  onToggleTask,
  onTogglePriority,
  onDeleteTask,
  onAddSubtask,
  onRemind,
  onAssignProject,
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const resultRefs = useRef([]);

  // The overlay is mounted only while it is open, so its draft state resets
  // on its own — no effect needs to reach in and clear it.
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(id);
  }, []);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    // One flat list: every task carries the day it was written on.
    const today = localYMD(new Date());
    const all = tasks.map((t) => {
      const stamp = taskTimestamp(t.id);
      const ymd = stamp ? localYMD(stamp) : today;
      const isToday = ymd >= today;
      return {
        ...t,
        ymd: isToday ? null : ymd,
        dateLabel: isToday ? "Today" : labelForYMD(ymd),
      };
    });
    return all
      .filter((t) => {
        // Search everything the note actually carries — the old version only
        // looked at the text and a legacy single-project field.
        if ((t.text || "").toLowerCase().includes(q)) return true;
        if ((t.projects || []).some((p) => p.toLowerCase().includes(q)))
          return true;
        if ((t.jiraKey || "").toLowerCase().includes(q)) return true;
        if ((t.attachment?.name || "").toLowerCase().includes(q)) return true;
        if (
          (t.subtasks || []).some((st) =>
            (st.text || "").toLowerCase().includes(q),
          )
        )
          return true;
        return false;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return (parseInt(b.id, 10) || 0) - (parseInt(a.id, 10) || 0);
      })
      .slice(0, 200);
  }, [tasks, query]);

  useEffect(() => {
    if (selectedIndex >= 0 && resultRefs.current[selectedIndex])
      resultRefs.current[selectedIndex].scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
  }, [selectedIndex]);

  const handleJump = useCallback(
    (task) => onJumpToTask(task.id, task.ymd),
    [onJumpToTask],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
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
        const target = searchResults[selectedIndex >= 0 ? selectedIndex : 0];
        if (target) handleJump(target);
      }
    },
    [onClose, searchResults, selectedIndex, handleJump],
  );

  const pill =
    "btn-tactile flex items-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 text-neutral-500 shadow-sm backdrop-blur-md transition-colors hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700/50";

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center bg-white/90 p-8 backdrop-blur-xl dark:bg-black/90"
      onClick={onClose}
    >
      <div
        className="mt-16 w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative mb-8">
          <Search className="absolute left-6 top-1/2 h-8 w-8 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search tasks, projects, files…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            className="w-full rounded-2xl border-none bg-transparent py-6 pl-20 pr-6 text-4xl font-medium text-neutral-900 placeholder:text-neutral-300 focus:outline-none dark:text-white dark:placeholder:text-neutral-700"
          />
          <div className="absolute bottom-0 left-6 right-6 h-px bg-neutral-200 dark:bg-neutral-800" />
        </div>

        <div className="custom-scrollbar max-h-[60vh] flex-1 overflow-y-auto px-6">
          {query.trim() && searchResults.length === 0 && (
            <div className="mt-12 text-center text-lg text-neutral-400">
              No tasks found
            </div>
          )}

          <div className="space-y-3">
            {searchResults.map((task, idx) => (
              <div
                key={`${task.ymd || "today"}-${task.id}`}
                ref={(el) => (resultRefs.current[idx] = el)}
                onClick={() => handleJump(task)}
                className={`flex cursor-pointer flex-col gap-2 rounded-2xl border bg-white/50 p-5 backdrop-blur-sm transition-all dark:bg-neutral-900/50 ${
                  selectedIndex === idx
                    ? "border-blue-400 bg-blue-50/50 ring-2 ring-blue-400/30 dark:border-blue-500 dark:bg-blue-900/20"
                    : "border-neutral-100 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/80"
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleTask(task.id);
                    }}
                    className="btn-tactile mt-0.5 shrink-0 text-neutral-400 transition-colors hover:text-blue-500 dark:text-neutral-500"
                  >
                    {task.completed ? (
                      <CheckCircle2
                        size={18}
                        className="icon-rubbery text-blue-500"
                      />
                    ) : (
                      <Circle size={18} className="icon-rubbery" />
                    )}
                  </button>
                  <div
                    className={`flex-1 whitespace-pre-wrap text-lg ${
                      task.completed
                        ? "text-neutral-400 line-through"
                        : "text-neutral-800 dark:text-neutral-200"
                    }`}
                  >
                    {task.text || ""}
                  </div>
                </div>

                {task.subtasks?.length > 0 && (
                  <div className="space-y-1 border-l-2 border-neutral-200 pl-9 dark:border-neutral-700">
                    {task.subtasks.map((st) => (
                      <div
                        key={st.id}
                        className={`text-sm ${st.completed ? "text-neutral-400 line-through" : "text-neutral-600 dark:text-neutral-400"}`}
                      >
                        • {st.text}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-neutral-400 dark:text-neutral-500">
                      {task.dateLabel}
                    </span>
                    {(task.projects || []).map((p) => (
                      <span
                        key={p}
                        className="flex shrink-0 items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                      >
                        <Hash size={11} />
                        {p}
                      </span>
                    ))}
                    {task.attachment && (
                      <span className="flex shrink-0 items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                        <Paperclip size={11} />
                        {task.attachment.name}
                      </span>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddSubtask(task.id);
                      }}
                      className={pill}
                    >
                      <CornerDownRight size={12} className="icon-rubbery" />
                      <span className="text-[11px] font-medium leading-none">
                        Subtask
                      </span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePriority(task.id);
                      }}
                      className={
                        task.priority
                          ? "btn-tactile flex items-center gap-1.5 rounded-full border border-amber-200/60 bg-amber-100 px-2 py-1 text-amber-600 shadow-sm dark:border-amber-900/50 dark:bg-amber-900/30 dark:text-amber-400"
                          : pill
                      }
                    >
                      <Star
                        size={12}
                        fill={task.priority ? "currentColor" : "none"}
                        className="icon-rubbery"
                      />
                      <span className="text-[11px] font-medium leading-none">
                        Priority
                      </span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAssignProject(task.id);
                      }}
                      className={pill}
                    >
                      <Hash size={12} className="icon-rubbery" />
                      <span className="text-[11px] font-medium leading-none">
                        Project
                      </span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemind(task.id);
                      }}
                      className={pill}
                    >
                      <Bell size={12} className="icon-rubbery" />
                      <span className="text-[11px] font-medium leading-none">
                        Remind
                      </span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyTask(task);
                      }}
                      className={pill}
                    >
                      <Copy size={12} className="icon-rubbery" />
                      <span className="text-[11px] font-medium leading-none">
                        Copy
                      </span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTask(e, task.id);
                      }}
                      className="btn-tactile flex items-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 text-neutral-500 shadow-sm backdrop-blur-md transition-colors hover:border-red-200/60 hover:bg-red-50 hover:text-red-500 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400"
                    >
                      <X size={12} className="icon-rubbery" />
                      <span className="text-[11px] font-medium leading-none">
                        Delete
                      </span>
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
        className="btn-tactile absolute right-8 top-8 rounded-full p-3 text-neutral-500 transition-colors hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50"
        title="Close (Esc)"
      >
        <X size={24} className="icon-rubbery" />
      </button>
    </div>
  );
}

FullScreenSearch.propTypes = {
  onClose: PropTypes.func.isRequired,
  tasks: PropTypes.array.isRequired,
  onJumpToTask: PropTypes.func.isRequired,
  onToggleTask: PropTypes.func.isRequired,
  onTogglePriority: PropTypes.func.isRequired,
  onDeleteTask: PropTypes.func.isRequired,
  onAddSubtask: PropTypes.func.isRequired,
  onRemind: PropTypes.func.isRequired,
  onAssignProject: PropTypes.func.isRequired,
};
