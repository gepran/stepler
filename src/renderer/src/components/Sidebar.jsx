import { useState } from "react";
import PropTypes from "prop-types";
import { Settings, Trash2, Layers } from "lucide-react";
import SteplerLogo from "./SteplerLogo";

export default function Sidebar({
  show,
  tasks,
  onSettingsClick,
  deletedCount,
  onTrashClick,
  availableProjects,
  selectedProject,
  onProjectClick,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const isExpanded = show || isHovered;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`flex flex-col h-full border-r border-neutral-200 dark:border-neutral-800 transition-all duration-300 ease-in-out z-50 relative shrink-0 ${
        isExpanded ? "w-64" : "w-16"
      }`}
    >
      <div
        className="absolute top-0 left-0 w-full h-8 shrink-0 border-b border-neutral-200 bg-neutral-100/80 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/80 z-20"
        style={{ WebkitAppRegion: "drag", borderRightWidth: 0 }}
      />

      <div
        className={`absolute top-8 left-0 flex h-[calc(100%-2rem)] w-full flex-col bg-white overflow-hidden transition-opacity duration-300 dark:bg-neutral-900 z-10 ${
          isExpanded
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
            <Layers size={13} className="mr-2" /> Projects
          </div>

          <div className="space-y-2 pb-6">
            <div
              onClick={() => onProjectClick?.(null)}
              className={`btn-tactile group flex items-center p-3 rounded-xl transition-all cursor-pointer border shadow-sm ${
                selectedProject === null
                  ? "bg-blue-50 border-blue-200/60 dark:bg-blue-900/30 dark:border-blue-700/50 text-blue-600 dark:text-blue-400 shadow-blue-100/50 dark:shadow-blue-900/20"
                  : "bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200/60 dark:border-neutral-700/40 hover:bg-neutral-100 dark:hover:bg-neutral-800/70 text-neutral-600 dark:text-neutral-400 hover:shadow-md"
              }`}
            >
              <Layers size={16} className="mr-3" />
              <span className="text-sm font-medium">All Projects</span>
              <span className="ml-auto text-[11px] font-semibold bg-neutral-100 dark:bg-neutral-800/80 px-1.5 py-0.5 rounded text-neutral-500">
                {tasks.length}
              </span>
            </div>

            <div className="my-2 border-t border-neutral-100 dark:border-neutral-800" />

            {availableProjects.map((project, idx) => {
              const projectTasksCount = tasks.filter(t => t.projects?.includes(project.name)).length;
              return (
                <div
                  key={idx}
                  onClick={() => onProjectClick?.(project.name)}
                  className={`btn-tactile group flex items-center p-3 rounded-xl transition-all cursor-pointer border shadow-sm ${
                    selectedProject === project.name
                      ? "bg-blue-50 border-blue-200/60 dark:bg-blue-900/30 dark:border-blue-700/50 text-blue-600 dark:text-blue-400 shadow-blue-100/50 dark:shadow-blue-900/20"
                      : "bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200/60 dark:border-neutral-700/40 hover:bg-neutral-100 dark:hover:bg-neutral-800/70 text-neutral-600 dark:text-neutral-400 hover:shadow-md"
                  }`}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-violet-500 mr-3 shrink-0" />
                  <span className="text-sm font-medium truncate mr-2">
                    {project.name}
                  </span>
                  <span className="ml-auto text-[11px] font-semibold bg-neutral-100 dark:bg-neutral-800/80 px-1.5 py-0.5 rounded text-neutral-500">
                    {projectTasksCount}
                  </span>
                </div>
              );
            })}
            {availableProjects.length === 0 && (
              <div className="py-6 text-center text-xs text-neutral-400 dark:text-neutral-500 italic">
                No projects found.
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
        className={`absolute top-8 left-0 flex h-[calc(100%-2rem)] w-full flex-col bg-white transition-opacity duration-300 dark:bg-neutral-900 z-10 ${
          isExpanded
            ? "opacity-0 pointer-events-none"
            : "opacity-100 pointer-events-auto"
        }`}
      >
        <div className="shrink-0 flex justify-center py-4">
          <SteplerLogo size={50} />
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col items-center py-2 space-y-3 pb-6">
          <div
            onClick={() => onProjectClick?.(null)}
            className={`btn-tactile group relative flex h-11 w-11 shrink-0 cursor-pointer flex-col items-center justify-center rounded-full border transition-colors ${
              selectedProject === null
                ? "bg-blue-50/50 border-blue-200/50 dark:bg-blue-900/20 dark:border-blue-800/50 text-blue-600 dark:text-blue-400"
                : "bg-neutral-100/50 dark:bg-neutral-800/30 border-transparent text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600"
            }`}
            title="All Projects"
          >
            <Layers size={18} />
          </div>

          <div className="w-8 border-t border-neutral-100 dark:border-neutral-800" />

          {availableProjects.map((project, idx) => {
            const projectTasksCount = tasks.filter(t => t.projects?.includes(project.name)).length;
            return (
              <div
                key={idx}
                onClick={() => onProjectClick?.(project.name)}
                className={`btn-tactile group relative flex h-11 w-11 shrink-0 cursor-pointer flex-col items-center justify-center rounded-full border transition-colors ${
                  selectedProject === project.name
                    ? "bg-blue-50/50 border-blue-200/50 dark:bg-blue-900/20 dark:border-blue-800/50 text-blue-600 dark:text-blue-400"
                    : "bg-neutral-100/50 dark:bg-neutral-800/30 border-transparent text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600"
                }`}
                title={`${project.name} - ${projectTasksCount} tasks`}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                {projectTasksCount > 0 && (
                  <div className="absolute -right-0.5 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-white bg-neutral-600 px-1 text-[9px] font-bold text-white shadow-sm dark:border-neutral-900 dark:bg-neutral-400 dark:text-neutral-950">
                    {projectTasksCount > 99 ? "99+" : projectTasksCount}
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
  tasks: PropTypes.array.isRequired,
  onSettingsClick: PropTypes.func,
  deletedCount: PropTypes.number,
  onTrashClick: PropTypes.func,
  availableProjects: PropTypes.array.isRequired,
  selectedProject: PropTypes.string,
  onProjectClick: PropTypes.func,
};
