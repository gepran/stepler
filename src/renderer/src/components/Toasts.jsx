import PropTypes from "prop-types";

/** Small, non-blocking confirmations — the app used to fail silently. */
export default function Toasts({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[300] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-fade-in rounded-full px-4 py-2 text-sm font-medium shadow-lg backdrop-blur-md ${
            t.tone === "error"
              ? "bg-red-500/90 text-white"
              : "bg-neutral-900/90 text-white dark:bg-neutral-100/95 dark:text-neutral-900"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

Toasts.propTypes = {
  toasts: PropTypes.array.isRequired,
};
