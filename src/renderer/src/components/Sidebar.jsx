import { useMemo } from "react";
import PropTypes from "prop-types";
import { CalendarDays, Settings, Trash2 } from "lucide-react";
import SteplerLogo from "./SteplerLogo";

export default function Sidebar({
  show,
  history,
  tasks,
  onDayClick,
  onSettingsClick,
  deletedCount,
  onTrashClick,
}) {
  const allDays = useMemo(() => {
    const todayTasksCount = tasks.length;

    const reversedHistory = [...history].reverse().map((day) => ({
      date: day.date,
      count: day.tasks.length,
      isToday: false,
    }));

    return [
      { date: "Today", count: todayTasksCount, isToday: true },
      ...reversedHistory,
    ];
  }, [history, tasks]);

  const maxTasks = useMemo(() => {
    if (allDays.length === 0) return 0;
    return Math.max(...allDays.map((d) => d.count));
  }, [allDays]);

  const getDayMonth = (dateStr) => {
    if (dateStr === "Today") {
      const d = new Date();
      return {
        day: d.getDate(),
        month: d.toLocaleString("en-US", { month: "short" }),
      };
    }
    const parts = dateStr.split(" ");
    const day = parts[0] || "";
    const month = parts[1] ? parts[1].substring(0, 3) : "";
    return { day, month };
  };

  return (
    <div
      className={`flex flex-col h-full dark:border-neutral-800 transition-all duration-300 ease-in-out z-50 relative shrink-0 ${
        show ? "w-64" : "w-16"
      }`}
    >
      <div
        className="absolute top-0 left-0 w-full h-8 shrink-0 border-b border-neutral-200 bg-neutral-100/80 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/80 z-20"
        style={{ WebkitAppRegion: "drag", borderRightWidth: 0 }}
      />

      <div
        className={`absolute top-8 left-0 flex h-[calc(100%-2rem)] w-64 flex-col bg-white overflow-hidden transition-opacity duration-300 dark:bg-neutral-900 z-10 ${
          show
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="px-4 pb-4 pt-3 shrink-0 flex flex-col">
          <div
            className="flex items-center text-neutral-800 dark:text-neutral-200"
            style={{ WebkitAppRegion: "no-drag" }}
          >
            <SteplerLogo size={50} className="mr-2.5" />
            <span className="text-xl font-bold tracking-wide">Stepler</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
          <div className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 mb-3 flex items-center uppercase tracking-wider">
            <CalendarDays size={13} className="mr-2" /> Activity
          </div>

          <div className="space-y-1.5 pb-6">
            {allDays.map((day, idx) => {
              const intensity = maxTasks > 0 ? day.count / maxTasks : 0;
              return (
                <div
                  key={idx}
                  onClick={() => onDayClick?.(day.date)}
                  className="btn-tactile group flex flex-col p-2.5 rounded-xl hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer border border-transparent hover:border-neutral-200/50 dark:hover:border-neutral-700/50"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span
                      className={`text-sm font-medium ${day.isToday ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-500 dark:text-neutral-400"}`}
                    >
                      {day.date}
                    </span>
                    <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800/80 px-1.5 py-0.5 rounded">
                      {day.count} {day.count === 1 ? "task" : "tasks"}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-800/80 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        day.isToday
                          ? "bg-neutral-700 dark:bg-neutral-300"
                          : intensity > 0.6
                            ? "bg-neutral-500 dark:bg-neutral-400"
                            : intensity > 0.25
                              ? "bg-neutral-400 dark:bg-neutral-500"
                              : "bg-neutral-200 dark:bg-neutral-700"
                      }`}
                      style={{ width: `${Math.max(intensity * 100, 3)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {allDays.length === 0 && (
              <div className="py-6 text-center text-xs text-neutral-400 dark:text-neutral-500 italic">
                No days found.
              </div>
            )}
          </div>
        </div>
        <div className="p-4 shrink-0 flex flex-col gap-1">
          <button
            onClick={onTrashClick}
            className="btn-tactile flex items-center w-full gap-2 p-2 rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors relative"
          >
            <Trash2 size={18} className="icon-rubbery" />
            <span className="text-sm font-medium">Trash</span>
            {deletedCount > 0 && (
              <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-100 px-1.5 text-[11px] font-semibold text-red-500 dark:bg-red-500/10">
                {deletedCount > 99 ? "99+" : deletedCount}
              </span>
            )}
          </button>
          <button
            onClick={onSettingsClick}
            className="btn-tactile flex items-center w-full gap-2 p-2 rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors"
          >
            <Settings size={18} className="icon-rubbery" />
            <span className="text-sm font-medium">Settings</span>
          </button>
        </div>
      </div>

      <div
        className={`absolute top-8 left-0 flex h-[calc(100%-2rem)] w-16 flex-col bg-white transition-opacity duration-300 dark:bg-neutral-900 z-10 ${
          show
            ? "opacity-0 pointer-events-none"
            : "opacity-100 pointer-events-auto"
        }`}
      >
        <div className="shrink-0 flex justify-center py-4">
          <SteplerLogo size={50} />
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col items-center py-2 space-y-3 pb-6">
          {allDays.map((day, idx) => {
            const { day: dNum, month } = getDayMonth(day.date);
            const intensity = maxTasks > 0 ? day.count / maxTasks : 0;

            let bgColor = "bg-neutral-100 dark:bg-neutral-800/60";
            let borderColor = "border-transparent";
            let textColor = "text-neutral-500 dark:text-neutral-400";

            if (day.isToday) {
              bgColor = "bg-neutral-200 dark:bg-neutral-800";
              borderColor = "border-neutral-300 dark:border-neutral-700";
              textColor = "text-neutral-900 dark:text-neutral-100";
            } else if (intensity > 0.6) {
              bgColor = "bg-neutral-150 dark:bg-neutral-700/50";
              borderColor = "border-neutral-200 dark:border-neutral-600/30";
              textColor = "text-neutral-700 dark:text-neutral-300";
            } else if (intensity > 0.25) {
              bgColor = "bg-neutral-100/50 dark:bg-neutral-800/30";
              borderColor = "border-transparent";
              textColor = "text-neutral-600 dark:text-neutral-400/80";
            }

            return (
              <div
                key={idx}
                onClick={() => onDayClick?.(day.date)}
                className={`btn-tactile group relative flex h-11 w-11 shrink-0 cursor-pointer flex-col items-center justify-center rounded-full border transition-colors hover:border-neutral-300 dark:hover:border-neutral-600 ${bgColor} ${borderColor} ${textColor}`}
                title={`${day.date} - ${day.count} tasks`}
              >
                <span className="text-[13px] font-bold leading-none">
                  {dNum}
                </span>
                <span className="mt-0.5 text-[8px] font-semibold uppercase leading-tight tracking-wider opacity-80">
                  {month}
                </span>

                {day.count > 0 && (
                  <div className="absolute -right-0.5 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-white bg-neutral-600 px-1 text-[9px] font-bold text-white shadow-sm dark:border-neutral-900 dark:bg-neutral-400 dark:text-neutral-950">
                    {day.count > 99 ? "99+" : day.count}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="p-3 shrink-0 flex flex-col items-center gap-2">
          <button
            onClick={onTrashClick}
            className="btn-tactile relative p-2 rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors"
            title="Trash"
          >
            <Trash2 size={18} className="icon-rubbery" />
            {deletedCount > 0 && (
              <div className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm dark:border-neutral-900">
                {deletedCount > 99 ? "99+" : deletedCount}
              </div>
            )}
          </button>
          <button
            onClick={onSettingsClick}
            className="btn-tactile p-2 rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors"
            title="Settings"
          >
            <Settings size={18} className="icon-rubbery" />
          </button>
        </div>
      </div>
    </div>
  );
}

Sidebar.propTypes = {
  show: PropTypes.bool.isRequired,
  history: PropTypes.array.isRequired,
  tasks: PropTypes.array.isRequired,
  onDayClick: PropTypes.func,
  onSettingsClick: PropTypes.func,
  deletedCount: PropTypes.number,
  onTrashClick: PropTypes.func,
};
