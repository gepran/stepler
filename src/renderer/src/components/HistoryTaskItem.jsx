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
        className="mt-0.5 mr-3 shrink-0 text-yellow-500/60 dark:text-yellow-500/40"
      />
      <div className="min-w-0 flex-1">
        <span className="block w-full whitespace-pre-wrap pt-px text-sm leading-relaxed text-neutral-400 line-through dark:text-neutral-500">
          {formatTaskText(task.text || task.title || "")}
        </span>
        {(task.project ||
          (task.projects && task.projects.length > 0) ||
          task.dueDate ||
          task.gcalLink) && (
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
            {task.gcalLink && (
              <a
                href={task.gcalLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-center rounded p-[3px] transition-colors hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50"
                title="View in Google Calendar"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </a>
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
                    onClick={(e) => handleCopyImage(e, task.attachment.url)}
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
                <div key={st.id} className="flex items-start rounded p-1">
                  <CheckCircle2
                    size={13}
                    className="mt-0.5 mr-2 shrink-0 text-yellow-500/60 dark:text-yellow-500/40"
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
