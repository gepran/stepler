import { useState, useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import SteplerLogo from "./components/SteplerLogo";
import Sidebar from "./components/Sidebar";
import {
  Circle,
  CheckCircle2,
  Plus,
  X,
  FileText,
  Eye,
  EyeOff,
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
  const [settingReminderId, setSettingReminderId] = useState(null);
  const [reminderTime, setReminderTime] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const todayRef = useRef(null);
  const tasksEndRef = useRef(null);
  const firedRef = useRef(new Set());

  // --- Load persisted data from disk on mount ---
  useEffect(() => {
    loadAppData().then((data) => {
      if (data.tasks?.length) setTasks(data.tasks);
      if (data.history?.length) setHistory(data.history);
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

  // --- Handlers ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPendingAttachment({
      url: URL.createObjectURL(file),
      name: file.name,
      type: file.type.startsWith("image/") ? "image" : "file",
    });
    e.target.value = null;
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          setPendingAttachment({
            url: URL.createObjectURL(file),
            name: `pasted-image-${Date.now()}.png`,
            type: "image",
          });
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
          id: Date.now().toString(),
          text:
            inputValue.trim() ||
            (pendingAttachment && pendingAttachment.type !== "image"
              ? pendingAttachment.name
              : ""),
          completed: false,
          priority: false,
          attachment: pendingAttachment || undefined,
        },
      ]);
      setInputValue("");
      setPendingAttachment(null);
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

  const sortedTasks = [...tasks]
    .filter((t) => (showCompleted ? true : !t.completed))
    .sort((a, b) => {
      if (a.completed === b.completed) {
        if (a.priority === b.priority) return 0;
        return a.priority ? -1 : 1;
      }
      return a.completed ? -1 : 1;
    });

  // ========================= RENDER =========================

  return (
    <div className="flex h-screen w-full overflow-hidden bg-neutral-50 font-sans text-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
      <Sidebar show={showSidebar} history={history} tasks={tasks} />
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
                className="mr-3 rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300 pointer-events-auto"
                style={{ WebkitAppRegion: "no-drag" }}
                title="Toggle Sidebar"
              >
                <PanelLeft size={18} />
              </button>
              <SteplerLogo size={22} className="mr-2.5" />
              <span className="text-base font-semibold tracking-wide">
                Stepler
              </span>
            </div>
            <div
              style={{ WebkitAppRegion: "no-drag" }}
              className="flex items-center gap-3"
            >
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center text-xs text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
              >
                {showCompleted ? (
                  <EyeOff size={14} className="mr-1.5" />
                ) : (
                  <Eye size={14} className="mr-1.5" />
                )}
                {showCompleted ? "Hide Completed" : "Show Completed"}
              </button>
              <div className="border-l border-neutral-300 pl-3 text-sm font-medium text-neutral-400 dark:border-neutral-700 dark:text-neutral-500">
                {tasks.filter((t) => t.completed).length} / {tasks.length} Today
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="ml-1 rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                title={`Settings (${isMac ? "⌘," : "Ctrl+,"})`}
              >
                <Settings size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="custom-scrollbar relative flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-5 md:px-8">
            <div className="h-5 w-full shrink-0 md:h-8" />
            <div className="relative pl-2">
              {/* HISTORY */}
              {[...history].reverse().map((day, idx) => (
                <div
                  key={idx}
                  className="group relative mb-10 pl-8 opacity-60 transition-opacity duration-300 hover:opacity-100"
                >
                  <div className="absolute left-[7px] top-[14px] -bottom-[40px] z-0 w-[2px] bg-neutral-200 dark:bg-neutral-800" />
                  <div className="absolute left-[4px] top-[6px] z-10 h-2 w-2 rounded-full bg-neutral-400 ring-[5px] ring-neutral-50 transition-colors group-hover:bg-neutral-500 dark:bg-neutral-600 dark:ring-neutral-950" />
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
                      {day.date}
                    </h3>
                  </div>
                  <div className="space-y-0.5">
                    {day.tasks.map((task) => {
                      const dt = formatTaskDateTime(task.id);
                      return (
                        <div
                          key={task.id}
                          className="group/task relative -ml-1.5 flex items-start p-1.5"
                        >
                          {dt && (
                            <div className="absolute right-full top-1 mr-2 mt-0.5 flex w-16 flex-col items-end justify-center opacity-0 transition-opacity duration-200 group-hover/task:opacity-100 pointer-events-none z-10">
                              <span className="mb-0.5 whitespace-nowrap text-[10px] font-medium leading-[1.1] tracking-wide text-neutral-400 dark:text-neutral-500">
                                {dt.date}
                              </span>
                              <span className="whitespace-nowrap text-[10px] font-medium leading-[1.1] tracking-wide text-neutral-400 dark:text-neutral-500">
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
                            {task.reminder && (
                              <div className="mt-1 flex items-center text-[11px] text-neutral-400 dark:text-neutral-600">
                                <Bell size={10} className="mr-1" />
                                <span className="line-through">
                                  {task.reminder}
                                </span>
                              </div>
                            )}
                            {task.attachment && (
                              <div className="mt-2 mb-1 opacity-70">
                                {task.attachment.type === "image" ? (
                                  <div className="relative group/attachment inline-block">
                                    <img
                                      src={task.attachment.url}
                                      alt=""
                                      onClick={() =>
                                        setPreviewImage(task.attachment.url)
                                      }
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
                                    <FileText
                                      size={12}
                                      className="mr-2 shrink-0"
                                    />
                                    <span className="max-w-[150px] truncate">
                                      {task.attachment.name}
                                    </span>
                                  </div>
                                )}
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
              <div ref={todayRef} className="relative pb-[40vh]">
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

                <div className="space-y-0.5 pl-8">
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
                          className={`group relative -ml-2 flex items-start rounded-lg p-2 transition-all ${
                            task.completed
                              ? "opacity-40 hover:opacity-70"
                              : "hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40"
                          }`}
                        >
                          {dt && (
                            <div className="absolute right-full top-1 mr-2 mt-1.5 flex w-16 flex-col items-end justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none z-10">
                              <span className="mb-0.5 whitespace-nowrap text-[10px] font-medium leading-[1.1] tracking-wide text-neutral-400 dark:text-neutral-500">
                                {dt.date}
                              </span>
                              <span className="whitespace-nowrap text-[10px] font-medium leading-[1.1] tracking-wide text-neutral-400 dark:text-neutral-500">
                                {dt.time}
                              </span>
                            </div>
                          )}
                          <button
                            onClick={() => toggleTask(task.id)}
                            className="mt-0.5 mr-3 shrink-0 text-neutral-400 transition-colors hover:text-blue-500 focus:outline-none dark:text-neutral-500 dark:hover:text-blue-400"
                          >
                            {task.completed ? (
                              <CheckCircle2
                                size={18}
                                className="text-blue-500"
                              />
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
                                    setEditingId(task.id);
                                    setEditText(task.text);
                                  }
                                }}
                                className={`block w-full cursor-text whitespace-pre-wrap pt-0.5 text-[15px] leading-relaxed ${
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
                                  onChange={(e) =>
                                    setReminderTime(e.target.value)
                                  }
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
                                      onClick={() =>
                                        setPreviewImage(task.attachment.url)
                                      }
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
                                    <FileText
                                      size={14}
                                      className="mr-2 shrink-0"
                                    />
                                    <span className="max-w-[200px] truncate">
                                      {task.attachment.name}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="ml-2 flex shrink-0 items-center space-x-1 opacity-0 transition-all group-hover:opacity-100">
                            <button
                              onClick={() => {
                                setSettingReminderId(task.id);
                                setReminderTime(task.reminder || "");
                              }}
                              className="rounded p-1 text-neutral-400 transition-all hover:text-neutral-900 focus:outline-none dark:text-neutral-600 dark:hover:text-neutral-100"
                              title="Set Reminder"
                            >
                              <Bell size={14} />
                            </button>
                            <button
                              onClick={() => togglePriority(task.id)}
                              className={`rounded p-1 transition-all focus:outline-none ${
                                task.priority
                                  ? "text-neutral-900 hover:text-black dark:text-neutral-100 dark:hover:text-white"
                                  : "text-neutral-400 hover:text-neutral-900 dark:text-neutral-600 dark:hover:text-neutral-100"
                              }`}
                              title="Toggle Priority"
                            >
                              <Star
                                size={14}
                                fill={task.priority ? "currentColor" : "none"}
                              />
                            </button>
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="rounded p-1 text-neutral-400 transition-all hover:text-neutral-900 focus:outline-none dark:text-neutral-600 dark:hover:text-neutral-100"
                              title="Delete Task"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={tasksEndRef} className="h-1" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          className={`z-40 flex shrink-0 justify-center transition-all duration-300 ${
            isExpanded
              ? "fixed inset-0 bg-neutral-950 p-6 md:p-12 z-[100]"
              : "border-t border-neutral-200 bg-neutral-100/90 p-4 backdrop-blur-md md:p-6 dark:border-neutral-800 dark:bg-neutral-900/90"
          }`}
        >
          <div
            className={`w-full max-w-3xl flex flex-col ${isExpanded ? "h-full justify-center max-w-4xl mx-auto" : ""}`}
          >
            <div className="mb-4">
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
                className={`relative flex rounded-[24px] bg-white shadow-sm border border-neutral-200 transition-all duration-300 dark:border-neutral-700 dark:bg-[#1e1e1e] ${
                  isExpanded
                    ? "flex-col h-[60vh] md:h-[70vh]"
                    : "flex-row items-end min-h-[48px]"
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
                  placeholder=" "
                  className={`flex-1 resize-none bg-transparent text-[16px] leading-relaxed text-neutral-800 placeholder-neutral-400 focus:outline-none dark:text-neutral-200 dark:placeholder-neutral-500 ${
                    isExpanded
                      ? "w-full px-5 pr-12 mt-4 py-6 h-full"
                      : "w-full pl-5 pr-2 py-3"
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
                  className={`flex items-center transition-all ${
                    isExpanded
                      ? "justify-between mt-auto p-3 w-full border-t border-transparent"
                      : "pr-12 pb-2 shrink-0 gap-2"
                  }`}
                >
                  <div
                    className={`flex items-center ${isExpanded ? "gap-1" : "gap-0.5"}`}
                  >
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={addTask}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
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
