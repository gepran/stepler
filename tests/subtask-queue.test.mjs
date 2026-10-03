import assert from "node:assert/strict";
import test from "node:test";
import { createSubtaskQueue } from "../src/renderer/src/lib/subtask-queue.js";

function fixture() {
  const saved = new Map();
  let online = false,
    user = "a",
    serial = 0;
  const commits = [];
  const storage = {
    getItem: (key) => saved.get(key),
    setItem: (key, value) => saved.set(key, value),
  };
  const options = {
    storage,
    isOnline: () => online,
    isAuthorized: (uid) => user === uid,
    newId: () => String(++serial),
    commit: async (uid, op) => commits.push({ uid, ...op }),
  };
  return {
    saved,
    options,
    commits,
    connect: () => {
      online = true;
    },
    signIn: (uid) => {
      user = uid;
    },
  };
}
test("offline child completion survives reload and overlays without replacing metadata", async () => {
  const f = fixture();
  createSubtaskQueue(f.options).enqueue("a", "parent", "child", true);
  const queue = createSubtaskQueue(f.options);
  const rows = [
    {
      id: "parent",
      subtasks: [
        {
          id: "child",
          text: "Remote edit",
          completed: false,
          attachment: { id: "photo" },
        },
        { id: "new", text: "Remote addition" },
      ],
    },
  ];
  const result = queue.overlay("a", rows);
  assert.equal(result[0].subtasks[0].completed, true);
  assert.equal(result[0].subtasks[0].text, "Remote edit");
  assert.deepEqual(result[0].subtasks[0].attachment, { id: "photo" });
  assert.equal(result[0].subtasks.length, 2);
  await queue.flush("a");
  assert.equal(f.commits.length, 0);
  f.connect();
  await queue.flush("a");
  assert.equal(f.commits.length, 1);
  assert.deepEqual(queue.overlay("a", rows), rows);
});
test("queued edits stay isolated to the signed-in account", async () => {
  const f = fixture(),
    queue = createSubtaskQueue(f.options);
  queue.enqueue("a", "task", "child", true);
  f.connect();
  f.signIn("b");
  await queue.flush("a");
  assert.equal(f.commits.length, 0);
  assert.deepEqual(
    queue.overlay("b", [
      { id: "task", subtasks: [{ id: "child", completed: false }] },
    ])[0].subtasks[0].completed,
    false,
  );
  f.signIn("a");
  await queue.flush("a");
  assert.equal(f.commits[0].uid, "a");
});
test("failed server write stays queued and changes from another tab survive acknowledgment", async () => {
  const f = fixture();
  f.connect();
  let fail = true,
    queue;
  const options = {
    ...f.options,
    commit: async () => {
      if (fail) throw new Error("offline");
      if (f.commits.length === 0) queue.enqueue("a", "task", "other", true);
      f.commits.push(true);
    },
  };
  queue = createSubtaskQueue(options);
  queue.enqueue("a", "task", "child", true);
  await assert.rejects(queue.flush("a"), /offline/);
  assert.equal(JSON.parse([...f.saved.values()][0]).length, 1);
  fail = false;
  await queue.flush("a");
  assert.equal(f.commits.length, 2);
  assert.equal(JSON.parse([...f.saved.values()][0]).length, 0);
});
test("storage failure rejects the operation and never displays an unsaved change", () => {
  const f = fixture();
  const queue = createSubtaskQueue({
    ...f.options,
    storage: {
      getItem: () => null,
      setItem: () => {
        throw new Error("disk full");
      },
    },
  });
  assert.throws(() => queue.enqueue("a", "task", "child", true), /disk full/);
  const rows = [{ id: "task", subtasks: [{ id: "child", completed: false }] }];
  assert.deepEqual(queue.overlay("a", rows), rows);
});
