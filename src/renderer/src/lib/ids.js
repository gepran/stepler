/**
 * Ids for tasks and subtasks.
 *
 * Deliberately not a plain UUID. The millisecond a task was written is read
 * back out of its id in three places — `taskTimestamp` in ./format, and
 * `ymdForTask` in both the sync layer and the web store — to decide which day
 * the task belongs to and what order it sorts in. All of them read the id with
 * `parseInt`, which takes the leading digits and stops at the dash, so the
 * timestamp has to stay at the front. Nothing else about the id is inspected.
 *
 * The random tail is what makes it unique, and it is the point of this module.
 * `Date.now()` on its own repeats for every task created inside the same
 * millisecond: anything adding tasks in a loop — a script, the CLI, the MCP
 * server — gets one id for all of them. Because the id is also the Firestore
 * document name, two tasks that share one become a single document, and
 * locally `flattenLocal` keeps only the first of each id and writes the
 * shortened list back to disk. Duplicate ids do not collide loudly; they
 * delete tasks.
 *
 * Five random bytes rather than a counter, because the clients are separate
 * processes — desktop, web and the local API can each mint an id in the same
 * millisecond, and only randomness spans them.
 */
export function newTaskId(atMs) {
  const at = Number.isFinite(atMs) && atMs > 0 ? Math.floor(atMs) : Date.now();
  const tail = globalThis.crypto.getRandomValues(new Uint8Array(5));
  let suffix = "";
  for (const byte of tail) suffix += byte.toString(16).padStart(2, "0");
  return `${at}-${suffix}`;
}
