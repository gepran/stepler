import { useRef, useMemo } from "react";
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
  Calendar,
  Hash,
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
  setShowSettings,
  availableProjects,
}) {
  const fileInputRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const dateScrollContainerRef = useRef(null);

  const weekDays = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      const dayNum = d.getDate();
      const monthName = d.toLocaleDateString("en-US", { month: "short" });
      
      let label = `${dayName} ${dayNum}`;
      if (i === 0) label = "Today";
      else if (i === 1) label = "Tomorrow";
      
      days.push({
        full: label,
        displayDay: dayName,
        displayNum: dayNum,
        displayMonth: monthName,
        isToday: i === 0,
        isTomorrow: i === 1
      });
    }
    return days;
  }, []);

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
                      onClick={(e) => handleCopyImage(e, pendingAttachment.url)}
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
                    className="btn-tactile shrink-0 rounded-md p-1 text-neutral-400 transition-colors hover:text-neutral-900 dark:hover:text-neutral-200"
                  >
                    <X size={14} className="icon-rubbery" />
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
              className={`btn-tactile absolute right-4 z-10 rounded-md text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-200 ${
                isExpanded ? "top-4" : "top-3.5"
              }`}
            >
              {isExpanded ? (
                <Minimize2 size={18} className="icon-rubbery" />
              ) : (
                <Maximize2 size={18} className="icon-rubbery" />
              )}
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
                        <Calendar size={14} />
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
            {/* Bottom Controls Area */}
            <div
              className={`flex flex-col gap-3 ${
                isExpanded
                  ? "mt-auto p-5 w-full border-t border-neutral-100 dark:border-neutral-800/50"
                  : "px-5 pb-4 mt-2"
              }`}
            >
              {/* Row 1: Projects */}
              <div
                ref={scrollContainerRef}
                className="custom-scrollbar-hide flex items-center gap-2 overflow-x-auto pb-0.5"
                onWheel={(e) => {
                  if (e.deltaY !== 0) {
                    e.currentTarget.scrollLeft += e.deltaY;
                  }
                }}
              >
                <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-50 px-2 py-1 text-[10px] font-bold tracking-widest text-neutral-400 dark:bg-neutral-800/30 dark:text-neutral-500">
                  <Hash size={12} />
                  PROJECTS
                </div>
                {availableProjects.map((project) => {
                  const isSelected = draftProjects.includes(project);
                  return (
                    <button
                      key={project}
                      onClick={() => {
                        if (isSelected) {
                          setDraftProjects((prev) =>
                            prev.filter((p) => p !== project),
                          );
                        } else {
                          setDraftProjects((prev) => [...prev, project]);
                        }
                      }}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                        isSelected
                          ? "border-green-500/30 bg-green-50 text-green-600 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-500"
                          : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:border-neutral-800 dark:bg-[#1a1a1a] dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:text-neutral-200"
                      }`}
                    >
                      {project}
                    </button>
                  );
                })}
                <div className="flex shrink-0 items-center border-l border-neutral-200 pl-2 dark:border-neutral-800 ml-1">
                  <input
                    type="text"
                    placeholder="New..."
                    className="w-20 bg-transparent text-xs font-medium text-neutral-600 outline-none placeholder:text-neutral-400 dark:text-neutral-300 dark:placeholder:text-neutral-500"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = e.target.value.trim();
                        if (val && !draftProjects.includes(val)) {
                          setDraftProjects((prev) => [...prev, val]);
                          e.target.value = "";
                        }
                      }
                    }}
                  />
                </div>
              </div>

              {/* Row 2: Dates and Actions */}
              <div className="flex items-center gap-3">
                <div
                  ref={dateScrollContainerRef}
                  className="custom-scrollbar-hide flex flex-1 items-center gap-2 overflow-x-auto pb-0.5"
                  onWheel={(e) => {
                    if (e.deltaY !== 0) {
                      e.currentTarget.scrollLeft += e.deltaY;
                    }
                  }}
                >
                  <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-50 px-2 py-1 text-[10px] font-bold tracking-widest text-neutral-400 dark:bg-neutral-800/30 dark:text-neutral-500">
                    <Calendar size={12} />
                    DATES
                  </div>
                  {weekDays.map((day) => {
                    const isSelected = draftDate === day.full || (!draftDate && day.isToday);
                    return (
                      <button
                        key={day.full}
                        onClick={() => {
                          setDraftDate(day.full);
                        }}
                        className={`flex shrink-0 flex-col items-center justify-center rounded-xl border px-3 py-1.5 transition-all ${
                          isSelected
                            ? "border-indigo-500/30 bg-indigo-50 text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400 shadow-sm"
                            : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:border-neutral-800 dark:bg-[#1a1a1a] dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:text-neutral-200"
                        }`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-tighter opacity-70">
                          {day.displayDay}
                        </span>
                        <span className="text-sm font-bold">{day.displayNum}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1 border-l border-neutral-100 dark:border-neutral-800/50 pl-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-tactile flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                    title="Attach image or file"
                  >
                    <Plus size={20} className="icon-rubbery" />
                  </button>
                  <button
                    onClick={() => setShowSettings(true)}
                    className={`btn-tactile flex h-8 items-center rounded-lg text-sm font-medium text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 ${
                      isExpanded ? "gap-1.5 px-2" : "w-8 justify-center"
                    }`}
                    title="Tools"
                  >
                    <Settings size={16} className="icon-rubbery" />
                    {isExpanded && <span>Tools</span>}
                  </button>
                  <button
                    onClick={() =>
                      window.electron?.ipcRenderer.invoke("start-dictation")
                    }
                    className={`btn-tactile flex h-8 items-center rounded-lg text-sm font-medium text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 ${
                      isExpanded ? "gap-1.5 px-2" : "w-8 justify-center"
                    }`}
                    title={`Start Dictation ${isMac ? "(Fn twice)" : ""}`}
                  >
                    <Mic size={16} className="icon-rubbery" />
                    {isExpanded && <span>Dictate</span>}
                  </button>
                  <button
                    onClick={addTask}
                    className="btn-tactile ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                  >
                    <ArrowUp
                      size={20}
                      className="icon-rubbery"
                      strokeWidth={2.5}
                    />
                  </button>
                </div>
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
  setShowSettings: PropTypes.func.isRequired,
  availableProjects: PropTypes.array.isRequired,
};
