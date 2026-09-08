import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/prism-light";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import { formatDate, translate } from "./i18n";

// Only the languages worth shipping — the full Prism build added ~1.5 MB to
// the bundle and delayed first paint.
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("typescript", typescript);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("java", java);
SyntaxHighlighter.registerLanguage("sql", sql);
SyntaxHighlighter.registerLanguage("css", css);
SyntaxHighlighter.registerLanguage("html", markup);
SyntaxHighlighter.registerLanguage("markup", markup);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("json", json);

// --------------------------- date helpers ---------------------------

export function localYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ymdToDate(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** "21 Feb", or "21 Feb 2025" once the year is no longer the current one. */
export function labelForYMD(ymd) {
  const date = ymdToDate(ymd);
  if (isNaN(date.getTime())) return String(ymd);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return formatDate(date, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Friendly label for a stored due date (ISO, or a legacy "Today" string). */
export function dueDateLabel(value) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value; // legacy label, show as-is
  const today = localYMD(new Date());
  if (value === today) return translate("app.today");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (value === localYMD(tomorrow)) return translate("app.tomorrow");
  return labelForYMD(value);
}

export function taskTimestamp(id) {
  const num = parseInt(id, 10);
  if (isNaN(num) || num < 10000000000) return null;
  const date = new Date(num);
  return isNaN(date.getTime()) ? null : date;
}

/** Hover stamp for a task: time always, plus the date when it is not today. */
export function formatTaskDateTime(id) {
  const date = taskTimestamp(id);
  if (!date) return null;
  const isToday = localYMD(date) === localYMD(new Date());
  return {
    isToday,
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
    full: `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${date.toLocaleTimeString(
      "en-US",
      { hour: "numeric", minute: "2-digit" },
    )}`,
  };
}

// --------------------------- text rendering ---------------------------

/**
 * Only wrap a note in a code block when it really looks like pasted code:
 * several lines plus a strong syntax signal. The old heuristic fired on any
 * note containing "const x =" or a `.foo { }` shape and swallowed prose.
 */
function detectLanguage(text) {
  if (text.includes("```")) return null;
  const lines = text.split("\n");
  if (lines.length < 3) return null;
  if (
    /<(html|div|span|script|style|body|head|table|ul|form)\b[^>]*>[\s\S]*<\/\1>/i.test(
      text,
    )
  )
    return "html";
  if (
    /\b(public\s+class|public\s+static\s+void|System\.out\.println|import\s+java\.)/.test(
      text,
    )
  )
    return "java";
  if (
    /(^|\n)\s*(function\s+\w+\s*\(|const\s+\w+\s*=\s*\(?.*=>|export\s+(default|const|function))/.test(
      text,
    )
  )
    return "javascript";
  if (/(^|\n)\s*def\s+\w+\s*\([^)]*\)\s*:/.test(text)) return "python";
  if (
    /\b(SELECT\s+[\s\S]+\s+FROM|INSERT\s+INTO|UPDATE\s+[\s\S]+\s+SET|DELETE\s+FROM)\b/i.test(
      text,
    )
  )
    return "sql";
  if (/(^|\n)\s*[.#][\w-]+\s*\{[\s\S]*\}/.test(text)) return "css";
  return null;
}

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

function renderPlain(text, keyPrefix) {
  const out = [];
  const segments = text.split(URL_RE);
  segments.forEach((segment, i) => {
    if (!segment) return;
    if (i % 2 === 1) {
      out.push(
        <a
          key={`${keyPrefix}-u${i}`}
          href={segment}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline decoration-blue-500/30 underline-offset-4 hover:decoration-blue-500 dark:text-blue-400"
          onClick={(e) => e.stopPropagation()}
        >
          {segment}
        </a>,
      );
    } else {
      out.push(<span key={`${keyPrefix}-t${i}`}>{segment}</span>);
    }
  });
  return out;
}

function renderInline(text, keyPrefix) {
  // `code` spans, then URLs inside the remaining prose.
  return text.split(/`([^`\n]+)`/g).flatMap((part, i) => {
    if (!part) return [];
    if (i % 2 === 1) {
      return [
        <code
          key={`${keyPrefix}-c${i}`}
          className="rounded bg-neutral-200/80 px-1.5 py-0.5 font-mono text-[13px] font-medium text-neutral-800 dark:bg-neutral-800/80 dark:text-neutral-200"
        >
          {part}
        </code>,
      ];
    }
    return renderPlain(part, `${keyPrefix}-${i}`);
  });
}

function build(text) {
  let source = text;
  const detected = detectLanguage(source);
  if (detected) source = `\`\`\`${detected}\n${source}\n\`\`\``;

  const blockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
  const nodes = [];
  let lastIndex = 0;
  let match;
  let n = 0;
  while ((match = blockRegex.exec(source)) !== null) {
    if (match.index > lastIndex)
      nodes.push(
        ...renderInline(source.slice(lastIndex, match.index), `p${n++}`),
      );
    const lang = (match[1] || "").toLowerCase();
    nodes.push(
      <div
        key={`b${n++}`}
        className="my-3 overflow-hidden rounded-lg border border-neutral-200 bg-[#1e1e1e] shadow-sm dark:border-neutral-800"
        onClick={(e) => e.stopPropagation()}
      >
        {lang && (
          <div className="flex select-none items-center justify-between border-b border-neutral-800 bg-neutral-900/80 px-3 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              {lang}
            </span>
          </div>
        )}
        <SyntaxHighlighter
          language={lang || "javascript"}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: "1rem",
            fontSize: "13px",
            lineHeight: "1.6",
            borderRadius: 0,
            backgroundColor: "transparent",
          }}
        >
          {match[2].trim()}
        </SyntaxHighlighter>
      </div>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < source.length)
    nodes.push(...renderInline(source.slice(lastIndex), `p${n++}`));
  return nodes;
}

// Rendering the same note text over and over was a measurable cost with a few
// hundred rows on screen, and the result is immutable, so cache it.
const cache = new Map();
const CACHE_LIMIT = 800;

export function formatTaskText(text) {
  if (!text) return text;
  const hit = cache.get(text);
  if (hit) return hit;
  const built = build(text);
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(text, built);
  return built;
}
