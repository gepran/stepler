import { useSyncExternalStore } from "react";

/**
 * Telling somebody, in a browser tab, that a task has just been addressed to
 * them.
 *
 * What this is NOT: push. There are no Cloud Functions in this project and no
 * FCM registration, so nothing can wake a closed browser — a notification only
 * happens while a tab is open and Firestore's own listener is running. What
 * that still buys is real: the tab is usually open and behind something else,
 * and a notification plus a counted title is the difference between seeing a
 * mention now and seeing it tomorrow.
 *
 * Three things make the "is this new?" question harder than it looks, and all
 * three are handled in `announce` below rather than by the caller.
 */

const TITLE = "Stepler";

/** Permission is a browser-wide fact, so it lives here rather than in state. */
function currentPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}

let permission = currentPermission();
const listeners = new Set();
const emit = () => {
  for (const fn of listeners) fn();
};

export function useNotifyPermission() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => permission,
    () => "unsupported",
  );
}

/**
 * Ask for permission. MUST be called from a click.
 *
 * Safari refuses outside a user gesture and Chrome quietly ignores the request
 * from a page nobody has interacted with, so there is no point calling this
 * from an effect or on the first arriving mention — by then there is no
 * gesture to attach it to.
 */
export async function requestNotifyPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission !== "default") {
    permission = Notification.permission;
    emit();
    return permission;
  }
  try {
    permission = await Notification.requestPermission();
  } catch {
    permission = Notification.permission;
  }
  emit();
  return permission;
}

/**
 * Show one notification, through the service worker where there is one.
 *
 * `new Notification(...)` throws "Illegal constructor" on Android Chrome and is
 * missing from installed PWAs on several platforms, so the registration's own
 * showNotification is the first choice — the worker is already registered at
 * scope "/" for the offline shell, and no push subscription is involved: the
 * page hands the worker something to draw. The constructor is the fallback for
 * the places that have no worker at all.
 *
 * The `tag` is what stops two open tabs, each with its own Firestore listener,
 * from drawing the same mention twice: same tag, one notification.
 */
async function show(title, body, tag) {
  if (permission !== "granted") return;
  const options = {
    body: String(body || "").slice(0, 500),
    tag,
    renotify: false,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: "/app" },
  };
  try {
    // A private window, a blocked-storage profile or a failed registration
    // leaves no worker at all, and `serviceWorker.ready` in that last case
    // never settles — an await on it would swallow every notification for the
    // rest of the session in silence. So the registration is asked for without
    // blocking, and the constructor is the fallback for the platforms that
    // still have it.
    const registration = navigator.serviceWorker
      ? await navigator.serviceWorker.getRegistration()
      : null;
    if (registration) {
      await registration.showNotification(title, options);
      return;
    }
    new Notification(title, options);
  } catch (err) {
    console.warn("Could not show a notification:", err?.message);
  }
}

// ---------------------------------------------------------------------------
// The "is this new?" bookkeeping
// ---------------------------------------------------------------------------

let seenUid = null;
let primed = false;
let primedFromServer = false;
const announced = new Set();

/**
 * Decide what, if anything, to announce from a mentions snapshot.
 *
 * The baseline is taken twice on purpose. The first snapshot is whatever
 * IndexedDB had, which on a warm reload is the whole backlog and on a cold one
 * is an empty list — baseline only on the first would mean a new browser
 * announced every unread mention the account has the moment the server
 * answered. So the first server-backed snapshot re-baselines as well, and only
 * what arrives after THAT is news.
 *
 * Novelty is decided by the id, never by the snapshot arriving: the author's
 * delivery pass rewrites each still-current mention on every one of their
 * pushes, which re-fires this listener with identical content. And `announced`
 * is append-only within a session, because a dismissed mention leaves the list
 * without its document going anywhere, and marking one read and back again
 * must not make it new a second time.
 */
export function announceMentions(uid, list, meta, describe) {
  if (!uid) return;
  if (uid !== seenUid) {
    seenUid = uid;
    primed = false;
    primedFromServer = false;
    announced.clear();
  }

  const unread = (list || []).filter((m) => !m.read);
  const fromServer = meta ? !meta.fromCache : true;

  if (!primed || (!primedFromServer && fromServer)) {
    primed = true;
    if (fromServer) primedFromServer = true;
    for (const m of unread) announced.add(String(m.id));
    return;
  }

  const fresh = unread.filter((m) => !announced.has(String(m.id)));
  if (!fresh.length) return;
  for (const m of fresh) announced.add(String(m.id));

  // Nothing to draw, but the ids still had to be recorded — otherwise granting
  // permission later would announce everything that arrived before it.
  if (permission !== "granted") return;

  // A burst — accepting a connection makes every task already holding your
  // handle deliverable at once — is one line rather than a stack.
  if (fresh.length === 1) {
    const [m] = fresh;
    show(describe.one(m), m.text, `stepler-mention-${m.id}`);
  } else {
    // The tag is what stops two open tabs from drawing the same arrival twice.
    // A constant one would do that AND quietly replace an earlier burst the
    // person has not looked at yet, with no alert — so it is derived from the
    // ids, which are identical across tabs and different across arrivals.
    const tag = `stepler-mentions-${fresh
      .map((m) => m.id)
      .sort()
      .join("_")
      .slice(0, 120)}`;
    show(TITLE, describe.many(fresh.length), tag);
  }
}

// ---------------------------------------------------------------------------
// The tab itself
// ---------------------------------------------------------------------------

/**
 * The unread count in the browser tab.
 *
 * Nothing in this app has ever written `document.title` — it comes from
 * app.html and stays "Stepler" — so this is the whole contract: a count in
 * front of the name while there is one, and the bare name again when there is
 * not. Both `/app` and `/login` are served from that same file, so the
 * signed-out screen has to end up with the plain title too.
 */
export function setUnreadTitle(count) {
  if (typeof document === "undefined") return;
  const next = count > 0 ? `(${count > 99 ? "99+" : count}) ${TITLE}` : TITLE;
  if (document.title !== next) document.title = next;
}
