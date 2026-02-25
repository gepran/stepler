import { useRef } from "react";
import PropTypes from "prop-types";
import SteplerLogo from "./SteplerLogo";
import {
  X,
  FileText,
  Plus,
  Settings,
  Maximize2,
  Minimize2,
  ArrowUp,
  Mic,
  User,
  Zap,
  Calendar,
  Hash,
  CalendarDays,
  Briefcase,
  Copy,
} from "lucide-react";

const isMac =
  window.electron?.process?.platform === "darwin" ||
  /Mac/.test(navigator.userAgent);

export default function TaskInput({
  inputValue,
  setInputValue,
  inputRef,
  addTask,
  handlePaste,
  handleFileChange,
  handleCopyImage,
  isExpanded,
  setIsExpanded,
  pendingAttachment,
  setPendingAttachment,
  draftProjects,
  setDraftProjects,
  draftDate,
  setDraftDate,
  showDateMenu,
  setShowDateMenu,
  showProjectMenu,
  setShowProjectMenu,
  setShowSettings,
}) {
  const fileInputRef = useRef(null);

  return (
    <div
      className={`z-40 flex shrink-0 justify-center transition-all duration-300 ${
        isExpanded
          ? "fixed inset-0 bg-neutral-950 p-6 md:p-12 z-[100]"
          : "p-4 md:p-6"
      }`}
    >
      <div
        className={`w-full max-w-3xl flex flex-col ${isExpanded ? "h-full justify-center max-w-4xl mx-auto" : ""}`}
      >
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xl font-medium text-neutral-800 dark:text-neutral-200">
            <SteplerLogo size={26} />
            <span>What&apos;s on your mind?</span>
          </div>
        </div>

        <div className="relative flex flex-col">
          {pendingAttachment && (
            <div
              className={`absolute bottom-full left-0 mb-3 flex items-center shadow-lg ${pendingAttachment.type === "image" ? "rounded-lg" : "rounded-lg border border-neutral-300 bg-neutral-100 p-1.5 pr-2 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"}`}
            >
              {pendingAttachment.type === "image" ? (
                <div className="relative group/pending inline-block">
                  <img
                    src={pendingAttachment.url}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-lg object-cover border border-neutral-200 dark:border-neutral-800"
                  />
                  <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover/pending:opacity-100">
                    <button
                      onClick={(e) =>
                        handleCopyImage(e, pendingAttachment.url)
                      }
                      className="rounded-md bg-black/60 p-1 text-white backdrop-blur-md transition-colors hover:bg-neutral-800 dark:bg-black/80 dark:hover:bg-neutral-700"
                      title="Copy Image"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      onClick={() => setPendingAttachment(null)}
                      className="rounded-md bg-black/60 p-1 text-white backdrop-blur-md transition-colors hover:bg-red-500/90 hover:text-white dark:bg-black/80 dark:hover:bg-red-600/90"
                      title="Remove Attachment"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <FileText size={16} className="mr-2 ml-1 shrink-0" />
                  <span className="mr-3 max-w-[200px] truncate">
                    {pendingAttachment.name}
                  </span>
                  <button
                    onClick={() => setPendingAttachment(null)}
                    className="shrink-0 rounded-md p-1 text-neutral-400 transition-colors hover:text-neutral-900 dark:hover:text-neutral-200"
                  >
                    <X size={14} />
                  </button>
                </>
              )}
            </div>
          )}

          <div
            className={`relative flex flex-col rounded-[24px] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.05)] border ${
              draftProjects.length > 0 || draftDate
                ? "border-indigo-500/50"
                : "border-neutral-200 dark:border-neutral-800/80"
            } transition-all duration-300 dark:bg-[#1a1a1a] ${
              isExpanded ? "h-[60vh] md:h-[70vh]" : "min-h-[48px]"
            }`}
          >
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`absolute right-4 z-10 rounded-md text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-200 ${
                isExpanded ? "top-4" : "top-3.5"
              }`}
            >
              {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>

            {(!isExpanded || isExpanded) &&
              (draftProjects.length > 0 || draftDate) && (
                <div className="flex flex-col px-5 pt-4 pb-0 gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {draftProjects.length > 0 &&
                      draftProjects.map((p, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 rounded-full bg-neutral-100 dark:bg-[#222] border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-500"
                        >
                          <User size={14} />
                          {p}
                          <button
                            onClick={() =>
                              setDraftProjects((prev) =>
                                prev.filter((x) => x !== p),
                              )
                            }
                            className="ml-1 text-green-600/50 hover:text-green-600 dark:text-green-500/50 dark:hover:text-green-500"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    {draftDate && (
                      <div className="flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-[#1f1e2e] border border-indigo-200 dark:border-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-400">
                        <CalendarDays size={14} />
                        {draftDate}
                        <button
                          onClick={() => setDraftDate(null)}
                          className="ml-1 text-indigo-600/50 hover:text-indigo-600 dark:text-indigo-400/50 dark:hover:text-indigo-400"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={addTask}
              onPaste={handlePaste}
              rows={isExpanded ? undefined : 1}
              onInput={(e) => {
                if (!isExpanded) {
                  e.target.style.height = "auto";
                  e.target.style.height =
                    Math.min(e.target.scrollHeight, 160) + "px";
                }
              }}
              placeholder="What's on your mind?"
              className={`flex-1 resize-none bg-transparent text-[16px] leading-relaxed text-neutral-800 placeholder-neutral-400 focus:outline-none dark:text-neutral-200 dark:placeholder-neutral-500 ${
                isExpanded
                  ? "w-full px-5 pr-12 mt-4 py-6 h-full"
                  : "w-full pl-5 pr-12 py-3"
              }`}
              style={isExpanded ? { height: "100%" } : {}}
            />

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Bottom tools row */}
            <div
              className={`flex items-center ${
                isExpanded
                  ? "justify-between mt-auto p-3 w-full border-t border-transparent"
                  : "justify-between px-5 pb-4 mt-2"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                {/* Date button */}
                <div className="relative">
                  <button
                    onClick={() => setShowDateMenu(!showDateMenu)}
                    className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors ${
                      draftDate
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400"
                        : "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <Calendar size={16} />
                    <span>{draftDate || "Date"}</span>
                  </button>

                  {/* Date Menu Popup */}
                  {showDateMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowDateMenu(false)}
                      />
                      <div className="absolute bottom-full left-0 z-50 mb-2 w-48 rounded-xl border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-800 dark:bg-[#1a1a1a]">
                        <div className="mb-2 px-2 pt-1 text-[10px] font-bold tracking-widest text-neutral-400 dark:text-neutral-500">
                          DUE DATE
                        </div>
                        {[
                          {
                            label: "Today",
                            icon: Zap,
                            color: "text-amber-500",
                          },
                          {
                            label: "Tomorrow",
                            icon: Calendar,
                            color: "text-blue-500",
                          },
                          {
                            label: "Next Week",
                            icon: CalendarDays,
                            color: "text-indigo-500",
                          },
                        ].map((item) => (
                          <button
                            key={item.label}
                            onClick={() => {
                              setDraftDate(item.label);
                              setShowDateMenu(false);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                          >
                            <item.icon size={16} className={item.color} />
                            <span>{item.label}</span>
                          </button>
                        ))}
                        <div className="my-1 h-px bg-neutral-100 dark:bg-neutral-800" />
                        <button
                          onClick={() => {
                            setDraftDate(null);
                            setShowDateMenu(false);
                          }}
                          className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                          Clear Date
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Project button */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowProjectMenu(!showProjectMenu);
                      if (!showProjectMenu) inputRef.current?.blur();
                    }}
                    className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors ${
                      draftProjects.length > 0
                        ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                        : "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <Hash size={16} />
                    <span>
                      {draftProjects.length > 0
                        ? `${draftProjects.length} Project${draftProjects.length > 1 ? "s" : ""}`
                        : "Project"}
                    </span>
                  </button>

                  {/* Project Menu Popup */}
                  {showProjectMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowProjectMenu(false)}
                      />
                      <div className="absolute bottom-full left-0 z-50 mb-2 w-48 rounded-xl border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-800 dark:bg-[#1a1a1a]">
                        <div className="mb-2 px-2 pt-1 text-[10px] font-bold tracking-widest text-neutral-400 dark:text-neutral-500">
                          ASSIGN PROJECT
                        </div>
                        <div className="px-2 pb-2">
                          <input
                            type="text"
                            autoFocus
                            placeholder="+ New project..."
                            className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-300 dark:focus:ring-neutral-700 text-neutral-800 dark:text-neutral-200"
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.preventDefault();
                                setShowProjectMenu(false);
                                inputRef.current?.focus();
                                return;
                              }
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const val = e.target.value.trim();
                                if (val) {
                                  const newProjects =
                                    draftProjects.includes(val)
                                      ? draftProjects
                                      : [...draftProjects, val];
                                  setDraftProjects(newProjects);
                                  e.target.value = "";
                                  if (!e.shiftKey) {
                                    setShowProjectMenu(false);
                                    inputRef.current?.focus();
                                    addTask(
                                      {
                                        key: "Enter",
                                        preventDefault: () => {},
                                      },
                                      newProjects,
                                    );
                                  }
                                } else {
                                  setShowProjectMenu(false);
                                  if (!e.shiftKey) {
                                    addTask();
                                  } else {
                                    inputRef.current?.focus();
                                  }
                                }
                              }
                            }}
                          />
                        </div>
                        {[
                          {
                            label: "Work",
                            icon: Briefcase,
                            color: "text-blue-500",
                          },
                          {
                            label: "Personal",
                            icon: User,
                            color: "text-green-500",
                          },
                          {
                            label: "Health",
                            icon: Zap,
                            color: "text-orange-500",
                          },
                        ].map((item) => (
                          <button
                            key={item.label}
                            onClick={(e) => {
                              const newProjects = draftProjects.includes(
                                item.label,
                              )
                                ? draftProjects
                                : [...draftProjects, item.label];
                              setDraftProjects(newProjects);
                              if (!e.shiftKey) {
                                setShowProjectMenu(false);
                                inputRef.current?.focus();
                                addTask(
                                  {
                                    key: "Enter",
                                    preventDefault: () => {},
                                  },
                                  newProjects,
                                );
                              }
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                          >
                            <item.icon size={16} className={item.color} />
                            <span>{item.label}</span>
                          </button>
                        ))}
                        <div className="my-1 h-px bg-neutral-100 dark:bg-neutral-800" />
                        <button
                          onClick={() => {
                            setDraftProjects([]);
                            setShowProjectMenu(false);
                          }}
                          className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                          Clear Projects
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800 mx-1 hidden sm:block" />

                <div className="flex items-center gap-0.5 ml-auto sm:ml-0">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                    title="Attach image or file"
                  >
                    <Plus size={20} />
                  </button>
                  <button
                    onClick={() => setShowSettings(true)}
                    className={`flex h-8 items-center rounded-lg text-sm font-medium text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 ${
                      isExpanded ? "gap-1.5 px-2" : "w-8 justify-center"
                    }`}
                    title="Tools"
                  >
                    <Settings size={16} />
                    {isExpanded && <span>Tools</span>}
                  </button>
                  <button
                    onClick={() =>
                      window.electron?.ipcRenderer.invoke("start-dictation")
                    }
                    className={`flex h-8 items-center rounded-lg text-sm font-medium text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 ${
                      isExpanded ? "gap-1.5 px-2" : "w-8 justify-center"
                    }`}
                    title={`Start Dictation ${isMac ? "(Fn twice)" : ""}`}
                  >
                    <Mic size={16} />
                    {isExpanded && <span>Dictate</span>}
                  </button>
                </div>
              </div>

              <div className="flex items-center ml-2">
                <button
                  onClick={addTask}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                >
                  <ArrowUp size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

TaskInput.propTypes = {
  inputValue: PropTypes.string.isRequired,
  setInputValue: PropTypes.func.isRequired,
  inputRef: PropTypes.object.isRequired,
  addTask: PropTypes.func.isRequired,
  handlePaste: PropTypes.func.isRequired,
  handleFileChange: PropTypes.func.isRequired,
  handleCopyImage: PropTypes.func.isRequired,
  isExpanded: PropTypes.bool.isRequired,
  setIsExpanded: PropTypes.func.isRequired,
  pendingAttachment: PropTypes.any,
  setPendingAttachment: PropTypes.func.isRequired,
  draftProjects: PropTypes.array.isRequired,
  setDraftProjects: PropTypes.func.isRequired,
  draftDate: PropTypes.string,
  setDraftDate: PropTypes.func.isRequired,
  showDateMenu: PropTypes.bool.isRequired,
  setShowDateMenu: PropTypes.func.isRequired,
  showProjectMenu: PropTypes.bool.isRequired,
  setShowProjectMenu: PropTypes.func.isRequired,
  setShowSettings: PropTypes.func.isRequired,
};
