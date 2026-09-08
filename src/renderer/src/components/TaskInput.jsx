import {
  useRef,
  useMemo,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import PropTypes from "prop-types";
import SteplerLogo from "./SteplerLogo";
import FileTypeIcon from "./FileTypeIcon";
import {
  pendingAttachment,
  releasePending,
  attachmentSrc,
} from "../lib/attachments";
import { localYMD, ymdToDate } from "../lib/format";
import {
  X,
  Plus,
  Settings,
  Maximize2,
  Minimize2,
  ArrowUp,
  Mic,
  Calendar,
  Hash,
} from "lucide-react";

const isMac =
  window.electron?.process?.platform === "darwin" ||
  /Mac/.test(navigator.userAgent);

function buildWeek(todayYMD) {
  const days = [];
  const now = ymdToDate(todayYMD);
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push({
      ymd: localYMD(d),
      label:
        i === 0
          ? "Today"
          : i === 1
            ? "Tomorrow"
            : d.toLocaleDateString("en-US", { weekday: "short" }),
      weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
      dayNum: d.getDate(),
    });
  }
  return days;
}

/**
 * The composer owns its own draft state: keeping the text in App re-rendered
 * every task row on every keystroke.
 */
const TaskInput = forwardRef(function TaskInput(
  {
    onSubmit,
    isExpanded,
    setIsExpanded,
    availableProjects,
    onOpenSettings,
    onToast,
    jiraStatus,
    jiraProjects,
  },
  ref,
) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [draftProjects, setDraftProjects] = useState([]);
  const [draftDate, setDraftDate] = useState(null);
  const [pending, setPending] = useState(null);
  const [jiraProjectKey, setJiraProjectKey] = useState("");
  const [newProjectDraft, setNewProjectDraft] = useState("");

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  // Recompute the day strip if the app is left open across midnight.
  const [weekSeed, setWeekSeed] = useState(() => localYMD(new Date()));
  useEffect(() => {
    const id = setInterval(() => {
      const today = localYMD(new Date());
      setWeekSeed((prev) => (prev === today ? prev : today));
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  const weekDays = useMemo(() => buildWeek(weekSeed), [weekSeed]);

  useEffect(() => () => releasePending(pending), [pending]);

  const showControls =
    isFocused || value || draftProjects.length > 0 || draftDate || pending;

  const attach = (file) => {
    if (!file) return;
    if (file.size > 64 * 1024 * 1024) {
      onToast?.("That file is larger than 64 MB", "error");
      return;
    }
    setPending((prev) => {
      releasePending(prev);
      return pendingAttachment(file);
    });
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      if (file && file.size > 0) {
        e.preventDefault();
        attach(file);
        return;
      }
    }
  };

  const submit = () => {
    const text = value.trim();
    if (!text && !pending) return;
    onSubmit({
      text,
      projects: draftProjects,
      dueDate: draftDate,
      attachment: pending,
      jiraProjectKey,
    });
    setValue("");
    setPending(null); // ownership passes to App, which persists it
    setDraftProjects([]);
    setDraftDate(null);
    setJiraProjectKey("");
    setNewProjectDraft("");
    setIsExpanded(false);
  };

  const handleKeyDown = (e) => {
    if (e.key !== "Enter") return;
    if (e.shiftKey) return;
    // Never submit half a word while an IME candidate window is open.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    submit();
  };

  return (
    <div
      className={`z-40 flex shrink-0 justify-center transition-all duration-300 ${
        isExpanded
          ? "fixed inset-0 z-[100] bg-white p-6 dark:bg-neutral-950 md:p-12"
          : "p-4 md:p-6"
      }`}
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setIsFocused(false);
      }}
    >
      <div
        className={`flex w-full max-w-3xl flex-col ${isExpanded ? "mx-auto h-full max-w-4xl justify-center" : ""}`}
      >
        <div className="mb-4 flex items-center gap-2 text-xl font-medium text-neutral-800 dark:text-neutral-200">
          <SteplerLogo size={26} />
          <span>What&apos;s on your mind?</span>
        </div>

        <div className="relative flex flex-col">
          {pending && (
            <div
              className={`absolute bottom-full left-0 mb-3 flex items-center shadow-lg ${
                pending.type === "image"
                  ? "rounded-lg"
                  : "rounded-lg border border-neutral-300 bg-neutral-100 p-1.5 pr-2 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
              }`}
            >
              {pending.type === "image" ? (
                <div className="group/pending relative inline-block">
                  <img
                    src={attachmentSrc(pending)}
                    alt={pending.name}
                    className="h-16 w-16 shrink-0 rounded-lg border border-neutral-200 object-cover dark:border-neutral-800"
                  />
                  <button
                    onClick={() => {
                      releasePending(pending);
                      setPending(null);
                    }}
                    className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 backdrop-blur-md transition-opacity hover:bg-red-500/90 group-hover/pending:opacity-100"
                    title="Remove attachment"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <>
                  <FileTypeIcon fileName={pending.name} size={28} />
                  <span className="ml-1 mr-3 max-w-[200px] truncate">
                    {pending.name}
                  </span>
                  <button
                    onClick={() => {
                      releasePending(pending);
                      setPending(null);
                    }}
                    className="btn-tactile shrink-0 rounded-md p-1 text-neutral-400 transition-colors hover:text-neutral-900 dark:hover:text-neutral-200"
                    title="Remove attachment"
                  >
                    <X size={14} className="icon-rubbery" />
                  </button>
                </>
              )}
            </div>
          )}

          <div
            className={`relative flex flex-col rounded-[24px] border bg-white shadow-[0_4px_24px_rgba(0,0,0,0.05)] transition-all duration-300 dark:bg-[#1a1a1a] ${
              draftProjects.length > 0 || draftDate
                ? "border-[#9B6AFF]/50"
                : "border-neutral-200 dark:border-neutral-800/80"
            } ${isExpanded ? "h-[60vh] md:h-[70vh]" : showControls ? "min-h-[140px]" : "min-h-[56px]"} ${
              !isExpanded && showControls ? "pb-2" : ""
            }`}
          >
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`btn-tactile absolute right-4 z-10 rounded-md text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-200 ${
                isExpanded ? "top-4" : "top-3.5"
              }`}
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <Minimize2 size={18} className="icon-rubbery" />
              ) : (
                <Maximize2 size={18} className="icon-rubbery" />
              )}
            </button>

            {(draftProjects.length > 0 || draftDate) && (
              <div className="flex flex-wrap items-center gap-2 px-5 pb-0 pt-4">
                {draftProjects.map((p) => (
                  <div
                    key={p}
                    className="flex items-center gap-1.5 rounded-full border border-[#9B6AFF]/20 bg-[#9B6AFF]/10 px-3 py-1.5 text-xs font-medium text-[#9B6AFF]"
                  >
                    <Hash size={14} />
                    {p}
                    <button
                      onClick={() =>
                        setDraftProjects((prev) => prev.filter((x) => x !== p))
                      }
                      className="ml-1 text-[#9B6AFF]/50 hover:text-[#9B6AFF]"
                      title="Remove project"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {draftDate && (
                  <div className="flex items-center gap-1.5 rounded-full border border-[#FF9A00]/20 bg-[#FF9A00]/10 px-3 py-1.5 text-xs font-medium text-[#FF9A00]">
                    <Calendar size={14} />
                    {weekDays.find((d) => d.ymd === draftDate)?.label ||
                      draftDate}
                    <button
                      onClick={() => setDraftDate(null)}
                      className="ml-1 text-[#FF9A00]/50 hover:text-[#FF9A00]"
                      title="Remove date"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={() => setIsFocused(true)}
              rows={isExpanded ? undefined : 1}
              placeholder="What's on your mind?"
              className={`flex-1 resize-none bg-transparent px-5 pr-12 text-[16px] leading-relaxed text-neutral-800 placeholder-neutral-400 focus:outline-none dark:text-neutral-200 dark:placeholder-neutral-500 ${
                isExpanded ? "mt-4 h-full py-6" : "autosize max-h-40 pb-2 pt-4"
              }`}
              style={isExpanded ? { height: "100%" } : {}}
            />

            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                attach(e.target.files?.[0]);
                e.target.value = "";
              }}
              className="hidden"
            />

            {showControls && (
              <div
                className={`flex flex-col gap-1.5 ${
                  isExpanded
                    ? "mt-auto w-full border-t border-neutral-100 p-5 dark:border-neutral-800/50"
                    : "mt-1 px-5 pb-4"
                }`}
              >
                {/* Projects */}
                <div
                  className="custom-scrollbar-hide flex items-center gap-2 overflow-x-auto pb-0.5"
                  onWheel={(e) => {
                    if (e.deltaY !== 0) e.currentTarget.scrollLeft += e.deltaY;
                  }}
                >
                  <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#9B6AFF]/10 bg-neutral-50 px-2.5 py-1 text-[10px] font-bold tracking-widest text-[#9B6AFF] dark:bg-[#9B6AFF]/5">
                    <Hash size={12} />
                    PROJECTS
                  </div>
                  {availableProjects.map((project) => {
                    const name =
                      typeof project === "string" ? project : project.name;
                    const isSelected = draftProjects.includes(name);
                    return (
                      <button
                        key={name}
                        onClick={() =>
                          setDraftProjects((prev) =>
                            isSelected
                              ? prev.filter((p) => p !== name)
                              : [...prev, name],
                          )
                        }
                        className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all active:scale-95 ${
                          isSelected
                            ? "border-[#9B6AFF]/30 bg-[#9B6AFF]/10 text-[#9B6AFF] shadow-sm"
                            : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:border-neutral-800 dark:bg-[#1a1a1a] dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:text-neutral-200"
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                  <div className="ml-1 flex shrink-0 items-center border-l border-neutral-200 pl-2 dark:border-neutral-800">
                    <input
                      type="text"
                      placeholder="New..."
                      value={newProjectDraft}
                      onChange={(e) => setNewProjectDraft(e.target.value)}
                      className="w-20 bg-transparent text-xs font-medium text-neutral-600 outline-none placeholder:text-neutral-400 dark:text-neutral-300 dark:placeholder:text-neutral-500"
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        e.stopPropagation();
                        const val = newProjectDraft.trim();
                        if (val && !draftProjects.includes(val))
                          setDraftProjects((prev) => [...prev, val]);
                        setNewProjectDraft("");
                      }}
                    />
                  </div>
                </div>

                {/* Dates and actions */}
                <div className="flex items-center gap-3">
                  <div className="custom-scrollbar-hide flex flex-1 items-center gap-1.5 overflow-x-auto">
                    {weekDays.map((day) => {
                      const isSelected = draftDate === day.ymd;
                      return (
                        <button
                          key={day.ymd}
                          onClick={() =>
                            setDraftDate(isSelected ? null : day.ymd)
                          }
                          title={day.label}
                          className={`flex shrink-0 items-baseline gap-1 rounded-full border px-2.5 py-1 transition-all active:scale-95 ${
                            isSelected
                              ? "border-[#FF9A00]/40 bg-[#FF9A00]/10 text-[#FF9A00] shadow-sm"
                              : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:border-neutral-800 dark:bg-[#1a1a1a] dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:text-neutral-200"
                          }`}
                        >
                          <span className="text-[10px] font-bold uppercase tracking-tighter opacity-70">
                            {day.weekday}
                          </span>
                          <span className="text-xs font-bold">
                            {day.dayNum}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {jiraStatus?.connected && jiraProjects.length > 0 && (
                    <div className="flex items-center gap-1 border-l border-neutral-100 pl-2 dark:border-neutral-800/50">
                      <select
                        value={jiraProjectKey}
                        onChange={(e) => setJiraProjectKey(e.target.value)}
                        className="cursor-pointer bg-transparent text-xs font-medium text-neutral-600 outline-none dark:text-neutral-400"
                      >
                        <option value="">Jira Project</option>
                        {jiraProjects.map((p) => (
                          <option key={p.id} value={p.key}>
                            {p.key}
                          </option>
                        ))}
                      </select>
                      {jiraProjectKey && (
                        <button
                          onClick={() => setJiraProjectKey("")}
                          className="text-neutral-400 transition-colors hover:text-red-500"
                          title="Clear Jira project"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-1 border-l border-neutral-100 pl-2 dark:border-neutral-800/50">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-tactile flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                      title="Attach image or file"
                    >
                      <Plus size={20} className="icon-rubbery" />
                    </button>
                    <button
                      onClick={onOpenSettings}
                      className={`btn-tactile flex h-8 items-center rounded-lg text-sm font-medium text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 ${
                        isExpanded ? "gap-1.5 px-2" : "w-8 justify-center"
                      }`}
                      title="Settings"
                    >
                      <Settings size={16} className="icon-rubbery" />
                      {isExpanded && <span>Settings</span>}
                    </button>
                    {isMac && (
                      <button
                        onClick={() =>
                          window.electron?.ipcRenderer.invoke("start-dictation")
                        }
                        className={`btn-tactile flex h-8 items-center rounded-lg text-sm font-medium text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 ${
                          isExpanded ? "gap-1.5 px-2" : "w-8 justify-center"
                        }`}
                        title="Start dictation (Fn twice)"
                      >
                        <Mic size={16} className="icon-rubbery" />
                        {isExpanded && <span>Dictate</span>}
                      </button>
                    )}
                    <button
                      onClick={submit}
                      disabled={!value.trim() && !pending}
                      className="btn-tactile ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white transition-colors hover:bg-neutral-800 disabled:opacity-30 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                      title="Add task"
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

TaskInput.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  isExpanded: PropTypes.bool.isRequired,
  setIsExpanded: PropTypes.func.isRequired,
  availableProjects: PropTypes.array.isRequired,
  onOpenSettings: PropTypes.func.isRequired,
  onToast: PropTypes.func,
  jiraStatus: PropTypes.object,
  jiraProjects: PropTypes.array,
};

export default TaskInput;
