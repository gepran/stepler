/**
 * Cloud sync for the desktop app.
 *
 * The local JSON file stays the source of truth. Firestore is a mirror: if sync
 * never runs, or runs badly, the file on this machine is still the whole app.
 * Every rule below follows from that — most importantly, a pull is only ever
 * allowed to ADD or UPDATE a local task, never to remove one it does not
 * recognise. A task the cloud has not heard of is a task that has not been
 * pushed yet, not a task that was deleted somewhere else.
 *
 * This runs in Electron's main process, which is plain Node: no window, no
 * localStorage, no IndexedDB. The Firebase SDK works there (verified), but the
 * stores it normally persists a session in do not exist, so it is given one
 * backed by a file and keeps owning the session lifecycle itself.
 */

import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  initializeAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

// Not secrets: every Firebase client ships these. The Firestore rules and the
// authorized-domain list are what actually protect the data.
const firebaseConfig = {
  apiKey: "AIzaSyAb3llMMjuJRWxaeVovQpguS0GtJqv1iow",
  authDomain: "stepler-490308.firebaseapp.com",
  projectId: "stepler-490308",
  storageBucket: "stepler-490308.firebasestorage.app",
  messagingSenderId: "638697418683",
  appId: "1:638697418683:web:e0c295057e55d997f65e9e",
};

let app = null;
let auth = null;
let db = null;

/** Wiring supplied by index.js so this module never touches the disk itself. */
let deps = null;

let unsubscribeTasks = null;
let currentUid = null;
let status = { signedIn: false, email: null, state: "off", error: null };
let pushTimer = null;
let pushing = false;
let pushAgain = false;
let applyingRemote = false;

// --------------------------------------------------------------------------
// Shape translation
//
// On disk a day is a bucket: `tasks` holds today, `history[]` holds the rest,
// `deletedTasks[]` is the trash. In Firestore every task is its own document
// with a `ymd` and a `deleted` flag. A single document per task is not a style
// choice — Firestore caps a document at 1 MB, and a whole-file write would make
// two devices editing different tasks overwrite each other completely.
// --------------------------------------------------------------------------

/** The day a task belongs to, taken from the timestamp inside its id. */
function ymdForTask(task, fallback) {
  if (typeof task.ymd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.ymd))
    return task.ymd;
  const n = parseInt(task.id, 10);
  const d = !isNaN(n) && n > 10000000000 ? new Date(n) : null;
  if (!d || isNaN(d.getTime())) return fallback;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Every task on this machine as one flat list, tagged with its bucket. */
export function flattenLocal(data, todayYMD) {
  const out = [];
  const seen = new Set();
  const push = (t, deleted) => {
    if (!t || t.id == null) return;
    const id = String(t.id);
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ ...t, id, deleted, ymd: ymdForTask({ ...t, id }, todayYMD) });
  };
  (data?.tasks || []).forEach((t) => push(t, false));
  (data?.history || []).forEach((d) =>
    (d?.tasks || []).forEach((t) => push(t, false)),
  );
  (data?.deletedTasks || []).forEach((t) => push(t, true));
  return out;
}

/** Put a flat list back into the today / history / trash shape the app stores. */
export function rebuildLocal(flat, todayYMD) {
  const tasks = [];
  const deletedTasks = [];
  const byDay = new Map();
  for (const t of flat) {
    const { deleted, ymd, ...rest } = t;
    if (deleted) {
      deletedTasks.push(rest);
      continue;
    }
    const day = ymd || todayYMD;
    if (day === todayYMD) {
      tasks.push(rest);
      continue;
    }
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(rest);
  }
  const history = [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([ymd, list]) => ({ ymd, date: ymd, tasks: list }));
  return { tasks, history, deletedTasks };
}

/**
 * Fields the cloud carries. The rules require id/text/ymd/completed/deleted and
 * reject anything whose updatedAt is not the server's own clock; everything
 * else rides along untouched so a task keeps its projects and subtasks when it
 * lands on another machine.
 *
 * `attachment` is deliberately included even though the file it names lives
 * only on the machine that made it: dropping the field here would push an
 * attachment-less copy up, and the next pull would then strip the attachment
 * from the machine that still has the file.
 */
const CARRIED = [
  "priority",
  "projects",
  "subtasks",
  "dueDate",
  "reminder",
  "attachment",
  "gcalEventId",
  "gcalLink",
  "appleReminderId",
  "jiraKey",
  "jiraLink",
  "deletedAt",
];

function taskToDoc(t) {
  const out = {
    id: String(t.id),
    text: typeof t.text === "string" ? t.text.slice(0, 20000) : "",
    ymd: t.ymd,
    completed: !!t.completed,
    deleted: !!t.deleted,
    updatedAt: serverTimestamp(),
  };
  for (const k of CARRIED) {
    // Firestore rejects undefined outright, and writing null would erase a
    // value the other device may still have.
    if (t[k] !== undefined && t[k] !== null) out[k] = t[k];
  }
  return out;
}

function docToTask(d) {
  const { updatedAt, ...rest } = d;
  return {
    ...rest,
    id: String(rest.id),
    updatedAt:
      updatedAt && typeof updatedAt.toMillis === "function"
        ? updatedAt.toMillis()
        : typeof updatedAt === "number"
          ? updatedAt
          : 0,
  };
}

/**
 * Sort object keys all the way down, leaving array order alone because the
 * order of subtasks is meaningful.
 *
 * Firestore does not preserve the key order of a nested object, so a task that
 * went up as {name, type} can come back as {type, name}. Comparing raw JSON
 * then reports a change that never happened — which pushed the task again,
 * which produced another snapshot, which reported another change. That loop ran
 * about nineteen times in twenty-five seconds against real data before this
 * function existed.
 */
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = canonical(v[k]);
    return out;
  }
  return v;
}

/**
 * What this machine believes it has already sent. Comparing against it is how
 * full snapshots from the renderer become the handful of tasks that actually
 * changed — the renderer re-saves everything on every keystroke-sized edit.
 */
function signature(t) {
  return JSON.stringify(
    canonical([
      t.text,
      !!t.completed,
      !!t.deleted,
      t.ymd,
      ...CARRIED.map((k) => t[k] ?? null),
    ]),
  );
}

// --------------------------------------------------------------------------
// Merge
// --------------------------------------------------------------------------

/**
 * Fold what the cloud says into what this machine has.
 *
 * Last write wins on updatedAt, with two deliberate asymmetries:
 *  - a remote task this machine has never seen is added;
 *  - a local task the cloud has never seen is KEPT, never removed. The cloud
 *    not knowing about a task means it has not been pushed yet.
 * When the remote copy wins it is spread over the local one rather than
 * replacing it, so a field only this machine knows about — an attachment id,
 * say — survives a device that never had it.
 */
export function mergeRemote(localFlat, remoteTasks) {
  const byId = new Map(localFlat.map((t) => [t.id, t]));
  let changed = 0;
  for (const r of remoteTasks) {
    const local = byId.get(r.id);
    if (!local) {
      byId.set(r.id, r);
      changed += 1;
      continue;
    }
    const localAt = Number(local.updatedAt) || 0;
    const remoteAt = Number(r.updatedAt) || 0;
    if (remoteAt > localAt) {
      byId.set(r.id, { ...local, ...r });
      changed += 1;
    }
  }
  return { merged: [...byId.values()], changed };
}

// --------------------------------------------------------------------------
// Engine
// --------------------------------------------------------------------------

function setStatus(patch) {
  status = { ...status, ...patch };
  deps?.onStatus?.(publicStatus());
}

export function publicStatus() {
  return {
    signedIn: !!currentUid,
    email: status.email,
    state: status.state,
    error: status.error,
  };
}

/**
 * Firebase persists a session in browser storage, of which this process has
 * none — so it is handed a store backed by a file instead. Doing it this way
 * rather than refreshing the token by hand means the SDK still owns the whole
 * session lifecycle: refresh, expiry, revocation, and sign-out all keep working
 * exactly as they do in a browser.
 */
class DiskPersistence {
  constructor() {
    this.type = "LOCAL";
  }

  async _isAvailable() {
    return true;
  }

  async _set(key, value) {
    const blob = (await deps.readAuth()) || {};
    blob[key] = value;
    await deps.writeAuth(blob);
  }

  async _get(key) {
    const blob = (await deps.readAuth()) || {};
    return blob[key] ?? null;
  }

  async _remove(key) {
    const blob = (await deps.readAuth()) || {};
    delete blob[key];
    await deps.writeAuth(blob);
  }

  // Nothing else in this process shares the store, so there is nobody to tell.
  _addListener() {}

  _removeListener() {}
}

function ensureApp() {
  if (app) return;
  if (!deps) throw new Error("sync used before initSync");
  app = initializeApp(firebaseConfig);
  // The CLASS, not an instance: Firebase constructs persistence itself, and
  // handing it an object fails deep inside with "Expected a class definition".
  auth = initializeAuth(app, { persistence: DiskPersistence });
  db = getFirestore(app);
}

/**
 * Wire the engine up. `getData` and `applyRemote` are the only two doors to the
 * on-disk file, so every writer in the app — window, CLI, MCP, local HTTP API —
 * keeps funnelling through the one data layer that already exists.
 */
export function initSync({
  getData,
  applyRemote,
  onStatus,
  readToken,
  writeToken,
  readAuth,
  writeAuth,
  todayYMD,
}) {
  deps = {
    getData,
    applyRemote,
    onStatus,
    readToken,
    writeToken,
    readAuth,
    writeAuth,
    todayYMD,
  };
  ensureApp();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      stopListening();
      currentUid = null;
      setStatus({ signedIn: false, email: null, state: "off", error: null });
      return;
    }
    currentUid = user.uid;
    setStatus({
      signedIn: true,
      email: user.email || null,
      state: "syncing",
      error: null,
    });
    startListening();
    schedulePush();
  });

  // No restore call here on purpose: initializeAuth reads the persisted
  // session out of diskPersistence and fires onAuthStateChanged by itself.
}

function stopListening() {
  if (unsubscribeTasks) {
    unsubscribeTasks();
    unsubscribeTasks = null;
  }
}

function startListening() {
  stopListening();
  if (!currentUid) return;
  unsubscribeTasks = onSnapshot(
    collection(db, "users", currentUid, "tasks"),
    (snap) => {
      const remote = [];
      snap.forEach((d) => remote.push(docToTask({ ...d.data(), id: d.id })));
      applyRemoteTasks(remote);
    },
    (err) => {
      console.error("Sync listener failed:", err.code, err.message);
      setStatus({ state: "error", error: err.message });
    },
  );
}

function applyRemoteTasks(remote) {
  const today = deps.todayYMD();
  const data = deps.getData();
  const localFlat = flattenLocal(data, today);
  const { merged, changed } = mergeRemote(localFlat, remote);
  if (changed > 0) {
    applyingRemote = true;
    try {
      deps.applyRemote(rebuildLocal(merged, today));
    } finally {
      applyingRemote = false;
    }
  }
  setStatus({ state: "synced", error: null });
  // A pull can reveal that this machine holds tasks the cloud has never seen.
  schedulePush();
}

/** Called after the app writes its file. Coalesced so a burst becomes one push. */
export function notifyLocalChange() {
  if (!currentUid || applyingRemote) return;
  schedulePush();
}

function schedulePush() {
  if (!currentUid) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushChanged().catch((err) => {
      console.error("Push failed:", err.code || "", err.message);
      setStatus({ state: "error", error: err.message });
    });
  }, 800);
}

async function pushChanged() {
  if (!currentUid) return;
  if (pushing) {
    pushAgain = true;
    return;
  }
  pushing = true;
  try {
    const today = deps.todayYMD();
    const flat = flattenLocal(deps.getData(), today);
    const saved = (await deps.readToken()) || {};
    const shadow = saved.uid === currentUid && saved.shadow ? saved.shadow : {};

    const outgoing = flat.filter((t) => shadow[t.id] !== signature(t));
    if (!outgoing.length) {
      setStatus({ state: "synced", error: null });
      return;
    }

    setStatus({ state: "syncing" });
    const nextShadow = { ...shadow };
    // Firestore caps a batch at 500 writes, so a first import of a long history
    // goes up in chunks instead of one rejected request.
    for (let i = 0; i < outgoing.length; i += 400) {
      const slice = outgoing.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const t of slice) {
        batch.set(doc(db, "users", currentUid, "tasks", t.id), taskToDoc(t), {
          merge: true,
        });
      }
      await batch.commit();
      // Only record what actually committed: a crash mid-import then resumes
      // instead of believing it finished.
      for (const t of slice) nextShadow[t.id] = signature(t);
      await deps.writeToken({ ...saved, uid: currentUid, shadow: nextShadow });
    }
    setStatus({ state: "synced", error: null });
  } finally {
    pushing = false;
    if (pushAgain) {
      pushAgain = false;
      schedulePush();
    }
  }
}

// --------------------------------------------------------------------------
// Sign-in
// --------------------------------------------------------------------------

export async function signInEmail(email, password, createIfMissing) {
  ensureApp();
  setStatus({ state: "signing-in", error: null });
  try {
    if (createIfMissing) {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    return { success: true };
  } catch (err) {
    setStatus({ state: "off", error: err.code || err.message });
    return { success: false, error: err.code || err.message };
  }
}

/** Finishes the desktop Google flow: index.js gets the id_token, we use it. */
export async function signInGoogleIdToken(idToken) {
  ensureApp();
  setStatus({ state: "signing-in", error: null });
  try {
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    return { success: true };
  } catch (err) {
    setStatus({ state: "off", error: err.code || err.message });
    return { success: false, error: err.code || err.message };
  }
}

export async function signOutSync() {
  stopListening();
  clearTimeout(pushTimer);
  try {
    if (auth) await fbSignOut(auth);
  } catch (err) {
    console.warn("Sign-out reported:", err.message);
  }
  currentUid = null;
  // Drop the shadow with the session. Signing back in — possibly as somebody
  // else — must not push this account's tasks into that account's list.
  await deps?.writeToken(null);
  setStatus({ signedIn: false, email: null, state: "off", error: null });
  return { success: true };
}
