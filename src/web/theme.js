import { useSyncExternalStore } from "react";

/**
 * Light, dark, or whatever the machine is set to.
 *
 * The desktop app does this through Electron's nativeTheme, which moves
 * `prefers-color-scheme` under the renderer's feet — a browser tab has no such
 * lever, so the choice is written onto the document instead and Tailwind's
 * `dark:` variant is pointed at that attribute (see styles.css).
 *
 * Two values are in play and it is worth keeping them apart: the PREFERENCE,
 * which is one of the three above and is what gets remembered, and the
 * RESOLVED theme, which is only ever light or dark and is what the document
 * carries. "System" is a preference that resolves differently as the machine
 * changes around it.
 */

const STORAGE_KEY = "stepler.theme";
export const THEMES = ["light", "dark", "system"];

const media =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

function stored() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (THEMES.includes(saved)) return saved;
  } catch {
    /* private mode, or storage disabled — follow the machine */
  }
  return "system";
}

let preference = stored();
const listeners = new Set();

const emit = () => {
  for (const fn of listeners) fn();
};

/** What `preference` actually means right now: light or dark, never system. */
export function resolveTheme(pref = preference) {
  if (pref === "light" || pref === "dark") return pref;
  return media?.matches ? "dark" : "light";
}

/**
 * Put the resolved theme on the document.
 *
 * `color-scheme` goes with it so the parts the page does not paint — form
 * controls, scrollbars, the canvas behind a short page — follow the choice
 * rather than staying on whatever the machine prefers.
 */
function apply() {
  const resolved = resolveTheme();
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
}

export function getTheme() {
  return preference;
}

export function setTheme(next) {
  if (!THEMES.includes(next) || next === preference) return;
  preference = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* the choice still holds for this tab */
  }
  apply();
  emit();
}

/**
 * Called once before the first render, so the page is never painted in the
 * wrong theme and then corrected.
 */
export function initTheme() {
  apply();
  // Only matters while the preference is "system", but the listener is cheap
  // and attaching it conditionally would mean re-attaching on every change.
  media?.addEventListener?.("change", () => {
    if (preference === "system") {
      apply();
      emit();
    }
  });
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** The preference, for the control that sets it. */
export function useTheme() {
  return useSyncExternalStore(subscribe, getTheme, getTheme);
}
