import { useSyncExternalStore } from "react";
import { translations } from "./translations";

/**
 * `short` is what the web app's round language button shows. It is deliberately
 * neither the language code nor a slice of the locale: Georgian is `ka`, but
 * the two letters people recognise at badge size are GE — and taking the region
 * off the locale would have printed GB for English.
 */
export const LANGUAGES = [
  {
    code: "en",
    label: "English",
    native: "English",
    locale: "en-GB",
    short: "EN",
  },
  {
    code: "ka",
    label: "Georgian",
    native: "ქართული",
    locale: "ka-GE",
    short: "GE",
  },
  {
    code: "ru",
    label: "Russian",
    native: "Русский",
    locale: "ru-RU",
    short: "RU",
  },
];

const CODES = LANGUAGES.map((l) => l.code);
const STORAGE_KEY = "stepler.language";

/**
 * Settings arrive over IPC one tick after the first paint, so the very first
 * render would always be English. Mirroring the choice into localStorage lets
 * the module pick the right language up front and skip that flash.
 */
function initialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && CODES.includes(saved)) return saved;
  } catch {
    /* private mode, or storage disabled — fall through to the default */
  }
  const nav = String(navigator.language || "").toLowerCase();
  return CODES.find((c) => nav.startsWith(c)) || "en";
}

let current = initialLanguage();
const listeners = new Set();

function emit() {
  for (const fn of listeners) fn();
}

export function getLanguage() {
  return current;
}

export function setLanguage(code) {
  if (!CODES.includes(code) || code === current) return;
  current = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* nothing to do — the setting still lives in the settings file */
  }
  document.documentElement.lang = code;
  emit();
}

/** BCP-47 tag for Intl, so dates and numbers follow the chosen language. */
export function currentLocale() {
  return (LANGUAGES.find((l) => l.code === current) || LANGUAGES[0]).locale;
}

function lookup(key, lang) {
  return key.split(".").reduce((acc, part) => acc?.[part], translations[lang]);
}

/**
 * Missing keys fall back to English rather than rendering blank, so a partial
 * translation degrades to a readable UI instead of an empty one.
 */
export function translate(key, vars) {
  let value = lookup(key, current);
  if (value === undefined && current !== "en") value = lookup(key, "en");
  if (value === undefined) return key;
  if (!vars) return value;
  if (Array.isArray(value)) return value.map((v) => fill(v, vars));
  return fill(value, vars);
}

function fill(value, vars) {
  if (typeof value !== "string") return value;
  return value.replace(/\{(\w+)\}/g, (m, name) =>
    name in vars ? String(vars[name]) : m,
  );
}

/**
 * Electron's bundled ICU has no Georgian date data — Intl.DateTimeFormat
 * quietly resolves "ka-GE" to en-US — so a language may ship its own month
 * and weekday tables and get formatted here instead of by Intl.
 */
export function formatDate(date, opts = {}) {
  const cal = translations[current]?.dates;
  if (!cal) return date.toLocaleDateString(currentLocale(), opts);

  const parts = [];
  if (opts.weekday)
    parts.push(
      (opts.weekday === "short" ? cal.weekdaysShort : cal.weekdays)[
        date.getDay()
      ],
    );

  const month = opts.month
    ? (opts.month === "short" ? cal.monthsShort : cal.months)[date.getMonth()]
    : null;
  // Georgian writes the day before the month.
  const dayMonth = [opts.day ? String(date.getDate()) : null, month]
    .filter(Boolean)
    .join(" ");
  if (dayMonth) parts.push(dayMonth);
  if (opts.year) parts.push(String(date.getFullYear()));

  return parts.join(", ");
}

/**
 * Russian has three plural forms where English has two, so the count decides
 * which key to read rather than the call site pasting an "s" on the end.
 */
export function translatePlural(key, count, vars) {
  let form = "other";
  try {
    form = new Intl.PluralRules(currentLocale()).select(count);
  } catch {
    form = count === 1 ? "one" : "other";
  }
  const args = { count, ...vars };
  const picked = translate(`${key}.${form}`, args);
  return picked === `${key}.${form}` ? translate(`${key}.other`, args) : picked;
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/**
 * `t` is stable, so the store snapshot is the language code itself — that is
 * what actually changes and what should re-render the tree.
 */
export function useT() {
  useSyncExternalStore(subscribe, getLanguage, getLanguage);
  return translate;
}

export function useLanguage() {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage);
}
