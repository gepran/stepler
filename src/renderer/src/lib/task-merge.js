const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
};
const same = (a, b) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/** Merge independent changes against the version this device actually saw. */
export function mergeTaskEdits(base, local, remote) {
  if (!remote) return local;
  // A permanent tombstone always wins over an old device's queued edits.
  if (remote.purged || local.purged) {
    const source = remote.purged ? remote : local;
    return {
      id: source.id,
      text: "",
      ymd: source.ymd,
      completed: false,
      deleted: true,
      priority: false,
      purged: true,
    };
  }
  if (!base) return { ...remote, ...local };
  const result = { ...remote };
  for (const key of new Set([...Object.keys(base), ...Object.keys(local)])) {
    if (["updatedAt", "id", "subtasks", "projects"].includes(key)) continue;
    if (same(base[key], local[key])) continue;
    if (key in local) result[key] = local[key];
    else delete result[key];
  }
  if (!same(base.projects, local.projects)) {
    const old = new Set(base.projects || []);
    const wanted = new Set(local.projects || []);
    const removed = new Set([...old].filter((name) => !wanted.has(name)));
    const projects = [
      ...new Set([
        ...(remote.projects || []).filter((name) => !removed.has(name)),
        ...(local.projects || []).filter((name) => !old.has(name)),
      ]),
    ];
    if (projects.length) result.projects = projects;
    else delete result.projects;
  }
  if (!same(base.subtasks, local.subtasks)) {
    const subtasks = mergeSubtasks(
      base.subtasks || [],
      local.subtasks || [],
      remote.subtasks || [],
    );
    if (subtasks.length) result.subtasks = subtasks;
    else delete result.subtasks;
  }
  return result;
}

export function mergeSubtasks(base, local, remote) {
  const old = new Map(
    base.filter((t) => t?.id != null).map((t) => [String(t.id), t]),
  );
  const wanted = new Map(
    local.filter((t) => t?.id != null).map((t) => [String(t.id), t]),
  );
  const latest = new Map(
    remote.filter((t) => t?.id != null).map((t) => [String(t.id), t]),
  );
  for (const id of old.keys()) if (!wanted.has(id)) latest.delete(id);
  for (const [id, row] of wanted) {
    const before = old.get(id);
    if (before && !latest.has(id)) continue; // preserve a concurrent removal
    if (!before || !same(before, row))
      latest.set(id, mergeTaskEdits(before, row, latest.get(id)));
  }
  // Preserve local drag order while keeping children added elsewhere.
  return [...wanted.keys()]
    .filter((id) => latest.has(id))
    .map((id) => latest.get(id))
    .concat(
      [...latest.entries()]
        .filter(([id]) => !wanted.has(id))
        .map(([, row]) => row),
    );
}
