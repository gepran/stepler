import { useState, useMemo } from "react";
import PropTypes from "prop-types";
import { Search, CalendarDays } from "lucide-react";

export default function Sidebar({ show, history, tasks }) {
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredDays = useMemo(() => {
    if (!searchQuery.trim()) return allDays;
    const lowerQ = searchQuery.toLowerCase();
    return allDays.filter(
      (d) =>
        d.date.toLowerCase().includes(lowerQ) ||
        d.count.toString().includes(lowerQ),
    );
  }, [allDays, searchQuery]);

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
    const parts = dateStr.replace(",", "").split(" ");
    const month = parts[1] ? parts[1].substring(0, 3) : "";
    const day = parts[2] || "";
    return { day, month };
  };

  return (
    <div
      className={`flex flex-col h-full bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 transition-all duration-300 ease-in-out z-50 relative shrink-0 ${
        show ? "w-64" : "w-16"
      }`}
    >
      {/* Expanded Content */}
      <div
        className={`fixed top-0 left-0 flex h-full w-64 flex-col bg-white overflow-hidden transition-opacity duration-300 dark:bg-neutral-900 ${
          show
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className="p-4 shrink-0 flex items-center h-14 mt-6"
          style={{ WebkitAppRegion: "drag", paddingLeft: "24px" }}
        >
          {/* Header area in sidebar aligns with App header height 14 */}
          <div
            className="w-full relative mt-[-6px]"
            style={{ WebkitAppRegion: "no-drag" }}
          >
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500"
              size={14}
            />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-100 dark:bg-neutral-800/80 text-sm text-neutral-800 dark:text-neutral-200 rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-300 dark:focus:ring-neutral-600 transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
          <div className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 mb-3 flex items-center uppercase tracking-wider">
            <CalendarDays size={13} className="mr-2" /> Activity
          </div>

          <div className="space-y-1.5 pb-6">
            {filteredDays.map((day, idx) => {
              const intensity = maxTasks > 0 ? day.count / maxTasks : 0;
              return (
                <div
                  key={idx}
                  className="group flex flex-col p-2.5 rounded-xl hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer border border-transparent hover:border-neutral-200/50 dark:hover:border-neutral-700/50"
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

                  {/* Intensity Bar (Busyness indicator) */}
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
            {filteredDays.length === 0 && (
              <div className="py-6 text-center text-xs text-neutral-400 dark:text-neutral-500 italic">
                No days found.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Narrow Content */}
      <div
        className={`fixed top-0 left-0 flex h-full w-16 flex-col bg-white transition-opacity duration-300 dark:bg-neutral-900 ${
          show
            ? "opacity-0 pointer-events-none"
            : "opacity-100 pointer-events-auto"
        }`}
      >
        {/* Space for drag controls / traffic lights */}
        <div
          className="h-12 mt-2 shrink-0 w-full"
          style={{ WebkitAppRegion: "drag" }}
        />
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col items-center py-4 space-y-3 pb-6">
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
                className={`group relative flex h-11 w-11 shrink-0 cursor-pointer flex-col items-center justify-center rounded-full border transition-colors hover:border-neutral-300 dark:hover:border-neutral-600 ${bgColor} ${borderColor} ${textColor}`}
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
      </div>
    </div>
  );
}

Sidebar.propTypes = {
  show: PropTypes.bool.isRequired,
  history: PropTypes.array.isRequired,
  tasks: PropTypes.array.isRequired,
};
