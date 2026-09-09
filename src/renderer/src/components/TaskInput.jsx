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
import { ipc } from "../lib/attachments";
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
import { formatDate, translate, useLanguage, useT } from "../lib/i18n";
import { applyMention, mentionQueryAt } from "../lib/collab";

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
          ? translate("app.today")
          : i === 1
            ? translate("app.tomorrow")
            : formatDate(d, { weekday: "short" }),
      weekday: formatDate(d, { weekday: "short" }),
      dayNum: d.getDate(),
    });
  }
  return days;
}

/**
 * The composer owns its own draft state: keeping the text in App re-rendered
 * every task row on every keystroke.
 */
/**
 * The handle menu offers only accepted connections. An invitation nobody has
 * answered is not somebody you can address a task to, and offering the name
 * would produce a delivery the rules reject in silence.
 */
const MAX_SUGGESTIONS = 6;

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
    connections = [],
  },
  ref,
) {
  const t = useT();
  const language = useLanguage();
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const [draftProjects, setDraftProjects] = useState([]);
  const [draftDate, setDraftDate] = useState(null);
  const [pending, setPending] = useState(null);
  const [jiraProjectKey, setJiraProjectKey] = useState("");
  const [jiraSprints, setJiraSprints] = useState([]);
  const [jiraSprintId, setJiraSprintId] = useState("");
  const [newProjectDraft, setNewProjectDraft] = useState("");
  // The handle being typed right now, and the people it could mean.
  const [suggest, setSuggest] = useState(null);

  // Sprints hang off boards, so a project needs two hops to reach them.
  // Clearing the old pick happens where the project changes, not here, so the
  // effect only ever writes state from its own async result.
  useEffect(() => {
    if (!jiraProjectKey || !ipc) return undefined;
    let cancelled = false;
    ipc
      .invoke("jira-get-boards", { projectKey: jiraProjectKey })
      .then((res) => {
        const board = res?.boards?.[0];
        if (cancelled || !board) return null;
        return ipc.invoke("jira-get-sprints", { boardId: board.id });
      })
      .then((res) => {
        if (!cancelled) setJiraSprints(res?.success ? res.sprints || [] : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [jiraProjectKey]);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    /** Text arriving from outside — the selection the hotkey brought along. */
    insertText: (text) => {
      setValue((prev) => (prev ? `${prev}\n${text}` : text));
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      });
    },
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
  const weekDays = useMemo(
    () => buildWeek(weekSeed),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weekSeed, language],
  );

  useEffect(() => () => releasePending(pending), [pending]);

  const showControls =
    isFocused || value || draftProjects.length > 0 || draftDate || pending;

  const attach = (file) => {
    if (!file) return;
    if (file.size > 64 * 1024 * 1024) {
      onToast?.(t("toast.fileTooLarge"), "error");
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
      jiraSprintId,
    });
    setValue("");
    setSuggest(null);
    setPending(null); // ownership passes to App, which persists it
    setDraftProjects([]);
    setDraftDate(null);
    setJiraProjectKey("");
    setJiraSprintId("");
    setNewProjectDraft("");
    setIsExpanded(false);
  };

  /** Recompute the handle menu from wherever the caret is now. */
  const refreshSuggest = (text, caret) => {
    const range = mentionQueryAt(text, caret ?? text.length);
    if (!range) {
      setSuggest(null);
      return;
    }
    const list = connections
      .filter((c) => c.username?.startsWith(range.query))
      .slice(0, MAX_SUGGESTIONS);
    setSuggest(list.length ? { range, list, index: 0 } : null);
  };

  const chooseMention = (person) => {
    if (!suggest || !person) return;
    const next = applyMention(value, suggest.range, person.username);
    setValue(next.text);
    setSuggest(null);
    // React resets the caret to the end of the value on re-render, so it is
    // put back where the completed name finishes on the next frame.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  };

  const handleKeyDown = (e) => {
    // While the handle menu is open it owns the arrows, Enter and Tab: Enter
    // has to finish the name being typed, not send a task addressed to half
    // of one.
    if (suggest && suggest.list.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setSuggest((cur) =>
          cur
            ? {
                ...cur,
                index: (cur.index + step + cur.list.length) % cur.list.length,
              }
            : cur,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        chooseMention(suggest.list[suggest.index]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSuggest(null);
        return;
      }
    }
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
          <span>{t("input.prompt")}</span>
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
                    title={t("common.removeAttachment")}
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
                    title={t("common.removeAttachment")}
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
            {isFocused && <span aria-hidden="true" className="shine-ring" />}

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`btn-tactile absolute right-4 z-10 rounded-md text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-200 ${
                isExpanded ? "top-4" : "top-3.5"
              }`}
              title={isExpanded ? t("input.collapse") : t("input.expand")}
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
                      title={t("task.removeProject")}
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
                      title={t("input.removeDate")}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* The people this half-typed @ could mean. Above the field,
                because the composer already sits at the bottom of the
                window. */}
            {suggest && suggest.list.length > 0 && (
              <div
                role="listbox"
                className="absolute bottom-full left-4 z-50 mb-2 w-[300px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
              >
                {suggest.list.map((person, i) => (
                  <button
                    key={person.uid}
                    type="button"
                    role="option"
                    aria-selected={i === suggest.index}
                    // pointerdown, not click: the textarea blurs first
                    // otherwise and the menu is gone before a click lands.
                    onPointerDown={(e) => {
                      e.preventDefault();
                      chooseMention(person);
                    }}
                    className={`flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] transition-colors ${
                      i === suggest.index
                        ? "bg-neutral-100 dark:bg-neutral-800"
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-200 text-[10px] font-bold uppercase text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                      {person.photoURL ? (
                        <img
                          src={person.photoURL}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        (person.username || person.email || "?")[0]
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-neutral-800 dark:text-neutral-100">
                      @{person.username}
                    </span>
                    <span className="min-w-0 max-w-[110px] truncate text-[11px] text-neutral-400">
                      {person.email}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                refreshSuggest(e.target.value, e.target.selectionStart);
              }}
              onClick={(e) =>
                refreshSuggest(e.target.value, e.target.selectionStart)
              }
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setSuggest(null)}
              rows={isExpanded ? undefined : 1}
              placeholder={t("input.prompt")}
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
                    {t("input.projects")}
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
                      placeholder={t("input.newShort")}
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
                        onChange={(e) => {
                          setJiraProjectKey(e.target.value);
                          setJiraSprintId("");
                          setJiraSprints([]);
                        }}
                        className="cursor-pointer bg-transparent text-xs font-medium text-neutral-600 outline-none dark:text-neutral-400"
                      >
                        <option value="">{t("input.jiraProject")}</option>
                        {jiraProjects.map((p) => (
                          <option key={p.id} value={p.key}>
                            {p.key}
                          </option>
                        ))}
                      </select>
                      {jiraProjectKey && jiraSprints.length > 0 && (
                        <select
                          value={jiraSprintId}
                          onChange={(e) => setJiraSprintId(e.target.value)}
                          className="cursor-pointer bg-transparent text-xs font-medium text-neutral-600 outline-none dark:text-neutral-400"
                        >
                          <option value="">{t("input.backlog")}</option>
                          {jiraSprints.map((sp) => (
                            <option key={sp.id} value={sp.id}>
                              {sp.name}
                              {sp.state === "active" ? " · active" : ""}
                            </option>
                          ))}
                        </select>
                      )}
                      {jiraProjectKey && (
                        <button
                          onClick={() => setJiraProjectKey("")}
                          className="text-neutral-400 transition-colors hover:text-red-500"
                          title={t("input.clearJiraProject")}
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
                      title={t("input.attach")}
                    >
                      <Plus size={20} className="icon-rubbery" />
                    </button>
                    <button
                      onClick={onOpenSettings}
                      className={`btn-tactile flex h-8 items-center rounded-lg text-sm font-medium text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 ${
                        isExpanded ? "gap-1.5 px-2" : "w-8 justify-center"
                      }`}
                      title={t("common.settings")}
                    >
                      <Settings size={16} className="icon-rubbery" />
                      {isExpanded && <span>{t("common.settings")}</span>}
                    </button>
                    {isMac && (
                      <button
                        onClick={() =>
                          window.electron?.ipcRenderer.invoke("start-dictation")
                        }
                        className={`btn-tactile flex h-8 items-center rounded-lg text-sm font-medium text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 ${
                          isExpanded ? "gap-1.5 px-2" : "w-8 justify-center"
                        }`}
                        title={t("input.dictateHint")}
                      >
                        <Mic size={16} className="icon-rubbery" />
                        {isExpanded && <span>{t("input.dictate")}</span>}
                      </button>
                    )}
                    <button
                      onClick={submit}
                      disabled={!value.trim() && !pending}
                      className="btn-tactile ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white transition-colors hover:bg-neutral-800 disabled:opacity-30 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                      title={t("input.addTask")}
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
  connections: PropTypes.arrayOf(
    PropTypes.shape({
      uid: PropTypes.string,
      username: PropTypes.string,
      email: PropTypes.string,
      photoURL: PropTypes.string,
    }),
  ),
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
