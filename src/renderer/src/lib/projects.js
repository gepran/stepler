import { validLabelColor } from "./labels.js";

export function normalizeProjects(projects) {
  const result = new Map();
  for (const project of Array.isArray(projects) ? projects : []) {
    const raw = typeof project === "string" ? project : project?.name;
    if (typeof raw !== "string") continue;
    const name = raw.trim().slice(0, 80);
    if (!name) continue;
    const color = validLabelColor(project?.color);
    result.set(name, {
      name,
      isFavorite: !!project?.isFavorite,
      ...(color ? { color } : {}),
    });
  }
  return [...result.values()];
}

export function sortProjects(projects) {
  return normalizeProjects(projects).sort((a, b) =>
    a.isFavorite !== b.isFavorite
      ? a.isFavorite
        ? -1
        : 1
      : a.name.localeCompare(b.name),
  );
}

/** Executed in the main process against its live copy, without a read/write race. */
export function mutateProjects(projects, operation) {
  const list = normalizeProjects(projects);
  const name =
    typeof operation?.name === "string"
      ? operation.name.trim().slice(0, 80)
      : "";
  if (operation?.type === "remember") {
    const known = new Set(list.map((p) => p.name));
    return [
      ...list,
      ...normalizeProjects(operation.names).filter((p) => !known.has(p.name)),
    ];
  }
  if (!name) throw new Error("Project name required");
  const existing = list.find((p) => p.name === name);
  if (operation.type === "add") {
    return existing ? list : [...list, { name, isFavorite: false }];
  }
  if (!existing) throw new Error("Project no longer exists");
  if (operation.type === "remove") return list.filter((p) => p.name !== name);
  if (operation.type === "rename") {
    const nextName =
      typeof operation.nextName === "string"
        ? operation.nextName.trim().slice(0, 80)
        : "";
    if (!nextName) throw new Error("Project name required");
    if (nextName !== name && list.some((p) => p.name === nextName))
      throw new Error("Project already exists");
    return list.map((p) => (p.name === name ? { ...p, name: nextName } : p));
  }
  if (operation.type === "favorite") {
    return list.map((p) =>
      p.name === name ? { ...p, isFavorite: !p.isFavorite } : p,
    );
  }
  if (operation.type === "color") {
    const color = validLabelColor(operation.color);
    if (!color) throw new Error("Invalid project color");
    return list.map((p) => (p.name === name ? { ...p, color } : p));
  }
  throw new Error("Invalid project operation");
}

export function rewriteProjectInData(data, name, nextName = null) {
  const rewrite = (task) => {
    const result = { ...task };
    if (Array.isArray(task.projects)) {
      result.projects = [
        ...new Set(
          task.projects.flatMap((p) =>
            p === name ? (nextName ? [nextName] : []) : [p],
          ),
        ),
      ];
      if (!result.projects.length) delete result.projects;
    }
    if (Array.isArray(task.subtasks))
      result.subtasks = task.subtasks.map(rewrite);
    return result;
  };
  return {
    ...data,
    tasks: (data.tasks || []).map(rewrite),
    history: (data.history || []).map((day) => ({
      ...day,
      tasks: (day.tasks || []).map(rewrite),
    })),
    deletedTasks: (data.deletedTasks || []).map(rewrite),
  };
}

export function projectNamesInData(data) {
  const names = new Set();
  const visit = (task) => {
    if (task?.mention) return;
    (Array.isArray(task?.projects) ? task.projects : []).forEach((name) =>
      names.add(name),
    );
    (Array.isArray(task?.subtasks) ? task.subtasks : []).forEach(visit);
  };
  (data.tasks || []).forEach(visit);
  (data.history || []).forEach((day) => (day.tasks || []).forEach(visit));
  return [...names];
}
