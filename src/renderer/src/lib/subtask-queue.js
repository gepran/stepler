/** Persist only the completion operation, never a stale whole child array. */
export function createSubtaskQueue({
  storage,
  commit,
  isOnline,
  isAuthorized,
  newId,
}) {
  const workers = new Map();
  const listeners = new Map();
  const key = (uid) => `stepler.subtask-edits.${uid}`;
  function read(uid) {
    const raw = storage.getItem(key(uid));
    if (!raw) return [];
    const rows = JSON.parse(raw);
    if (
      !Array.isArray(rows) ||
      rows.some(
        (r) =>
          typeof r?.id !== "string" ||
          typeof r.taskID !== "string" ||
          typeof r.childID !== "string" ||
          typeof r.completed !== "boolean",
      )
    )
      throw new Error(
        "Saved subtask changes could not be read. They have been preserved.",
      );
    return rows;
  }
  const notify = (uid) => listeners.get(uid)?.forEach((fn) => fn());
  function enqueue(uid, taskID, childID, completed) {
    storage.setItem(
      key(uid),
      JSON.stringify([
        ...read(uid),
        {
          id: newId(),
          taskID: String(taskID),
          childID: String(childID),
          completed: !!completed,
        },
      ]),
    );
    notify(uid);
  }
  function overlay(uid, tasks) {
    const edits = read(uid);
    return tasks.map((row) => {
      const pending = edits.filter((op) => op.taskID === String(row.id));
      if (!pending.length || row.purged) return row;
      return {
        ...row,
        subtasks: (row.subtasks || []).map((child) => {
          const operation = pending
            .filter((op) => op.childID === String(child.id))
            .at(-1);
          return operation
            ? { ...child, completed: operation.completed }
            : child;
        }),
      };
    });
  }
  function flush(uid) {
    if (workers.has(uid)) return workers.get(uid);
    const job = (async () => {
      while (isOnline() && isAuthorized(uid)) {
        const operation = read(uid)[0];
        if (!operation) return;
        await commit(uid, operation);
        // Re-read after the server acknowledges: another tab may have queued
        // additional changes while this transaction was in flight.
        storage.setItem(
          key(uid),
          JSON.stringify(read(uid).filter((op) => op.id !== operation.id)),
        );
        notify(uid);
      }
    })().finally(() => workers.delete(uid));
    workers.set(uid, job);
    return job;
  }
  function watch(uid, fn) {
    if (!listeners.has(uid)) listeners.set(uid, new Set());
    listeners.get(uid).add(fn);
    return () => {
      listeners.get(uid)?.delete(fn);
      if (!listeners.get(uid)?.size) listeners.delete(uid);
    };
  }
  return { enqueue, overlay, flush, watch };
}
