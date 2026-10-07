import assert from "node:assert/strict";
import test from "node:test";
import {
  enrichMentionAttachments,
  shareAttachment,
} from "../mention-attachments.mjs";

function fixture() {
  const files = new Map([
    [
      "users/alice/attachments/photo.png",
      {
        bytes: Buffer.from("photo pixels"),
        metadata: {
          generation: "1",
          size: "12",
          contentType: "image/png",
          metadata: { firebaseStorageDownloadTokens: "original-token" },
        },
      },
    ],
  ]);
  let copies = 0;
  const bucket = {
    file(name, options = {}) {
      return {
        name,
        async exists() {
          return [files.has(name)];
        },
        async getMetadata() {
          if (!files.has(name)) throw { code: 404 };
          return [files.get(name).metadata];
        },
        async copy(target, config) {
          assert.equal(options.generation, "1");
          assert.equal(config.preconditionOpts.ifGenerationMatch, 0);
          copies++;
          files.set(target.name, {
            bytes: files.get(name).bytes,
            metadata: {
              generation: "2",
              size: "12",
              contentType: config.contentType,
              metadata: config.metadata,
            },
          });
        },
        async setMetadata(config) {
          const current = files.get(name);
          current.metadata = { ...current.metadata, ...config };
          return [current.metadata];
        },
      };
    },
  };
  const rows = new Map([
    ["profiles/bob", { username: "bob" }],
    ["users/alice/connections/bob", { status: "accepted" }],
    ["users/bob/connections/alice", { status: "accepted" }],
    [
      "users/alice/tasks/task",
      {
        text: "@bob A photo",
        attachment: {
          name: "photo.png",
          type: "image",
          storagePath: "users/alice/attachments/photo.png",
          id: "author-local-id",
        },
        subtasks: [
          {
            id: "child",
            text: "A child",
            attachment: {
              name: "child.png",
              type: "image",
              storagePath: "users/alice/attachments/photo.png",
            },
          },
        ],
      },
    ],
    [
      "users/bob/mentions/task",
      {
        taskId: "task",
        fromUid: "alice",
        text: "@bob A photo",
        read: true,
        completed: true,
        subtasks: [{ id: "child", text: "A child", completed: true }],
      },
    ],
  ]);
  const clone = (value) => (value ? structuredClone(value) : value);
  const db = {
    doc(path) {
      return {
        path,
        async get() {
          const value = clone(rows.get(path));
          return { data: () => value };
        },
      };
    },
    async runTransaction(fn) {
      return fn({
        get: (ref) => ref.get(),
        update(ref, patch) {
          rows.set(ref.path, { ...rows.get(ref.path), ...patch });
        },
      });
    },
  };
  return {
    bucket,
    db,
    rows,
    files,
    get copies() {
      return copies;
    },
  };
}
const run = (f) =>
  enrichMentionAttachments({
    db: f.db,
    bucket: f.bucket,
    recipient: "bob",
    taskId: "task",
  });

test("a photo and subtask file reach the recipient without exposing the author's Storage folder", async () => {
  const f = fixture();
  assert.equal(await run(f), true);
  const mention = f.rows.get("users/bob/mentions/task");
  assert.match(
    mention.attachment.storagePath,
    /^users\/bob\/attachments\/mention-[a-f0-9]{48}\.png$/,
  );
  assert.equal(mention.attachment.id, undefined);
  assert.deepEqual(
    f.files.get(mention.attachment.storagePath).bytes,
    Buffer.from("photo pixels"),
  );
  assert.notEqual(
    f.files.get(mention.attachment.storagePath).metadata.metadata
      .firebaseStorageDownloadTokens,
    "original-token",
  );
  assert.match(
    mention.subtasks[0].attachment.storagePath,
    /^users\/bob\/attachments\//,
  );
  assert.equal(mention.read, true);
  assert.equal(mention.completed, true);
  assert.equal(mention.subtasks[0].completed, true);
  assert.equal(f.copies, 1);
});
test("repeated delivery neither recopies files nor changes the recipient's read state", async () => {
  const f = fixture();
  await run(f);
  assert.equal(await run(f), false);
  assert.equal(f.copies, 1);
  delete f.rows.get("users/alice/tasks/task").attachment;
  await run(f);
  assert.equal(f.rows.get("users/bob/mentions/task").attachment, null);
});
test("an existing copy with missing browser download metadata is repaired without recopying pixels", async () => {
  const f = fixture();
  await run(f);
  const path = f.rows.get("users/bob/mentions/task").attachment.storagePath;
  const copy = f.files.get(path);
  delete copy.metadata.contentType;
  copy.metadata.metadata = { metadata: "legacy malformed metadata" };
  assert.equal(await run(f), false);
  assert.equal(copy.metadata.contentType, "image/png");
  assert.ok(copy.metadata.metadata.firebaseStorageDownloadTokens);
  assert.equal(f.copies, 1);
});
test("a late upload upgrades the existing mention from a placeholder to a photo", async () => {
  const f = fixture();
  const source = f.rows.get("users/alice/tasks/task").attachment;
  delete source.storagePath;
  await run(f);
  assert.equal(
    f.rows.get("users/bob/mentions/task").attachment.storagePath,
    undefined,
  );
  source.storagePath = "users/alice/attachments/photo.png";
  await run(f);
  assert.match(
    f.rows.get("users/bob/mentions/task").attachment.storagePath,
    /^users\/bob\//,
  );
});
test("an attachment pointer cannot copy a stranger's or a traversed file", async () => {
  const f = fixture();
  for (const storagePath of [
    "users/stranger/attachments/photo.png",
    "users/alice/attachments/../private",
    "users/alice/attachments/nested/photo.png",
  ]) {
    const result = await shareAttachment({
      bucket: f.bucket,
      author: "alice",
      recipient: "bob",
      taskId: "task",
      attachment: { name: "photo.png", type: "image", storagePath },
    });
    assert.equal(result.storagePath, undefined);
  }
  assert.equal(f.copies, 0);
});
test("an old event cannot overwrite a newer photo or resurrect a deleted mention", async () => {
  const f = fixture();
  const transaction = f.db.runTransaction;
  f.db.runTransaction = (fn) => {
    f.rows.get("users/alice/tasks/task").attachment = null;
    return transaction(fn);
  };
  assert.equal(await run(f), false);
  assert.equal(f.rows.get("users/bob/mentions/task").attachment, undefined);
  f.rows.delete("users/bob/mentions/task");
  assert.equal(await run(f), false);
});
test("deleted tasks and malformed recipient identities are not shared", async () => {
  const f = fixture();
  f.rows.get("users/alice/tasks/task").deleted = true;
  assert.equal(await run(f), false);
  assert.equal(
    await enrichMentionAttachments({
      db: f.db,
      bucket: f.bucket,
      recipient: "bob/../eve",
      taskId: "task",
    }),
    false,
  );
  assert.equal(f.copies, 0);
});

test("an old mention cannot grant new files after disconnect or removal from the task", async () => {
  for (const change of [
    (f) => (f.rows.get("users/alice/tasks/task").text = "For someone else"),
    (f) => (f.rows.get("users/bob/connections/alice").status = "pending"),
  ]) {
    const f = fixture();
    change(f);
    assert.equal(await run(f), false);
    assert.equal(f.copies, 0);
  }
});
