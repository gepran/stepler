import assert from "node:assert/strict";
import test from "node:test";
import {
  applyProjectOperation,
  projectNameInState,
} from "../src/renderer/src/lib/project-state.js";

test("cloud project operations retain independent device additions and metadata", () => {
  let state = applyProjectOperation(
    {},
    {
      type: "remember",
      names: [{ name: "A", color: "#123456", isFavorite: true }],
    },
  );
  state = applyProjectOperation(state, { type: "add", name: "B" });
  state = applyProjectOperation(state, {
    type: "color",
    name: "B",
    color: "#abcdef",
  });
  assert.deepEqual(state.projects, [
    { name: "A", color: "#123456", isFavorite: true },
    { name: "B", color: "#abcdef", isFavorite: false },
  ]);
});
test("replaying a queued favorite after a lost acknowledgment does not toggle twice", () => {
  let state = applyProjectOperation({}, { type: "add", name: "A" });
  const operation = {
    type: "favorite",
    name: "A",
    deviceId: "device-one",
    sequence: 1,
  };
  state = applyProjectOperation(state, operation);
  assert.equal(state.projects[0].isFavorite, true);
  assert.deepEqual(applyProjectOperation(state, operation), state);
});
test("remote rename and deletion suppress stale task-name discovery", () => {
  let state = applyProjectOperation({}, { type: "add", name: "A" });
  state = applyProjectOperation(state, {
    type: "rename",
    name: "A",
    nextName: "B",
  });
  state = applyProjectOperation(state, { type: "remember", names: ["A", "C"] });
  assert.deepEqual(
    state.projects.map((p) => p.name),
    ["B", "C"],
  );
  assert.equal(projectNameInState("A", state), "B");
  state = applyProjectOperation(state, { type: "remove", name: "B" });
  state = applyProjectOperation(state, { type: "remember", names: ["A", "B"] });
  assert.deepEqual(
    state.projects.map((p) => p.name),
    ["C"],
  );
  assert.equal(projectNameInState("A", state), null);
});
test("renaming to a previously removed name makes the explicit new project usable", () => {
  let state = applyProjectOperation({}, { type: "add", name: "B" });
  state = applyProjectOperation(state, { type: "remove", name: "B" });
  state = applyProjectOperation(state, { type: "add", name: "C" });
  state = applyProjectOperation(state, {
    type: "rename",
    name: "C",
    nextName: "B",
  });
  assert.equal(projectNameInState("B", state), "B");
  assert.equal(projectNameInState("C", state), "B");
});
