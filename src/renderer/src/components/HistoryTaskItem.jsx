import { memo } from "react";
import PropTypes from "prop-types";
import FileTypeIcon from "./FileTypeIcon";
import AttachmentImage from "./AttachmentImage";
import {
  formatTaskText,
  formatTaskDateTime,
  dueDateLabel,
} from "../lib/format";
import { isMissing, copyAttachmentImage, copyTask } from "../lib/attachments";
import {
  CheckCircle2,
  Bell,
  Maximize2,
  Hash,
  Calendar,
  Copy,
  Undo2,
  ImageOff,
} from "lucide-react";
import { useT } from "../lib/i18n";

function HistoryTaskItem({ task, onPreview, onReopen, onToast }) {
  const t = useT();
  const dt = formatTaskDateTime(task.id);
  const projects = task.projects || [];

  return (
    <div
      id={`task-${task.id}`}
      className="group/task relative -ml-1.5 flex items-start p-1.5"
    >
      {dt && (
        <div className="pointer-events-none absolute inset-y-0 right-full z-10 flex items-center pr-8 opacity-0 transition-opacity duration-200 group-hover/task:opacity-100">
          <span className="whitespace-nowrap text-[13px] font-medium leading-none tracking-wide text-neutral-400 dark:text-neutral-500">
            {dt.time}
          </span>
        </div>
      )}
      <CheckCircle2
        size={15}
        className="mr-3 mt-0.5 shrink-0 text-yellow-500/60 dark:text-yellow-500/40"
      />
      <div className="min-w-0 flex-1">
        <span className="block w-full whitespace-pre-wrap pt-px text-sm leading-relaxed text-neutral-400 line-through dark:text-neutral-500">
          {formatTaskText(task.text || "")}
        </span>

        {(projects.length > 0 || task.dueDate) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 opacity-50">
            {projects.map((proj) => (
              <div
                key={proj}
                className="flex items-center gap-1 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-500 dark:bg-neutral-800/60 dark:text-neutral-400"
              >
                <Hash size={10} />
                <span>{proj}</span>
              </div>
            ))}
            {task.dueDate && (
              <div className="flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                <Calendar size={10} />
                <span>{dueDateLabel(task.dueDate)}</span>
              </div>
            )}
          </div>
        )}

        {task.reminder && (
          <div className="mt-1 flex items-center text-[11px] text-neutral-400 dark:text-neutral-600">
            <Bell size={10} className="mr-1" />
            <span className="line-through">{task.reminder}</span>
          </div>
        )}

        {task.attachment && (
          <div className="mb-1 mt-2 opacity-70">
            {isMissing(task.attachment) ? (
              <div className="flex w-fit items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-2 py-1 text-[11px] text-neutral-400 dark:border-neutral-700">
                <ImageOff size={12} />
                <span className="max-w-[200px] truncate">
                  {task.attachment.name}
                </span>
              </div>
            ) : task.attachment.type === "image" ? (
              <div className="group/attachment relative inline-block">
                <AttachmentImage
                  att={task.attachment}
                  onClick={() => onPreview(task.attachment)}
                  className="max-h-24 cursor-pointer rounded-lg border border-neutral-200 object-cover dark:border-neutral-800"
                />
                <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover/attachment:opacity-100">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const res = await copyAttachmentImage(task.attachment);
                      onToast?.(
                        res?.success
                          ? t("toast.imageCopied")
                          : t("toast.copyFailed"),
                        res?.success ? "info" : "error",
                      );
                    }}
                    className="btn-tactile rounded-md bg-black/60 p-1 text-white backdrop-blur-md hover:bg-black/80"
                    title={t("common.copyImage")}
                  >
                    <Copy size={12} className="icon-rubbery" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreview(task.attachment);
                    }}
                    className="btn-tactile rounded-md bg-black/60 p-1 text-white backdrop-blur-md hover:bg-black/80"
                    title={t("common.preview")}
                  >
                    <Maximize2 size={12} className="icon-rubbery" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => onPreview(task.attachment)}
                className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/80"
              >
                <FileTypeIcon fileName={task.attachment.name} size={20} />
                <span className="max-w-[150px] truncate">
                  {task.attachment.name}
                </span>
              </div>
            )}
          </div>
        )}

        {task.subtasks?.length > 0 && (
          <div className="mt-2 space-y-1 pl-1">
            {task.subtasks.map((st) => (
              <div key={st.id} className="flex items-start rounded p-1">
                <CheckCircle2
                  size={13}
                  className="mr-2 mt-0.5 shrink-0 text-yellow-500/40 dark:text-yellow-500/30"
                />
                <div className="min-w-0 flex-1">
                  {st.text && (
                    <span className="block w-full whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-400 line-through dark:text-neutral-500">
                      {formatTaskText(st.text)}
                    </span>
                  )}
                  {st.attachment &&
                    !isMissing(st.attachment) &&
                    st.attachment.type === "image" && (
                      <AttachmentImage
                        att={st.attachment}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreview(st.attachment);
                        }}
                        className="mt-1 max-h-20 cursor-pointer rounded-lg border border-neutral-200 object-cover dark:border-neutral-800"
                      />
                    )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Past notes are read-only, but you can still take them back or copy them. */}
        <div className="mt-1.5 flex items-center gap-1.5 opacity-0 transition-opacity group-hover/task:opacity-100">
          <button
            onClick={() => onReopen(task.id)}
            className="btn-tactile flex items-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 text-neutral-500 shadow-sm backdrop-blur-md transition-colors hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400"
            title={t("task.carryOver")}
          >
            <Undo2 size={12} className="icon-rubbery" />
            <span className="text-[11px] font-medium leading-none">
              {t("task.moveToToday")}
            </span>
          </button>
          <button
            onClick={async () => {
              const res = await copyTask(task);
              onToast?.(
                res?.withImage
                  ? t("toast.taskAndImageCopied")
                  : t("toast.taskCopied"),
              );
            }}
            className="btn-tactile flex items-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 text-neutral-500 shadow-sm backdrop-blur-md transition-colors hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400"
          >
            <Copy size={12} className="icon-rubbery" />
            <span className="text-[11px] font-medium leading-none">Copy</span>
          </button>
        </div>
      </div>
    </div>
  );
}

HistoryTaskItem.propTypes = {
  task: PropTypes.object.isRequired,
  onPreview: PropTypes.func.isRequired,
  onReopen: PropTypes.func.isRequired,
  onToast: PropTypes.func,
};

export default memo(HistoryTaskItem);
