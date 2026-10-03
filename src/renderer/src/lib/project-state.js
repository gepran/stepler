import { mutateProjects, normalizeProjects } from "./projects.js";

export function normalizeProjectState(value = {}) {
  return {
    projects: normalizeProjects(value?.projects),
    removed: [
      ...new Set(
        (Array.isArray(value?.removed) ? value.removed : []).filter(
          (s) => typeof s === "string",
        ),
      ),
    ],
    renames: (Array.isArray(value?.renames) ? value.renames : []).filter(
      (r) => typeof r?.name === "string" && typeof r.nextName === "string",
    ),
    clocks: Object.fromEntries(
      Object.entries(value?.clocks || {}).filter(
        ([key, number]) =>
          /^[a-zA-Z0-9-]{1,80}$/.test(key) &&
          Number.isSafeInteger(number) &&
          number >= 0,
      ),
    ),
  };
}

export function projectNameInState(name, state) {
  for (const rename of state.renames)
    if (name === rename.name) name = rename.nextName;
  return state.removed.includes(name) ? null : name;
}

/** Apply to the current server version instead of replacing a stale whole list. */
export function applyProjectOperation(value, operation) {
  const state = normalizeProjectState(value);
  if (
    operation.deviceId &&
    state.clocks[operation.deviceId] >= operation.sequence
  )
    return state;
  if (operation.deviceId && Number.isSafeInteger(operation.sequence))
    state.clocks[operation.deviceId] = operation.sequence;
  const name =
    typeof operation?.name === "string"
      ? operation.name.trim().slice(0, 80)
      : "";
  if (operation.type === "remember") {
    const names = normalizeProjects(operation.names).filter(
      (p) =>
        !state.removed.includes(p.name) &&
        projectNameInState(p.name, state) === p.name,
    );
    state.projects = mutateProjects(state.projects, {
      type: "remember",
      names,
    });
    return state;
  }
  state.projects = mutateProjects(state.projects, operation);
  if (operation.type === "add") {
    state.removed = state.removed.filter((s) => s !== name);
    state.renames = state.renames.filter((r) => r.name !== name);
  } else if (operation.type === "remove") {
    state.removed = [...new Set([...state.removed, name])];
  } else if (
    operation.type === "rename" &&
    name !== operation.nextName.trim()
  ) {
    const nextName = operation.nextName.trim().slice(0, 80);
    state.removed = state.removed.filter((s) => s !== nextName);
    state.renames.push({
      name,
      nextName,
    });
  }
  return state;
}
