import assert from "node:assert/strict";
import test from "node:test";
import {
  mutateProjects,
  normalizeProjects,
  projectNamesInData,
  rewriteProjectInData,
  sortProjects,
} from "../src/renderer/src/lib/projects.js";
import { moveTask, orderTasks } from "../src/renderer/src/lib/task-order.js";
import { colorForLabel } from "../src/renderer/src/lib/labels.js";

test("legacy project names normalize to one canonical list with independent case-sensitive colours", () => {
  const list = normalizeProjects([
    "Work",
    { name: " Work ", color: "#123456" },
    null,
    { name: 4 },
    { name: "work", color: "#abcdef", isFavorite: true },
  ]);
  assert.equal(list.length, 2);
  assert.equal(colorForLabel("Work", list), "#123456");
  assert.equal(colorForLabel("work", list), "#abcdef");
  assert.deepEqual(
    sortProjects(list).map((p) => p.name),
    ["work", "Work"],
  );
});

test("rapid project operations preserve additions, colors and both favorite toggles", () => {
  let list = mutateProjects([], { type: "add", name: "A" });
  list = mutateProjects(list, { type: "add", name: "B" });
  list = mutateProjects(list, { type: "color", name: "A", color: "#123456" });
  list = mutateProjects(list, { type: "favorite", name: "A" });
  list = mutateProjects(list, { type: "favorite", name: "A" });
  assert.deepEqual(list, [
    { name: "A", color: "#123456", isFavorite: false },
    { name: "B", isFavorite: false },
  ]);
  assert.throws(() =>
    mutateProjects(list, { type: "rename", name: "A", nextName: "B" }),
  );
});

test("rename and delete update current tasks, history, trash and nested labels", () => {
  const row = {
    id: "1",
    text: "Task",
    projects: ["A", "B"],
    subtasks: [{ id: "2", projects: ["A"], attachment: { id: "file" } }],
  };
  const original = {
    tasks: [row],
    history: [{ ymd: "2026-01-01", tasks: [row] }],
    deletedTasks: [row],
  };
  const renamed = rewriteProjectInData(original, "A", "C");
  assert.deepEqual(projectNamesInData(renamed), ["C", "B"]);
  assert.deepEqual(renamed.deletedTasks[0].projects, ["C", "B"]);
  const removed = rewriteProjectInData(renamed, "C");
  assert.deepEqual(removed.history[0].tasks[0].projects, ["B"]);
  assert.equal(removed.tasks[0].subtasks[0].projects, undefined);
  assert.deepEqual(removed.tasks[0].subtasks[0].attachment, { id: "file" });
  assert.deepEqual(original.tasks[0].projects, ["A", "B"]);
});

const a = {
  id: "1790900000000-a",
  text: "A",
  completed: false,
  projects: ["Work"],
  gcalEventId: "event",
  subtasks: [{ id: "1790900000001-s", text: "Child", completed: false }],
};
const b = { id: "1790900000002-b", text: "B", completed: false };
const c = { id: "1790900000003-c", text: "C", completed: false };

test("task reorder survives display sorting and a JSON round trip", () => {
  const moved = moveTask(
    [a, b, c],
    { type: "task", id: c.id },
    { type: "task", id: a.id, position: "top" },
  );
  assert.deepEqual(
    orderTasks(JSON.parse(JSON.stringify(moved))).map((t) => t.text),
    ["C", "A", "B"],
  );
});

test("reorder matches local and synced dates while preserving day and completion boundaries", () => {
  const date = new Date(parseInt(a.id, 10));
  const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const synced = { ...a, ymd };
  const tasks = [synced, b];
  const source = { type: "task", id: b.id };
  const target = { type: "task", id: a.id, position: "top" };
  const moved = moveTask(tasks, source, target);
  assert.deepEqual(
    orderTasks(moved).map((t) => t.text),
    ["B", "A"],
  );
  assert.equal(moved.find((t) => t.id === a.id).ymd, ymd);
  for (const other of [
    { ...b, ymd: "2025-01-01" },
    { ...b, completed: true },
  ]) {
    const separated = [synced, other];
    assert.equal(moveTask(separated, source, target), separated);
  }
});

test("nesting and promotion retain metadata and descendants exactly once", () => {
  const nested = moveTask(
    [a, b],
    { type: "task", id: a.id },
    { type: "task", id: b.id, position: "child" },
  );
  assert.equal(nested.length, 1);
  assert.deepEqual(
    nested[0].subtasks.map((st) => st.text),
    ["A", "Child"],
  );
  assert.equal(nested[0].subtasks[0].gcalEventId, "event");
  const promoted = moveTask(
    nested,
    { type: "subtask", id: a.id, parentId: b.id },
    { type: "timeline" },
  );
  assert.equal(promoted.length, 2);
  assert.deepEqual(
    promoted[0].subtasks.map((st) => st.text),
    ["Child"],
  );
  assert.deepEqual(promoted[1].projects, ["Work"]);
});

test("subtask drop inserts at the selected child instead of appending", () => {
  const parent = {
    ...b,
    subtasks: [
      { id: "x", text: "X" },
      { id: "y", text: "Y" },
      { id: "z", text: "Z" },
    ],
  };
  const moved = moveTask(
    [parent],
    { type: "subtask", id: "z", parentId: b.id },
    { type: "subtask", id: "x", parentId: b.id, position: "top" },
  );
  assert.deepEqual(
    moved[0].subtasks.map((st) => st.text),
    ["Z", "X", "Y"],
  );
});

test("invalid, missing and self-subtree targets cannot remove tasks", () => {
  const tasks = [a, b];
  for (const [source, target] of [
    [null, { type: "timeline" }],
    [{ type: "unknown", id: a.id }, { type: "timeline" }],
    [
      { type: "task", id: a.id },
      { type: "task", id: "missing" },
    ],
    [
      { type: "task", id: a.id },
      { type: "subtask", id: a.subtasks[0].id, parentId: a.id },
    ],
  ])
    assert.equal(moveTask(tasks, source, target), tasks);
});
