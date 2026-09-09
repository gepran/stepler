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
  deleteDoc,
  deleteField,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import {
  initCloudFiles,
  reconcileAttachments,
  resetCloudFiles,
} from "./attachments-cloud";
import {
  acceptInvite,
  addMentionSubtask,
  dismissMention,
  ensureProfile,
  markAllMentionsRead,
  markMentionRead,
  readSentMap,
  reconcileMentions,
  removeConnection,
  searchProfiles,
  sendInvite,
  setMentionSubtaskCompleted,
  subscribeConnections,
  subscribeMentions,
  updateMentionedTask,
} from "../renderer/src/lib/collab-store";

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
let filesTimer = null;
let filesRunning = false;
let repairingEchoes = false;
let filesPending = false;

// Collaboration. The window renders all three of these and owns none of them:
// the session lives in this process, so the listens do too.
let myProfile = null;
let connections = [];
let mentions = [];
// Who each task has already been delivered to. Read once per session and kept
// patched, so a push does not go back to Firestore for it every time.
let sentMap = null;
let unsubscribeConnections = null;
let unsubscribeMentions = null;
let mentionTimer = null;

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
    // Belt and braces against the bug that put mention rows in the file: one
    // of those going up would appear in the cloud as a task this account had
    // written, and then land on its other machines as one.
    if (t.mention) return;
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
    // A field that is gone has to be written as a deletion, not simply left
    // out. A merge write that omits a key does not clear it — it only bumps
    // updatedAt — so clearing a due date used to be undone a second later by
    // the pull that found the old value carrying a newer server stamp.
    out[k] = t[k] === undefined || t[k] === null ? deleteField() : t[k];
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
export function mergeRemote(localFlat, remoteTasks, shadow = {}) {
  const byId = new Map(localFlat.map((t) => [t.id, t]));
  const applied = [];
  let changed = 0;
  for (const r of remoteTasks) {
    const local = byId.get(r.id);
    if (!local) {
      byId.set(r.id, r);
      applied.push(r);
      changed += 1;
      continue;
    }
    // Does this machine hold an edit it has not sent yet?
    //
    // That question used to be asked by comparing `local.updatedAt`, stamped
    // by this laptop's clock, against `r.updatedAt`, stamped by the server.
    // The two are never comparable: on a machine running thirty seconds slow
    // every remote echo looked newer than the edit just made on it, and the
    // text reverted under the cursor with no conflict and no error. The shadow
    // already records what was last sent, and answers the question exactly.
    if (shadow[r.id] !== signature(local)) continue;
    const next = { ...local, ...r };
    // An echo of our own write carries no news. Applying it anyway would
    // rewrite the file and start another push on every snapshot.
    if (signature(next) === signature(local)) continue;
    byId.set(r.id, next);
    applied.push(r);
    changed += 1;
  }
  return { merged: [...byId.values()], changed, applied };
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
 * Everything the window needs to draw the Collaboration tab and the @ badge.
 *
 * Rebuilt field by field rather than passed through: a Firestore document
 * carries a Timestamp, and what crosses Electron's IPC has to be something the
 * structured clone can carry and the window can read. Strings and booleans,
 * then, and nothing the renderer has no use for.
 */
export function collabSnapshot() {
  return {
    uid: currentUid,
    profile: myProfile
      ? {
          uid: myProfile.uid,
          username: myProfile.username || "",
          email: myProfile.email || "",
          displayName: myProfile.displayName || "",
          photoURL: myProfile.photoURL || "",
        }
      : null,
    connections: connections.map((c) => ({
      uid: c.uid,
      username: c.username || "",
      email: c.email || "",
      displayName: c.displayName || "",
      photoURL: c.photoURL || "",
      status: c.status || "pending",
    })),
    mentions: mentions.map((m) => ({
      id: m.id,
      taskId: String(m.taskId || m.id),
      text: m.text || "",
      ymd: m.ymd || "",
      completed: !!m.completed,
      priority: !!m.priority,
      // Plain objects only: a Firestore array of maps crosses IPC fine, but
      // anything it picked up along the way would not.
      subtasks: Array.isArray(m.subtasks)
        ? m.subtasks.map((st) => ({
            id: st?.id != null ? String(st.id) : "",
            text: String(st?.text || ""),
            completed: !!st?.completed,
          }))
        : [],
      read: !!m.read,
      fromUid: m.fromUid || "",
      fromUsername: m.fromUsername || "",
      fromEmail: m.fromEmail || "",
      fromName: m.fromName || "",
    })),
  };
}

function emitCollab() {
  deps?.onCollab?.(collabSnapshot());
}

/** The card other people see when this account invites them. */
function meCard() {
  if (!currentUid) return null;
  return {
    ...(myProfile || {}),
    uid: currentUid,
    email: myProfile?.email || status.email || "",
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
  // The same app, so an upload carries the session the storage rules check.
  initCloudFiles(app);
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
  onCollab,
  readToken,
  writeToken,
  readAuth,
  writeAuth,
  disk,
  todayYMD,
}) {
  deps = {
    getData,
    applyRemote,
    onStatus,
    onCollab,
    readToken,
    writeToken,
    readAuth,
    writeAuth,
    disk,
    todayYMD,
  };
  ensureApp();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      stopListening();
      currentUid = null;
      resetCollab();
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
    startCollab(user);
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
      applyRemoteTasks(remote).catch((err) =>
        console.warn("Applying a pull reported:", err.code || "", err.message),
      );
    },
    (err) => {
      console.error("Sync listener failed:", err.code, err.message);
      setStatus({ state: "error", error: err.message });
    },
  );
}

async function applyRemoteTasks(remote) {
  const today = deps.todayYMD();
  const uid = currentUid;
  const saved = (await deps.readToken()) || {};
  const shadow = saved.uid === uid && saved.shadow ? saved.shadow : {};
  const localFlat = flattenLocal(deps.getData(), today);
  const { merged, changed, applied } = mergeRemote(localFlat, remote, shadow);
  if (uid !== currentUid) return;
  if (changed > 0) {
    applyingRemote = true;
    try {
      deps.applyRemote(rebuildLocal(merged, today));
    } finally {
      applyingRemote = false;
    }
  }
  // Write down what the cloud is now known to hold. Without this the shadow
  // never learns about a task that arrived from another device: the next push
  // would send the whole history back up, and the merge above could not tell a
  // stale local copy from one carrying an edit that has not gone up yet.
  if (applied.length) {
    const nextShadow = { ...shadow };
    for (const r of applied) nextShadow[r.id] = signature(r);
    await deps.writeToken({ ...saved, uid, shadow: nextShadow });
  }
  setStatus({ state: "synced", error: null });
  // A pull can also bring back an echo another device has not cleaned up yet.
  repairMentionEchoes().catch((err) =>
    console.warn("Echo repair reported:", err.code || "", err.message),
  );
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
  // Bytes move on the same triggers as documents but on a slower clock; see
  // scheduleFiles.
  scheduleFiles();
  // So do mentions: an edit that adds or removes an @handle is an edit like
  // any other, and this is the one place every edit passes through.
  scheduleMentions();
}

/**
 * Wait for a write, but not forever.
 *
 * Firestore does not settle a write until the server acknowledges it, so while
 * the machine is offline the promise simply never resolves. Anything holding a
 * latch across one of those waits stops for the lifetime of the process. The
 * write itself stays queued in the SDK either way; the only thing given up
 * here is our waiting on it.
 */
function settledWithin(promise, ms) {
  let timer;
  return Promise.race([
    promise.then(
      () => true,
      () => false,
    ),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(false), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

const PUSH_ACK_MS = 15000;

async function pushChanged() {
  if (!currentUid) return;
  if (pushing) {
    pushAgain = true;
    return;
  }
  pushing = true;
  // Snapshotted, not read again below: a sign-out landing mid-push used to
  // re-target the remaining batches and the shadow at whichever account signed
  // in next. Every other async path in this file already does this.
  const uid = currentUid;
  try {
    const today = deps.todayYMD();
    const flat = flattenLocal(deps.getData(), today);
    const saved = (await deps.readToken()) || {};
    const shadow = saved.uid === uid && saved.shadow ? saved.shadow : {};

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
        batch.set(doc(db, "users", uid, "tasks", t.id), taskToDoc(t), {
          merge: true,
        });
      }
      // Only record what actually committed: a crash mid-import then resumes
      // instead of believing it finished. And stop waiting if the answer is
      // not coming — the shadow simply does not advance, so the next push
      // sends the same slice again, which a merge write is happy to take.
      if (!(await settledWithin(batch.commit(), PUSH_ACK_MS))) return;
      if (uid !== currentUid) return;
      for (const t of slice) nextShadow[t.id] = signature(t);
      await deps.writeToken({ ...saved, uid, shadow: nextShadow });
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
// Attachment bytes
//
// A task document is a few hundred bytes and worth pushing the moment it
// changes; an attachment is megabytes and worth pushing eventually. The longer
// delay also collapses the burst of snapshots a first sync produces into one
// pass rather than six.
// --------------------------------------------------------------------------

function scheduleFiles(delay = 2500) {
  if (!currentUid || !deps.disk) return;
  clearTimeout(filesTimer);
  filesTimer = setTimeout(() => {
    // Deliberately no setStatus: Storage being switched off must not make the
    // header claim task sync is broken, because it is not.
    syncFiles().catch((err) =>
      console.warn("Attachment sync reported:", err.code || "", err.message),
    );
  }, delay);
}

/**
 * A pass where every job failed produces no patches, and a push is what used to
 * re-arm this. Left alone, one bad minute — no network, rules not deployed yet
 * — would put the queue to sleep until the user happened to edit a task. So it
 * re-arms itself whenever it knows there is more to do, backing off to a minute
 * so a genuinely offline machine is not retrying every couple of seconds.
 */
async function syncFiles() {
  if (!currentUid || !deps.disk) return;
  if (filesRunning) {
    filesPending = true;
    return;
  }
  filesRunning = true;
  let remaining = 0;
  try {
    const uid = currentUid;
    const result = await reconcileAttachments({
      uid,
      tasks: flattenLocal(deps.getData(), deps.todayYMD()),
      disk: deps.disk,
    });
    const patches = result.patches;
    remaining = result.remaining;
    if (!patches.size || uid !== currentUid) return;
    // Moving the bytes takes long enough that the window has almost certainly
    // saved over the list this pass started from, so the patch lands on what is
    // on disk NOW — otherwise a file finishing its upload would quietly undo
    // every edit made while it was in flight.
    const today = deps.todayYMD();
    const flat = flattenLocal(deps.getData(), today).map((t) =>
      withPatchedAttachments(t, patches),
    );
    applyingRemote = true;
    try {
      deps.applyRemote(rebuildLocal(flat, today));
    } finally {
      applyingRemote = false;
    }
    // The path and the id are how the OTHER devices find these bytes, so they
    // have to go up. This changes each patched task's signature exactly once,
    // so the push it triggers is the last one: the snapshot that comes back
    // matches the shadow and the next pass finds nothing to do.
    schedulePush();
  } finally {
    filesRunning = false;
    // A tick that arrived mid-pass was swallowed; anything left over needs
    // another go on a slower clock.
    if (filesPending) {
      filesPending = false;
      scheduleFiles();
    } else if (remaining > 0) {
      scheduleFiles(60_000);
    }
  }
}

/** Merge a reconcile's patches into one task, keyed the way it found them. */
function withPatchedAttachments(task, patches) {
  const fix = (att) => {
    const patch = att && patches.get(att.storagePath || att.id);
    return patch ? { ...att, ...patch } : null;
  };
  const own = fix(task.attachment);
  let subtasks = task.subtasks;
  if (Array.isArray(subtasks)) {
    let touched = false;
    const next = subtasks.map((st) => {
      const patched = fix(st?.attachment);
      if (!patched) return st;
      touched = true;
      return { ...st, attachment: patched };
    });
    if (touched) subtasks = next;
  }
  if (!own && subtasks === task.subtasks) return task;
  return {
    ...task,
    ...(own ? { attachment: own } : {}),
    ...(subtasks !== task.subtasks ? { subtasks } : {}),
  };
}

// --------------------------------------------------------------------------
// Collaboration
//
// The window has no Firestore of its own — the session is a file in this
// process — so the listens, the handshake and the delivery of mentions all
// live here, and the window sees them over IPC.
// --------------------------------------------------------------------------

function stopCollabListening() {
  if (unsubscribeConnections) {
    unsubscribeConnections();
    unsubscribeConnections = null;
  }
  if (unsubscribeMentions) {
    unsubscribeMentions();
    unsubscribeMentions = null;
  }
}

function resetCollab() {
  stopCollabListening();
  clearTimeout(mentionTimer);
  myProfile = null;
  connections = [];
  mentions = [];
  sentMap = null;
  emitCollab();
}

/**
 * Claim a handle if this account has none, then watch the two lists.
 *
 * The handle has to exist before anything else works — it is what other people
 * type — but a failure to claim one must not take sync down with it, so it is
 * reported and the task listener carries on regardless.
 */
async function startCollab(user) {
  stopCollabListening();
  const uid = user.uid;

  try {
    myProfile = await ensureProfile(db, user);
    if (uid !== currentUid) return; // signed out while we were away
    emitCollab();
  } catch (err) {
    console.warn("Could not claim a handle:", err.code || "", err.message);
  }

  try {
    sentMap = await readSentMap(db, uid);
  } catch {
    sentMap = {};
  }
  if (uid !== currentUid) return;

  unsubscribeConnections = subscribeConnections(
    db,
    uid,
    (list) => {
      const hadNobody = !connections.some((c) => c.status === "accepted");
      connections = list;
      emitCollab();
      // Connecting to somebody new makes every task already holding their
      // handle deliverable, and none of those tasks is about to change on its
      // own — so the pass is re-run rather than waited for.
      if (hadNobody && list.some((c) => c.status === "accepted"))
        scheduleMentions(200);
    },
    (err) => console.warn("Connections failed:", err.code, err.message),
  );

  unsubscribeMentions = subscribeMentions(
    db,
    uid,
    (list) => {
      mentions = list;
      emitCollab();
      // Knowing what was addressed to you is what makes the echoes
      // identifiable, so this is the moment to look for them.
      repairMentionEchoes().catch((err) =>
        console.warn("Echo repair reported:", err.code || "", err.message),
      );
    },
    (err) => console.warn("Mentions failed:", err.code, err.message),
  );

  scheduleMentions();
}

/**
 * Deliver mentions on a slower clock than tasks.
 *
 * A mention is a copy of a task, so there is no hurry: the task itself is
 * already on its way up on the fast path, and delaying this collapses the
 * burst of saves a single edit produces into one delivery.
 */
function scheduleMentions(delay = 1500) {
  if (!currentUid) return;
  clearTimeout(mentionTimer);
  mentionTimer = setTimeout(() => {
    deliverMentions().catch((err) =>
      console.warn("Mention delivery reported:", err.code || "", err.message),
    );
  }, delay);
}

async function deliverMentions() {
  if (!currentUid) return;
  const me = meCard();
  if (!me?.username) return;
  const accepted = connections.filter((c) => c.status === "accepted");
  if (!accepted.length) return;

  // Every task, not just the ones holding an `@`: withdrawing a mention means
  // noticing that a task STOPPED naming somebody, which the ones that still do
  // cannot tell you. The pass costs a regex on each, and stops there for the
  // overwhelming majority that mention nobody.
  const flat = flattenLocal(deps.getData(), deps.todayYMD());
  const uid = currentUid;
  const { sent } = await reconcileMentions(db, {
    me,
    tasks: flat,
    connections: accepted,
    sent: sentMap || {},
  });
  if (uid === currentUid) sentMap = sent;
}

/**
 * Undo the echo.
 *
 * A bug wrote rows other people had addressed to you into your own task file,
 * where sync duly pushed them up as tasks you had written. Filtering them out
 * going forward is not enough on its own: the copies already in the cloud come
 * back on the next pull, and by then they have lost the `mention` field that
 * would identify them.
 *
 * The id is what identifies them instead. A mention carries the AUTHOR's task
 * id, and your own ids are minted from your own clock — so a task of yours
 * sharing an id with a mention you received is the echo and nothing else. The
 * text has to match too, which takes "essentially impossible" down to "no".
 *
 * The cloud copy is deleted rather than tombstoned: a tombstone would put
 * somebody else's task in your trash, which is a worse thing to explain than
 * the bug. The author's own task is never touched — this only ever reaches
 * into this account's own collection.
 */
async function repairMentionEchoes() {
  if (repairingEchoes || !currentUid || !mentions.length) return;
  const byId = new Map(
    mentions.map((m) => [String(m.taskId || m.id), String(m.text || "")]),
  );
  const today = deps.todayYMD();
  const flat = flattenLocal(deps.getData(), today);
  const echoes = flat.filter(
    (t) => byId.has(t.id) && String(t.text || "") === byId.get(t.id),
  );
  if (!echoes.length) return;

  console.warn(
    `Removing ${echoes.length} mention echo(es) from this account's tasks.`,
  );

  const uid = currentUid;
  const ids = new Set(echoes.map((t) => t.id));
  repairingEchoes = true;
  try {
    // The file first, and the shadow with it — otherwise the next push would
    // helpfully put them back. This used to run after the cloud deletes were
    // awaited, which offline meant it never ran at all: the echoes stayed in
    // the file and every snapshot started another pass over the same rows.
    applyingRemote = true;
    try {
      deps.applyRemote(
        rebuildLocal(
          flattenLocal(deps.getData(), today).filter((t) => !ids.has(t.id)),
          today,
        ),
      );
    } finally {
      applyingRemote = false;
    }
    const saved = (await deps.readToken()) || {};
    if (saved.uid === uid && saved.shadow) {
      for (const id of ids) delete saved.shadow[id];
      await deps.writeToken(saved);
    }
    // The cloud copies can go whenever the connection allows.
    Promise.allSettled(
      echoes.map((t) => deleteDoc(doc(db, "users", uid, "tasks", t.id))),
    ).catch(() => {});
  } finally {
    repairingEchoes = false;
  }
}

export async function collabSearch(term) {
  if (!currentUid) return [];
  try {
    return await searchProfiles(db, term, { self: currentUid });
  } catch (err) {
    console.warn("Search failed:", err.code || "", err.message);
    return [];
  }
}

export async function collabInvite(person) {
  const me = meCard();
  if (!me) return { success: false, error: "not-signed-in" };
  try {
    await sendInvite(db, me, person);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.code || err.message };
  }
}

export async function collabAccept(person) {
  const me = meCard();
  if (!me) return { success: false, error: "not-signed-in" };
  try {
    await acceptInvite(db, me, person);
    // They may already have addressed tasks to me, and I may have written
    // theirs before either of us said yes.
    scheduleMentions(200);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.code || err.message };
  }
}

export async function collabRemove(uid) {
  const me = meCard();
  if (!me) return { success: false, error: "not-signed-in" };
  try {
    await removeConnection(db, me, uid);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.code || err.message };
  }
}

/**
 * An edit the window made to a task somebody else wrote.
 *
 * The window hands over the whole new value — the array of subtasks, the flag
 * — rather than an instruction to compute one, because the window is already
 * rendering that array and the main process would otherwise have to fetch a
 * copy it has no listener for.
 */
export async function collabEditMention(taskId, patch) {
  if (!currentUid) return { success: false, error: "not-signed-in" };
  const mention = mentions.find(
    (m) => String(m.taskId || m.id) === String(taskId),
  );
  if (!mention) return { success: false, error: "no-such-mention" };
  try {
    const ok = await updateMentionedTask(db, {
      meUid: currentUid,
      mention,
      patch,
    });
    return { success: ok };
  } catch (err) {
    return { success: false, error: err.code || err.message };
  }
}

export async function collabAddMentionSubtask(taskId, text) {
  if (!currentUid) return { success: false, error: "not-signed-in" };
  const mention = mentions.find(
    (m) => String(m.taskId || m.id) === String(taskId),
  );
  if (!mention) return { success: false, error: "no-such-mention" };
  try {
    const ok = await addMentionSubtask(db, {
      meUid: currentUid,
      mention,
      text,
    });
    return { success: ok };
  } catch (err) {
    return { success: false, error: err.code || err.message };
  }
}

export async function collabToggleMentionSubtask(taskId, subtaskId, completed) {
  if (!currentUid) return { success: false, error: "not-signed-in" };
  const mention = mentions.find(
    (m) => String(m.taskId || m.id) === String(taskId),
  );
  if (!mention) return { success: false, error: "no-such-mention" };
  try {
    const ok = await setMentionSubtaskCompleted(db, {
      meUid: currentUid,
      mention,
      subtaskId,
      completed,
    });
    return { success: ok };
  } catch (err) {
    return { success: false, error: err.code || err.message };
  }
}

/** Take a mention off this account's list; the author's task is untouched. */
export async function collabDismissMention(taskId) {
  if (!currentUid) return { success: false, error: "not-signed-in" };
  try {
    await dismissMention(db, currentUid, String(taskId));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.code || err.message };
  }
}

export async function collabMarkRead(mentionId) {
  if (!currentUid) return { success: false };
  try {
    if (mentionId) await markMentionRead(db, currentUid, mentionId);
    else await markAllMentionsRead(db, currentUid, mentions);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.code || err.message };
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
  resetCollab();
  clearTimeout(pushTimer);
  clearTimeout(filesTimer);
  resetCloudFiles();
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
