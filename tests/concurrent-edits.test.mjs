import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeTaskEdits,
  mergeSubtasks,
} from "../src/renderer/src/lib/task-merge.js";
import { mergeRemote, signature } from "../src/main/sync-data.js";

const base = {
  id: "1",
  text: "Task",
  completed: false,
  priority: false,
  deleted: false,
  subtasks: [
    { id: "a", text: "A", completed: false },
    { id: "b", text: "B", completed: false },
  ],
};

test("independent task edits and optional field removal merge without reverting either device", () => {
  const before = { ...base, reminder: "09:00" };
  const local = { ...before, text: "Edited" };
  const remote = { ...base, completed: true };
  const result = mergeTaskEdits(before, local, remote);
  assert.equal(result.text, "Edited");
  assert.equal(result.completed, true);
  assert.equal(result.reminder, undefined);
});

test("two devices add and complete different subtasks without losing rows", () => {
  const local = [
    ...base.subtasks.map((s) => (s.id === "a" ? { ...s, completed: true } : s)),
    { id: "c", text: "C" },
  ];
  const remote = [
    ...base.subtasks.map((s) =>
      s.id === "b" ? { ...s, text: "Updated B" } : s,
    ),
    { id: "d", text: "D" },
  ];
  const result = mergeSubtasks(base.subtasks, local, remote);
  assert.deepEqual(
    result.map((s) => s.id),
    ["a", "b", "c", "d"],
  );
  assert.equal(result[0].completed, true);
  assert.equal(result[1].text, "Updated B");
});

test("concurrent subtask deletion cannot be undone by a stale edit", () => {
  const local = base.subtasks.map((s) => ({ ...s, completed: true }));
  assert.deepEqual(
    mergeSubtasks(base.subtasks, local, [base.subtasks[1]]).map((s) => s.id),
    ["b"],
  );
  assert.deepEqual(
    mergeSubtasks(base.subtasks, [base.subtasks[1]], local).map((s) => s.id),
    ["b"],
  );
});

test("project additions and removals made on separate devices survive", () => {
  const before = { ...base, projects: ["A", "B"] };
  const result = mergeTaskEdits(
    before,
    { ...before, projects: ["B", "C"] },
    { ...before, projects: ["A", "B", "D"] },
  );
  assert.deepEqual(result.projects, ["B", "D", "C"]);
});

test("permanent deletion wins over queued edits with or without a baseline", () => {
  const purged = {
    ...base,
    text: "",
    subtasks: undefined,
    purged: true,
    deleted: true,
  };
  for (const before of [base, null]) {
    const result = mergeTaskEdits(
      before,
      { ...base, text: "Offline edit" },
      purged,
    );
    assert.equal(result.purged, true);
    assert.equal(result.text, "");
    assert.equal(result.subtasks, undefined);
  }
});

test("remote pull combines queued local text with cloud completion and learns the baseline", () => {
  const local = { ...base, text: "Local" };
  const remote = { ...base, priority: true };
  const result = mergeRemote([local], [remote], { 1: signature(base) });
  assert.equal(result.merged[0].text, "Local");
  assert.equal(result.merged[0].priority, true);
  assert.deepEqual(result.applied, [remote]);
});
