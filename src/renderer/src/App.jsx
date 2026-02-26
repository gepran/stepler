import { useState, useEffect, useRef, useCallback } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import Sidebar from "./components/Sidebar";
import ParticleCanvas from "./components/ParticleCanvas";
import SettingsPanel from "./components/SettingsPanel";
import FullScreenSearch from "./components/FullScreenSearch";
import TaskItem from "./components/TaskItem";
import HistoryTaskItem from "./components/HistoryTaskItem";
import TaskInput from "./components/TaskInput";
import ImagePreviewModal from "./components/ImagePreviewModal";
import DeletedTasksPanel from "./components/DeletedTasksPanel";
import LoginPage from "./components/LoginPage";
import { PanelLeft, AlertCircle } from "lucide-react";

const ipc = window.electron?.ipcRenderer;
const isMac =
  window.electron?.process?.platform === "darwin" ||
  /Mac/.test(navigator.userAgent);

async function loadAppData() {
  if (ipc) {
    try {
      return await ipc.invoke("load-app-data");
    } catch {
      /* fall through */
    }
  }
  return {
    tasks: [],
    history: [],
    deletedTasks: [],
    currentDate: null,
    firedReminders: [],
  };
}

function saveAppData(partial) {
  if (ipc) ipc.invoke("save-app-data", partial);
}



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



export default function App() {
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [deletedTasks, setDeletedTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem("stepler-logged-in") === "true");

  const handleLogin = () => {
    localStorage.setItem("stepler-logged-in", "true");
    setIsLoggedIn(true);
  };

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
  const [showDeletedPanel, setShowDeletedPanel] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [deleteTrigger, setDeleteTrigger] = useState(null);

  const [addingSubtaskId, setAddingSubtaskId] = useState(null);
  const [newSubtaskText, setNewSubtaskText] = useState("");
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);
  const [editSubtaskText, setEditSubtaskText] = useState("");
  const [pendingSubtaskAttachment, setPendingSubtaskAttachment] =
    useState(null);

  const [draftProjects, setDraftProjects] = useState([]);
  const [draftDate, setDraftDate] = useState(null);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showDateMenu, setShowDateMenu] = useState(false);
  const [assigningProjectId, setAssigningProjectId] = useState(null);

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

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // --- Load persisted data from disk on mount ---
  useEffect(() => {
    loadAppData().then((data) => {
      const loadedTasks = data.tasks || [];
      const loadedHistory = (data.history || []).map((h) => {
        if (h.date && h.date.includes(",")) {
          const ts = h.tasks?.length ? parseInt(h.tasks[0].id, 10) : NaN;
          const dateObj =
            !isNaN(ts) && ts > 10000000000 ? new Date(ts) : new Date(h.date);
          if (!isNaN(dateObj.getTime())) {
            return {
              ...h,
              date: dateObj.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              }),
            };
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
        if (remaining.length > 0)
          cleanedHistory.push({ ...h, tasks: remaining });
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

      setDeletedTasks(data.deletedTasks || []);
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
  useEffect(() => {
    if (!loaded) return;
    saveAppData({ deletedTasks });
  }, [deletedTasks, loaded]);

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

    const updateHandler = (_, data) => {
      if (data.tasks) setTasks(data.tasks);
      if (data.history) setHistory(data.history);
      if (data.deletedTasks) setDeletedTasks(data.deletedTasks);
    };
    window.electron?.ipcRenderer.on("app-data-updated", updateHandler);

    return () => {
      window.electron?.ipcRenderer.removeAllListeners("open-settings");
      window.electron?.ipcRenderer.removeAllListeners("app-data-updated");
    };
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

      prevTasks.forEach((task) => {
        const ts = parseInt(task.id, 10);
        if (!isNaN(ts) && ts > 10000000000) {
          if (
            new Date(ts).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
            }) !== todayStr &&
            task.completed
          ) {
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

        if (migratedDateStrings.length > 0) {
          const updatedHistory = [...prevHistory];
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

          updatedHistory.sort((a, b) => {
            const getTS = (h) =>
              h.tasks.length > 0 ? parseInt(h.tasks[0].id, 10) : 0;
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

  const addTask = (e, overrideProjects = null) => {
    if (e && e.key === "Enter" && e.shiftKey) return;
    if (
      (!e || e.key === "Enter" || e.type === "click") &&
      (inputValue.trim() !== "" || pendingAttachment)
    ) {
      if (e && e.preventDefault) e.preventDefault();

      const pList =
        overrideProjects !== null
          ? overrideProjects
          : draftProjects.length > 0
            ? draftProjects
            : undefined;

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
          projects: pList?.length > 0 ? pList : undefined,
          dueDate: draftDate,
        },
      ]);
      setInputValue("");
      setPendingAttachment(null);
      setDraftProjects([]);
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

  const deleteTask = (id) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === id);
      if (task) {
        setDeletedTasks((dt) => [{ ...task, deletedAt: Date.now() }, ...dt]);
      }
      return prev.filter((t) => t.id !== id);
    });
  };

  const restoreTask = (id) => {
    setDeletedTasks((prev) => {
      const task = prev.find((t) => t.id === id);
      if (task) {
        const restored = { ...task };
        delete restored.deletedAt;
        setTasks((t) => [...t, restored]);
      }
      return prev.filter((t) => t.id !== id);
    });
  };

  const permanentlyDeleteTask = (id) =>
    setDeletedTasks((prev) => prev.filter((t) => t.id !== id));

  const clearDeletedTasks = () => setDeletedTasks([]);

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
        timestamp: Date.now(),
      });
      setTimeout(() => deleteTask(id), 50);
    } else {
      deleteTask(id);
    }
  };

  const handleSubtaskPaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setPendingSubtaskAttachment({
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

  const addSubtask = (taskId, keepOpen = false) => {
    if (newSubtaskText.trim() === "" && !pendingSubtaskAttachment) {
      if (!keepOpen) {
        setAddingSubtaskId(null);
      }
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
                text:
                  newSubtaskText.trim() ||
                  (pendingSubtaskAttachment &&
                  pendingSubtaskAttachment.type !== "image"
                    ? pendingSubtaskAttachment.name
                    : ""),
                completed: false,
                attachment: pendingSubtaskAttachment || undefined,
              },
            ],
          };
        }
        return t;
      }),
    );
    setNewSubtaskText("");
    setPendingSubtaskAttachment(null);
    if (!keepOpen) {
      setAddingSubtaskId(null);
    }
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
        timestamp: Date.now(),
      });
      setTimeout(() => deleteSubtask(taskId, subtaskId), 50);
    } else {
      deleteSubtask(taskId, subtaskId);
    }
  };

  const handleCopyTask = async (e, task) => {
    e.stopPropagation();
    try {
      let textToCopy = task.text;
      if (task.subtasks && task.subtasks.length > 0) {
        textToCopy +=
          "\n" + task.subtasks.map((st) => `- ${st.text}`).join("\n");
      }

      if (task.attachment && task.attachment.type === "image") {
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = task.attachment.url;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });

          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);

          await new Promise((resolve, reject) => {
            canvas.toBlob(async (blob) => {
              if (!blob) {
                reject(new Error("Canvas to blob failed"));
                return;
              }
              try {
                const clipboardItems = {
                  "text/plain": new Blob([textToCopy], { type: "text/plain" }),
                  "image/png": blob,
                };
                await navigator.clipboard.write([
                  new ClipboardItem(clipboardItems),
                ]);
                resolve();
              } catch (err) {
                reject(err);
              }
            }, "image/png");
          });
          return;
        } catch (imgErr) {
          console.error("Failed to copy image to clipboard", imgErr);
        }
      }

      await navigator.clipboard.writeText(textToCopy);
    } catch (err) {
      console.error("Failed to copy task", err);
    }
  };

  const handleCopyImage = async (e, url) => {
    e.stopPropagation();
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      await new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            reject(new Error("Canvas to blob failed"));
            return;
          }
          try {
            await navigator.clipboard.write([
              new ClipboardItem({
                "image/png": blob,
              }),
            ]);
            resolve();
          } catch (err) {
            reject(err);
          }
        }, "image/png");
      });
    } catch (err) {
      console.error("Failed to copy image", err);
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

  const handleDropAction = (
    e,
    targetType,
    targetId = null,
    position = "child",
  ) => {
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

        const newId =
          Date.now().toString() + "-" + Math.floor(Math.random() * 1000);

        if (targetType === "task") {
          if (sourceType === "task") {
            const targetIndex = newTasks.findIndex((t) => t.id === targetId);
            if (targetIndex !== -1) {
              if (position === "child") {
                newTasks[targetIndex] = {
                  ...newTasks[targetIndex],
                  subtasks: [
                    ...(newTasks[targetIndex].subtasks || []),
                    { ...movedItem, id: newId },
                  ],
                };
              } else if (position === "top") {
                newTasks.splice(targetIndex, 0, {
                  ...movedItem,
                  id: movedItem.id,
                });
              } else if (position === "bottom") {
                newTasks.splice(targetIndex + 1, 0, {
                  ...movedItem,
                  id: movedItem.id,
                });
              }
            }
          } else {
            newTasks = newTasks.map((t) => {
              if (t.id === targetId) {
                return {
                  ...t,
                  subtasks: [
                    ...(t.subtasks || []),
                    { ...movedItem, id: newId },
                  ],
                };
              }
              return t;
            });
          }
        } else if (targetType === "timeline") {
          newTasks.push({
            ...movedItem,
            id: sourceType === "task" ? movedItem.id : newId,
          });
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

  const handleJumpToTask = (taskId, dateLabel) => {
    setShowSearch(false);
    setTimeout(() => {
      const el = document.getElementById(`task-${taskId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-blue-400/50");
        setTimeout(
          () => el.classList.remove("ring-2", "ring-blue-400/50"),
          2000,
        );
      } else if (dateLabel === "Today") {
        todayRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      } else {
        const dayEl = document.getElementById(`day-${dateLabel}`);
        if (dayEl) dayEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 350);
  };

  const handleJumpToTaskSubtask = (taskId) => {
    setShowSearch(false);
    setTimeout(() => {
      const el = document.getElementById(`task-${taskId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-blue-400/50");
        setTimeout(
          () => el.classList.remove("ring-2", "ring-blue-400/50"),
          2000,
        );
      }
      setAddingSubtaskId(taskId);
      setNewSubtaskText("");
    }, 350);
  };

  const handleExportTasks = async () => {
    const payload = { tasks, history, deletedTasks };
    const result = await ipc?.invoke("export-tasks", payload);
    if (result?.success) {
      console.log("Exported to", result.filePath);
    }
  };

  const handleImportTasks = async () => {
    const result = await ipc?.invoke("import-tasks");
    if (!result?.success || !result.data) return;
    const imported = result.data;

    // Merge tasks (deduplicate by id)
    if (Array.isArray(imported.tasks)) {
      setTasks((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const newTasks = imported.tasks.filter((t) => !existingIds.has(t.id));
        return [...prev, ...newTasks];
      });
    }

    // Merge history (merge per date, deduplicate tasks within each date)
    if (Array.isArray(imported.history)) {
      setHistory((prev) => {
        const merged = [...prev];
        imported.history.forEach((importedDay) => {
          const existingIdx = merged.findIndex((h) => h.date === importedDay.date);
          if (existingIdx > -1) {
            const existingIds = new Set(merged[existingIdx].tasks.map((t) => t.id));
            const newTasks = (importedDay.tasks || []).filter((t) => !existingIds.has(t.id));
            merged[existingIdx] = {
              ...merged[existingIdx],
              tasks: [...merged[existingIdx].tasks, ...newTasks],
            };
          } else {
            merged.push(importedDay);
          }
        });
        return merged;
      });
    }

    // Merge deleted tasks (deduplicate by id)
    if (Array.isArray(imported.deletedTasks)) {
      setDeletedTasks((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const newTasks = imported.deletedTasks.filter((t) => !existingIds.has(t.id));
        return [...prev, ...newTasks];
      });
    }
  };

  // ========================= RENDER =========================

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-neutral-50 font-sans text-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
      <ParticleCanvas trigger={deleteTrigger} />
      <FullScreenSearch
        show={showSearch}
        onClose={() => setShowSearch(false)}
        tasks={tasks}
        history={history}
        onJumpToTask={handleJumpToTask}
        onToggleTask={toggleTask}
        onTogglePriority={togglePriority}
        onCopyTask={handleCopyTask}
        onDeleteTask={triggerDeleteTask}
        onAddSubtask={handleJumpToTaskSubtask}
      />
      <Sidebar
        show={showSidebar}
        history={history}
        tasks={tasks}
        onDayClick={handleDayClick}
        onSettingsClick={() => setShowSettings(true)}
        deletedCount={deletedTasks.length}
        onTrashClick={() => setShowDeletedPanel(true)}
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
                    showCompleted
                      ? "bg-blue-500"
                      : "bg-neutral-300 dark:bg-neutral-700"
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
                    {day.tasks.map((task) => (
                      <HistoryTaskItem
                        key={task.id}
                        task={task}
                        formatTaskText={formatTaskText}
                        formatTaskDateTime={formatTaskDateTime}
                        handleCopyImage={handleCopyImage}
                        setPreviewImage={setPreviewImage}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* TODAY */}
              <div
                ref={todayRef}
                className={`relative pb-10 transition-colors ${
                  dragOverId === "timeline"
                    ? "bg-blue-50/50 dark:bg-blue-900/10 rounded-xl"
                    : ""
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
                    sortedTasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        formatTaskText={formatTaskText}
                        formatTaskDateTime={formatTaskDateTime}
                        editingId={editingId}
                        setEditingId={setEditingId}
                        editText={editText}
                        setEditText={setEditText}
                        editCaretPositionRef={editCaretPositionRef}
                        saveEdit={saveEdit}
                        editingSubtaskId={editingSubtaskId}
                        setEditingSubtaskId={setEditingSubtaskId}
                        editSubtaskText={editSubtaskText}
                        setEditSubtaskText={setEditSubtaskText}
                        saveSubtaskEdit={saveSubtaskEdit}
                        addingSubtaskId={addingSubtaskId}
                        setAddingSubtaskId={setAddingSubtaskId}
                        newSubtaskText={newSubtaskText}
                        setNewSubtaskText={setNewSubtaskText}
                        addSubtask={addSubtask}
                        handleSubtaskPaste={handleSubtaskPaste}
                        pendingSubtaskAttachment={pendingSubtaskAttachment}
                        setPendingSubtaskAttachment={setPendingSubtaskAttachment}
                        assigningProjectId={assigningProjectId}
                        setAssigningProjectId={setAssigningProjectId}
                        setTasks={setTasks}
                        settingReminderId={settingReminderId}
                        setSettingReminderId={setSettingReminderId}
                        reminderTime={reminderTime}
                        setReminderTime={setReminderTime}
                        saveReminder={saveReminder}
                        toggleTask={toggleTask}
                        togglePriority={togglePriority}
                        toggleSubtask={toggleSubtask}
                        removeAttachment={removeAttachment}
                        triggerDeleteTask={triggerDeleteTask}
                        triggerDeleteSubtask={triggerDeleteSubtask}
                        handleCopyTask={handleCopyTask}
                        handleCopyImage={handleCopyImage}
                        setPreviewImage={setPreviewImage}
                        dragOverId={dragOverId}
                        dragOverPosition={dragOverPosition}
                        activeDragHandleId={activeDragHandleId}
                        setActiveDragHandleId={setActiveDragHandleId}
                        handleDragStart={handleDragStart}
                        handleDragEnd={handleDragEnd}
                        handleDragOverTask={handleDragOverTask}
                        handleDragLeaveTask={handleDragLeaveTask}
                        handleDropOnTask={handleDropOnTask}
                        handleDropAction={handleDropAction}
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="h-[40vh]" />
              <div ref={tasksEndRef} className="h-1" />
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <TaskInput
          inputValue={inputValue}
          setInputValue={setInputValue}
          inputRef={inputRef}
          addTask={addTask}
          handlePaste={handlePaste}
          handleFileChange={handleFileChange}
          handleCopyImage={handleCopyImage}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
          pendingAttachment={pendingAttachment}
          setPendingAttachment={setPendingAttachment}
          draftProjects={draftProjects}
          setDraftProjects={setDraftProjects}
          draftDate={draftDate}
          setDraftDate={setDraftDate}
          showDateMenu={showDateMenu}
          setShowDateMenu={setShowDateMenu}
          showProjectMenu={showProjectMenu}
          setShowProjectMenu={setShowProjectMenu}
          setShowSettings={setShowSettings}
        />

        {/* Settings modal */}
        {showSettings && (
          <SettingsPanel
            onClose={() => setShowSettings(false)}
            onExport={handleExportTasks}
            onImport={handleImportTasks}
          />
        )}

        {/* Deleted Tasks Panel */}
        {showDeletedPanel && (
          <DeletedTasksPanel
            deletedTasks={deletedTasks}
            onClose={() => setShowDeletedPanel(false)}
            onRestore={restoreTask}
            onPermanentDelete={permanentlyDeleteTask}
            onClearAll={clearDeletedTasks}
            formatTaskText={formatTaskText}
          />
        )}

        {/* Image Preview Modal */}
        <ImagePreviewModal
          previewImage={previewImage}
          setPreviewImage={setPreviewImage}
          handleCopyImage={handleCopyImage}
        />
      </div>
    </div>
  );
}
