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

import {
  flattenLocal,
  rebuildLocal,
  mergeRemote,
  signature,
  CARRIED,
  taskFromSignature,
  serializeMention,
} from "./sync-data.js";
import { mergeTaskEdits } from "../renderer/src/lib/task-merge.js";
import { waitForSync, syncFailure } from "./sync-wait.js";
import { commitTaskEdit } from "../renderer/src/lib/task-cloud.js";
import {
  applyProjectOperation,
  normalizeProjectState,
} from "../renderer/src/lib/project-state.js";
export { flattenLocal, rebuildLocal, mergeRemote } from "./sync-data.js";

import { initializeApp } from "firebase/app";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  initializeAuth,
  linkWithCredential,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  updatePassword,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getFirestore,
  enableNetwork,
  onSnapshot,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import {
  initCloudFiles,
  reconcileAttachments,
  resetCloudFiles,
  fileIdFromPath,
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
let unsubscribeProjects = null;
let projectsRunning = false;
let projectsTimer = null;
let projectsSeed = null;
let currentUid = null;
let status = { signedIn: false, email: null, state: "off", error: null };
let pushTimer = null;
let pushing = false;
let pushAgain = false;
let applyingRemote = false;
let serverReady = false;
let sessionNumber = 0;
let taskListenerFailure = null;
let projectListenerFailure = null;
let projectWriteFailure = null;
const projectWrites = new Map();
let recoveryTimer = null;
let shadowQueue = Promise.resolve();
let pullQueue = Promise.resolve();
const taskWrites = new Map();
let filesTimer = null;
let filesRunning = false;
let repairingEchoes = false;
let filesPending = false;

// Collaboration. The window renders all three of these and owns none of them:
// the session lives in this process, so the listens do too.
let myProfile = null;
let connections = [];
let mentions = [];
// The mentions listener's first callback hands over the whole backlog at once,
// so without a baseline every launch would announce every unread mention the
// account has ever kept. `mentionsPrimed` records that the baseline has been
// taken; `notifiedMentions` is the per-session record of what has already been
// announced, kept append-only because a dismissed mention leaves the list
// without its document going anywhere.
let mentionsPrimed = false;
let mentionsPrimedFromServer = false;
let notifiedMentions = new Set();
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
    errorCode: status.errorCode || null,
    // Read off the live user rather than kept in `status`: linking a password
    // does not fire onAuthStateChanged — the uid has not changed — so a copy
    // here would still say "no password" on an account that has just been
    // given one. `auth` is null until ensureApp() has run.
    providers: (auth?.currentUser?.providerData || []).map((p) => p.providerId),
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
    mentions: mentions.map(serializeMention),
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
  onMention,
  readToken,
  writeToken,
  readAuth,
  writeAuth,
  disk,
  todayYMD,
  getProjects,
  applyProjects,
  selectAccount,
}) {
  deps = {
    getData,
    applyRemote,
    onStatus,
    onCollab,
    onMention,
    readToken,
    writeToken,
    readAuth,
    writeAuth,
    disk,
    todayYMD,
    getProjects,
    applyProjects,
    selectAccount,
  };
  ensureApp();

  onAuthStateChanged(auth, async (user) => {
    const session = ++sessionNumber;
    if (!user) {
      stopListening();
      currentUid = null;
      resetCollab();
      setStatus({
        signedIn: false,
        email: null,
        state: "off",
        error: null,
        errorCode: null,
      });
      return;
    }
    stopListening();
    currentUid = null;
    resetCollab();
    try {
      await deps.selectAccount?.(user.uid);
    } catch (error) {
      if (session !== sessionNumber) return;
      setStatus({ signedIn: false, state: "error", error: error.message });
      return;
    }
    if (session !== sessionNumber) return;
    currentUid = user.uid;
    setStatus({
      signedIn: true,
      email: user.email || null,
      state: "syncing",
      error: null,
      errorCode: null,
    });
    startListening();
    recoveryTimer = setInterval(() => {
      if (taskListenerFailure || projectListenerFailure)
        retrySync().catch(() => {});
      else if (status.state !== "synced") schedulePush(0);
    }, 30_000);
    startCollab(user);
    schedulePush();
  });

  // No restore call here on purpose: initializeAuth reads the persisted
  // session out of diskPersistence and fires onAuthStateChanged by itself.
}

function stopListening() {
  serverReady = false;
  clearInterval(recoveryTimer);
  clearTimeout(pushTimer);
  clearTimeout(filesTimer);
  unsubscribeProjects?.();
  unsubscribeProjects = null;
  clearTimeout(projectsTimer);
  if (unsubscribeTasks) {
    unsubscribeTasks();
    unsubscribeTasks = null;
  }
}

function startListening() {
  stopListening();
  if (!currentUid) return;
  const uid = currentUid;
  const session = sessionNumber;
  taskListenerFailure = null;
  projectListenerFailure = null;
  projectWriteFailure = null;
  if (deps.getProjects) {
    projectsSeed = deps.getProjects(uid).projects;
    unsubscribeProjects = onSnapshot(
      doc(db, "users", uid, "meta", "projects"),
      (snapshot) => {
        if (uid !== currentUid || session !== sessionNumber) return;
        projectListenerFailure = null;
        if (snapshot.exists())
          deps.applyProjects(
            normalizeProjectState(snapshot.data()),
            [],
            false,
            uid,
          );
        scheduleProjects();
      },
      (error) => {
        if (uid === currentUid && session === sessionNumber) {
          projectListenerFailure = syncFailure(error);
          setStatus(projectListenerFailure);
        }
      },
    );
    scheduleProjects();
  }
  unsubscribeTasks = onSnapshot(
    collection(db, "users", uid, "tasks"),
    { includeMetadataChanges: true },
    (snap) => {
      if (uid !== currentUid || session !== sessionNumber) return;
      taskListenerFailure = null;
      serverReady = !snap.metadata.fromCache;
      const remote = [];
      snap.forEach((d) => remote.push(docToTask({ ...d.data(), id: d.id })));
      pullQueue = pullQueue
        .catch(() => {})
        .then(() => applyRemoteTasks(remote, uid, session));
      pullQueue.catch((err) =>
        console.warn("Applying a pull reported:", err.code || "", err.message),
      );
    },
    (err) => {
      console.error("Sync listener failed:", err.code, err.message);
      if (uid === currentUid && session === sessionNumber) {
        taskListenerFailure = syncFailure(err);
        setStatus(taskListenerFailure);
      }
    },
  );
}

async function applyRemoteTasks(remote, uid, session) {
  if (uid !== currentUid || session !== sessionNumber) return;
  const today = deps.todayYMD();
  const saved = (await deps.readToken()) || {};
  const shadow = saved.uid === uid && saved.shadow ? saved.shadow : {};
  if (uid !== currentUid || session !== sessionNumber) return;
  const localFlat = flattenLocal(deps.getData(), today);
  const { merged, changed, applied } = mergeRemote(localFlat, remote, shadow);
  if (uid !== currentUid || session !== sessionNumber) return;
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
    await rememberShadow(
      uid,
      Object.fromEntries(applied.map((row) => [row.id, signature(row)])),
    );
  }
  if (uid !== currentUid || session !== sessionNumber) return;
  if (!pushing && !taskWrites.size) setConnectionStatus();
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

function schedulePush(delay = 800) {
  if (!currentUid) return;
  const uid = currentUid;
  const session = sessionNumber;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    if (uid !== currentUid || session !== sessionNumber) return;
    pushChanged().catch((err) => {
      if (uid !== currentUid || session !== sessionNumber) return;
      console.error("Push failed:", err.code || "", err.message);
      setStatus(syncFailure(err));
      schedulePush(15_000);
    });
  }, delay);
  // Bytes move on the same triggers as documents but on a slower clock; see
  // scheduleFiles.
  scheduleFiles();
  // So do mentions: an edit that adds or removes an @handle is an edit like
  // any other, and this is the one place every edit passes through.
  scheduleMentions();
  scheduleProjects();
}

function scheduleProjects(delay = 800) {
  if (!currentUid || !deps.getProjects) return;
  const uid = currentUid;
  const session = sessionNumber;
  clearTimeout(projectsTimer);
  projectsTimer = setTimeout(() => {
    if (uid !== currentUid || session !== sessionNumber) return;
    pushProjects().catch((error) => {
      if (uid !== currentUid || session !== sessionNumber) return;
      projectWriteFailure = syncFailure(error);
      setStatus(projectWriteFailure);
      scheduleProjects(15_000);
    });
  }, delay);
}

async function pushProjects() {
  if (projectsRunning || !currentUid || !deps.getProjects) return;
  projectsRunning = true;
  const uid = currentUid;
  const session = sessionNumber;
  const key = `${session}/${uid}`;
  try {
    const local = deps.getProjects(uid);
    const queue = local.queue || [];
    if (!queue.length && local.initialized) return;
    const operations = local.initialized
      ? queue
      : [{ type: "remember", names: projectsSeed || local.projects }, ...queue];
    let written = projectWrites.get(key);
    if (!written) {
      written = runTransaction(db, async (transaction) => {
        const target = doc(db, "users", uid, "meta", "projects");
        const snapshot = await transaction.get(target);
        let next = normalizeProjectState(snapshot.data());
        for (const operation of operations) {
          try {
            next = applyProjectOperation(next, operation);
          } catch (error) {
            if (
              !["Project no longer exists", "Project already exists"].includes(
                error.message,
              )
            )
              throw error;
          }
        }
        transaction.set(target, { ...next, updatedAt: serverTimestamp() });
        return next;
      })
        .then((state) => {
          if (uid !== currentUid || session !== sessionNumber) return;
          projectWriteFailure = null;
          deps.applyProjects(
            state,
            queue.map((operation) => operation.id),
            true,
            uid,
          );
        })
        .finally(() => {
          projectWrites.delete(key);
          if (uid === currentUid && session === sessionNumber)
            scheduleProjects();
        });
      projectWrites.set(key, written);
    }
    await waitForSync(written, PUSH_ACK_MS);
  } finally {
    projectsRunning = false;
    if (
      uid === currentUid &&
      session === sessionNumber &&
      deps.getProjects(uid)?.queue?.length
    )
      scheduleProjects(15_000);
  }
}

/** Serialize shadow patches so concurrent pull/write acknowledgments do not lose baselines. */
function rememberShadow(uid, changes, session = sessionNumber) {
  const update = shadowQueue.then(async () => {
    if (uid !== currentUid || session !== sessionNumber) return;
    const saved = (await deps.readToken()) || {};
    if (uid !== currentUid || session !== sessionNumber) return;
    await deps.writeToken({
      ...saved,
      uid,
      shadow: { ...(saved.uid === uid ? saved.shadow : {}), ...changes },
    });
  });
  shadowQueue = update.catch(() => {});
  return update;
}

function setConnectionStatus() {
  if (!currentUid) return;
  const failure =
    taskListenerFailure || projectListenerFailure || projectWriteFailure;
  if (failure) {
    setStatus(failure);
    return;
  }
  const projects = deps.getProjects?.(currentUid);
  if (
    serverReady &&
    (projects?.queue?.length ||
      projectWrites.has(`${sessionNumber}/${currentUid}`))
  ) {
    setStatus({ state: "syncing", error: null, errorCode: null });
    return;
  }
  if (serverReady) setStatus({ state: "synced", error: null, errorCode: null });
  else setStatus({ state: "offline", error: null, errorCode: null });
}

export async function retrySync() {
  if (!currentUid) return { success: false, error: "Sign in to synchronize." };
  const uid = currentUid;
  const session = sessionNumber;
  try {
    resetCloudFiles();
    await enableNetwork(db);
    if (uid !== currentUid || session !== sessionNumber)
      return { success: false, error: "Account changed." };
    startListening();
    recoveryTimer = setInterval(() => {
      if (taskListenerFailure || projectListenerFailure)
        retrySync().catch(() => {});
      else if (status.state !== "synced") schedulePush(0);
    }, 30_000);
    setStatus({ state: "syncing", error: null, errorCode: null });
    schedulePush(0);
    return { success: true };
  } catch (error) {
    if (uid === currentUid && session === sessionNumber)
      setStatus(syncFailure(error));
    return { success: false, error: error.message };
  }
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
  const session = sessionNumber;
  try {
    const today = deps.todayYMD();
    const flat = flattenLocal(deps.getData(), today);
    const saved = (await deps.readToken()) || {};
    if (uid !== currentUid || session !== sessionNumber) return;
    const shadow = saved.uid === uid && saved.shadow ? saved.shadow : {};

    const outgoing = flat.filter((t) => shadow[t.id] !== signature(t));
    if (!outgoing.length) {
      setConnectionStatus();
      return;
    }

    setStatus({ state: "syncing" });
    for (const t of outgoing) {
      if (uid !== currentUid || session !== sessionNumber) return;
      const key = `${session}/${uid}/${t.id}`;
      let written = taskWrites.get(key);
      if (!written) {
        written = commitTaskEdit(db, {
          uid,
          task: t,
          base: taskFromSignature(shadow[t.id], t.id),
          toDocument: (row) => {
            const out = taskToDoc(row);
            for (const key of CARRIED) if (row[key] == null) delete out[key];
            return out;
          },
          fromDocument: docToTask,
        })
          .then(async (committed) => {
            if (uid !== currentUid || session !== sessionNumber) return;
            // A timed-out transaction may acknowledge later. Apply it once and
            // preserve edits made while it was in flight.
            const latest = flattenLocal(deps.getData(), today).map((row) =>
              row.id === t.id ? mergeTaskEdits(t, row, committed) : row,
            );
            applyingRemote = true;
            try {
              deps.applyRemote(rebuildLocal(latest, today));
            } finally {
              applyingRemote = false;
            }
            await rememberShadow(
              uid,
              { [t.id]: signature(committed) },
              session,
            );
          })
          .finally(() => {
            taskWrites.delete(key);
            if (uid === currentUid && session === sessionNumber) schedulePush();
          });
        taskWrites.set(key, written);
      }
      await waitForSync(written, PUSH_ACK_MS);
      if (uid !== currentUid || session !== sessionNumber) return;
    }
    setConnectionStatus();
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
      tasks: [...flattenLocal(deps.getData(), deps.todayYMD()), ...mentions],
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
    mentions = mentions.map((mention) =>
      withPatchedAttachments(mention, patches),
    );
    emitCollab();
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
  // Signing in as somebody else must take a fresh baseline, or that account's
  // whole backlog arrives as news.
  mentionsPrimed = false;
  mentionsPrimedFromServer = false;
  notifiedMentions = new Set();
  emitCollab();
}

/**
 * Tell the window when somebody has just addressed a task to this account.
 *
 * Three things make this harder than "the list changed":
 *
 * The first callback carries the entire backlog. An account that has ignored
 * eleven mentions for a fortnight would get eleven notifications every time it
 * launched, so the first callback only takes the baseline and says nothing —
 * whatever its length, including zero, or an account with nothing waiting
 * would never prime and its first real mention would arrive unguarded.
 *
 * The same mention arrives again and again. The author's delivery pass runs on
 * every one of their pushes and rewrites each still-current mention in place,
 * which bumps the server timestamp and fires this listener with byte-identical
 * content. So novelty is decided by the id crossing from absent-or-read to
 * present-and-unread — never by the snapshot arriving, and never by a
 * timestamp.
 *
 * And it can arrive in a burst: accepting a connection makes every task that
 * already holds your handle deliverable at once. Several at a time are
 * announced as one line rather than as a stack of notifications.
 */
function announceNewMentions(list, meta) {
  const incoming = (list || []).filter((m) => !m.read);
  const fromServer = meta ? !meta.fromCache : true;
  // The baseline is taken twice. Firestore raises a snapshot from its own
  // (here, in-memory and therefore EMPTY) cache as soon as it decides it is
  // offline — about ten seconds in — so a launch on a train primes against
  // nothing, and every mention the account has ever kept arrives as news the
  // moment the connection comes up. Priming again on the first snapshot that
  // actually came from the server is what closes that.
  if (!mentionsPrimed || (!mentionsPrimedFromServer && fromServer)) {
    mentionsPrimed = true;
    if (fromServer) mentionsPrimedFromServer = true;
    for (const m of incoming) notifiedMentions.add(String(m.id));
    return;
  }
  const fresh = incoming.filter((m) => !notifiedMentions.has(String(m.id)));
  if (!fresh.length) return;
  for (const m of fresh) notifiedMentions.add(String(m.id));
  deps?.onMention?.(
    fresh.map((m) => ({
      id: String(m.id),
      text: String(m.text || ""),
      from: m.fromName || m.fromUsername || m.fromEmail || "",
    })),
  );
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
    (list, meta) => {
      announceNewMentions(list, meta);
      const localFiles = new Map();
      for (const row of list) {
        for (const holder of [row, ...(row.subtasks || [])]) {
          const path = holder.attachment?.storagePath;
          const id = fileIdFromPath(uid, path);
          if (id && deps.disk?.has(id)) localFiles.set(path, { id });
        }
      }
      mentions = list.map((mention) =>
        withPatchedAttachments(mention, localFiles),
      );
      emitCollab();
      scheduleFiles(200);
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

/**
 * Give this account a password, or change the one it has.
 *
 * Somebody who signed in with Google has no password at all, and Firebase
 * keeps one account per address — so signing up again with the same email is
 * not a second account, it is the error "that email already has an account".
 * The way through is to add a password to the account that already exists,
 * which is what `linkWithCredential` does, and after that either button works.
 *
 * The two halves need different calls and fail differently:
 *
 * Adding one is `linkWithCredential`, and it does NOT need a recent sign-in —
 * so a Google account, whose session here may be weeks old, can be given a
 * password without a browser round-trip.
 *
 * Changing one is `updatePassword`, and it DOES: the server reads `auth_time`
 * out of the token and a refresh does not move it. On a desktop session kept
 * alive on disk for weeks that check fails essentially always, so the current
 * password is asked for and used to re-authenticate first rather than waiting
 * for the failure.
 *
 * The address is never a parameter. `linkWithCredential` with a different one
 * silently makes THAT the account's sign-in address, which would strand the
 * person on a login they never chose.
 */
export async function setAccountPassword({ password, currentPassword }) {
  ensureApp();
  const user = auth?.currentUser;
  if (!user) return { success: false, error: "not-signed-in" };
  if (!user.email) return { success: false, error: "sync/no-email" };
  if (typeof password !== "string" || password.length < 6)
    return { success: false, error: "auth/weak-password" };

  const hasPassword = (user.providerData || []).some(
    (p) => p.providerId === "password",
  );

  try {
    if (hasPassword) {
      if (typeof currentPassword !== "string" || !currentPassword)
        return { success: false, error: "sync/current-password-needed" };
      await reauthenticateWithCredential(
        user,
        EmailAuthProvider.credential(user.email, currentPassword),
      );
      await updatePassword(user, password);
    } else {
      await linkWithCredential(
        user,
        EmailAuthProvider.credential(user.email, password),
      );
    }
    // Nothing tells the window on its own: no uid changed, so no auth-state
    // listener runs and the panel would go on offering "Set a password" for an
    // account that now has one.
    await user.reload().catch(() => {});
    deps?.onStatus?.(publicStatus());
    return { success: true };
  } catch (err) {
    // Deliberately NOT through setStatus: a mistyped password here must not
    // leave a sticky error on the status the sidebar reads.
    return { success: false, error: err.code || err.message };
  }
}

export async function signOutSync() {
  sessionNumber += 1;
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
  setStatus({
    signedIn: false,
    email: null,
    state: "off",
    error: null,
    errorCode: null,
  });
  return { success: true };
}

export async function reportAuthToken() {
  return auth?.currentUser ? auth.currentUser.getIdToken() : null;
}
