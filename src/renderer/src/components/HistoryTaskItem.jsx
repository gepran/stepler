import PropTypes from "prop-types";
import {
  CheckCircle2,
  FileText,
  Bell,
  Maximize2,
  Hash,
  Calendar,
  Copy,
} from "lucide-react";

export default function HistoryTaskItem({
  task,
  formatTaskText,
  formatTaskDateTime,
  handleCopyImage,
  setPreviewImage,
}) {
  const dt = formatTaskDateTime(task.id);

  return (
    <div
      id={`task-${task.id}`}
      key={task.id}
      className="group/task relative -ml-1.5 flex items-start p-1.5"
    >
      {dt && (
        <div className="absolute right-full inset-y-0 flex items-center pr-8 opacity-0 transition-opacity duration-200 group-hover/task:opacity-100 pointer-events-none z-10">
          <span className="whitespace-nowrap text-[13px] font-medium leading-none tracking-wide text-neutral-400 dark:text-neutral-500">
            {dt.time}
          </span>
        </div>
      )}
      <CheckCircle2
        size={15}
        className="mt-0.5 mr-3 shrink-0 text-neutral-300 dark:text-neutral-600"
      />
      <div className="min-w-0 flex-1">
        <span className="block w-full whitespace-pre-wrap pt-px text-sm leading-relaxed text-neutral-400 line-through dark:text-neutral-500">
          {formatTaskText(task.text || task.title || "")}
        </span>
        {(task.project ||
          (task.projects && task.projects.length > 0) ||
          task.dueDate) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 opacity-50">
            {(task.projects || (task.project ? [task.project] : [])).map(
              (proj, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-500 dark:bg-neutral-800/60 dark:text-neutral-400"
                >
                  <Hash size={10} />
                  <span>{proj}</span>
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
        {task.reminder && (
          <div className="mt-1 flex items-center text-[11px] text-neutral-400 dark:text-neutral-600">
            <Bell size={10} className="mr-1" />
            <span className="line-through">{task.reminder}</span>
          </div>
        )}
        {task.attachment && (
          <div className="mt-2 mb-1 opacity-70">
            {task.attachment.type === "image" ? (
              <div className="relative group/attachment inline-block">
                <img
                  src={task.attachment.url}
                  alt=""
                  onClick={() => setPreviewImage(task.attachment.url)}
                  className="max-h-24 cursor-pointer rounded-lg border border-neutral-200 object-cover transition-opacity group-hover/attachment:opacity-80 dark:border-neutral-800"
                />
                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover/attachment:opacity-100">
                  <button
                    onClick={(e) =>
                      handleCopyImage(e, task.attachment.url)
                    }
                    className="rounded-md bg-black/60 p-1 text-white backdrop-blur-md transition-colors hover:bg-black/80 dark:bg-black/80 dark:hover:bg-black"
                    title="Copy Image"
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewImage(task.attachment.url);
                    }}
                    className="rounded-md bg-black/60 p-1 text-white backdrop-blur-md transition-colors hover:bg-black/80 dark:bg-black/80 dark:hover:bg-black"
                    title="Preview"
                  >
                    <Maximize2 size={12} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex w-fit items-center rounded-lg border border-neutral-200 bg-neutral-100 p-2 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
                <FileText size={12} className="mr-2 shrink-0" />
                <span className="max-w-[150px] truncate">
                  {task.attachment.name}
                </span>
              </div>
            )}
          </div>
        )}
        {/* Subtasks for History */}
        {task.subtasks && task.subtasks.length > 0 && (
          <div className="mt-2 space-y-1 pl-1">
            {[...task.subtasks]
              .sort((a, b) =>
                b.completed === a.completed ? 0 : a.completed ? -1 : 1,
              )
              .map((st) => (
                <div
                  key={st.id}
                  className="flex items-start rounded p-1"
                >
                  <CheckCircle2
                    size={13}
                    className="mt-0.5 mr-2 shrink-0 text-neutral-300 dark:text-neutral-600"
                  />
                  <div className="min-w-0 flex-1">
                    {st.text && (
                      <span className="block w-full whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-400 line-through dark:text-neutral-500">
                        {formatTaskText(st.text)}
                      </span>
                    )}
                    {st.attachment && st.attachment.type === "image" && (
                      <div className="mt-1 relative group/st_attachment inline-block">
                        <img
                          src={st.attachment.url}
                          alt=""
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewImage(st.attachment.url);
                          }}
                          className="max-h-24 cursor-pointer rounded-lg border border-neutral-200 object-cover opacity-60 transition-opacity group-hover/st_attachment:opacity-100 dark:border-neutral-800"
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
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

HistoryTaskItem.propTypes = {
  task: PropTypes.object.isRequired,
  formatTaskText: PropTypes.func.isRequired,
  formatTaskDateTime: PropTypes.func.isRequired,
  handleCopyImage: PropTypes.func.isRequired,
  setPreviewImage: PropTypes.func.isRequired,
};
