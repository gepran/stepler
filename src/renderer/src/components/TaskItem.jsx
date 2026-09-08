import { memo, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import FileTypeIcon from "./FileTypeIcon";
import AppleTimePicker from "./AppleTimePicker";
import {
  formatTaskText,
  formatTaskDateTime,
  dueDateLabel,
} from "../lib/format";
import {
  attachmentSrc,
  isMissing,
  imageBox,
  copyAttachmentImage,
  copyAttachmentFile,
  downloadAttachment,
  openAttachment,
  copyTask,
  pendingAttachment,
  releasePending,
} from "../lib/attachments";
import {
  Circle,
  CheckCircle2,
  GripVertical,
  X,
  Bell,
  Star,
  Maximize2,
  CornerDownRight,
  Hash,
  Calendar,
  Copy,
  Download,
  ExternalLink,
  ImageOff,
} from "lucide-react";

const MODULE_LOAD_TIME = Date.now();

/**
 * Mounted only while a reminder is being picked, so its draft starts from the
 * task's current time without an effect having to copy it in.
 */
function ReminderEditor({ initial, onSave, onClear, onCancel }) {
  const [value, setValue] = useState(initial || "09:00");
  return (
    <div className="mt-2 flex items-center space-x-2">
      <AppleTimePicker value={value} onChange={setValue} />
      <button
        onClick={() => onSave(value)}
        className="btn-tactile rounded bg-blue-500/10 px-2 py-1 text-xs text-blue-600 transition-colors hover:bg-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400"
      >
        Save
      </button>
      <button
        onClick={onClear}
        className="btn-tactile rounded bg-neutral-200 px-2 py-1 text-xs text-neutral-600 transition-colors hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-400"
      >
        Clear
      </button>
      <button
        onClick={onCancel}
        className="btn-tactile rounded px-2 py-1 text-xs text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-300"
      >
        Cancel
      </button>
    </div>
  );
}

ReminderEditor.propTypes = {
  initial: PropTypes.string,
  onSave: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

function TaskItem({
  task,
  showCompleted,
  isEditing,
  isAddingSubtask,
  isAssigningProject,
  isSettingReminder,
  dragOverId,
  dragOverPosition,
  availableProjects,
  setEditingId,
  saveEdit,
  setAddingSubtaskId,
  addSubtask,
  saveSubtaskEdit,
  setAssigningProjectId,
  setTaskProjects,
  setSettingReminderId,
  saveReminder,
  toggleTask,
  togglePriority,
  toggleSubtask,
  removeAttachment,
  triggerDeleteTask,
  triggerDeleteSubtask,
  onPreview,
  onToast,
  handleDragStart,
  handleDragEnd,
  handleDragOverTask,
  handleDragLeaveTask,
  handleDropOnTask,
  handleDropAction,
}) {
  // Draft state lives here so typing only re-renders this one row. The text
  // areas are uncontrolled: React does not need to see each keystroke, which
  // keeps editing at one frame even with hundreds of rows on screen.
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);
  const [newSubtaskText, setNewSubtaskText] = useState("");
  const [pendingSubtask, setPendingSubtask] = useState(null);
  const [activeHandleId, setActiveHandleId] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const caretRef = useRef(null);
  const editRef = useRef(null);
  const subtaskEditRef = useRef(null);

  useEffect(() => () => releasePending(pendingSubtask), [pendingSubtask]);

  const dt = formatTaskDateTime(task.id);
  const projects = task.projects || [];
  // Sorted once here so each row knows whether it is the last one and should
  // close the tree trunk. "Hide completed" applies to subtasks too.
  const orderedSubtasks = [...(task.subtasks || [])]
    .filter((st) => (showCompleted ? true : !st.completed))
    .sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? -1 : 1));
  const hasSubtree = orderedSubtasks.length > 0 || isAddingSubtask;
  const attachment = task.attachment;

  const beginEdit = (e) => {
    if (e.target.tagName === "A") return;
    const selection = window.getSelection();
    let offset = (task.text || "").length;
    if (selection?.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const pre = range.cloneRange();
      pre.selectNodeContents(e.currentTarget);
      pre.setEnd(range.startContainer, range.startOffset);
      offset = pre.toString().length;
    }
    caretRef.current = offset;
    setEditingId(task.id);
  };

  const commitSubtask = (keepOpen) => {
    if (newSubtaskText.trim() || pendingSubtask) {
      addSubtask(task.id, newSubtaskText, pendingSubtask);
      setNewSubtaskText("");
      setPendingSubtask(null);
    }
    if (!keepOpen) setAddingSubtaskId(null);
  };

  const handleSubtaskPaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      if (file && file.size > 0) {
        e.preventDefault();
        setPendingSubtask((prev) => {
          releasePending(prev);
          return pendingAttachment(file);
        });
        return;
      }
    }
  };

  const highlighted =
    isAssigningProject ||
    isSettingReminder ||
    (dragOverId === task.id && dragOverPosition === "child");

  const attachmentActions = (att, size = 12) => (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          openAttachment(att);
        }}
        className="btn-tactile rounded-md bg-neutral-200 p-1 text-neutral-600 transition-colors hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
        title="Open"
      >
        <ExternalLink size={size} className="icon-rubbery" />
      </button>
      <button
        onClick={async (e) => {
          e.stopPropagation();
          const res = await copyAttachmentFile(att);
          onToast?.(
            res?.success
              ? res.mode === "path"
                ? "File path copied"
                : "File copied"
              : "Copy failed",
            res?.success ? "info" : "error",
          );
        }}
        className="btn-tactile rounded-md bg-neutral-200 p-1 text-neutral-600 transition-colors hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
        title="Copy file"
      >
        <Copy size={size} className="icon-rubbery" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          downloadAttachment(att);
        }}
        className="btn-tactile rounded-md bg-neutral-200 p-1 text-neutral-600 transition-colors hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
        title="Save as…"
      >
        <Download size={size} className="icon-rubbery" />
      </button>
    </>
  );

  return (
    <div
      id={`task-${task.id}`}
      className={`group/task relative flex items-start rounded-xl p-2 transition-all duration-300 ease-out ${
        task.completed
          ? "opacity-40 hover:opacity-70"
          : "hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40"
      } ${
        highlighted
          ? "z-30 scale-[1.02] border border-blue-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-4 ring-blue-500/20 dark:border-blue-800/50 dark:bg-neutral-900"
          : "z-10 border border-transparent"
      }`}
      draggable={activeHandleId === task.id}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragStart={(e) => handleDragStart(e, "task", task.id)}
      onDragEnd={handleDragEnd}
      onDragOver={(e) => handleDragOverTask(e, task.id)}
      onDragLeave={(e) => handleDragLeaveTask(e, task.id)}
      onDrop={(e) => handleDropOnTask(e, task.id)}
    >
      {dt && (
        <div className="pointer-events-none absolute inset-y-0 right-full z-10 flex items-center pr-8 opacity-0 transition-opacity duration-200 group-hover/task:opacity-100">
          <span className="whitespace-nowrap text-[13px] font-medium leading-none tracking-wide text-neutral-400 dark:text-neutral-500">
            {dt.isToday ? dt.time : dt.full}
          </span>
        </div>
      )}
      {dragOverId === task.id && dragOverPosition === "top" && (
        <div className="pointer-events-none absolute -top-0.5 left-0 right-0 z-30 h-[3px] rounded-full bg-blue-500" />
      )}
      {dragOverId === task.id && dragOverPosition === "bottom" && (
        <div className="pointer-events-none absolute -bottom-0.5 left-0 right-0 z-30 h-[3px] rounded-full bg-blue-500" />
      )}

      <div
        className="ml-1 mr-1 mt-1 flex w-4 shrink-0 cursor-grab items-center justify-center text-neutral-400 opacity-0 transition-opacity active:cursor-grabbing group-hover/task:opacity-100 dark:text-neutral-500"
        onMouseEnter={() => setActiveHandleId(task.id)}
        onMouseLeave={() => setActiveHandleId(null)}
        title="Drag to reorder or nest"
      >
        <GripVertical size={14} />
      </div>

      <button
        onClick={() => toggleTask(task.id)}
        className="btn-tactile mr-3 mt-1 shrink-0 text-neutral-400 transition-colors hover:text-yellow-500 focus:outline-none dark:text-neutral-500 dark:hover:text-yellow-400"
        title={task.completed ? "Mark as not done" : "Mark as done"}
      >
        {task.completed ? (
          <CheckCircle2 size={18} className="icon-rubbery text-yellow-500" />
        ) : (
          <Circle size={18} className="icon-rubbery" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        {/* Everything above the subtasks. Wrapping it lets the tree trunk
            start just under the parent checkbox and end exactly where the
            first subtask begins, whatever this task contains. */}
        <div className="relative">
          {hasSubtree && (
            <span className="tree-line pointer-events-none absolute -bottom-2 -left-[21px] top-[24px] w-px" />
          )}
          {isEditing ? (
            <textarea
              autoFocus
              key={`edit-${task.id}`}
              ref={(el) => {
                editRef.current = el;
                if (el && !el.dataset.initialized) {
                  el.dataset.initialized = "true";
                  if (caretRef.current !== null) {
                    el.setSelectionRange(caretRef.current, caretRef.current);
                    caretRef.current = null;
                  }
                }
              }}
              defaultValue={task.text || ""}
              onBlur={(e) => saveEdit(task.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  if (e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  saveEdit(task.id, e.target.value);
                } else if (e.key === "Escape") {
                  e.stopPropagation();
                  setEditingId(null);
                }
              }}
              className="autosize max-h-[300px] min-h-[60px] w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-[15px] leading-relaxed text-neutral-800 shadow-sm focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
            />
          ) : (
            <span
              onClick={beginEdit}
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
              {formatTaskText(task.text || "")}
            </span>
          )}

          {(projects.length > 0 || task.dueDate || task.jiraKey) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {projects.map((proj) => (
                <div
                  key={proj}
                  className="group/proj flex items-center gap-1 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-500 dark:bg-neutral-800/60 dark:text-neutral-400"
                >
                  <Hash size={10} />
                  <span>{proj}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTaskProjects(task.id, (prev) =>
                        prev.filter((p) => p !== proj),
                      );
                    }}
                    className="btn-tactile ml-0.5 opacity-0 transition-opacity hover:text-red-500 group-hover/proj:opacity-100"
                    title="Remove project"
                  >
                    <X size={10} className="icon-rubbery" />
                  </button>
                </div>
              ))}
              {task.dueDate && (
                <div className="flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                  <Calendar size={10} />
                  <span>{dueDateLabel(task.dueDate)}</span>
                </div>
              )}
              {task.jiraKey && (
                <span className="rounded-md bg-[#0052CC]/10 px-1.5 py-0.5 text-[11px] font-bold text-[#0052CC] dark:text-[#7aa8f5]">
                  {task.jiraKey}
                </span>
              )}
            </div>
          )}

          {task.reminder && !isSettingReminder && (
            <div className="mt-1.5 flex items-center text-xs text-blue-500 opacity-80 dark:text-blue-400">
              <Bell size={12} className="mr-1" />
              <span>{task.reminder}</span>
            </div>
          )}

          {isSettingReminder && (
            <ReminderEditor
              initial={task.reminder}
              onSave={(value) => saveReminder(task.id, value)}
              onClear={() => saveReminder(task.id, null, true)}
              onCancel={() => setSettingReminderId(null)}
            />
          )}

          {attachment && (
            <div className="mb-1 mt-2">
              {isMissing(attachment) ? (
                <div className="flex w-fit items-center gap-2 rounded-xl border border-dashed border-neutral-300 px-3 py-2 text-xs text-neutral-400 dark:border-neutral-700">
                  <ImageOff size={14} />
                  <span className="max-w-[220px] truncate">
                    {attachment.name} — file no longer available
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAttachment(task.id);
                    }}
                    className="btn-tactile hover:text-red-500"
                    title="Remove"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : attachment.type === "image" ? (
                <div className="group/attachment relative inline-block">
                  <img
                    src={attachmentSrc(attachment)}
                    alt={attachment.name}
                    loading="lazy"
                    decoding="async"
                    {...imageBox(attachment)}
                    onClick={() => onPreview(attachment)}
                    className="max-h-32 cursor-pointer rounded-lg border border-neutral-200 object-cover transition-opacity group-hover/attachment:opacity-80 dark:border-neutral-800"
                  />
                  <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover/attachment:opacity-100">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const res = await copyAttachmentImage(attachment);
                        onToast?.(
                          res?.success ? "Image copied" : "Copy failed",
                          res?.success ? "info" : "error",
                        );
                      }}
                      className="btn-tactile rounded-md bg-black/60 p-1.5 text-white backdrop-blur-md transition-colors hover:bg-black/80"
                      title="Copy image"
                    >
                      <Copy size={14} className="icon-rubbery" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreview(attachment);
                      }}
                      className="btn-tactile rounded-md bg-black/60 p-1.5 text-white backdrop-blur-md transition-colors hover:bg-black/80"
                      title="Preview"
                    >
                      <Maximize2 size={14} className="icon-rubbery" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAttachment(task.id);
                      }}
                      className="btn-tactile rounded-md bg-black/60 p-1.5 text-white backdrop-blur-md transition-colors hover:bg-red-500/90"
                      title="Remove attachment"
                    >
                      <X size={14} className="icon-rubbery" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="group/file relative flex w-fit cursor-pointer items-center gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-400 dark:hover:bg-neutral-800/80"
                  onClick={() => onPreview(attachment)}
                >
                  <FileTypeIcon fileName={attachment.name} size={28} />
                  <span className="max-w-[200px] truncate">
                    {attachment.name}
                  </span>
                  <div className="ml-2 flex gap-1 opacity-0 transition-opacity group-hover/file:opacity-100">
                    {attachmentActions(attachment)}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAttachment(task.id);
                      }}
                      className="btn-tactile rounded-md bg-neutral-200 p-1 text-neutral-600 transition-colors hover:bg-red-100 hover:text-red-500 dark:bg-neutral-800 dark:text-neutral-300"
                      title="Remove attachment"
                    >
                      <X size={12} className="icon-rubbery" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Subtasks */}
        {orderedSubtasks.length > 0 && (
          <div className="relative mt-2 space-y-1 pl-1">
            {orderedSubtasks.map((st, index) => {
              const isLastSubtask =
                index === orderedSubtasks.length - 1 && !isAddingSubtask;
              return (
                <div
                  key={st.id}
                  className={`group/subtask relative flex items-start rounded p-1 transition-all hover:bg-neutral-200/50 dark:hover:bg-neutral-800/60 ${
                    dragOverId === st.id
                      ? "bg-blue-50/50 ring-1 ring-blue-300 dark:bg-blue-900/10 dark:ring-blue-500/50"
                      : ""
                  } ${parseInt(st.id, 10) > MODULE_LOAD_TIME ? "animate-jelly-fall" : ""}`}
                  draggable={activeHandleId === st.id}
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
                  {/* Tree guides: a trunk in the parent checkbox's column and
                      a branch into this row, so nesting is unmistakable. The
                      last child closes with a rounded corner. */}
                  {isLastSubtask ? (
                    <span className="tree-corner pointer-events-none absolute -left-[25px] top-0 h-[14px] w-[25px] transition-[width] group-hover/subtask:w-[8px]" />
                  ) : (
                    <>
                      <span className="tree-line pointer-events-none absolute -bottom-1 -left-[25px] top-0 w-px" />
                      <span className="tree-line pointer-events-none absolute -left-[25px] top-[13px] h-px w-[25px] transition-[width] group-hover/subtask:w-[8px]" />
                    </>
                  )}
                  <div
                    className="-ml-4 mr-1 mt-0.5 flex w-3 shrink-0 cursor-grab items-center justify-center text-neutral-400 opacity-0 transition-opacity active:cursor-grabbing group-hover/subtask:opacity-100 dark:text-neutral-500"
                    onMouseEnter={() => setActiveHandleId(st.id)}
                    onMouseLeave={() => setActiveHandleId(null)}
                  >
                    <GripVertical size={12} />
                  </div>
                  <button
                    onClick={() => toggleSubtask(task.id, st.id)}
                    className="btn-tactile mr-2 mt-0.5 shrink-0 text-neutral-400 transition-colors hover:text-yellow-500 focus:outline-none dark:text-neutral-500"
                  >
                    {st.completed ? (
                      <CheckCircle2
                        size={14}
                        className="icon-rubbery text-yellow-500"
                      />
                    ) : (
                      <Circle size={14} className="icon-rubbery" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    {editingSubtaskId === st.id ? (
                      <input
                        autoFocus
                        ref={subtaskEditRef}
                        defaultValue={st.text}
                        onBlur={(e) => {
                          saveSubtaskEdit(task.id, st.id, e.target.value);
                          setEditingSubtaskId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (e.nativeEvent.isComposing) return;
                            saveSubtaskEdit(task.id, st.id, e.target.value);
                            setEditingSubtaskId(null);
                          } else if (e.key === "Escape") {
                            e.stopPropagation();
                            setEditingSubtaskId(null);
                          }
                        }}
                        className="w-full rounded border border-neutral-300 bg-white px-2 py-0.5 text-[14px] leading-relaxed text-neutral-800 shadow-sm focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                      />
                    ) : (
                      <span
                        onClick={() => setEditingSubtaskId(st.id)}
                        className={`block w-full cursor-text whitespace-pre-wrap text-[14px] leading-relaxed ${
                          st.completed
                            ? "text-neutral-400 line-through dark:text-neutral-500"
                            : "text-neutral-600 dark:text-neutral-300"
                        }`}
                      >
                        {st.text && formatTaskText(st.text)}
                      </span>
                    )}
                    {st.attachment && !isMissing(st.attachment) && (
                      <div className="group/st relative mt-1.5 inline-block">
                        {st.attachment.type === "image" ? (
                          <>
                            <img
                              src={attachmentSrc(st.attachment)}
                              alt={st.attachment.name}
                              loading="lazy"
                              decoding="async"
                              {...imageBox(st.attachment)}
                              onClick={(e) => {
                                e.stopPropagation();
                                onPreview(st.attachment);
                              }}
                              className="max-h-24 cursor-pointer rounded-lg border border-neutral-200 object-cover dark:border-neutral-800"
                            />
                            <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover/st:opacity-100">
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const res = await copyAttachmentImage(
                                    st.attachment,
                                  );
                                  onToast?.(
                                    res?.success
                                      ? "Image copied"
                                      : "Copy failed",
                                    res?.success ? "info" : "error",
                                  );
                                }}
                                className="btn-tactile rounded-md bg-black/60 p-1 text-white backdrop-blur-md hover:bg-black/80"
                                title="Copy image"
                              >
                                <Copy size={10} className="icon-rubbery" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPreview(st.attachment);
                                }}
                                className="btn-tactile rounded-md bg-black/60 p-1 text-white backdrop-blur-md hover:bg-black/80"
                                title="Preview"
                              >
                                <Maximize2 size={10} className="icon-rubbery" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              onPreview(st.attachment);
                            }}
                            className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-400"
                          >
                            <FileTypeIcon
                              fileName={st.attachment.name}
                              size={20}
                            />
                            <span className="max-w-[160px] truncate">
                              {st.attachment.name}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="ml-2 flex shrink-0 items-center opacity-0 transition-opacity group-hover/subtask:opacity-100">
                    <button
                      onClick={(e) => triggerDeleteSubtask(e, task.id, st.id)}
                      className="btn-tactile rounded p-0.5 text-neutral-400 transition-colors hover:text-red-500 focus:outline-none dark:text-neutral-500"
                      title="Delete subtask"
                    >
                      <X size={12} className="icon-rubbery" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add subtask */}
        {isAddingSubtask && (
          <div className="relative mt-2 pl-1 font-sans">
            <span
              className={`tree-line pointer-events-none absolute -left-[21px] w-px ${
                orderedSubtasks.length > 0
                  ? "-top-2 h-2"
                  : "-top-[19px] h-[19px]"
              }`}
            />
            <span className="tree-corner pointer-events-none absolute -left-[21px] top-0 h-[14px] w-[21px]" />
            <div className="flex items-center">
              <CornerDownRight
                size={14}
                className="mr-2 shrink-0 text-neutral-400 dark:text-neutral-600"
              />
              <input
                autoFocus
                value={newSubtaskText}
                onChange={(e) => setNewSubtaskText(e.target.value)}
                onPaste={handleSubtaskPaste}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (e.nativeEvent.isComposing) return;
                    e.preventDefault();
                    commitSubtask(true);
                  } else if (e.key === "Escape") {
                    e.stopPropagation();
                    setAddingSubtaskId(null);
                    setNewSubtaskText("");
                    releasePending(pendingSubtask);
                    setPendingSubtask(null);
                  }
                }}
                onBlur={() => setTimeout(() => commitSubtask(false), 150)}
                placeholder="New subtask…"
                className="w-full rounded border border-neutral-300 bg-transparent px-2 py-0.5 text-[14px] text-neutral-800 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:text-neutral-200"
              />
            </div>
            {pendingSubtask?.type === "image" && (
              <div className="relative mt-1.5 inline-block pl-7">
                <img
                  src={attachmentSrc(pendingSubtask)}
                  alt=""
                  className="max-h-20 rounded-lg border border-neutral-200 shadow-sm dark:border-neutral-800"
                />
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    releasePending(pendingSubtask);
                    setPendingSubtask(null);
                  }}
                  className="btn-tactile absolute -right-2 -top-2 rounded-full border border-neutral-200 bg-white p-0.5 text-neutral-500 shadow hover:text-red-500 dark:border-neutral-700 dark:bg-neutral-800"
                  title="Remove attachment"
                >
                  <X size={12} className="icon-rubbery" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Actions — mounted on hover: with every day editable, keeping six
            buttons alive for hundreds of rows tripled the size of the page. */}
        {(isHovered || isAssigningProject || isSettingReminder) && (
          <div className="mt-2 flex items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setAddingSubtaskId(task.id)}
                className="btn-tactile flex items-center justify-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 text-neutral-500 shadow-sm backdrop-blur-md transition-colors hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700/50"
              >
                <CornerDownRight size={13} className="icon-rubbery" />
                <span className="text-[11px] font-medium leading-none">
                  Subtask
                </span>
              </button>
              <button
                onClick={() => togglePriority(task.id)}
                className={`btn-tactile flex items-center justify-center gap-1.5 rounded-full border px-2 py-1 shadow-sm backdrop-blur-md transition-colors ${
                  task.priority
                    ? "border-amber-200/60 bg-amber-100 text-amber-600 dark:border-amber-900/50 dark:bg-amber-900/30 dark:text-amber-400"
                    : "border-neutral-200/60 bg-white/60 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700/50"
                }`}
              >
                <Star
                  size={13}
                  fill={task.priority ? "currentColor" : "none"}
                  className="icon-rubbery"
                />
                <span className="text-[11px] font-medium leading-none">
                  Priority
                </span>
              </button>
              <div className="relative">
                <button
                  onClick={() =>
                    setAssigningProjectId(isAssigningProject ? null : task.id)
                  }
                  className={`btn-tactile flex items-center justify-center gap-1.5 rounded-full border px-2 py-1 shadow-sm backdrop-blur-md transition-colors ${
                    isAssigningProject
                      ? "border-[#9B6AFF]/30 bg-[#9B6AFF]/10 text-[#9B6AFF]"
                      : "border-neutral-200/60 bg-white/60 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700/50"
                  }`}
                >
                  <Hash size={13} className="icon-rubbery" />
                  <span className="text-[11px] font-medium leading-none">
                    Project
                  </span>
                </button>
                {isAssigningProject && (
                  <div className="absolute left-0 top-full z-50 mt-1.5 w-52 rounded-xl border border-neutral-200 bg-white p-1 shadow-2xl dark:border-neutral-700 dark:bg-neutral-800">
                    <div className="custom-scrollbar-hide max-h-[180px] overflow-y-auto">
                      {availableProjects
                        .filter((p) => !projects.includes(p.name))
                        .map((project) => (
                          <button
                            key={project.name}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setTaskProjects(task.id, (prev) =>
                                prev.includes(project.name)
                                  ? prev
                                  : [...prev, project.name],
                              );
                              setAssigningProjectId(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-neutral-600 transition-colors hover:bg-[#9B6AFF]/10 hover:text-[#9B6AFF] dark:text-neutral-400"
                          >
                            <Hash
                              size={11}
                              className="shrink-0 text-[#9B6AFF]/50"
                            />
                            <span className="truncate">{project.name}</span>
                          </button>
                        ))}
                    </div>
                    <div className="mt-0.5 border-t border-neutral-100 pt-0.5 dark:border-neutral-700/50">
                      <div className="flex items-center gap-2 px-2.5 py-1.5">
                        <Hash
                          size={11}
                          className="shrink-0 text-[#9B6AFF]/50"
                        />
                        <input
                          autoFocus
                          placeholder="New project…"
                          className="w-full bg-transparent text-xs font-medium text-neutral-800 outline-none placeholder:text-neutral-400 dark:text-neutral-200"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && e.target.value.trim()) {
                              const val = e.target.value.trim();
                              setTaskProjects(task.id, (prev) =>
                                prev.includes(val) ? prev : [...prev, val],
                              );
                              setAssigningProjectId(null);
                            } else if (e.key === "Escape") {
                              e.stopPropagation();
                              setAssigningProjectId(null);
                            }
                          }}
                          onBlur={() =>
                            setTimeout(() => setAssigningProjectId(null), 150)
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setSettingReminderId(task.id)}
                className="btn-tactile flex items-center justify-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 text-neutral-500 shadow-sm backdrop-blur-md transition-colors hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700/50"
              >
                <Bell size={13} className="icon-rubbery" />
                <span className="text-[11px] font-medium leading-none">
                  Remind
                </span>
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  const res = await copyTask(task);
                  onToast?.(
                    res?.withImage ? "Task and image copied" : "Task copied",
                  );
                }}
                className="btn-tactile flex items-center justify-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 text-neutral-500 shadow-sm backdrop-blur-md transition-colors hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700/50"
              >
                <Copy size={13} className="icon-rubbery" />
                <span className="text-[11px] font-medium leading-none">
                  Copy
                </span>
              </button>
              {task.gcalLink && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.electron?.ipcRenderer.invoke(
                      "open-external",
                      task.gcalLink,
                    );
                  }}
                  className="btn-tactile flex items-center justify-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 shadow-sm backdrop-blur-md transition-colors hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60"
                  title="View in Google Calendar"
                >
                  <Calendar size={13} className="icon-rubbery text-[#4285F4]" />
                </button>
              )}
              {task.jiraLink && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.electron?.ipcRenderer.invoke(
                      "open-external",
                      task.jiraLink,
                    );
                  }}
                  className="btn-tactile flex items-center justify-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 text-[11px] font-bold text-[#0052CC] shadow-sm backdrop-blur-md transition-colors hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60"
                  title="Open in Jira"
                >
                  Jira
                </button>
              )}
            </div>
            <button
              onClick={(e) => triggerDeleteTask(e, task.id)}
              className="btn-tactile flex items-center justify-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 text-neutral-500 shadow-sm backdrop-blur-md transition-colors hover:border-red-200/60 hover:bg-red-50 hover:text-red-500 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-red-900/30"
            >
              <X size={13} className="icon-rubbery" />
              <span className="text-[11px] font-medium leading-none">
                Delete
              </span>
            </button>
          </div>
        )}
        {!isHovered && !isAssigningProject && !isSettingReminder && (
          <div className="mt-2 h-[26px]" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

TaskItem.propTypes = {
  task: PropTypes.object.isRequired,
  showCompleted: PropTypes.bool,
  isEditing: PropTypes.bool,
  isAddingSubtask: PropTypes.bool,
  isAssigningProject: PropTypes.bool,
  isSettingReminder: PropTypes.bool,
  dragOverId: PropTypes.any,
  dragOverPosition: PropTypes.string,
  availableProjects: PropTypes.array.isRequired,
  setEditingId: PropTypes.func.isRequired,
  saveEdit: PropTypes.func.isRequired,
  setAddingSubtaskId: PropTypes.func.isRequired,
  addSubtask: PropTypes.func.isRequired,
  saveSubtaskEdit: PropTypes.func.isRequired,
  setAssigningProjectId: PropTypes.func.isRequired,
  setTaskProjects: PropTypes.func.isRequired,
  setSettingReminderId: PropTypes.func.isRequired,
  saveReminder: PropTypes.func.isRequired,
  toggleTask: PropTypes.func.isRequired,
  togglePriority: PropTypes.func.isRequired,
  toggleSubtask: PropTypes.func.isRequired,
  removeAttachment: PropTypes.func.isRequired,
  triggerDeleteTask: PropTypes.func.isRequired,
  triggerDeleteSubtask: PropTypes.func.isRequired,
  onPreview: PropTypes.func.isRequired,
  onToast: PropTypes.func,
  handleDragStart: PropTypes.func.isRequired,
  handleDragEnd: PropTypes.func.isRequired,
  handleDragOverTask: PropTypes.func.isRequired,
  handleDragLeaveTask: PropTypes.func.isRequired,
  handleDropOnTask: PropTypes.func.isRequired,
  handleDropAction: PropTypes.func.isRequired,
};

// Rows are pure with respect to their props, and there can be hundreds of them
// on screen — without this every keystroke anywhere re-rendered all of them.
export default memo(TaskItem);
