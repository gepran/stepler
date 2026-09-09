/**
 * Collaboration against Firestore.
 *
 * Every function takes `db` rather than importing one, because the two clients
 * that need this hold different instances: the web app's browser SDK and the
 * desktop's main-process SDK, signed in through a file-backed session. Writing
 * the handshake twice was the alternative, and an invitation that half-arrives
 * because one copy drifted is not a bug you find quickly.
 *
 * The shapes:
 *   profiles/{uid}                     public card — handle, email, name, photo
 *   usernames/{handle}                 the claim on a name; the id IS the lock
 *   users/{uid}/connections/{otherUid} one row per person, both ends written
 *   users/{uid}/mentions/{taskId}      a copy of a task somebody addressed to you
 *   users/{uid}/meta/mentions          who I have sent each of my tasks to
 */

import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  connectionLabel,
  handleCandidates,
  normalizeHandle,
  resolveMentions,
  usernameFromEmail,
} from "./collab";

export { connectionLabel, resolveMentions };

const profileRef = (db, uid) => doc(db, "profiles", uid);
const handleRef = (db, handle) => doc(db, "usernames", handle);
const connectionsRef = (db, uid) => collection(db, "users", uid, "connections");
const connectionRef = (db, uid, other) =>
  doc(db, "users", uid, "connections", other);
const mentionsRef = (db, uid) => collection(db, "users", uid, "mentions");
const mentionRef = (db, uid, taskId) =>
  doc(db, "users", uid, "mentions", String(taskId));
const sentRef = (db, uid) => doc(db, "users", uid, "meta", "mentions");

const stamp = (fields) => ({ ...fields, updatedAt: serverTimestamp() });

/** What another person is allowed to learn about an account. */
function cardFor(user, username) {
  return {
    uid: user.uid,
    username,
    usernameLower: username,
    email: user.email || "",
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
  };
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/**
 * Make sure this account has a handle, and hand it back.
 *
 * The handle is derived from the email on first sign-in — testeruser@gmail.com
 * becomes @testeruser — and then never changes on its own, because it is the
 * name other people have already typed into their tasks.
 *
 * Uniqueness is the document id doing the work: a create against an id that
 * exists fails, and the loop moves to the next candidate. There is no
 * transaction here on purpose — a create that loses a race fails on its own,
 * which is exactly the outcome a transaction would have arranged more slowly.
 */
export async function ensureProfile(db, user) {
  if (!user?.uid) return null;

  const existing = await getDoc(profileRef(db, user.uid));
  if (existing.exists() && existing.data().username) {
    const username = existing.data().username;
    // The email or the Google photo can change under a handle that does not.
    // Refreshed quietly so the card other people see does not go stale.
    const card = cardFor(user, username);
    const stale = ["email", "displayName", "photoURL"].some(
      (k) => existing.data()[k] !== card[k],
    );
    if (stale) {
      await setDoc(profileRef(db, user.uid), stamp(card), { merge: true });
    }
    return { ...existing.data(), ...card };
  }

  const base = usernameFromEmail(user.email) || `user${user.uid.slice(0, 6)}`;
  for (const candidate of handleCandidates(base)) {
    const claim = handleRef(db, candidate);
    try {
      // `create` semantics: setDoc with no merge still overwrites, so the guard
      // is the rules' `allow create` plus a read of what is already there.
      const held = await getDoc(claim);
      if (held.exists()) {
        if (held.data().uid !== user.uid) continue; // somebody else's name
      } else {
        await setDoc(claim, stamp({ uid: user.uid, username: candidate }));
      }
      const card = cardFor(user, candidate);
      await setDoc(profileRef(db, user.uid), stamp(card), { merge: true });
      return card;
    } catch (err) {
      // A lost race looks exactly like this. Try the next candidate rather
      // than failing sign-in over a name.
      if (err?.code === "permission-denied") continue;
      throw err;
    }
  }
  return null;
}

/** My own card, or null if this account has not claimed a handle yet. */
export async function readProfile(db, uid) {
  const snap = await getDoc(profileRef(db, uid));
  return snap.exists() ? snap.data() : null;
}

/**
 * Find people to connect to. A handle is matched by prefix, so typing "test"
 * finds @testeruser; a full email address is matched exactly, because that is
 * the other thing a person actually knows about a colleague.
 *
 * Both are single-field queries, so neither needs a composite index.
 */
export async function searchProfiles(db, term, { self, max = 8 } = {}) {
  const raw = String(term || "").trim();
  if (raw.length < 2) return [];
  const found = new Map();

  const handle = normalizeHandle(raw);
  if (handle) {
    const snap = await getDocs(
      query(
        collection(db, "profiles"),
        orderBy("usernameLower"),
        where("usernameLower", ">=", handle),
        // The upper bound ends in U+F8FF, a private-use code point that
        // sorts after every character a handle may contain — which is how
        // a pair of range bounds spells "starts with".
        where("usernameLower", "<=", `${handle}`),
        limit(max),
      ),
    );
    snap.forEach((d) => found.set(d.id, d.data()));
  }

  if (raw.includes("@") && raw.includes(".")) {
    const snap = await getDocs(
      query(
        collection(db, "profiles"),
        where("email", "==", raw.toLowerCase()),
        limit(max),
      ),
    );
    snap.forEach((d) => found.set(d.id, d.data()));
  }

  return [...found.values()]
    .filter((p) => p.uid && p.uid !== self)
    .slice(0, max);
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

/**
 * Both halves of a connection are written at once, and the rules allow it
 * because each side writes only the row keyed by its own uid in the other's
 * list. The invitation is `pending` for the person who sent it and `incoming`
 * for the person who has to answer.
 *
 * A batch, so an invitation cannot exist on one side only.
 */
export async function sendInvite(db, me, target) {
  if (!me?.uid || !target?.uid || me.uid === target.uid) return false;
  const batch = writeBatch(db);
  batch.set(
    connectionRef(db, me.uid, target.uid),
    stamp({ ...cardFor(target, target.username), status: "pending" }),
    { merge: true },
  );
  batch.set(
    connectionRef(db, target.uid, me.uid),
    stamp({ ...cardFor(me, me.username), status: "incoming" }),
    { merge: true },
  );
  await batch.commit();
  return true;
}

/** Accept, and tell the other side — after which each may mention the other. */
export async function acceptInvite(db, me, other) {
  if (!me?.uid || !other?.uid) return false;
  const batch = writeBatch(db);
  batch.set(
    connectionRef(db, me.uid, other.uid),
    stamp({ ...cardFor(other, other.username), status: "accepted" }),
    { merge: true },
  );
  batch.set(
    connectionRef(db, other.uid, me.uid),
    stamp({ ...cardFor(me, me.username), status: "accepted" }),
    { merge: true },
  );
  await batch.commit();
  return true;
}

/**
 * Disconnect, or decline. Both rows go, so neither side is left looking at a
 * connection the other has forgotten. The mentions already delivered are left
 * alone: they are a copy of something that was genuinely said, and the rules
 * would refuse to reach into that person's list once we are no longer
 * connected anyway.
 */
export async function removeConnection(db, me, otherUid) {
  if (!me?.uid || !otherUid) return false;
  await deleteDoc(connectionRef(db, me.uid, otherUid)).catch(() => {});
  await deleteDoc(connectionRef(db, otherUid, me.uid)).catch(() => {});
  return true;
}

/** Live list of everybody I have invited, been invited by, or accepted. */
export function subscribeConnections(db, uid, onChange, onError) {
  return onSnapshot(
    connectionsRef(db, uid),
    (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ ...d.data(), uid: d.id }));
      list.sort((a, b) =>
        String(a.username || "").localeCompare(String(b.username || "")),
      );
      onChange(list);
    },
    (err) => onError?.(err),
  );
}

// ---------------------------------------------------------------------------
// Mentions
// ---------------------------------------------------------------------------

/** Live list of the tasks other people have addressed to me. */
export function subscribeMentions(db, uid, onChange, onError) {
  return onSnapshot(
    mentionsRef(db, uid),
    (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id }));
      onChange(list);
    },
    (err) => onError?.(err),
  );
}

export function markMentionRead(db, uid, mentionId, read = true) {
  return updateDoc(mentionRef(db, uid, mentionId), stamp({ read: !!read }));
}

/** Everything I have been sent, marked read in one pass. */
export async function markAllMentionsRead(db, uid, mentions) {
  const unread = (mentions || []).filter((m) => !m.read);
  if (!unread.length) return 0;
  for (let i = 0; i < unread.length; i += 400) {
    const batch = writeBatch(db);
    for (const m of unread.slice(i, i + 400)) {
      batch.set(mentionRef(db, uid, m.id), stamp({ read: true }), {
        merge: true,
      });
    }
    await batch.commit();
  }
  return unread.length;
}

/** Who each of my tasks has already been delivered to, as `{ taskId: [uid] }`. */
export async function readSentMap(db, uid) {
  try {
    const snap = await getDoc(sentRef(db, uid));
    return snap.exists() ? snap.data().sent || {} : {};
  } catch (err) {
    console.warn("Could not read the mention log:", err.code || err.message);
    return {};
  }
}

/**
 * Deliver a task to everybody it names, and take it back from everybody it
 * used to name.
 *
 * `sent` is my own record of who already has which task — kept in my space
 * rather than inferred, because working it out would mean reading other
 * people's mention lists, which nothing here is allowed to do. It is passed in
 * and handed back patched so a caller reconciling a hundred tasks reads and
 * writes the log once rather than a hundred times.
 *
 * A mention arrives unread; a later edit to the same task updates the text in
 * place and leaves the read flag alone, so fixing a typo does not ping anybody
 * a second time.
 */
export async function reconcileTaskMentions(
  db,
  { me, task, connections, sent },
) {
  const taskId = String(task.id);
  const previous = Array.isArray(sent?.[taskId]) ? sent[taskId] : [];
  // A task on its way to the trash is addressed to nobody.
  const targets = task.deleted
    ? []
    : resolveMentions(task.text, connections || []);
  const targetIds = targets.map((c) => c.uid);

  const added = targets.filter((c) => !previous.includes(c.uid));
  const kept = targets.filter((c) => previous.includes(c.uid));
  const gone = previous.filter((uid) => !targetIds.includes(uid));
  if (!added.length && !kept.length && !gone.length) return null;

  const body = {
    taskId,
    fromUid: me.uid,
    fromUsername: me.username || "",
    fromEmail: me.email || "",
    fromName: me.displayName || "",
    text: String(task.text || "").slice(0, 20000),
    ymd: task.ymd || "",
    completed: !!task.completed,
  };

  const writes = [];
  for (const person of added) {
    writes.push(
      setDoc(
        mentionRef(db, person.uid, taskId),
        stamp({ ...body, read: false }),
        {
          merge: true,
        },
      ),
    );
  }
  for (const person of kept) {
    // No `read` in the patch: an edit updates what they see without pulling
    // the task back into their unread badge.
    writes.push(
      setDoc(mentionRef(db, person.uid, taskId), stamp(body), { merge: true }),
    );
  }
  for (const uid of gone) {
    writes.push(deleteDoc(mentionRef(db, uid, taskId)).catch(() => {}));
  }

  // One failure must not lose the others: a person who has since disconnected
  // rejects the write, and the rest of the delivery should still happen.
  await Promise.allSettled(writes);

  return { taskId, targets: targetIds };
}

/**
 * Reconcile a batch of tasks and record the result once.
 *
 * Callers pass every task they own on the desktop, or the one that just
 * changed on the web; either way the log is read once at the top and written
 * once at the bottom.
 */
export async function reconcileMentions(db, { me, tasks, connections, sent }) {
  const log = sent || (await readSentMap(db, me.uid));
  const patch = {};
  let changed = 0;

  for (const task of tasks) {
    const result = await reconcileTaskMentions(db, {
      me,
      task,
      connections,
      sent: log,
    });
    if (!result) continue;
    changed += 1;
    if (result.targets.length) {
      patch[result.taskId] = result.targets;
      log[result.taskId] = result.targets;
    } else {
      patch[result.taskId] = deleteField();
      delete log[result.taskId];
    }
  }

  if (changed) {
    // Nested maps merge key by key, so this touches only the tasks that moved
    // and cannot clobber a delivery another device recorded a moment ago.
    await setDoc(sentRef(db, me.uid), stamp({ sent: patch }), { merge: true });
  }
  return { changed, sent: log };
}
