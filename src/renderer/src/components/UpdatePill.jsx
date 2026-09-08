import PropTypes from "prop-types";
import { ArrowUpCircle, Loader2 } from "lucide-react";

/**
 * The header's update affordance. Stays out of the way until there is
 * genuinely something to install, then offers one click to restart into it.
 */
export default function UpdatePill({ state, onInstall, onOpenReleases }) {
  const status = state?.status;
  const failed = status === "error" && state.version;
  if (status !== "downloading" && status !== "ready" && !failed) return null;

  // An unsigned build cannot install its own update on macOS. Rather than a
  // button that does nothing, point at the download.
  if (failed)
    return (
      <button
        onClick={onOpenReleases}
        style={{ WebkitAppRegion: "no-drag" }}
        title={`Stepler could not replace itself (${state.error || "unknown error"}). This puts the downloaded build in your Downloads folder.`}
        className="flex items-center gap-1.5 rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-semibold text-white transition-colors hover:bg-amber-600"
      >
        <ArrowUpCircle size={12} />
        <span>Install {state.version}</span>
      </button>
    );

  const downloading = status === "downloading";
  const percent = typeof state.percent === "number" ? state.percent : null;

  return (
    <button
      onClick={downloading ? undefined : onInstall}
      disabled={downloading}
      style={{ WebkitAppRegion: "no-drag" }}
      title={
        downloading
          ? "Downloading the new version"
          : `Restart to update to ${state.version || "the new version"}`
      }
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
        downloading
          ? "cursor-default bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
          : "bg-blue-500 text-white hover:bg-blue-600"
      }`}
    >
      {downloading ? (
        <>
          <Loader2 size={12} className="animate-spin" />
          <span>{percent === null ? "Updating…" : `${percent}%`}</span>
        </>
      ) : (
        <>
          <ArrowUpCircle size={12} />
          <span>Update{state.version ? ` to ${state.version}` : ""}</span>
        </>
      )}
    </button>
  );
}

UpdatePill.propTypes = {
  state: PropTypes.object,
  onInstall: PropTypes.func.isRequired,
  onOpenReleases: PropTypes.func.isRequired,
};
