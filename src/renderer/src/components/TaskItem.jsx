import PropTypes from "prop-types";
import {
  Circle,
  CheckCircle2,
  GripVertical,
  X,
  FileText,
  Bell,
  Star,
  Maximize2,
  CornerDownRight,
  Hash,
  Calendar,
  Copy,
} from "lucide-react";

export default function TaskItem({
  task,
  formatTaskText,
  formatTaskDateTime,
  // Editing
  editingId,
  setEditingId,
  editText,
  setEditText,
  editCaretPositionRef,
  saveEdit,
  // Subtask editing
  editingSubtaskId,
  setEditingSubtaskId,
  editSubtaskText,
  setEditSubtaskText,
  saveSubtaskEdit,
  // Subtask adding
  addingSubtaskId,
  setAddingSubtaskId,
  newSubtaskText,
  setNewSubtaskText,
  addSubtask,
  handleSubtaskPaste,
  pendingSubtaskAttachment,
  setPendingSubtaskAttachment,
  // Project assigning
  assigningProjectId,
  setAssigningProjectId,
  setTasks,
  // Reminder
  settingReminderId,
  setSettingReminderId,
  reminderTime,
  setReminderTime,
  saveReminder,
  // Actions
  toggleTask,
  togglePriority,
  toggleSubtask,
  removeAttachment,
  triggerDeleteTask,
  triggerDeleteSubtask,
  handleCopyTask,
  handleCopyImage,
  setPreviewImage,
  // Drag & Drop
  dragOverId,
  dragOverPosition,
  activeDragHandleId,
  setActiveDragHandleId,
  handleDragStart,
  handleDragEnd,
  handleDragOverTask,
  handleDragLeaveTask,
  handleDropOnTask,
  handleDropAction,
}) {
  const dt = formatTaskDateTime(task.id);

  return (
    <div
      id={`task-${task.id}`}
      key={task.id}
      className={`group/task relative flex items-start rounded-xl p-2 transition-all duration-300 ease-out will-change-transform ${
        task.completed
          ? "opacity-40 hover:opacity-70"
          : "hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40"
      } ${
        dragOverId === task.id && dragOverPosition === "child"
          ? "scale-[1.02] -translate-y-[2px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-white dark:bg-neutral-900 z-20 border border-blue-200 dark:border-blue-800/50 ring-4 ring-blue-500/20"
          : "border border-transparent z-10"
      }`}
      draggable={activeDragHandleId === task.id}
      onDragStart={(e) => handleDragStart(e, "task", task.id)}
      onDragEnd={handleDragEnd}
      onDragOver={(e) => handleDragOverTask(e, task.id)}
      onDragLeave={(e) => handleDragLeaveTask(e, task.id)}
      onDrop={(e) => handleDropOnTask(e, task.id)}
    >
      {dt && (
        <div className="absolute right-full inset-y-0 flex items-center pr-8 opacity-0 transition-opacity duration-200 group-hover/task:opacity-100 pointer-events-none z-10">
          <span className="whitespace-nowrap text-[13px] font-medium leading-none tracking-wide text-neutral-400 dark:text-neutral-500">
            {dt.time}
          </span>
        </div>
      )}
      {dragOverId === task.id && dragOverPosition === "top" && (
        <div className="absolute -top-0.5 left-0 right-0 h-[3px] rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] z-30 pointer-events-none" />
      )}
      {dragOverId === task.id && dragOverPosition === "bottom" && (
        <div className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] z-30 pointer-events-none" />
      )}
      <div
        className="mt-1 ml-1 flex shrink-0 items-center justify-center w-4 mr-1 opacity-0 transition-opacity group-hover/task:opacity-100 cursor-grab active:cursor-grabbing text-neutral-400 dark:text-neutral-500"
        onMouseEnter={() => setActiveDragHandleId(task.id)}
        onMouseLeave={() => setActiveDragHandleId(null)}
      >
        <GripVertical size={14} />
      </div>
      <button
        onClick={() => toggleTask(task.id)}
        className="mt-1 mr-3 shrink-0 text-neutral-400 transition-colors hover:text-blue-500 focus:outline-none dark:text-neutral-500 dark:hover:text-blue-400"
      >
        {task.completed ? (
          <CheckCircle2 size={18} className="text-blue-500" />
        ) : (
          <Circle size={18} />
        )}
      </button>
      <div className="min-w-0 flex-1">
        {editingId === task.id ? (
          <textarea
            autoFocus
            ref={(el) => {
              if (el && !el.dataset.initialized) {
                el.dataset.initialized = "true";
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 300) + "px";
                if (editCaretPositionRef.current !== null) {
                  el.setSelectionRange(
                    editCaretPositionRef.current,
                    editCaretPositionRef.current,
                  );
                  editCaretPositionRef.current = null;
                }
              }
            }}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={() => saveEdit(task.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (!e.shiftKey) {
                  e.preventDefault();
                  saveEdit(task.id);
                }
              } else if (e.key === "Escape") {
                setEditingId(null);
              }
            }}
            onInput={(e) => {
              e.target.style.height = "auto";
              e.target.style.height =
                Math.min(e.target.scrollHeight, 300) + "px";
            }}
            className="w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-[15px] leading-relaxed text-neutral-800 shadow-sm focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:focus:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 min-h-[60px]"
          />
        ) : (
          <span
            onClick={(e) => {
              if (e.target.tagName !== "A") {
                const currentText = task.text || task.title || "";
                let offset = currentText.length;
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                  const range = selection.getRangeAt(0);
                  const preCaretRange = range.cloneRange();
                  preCaretRange.selectNodeContents(e.currentTarget);
                  preCaretRange.setEnd(range.startContainer, range.startOffset);
                  offset = preCaretRange.toString().length;
                }
                editCaretPositionRef.current = offset;
                setEditingId(task.id);
                setEditText(task.text);
              }
            }}
            className={`block w-full cursor-text whitespace-pre-wrap text-[15px] leading-relaxed ${
              task.completed
                ? "text-neutral-400 line-through dark:text-neutral-500"
                : "text-neutral-800 dark:text-neutral-200"
            }`}
          >
            {task.priority && !task.completed && (
              <Star
                size={14}
                className="mb-0.5 mr-1.5 inline text-amber-500 dark:text-amber-400"
                fill="currentColor"
              />
            )}
            {formatTaskText(task.text || task.title || "")}
          </span>
        )}

        {/* Project & Due Date indicators */}
        {(task.project ||
          (task.projects && task.projects.length > 0) ||
          task.dueDate) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {(task.projects || (task.project ? [task.project] : [])).map(
              (proj, idx) => (
                <div
                  key={idx}
                  className="group/proj flex items-center gap-1 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-500 dark:bg-neutral-800/60 dark:text-neutral-400"
                >
                  <Hash size={10} />
                  <span>{proj}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTasks((prev) =>
                        prev.map((t) => {
                          if (t.id === task.id) {
                            const newProjs = (
                              t.projects ||
                              (t.project ? [t.project] : [])
                            ).filter((p) => p !== proj);
                            return {
                              ...t,
                              projects: newProjs,
                              project: undefined,
                            };
                          }
                          return t;
                        }),
                      );
                    }}
                    className="ml-0.5 opacity-0 group-hover/proj:opacity-100 hover:text-red-500 transition-opacity"
                    title="Remove Project"
                  >
                    <X size={10} />
                  </button>
                </div>
              ),
            )}
            {task.dueDate && (
              <div className="flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                <Calendar size={10} />
                <span>{task.dueDate}</span>
              </div>
            )}
          </div>
        )}

        {/* Reminder display */}
        {task.reminder && settingReminderId !== task.id && (
          <div className="mt-1.5 flex items-center text-xs text-blue-500 opacity-80 dark:text-blue-400">
            <Bell size={12} className="mr-1" />
            <span>{task.reminder}</span>
          </div>
        )}

        {/* Reminder setting */}
        {settingReminderId === task.id && (
          <div className="mt-2 flex items-center space-x-2">
            <input
              type="time"
              autoFocus
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="rounded border border-neutral-300 bg-neutral-50 px-2 py-1 text-xs text-neutral-700 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
            />
            <button
              onClick={() => saveReminder(task.id)}
              className="rounded bg-blue-500/10 px-2 py-1 text-xs text-blue-600 transition-colors hover:bg-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 dark:hover:bg-blue-500/30"
            >
              Save
            </button>
            <button
              onClick={() => saveReminder(task.id, true)}
              className="rounded bg-neutral-200 px-2 py-1 text-xs text-neutral-600 transition-colors hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
            >
              Clear
            </button>
            <button
              onClick={() => setSettingReminderId(null)}
              className="rounded px-2 py-1 text-xs text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Attachment */}
        {task.attachment && (
          <div className="mt-2 mb-1">
            {task.attachment.type === "image" ? (
              <div className="relative group/attachment inline-block">
                <img
                  src={task.attachment.url}
                  alt=""
                  onClick={() => setPreviewImage(task.attachment.url)}
                  className="max-h-32 cursor-pointer rounded-lg border border-neutral-200 object-cover transition-opacity group-hover/attachment:opacity-80 dark:border-neutral-800"
                />
                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover/attachment:opacity-100">
                  <button
                    onClick={(e) =>
                      handleCopyImage(e, task.attachment.url)
                    }
                    className="rounded-md bg-black/60 p-1.5 text-white backdrop-blur-md transition-colors hover:bg-black/80 dark:bg-black/80 dark:hover:bg-black"
                    title="Copy Image"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewImage(task.attachment.url);
                    }}
                    className="rounded-md bg-black/60 p-1.5 text-white backdrop-blur-md transition-colors hover:bg-black/80 dark:bg-black/80 dark:hover:bg-black"
                    title="Preview"
                  >
                    <Maximize2 size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAttachment(task.id);
                    }}
                    className="rounded-md bg-black/60 p-1.5 text-white backdrop-blur-md transition-colors hover:bg-red-500/90 hover:text-white dark:bg-black/80 dark:hover:bg-red-600/90"
                    title="Delete Attachment"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex w-fit items-center rounded-lg border border-neutral-200 bg-neutral-100 p-2 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                <FileText size={14} className="mr-2 shrink-0" />
                <span className="max-w-[200px] truncate">
                  {task.attachment.name}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Subtasks */}
        {task.subtasks && task.subtasks.length > 0 && (
          <div className="mt-2 space-y-1 pl-1">
            {[...task.subtasks]
              .sort((a, b) =>
                b.completed === a.completed ? 0 : a.completed ? -1 : 1,
              )
              .map((st) => (
                <div
                  key={st.id}
                  className={`group/subtask relative flex items-start rounded p-1 transition-all hover:bg-neutral-200/50 dark:hover:bg-neutral-800/60 ${
                    dragOverId === st.id
                      ? "ring-1 ring-blue-300 bg-blue-50/50 dark:ring-blue-500/50 dark:bg-blue-900/10"
                      : ""
                  }`}
                  draggable={activeDragHandleId === st.id}
                  onDragStart={(e) =>
                    handleDragStart(e, "subtask", st.id, task.id)
                  }
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOverTask(e, st.id)}
                  onDragLeave={(e) => handleDragLeaveTask(e, st.id)}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDropAction(e, "task", task.id);
                  }}
                >
                  <div
                    className="mt-0.5 flex shrink-0 items-center justify-center w-3 -ml-3 mr-0 opacity-0 transition-opacity group-hover/subtask:opacity-100 cursor-grab active:cursor-grabbing text-neutral-400 dark:text-neutral-500"
                    onMouseEnter={() => setActiveDragHandleId(st.id)}
                    onMouseLeave={() => setActiveDragHandleId(null)}
                  >
                    <GripVertical size={12} />
                  </div>
                  <button
                    onClick={() => toggleSubtask(task.id, st.id)}
                    className="mt-0.5 mr-2 shrink-0 text-neutral-400 transition-colors hover:text-blue-500 focus:outline-none dark:text-neutral-500 dark:hover:text-blue-400"
                  >
                    {st.completed ? (
                      <CheckCircle2 size={14} className="text-blue-500" />
                    ) : (
                      <Circle size={14} />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    {editingSubtaskId === st.id ? (
                      <input
                        autoFocus
                        ref={(el) => {
                          if (el && !el.dataset.initialized) {
                            el.dataset.initialized = "true";
                            if (editCaretPositionRef.current !== null) {
                              el.setSelectionRange(
                                editCaretPositionRef.current,
                                editCaretPositionRef.current,
                              );
                              editCaretPositionRef.current = null;
                            }
                          }
                        }}
                        value={editSubtaskText}
                        onChange={(e) => setEditSubtaskText(e.target.value)}
                        onBlur={() => saveSubtaskEdit(task.id, st.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            saveSubtaskEdit(task.id, st.id);
                          else if (e.key === "Escape")
                            setEditingSubtaskId(null);
                        }}
                        className="w-full rounded border border-neutral-300 bg-white px-2 py-0.5 text-[14px] leading-relaxed text-neutral-800 shadow-sm focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:focus:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200"
                      />
                    ) : (
                      <span
                        onClick={(e) => {
                          if (e.target.tagName !== "A") {
                            let offset = st.text.length;
                            const selection = window.getSelection();
                            if (selection.rangeCount > 0) {
                              const range = selection.getRangeAt(0);
                              const preCaretRange = range.cloneRange();
                              preCaretRange.selectNodeContents(e.currentTarget);
                              preCaretRange.setEnd(
                                range.startContainer,
                                range.startOffset,
                              );
                              offset = preCaretRange.toString().length;
                            }
                            editCaretPositionRef.current = offset;
                            setEditingSubtaskId(st.id);
                            setEditSubtaskText(st.text);
                          }
                        }}
                        className={`block w-full cursor-text whitespace-pre-wrap text-[14px] leading-relaxed ${
                          st.completed
                            ? "text-neutral-400 line-through dark:text-neutral-500"
                            : "text-neutral-600 dark:text-neutral-300"
                        }`}
                      >
                        {st.text && formatTaskText(st.text)}
                      </span>
                    )}
                    {st.attachment && st.attachment.type === "image" && (
                      <div className="mt-1.5 relative group/st_attachment inline-block">
                        <img
                          src={st.attachment.url}
                          alt=""
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewImage(st.attachment.url);
                          }}
                          className="max-h-24 cursor-pointer rounded-lg border border-neutral-200 object-cover transition-opacity group-hover/st_attachment:opacity-80 dark:border-neutral-800"
                        />
                        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover/st_attachment:opacity-100">
                          <button
                            onClick={(e) =>
                              handleCopyImage(e, st.attachment.url)
                            }
                            className="rounded-md bg-black/60 p-1 text-white backdrop-blur-md transition-colors hover:bg-black/80 dark:bg-black/80 dark:hover:bg-black"
                            title="Copy Image"
                          >
                            <Copy size={10} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImage(st.attachment.url);
                            }}
                            className="rounded-md bg-black/60 p-1 text-white backdrop-blur-md transition-colors hover:bg-black/80 dark:bg-black/80 dark:hover:bg-black"
                            title="Preview"
                          >
                            <Maximize2 size={10} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="ml-2 flex shrink-0 items-center opacity-0 transition-opacity group-hover/subtask:opacity-100">
                    <button
                      onClick={(e) =>
                        triggerDeleteSubtask(e, task.id, st.id)
                      }
                      className="rounded p-0.5 text-neutral-400 transition-colors hover:text-red-500 focus:outline-none dark:text-neutral-500 dark:hover:text-red-400"
                      title="Delete Subtask"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Add subtask input */}
        {addingSubtaskId === task.id && (
          <div className="mt-2 pl-1 font-sans">
            <div className="flex items-center">
              <CornerDownRight
                size={14}
                className="mr-2 text-neutral-400 dark:text-neutral-600"
              />
              <input
                autoFocus
                value={newSubtaskText}
                onChange={(e) => setNewSubtaskText(e.target.value)}
                onPaste={handleSubtaskPaste}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSubtask(task.id, true);
                  } else if (e.key === "Escape") {
                    setAddingSubtaskId(null);
                    setNewSubtaskText("");
                    setPendingSubtaskAttachment(null);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => {
                    addSubtask(task.id);
                  }, 150);
                }}
                placeholder="New subtask..."
                className="w-full rounded border border-neutral-300 bg-transparent px-2 py-0.5 text-[14px] text-neutral-800 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:text-neutral-200 dark:focus:border-blue-500"
              />
            </div>
            {pendingSubtaskAttachment &&
              pendingSubtaskAttachment.type === "image" && (
                <div className="mt-1.5 pl-7 relative inline-block">
                  <img
                    src={pendingSubtaskAttachment.url}
                    alt="Pending subtask attach"
                    className="max-h-20 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-800"
                  />
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPendingSubtaskAttachment(null);
                    }}
                    className="absolute -right-2 -top-2 rounded-full border border-neutral-200 bg-white p-0.5 text-neutral-500 shadow hover:bg-neutral-100 hover:text-red-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-red-400"
                    title="Remove attachment"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
          </div>
        )}

        {/* Assign project input */}
        {assigningProjectId === task.id && (
          <div className="mt-2 flex items-center pl-1 font-sans">
            <Hash
              size={14}
              className="mr-2 text-neutral-400 dark:text-neutral-600"
            />
            <input
              autoFocus
              placeholder="Add project (enter to save)..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.target.value.trim()) {
                  const val = e.target.value.trim();
                  setTasks((prev) =>
                    prev.map((t) => {
                      if (t.id === task.id) {
                        const pList =
                          t.projects || (t.project ? [t.project] : []);
                        return {
                          ...t,
                          projects: pList.includes(val)
                            ? pList
                            : [...pList, val],
                          project: undefined,
                        };
                      }
                      return t;
                    }),
                  );
                  e.target.value = "";
                  setAssigningProjectId(null);
                } else if (e.key === "Escape") {
                  setAssigningProjectId(null);
                }
              }}
              onBlur={(e) => {
                if (e.target.value.trim()) {
                  const val = e.target.value.trim();
                  setTasks((prev) =>
                    prev.map((t) => {
                      if (t.id === task.id) {
                        const pList =
                          t.projects || (t.project ? [t.project] : []);
                        return {
                          ...t,
                          projects: pList.includes(val)
                            ? pList
                            : [...pList, val],
                          project: undefined,
                        };
                      }
                      return t;
                    }),
                  );
                }
                setAssigningProjectId(null);
              }}
              className="w-full rounded border border-neutral-300 bg-transparent px-2 py-0.5 text-[14px] text-neutral-800 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:text-neutral-200 dark:focus:border-blue-500"
            />
          </div>
        )}

        {/* Task Action Buttons (visible on hover) */}
        <div className="mt-2 flex items-center justify-between opacity-0 transition-opacity duration-200 group-hover/task:opacity-100">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => {
                setAddingSubtaskId(task.id);
                setNewSubtaskText("");
              }}
              className="group/btn relative flex items-center justify-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 text-neutral-500 shadow-sm backdrop-blur-md transition-colors hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700/50"
            >
              <CornerDownRight size={13} />
              <span className="text-[11px] font-medium leading-none">
                Subtask
              </span>
            </button>
            <button
              onClick={() => togglePriority(task.id)}
              className={`group/btn relative flex items-center justify-center gap-1.5 rounded-full border px-2 py-1 shadow-sm backdrop-blur-md transition-colors ${
                task.priority
                  ? "border-amber-200/60 bg-amber-100 text-amber-600 dark:border-amber-900/50 dark:bg-amber-900/30 dark:text-amber-400"
                  : "border-neutral-200/60 bg-white/60 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700/50"
              }`}
            >
              <Star
                size={13}
                fill={task.priority ? "currentColor" : "none"}
              />
              <span className="text-[11px] font-medium leading-none">
                Priority
              </span>
            </button>
            <button
              onClick={() => setAssigningProjectId(task.id)}
              className="group/btn relative flex items-center justify-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 text-neutral-500 shadow-sm backdrop-blur-md transition-colors hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700/50"
            >
              <Hash size={13} />
              <span className="text-[11px] font-medium leading-none">
                Project
              </span>
            </button>
            <button
              onClick={() => {
                setSettingReminderId(task.id);
                setReminderTime(task.reminder || "");
              }}
              className="group/btn relative flex items-center justify-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 text-neutral-500 shadow-sm backdrop-blur-md transition-colors hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700/50"
            >
              <Bell size={13} />
              <span className="text-[11px] font-medium leading-none">
                Remind
              </span>
            </button>
            <button
              onClick={(e) => handleCopyTask(e, task)}
              className="group/btn relative flex items-center justify-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 text-neutral-500 shadow-sm backdrop-blur-md transition-colors hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700/50"
            >
              <Copy size={13} />
              <span className="text-[11px] font-medium leading-none">
                Copy
              </span>
            </button>
          </div>
          <button
            onClick={(e) => triggerDeleteTask(e, task.id)}
            className="group/btn relative flex items-center justify-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 text-neutral-500 shadow-sm backdrop-blur-md transition-colors hover:border-red-200/60 hover:bg-red-50 hover:text-red-500 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:border-red-900/50 dark:hover:bg-red-900/30 dark:hover:text-red-400"
          >
            <X size={13} />
            <span className="text-[11px] font-medium leading-none">
              Delete
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

TaskItem.propTypes = {
  task: PropTypes.object.isRequired,
  formatTaskText: PropTypes.func.isRequired,
  formatTaskDateTime: PropTypes.func.isRequired,
  editingId: PropTypes.any,
  setEditingId: PropTypes.func.isRequired,
  editText: PropTypes.string.isRequired,
  setEditText: PropTypes.func.isRequired,
  editCaretPositionRef: PropTypes.object.isRequired,
  saveEdit: PropTypes.func.isRequired,
  editingSubtaskId: PropTypes.any,
  setEditingSubtaskId: PropTypes.func.isRequired,
  editSubtaskText: PropTypes.string.isRequired,
  setEditSubtaskText: PropTypes.func.isRequired,
  saveSubtaskEdit: PropTypes.func.isRequired,
  addingSubtaskId: PropTypes.any,
  setAddingSubtaskId: PropTypes.func.isRequired,
  newSubtaskText: PropTypes.string.isRequired,
  setNewSubtaskText: PropTypes.func.isRequired,
  addSubtask: PropTypes.func.isRequired,
  handleSubtaskPaste: PropTypes.func.isRequired,
  pendingSubtaskAttachment: PropTypes.any,
  setPendingSubtaskAttachment: PropTypes.func.isRequired,
  assigningProjectId: PropTypes.any,
  setAssigningProjectId: PropTypes.func.isRequired,
  setTasks: PropTypes.func.isRequired,
  settingReminderId: PropTypes.any,
  setSettingReminderId: PropTypes.func.isRequired,
  reminderTime: PropTypes.string.isRequired,
  setReminderTime: PropTypes.func.isRequired,
  saveReminder: PropTypes.func.isRequired,
  toggleTask: PropTypes.func.isRequired,
  togglePriority: PropTypes.func.isRequired,
  toggleSubtask: PropTypes.func.isRequired,
  removeAttachment: PropTypes.func.isRequired,
  triggerDeleteTask: PropTypes.func.isRequired,
  triggerDeleteSubtask: PropTypes.func.isRequired,
  handleCopyTask: PropTypes.func.isRequired,
  handleCopyImage: PropTypes.func.isRequired,
  setPreviewImage: PropTypes.func.isRequired,
  dragOverId: PropTypes.any,
  dragOverPosition: PropTypes.string,
  activeDragHandleId: PropTypes.any,
  setActiveDragHandleId: PropTypes.func.isRequired,
  handleDragStart: PropTypes.func.isRequired,
  handleDragEnd: PropTypes.func.isRequired,
  handleDragOverTask: PropTypes.func.isRequired,
  handleDragLeaveTask: PropTypes.func.isRequired,
  handleDropOnTask: PropTypes.func.isRequired,
  handleDropAction: PropTypes.func.isRequired,
};
