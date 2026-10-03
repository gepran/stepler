import { mergeTaskEdits } from "../renderer/src/lib/task-merge.js";

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
  (data?.purgedTasks || []).forEach((t) => push(t, true));
  return out;
}

/** Put a flat list back into the today / history / trash shape the app stores. */
export function rebuildLocal(flat, todayYMD) {
  const tasks = [];
  const deletedTasks = [];
  const purgedTasks = [];
  const byDay = new Map();
  for (const t of flat) {
    const { deleted, ...rest } = t;
    const ymd = t.ymd;
    if (t.purged) {
      purgedTasks.push(rest);
      continue;
    }
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
  return { tasks, history, deletedTasks, purgedTasks };
}

export const CARRIED = [
  "priority",
  "purged",
  "sortOrder",
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
export function signature(t) {
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

export function taskFromSignature(value, id) {
  try {
    const [text, completed, deleted, ymd, ...fields] = JSON.parse(value);
    const task = { id, text, completed, deleted, ymd };
    CARRIED.forEach((key, index) => {
      if (fields[index] != null) task[key] = fields[index];
    });
    return task;
  } catch {
    return null;
  }
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
    const base = taskFromSignature(shadow[r.id], r.id);
    if (shadow[r.id] !== signature(local) && !base) continue;
    const next =
      shadow[r.id] !== signature(local)
        ? mergeTaskEdits(base, local, r)
        : { ...local, ...r };
    // Merge writes remove optional keys in Firestore. Absence in a remote
    // document therefore means deletion here, not preservation of stale data.
    for (const key of CARRIED)
      if (!(key in r) && (!base || signature(local) === shadow[r.id]))
        delete next[key];
    if (
      r.attachment?.storagePath &&
      r.attachment.storagePath === local.attachment?.storagePath &&
      local.attachment.id &&
      !r.attachment.id
    ) {
      next.attachment = { ...r.attachment, id: local.attachment.id };
    }
    // An echo of our own write carries no news. Applying it anyway would
    // rewrite the file and start another push on every snapshot.
    // Learn the remote baseline even when our queued edit remains visible.
    if (signature(next) === signature(local)) {
      if (shadow[r.id] !== signature(r)) applied.push(r);
      continue;
    }
    byId.set(r.id, next);
    applied.push(r);
    changed += 1;
  }
  return { merged: [...byId.values()], changed, applied };
}
