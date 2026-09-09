import {
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { localYMD, taskTimestamp } from "../renderer/src/lib/format";
import { newTaskId } from "../renderer/src/lib/ids";

/**
 * One document per task under the signed-in user. The desktop app keeps every
 * task in a single JSON file, which cannot work here: Firestore caps a
 * document at 1 MB, and a whole-file write would make two devices editing
 * different tasks overwrite each other wholesale.
 */
const tasksRef = (uid) => collection(db, "users", uid, "tasks");
const taskRef = (uid, id) => doc(db, "users", uid, "tasks", id);

/** The day a task belongs to, derived the same way the desktop app derives it. */
export function ymdForTask(id) {
  const stamp = taskTimestamp(id);
  return localYMD(stamp || new Date());
}

/**
 * Live subscription. Firestore replays the local cache first and then the
 * server copy, so the list paints instantly on a reload and corrects itself a
 * moment later if another device changed something meanwhile.
 *
 * Deleted tasks are tombstones rather than absences — a real delete would be
 * invisible to a device that was offline when it happened, and that device
 * would helpfully resurrect the task on its next sync.
 */
export function subscribeTasks(uid, onChange, onError) {
  return onSnapshot(
    tasksRef(uid),
    (snap) => {
      const active = [];
      const deleted = [];
      snap.forEach((d) => {
        const data = { ...d.data(), id: d.id };
        (data.deleted ? deleted : active).push(data);
      });
      onChange({
        tasks: active,
        deletedTasks: deleted,
        fromCache: snap.metadata.fromCache,
      });
    },
    (err) => onError?.(err),
  );
}

/**
 * Every write stamps `updatedAt` from the server clock. The rules refuse any
 * other value, which is what stops a device with a wrong clock from winning a
 * last-write-wins race it should have lost.
 */
function stamp(fields) {
  return { ...fields, updatedAt: serverTimestamp() };
}

/**
 * Returns the new id straight away, plus the promise for the write itself.
 *
 * They are separate on purpose. Firestore does not settle a write until the
 * server has acknowledged it, so offline that promise never resolves — while
 * the row appears instantly from the local cache. Anything awaiting it offline
 * waits forever, which is how an attached photo used to go missing without a
 * word. The id is minted here, so nothing has to wait for it.
 */
export function addTask(uid, text) {
  const id = newTaskId();
  const written = setDoc(
    taskRef(uid, id),
    stamp({
      id,
      text: String(text).slice(0, 20000),
      ymd: ymdForTask(id),
      completed: false,
      deleted: false,
      priority: false,
    }),
  );
  return { id, written };
}

export function setCompleted(uid, id, completed) {
  return updateDoc(taskRef(uid, id), stamp({ completed: !!completed }));
}

export function setPriority(uid, id, priority) {
  return updateDoc(taskRef(uid, id), stamp({ priority: !!priority }));
}

/**
 * Subtasks ride inside the task document as an array, so ticking one off means
 * writing the whole array back. The array is passed in rather than re-read from
 * the server: the caller is already rendering it, and a read here would cost a
 * round trip and still fail offline — which is precisely where this app is
 * meant to keep working. Every other field on the subtask is carried over
 * untouched, so an attachment the desktop knows about survives a tap here.
 */
export async function setSubtaskCompleted(
  uid,
  id,
  subtasks,
  subtaskId,
  completed,
) {
  const target = taskRef(uid, id);
  let base = subtasks || [];
  try {
    // Online this is the server's copy; offline it comes straight out of the
    // IndexedDB cache and resolves rather than rejecting. Either way it is
    // fresher than the array this row was rendered from, which matters because
    // the write below replaces the whole array — a stale one would delete a
    // subtask another device added in the meantime.
    const snap = await getDoc(target);
    if (snap.exists() && Array.isArray(snap.data().subtasks))
      base = snap.data().subtasks;
  } catch (err) {
    console.warn("Could not re-read the subtasks:", err.code || err.message);
  }
  const next = base.map((st) =>
    // A legacy row can be missing its id entirely, and String(undefined) would
    // then match every other id-less subtask at once.
    st.id != null && String(st.id) === String(subtaskId)
      ? { ...st, completed: !!completed }
      : st,
  );
  return updateDoc(target, stamp({ subtasks: next }));
}

export function setText(uid, id, text) {
  return updateDoc(
    taskRef(uid, id),
    stamp({ text: String(text).slice(0, 20000) }),
  );
}

/**
 * The bytes are already in Storage by the time this runs — all this records is
 * where. The whole object is written rather than merged into, so replacing one
 * attachment with another cannot leave the previous one's width behind.
 */
export function setAttachment(uid, id, attachment) {
  return updateDoc(taskRef(uid, id), stamp({ attachment }));
}

export function deleteTask(uid, id) {
  return updateDoc(taskRef(uid, id), stamp({ deleted: true }));
}

export function restoreTask(uid, id) {
  return updateDoc(taskRef(uid, id), stamp({ deleted: false }));
}

/**
 * Import from the desktop app's export file. Firestore batches cap at 500
 * writes, so a long history is committed in chunks rather than one request
 * that would be rejected for being too big.
 */
export async function importTasks(uid, tasks) {
  const flat = tasks.filter((t) => t && t.id && typeof t.text === "string");
  let written = 0;
  for (let i = 0; i < flat.length; i += 400) {
    const batch = writeBatch(db);
    for (const t of flat.slice(i, i + 400)) {
      const id = String(t.id);
      batch.set(
        taskRef(uid, id),
        stamp({
          id,
          text: String(t.text).slice(0, 20000),
          ymd: t.ymd || ymdForTask(id),
          completed: !!t.completed,
          deleted: !!t.deleted,
          priority: !!t.priority,
          // An attachment is worth carrying only once its bytes are somewhere
          // both machines can reach. A bare local file id is not — it names a
          // file in one machine's app folder — so it is dropped, while a
          // storagePath is kept.
          attachment: t.attachment?.storagePath
            ? {
                name: String(t.attachment.name || "attachment").slice(0, 120),
                type: t.attachment.type === "image" ? "image" : "file",
                storagePath: t.attachment.storagePath,
              }
            : deleteField(),
        }),
        { merge: true },
      );
      written += 1;
    }
    await batch.commit();
  }
  return written;
}
