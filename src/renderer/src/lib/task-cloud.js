import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { mergeTaskEdits } from "./task-merge.js";

export function commitSubtaskCompletion(db, uid, operation) {
  return runTransaction(db, async (transaction) => {
    const target = doc(db, "users", uid, "tasks", operation.taskID);
    const snapshot = await transaction.get(target);
    if (!snapshot.exists() || snapshot.data().purged) return;
    const subtasks = (snapshot.data().subtasks || []).map((child) =>
      String(child.id) === operation.childID
        ? { ...child, completed: operation.completed }
        : child,
    );
    transaction.update(target, { subtasks, updatedAt: serverTimestamp() });
  });
}

export function commitTaskEdit(
  db,
  {
    uid,
    task,
    base,
    toDocument = (t) => ({ ...t, updatedAt: serverTimestamp() }),
    fromDocument = (t) => t,
  },
) {
  return runTransaction(db, async (transaction) => {
    const target = doc(db, "users", uid, "tasks", String(task.id));
    const snapshot = await transaction.get(target);
    const remote = snapshot.exists()
      ? fromDocument({ ...snapshot.data(), id: task.id })
      : null;
    const merged = mergeTaskEdits(base, task, remote);
    transaction.set(target, toDocument(merged));
    return merged;
  });
}
