import { useState, useMemo } from "react";
import PropTypes from "prop-types";
import { ChevronRight, Search } from "lucide-react";
import { useT } from "../lib/i18n";

const isMac =
  window.electron?.process?.platform === "darwin" ||
  /Mac/.test(navigator.userAgent);

const mod = isMac ? "⌘" : "Ctrl";
const hotkey = isMac ? "⇧ ⌘ Space" : "Ctrl ⇧ Space";

/**
 * Written for someone who just wants to use the thing. Every entry says what
 * it is in one line, then the steps, and nothing about how it works inside.
 * The wording lives in the translation files; only the running order is here.
 */
const LAYOUT = [
  { id: "start", items: ["write", "tick", "around"] },
  { id: "open", items: ["shortcut", ...(isMac ? ["selection"] : [])] },
  { id: "details", items: ["day", "notification", "important"] },
  { id: "organise", items: ["projects", "subtasks", "files", "search"] },
  { id: "safety", items: ["trash", "past", "data"] },
  { id: "connect", items: [...(isMac ? ["reminders"] : []), "gcal", "jira"] },
  { id: "power", items: ["cli", "updates"] },
];

function Section({ section, query }) {
  const [open, setOpen] = useState(null);
  const q = query.trim().toLowerCase();

  const items = q
    ? section.items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.steps.some((s) => s.toLowerCase().includes(q)),
      )
    : section.items;
  if (!items.length) return null;

  return (
    <section className="mb-8">
      <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-100">
        {section.title}
      </h3>
      <p className="mb-3 text-sm text-neutral-500">{section.blurb}</p>

      <div className="overflow-hidden rounded-2xl border border-neutral-100 dark:border-neutral-800">
        {items.map((item, idx) => {
          const isOpen = q ? true : open === item.title;
          return (
            <div
              key={item.title}
              className={
                idx > 0
                  ? "border-t border-neutral-100 dark:border-neutral-800"
                  : ""
              }
            >
              <button
                onClick={() => setOpen(isOpen && !q ? null : item.title)}
                className="flex w-full items-center gap-2 bg-neutral-50/50 px-5 py-3.5 text-left transition-colors hover:bg-neutral-100 dark:bg-neutral-800/30 dark:hover:bg-neutral-800/60"
              >
                <ChevronRight
                  size={15}
                  className={`shrink-0 text-neutral-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                />
                <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                  {item.title}
                </span>
              </button>

              {isOpen && (
                <ol className="space-y-2 bg-white px-5 pb-4 pt-1 dark:bg-transparent">
                  {item.steps.map((step, i) => (
                    <li
                      key={i}
                      className="flex gap-3 text-sm text-neutral-600 dark:text-neutral-400"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-bold text-neutral-500 dark:bg-neutral-800">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

Section.propTypes = {
  section: PropTypes.object.isRequired,
  query: PropTypes.string.isRequired,
};

export default function GuideTab() {
  const t = useT();
  const [query, setQuery] = useState("");

  const sections = useMemo(
    () =>
      LAYOUT.map(({ id, items }) => ({
        id,
        title: t(`guide.${id}.title`),
        blurb: t(`guide.${id}.blurb`),
        items: items.map((key) => ({
          title: t(`guide.${id}.${key}.title`),
          steps: t(`guide.${id}.${key}.steps`, { mod, hotkey }),
        })),
      })),
    [t],
  );

  const anyMatch = sections.some((s) =>
    s.items.some(
      (i) =>
        !query.trim() ||
        i.title.toLowerCase().includes(query.trim().toLowerCase()) ||
        i.steps.some((st) =>
          st.toLowerCase().includes(query.trim().toLowerCase()),
        ),
    ),
  );

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-neutral-800 dark:text-neutral-100">
        {t("guide.heading")}
      </h2>
      <p className="mb-6 text-sm text-neutral-500">{t("guide.intro")}</p>

      <div className="mb-8 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">
        <Search size={15} className="shrink-0 text-neutral-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("guide.searchPlaceholder")}
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      {sections.map((s) => (
        <Section key={s.id} section={s} query={query} />
      ))}

      {!anyMatch && (
        <p className="text-sm text-neutral-500">
          {t("guide.noMatch", { query })}
        </p>
      )}
    </div>
  );
}
