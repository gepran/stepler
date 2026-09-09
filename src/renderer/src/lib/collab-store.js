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
import { newTaskId } from "./ids";

export { connectionLabel, resolveMentions };

const profileRef = (db, uid) => doc(db, "profiles", uid);
const emailRef = (db, address) => doc(db, "emails", address);
const handleRef = (db, handle) => doc(db, "usernames", handle);
const connectionsRef = (db, uid) => collection(db, "users", uid, "connections");
const connectionRef = (db, uid, other) =>
  doc(db, "users", uid, "connections", other);
const mentionsRef = (db, uid) => collection(db, "users", uid, "mentions");
const mentionRef = (db, uid, taskId) =>
  doc(db, "users", uid, "mentions", String(taskId));
const sentRef = (db, uid) => doc(db, "users", uid, "meta", "mentions");

const stamp = (fields) => ({ ...fields, updatedAt: serverTimestamp() });

/**
 * The document id an address is filed under: the address, lowercased. Returns
 * "" for anything that cannot be a Firestore document id, so a rare address
 * carrying a slash simply goes unregistered instead of throwing at sign-in.
 */
function emailKey(address) {
  const clean = String(address || "")
    .trim()
    .toLowerCase();
  if (!clean || clean.length > 400) return "";
  if (clean.includes("/") || clean.startsWith("__")) return "";
  if (clean === "." || clean === "..") return "";
  return clean;
}

/**
 * What every signed-in account may read about you — deliberately not your
 * email address. `allow read` on /profiles covers `list` as well as `get`, so
 * anything in this document can be paged out of the collection wholesale by a
 * single throwaway account. The address lives in /emails instead, where it is
 * the document id and listing is denied: an address you were given can be
 * looked up, addresses you were not cannot be harvested.
 */
function publicCardFor(user, username) {
  return {
    uid: user.uid,
    username,
    usernameLower: username,
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
  };
}

/**
 * Write the two documents that make an account findable: the public card, and
 * the address entry pointing at it. `email: deleteField()` is what clears the
 * address out of profiles written by a version that still put it there.
 */
async function writeIdentity(db, user, username) {
  const card = publicCardFor(user, username);
  await setDoc(
    profileRef(db, user.uid),
    stamp({ ...card, email: deleteField() }),
    {
      merge: true,
    },
  );
  const key = emailKey(user.email);
  if (key) {
    // Not fatal. The rules refuse an address that is not the one on this
    // account's own token, and being unfindable by email is a far smaller
    // problem than a sign-in that fails.
    await setDoc(emailRef(db, key), stamp({ uid: user.uid }), {
      merge: true,
    }).catch((err) =>
      console.warn("Could not register the address:", err.code || err.message),
    );
  }
  return card;
}

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
    const card = publicCardFor(user, username);
    // A legacy `email` still sitting on the card counts as stale: rewriting is
    // what removes it, and every sign-in is a chance to.
    const stale =
      existing.data().email !== undefined ||
      ["displayName", "photoURL"].some((k) => existing.data()[k] !== card[k]);
    if (stale) await writeIdentity(db, user, username);
    // Your own address travels with your own card: connection rows are private
    // to the person holding them, so they may carry it.
    return { ...existing.data(), ...card, email: user.email || "" };
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
      const card = await writeIdentity(db, user, candidate);
      return { ...card, email: user.email || "" };
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
    // A get, not a query. The collection cannot be listed, so an address can be
    // confirmed but never discovered.
    const key = emailKey(raw);
    const hit = key ? await getDoc(emailRef(db, key)).catch(() => null) : null;
    const uid = hit && hit.exists() ? hit.data().uid : null;
    if (uid) {
      const prof = await getDoc(profileRef(db, uid)).catch(() => null);
      if (prof && prof.exists()) found.set(prof.id, prof.data());
    }
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
export function removeConnection(db, me, otherUid) {
  if (!me?.uid || !otherUid) return false;
  // One batch, like sendInvite and acceptInvite, so a disconnect cannot land
  // on one side only. And deliberately not awaited: a Firestore write does not
  // settle while offline, and the second delete used to never even be issued.
  const batch = writeBatch(db);
  batch.delete(connectionRef(db, me.uid, otherUid));
  batch.delete(connectionRef(db, otherUid, me.uid));
  batch
    .commit()
    .catch((err) =>
      console.warn("Disconnect did not land:", err.code || err.message),
    );
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
      snap.forEach((d) => {
        const data = { ...d.data(), id: d.id };
        // Dismissed rows are filtered here rather than in each app, so the
        // two cannot disagree about what is on your list.
        if (!data.dismissed) list.push(data);
      });
      onChange(list);
    },
    (err) => onError?.(err),
  );
}

/**
 * Take a mention off my list.
 *
 * A flag rather than a delete, and that is the whole trick: deleting the
 * document would only last until the author's next delivery pass, which
 * rewrites every task it still believes it has sent you and would put this
 * one straight back. The flag survives that, because the author's write
 * merges a body that has never heard of it.
 *
 * The author's own task is untouched. This removes it from your list, not
 * from theirs — deleting somebody else's task is not yours to do.
 */
export function dismissMention(db, uid, taskId) {
  return setDoc(mentionRef(db, uid, taskId), stamp({ dismissed: true }), {
    merge: true,
  });
}

/**
 * The only fields somebody you mentioned is allowed to move. The rules enforce
 * this too — this is here so a client cannot even try, and so the two lists
 * are visibly the same list.
 */
export const MENTION_EDITABLE = ["completed", "priority", "subtasks"];

/**
 * A change made by the person who was mentioned, rather than by the author.
 *
 * Two documents, deliberately. The author's task is the source of truth and is
 * what the author's own devices read, so it has to move — but the mention is
 * what the MENTIONED person's screen is rendering, and waiting for the author's
 * laptop to wake up and copy the change back would mean a subtask that
 * vanishes the moment you add it. So both are written, with the same values.
 *
 * Settled with allSettled rather than all: the two writes are independent, and
 * one of them failing (a connection dropped between us, say) must not leave
 * the other unsent.
 */
export async function updateMentionedTask(db, { meUid, mention, patch }) {
  const taskId = String(mention?.taskId || mention?.id || "");
  const author = mention?.fromUid;
  if (!taskId || !author || !meUid) return false;

  // Anything outside the permitted set is dropped here rather than sent and
  // refused: a rejected write takes the whole batch down with it.
  const clean = {};
  for (const key of MENTION_EDITABLE) {
    if (patch[key] !== undefined) clean[key] = patch[key];
  }
  if (!Object.keys(clean).length) return false;

  const results = await Promise.allSettled([
    updateDoc(doc(db, "users", author, "tasks", taskId), stamp(clean)),
    setDoc(mentionRef(db, meUid, taskId), stamp(clean), { merge: true }),
  ]);
  for (const r of results) {
    if (r.status === "rejected")
      console.warn(
        "A mention edit did not land:",
        r.reason?.code || r.reason?.message,
      );
  }
  return results.some((r) => r.status === "fulfilled");
}

/**
 * Add a subtask to a task somebody else wrote.
 *
 * The id is minted from the clock the same way a task's is, so it cannot
 * collide with one the author adds at the other end.
 */
export function addMentionSubtask(db, { meUid, mention, text }) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return Promise.resolve(false);
  const subtasks = [
    ...(Array.isArray(mention.subtasks) ? mention.subtasks : []),
    { id: newTaskId(), text: trimmed.slice(0, 20000), completed: false },
  ];
  return updateMentionedTask(db, { meUid, mention, patch: { subtasks } });
}

export function setMentionSubtaskCompleted(
  db,
  { meUid, mention, subtaskId, completed },
) {
  const subtasks = (mention.subtasks || []).map((st) =>
    // A legacy subtask can have no id at all, and String(undefined) would then
    // match every other id-less one at once.
    st.id != null && String(st.id) === String(subtaskId)
      ? { ...st, completed: !!completed }
      : st,
  );
  return updateMentionedTask(db, { meUid, mention, patch: { subtasks } });
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
    // Carried so the mentioned person can see and work on them. Without these
    // their copy would be a sentence with no subtasks under it, and the star
    // would have nothing to reflect.
    priority: !!task.priority,
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
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
