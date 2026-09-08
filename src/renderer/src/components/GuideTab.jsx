import { useState } from "react";
import PropTypes from "prop-types";
import { ChevronRight, Search } from "lucide-react";

const isMac =
  window.electron?.process?.platform === "darwin" ||
  /Mac/.test(navigator.userAgent);

const mod = isMac ? "⌘" : "Ctrl";
const hotkey = isMac ? "⇧ ⌘ Space" : "Ctrl ⇧ Space";

/**
 * Written for someone who just wants to use the thing. Every entry says what
 * it is in one line, then the steps, and nothing about how it works inside.
 */
const SECTIONS = [
  {
    id: "start",
    title: "Getting started",
    blurb: "The whole app in three moves.",
    items: [
      {
        title: "Write something down",
        steps: [
          "Click the box at the bottom, or press ⌘N.",
          "Type the thing. Press Enter.",
          "It appears in today's list, above the box.",
        ],
      },
      {
        title: "Tick it off",
        steps: [
          "Click the circle to the left of a task.",
          "It stays on the day, crossed out, so you can see what the day held.",
          "Changed your mind? Click the circle again.",
        ],
      },
      {
        title: "Find your way around",
        steps: [
          "Today sits at the bottom, next to the box you type in.",
          "Scroll up to walk back through previous days.",
          "The counter at the top right says how much of today is done.",
        ],
      },
    ],
  },
  {
    id: "open",
    title: "Opening Stepler from anywhere",
    blurb: "You should never have to go looking for it.",
    items: [
      {
        title: "The shortcut",
        steps: [
          `Press ${hotkey} in any app and Stepler comes forward.`,
          "Press it again, or press Esc, and it goes away.",
          "You can change the combination in Settings → General.",
        ],
      },
      ...(isMac
        ? [
            {
              title: "Bring the selection with you",
              steps: [
                "Select some text anywhere — an email, a page, a chat.",
                `Press ${hotkey}.`,
                "The text is already in the box, waiting. Add to it or press Enter.",
                "Your clipboard is left exactly as you had it.",
                "Turn this off in Settings → General if you would rather it did not.",
              ],
            },
          ]
        : []),
    ],
  },
  {
    id: "details",
    title: "Dates, times and reminders",
    blurb: "For the things that have to happen at a particular moment.",
    items: [
      {
        title: "Give a task a day",
        steps: [
          "Before pressing Enter, click one of the days under the box.",
          "The task carries that day as a small blue tag.",
          "The day has to be chosen while writing it — it cannot be added later.",
        ],
      },
      {
        title: "Get a notification",
        steps: [
          "Hover over a task and click the bell.",
          "Pick a time and confirm.",
          "At that time your computer shows a notification with the task in it.",
          "Stepler has to be running for the notification to arrive.",
        ],
      },
      {
        title: "Mark something important",
        steps: [
          "Hover over a task and click the star.",
          "Starred tasks move to the bottom of the day, where you look last.",
        ],
      },
    ],
  },
  {
    id: "organise",
    title: "Keeping it organised",
    blurb: "Only as much structure as you actually want.",
    items: [
      {
        title: "Projects",
        steps: [
          "While writing, click a project name under the box, or type a new one next to “New…”.",
          "Click a project in the left sidebar to see only its tasks.",
          "Rename or remove projects in Settings → Projects.",
        ],
      },
      {
        title: "Subtasks",
        steps: [
          "Hover over a task and click Subtask.",
          "Type the smaller step and press Enter.",
          "Subtasks tick off on their own and sit under their parent.",
        ],
      },
      {
        title: "Files and images",
        steps: [
          "Paste an image straight into the box, or click + to pick a file.",
          "Click the attachment on a task to open a preview.",
          "Files are kept as real files — you can copy them out or save them anywhere.",
        ],
      },
      {
        title: "Search",
        steps: [
          `Press ${mod}F.`,
          "Type anything: task text, a subtask, a project, even a file name.",
          "Move with the arrow keys, press Enter to jump to it in the timeline.",
        ],
      },
    ],
  },
  {
    id: "safety",
    title: "Nothing gets lost",
    blurb: "What happens to things you finish or delete.",
    items: [
      {
        title: "Trash",
        steps: [
          "Deleted a task by mistake? Click the bin in the sidebar.",
          "Find it and put it back.",
          "The last 500 deleted tasks are kept.",
        ],
      },
      {
        title: "Past days",
        steps: [
          "Scroll up past today to read any previous day.",
          "Something still relevant? Drag it down onto today to carry it over.",
        ],
      },
      {
        title: "Your data",
        steps: [
          "Everything lives in a folder on this computer and nowhere else.",
          "Settings → Data exports the lot as one file, attachments included.",
          "That same file imports back, on this machine or another one.",
          "A backup copy is kept automatically every time Stepler starts cleanly.",
        ],
      },
    ],
  },
  {
    id: "connect",
    title: "Connecting other apps",
    blurb: "All optional, all off until you switch them on.",
    items: [
      ...(isMac
        ? [
            {
              title: "Apple Reminders",
              steps: [
                "Settings → Integrations → turn on Apple Reminders.",
                "From then on, a task you give a day or a time also appears in Reminders.",
                "They land in a list called Stepler, so your own lists stay as they were.",
                "Ticking it off in Stepler ticks it off in Reminders too.",
                "Only tasks made after you switch it on are mirrored.",
              ],
            },
          ]
        : []),
      {
        title: "Google Calendar",
        steps: [
          "Settings → Integrations → Google Calendar → Connect.",
          "Sign in and, on Google's screen, tick the calendar permission — this is easy to miss, and without it nothing will sync.",
          "After that, a task with a day also becomes an event.",
          "Needs your own Google credentials; the Setup guide button explains where they go.",
        ],
      },
      {
        title: "Jira",
        steps: [
          "Settings → Integrations → Jira.",
          "Click Create a token, make one on Atlassian's page, and copy it.",
          "Fill in your site address, your account email and the token, then Connect.",
          "While writing a task you can now pick a Jira project, and a sprint if the project has one.",
          "The task becomes a Jira issue in that sprint.",
        ],
      },
    ],
  },
  {
    id: "power",
    title: "If you live in a terminal",
    blurb: "Optional, and safe to ignore.",
    items: [
      {
        title: "Command line and coding agents",
        steps: [
          "Settings → Integrations → Command line access has to be on.",
          "The bundled CLI can list and add tasks without opening the window.",
          "Claude Code, Codex and Cursor can be connected too, so an assistant can put things on your list for you.",
          "Everything stays on this computer, behind a token only apps running as you can read.",
        ],
      },
      {
        title: "Updates",
        steps: [
          "Stepler checks for a new version when it starts.",
          "When one is ready, a button appears at the top of the window.",
          "Click it and Stepler restarts into the new version.",
          "If it cannot install itself, the button turns orange and takes you to the download instead.",
        ],
      },
    ],
  },
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
  const [query, setQuery] = useState("");
  const anyMatch = SECTIONS.some((s) =>
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
        How Stepler works
      </h2>
      <p className="mb-6 text-sm text-neutral-500">
        Short answers to “how do I…”. Open any line to see the steps.
      </p>

      <div className="mb-8 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">
        <Search size={15} className="shrink-0 text-neutral-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this guide — reminder, sprint, backup…"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      {SECTIONS.map((s) => (
        <Section key={s.id} section={s} query={query} />
      ))}

      {!anyMatch && (
        <p className="text-sm text-neutral-500">
          Nothing here matches “{query}”.
        </p>
      )}
    </div>
  );
}
