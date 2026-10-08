import assert from "node:assert/strict";
import test from "node:test";
import {
  flattenLocal,
  rebuildLocal,
  mergeRemote,
  signature,
  taskFromSignature,
  serializeMention,
} from "../src/main/sync-data.js";

const legacyTask = {
  id: "1790900000000-legacy",
  text: "Saved before upgrading",
  completed: false,
  deleted: false,
  ymd: "2026-10-02",
  priority: true,
  projects: ["Work"],
  subtasks: [{ id: "child", text: "Child", completed: false }],
  dueDate: "2026-10-08",
  reminder: "09:00",
  attachment: { id: "image.png", name: "image.png" },
  gcalEventId: "event",
  gcalLink: "https://calendar.google.com/",
  appleReminderId: "reminder",
  jiraKey: "WORK-1",
  jiraLink: "https://example.com/WORK-1",
  deletedAt: 123,
};
// This is the positional format shipped through 1.3.13, before purged and
// sortOrder were inserted between priority and projects.
const legacySignature = JSON.stringify([
  legacyTask.text,
  legacyTask.completed,
  legacyTask.deleted,
  legacyTask.ymd,
  legacyTask.priority,
  legacyTask.projects,
  legacyTask.subtasks,
  legacyTask.dueDate,
  legacyTask.reminder,
  legacyTask.attachment,
  legacyTask.gcalEventId,
  legacyTask.gcalLink,
  legacyTask.appleReminderId,
  legacyTask.jiraKey,
  legacyTask.jiraLink,
  legacyTask.deletedAt,
]);

test("upgrading a legacy sync baseline preserves every field's position", () => {
  assert.deepEqual(
    taskFromSignature(legacySignature, legacyTask.id),
    legacyTask,
  );
  const current = { ...legacyTask, purged: false, sortOrder: 456 };
  assert.deepEqual(taskFromSignature(signature(current), current.id), current);
  for (const invalid of ['{"unexpected":true}', "[]", "null", "invalid"])
    assert.equal(taskFromSignature(invalid, legacyTask.id), null);
});

test("a legacy baseline merges queued edits with cloud changes after upgrading", () => {
  const local = {
    ...legacyTask,
    text: "Edited offline before upgrading",
    subtasks: [{ ...legacyTask.subtasks[0], completed: true }],
  };
  const remote = {
    ...legacyTask,
    projects: ["Work", "Shared"],
    subtasks: [{ ...legacyTask.subtasks[0], text: "Edited on another device" }],
  };
  const result = mergeRemote([local], [remote], {
    [local.id]: legacySignature,
  });
  assert.equal(result.merged[0].text, local.text);
  assert.deepEqual(result.merged[0].projects, remote.projects);
  assert.deepEqual(result.merged[0].subtasks, [
    { id: "child", text: "Edited on another device", completed: true },
  ]);
  assert.equal(result.merged[0].reminder, "09:00");
  assert.deepEqual(result.applied, [remote]);
});

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

test("desktop IPC preserves downloaded mention and subtask photos without cloud objects", () => {
  const attachment = {
    id: "mention-copy.png",
    name: "photo.png",
    type: "image",
    w: 640,
    h: 480,
    storagePath: "users/recipient/attachments/mention-copy.png",
    internal: () => {
      throw new Error("not cloneable");
    },
  };
  const snapshot = structuredClone(
    serializeMention({
      id: "mention",
      taskId: "source",
      text: "@recipient",
      read: true,
      attachment,
      subtasks: [{ id: 12, text: "Child", completed: true, attachment }],
      updatedAt: { toDate() {} },
    }),
  );
  const expected = { ...attachment };
  delete expected.internal;
  assert.deepEqual(snapshot.attachment, expected);
  assert.deepEqual(snapshot.subtasks[0].attachment, expected);
  assert.equal(snapshot.subtasks[0].id, "12");
  assert.equal(snapshot.subtasks[0].completed, true);
  assert.equal(snapshot.read, true);
  assert.equal(snapshot.updatedAt, undefined);
  const pending = serializeMention({
    id: "pending",
    attachment: {
      storagePath: expected.storagePath,
      name: "photo.png",
      type: "image",
    },
  });
  assert.equal(pending.attachment.storagePath, expected.storagePath);
  assert.equal(pending.attachment.id, undefined);
  assert.equal(serializeMention({ id: "text" }).attachment, undefined);
});
