import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { Bug, CheckCircle2, Loader2, X } from "lucide-react";
import { useT } from "../lib/i18n";

const ipc = window.electron?.ipcRenderer;
const desktopDiagnostics = () => ipc.invoke("report-diagnostics");
const desktopSubmit = (report) =>
  ipc.invoke("report-issue", report).then((result) => {
    if (!result?.success)
      throw new Error(result?.error || "Could not send the report");
    return result;
  });
const FIELD =
  "w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-orange-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100";

export default function IssueReportModal({
  onClose,
  getDiagnostics = desktopDiagnostics,
  onSubmit = desktopSubmit,
}) {
  const t = useT();
  const dialog = useRef(null);
  const [id, setId] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [diagnostics, setDiagnostics] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(getDiagnostics)
      .then((value) => {
        if (active) setDiagnostics(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [getDiagnostics]);

  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.querySelector("input")?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    const keys = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!busy) onClose();
      }
      if (event.key === "Tab") {
        const items = [
          ...dialog.current.querySelectorAll(
            "button:not(:disabled), input:not(:disabled), textarea:not(:disabled)",
          ),
        ];
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keys, true);
    return () => {
      document.removeEventListener("keydown", keys, true);
    };
  }, [onClose, busy]);

  const send = async (event) => {
    event.preventDefault();
    if (busy || title.trim().length < 3 || description.trim().length < 10)
      return;
    setBusy(true);
    setError("");
    try {
      await onSubmit({
        id,
        title: title.trim(),
        description: description.trim(),
        contact: contact.trim(),
        ...(includeDiagnostics && diagnostics ? { diagnostics } : {}),
      });
      setSent(true);
    } catch (failure) {
      setError(failure.message || t("report.failed"));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-x-0 top-0 z-[300] flex h-dvh items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-heading"
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="mb-4 flex items-center gap-2">
          <Bug size={20} className="text-orange-500" />
          <h2
            id="report-heading"
            className="flex-1 text-lg font-semibold dark:text-neutral-100"
          >
            {t("report.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t("common.close")}
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X size={18} />
          </button>
        </div>
        {sent ? (
          <div
            role="status"
            className="space-y-4 py-4 text-center dark:text-neutral-100"
          >
            <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
            <p>{t("report.received")}</p>
            <p className="break-all text-xs text-neutral-500">{id}</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-orange-500 px-5 py-2.5 font-semibold text-white"
            >
              {t("common.close")}
            </button>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-4">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t("report.intro")}
            </p>
            <label className="block space-y-1 text-sm font-medium dark:text-neutral-200">
              <span>{t("report.subject")}</span>
              <input
                aria-label={t("report.subject")}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setId(crypto.randomUUID());
                }}
                required
                minLength={3}
                maxLength={120}
                disabled={busy}
                className={FIELD}
              />
            </label>
            <label className="block space-y-1 text-sm font-medium dark:text-neutral-200">
              <span>{t("report.description")}</span>
              <textarea
                aria-label={t("report.description")}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setId(crypto.randomUUID());
                }}
                placeholder={t("report.descriptionHint")}
                required
                minLength={10}
                maxLength={3000}
                rows={5}
                disabled={busy}
                className={FIELD}
              />
            </label>
            <label className="block space-y-1 text-sm font-medium dark:text-neutral-200">
              <span>{t("report.contact")}</span>
              <input
                aria-label={t("report.contact")}
                value={contact}
                onChange={(e) => {
                  setContact(e.target.value);
                  setId(crypto.randomUUID());
                }}
                maxLength={160}
                disabled={busy}
                className={FIELD}
              />
            </label>
            <label className="flex items-start gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              <input
                type="checkbox"
                checked={includeDiagnostics}
                onChange={(e) => {
                  setIncludeDiagnostics(e.target.checked);
                  setId(crypto.randomUUID());
                }}
                disabled={busy}
                className="mt-0.5 accent-orange-500"
              />
              <span>{t("report.diagnostics")}</span>
            </label>
            {includeDiagnostics && diagnostics && (
              <p className="rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-500 dark:bg-neutral-800">
                {diagnostics.platform} · {diagnostics.version} ·{" "}
                {diagnostics.syncState}
                {diagnostics.syncErrorCode
                  ? ` (${diagnostics.syncErrorCode})`
                  : ""}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-500">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={
                busy ||
                title.trim().length < 3 ||
                description.trim().length < 10
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {t(busy ? "report.sending" : "report.send")}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
IssueReportModal.propTypes = {
  onClose: PropTypes.func.isRequired,
  getDiagnostics: PropTypes.func,
  onSubmit: PropTypes.func,
};
