import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { localYMD, taskTimestamp } from "../renderer/src/lib/format";

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

export async function addTask(uid, text) {
  const id = String(Date.now());
  await setDoc(
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
  return id;
}

export function setCompleted(uid, id, completed) {
  return updateDoc(taskRef(uid, id), stamp({ completed: !!completed }));
}

export function setPriority(uid, id, priority) {
  return updateDoc(taskRef(uid, id), stamp({ priority: !!priority }));
}

export function setText(uid, id, text) {
  return updateDoc(
    taskRef(uid, id),
    stamp({ text: String(text).slice(0, 20000) }),
  );
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
          // The desktop app stores attachments as local file ids that mean
          // nothing on another machine; drop the reference rather than ship a
          // broken one.
          attachment: deleteField(),
        }),
        { merge: true },
      );
      written += 1;
    }
    await batch.commit();
  }
  return written;
}
