import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import SteplerLogo from "./components/SteplerLogo";
import Sidebar from "./components/Sidebar";
import ParticleCanvas from "./components/ParticleCanvas";
import {
  Circle,
  CheckCircle2,
  Plus,
  GripVertical,
  X,
  FileText,
  Bell,
  Settings,
  Monitor,
  Moon,
  SunMedium,
  Star,
  Maximize2,
  Minimize2,
  ArrowUp,
  Mic,
  PanelLeft,
  AlertCircle,
  CornerDownRight,
  Search,
  Briefcase,
  User,
  Zap,
  Calendar,
  Hash,
  CalendarDays,
} from "lucide-react";

const ipc = window.electron?.ipcRenderer;
const isMac = window.electron?.process?.platform === "darwin" || /Mac/.test(navigator.userAgent);

async function loadAppData() {
  if (ipc) {
    try {
      return await ipc.invoke("load-app-data");
    } catch {
      /* fall through */
    }
  }
  return { tasks: [], history: [], currentDate: null, firedReminders: [] };
}

function saveAppData(partial) {
  if (ipc) ipc.invoke("save-app-data", partial);
}

function formatAcceleratorForDisplay(acc) {
  if (!acc) return "";
  return acc
    .replace(/CommandOrControl/g, isMac ? "⌘" : "Ctrl")
    .replace(/CmdOrCtrl/g, isMac ? "⌘" : "Ctrl")
    .replace(/Command/g, isMac ? "⌘" : "Win")
    .replace(/Control/g, isMac ? "⌃" : "Ctrl")
    .replace(/Shift/g, isMac ? "⇧" : "Shift")
    .replace(/Alt/g, isMac ? "⌥" : "Alt")
    .replace(/\+/g, isMac ? "" : " + ")
    .replace(/Space/, isMac ? "␣" : "Space");
}

function keyEventToAccelerator(e) {
  const parts = [];
  if (e.ctrlKey && !e.metaKey) parts.push("Control");
  if (e.metaKey) parts.push("CommandOrControl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  const ignore = ["Meta", "Control", "Alt", "Shift", "Dead"];
  if (!ignore.includes(e.key)) {
    let key = e.key;
    if (key === " ") key = "Space";
    else if (key.length === 1) key = key.toUpperCase();
    else if (key === "ArrowUp") key = "Up";
    else if (key === "ArrowDown") key = "Down";
    else if (key === "ArrowLeft") key = "Left";
    else if (key === "ArrowRight") key = "Right";
    parts.push(key);
  }

  if (parts.length < 2) return null;
  return parts.join("+");
}

// ----------- Settings Panel -----------

function SettingsPanel({ onClose }) {
  const [settings, setSettings] = useState({ hotkey: "", theme: "dark" });
  const [recording, setRecording] = useState(false);
  const [tempKey, setTempKey] = useState(null);
  const recorderRef = useRef(null);

  useEffect(() => {
    window.electron?.ipcRenderer.invoke("get-settings").then(setSettings);
  }, []);

  const updateSetting = useCallback(async (partial) => {
    const updated = await window.electron?.ipcRenderer.invoke(
      "update-settings",
      partial,
    );
    if (updated) setSettings(updated);
  }, []);

  const handleKeyCapture = useCallback(
    (e) => {
      if (!recording) return;
      e.preventDefault();
      e.stopPropagation();
      const acc = keyEventToAccelerator(e);
      if (acc) {
        setTempKey(acc);
        setRecording(false);
        updateSetting({ hotkey: acc });
      }
    },
    [recording, updateSetting],
  );

  useEffect(() => {
    if (recording && recorderRef.current) {
      recorderRef.current.focus();
    }
  }, [recording]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-800 dark:text-neutral-100">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          >
            <X size={18} />
          </button>
        </div>

        {/* --- Appearance --- */}
        <div className="mb-6">
          <label className="mb-2.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            Appearance
          </label>
          <div className="flex gap-2">
            {[
              { value: "light", label: "Light", Icon: SunMedium },
              { value: "dark", label: "Dark", Icon: Moon },
              { value: "system", label: "System", Icon: Monitor },
            ].map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => updateSetting({ theme: value })}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                  settings.theme === value
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                    : "border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-neutral-300"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* --- Shortcut --- */}
        <div className="mb-2">
          <label className="mb-2.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            Global Shortcut
          </label>
          {recording ? (
            <div
              ref={recorderRef}
              tabIndex={0}
              onKeyDown={handleKeyCapture}
              onBlur={() => setRecording(false)}
              className="flex items-center justify-center rounded-xl border-2 border-dashed border-neutral-400 bg-neutral-500/5 px-4 py-3 text-sm text-neutral-500 outline-none dark:border-neutral-500 dark:bg-neutral-500/10"
            >
              <span className="animate-pulse">Press new shortcut…</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex flex-1 items-center rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-neutral-700 dark:bg-neutral-800">
                <span className="font-mono text-sm tracking-widest text-neutral-700 dark:text-neutral-200">
                  {formatAcceleratorForDisplay(tempKey || settings.hotkey)}
                </span>
              </div>
              <button
                onClick={() => {
                  setRecording(true);
                  setTempKey(null);
                }}
                className="shrink-0 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              >
                Change
              </button>
            </div>
          )}
          <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
            Toggle Stepler from anywhere on your {isMac ? "Mac" : "PC"}.
          </p>
        </div>
      </div>
    </div>
  );
}

SettingsPanel.propTypes = {
  onClose: PropTypes.func.isRequired,
};

// ----------- Main App -----------

const formatTaskText = (text) => {
  if (!text) return text;

  let processedText = text;

  // Auto-detect raw code to put in "quote" (code block) to be more beautiful
  if (!processedText.includes("```")) {
    let detectedLang = null;
    if (
      /<(html|div|span|script|style|body|head|p|a|button)[^>]*>([\s\S]*)<\/\1>/is.test(
        processedText,
      )
    ) {
      detectedLang = "html";
    } else if (
      /\b(public\s+class|public\s+static\s+void|System\.out\.println|import\s+java\.)\b/.test(
        processedText,
      )
    ) {
      detectedLang = "java";
    } else if (
      /\b(function|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|\(\)\s*=>|import\s+.*from)\b/.test(
        processedText,
      )
    ) {
      detectedLang = "javascript";
    } else if (/(?:^|\s)def\s+\w+\s*\([^)]*\)\s*:/m.test(processedText)) {
      detectedLang = "python";
    } else if (
      /\b(SELECT\s+.*\s+FROM|INSERT\s+INTO|UPDATE\s+.*\s+SET|DELETE\s+FROM)\b/i.test(
        processedText,
      )
    ) {
      detectedLang = "sql";
    } else if (/\.[\w-]+\s*\{[^}]+\}/.test(processedText)) {
      detectedLang = "css";
    }

    if (detectedLang) {
      processedText = `\`\`\`${detectedLang}\n${processedText}\n\`\`\``;
    }
  }

  // Parse block code ```lang\ncode\n``` or ```code```
  const blockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = blockRegex.exec(processedText)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: processedText.slice(lastIndex, match.index),
      });
    }
    parts.push({
      type: "codeblock",
      lang: match[1] || "",
      content: match[2],
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < processedText.length) {
    parts.push({ type: "text", content: processedText.slice(lastIndex) });
  }

  return parts.map((part, pIndex) => {
    if (part.type === "codeblock") {
      return (
        <div
          key={`block-${pIndex}`}
          className="my-3 overflow-hidden rounded-lg border border-neutral-200 bg-[#1e1e1e] shadow-sm transition-all hover:shadow-md dark:border-neutral-800"
          onClick={(e) => e.stopPropagation()}
        >
          {part.lang && (
            <div className="flex select-none items-center justify-between border-b border-neutral-200/50 bg-neutral-100/80 px-3 py-1.5 dark:border-neutral-800 dark:bg-neutral-900/80">
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                {part.lang}
              </span>
              <div className="flex gap-1.5 opacity-20">
                <div className="h-2 w-2 rounded-full bg-neutral-400" />
                <div className="h-2 w-2 rounded-full bg-neutral-400" />
                <div className="h-2 w-2 rounded-full bg-neutral-400" />
              </div>
            </div>
          )}
          <SyntaxHighlighter
            language={part.lang || "javascript"}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: "1.25rem",
              fontSize: "13px",
              lineHeight: "1.6",
              borderRadius: "0",
              backgroundColor: "transparent",
            }}
          >
            {part.content.trim()}
          </SyntaxHighlighter>
        </div>
      );
    }

    // Process normal text for inline code and URLs
    const inlineParts = part.content.split(/`([^`]+)`/g);

    return inlineParts.map((inlinePart, index) => {
      // Every odd index is inside backticks
      if (index % 2 === 1) {
        return (
          <code
            key={`${pIndex}-${index}`}
            className="rounded bg-neutral-200/80 px-1.5 py-0.5 font-mono text-[13px] font-medium text-neutral-800 dark:bg-neutral-800/80 dark:text-neutral-200"
          >
            {inlinePart}
          </code>
        );
      }

      // Normal text, parse URLs
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urlParts = inlinePart.split(urlRegex);

      return urlParts.map((urlPart, urlIndex) => {
        if (urlPart.match(urlRegex)) {
          return (
            <a
              key={`${pIndex}-${index}-${urlIndex}`}
              href={urlPart}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 underline decoration-neutral-300 underline-offset-4 hover:text-neutral-900 hover:decoration-neutral-900 dark:text-neutral-400 dark:decoration-neutral-700 dark:hover:text-neutral-200 dark:hover:decoration-neutral-200"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              {urlPart}
            </a>
          );
        }

        // Highlight recognized tech keywords as inline "quotes"
        const keywordRegex =
          /\b(html|java|css|javascript|typescript|python|react|node\.js|vue|angular|sql|php|json|c\+\+|c#|ruby|swift|kotlin|dart|golang|rust|markdown|yaml|docker|bash|git|api)\b/gi;
        const textSegments = urlPart.split(keywordRegex);

        if (textSegments.length <= 1) {
          return <span key={`${pIndex}-${index}-${urlIndex}`}>{urlPart}</span>;
        }

        return textSegments.map((segment, sIndex) => {
          if (segment.match(keywordRegex)) {
            return (
              <code
                key={`${pIndex}-${index}-${urlIndex}-${sIndex}`}
                className="mx-[2px] rounded bg-neutral-200/50 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
              >
                {segment}
              </code>
            );
          }
          return (
            <span key={`${pIndex}-${index}-${urlIndex}-${sIndex}`}>
              {segment}
            </span>
          );
        });
      });
    });
  });
};

const formatTaskDateTime = (id) => {
  if (!id) return null;
  const num = parseInt(id, 10);
  if (isNaN(num) || num < 10000000000) return null;

  const date = new Date(num);
  if (isNaN(date.getTime())) return null;

  return {
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
};

// ----------- Full Screen Search Overlay -----------

function FullScreenSearch({ show, onClose, tasks, history }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (show) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setTimeout(() => setQuery(""), 300); // delay clear for exit anim
    }
  }, [show]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const lowerQ = query.toLowerCase();
    const allTasks = [
      ...tasks.map((t) => ({ ...t, dateLabel: "Today" })),
      ...history.flatMap((day) => day.tasks.map((t) => ({ ...t, dateLabel: day.date }))),
    ];

    return allTasks
      .filter(
        (t) =>
          t.text?.toLowerCase().includes(lowerQ) ||
          t.project?.toLowerCase().includes(lowerQ) ||
          t.subtasks?.some((st) => st.text?.toLowerCase().includes(lowerQ))
      )
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const idA = parseInt(a.id || 0, 10);
        const idB = parseInt(b.id || 0, 10);
        return idB - idA;
      });
  }, [tasks, history, query]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center bg-white/80 dark:bg-black/80 backdrop-blur-xl transition-all duration-300 p-8"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl mt-16"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative mb-8">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 w-8 h-8" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search tasks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
            className="w-full bg-transparent text-4xl font-medium text-neutral-900 dark:text-white rounded-2xl pl-20 pr-6 py-6 border-none focus:outline-none focus:ring-0 placeholder:text-neutral-300 dark:placeholder:text-neutral-700"
          />
          <div className="absolute bottom-0 left-6 right-6 h-px bg-neutral-200 dark:bg-neutral-800" />
        </div>

        <div className="flex-1 overflow-y-auto max-h-[60vh] custom-scrollbar px-6">
          {query.trim() && searchResults.length === 0 && (
            <div className="text-center text-neutral-400 text-lg mt-12">No tasks found</div>
          )}
          
          <div className="space-y-3">
            {searchResults.map((task) => (
              <div 
                key={task.id} 
                className="bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm border border-neutral-100 dark:border-neutral-800 p-5 rounded-2xl flex flex-col gap-2 transition-all hover:bg-neutral-50 dark:hover:bg-neutral-800/80 cursor-pointer"
              >
                <div className={`text-lg ${task.completed ? "text-neutral-400 line-through" : "text-neutral-800 dark:text-neutral-200"}`}>
                  {task.text}
                </div>
                {task.subtasks?.length > 0 && (
                  <div className="pl-4 border-l-2 border-neutral-200 dark:border-neutral-700 space-y-1">
                    {task.subtasks.map((st) => (
                      <div key={st.id} className={`text-sm ${st.completed ? "text-neutral-400 line-through" : "text-neutral-600 dark:text-neutral-400"}`}>
                        • {st.text}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="text-sm text-neutral-400 dark:text-neutral-500 font-medium">
                    {task.dateLabel}
                  </div>
                  {(task.project || task.dueDate) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {task.project && (
                        <div className="flex shrink-0 items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                          <Briefcase size={12} />
                          <span>{task.project}</span>
                        </div>
                      )}
                      {task.dueDate && (
                        <div className="flex shrink-0 items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                          <CalendarDays size={12} />
                          <span>{task.dueDate}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <button 
        onClick={onClose}
        className="absolute top-8 right-8 p-3 rounded-full hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 text-neutral-500 transition-colors"
      >
        <X size={24} />
      </button>
    </div>
  );
}

FullScreenSearch.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  tasks: PropTypes.array.isRequired,
  history: PropTypes.array.isRequired,
};

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const [inputValue, setInputValue] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const editCaretPositionRef = useRef(null);
  const [settingReminderId, setSettingReminderId] = useState(null);
  const [reminderTime, setReminderTime] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [deleteTrigger, setDeleteTrigger] = useState(null);

  const [addingSubtaskId, setAddingSubtaskId] = useState(null);
  const [newSubtaskText, setNewSubtaskText] = useState("");
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);
  const [editSubtaskText, setEditSubtaskText] = useState("");

  const [draftProject, setDraftProject] = useState(null);
  const [draftDate, setDraftDate] = useState(null);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showDateMenu, setShowDateMenu] = useState(false);

  const [activeDragHandleId, setActiveDragHandleId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [dragOverPosition, setDragOverPosition] = useState(null);

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const todayRef = useRef(null);
  const tasksEndRef = useRef(null);
  const firedRef = useRef(new Set());
  const tasksRef = useRef(tasks);
  const historyRef = useRef(history);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { historyRef.current = history; }, [history]);

  // --- Load persisted data from disk on mount ---
  useEffect(() => {
    loadAppData().then((data) => {
      const loadedTasks = data.tasks || [];
      const loadedHistory = (data.history || []).map((h) => {
        if (h.date && h.date.includes(",")) {
          const ts = h.tasks?.length ? parseInt(h.tasks[0].id, 10) : NaN;
          const dateObj = (!isNaN(ts) && ts > 10000000000) ? new Date(ts) : new Date(h.date);
          if (!isNaN(dateObj.getTime())) {
            return { ...h, date: dateObj.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) };
          }
        }
        return h;
      });

      // Extract any uncompleted tasks that might have been saved in history previously
      const cleanedHistory = [];
      const uncompletedFromHistory = [];
      loadedHistory.forEach((h) => {
        const remaining = [];
        h.tasks.forEach((t) => {
          if (!t.completed) uncompletedFromHistory.push(t);
          else remaining.push(t);
        });
        if (remaining.length > 0) cleanedHistory.push({ ...h, tasks: remaining });
      });

      const todayStr = new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      });

      const groupedByDate = {}; // { dateStr: { timestamp, tasks: [] } }
      const tasksForToday = [...uncompletedFromHistory];

      loadedTasks.forEach((task) => {
        const timestamp = parseInt(task.id, 10);
        // Fallback for tasks without a valid timestamp ID
        if (isNaN(timestamp) || timestamp < 10000000000) {
          tasksForToday.push(task);
          return;
        }

        const taskDateStr = new Date(timestamp).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        });

        if (taskDateStr === todayStr || !task.completed) {
          tasksForToday.push(task);
        } else {
          if (!groupedByDate[taskDateStr]) {
            groupedByDate[taskDateStr] = {
              timestamp: new Date(
                new Date(timestamp).setHours(0, 0, 0, 0),
              ).getTime(),
              tasks: [],
            };
          }
          groupedByDate[taskDateStr].tasks.push(task);
        }
      });

      const migratedDateStrings = Object.keys(groupedByDate).sort(
        (a, b) => groupedByDate[a].timestamp - groupedByDate[b].timestamp,
      );

      if (migratedDateStrings.length > 0 || uncompletedFromHistory.length > 0) {
        const updatedHistory = [...cleanedHistory];
        migratedDateStrings.forEach((dateStr) => {
          const existingIdx = updatedHistory.findIndex(
            (h) => h.date === dateStr,
          );
          if (existingIdx > -1) {
            const existingTasks = updatedHistory[existingIdx].tasks;
            const newTasks = groupedByDate[dateStr].tasks.filter(
              (nt) => !existingTasks.some((et) => et.id === nt.id),
            );
            updatedHistory[existingIdx] = {
              ...updatedHistory[existingIdx],
              tasks: [...existingTasks, ...newTasks],
            };
          } else {
            updatedHistory.push({
              date: dateStr,
              tasks: groupedByDate[dateStr].tasks,
            });
          }
        });

        // Ensure history is sorted by date (using proxy timestamp from tasks)
        updatedHistory.sort((a, b) => {
          const getTS = (h) =>
            h.tasks.length > 0 ? parseInt(h.tasks[0].id, 10) : 0;
          return getTS(a) - getTS(b);
        });

        setTasks(tasksForToday);
        setHistory(updatedHistory);
      } else {
        setTasks(loadedTasks);
        setHistory(loadedHistory);
      }

      if (data.firedReminders?.length)
        firedRef.current = new Set(data.firedReminders);
      setLoaded(true);
    });
  }, []);

  // --- Persist to disk on every change (skip until initial load completes) ---
  useEffect(() => {
    if (!loaded) return;
    saveAppData({ tasks });
  }, [tasks, loaded]);
  useEffect(() => {
    if (!loaded) return;
    saveAppData({ history });
  }, [history, loaded]);

  // --- Auto-focus input on window focus ---
  useEffect(() => {
    const focusInput = () => {
      if (!showSettings) setTimeout(() => inputRef.current?.focus(), 50);
    };
    focusInput();
    window.addEventListener("focus", focusInput);
    return () => window.removeEventListener("focus", focusInput);
  }, [showSettings]);

  // --- Close Image Preview on Escape ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && previewImage) {
        setPreviewImage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewImage]);

  // --- Scroll to Today on mount ---
  useEffect(() => {
    setTimeout(
      () =>
        todayRef.current?.scrollIntoView({ behavior: "auto", block: "start" }),
      80,
    );
  }, []);

  // --- CMD+F Shortcut for Search ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // --- Listen for menu bar Settings ---
  useEffect(() => {
    const handler = () => setShowSettings(true);
    window.electron?.ipcRenderer.on("open-settings", handler);
    return () =>
      window.electron?.ipcRenderer.removeAllListeners("open-settings");
  }, []);

  // --- Reminder notification timer ---
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      tasks.forEach((t) => {
        if (!t.reminder || t.completed) return;
        const key = `${t.id}-${hhmm}`;
        if (t.reminder === hhmm && !firedRef.current.has(key)) {
          firedRef.current.add(key);
          saveAppData({ firedReminders: [...firedRef.current] });

          window.electron?.ipcRenderer
            .invoke("show-notification", {
              title: "Stepler",
              body: t.text,
            })
            .then((success) => {
              if (!success && window.Notification) {
                if (Notification.permission === "granted") {
                  new Notification("Stepler", { body: t.text });
                } else if (Notification.permission !== "denied") {
                  Notification.requestPermission().then((p) => {
                    if (p === "granted")
                      new Notification("Stepler", { body: t.text });
                  });
                }
              }
            });
        }
      });
    };

    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [tasks]);

  // Reset fired reminders at midnight
  useEffect(() => {
    const checkMidnight = () => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        firedRef.current = new Set();
        saveAppData({ firedReminders: [] });
      }
    };
    const id = setInterval(checkMidnight, 60_000);
    return () => clearInterval(id);
  }, []);

  // --- Check for day rollover to trigger migration ---
  useEffect(() => {
    if (!loaded) return;
    
    const checkRollover = () => {
      const todayStr = new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      });
      
      const prevTasks = tasksRef.current;
      let needsMigration = false;
      
      prevTasks.forEach(task => {
        const ts = parseInt(task.id, 10);
        if (!isNaN(ts) && ts > 10000000000) {
          if (new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) !== todayStr && task.completed) {
            needsMigration = true;
          }
        }
      });
      
      if (needsMigration) {
        const prevHistory = historyRef.current;
        const groupedByDate = {};
        const tasksForToday = [];
        
        prevTasks.forEach((task) => {
          const timestamp = parseInt(task.id, 10);
          if (isNaN(timestamp) || timestamp < 10000000000) {
            tasksForToday.push(task);
            return;
          }
          const taskDateStr = new Date(timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
          if (taskDateStr === todayStr || !task.completed) {
            tasksForToday.push(task);
          } else {
            if (!groupedByDate[taskDateStr]) {
              groupedByDate[taskDateStr] = {
                timestamp: new Date(new Date(timestamp).setHours(0, 0, 0, 0)).getTime(),
                tasks: [],
              };
            }
            groupedByDate[taskDateStr].tasks.push(task);
          }
        });
        
        const migratedDateStrings = Object.keys(groupedByDate).sort(
          (a, b) => groupedByDate[a].timestamp - groupedByDate[b].timestamp,
        );
        
        if (migratedDateStrings.length > 0) {
          const updatedHistory = [...prevHistory];
          migratedDateStrings.forEach((dateStr) => {
            const existingIdx = updatedHistory.findIndex((h) => h.date === dateStr);
            if (existingIdx > -1) {
              const existingTasks = updatedHistory[existingIdx].tasks;
              const newTasks = groupedByDate[dateStr].tasks.filter(
                (nt) => !existingTasks.some((et) => et.id === nt.id),
              );
              updatedHistory[existingIdx] = {
                ...updatedHistory[existingIdx],
                tasks: [...existingTasks, ...newTasks],
              };
            } else {
              updatedHistory.push({
                date: dateStr,
                tasks: groupedByDate[dateStr].tasks,
              });
            }
          });
          
          updatedHistory.sort((a, b) => {
            const getTS = (h) => (h.tasks.length > 0 ? parseInt(h.tasks[0].id, 10) : 0);
            return getTS(a) - getTS(b);
          });
          
          setHistory(updatedHistory);
          setTasks(tasksForToday);
        }
      }
    };
    
    const interval = setInterval(checkRollover, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [loaded]);

  // --- Handlers ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setPendingAttachment({
        url: event.target.result,
        name: file.name,
        type: file.type.startsWith("image/") ? "image" : "file",
      });
    };
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setPendingAttachment({
              url: event.target.result,
              name: `pasted-image-${Date.now()}.png`,
              type: "image",
            });
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  const addTask = (e) => {
    if (e && e.key === "Enter" && e.shiftKey) return;
    if (
      (!e || e.key === "Enter" || e.type === "click") &&
      (inputValue.trim() !== "" || pendingAttachment)
    ) {
      if (e && e.preventDefault) e.preventDefault();
      setTasks((prev) => [
        ...prev,
        {
          id: (Date.now() - 86400000 * 2).toString(), // SIMULATION: 2 days ago
          text:
            inputValue.trim() ||
            (pendingAttachment && pendingAttachment.type !== "image"
              ? pendingAttachment.name
              : ""),
          completed: false,
          priority: false,
          attachment: pendingAttachment || undefined,
          project: draftProject,
          dueDate: draftDate,
        },
      ]);
      setInputValue("");
      setPendingAttachment(null);
      setDraftProject(null);
      setDraftDate(null);
      if (!isExpanded && inputRef.current)
        inputRef.current.style.height = "auto";
      setIsExpanded(false);
      setTimeout(
        () =>
          tasksEndRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          }),
        100,
      );
    }
  };

  const saveEdit = useCallback(
    (id) => {
      if (editText.trim() !== "") {
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? { ...t, text: editText.trim() } : t)),
        );
      }
      setEditingId(null);
    },
    [editText],
  );

  const saveReminder = (id, clear = false) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, reminder: clear ? undefined : reminderTime } : t,
      ),
    );
    setSettingReminderId(null);
  };

  const toggleTask = (id) =>
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );

  const togglePriority = (id) =>
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, priority: !t.priority } : t)),
    );

  const removeAttachment = (id) =>
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, attachment: undefined } : t)),
    );

  const deleteTask = (id) =>
    setTasks((prev) => prev.filter((t) => t.id !== id));

  const triggerDeleteTask = (e, id) => {
    e.stopPropagation();
    const el = e.currentTarget.closest(".group\\/task");
    if (el) {
      const rect = el.getBoundingClientRect();
      setDeleteTrigger({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        timestamp: Date.now()
      });
      setTimeout(() => deleteTask(id), 50);
    } else {
      deleteTask(id);
    }
  };

  const addSubtask = (taskId) => {
    if (newSubtaskText.trim() === "") {
      setAddingSubtaskId(null);
      return;
    }
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const subtasks = t.subtasks || [];
          return {
            ...t,
            subtasks: [
              ...subtasks,
              {
                id: Date.now().toString(),
                text: newSubtaskText.trim(),
                completed: false,
              },
            ],
          };
        }
        return t;
      }),
    );
    setNewSubtaskText("");
    setAddingSubtaskId(null);
  };

  const toggleSubtask = (taskId, subtaskId) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            subtasks: (t.subtasks || []).map((st) =>
              st.id === subtaskId ? { ...st, completed: !st.completed } : st,
            ),
          };
        }
        return t;
      }),
    );
  };

  const deleteSubtask = (taskId, subtaskId) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            subtasks: (t.subtasks || []).filter((st) => st.id !== subtaskId),
          };
        }
        return t;
      }),
    );
  };

  const triggerDeleteSubtask = (e, taskId, subtaskId) => {
    e.stopPropagation();
    const el = e.currentTarget.closest(".group\\/subtask");
    if (el) {
      const rect = el.getBoundingClientRect();
      setDeleteTrigger({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        timestamp: Date.now()
      });
      setTimeout(() => deleteSubtask(taskId, subtaskId), 50);
    } else {
      deleteSubtask(taskId, subtaskId);
    }
  };

  const saveSubtaskEdit = (taskId, subtaskId) => {
    if (editSubtaskText.trim() !== "") {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === taskId) {
            return {
              ...t,
              subtasks: (t.subtasks || []).map((st) =>
                st.id === subtaskId
                  ? { ...st, text: editSubtaskText.trim() }
                  : st,
              ),
            };
          }
          return t;
        }),
      );
    }
    setEditingSubtaskId(null);
  };

  const sortedTasks = [...tasks]
    .filter((t) => (showCompleted ? true : !t.completed))
    .sort((a, b) => {
      if (a.completed === b.completed) {
        if (a.priority === b.priority) return 0;
        return a.priority ? 1 : -1;
      }
      return a.completed ? -1 : 1;
    });

  const handleDayClick = (dateStr) => {
    if (dateStr === "Today") {
      todayRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      const el = document.getElementById(`day-${dateStr}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleDragStart = (e, type, id, parentId = null) => {
    e.stopPropagation();
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type, id, parentId }),
    );
    e.dataTransfer.effectAllowed = "move";
    // We can also dim the dragged item or just let default formatting happen.
    setDragOverId(null);
    setDragOverPosition(null);
  };

  const handleDragEnd = (e) => {
    setDragOverId(null);
    setDragOverPosition(null);
  };

  const handleDragOverTask = (e, targetId) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    
    let position = "child";
    if (y < height * 0.25) position = "top";
    else if (y > height * 0.75) position = "bottom";

    if (dragOverId !== targetId || dragOverPosition !== position) {
      setDragOverId(targetId);
      setDragOverPosition(position);
    }
  };

  const handleDragOverTimeline = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== "timeline") {
      setDragOverId("timeline");
    }
  };

  const handleDragLeaveTimeline = (e) => {
    if (dragOverId === "timeline") {
      setDragOverId(null);
    }
  };

  const handleDragLeaveTask = (e, targetId) => {
    if (dragOverId === targetId) {
      setDragOverId(null);
      setDragOverPosition(null);
    }
  };

  const handleDropAction = (e, targetType, targetId = null, position = "child") => {
    const dataStr = e.dataTransfer.getData("application/json");
    if (!dataStr) return;
    
    setDragOverId(null);
    setDragOverPosition(null);

    try {
      const {
        type: sourceType,
        id: sourceId,
        parentId: sourceParentId,
      } = JSON.parse(dataStr);

      if (sourceId === targetId) return;

      setTasks((prev) => {
        let newTasks = [...prev];
        let movedItem = null;

        if (sourceType === "task") {
          const idx = newTasks.findIndex((t) => t.id === sourceId);
          if (idx === -1) return prev;
          movedItem = { ...newTasks[idx] };
          newTasks = newTasks.filter((t) => t.id !== sourceId);
        } else if (sourceType === "subtask") {
          const parentIdx = newTasks.findIndex((t) => t.id === sourceParentId);
          if (parentIdx === -1) return prev;
          const parentTask = newTasks[parentIdx];
          const subIdx = (parentTask.subtasks || []).findIndex(
            (st) => st.id === sourceId,
          );
          if (subIdx === -1) return prev;
          movedItem = { ...parentTask.subtasks[subIdx] };
          newTasks = newTasks.map((t, idx) => {
            if (idx === parentIdx) {
              return {
                ...t,
                subtasks: t.subtasks.filter((st) => st.id !== sourceId),
              };
            }
            return t;
          });
        }

        if (!movedItem) return prev;

        const newId = Date.now().toString() + "-" + Math.floor(Math.random() * 1000);

        if (targetType === "task") {
          if (sourceType === "task") {
            const targetIndex = newTasks.findIndex((t) => t.id === targetId);
            if (targetIndex !== -1) {
              if (position === "child") {
                newTasks[targetIndex] = {
                  ...newTasks[targetIndex],
                  subtasks: [...(newTasks[targetIndex].subtasks || []), { ...movedItem, id: newId }],
                };
              } else if (position === "top") {
                newTasks.splice(targetIndex, 0, { ...movedItem, id: movedItem.id });
              } else if (position === "bottom") {
                newTasks.splice(targetIndex + 1, 0, { ...movedItem, id: movedItem.id });
              }
            }
          } else {
            newTasks = newTasks.map((t) => {
              if (t.id === targetId) {
                return {
                  ...t,
                  subtasks: [...(t.subtasks || []), { ...movedItem, id: newId }],
                };
              }
              return t;
            });
          }
        } else if (targetType === "timeline") {
          newTasks.push({ ...movedItem, id: sourceType === "task" ? movedItem.id : newId });
        }

        return newTasks;
      });
    } catch (err) {
      console.error("Drop error", err);
    }
  };

  const handleDropOnTask = (e, targetId) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    
    let position = "child";
    if (y < height * 0.25) position = "top";
    else if (y > height * 0.75) position = "bottom";

    handleDropAction(e, "task", targetId, position);
  };

  const handleDropOnTimeline = (e) => {
    e.preventDefault();
    handleDropAction(e, "timeline");
  };

  // ========================= RENDER =========================

  return (
    <div className="flex h-screen w-full overflow-hidden bg-neutral-50 font-sans text-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
      <ParticleCanvas trigger={deleteTrigger} />
      <FullScreenSearch 
        show={showSearch} 
        onClose={() => setShowSearch(false)} 
        tasks={tasks} 
        history={history} 
      />
      <Sidebar 
        show={showSidebar} 
        history={history} 
        tasks={tasks} 
        onDayClick={handleDayClick} 
        onSettingsClick={() => setShowSettings(true)} 
      />
      <div className="flex h-full flex-1 flex-col overflow-hidden relative">
        {/* Header */}
        <div
          style={{ WebkitAppRegion: "drag" }}
          className="relative z-40 flex h-8 shrink-0 items-center justify-center border-b border-neutral-200 bg-neutral-100/80 px-5 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/80"
        >
          <div className="flex w-full max-w-3xl items-center justify-between">
            <div className="flex items-center pl-2 text-neutral-600 dark:text-neutral-300">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300 pointer-events-auto"
                style={{ WebkitAppRegion: "no-drag" }}
                title="Toggle Sidebar"
              >
                <PanelLeft size={18} />
              </button>
            </div>
            <div
              style={{ WebkitAppRegion: "no-drag" }}
              className="flex items-center gap-3"
            >
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2 text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
              >
                <span>{showCompleted ? "Hide Completed" : "Show All"}</span>
                <div
                  className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out ${
                    showCompleted ? "bg-blue-500" : "bg-neutral-300 dark:bg-neutral-700"
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                      showCompleted ? "translate-x-3.5" : "translate-x-0.5"
                    }`}
                  />
                </div>
              </button>
              <div className="border-l border-neutral-300 pl-3 text-sm font-medium text-neutral-400 dark:border-neutral-700 dark:text-neutral-500">
                {tasks.filter((t) => t.completed).length} / {tasks.length} Today
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="custom-scrollbar relative flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-5 md:px-8">
            <div className="h-5 w-full shrink-0 md:h-8" />
            <div className="relative pl-2">
              {/* HISTORY */}
              {history.map((day, idx) => (
                <div
                  key={idx}
                  id={`day-${day.date}`}
                  className="group relative mb-8 opacity-70 transition-opacity duration-300 hover:opacity-100"
                >
                  <div className="sticky top-0 z-30 bg-white/95 pt-3 pb-4 backdrop-blur-md dark:bg-neutral-950/95">
                    <div className="absolute left-[4px] top-[18px] z-10 h-2 w-2 rounded-full bg-neutral-600 shadow-[0_0_8px_rgba(0,0,0,0.2)] ring-[5px] ring-white dark:bg-neutral-300 dark:shadow-[0_0_8px_rgba(255,255,255,0.1)] dark:ring-neutral-950" />
                    <div className="pl-8">
                      <h2 className="text-lg font-bold leading-none text-neutral-900 dark:text-neutral-100">
                        {day.date}
                      </h2>
                    </div>
                  </div>

                  <div className="relative space-y-0.5 pl-8">
                    {/* Vertical line for History */}
                    <div className="absolute left-[7px] top-0 bottom-[-32px] z-0 w-[2px] bg-neutral-200 dark:bg-neutral-800" />
                    {day.tasks.map((task) => {
                      const dt = formatTaskDateTime(task.id);
                      return (
                        <div
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
                              {formatTaskText(task.text)}
                            </span>
                            {(task.project || task.dueDate) && (
                              <div className="mt-1.5 flex items-center gap-2 opacity-50">
                                {task.project && (
                                  <div className="flex items-center gap-1 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-500 dark:bg-neutral-800/60 dark:text-neutral-400">
                                    <Hash size={10} />
                                    <span>{task.project}</span>
                                  </div>
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
                            {/* --- Subtasks Rendering for History --- */}
                            {task.subtasks && task.subtasks.length > 0 && (
                              <div className="mt-2 space-y-1 pl-1">
                                {task.subtasks.map((st) => (
                                  <div
                                    key={st.id}
                                    className="flex items-start rounded p-1"
                                  >
                                    <CheckCircle2
                                      size={13}
                                      className="mt-0.5 mr-2 shrink-0 text-neutral-300 dark:text-neutral-600"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <span className="block w-full whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-400 line-through dark:text-neutral-500">
                                        {formatTaskText(st.text)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* TODAY */}
              <div 
                ref={todayRef} 
                className={`relative pb-10 transition-colors ${
                  dragOverId === "timeline" ? "bg-blue-50/50 dark:bg-blue-900/10 rounded-xl" : ""
                }`}
                onDragOver={handleDragOverTimeline}
                onDragLeave={handleDragLeaveTimeline}
                onDrop={handleDropOnTimeline}
              >
                <div className="sticky top-0 z-30 bg-white/95 pt-3 pb-4 backdrop-blur-md dark:bg-neutral-950/95">
                  {history.length > 0 && (
                    <div className="absolute left-[7px] top-0 z-0 h-[18px] w-[2px] bg-neutral-200 dark:bg-neutral-800" />
                  )}
                  <div className="absolute left-[4px] top-[18px] z-10 h-2 w-2 rounded-full bg-neutral-600 shadow-[0_0_8px_rgba(0,0,0,0.2)] ring-[5px] ring-white dark:bg-neutral-300 dark:shadow-[0_0_8px_rgba(255,255,255,0.1)] dark:ring-neutral-950" />
                  <div className="pl-8">
                    <h2 className="text-lg font-bold leading-none text-neutral-900 dark:text-neutral-100">
                      Today
                    </h2>
                    <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                      {formattedDate}
                    </p>
                  </div>
                </div>

                <div className="relative space-y-0.5 pl-8">
                  {/* Vertical line for Today section */}
                  <div className="absolute left-[7px] top-0 bottom-0 z-0 w-[2px] bg-neutral-200 dark:bg-neutral-800" />

                  {sortedTasks.length === 0 ? (
                    <p className="py-2 text-sm italic text-neutral-400 dark:text-neutral-600">
                      {tasks.length > 0
                        ? "All tasks completed and hidden."
                        : "No tasks yet. Start typing below."}
                    </p>
                  ) : (
                    sortedTasks.map((task) => {
                      const dt = formatTaskDateTime(task.id);
                      return (
                        <div
                          key={task.id}
                          className={`group/task relative flex items-start rounded-xl p-2 transition-all duration-300 ease-out will-change-transform ${
                            task.completed
                              ? "opacity-40 hover:opacity-70"
                              : "hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40"
                          } ${
                            dragOverId === task.id && dragOverPosition === "child"
                              ? "scale-[1.02] -translate-y-[2px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-white dark:bg-neutral-900 z-20 border border-blue-200 dark:border-blue-800/50 ring-4 ring-blue-500/20"
                              : "border border-transparent z-10"
                          }`}
                          draggable={activeDragHandleId === task.id}
                          onDragStart={(e) => handleDragStart(e, "task", task.id)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleDragOverTask(e, task.id)}
                          onDragLeave={(e) => handleDragLeaveTask(e, task.id)}
                          onDrop={(e) => handleDropOnTask(e, task.id)}
                        >
                          {dt && (
                            <div className="absolute right-full inset-y-0 flex items-center pr-8 opacity-0 transition-opacity duration-200 group-hover/task:opacity-100 pointer-events-none z-10">
                              <span className="whitespace-nowrap text-[13px] font-medium leading-none tracking-wide text-neutral-400 dark:text-neutral-500">
                                {dt.time}
                              </span>
                            </div>
                          )}
                          {dragOverId === task.id && dragOverPosition === "top" && (
                            <div className="absolute -top-0.5 left-0 right-0 h-[3px] rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] z-30 pointer-events-none" />
                          )}
                          {dragOverId === task.id && dragOverPosition === "bottom" && (
                            <div className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] z-30 pointer-events-none" />
                          )}
                          <div 
                            className="mt-1 ml-1 flex shrink-0 items-center justify-center w-4 mr-1 opacity-0 transition-opacity group-hover/task:opacity-100 cursor-grab active:cursor-grabbing text-neutral-400 dark:text-neutral-500"
                            onMouseEnter={() => setActiveDragHandleId(task.id)}
                            onMouseLeave={() => setActiveDragHandleId(null)}
                          >
                            <GripVertical size={14} />
                          </div>
                          <button
                            onClick={() => toggleTask(task.id)}
                            className="mt-1 mr-3 shrink-0 text-neutral-400 transition-colors hover:text-blue-500 focus:outline-none dark:text-neutral-500 dark:hover:text-blue-400"
                          >
                            {task.completed ? (
                              <CheckCircle2 size={18} className="text-blue-500" />
                            ) : (
                              <Circle size={18} />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            {editingId === task.id ? (
                              <textarea
                                autoFocus
                                ref={(el) => {
                                  if (el && !el.dataset.initialized) {
                                    el.dataset.initialized = "true";
                                    el.style.height = "auto";
                                    el.style.height = Math.min(el.scrollHeight, 300) + "px";
                                    if (editCaretPositionRef.current !== null) {
                                      el.setSelectionRange(
                                        editCaretPositionRef.current,
                                        editCaretPositionRef.current
                                      );
                                      editCaretPositionRef.current = null;
                                    }
                                  }
                                }}
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onBlur={() => saveEdit(task.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    if (!e.shiftKey) {
                                      e.preventDefault();
                                      saveEdit(task.id);
                                    }
                                  } else if (e.key === "Escape") {
                                    setEditingId(null);
                                  }
                                }}
                                onInput={(e) => {
                                  e.target.style.height = "auto";
                                  e.target.style.height =
                                    Math.min(e.target.scrollHeight, 300) + "px";
                                }}
                                className="w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-[15px] leading-relaxed text-neutral-800 shadow-sm focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:focus:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 min-h-[60px]"
                              />
                            ) : (
                              <span
                                onClick={(e) => {
                                  if (e.target.tagName !== "A") {
                                    let offset = task.text.length;
                                    const selection = window.getSelection();
                                    if (selection.rangeCount > 0) {
                                      const range = selection.getRangeAt(0);
                                      const preCaretRange = range.cloneRange();
                                      preCaretRange.selectNodeContents(e.currentTarget);
                                      preCaretRange.setEnd(range.startContainer, range.startOffset);
                                      offset = preCaretRange.toString().length;
                                    }
                                    editCaretPositionRef.current = offset;
                                    setEditingId(task.id);
                                    setEditText(task.text);
                                  }
                                }}
                                className={`block w-full cursor-text whitespace-pre-wrap text-[15px] leading-relaxed ${
                                  task.completed
                                    ? "text-neutral-400 line-through dark:text-neutral-500"
                                    : "text-neutral-800 dark:text-neutral-200"
                                }`}
                              >
                                {task.priority && !task.completed && (
                                  <Star
                                    size={14}
                                    className="mb-0.5 mr-1.5 inline text-amber-500 dark:text-amber-400"
                                    fill="currentColor"
                                  />
                                )}
                                {formatTaskText(task.text)}
                              </span>
                            )}
                            {(task.project || task.dueDate) && (
                              <div className="mt-1.5 flex items-center gap-2">
                                {task.project && (
                                  <div className="flex items-center gap-1 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-500 dark:bg-neutral-800/60 dark:text-neutral-400">
                                    <Hash size={10} />
                                    <span>{task.project}</span>
                                  </div>
                                )}
                                {task.dueDate && (
                                  <div className="flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                                    <Calendar size={10} />
                                    <span>{task.dueDate}</span>
                                  </div>
                                )}
                              </div>
                            )}
                            {task.reminder && settingReminderId !== task.id && (
                              <div className="mt-1.5 flex items-center text-xs text-blue-500 opacity-80 dark:text-blue-400">
                                <Bell size={12} className="mr-1" />
                                <span>{task.reminder}</span>
                              </div>
                            )}
                            {settingReminderId === task.id && (
                              <div className="mt-2 flex items-center space-x-2">
                                <input
                                  type="time"
                                  autoFocus
                                  value={reminderTime}
                                  onChange={(e) => setReminderTime(e.target.value)}
                                  className="rounded border border-neutral-300 bg-neutral-50 px-2 py-1 text-xs text-neutral-700 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                                />
                                <button
                                  onClick={() => saveReminder(task.id)}
                                  className="rounded bg-blue-500/10 px-2 py-1 text-xs text-blue-600 transition-colors hover:bg-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 dark:hover:bg-blue-500/30"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => saveReminder(task.id, true)}
                                  className="rounded bg-neutral-200 px-2 py-1 text-xs text-neutral-600 transition-colors hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
                                >
                                  Clear
                                </button>
                                <button
                                  onClick={() => setSettingReminderId(null)}
                                  className="rounded px-2 py-1 text-xs text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                            {task.attachment && (
                              <div className="mt-2 mb-1">
                                {task.attachment.type === "image" ? (
                                  <div className="relative group/attachment inline-block">
                                    <img
                                      src={task.attachment.url}
                                      alt=""
                                      onClick={() => setPreviewImage(task.attachment.url)}
                                      className="max-h-32 cursor-pointer rounded-lg border border-neutral-200 object-cover transition-opacity group-hover/attachment:opacity-80 dark:border-neutral-800"
                                    />
                                    <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover/attachment:opacity-100">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPreviewImage(task.attachment.url);
                                        }}
                                        className="rounded-md bg-black/60 p-1.5 text-white backdrop-blur-md transition-colors hover:bg-black/80 dark:bg-black/80 dark:hover:bg-black"
                                        title="Preview"
                                      >
                                        <Maximize2 size={14} />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeAttachment(task.id);
                                        }}
                                        className="rounded-md bg-black/60 p-1.5 text-white backdrop-blur-md transition-colors hover:bg-red-500/90 hover:text-white dark:bg-black/80 dark:hover:bg-red-600/90"
                                        title="Delete Attachment"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex w-fit items-center rounded-lg border border-neutral-200 bg-neutral-100 p-2 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                                    <FileText size={14} className="mr-2 shrink-0" />
                                    <span className="max-w-[200px] truncate">
                                      {task.attachment.name}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                            {/* --- Subtasks Rendering --- */}
                            {task.subtasks && task.subtasks.length > 0 && (
                              <div className="mt-2 space-y-1 pl-1">
                                {task.subtasks.map((st) => (
                                  <div
                                    key={st.id}
                                    className={`group/subtask relative flex items-start rounded p-1 transition-all hover:bg-neutral-200/50 dark:hover:bg-neutral-800/60 ${
                                      dragOverId === st.id
                                        ? "ring-1 ring-blue-300 bg-blue-50/50 dark:ring-blue-500/50 dark:bg-blue-900/10"
                                        : ""
                                    }`}
                                    draggable={activeDragHandleId === st.id}
                                    onDragStart={(e) => handleDragStart(e, "subtask", st.id, task.id)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => handleDragOverTask(e, st.id)}
                                    onDragLeave={(e) => handleDragLeaveTask(e, st.id)}
                                    // For simplicity, subtasks are dropped onto their parent task's id to become siblings
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleDropAction(e, "task", task.id);
                                    }}
                                  >
                                    <div 
                                      className="mt-0.5 flex shrink-0 items-center justify-center w-3 -ml-3 mr-0 opacity-0 transition-opacity group-hover/subtask:opacity-100 cursor-grab active:cursor-grabbing text-neutral-400 dark:text-neutral-500"
                                      onMouseEnter={() => setActiveDragHandleId(st.id)}
                                      onMouseLeave={() => setActiveDragHandleId(null)}
                                    >
                                      <GripVertical size={12} />
                                    </div>
                                    <button
                                      onClick={() => toggleSubtask(task.id, st.id)}
                                      className="mt-0.5 mr-2 shrink-0 text-neutral-400 transition-colors hover:text-blue-500 focus:outline-none dark:text-neutral-500 dark:hover:text-blue-400"
                                    >
                                      {st.completed ? (
                                        <CheckCircle2 size={14} className="text-blue-500" />
                                      ) : (
                                        <Circle size={14} />
                                      )}
                                    </button>
                                    <div className="min-w-0 flex-1">
                                      {editingSubtaskId === st.id ? (
                                        <input
                                          autoFocus
                                          ref={(el) => {
                                            if (el && !el.dataset.initialized) {
                                              el.dataset.initialized = "true";
                                              if (editCaretPositionRef.current !== null) {
                                                el.setSelectionRange(
                                                  editCaretPositionRef.current,
                                                  editCaretPositionRef.current
                                                );
                                                editCaretPositionRef.current = null;
                                              }
                                            }
                                          }}
                                          value={editSubtaskText}
                                          onChange={(e) => setEditSubtaskText(e.target.value)}
                                          onBlur={() => saveSubtaskEdit(task.id, st.id)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") saveSubtaskEdit(task.id, st.id);
                                            else if (e.key === "Escape") setEditingSubtaskId(null);
                                          }}
                                          className="w-full rounded border border-neutral-300 bg-white px-2 py-0.5 text-[14px] leading-relaxed text-neutral-800 shadow-sm focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:focus:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200"
                                        />
                                      ) : (
                                        <span
                                          onClick={(e) => {
                                            if (e.target.tagName !== "A") {
                                              let offset = st.text.length;
                                              const selection = window.getSelection();
                                              if (selection.rangeCount > 0) {
                                                const range = selection.getRangeAt(0);
                                                const preCaretRange = range.cloneRange();
                                                preCaretRange.selectNodeContents(e.currentTarget);
                                                preCaretRange.setEnd(range.startContainer, range.startOffset);
                                                offset = preCaretRange.toString().length;
                                              }
                                              editCaretPositionRef.current = offset;
                                              setEditingSubtaskId(st.id);
                                              setEditSubtaskText(st.text);
                                            }
                                          }}
                                          className={`block w-full cursor-text whitespace-pre-wrap text-[14px] leading-relaxed ${
                                            st.completed
                                              ? "text-neutral-400 line-through dark:text-neutral-500"
                                              : "text-neutral-600 dark:text-neutral-300"
                                          }`}
                                        >
                                          {formatTaskText(st.text)}
                                        </span>
                                      )}
                                    </div>
                                    <div className="ml-2 flex shrink-0 items-center opacity-0 transition-opacity group-hover/subtask:opacity-100">
                                      <button
                                        onClick={(e) => triggerDeleteSubtask(e, task.id, st.id)}
                                        className="rounded p-0.5 text-neutral-400 transition-colors hover:text-red-500 focus:outline-none dark:text-neutral-500 dark:hover:text-red-400"
                                        title="Delete Subtask"
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {addingSubtaskId === task.id && (
                              <div className="mt-2 flex items-center pl-1">
                                <CornerDownRight size={14} className="mr-2 text-neutral-400 dark:text-neutral-600" />
                                <input
                                  autoFocus
                                  value={newSubtaskText}
                                  onChange={(e) => setNewSubtaskText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") addSubtask(task.id);
                                    else if (e.key === "Escape") {
                                      setAddingSubtaskId(null);
                                      setNewSubtaskText("");
                                    }
                                  }}
                                  onBlur={() => addSubtask(task.id)}
                                  placeholder="New subtask..."
                                  className="w-full rounded border border-neutral-300 bg-transparent px-2 py-0.5 text-[14px] text-neutral-800 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:text-neutral-200 dark:focus:border-blue-500"
                                />
                              </div>
                            )}

                            {/* Task Action Buttons (visible on hover) */}
                            <div className="mt-2 flex flex-wrap gap-1.5 opacity-0 transition-opacity duration-200 group-hover/task:opacity-100">
                              <button
                                onClick={() => togglePriority(task.id)}
                                className={`group/btn relative flex items-center justify-center gap-1.5 rounded-full border px-2 py-1 shadow-sm backdrop-blur-md transition-colors ${
                                  task.priority
                                    ? "border-amber-200/60 bg-amber-100 text-amber-600 dark:border-amber-900/50 dark:bg-amber-900/30 dark:text-amber-400"
                                    : "border-neutral-200/60 bg-white/60 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700/50"
                                }`}
                              >
                                <Star size={13} fill={task.priority ? "currentColor" : "none"} />
                                <span className="text-[11px] font-medium leading-none">
                                  Priority
                                </span>
                              </button>
                              <button
                                onClick={() => {
                                  setSettingReminderId(task.id);
                                  setReminderTime(task.reminder || "");
                                }}
                                className="group/btn relative flex items-center justify-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 text-neutral-500 shadow-sm backdrop-blur-md transition-colors hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700/50"
                              >
                                <Bell size={13} />
                                <span className="text-[11px] font-medium leading-none">
                                  Remind
                                </span>
                              </button>
                              <button
                                onClick={() => {
                                  setAddingSubtaskId(task.id);
                                  setNewSubtaskText("");
                                }}
                                className="group/btn relative flex items-center justify-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 text-neutral-500 shadow-sm backdrop-blur-md transition-colors hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700/50"
                              >
                                <CornerDownRight size={13} />
                                <span className="text-[11px] font-medium leading-none">
                                  Subtask
                                </span>
                              </button>
                              <button
                                onClick={(e) => triggerDeleteTask(e, task.id)}
                                className="group/btn relative flex items-center justify-center gap-1.5 rounded-full border border-neutral-200/60 bg-white/60 px-2 py-1 text-neutral-500 shadow-sm backdrop-blur-md transition-colors hover:border-red-200/60 hover:bg-red-50 hover:text-red-500 dark:border-neutral-700/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:border-red-900/50 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                              >
                                <X size={13} />
                                <span className="text-[11px] font-medium leading-none">
                                  Delete
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="h-[40vh]" />
              <div ref={tasksEndRef} className="h-1" />

          </div>
        </div>
      </div>

      {/* Bottom Bar */}
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
                      <button
                        onClick={() => setPendingAttachment(null)}
                        className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white backdrop-blur-md transition-colors hover:bg-neutral-800 hover:text-white dark:bg-black/80 dark:hover:bg-neutral-700 opacity-0 group-hover/pending:opacity-100"
                        title="Remove Attachment"
                      >
                        <X size={12} />
                      </button>
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
                  draftProject || draftDate ? "border-indigo-500/50" : "border-neutral-200 dark:border-neutral-800/80"
                } transition-all duration-300 dark:bg-[#1a1a1a] ${
                  isExpanded
                    ? "h-[60vh] md:h-[70vh]"
                    : "min-h-[48px]"
                }`}
              >
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={`absolute right-4 z-10 rounded-md text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-200 ${
                    isExpanded ? "top-4" : "top-3.5"
                  }`}
                >
                  {isExpanded ? (
                    <Minimize2 size={18} />
                  ) : (
                    <Maximize2 size={18} />
                  )}
                </button>

                {(!isExpanded || isExpanded) && (draftProject || draftDate) && (
                  <div className="flex flex-col px-5 pt-4 pb-0 gap-3">
                    <div className="flex items-center gap-2">
                      {draftProject && (
                        <div className="flex items-center gap-1.5 rounded-full bg-neutral-100 dark:bg-[#222] border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-500">
                          <User size={14} />
                          {draftProject}
                          <button onClick={() => setDraftProject(null)} className="ml-1 text-green-600/50 hover:text-green-600 dark:text-green-500/50 dark:hover:text-green-500"><X size={14} /></button>
                        </div>
                      )}
                      {draftDate && (
                        <div className="flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-[#1f1e2e] border border-indigo-200 dark:border-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-400">
                          <CalendarDays size={14} />
                          {draftDate}
                          <button onClick={() => setDraftDate(null)} className="ml-1 text-indigo-600/50 hover:text-indigo-600 dark:text-indigo-400/50 dark:hover:text-indigo-400"><X size={14} /></button>
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
                    {/* Add draft buttons */}
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
                          <div className="fixed inset-0 z-40" onClick={() => setShowDateMenu(false)} />
                          <div className="absolute bottom-full left-0 z-50 mb-2 w-48 rounded-xl border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-800 dark:bg-[#1a1a1a]">
                            <div className="mb-2 px-2 pt-1 text-[10px] font-bold tracking-widest text-neutral-400 dark:text-neutral-500">
                              DUE DATE
                            </div>
                            {[
                              { label: 'Today', icon: Zap, color: 'text-amber-500' },
                              { label: 'Tomorrow', icon: Calendar, color: 'text-blue-500' },
                              { label: 'Next Week', icon: CalendarDays, color: 'text-indigo-500' }
                            ].map((item) => (
                              <button
                                key={item.label}
                                onClick={() => { setDraftDate(item.label); setShowDateMenu(false); }}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                              >
                                <item.icon size={16} className={item.color} />
                                <span>{item.label}</span>
                              </button>
                            ))}
                            <div className="my-1 h-px bg-neutral-100 dark:bg-neutral-800" />
                            <button
                              onClick={() => { setDraftDate(null); setShowDateMenu(false); }}
                              className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            >
                              Clear Date
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => setShowProjectMenu(!showProjectMenu)}
                        className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors ${
                          draftProject 
                            ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100" 
                            : "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                        }`}
                      >
                        <Hash size={16} />
                        <span>{draftProject || "Project"}</span>
                      </button>

                      {/* Project Menu Popup */}
                      {showProjectMenu && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowProjectMenu(false)} />
                          <div className="absolute bottom-full left-0 z-50 mb-2 w-48 rounded-xl border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-800 dark:bg-[#1a1a1a]">
                            <div className="mb-2 px-2 pt-1 text-[10px] font-bold tracking-widest text-neutral-400 dark:text-neutral-500">
                              ASSIGN PROJECT
                            </div>
                            <div className="px-2 pb-2">
                              <input 
                                type="text"
                                placeholder="+ New project..."
                                className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-300 dark:focus:ring-neutral-700 text-neutral-800 dark:text-neutral-200"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && e.target.value.trim()) {
                                    setDraftProject(e.target.value.trim());
                                    setShowProjectMenu(false);
                                  }
                                }}
                              />
                            </div>
                            {[
                              { label: 'Work', icon: Briefcase, color: 'text-blue-500' },
                              { label: 'Personal', icon: User, color: 'text-green-500' },
                              { label: 'Health', icon: Zap, color: 'text-orange-500' }
                            ].map((item) => (
                              <button
                                key={item.label}
                                onClick={() => { setDraftProject(item.label); setShowProjectMenu(false); }}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                              >
                                <item.icon size={16} className={item.color} />
                                <span>{item.label}</span>
                              </button>
                            ))}
                            <div className="my-1 h-px bg-neutral-100 dark:bg-neutral-800" />
                            <button
                              onClick={() => { setDraftProject(null); setShowProjectMenu(false); }}
                              className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            >
                              Clear Project
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

        {/* Settings modal */}
        {showSettings && (
          <SettingsPanel onClose={() => setShowSettings(false)} />
        )}

        {/* Image Preview Modal */}
        {previewImage && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm transition-opacity"
            onClick={() => setPreviewImage(null)}
          >
            <div className="relative max-h-full max-w-full">
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute right-4 top-4 rounded-md bg-black/50 p-2 text-white backdrop-blur-md transition-colors hover:bg-black/80 dark:bg-black/80 dark:hover:bg-black"
              >
                <X size={20} />
              </button>
              <img
                src={previewImage}
                alt="Preview"
                className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
