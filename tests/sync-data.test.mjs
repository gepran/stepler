import assert from "node:assert/strict";
import test from "node:test";
import {
  flattenLocal,
  rebuildLocal,
  mergeRemote,
  signature,
} from "../src/main/sync-data.js";

test("remote removal clears optional fields and preserves a downloaded attachment id", () => {
  const local = {
    id: "1790900000000-a",
    text: "Task",
    completed: false,
    deleted: false,
    ymd: "2026-10-02",
    projects: ["Old"],
    reminder: "09:00",
    dueDate: "2026-10-03",
    attachment: {
      id: "local.png",
      storagePath: "users/me/attachments/local.png",
      name: "image.png",
    },
  };
  const remote = {
    id: local.id,
    text: "Task",
    completed: false,
    deleted: false,
    ymd: local.ymd,
    attachment: {
      storagePath: local.attachment.storagePath,
      name: "image.png",
    },
  };
  const { merged } = mergeRemote([local], [remote], {
    [local.id]: signature(local),
  });
  assert.equal(merged[0].projects, undefined);
  assert.equal(merged[0].reminder, undefined);
  assert.equal(merged[0].dueDate, undefined);
  assert.equal(merged[0].attachment.id, "local.png");
});

test("a cloud echo cannot overwrite an unsent local edit", () => {
  const before = { id: "1", text: "Before", completed: false, deleted: false };
  const edited = { ...before, text: "Edited" };
  assert.equal(
    mergeRemote([edited], [before], { 1: signature(before) }).merged[0].text,
    "Edited",
  );
});

test("permanent deletion survives a cloud round trip without returning to trash", () => {
  const local = {
    tasks: [],
    history: [],
    deletedTasks: [],
    purgedTasks: [
      {
        id: "1790900000000-a",
        text: "",
        completed: false,
        priority: false,
        purged: true,
        ymd: "2026-10-02",
      },
    ],
  };
  const flat = flattenLocal(local, "2026-10-02");
  assert.equal(flat[0].deleted, true);
  const restored = rebuildLocal(flat, "2026-10-02");
  assert.equal(restored.deletedTasks.length, 0);
  assert.equal(restored.tasks.length, 0);
  assert.equal(restored.purgedTasks.length, 1);
  assert.equal(restored.purgedTasks[0].text, "");
});

test("day and drag order survive desktop/cloud shape translation", () => {
  const task = {
    id: "1790900000000-a",
    text: "Task",
    completed: false,
    sortOrder: 123,
    ymd: "2026-10-01",
  };
  const local = rebuildLocal([task], "2026-10-02");
  assert.equal(local.history[0].ymd, "2026-10-01");
  assert.equal(flattenLocal(local, "2026-10-02")[0].ymd, "2026-10-01");
  assert.equal(flattenLocal(local, "2026-10-02")[0].sortOrder, 123);
});
