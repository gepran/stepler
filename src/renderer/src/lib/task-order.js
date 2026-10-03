export const taskOrder = (task) =>
  Number.isFinite(task.sortOrder) ? task.sortOrder : parseInt(task.id, 10) || 0;

export function orderTasks(tasks) {
  return [...tasks].sort((a, b) =>
    a.completed !== b.completed
      ? a.completed
        ? -1
        : 1
      : taskOrder(a) - taskOrder(b),
  );
}

/** Move a row without mutating the source snapshot or discarding metadata. */
export function moveTask(tasks, source, target) {
  if (
    !source ||
    !["task", "subtask"].includes(source.type) ||
    !target ||
    source.id === target.id
  )
    return tasks;
  let moved;
  let next;
  if (source.type === "task") {
    moved = tasks.find((t) => t.id === source.id);
    if (!moved) return tasks;
    // A parent dropped on its own child must not remove the whole subtree.
    if (target.type === "subtask" && target.parentId === source.id)
      return tasks;
    next = tasks.filter((t) => t.id !== source.id);
  } else {
    const parent = tasks.find((t) => t.id === source.parentId);
    moved = parent?.subtasks?.find((st) => st.id === source.id);
    if (!moved) return tasks;
    next = tasks.map((t) =>
      t === parent
        ? { ...t, subtasks: t.subtasks.filter((st) => st.id !== source.id) }
        : t,
    );
  }
  if (target.type === "timeline") {
    return [
      ...next,
      { ...moved, sortOrder: Math.max(Date.now(), ...next.map(taskOrder)) + 1 },
    ];
  }
  const parentId = target.type === "subtask" ? target.parentId : target.id;
  const index = next.findIndex((t) => t.id === parentId);
  if (index === -1) return tasks;
  if (target.type === "task" && ["top", "bottom"].includes(target.position)) {
    // Completion and day sections have fixed boundaries. Reordering within a
    // section must not implicitly complete a task or move its creation day.
    const parent = next[index];
    const stampDay = (t) => {
      if (t.ymd) return t.ymd;
      const date = new Date(parseInt(t.id, 10) || 0);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    };
    if (
      !!parent.completed !== !!moved.completed ||
      stampDay(parent) !== stampDay(moved)
    )
      return tasks;
    const ordered = orderTasks(next);
    const at = ordered.findIndex((t) => t.id === parentId);
    ordered.splice(at + (target.position === "bottom" ? 1 : 0), 0, moved);
    const base = Math.min(...ordered.map(taskOrder));
    return ordered.map((t, i) => ({ ...t, sortOrder: base + i }));
  }
  const { subtasks, ...row } = moved;
  const incoming = [row, ...(subtasks || [])];
  const children = [...(next[index].subtasks || [])];
  if (target.type === "subtask") {
    const at = children.findIndex((st) => st.id === target.id);
    if (at === -1) return tasks;
    children.splice(
      at + (target.position === "bottom" ? 1 : 0),
      0,
      ...incoming,
    );
  } else {
    children.push(...incoming);
  }
  next[index] = { ...next[index], subtasks: children };
  return next;
}
