import { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { X, SunMedium, Moon, Monitor, Download, Upload } from "lucide-react";

const isMac =
  window.electron?.process?.platform === "darwin" ||
  /Mac/.test(navigator.userAgent);

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

export default function SettingsPanel({ onClose, onExport, onImport }) {
  const [settings, setSettings] = useState({ hotkey: "", theme: "dark" });
  const [recording, setRecording] = useState(false);
  const [tempKey, setTempKey] = useState(null);
  const recorderRef = useRef(null);

  useEffect(() => {
    window.electron?.ipcRenderer.invoke("get-settings").then(setSettings);
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape" && !recording) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose, recording]);

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
            className="btn-tactile rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          >
            <X size={18} className="icon-rubbery" />
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
                className={`btn-tactile flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                  settings.theme === value
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                    : "border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-neutral-300"
                }`}
              >
                <Icon size={16} className="icon-rubbery" />
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
                className="btn-tactile shrink-0 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              >
                Change
              </button>
            </div>
          )}
          <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
            Toggle Stepler from anywhere on your {isMac ? "Mac" : "PC"}.
          </p>
        </div>

        {/* --- Data Management --- */}
        <div className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-800">
          <label className="mb-2.5 block text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            Data Management
          </label>
          <div className="flex gap-2">
            <button
              onClick={onExport}
              className="btn-tactile flex flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-medium text-neutral-600 transition-all hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-800 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            >
              <Download size={16} className="icon-rubbery" />
              Export
            </button>
            <button
              onClick={onImport}
              className="btn-tactile flex flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-medium text-neutral-600 transition-all hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-800 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            >
              <Upload size={16} className="icon-rubbery" />
              Import
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
            Export all tasks to a JSON file or import from a backup.
          </p>
        </div>
      </div>
    </div>
  );
}

SettingsPanel.propTypes = {
  onClose: PropTypes.func.isRequired,
  onExport: PropTypes.func,
  onImport: PropTypes.func,
};
