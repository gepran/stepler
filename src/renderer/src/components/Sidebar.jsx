import { useState } from "react";
import PropTypes from "prop-types";
import { Settings, Layers, Plus, Star } from "lucide-react";
import { translatePlural as tPlural, useT } from "../lib/i18n";
import { colorForLabel, labelStyle } from "../lib/labels";
import SteplerLogo from "./SteplerLogo";

function AccountAvatar({ email }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-neutral-200 text-xs font-semibold uppercase text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
      {(email || "?").trim()[0]}
    </span>
  );
}
AccountAvatar.propTypes = { email: PropTypes.string };

export default function Sidebar({
  show,
  tasks,
  onSettingsClick,
  account,
  deletedCount,
  availableProjects,
  selectedProject,
  onProjectClick,
}) {
  const t = useT();
  const [isHovered, setIsHovered] = useState(false);
  const isExpanded = show || isHovered;
  const rowStyle = (selected) =>
    `group flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-orange-400 ${selected ? "bg-orange-500/10 font-semibold text-orange-700 dark:text-orange-300" : "font-medium text-neutral-600 hover:bg-neutral-200/60 dark:text-neutral-400 dark:hover:bg-neutral-800"}`;
  const count = (name) =>
    tasks.filter((task) => task.projects?.includes(name)).length;

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={t("sidebar.projects")}
      className={`relative z-40 h-full shrink-0 border-r border-neutral-200 bg-neutral-50 transition-[width] duration-200 dark:border-neutral-800 dark:bg-neutral-950 ${isExpanded ? "w-60" : "w-16"}`}
    >
      <div
        className="absolute top-0 h-8 w-full border-b border-neutral-200 bg-neutral-100/80 dark:border-neutral-800 dark:bg-neutral-900/80"
        style={{ WebkitAppRegion: "drag" }}
      />
      <div
        aria-hidden={!isExpanded}
        inert={!isExpanded}
        className={`absolute top-8 flex h-[calc(100%-2rem)] w-full flex-col overflow-hidden transition-opacity duration-150 ${isExpanded ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <div className="flex shrink-0 items-center gap-2.5 px-5 py-5">
          <SteplerLogo size={30} />
          <span className="text-[17px] font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Stepler
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-3">
          <div className="mb-2 flex items-center justify-between px-3">
            <span className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500">
              {t("sidebar.projects")}
            </span>
            <button
              type="button"
              onClick={() => onSettingsClick?.("projects")}
              title={t("settings.projects.add")}
              aria-label={t("settings.projects.add")}
              className="rounded-md p-1 text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800"
            >
              <Plus size={15} />
            </button>
          </div>
          <div
            data-project-list="sidebar-expanded"
            className="custom-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto pb-4"
          >
            <button
              type="button"
              onClick={() => onProjectClick?.(null)}
              aria-pressed={selectedProject === null}
              className={rowStyle(selectedProject === null)}
            >
              <Layers size={16} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                {t("sidebar.allProjects")}
              </span>
              <span className="text-[11px] font-normal tabular-nums text-neutral-400">
                {tasks.length}
              </span>
            </button>
            <div className="mx-3 my-3 border-t border-neutral-200/70 dark:border-neutral-800" />
            {availableProjects.map((project) => (
              <button
                type="button"
                key={project.name}
                data-project-name={project.name}
                onClick={() => onProjectClick?.(project.name)}
                aria-pressed={selectedProject === project.name}
                className={rowStyle(selectedProject === project.name)}
              >
                <span
                  style={labelStyle(
                    colorForLabel(project.name, availableProjects),
                  )}
                  className="label-dot ml-1 h-2 w-2 shrink-0 rounded-full"
                />
                <span className="min-w-0 flex-1 truncate" title={project.name}>
                  {project.name}
                </span>
                {project.isFavorite && (
                  <Star size={10} className="shrink-0 text-neutral-400" />
                )}
                <span className="text-[11px] font-normal tabular-nums text-neutral-400">
                  {count(project.name)}
                </span>
              </button>
            ))}
            {!availableProjects.length && (
              <p className="px-3 py-6 text-xs leading-relaxed text-neutral-400">
                {t("sidebar.noProjects")}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 border-t border-neutral-200/70 p-3 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => onSettingsClick?.()}
            title={t("common.settings")}
            className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left text-neutral-500 transition-colors hover:bg-neutral-200/60 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            {account?.signedIn ? (
              <AccountAvatar email={account.email} />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-200/60 dark:bg-neutral-800">
                <Settings size={17} />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-neutral-700 dark:text-neutral-200">
                {account?.signedIn ? account.email : t("common.settings")}
              </span>
              {account?.signedIn && (
                <span className="block text-[11px] text-neutral-400">
                  {t("common.settings")}
                </span>
              )}
            </span>
            {account?.signedIn && <Settings size={15} className="shrink-0" />}
            {deletedCount > 0 && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400"
                aria-label={String(deletedCount)}
              />
            )}
          </button>
        </div>
      </div>
      <div
        aria-hidden={isExpanded}
        inert={isExpanded}
        className={`absolute top-8 flex h-[calc(100%-2rem)] w-full flex-col items-center transition-opacity duration-150 ${isExpanded ? "pointer-events-none opacity-0" : "opacity-100"}`}
      >
        <div className="py-5">
          <SteplerLogo size={30} />
        </div>
        <div
          data-project-list="sidebar-collapsed"
          className="custom-scrollbar flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-y-auto pb-4"
        >
          <button
            type="button"
            onClick={() => onProjectClick?.(null)}
            title={t("sidebar.allProjects")}
            aria-pressed={selectedProject === null}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selectedProject === null ? "bg-orange-500/10 text-orange-600 dark:text-orange-300" : "text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800"}`}
          >
            <Layers size={17} />
          </button>
          <div className="my-2 w-5 border-t border-neutral-200 dark:border-neutral-800" />
          {availableProjects.map((project) => (
            <button
              type="button"
              key={project.name}
              data-project-name={project.name}
              onClick={() => onProjectClick?.(project.name)}
              aria-pressed={selectedProject === project.name}
              title={tPlural("sidebar.projectTasks", count(project.name), {
                name: project.name,
              })}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selectedProject === project.name ? "bg-orange-500/10" : "hover:bg-neutral-200/60 dark:hover:bg-neutral-800"}`}
            >
              <span
                style={labelStyle(
                  colorForLabel(project.name, availableProjects),
                )}
                className="label-dot h-2.5 w-2.5 rounded-full"
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onSettingsClick?.()}
          title={t("common.settings")}
          className="my-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800"
        >
          {account?.signedIn ? (
            <AccountAvatar email={account.email} />
          ) : (
            <Settings size={18} />
          )}
        </button>
      </div>
    </aside>
  );
}
Sidebar.propTypes = {
  show: PropTypes.bool.isRequired,
  tasks: PropTypes.array.isRequired,
  onSettingsClick: PropTypes.func,
  account: PropTypes.shape({
    signedIn: PropTypes.bool,
    email: PropTypes.string,
  }),
  deletedCount: PropTypes.number,
  availableProjects: PropTypes.array.isRequired,
  selectedProject: PropTypes.string,
  onProjectClick: PropTypes.func,
};
