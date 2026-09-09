/**
 * Collaboration, the parts that are only arithmetic.
 *
 * Nothing here touches Firestore, React or Electron, because all three clients
 * need the same answers: the desktop window, the web app, and the main process
 * that pushes tasks up. A handle parsed one way in the composer and another way
 * on the way to the cloud would mean a mention that renders and never arrives.
 */

/**
 * Handles are the visible name of an account, so they are deliberately dull:
 * lowercase, letters and digits, plus the three separators an email local-part
 * commonly carries. Anything else — a plus tag, a quoted local-part, an
 * accented letter — becomes nothing rather than becoming a different letter.
 */
const HANDLE_CHARS = /[^a-z0-9._-]+/g;

export const HANDLE_MIN = 2;
export const HANDLE_MAX = 24;

/**
 * `@` followed by a handle. The leading group is what keeps `you@example.com`
 * out of it: a mention has to start a word, so an `@` with anything but a
 * space or a line start before it is an email address, not a mention.
 */
const MENTION_RE = /(^|[^\w@/.-])@([a-z0-9._-]{2,24})/gi;

/**
 * Cut a handle down to something that can be a document id and a word in a
 * sentence. Returns "" when nothing usable survives, which every caller treats
 * as "this is not a handle" rather than as an empty-but-valid one.
 */
export function normalizeHandle(value) {
  const clean = String(value || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(HANDLE_CHARS, "")
    // A leading or trailing separator reads as a typo and sorts oddly in a
    // prefix search, so the ends are always alphanumeric.
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, HANDLE_MAX);
  return clean.length >= HANDLE_MIN ? clean : "";
}

/**
 * The handle an account gets on the day it is created: the part of the email
 * before the `@`, with a plus tag dropped — `tester+stepler@gmail.com` and
 * `tester@gmail.com` are one person and should not read as two.
 *
 * The result is a suggestion, not a reservation. Whoever claims it first keeps
 * it; the second person is offered a numbered variant.
 */
export function usernameFromEmail(email) {
  const local = String(email || "").split("@")[0] || "";
  return normalizeHandle(local.split("+")[0]);
}

/** Numbered fallbacks for a handle somebody else already holds. */
export function handleCandidates(base, count = 12) {
  const root = normalizeHandle(base) || "stepler";
  const out = [root];
  for (let i = 2; out.length < count; i += 1) {
    const suffix = String(i);
    out.push(root.slice(0, HANDLE_MAX - suffix.length) + suffix);
  }
  return out;
}

/**
 * Every handle a piece of text mentions, lowercased and deduplicated. Code
 * fences are cut out first: a shell snippet is full of `@` and none of it is
 * addressed to anybody.
 */
export function extractMentions(text) {
  const source = String(text || "").replace(/```[\s\S]*?```/g, " ");
  const found = new Set();
  for (const match of source.matchAll(MENTION_RE)) {
    const handle = normalizeHandle(match[2]);
    if (handle) found.add(handle);
  }
  return [...found];
}

/**
 * The handle being typed right now, for the composer's autocomplete: the caret
 * has to be sitting at the end of an `@word` with no space in it. Returns null
 * the moment that stops being true, which is what closes the menu.
 */
export function mentionQueryAt(text, caret) {
  const before = String(text || "").slice(0, caret);
  const match = /(^|[^\w@/.-])@([a-z0-9._-]*)$/i.exec(before);
  if (!match) return null;
  return {
    query: match[2].toLowerCase(),
    // Where the `@` itself starts, so replacing the query can keep the rest of
    // the line intact.
    start: caret - match[2].length - 1,
    end: caret,
  };
}

/**
 * Swap the half-typed handle under the caret for the one that was picked.
 *
 * A space follows the name so the next word does not run into it — unless the
 * text already continues with one, which is what completing a handle in the
 * middle of a line looks like.
 */
export function applyMention(text, range, handle) {
  const source = String(text || "");
  const rest = source.slice(range.end);
  const gap = /^\s/.test(rest) ? "" : " ";
  return {
    text: `${source.slice(0, range.start)}@${handle}${gap}${rest}`,
    caret: range.start + handle.length + 1 + gap.length,
  };
}

/**
 * Which of my connections a piece of text is addressed to.
 *
 * Handles that belong to nobody I am connected to are dropped in silence.
 * Sending on an unknown handle would either leak a task to a stranger who
 * happened to claim that name, or pile up writes the rules reject — and the
 * person typing has the autocomplete to tell them who exists.
 */
export function resolveMentions(text, connections) {
  const wanted = new Set(extractMentions(text));
  if (!wanted.size) return [];
  return connections.filter(
    (c) => c.status === "accepted" && wanted.has(normalizeHandle(c.username)),
  );
}

/** A display name for a connection, falling back through what we know of them. */
export function connectionLabel(person) {
  if (!person) return "";
  if (person.username) return `@${person.username}`;
  return person.displayName || person.email || "";
}

/**
 * Mentions turned into rows the timeline can group.
 *
 * The id is the sender's task id — a millisecond stamp, so it sorts among your
 * own rows without a second field — and `mention` is what tells the renderer
 * to draw it read-only rather than as one of yours.
 */
export function mentionsAsRows(mentions) {
  return (mentions || []).map((m) => ({
    id: String(m.taskId || m.id),
    text: m.text,
    ymd: m.ymd,
    completed: !!m.completed,
    priority: false,
    mention: m,
  }));
}
