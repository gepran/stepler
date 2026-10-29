import { useSyncExternalStore } from "react";

/* Whether this window is the one the user is actually working in.
 *
 * Element focus outlives the window's: switching to another app leaves the
 * composer as document.activeElement, so anything gated on element focus alone
 * keeps running while the window sits behind other apps or as a live Stage
 * Manager thumbnail — where the page still counts as visible and nothing
 * throttles it. document.hasFocus() is the window-level answer.
 */
const subscribe = (onChange) => {
  window.addEventListener("focus", onChange);
  window.addEventListener("blur", onChange);
  return () => {
    window.removeEventListener("focus", onChange);
    window.removeEventListener("blur", onChange);
  };
};

const hasFocus = () => document.hasFocus();

export function useWindowFocused() {
  return useSyncExternalStore(subscribe, hasFocus, hasFocus);
}
