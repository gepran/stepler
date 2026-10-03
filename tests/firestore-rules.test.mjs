import assert from "node:assert/strict";
import test from "node:test";
import { initializeApp, deleteApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  deleteDoc,
  setLogLevel,
  getDocs,
  collection,
  runTransaction,
} from "firebase/firestore";
import {
  commitTaskEdit,
  commitSubtaskCompletion,
} from "../src/renderer/src/lib/task-cloud.js";
import { updateMentionedTask } from "../src/renderer/src/lib/collab-store.js";
import { applyProjectOperation } from "../src/renderer/src/lib/project-state.js";

const endpoint = process.env.FIRESTORE_EMULATOR_HOST;
test(
  "Firestore isolation, invitation consent and mention permissions",
  { timeout: 60_000 },
  async (t) => {
    assert.ok(
      endpoint,
      "Start the local emulators with npm run test:firebase.",
    );
    const [host, port] = endpoint.split(":");
    assert.ok(
      ["127.0.0.1", "localhost"].includes(host),
      "These tests may run only against a local emulator",
    );
    await fetch(`http://${host}:${port}/`, {
      signal: AbortSignal.timeout(5_000),
    });
    const projectId = "demo-stepler-review";
    const apps = [];
    setLogLevel("silent");
    const client = (uid, verified = true) => {
      const app = initializeApp(
        { projectId, apiKey: "emulator-only" },
        `${uid}-${verified}-${Date.now()}-${apps.length}`,
      );
      apps.push(app);
      const db = getFirestore(app);
      connectFirestoreEmulator(db, host, Number(port), {
        mockUserToken: {
          sub: uid,
          email: `${uid}@example.com`,
          email_verified: verified,
        },
      });
      return db;
    };
    const alice = client("alice");
    const bob = client("bob");
    const eve = client("eve");
    const unverified = client("unverified", false);
    const stamp = (data) => ({ ...data, updatedAt: serverTimestamp() });
    const card = (uid) => ({
      uid,
      username: uid,
      usernameLower: uid,
      displayName: uid,
      photoURL: "",
    });
    const connection = (db, owner, other) =>
      doc(db, "users", owner, "connections", other);
    const task = doc(alice, "users", "alice", "tasks", "task1");
    const denied = (promise) =>
      assert.rejects(promise, (err) => err.code === "permission-denied");

    try {
      for (const [db, uid] of [
        [alice, "alice"],
        [bob, "bob"],
        [eve, "eve"],
      ]) {
        await setDoc(doc(db, "usernames", uid), stamp({ uid, username: uid }));
        await setDoc(doc(db, "profiles", uid), stamp(card(uid)));
      }
      await setDoc(
        task,
        stamp({
          id: "task1",
          text: "Private",
          ymd: "2026-10-02",
          completed: false,
          deleted: false,
          priority: false,
          subtasks: [],
        }),
      );

      await t.test(
        "another account cannot read tasks or create its own proof of mention",
        async () => {
          await denied(getDoc(doc(eve, "users", "alice", "tasks", "task1")));
          await denied(
            setDoc(
              doc(eve, "users", "eve", "mentions", "task1"),
              stamp({
                fromUid: "alice",
                fromUsername: "alice",
                taskId: "task1",
                text: "fake",
              }),
            ),
          );
          await denied(
            updateDoc(
              doc(eve, "users", "alice", "tasks", "task1"),
              stamp({ completed: true }),
            ),
          );
        },
      );

      await t.test(
        "a sender cannot forge acceptance on the recipient's side",
        async () => {
          await denied(
            setDoc(
              connection(eve, "alice", "eve"),
              stamp({ ...card("eve"), status: "accepted" }),
            ),
          );
          await denied(
            setDoc(
              connection(eve, "alice", "eve"),
              stamp({ ...card("eve"), username: "alice", status: "incoming" }),
            ),
          );
          const invite = writeBatch(alice);
          invite.set(
            connection(alice, "alice", "bob"),
            stamp({ ...card("bob"), status: "pending" }),
          );
          invite.set(
            connection(alice, "bob", "alice"),
            stamp({ ...card("alice"), status: "incoming" }),
          );
          await invite.commit();
          const forged = writeBatch(alice);
          forged.update(
            connection(alice, "alice", "bob"),
            stamp({ status: "accepted" }),
          );
          forged.update(
            connection(alice, "bob", "alice"),
            stamp({ status: "accepted" }),
          );
          await denied(forged.commit());
        },
      );

      await t.test(
        "real recipient acceptance and legitimate mention delivery succeed",
        async () => {
          const accept = writeBatch(bob);
          accept.set(
            connection(bob, "bob", "alice"),
            stamp({ ...card("alice"), status: "accepted" }),
          );
          accept.set(
            connection(bob, "alice", "bob"),
            stamp({ ...card("bob"), status: "accepted" }),
          );
          await accept.commit();
          await setDoc(
            doc(alice, "users", "bob", "mentions", "task1"),
            stamp({
              fromUid: "alice",
              fromUsername: "alice",
              taskId: "task1",
              text: "Private",
              completed: false,
              priority: false,
              subtasks: [],
              read: false,
            }),
          );
          assert.equal(
            (
              await getDoc(doc(bob, "users", "alice", "tasks", "task1"))
            ).exists(),
            true,
          );
          await denied(getDocs(collection(bob, "users", "alice", "tasks")));
          await updateMentionedTask(bob, {
            meUid: "bob",
            mention: { fromUid: "alice", taskId: "task1", subtasks: [] },
            patch: {
              priority: true,
              subtasks: [{ id: "child", text: "Child", completed: false }],
            },
          });
          assert.equal((await getDoc(task)).data().priority, true);
          assert.equal(
            (await getDoc(doc(bob, "users", "bob", "mentions", "task1"))).data()
              .priority,
            true,
          );
          await updateDoc(
            doc(bob, "users", "alice", "tasks", "task1"),
            stamp({ completed: true }),
          );
          await updateDoc(
            doc(bob, "users", "bob", "mentions", "task1"),
            stamp({ completed: true, read: true }),
          );
          await denied(
            updateDoc(
              doc(bob, "users", "alice", "tasks", "task1"),
              stamp({ text: "Overwritten" }),
            ),
          );
          await denied(
            updateDoc(
              doc(bob, "users", "alice", "tasks", "task1"),
              stamp({ completed: "invalid" }),
            ),
          );
          await denied(
            setDoc(
              doc(alice, "users", "bob", "mentions", "different-id"),
              stamp({
                fromUid: "alice",
                fromUsername: "alice",
                taskId: "task1",
                text: "Wrong proof",
              }),
            ),
          );
        },
      );

      await t.test(
        "disconnect revokes access even while an old mention remains",
        async () => {
          await deleteDoc(connection(alice, "alice", "bob"));
          await denied(getDoc(doc(bob, "users", "alice", "tasks", "task1")));
          await denied(
            updateMentionedTask(bob, {
              meUid: "bob",
              mention: { fromUid: "alice", taskId: "task1" },
              patch: { priority: false },
            }),
          );
          assert.equal(
            (await getDoc(doc(bob, "users", "bob", "mentions", "task1"))).data()
              .priority,
            true,
          );
          await denied(
            updateDoc(
              doc(bob, "users", "alice", "tasks", "task1"),
              stamp({ priority: true }),
            ),
          );
        },
      );

      await t.test(
        "simultaneous task and subtask edits survive real transaction retries",
        async () => {
          const otherDevice = client("alice");
          const before = {
            id: "concurrent",
            text: "Before",
            ymd: "2026-10-02",
            completed: false,
            deleted: false,
            priority: false,
            subtasks: [
              { id: "a", text: "A", completed: false },
              { id: "b", text: "B", completed: false },
            ],
          };
          await setDoc(
            doc(alice, "users", "alice", "tasks", before.id),
            stamp(before),
          );
          await Promise.all([
            commitTaskEdit(alice, {
              uid: "alice",
              base: before,
              task: {
                ...before,
                text: "Edited",
                subtasks: [
                  { ...before.subtasks[0], completed: true },
                  before.subtasks[1],
                  { id: "c", text: "C", completed: false },
                ],
              },
            }),
            commitTaskEdit(otherDevice, {
              uid: "alice",
              base: before,
              task: {
                ...before,
                priority: true,
                subtasks: [
                  before.subtasks[0],
                  { ...before.subtasks[1], completed: true },
                  { id: "d", text: "D", completed: false },
                ],
              },
            }),
          ]);
          const after = (
            await getDoc(doc(alice, "users", "alice", "tasks", before.id))
          ).data();
          assert.equal(after.text, "Edited");
          assert.equal(after.priority, true);
          assert.equal(after.subtasks.length, 4);
          assert.equal(
            after.subtasks.find((s) => s.id === "a").completed,
            true,
          );
          assert.equal(
            after.subtasks.find((s) => s.id === "b").completed,
            true,
          );
          const purged = {
            id: before.id,
            text: "",
            ymd: before.ymd,
            completed: false,
            deleted: true,
            priority: false,
            purged: true,
          };
          await setDoc(
            doc(alice, "users", "alice", "tasks", before.id),
            stamp(purged),
          );
          await commitTaskEdit(otherDevice, {
            uid: "alice",
            base: before,
            task: { ...before, text: "Late offline edit" },
          });
          const final = (
            await getDoc(doc(alice, "users", "alice", "tasks", before.id))
          ).data();
          assert.equal(final.purged, true);
          assert.equal(final.text, "");
        },
      );

      await t.test(
        "project operations from two devices share one metadata document",
        async () => {
          const otherDevice = client("alice");
          const edit = (db, operation) =>
            runTransaction(db, async (transaction) => {
              const target = doc(db, "users", "alice", "meta", "projects");
              const snapshot = await transaction.get(target);
              const state = applyProjectOperation(snapshot.data(), operation);
              transaction.set(target, stamp(state));
            });
          await Promise.all([
            edit(alice, { type: "add", name: "A" }),
            edit(otherDevice, { type: "add", name: "B" }),
          ]);
          await edit(alice, { type: "color", name: "A", color: "#123456" });
          const operation = {
            type: "favorite",
            name: "A",
            deviceId: "test-device",
            sequence: 1,
          };
          await edit(otherDevice, operation);
          await edit(otherDevice, operation);
          const state = (
            await getDoc(doc(alice, "users", "alice", "meta", "projects"))
          ).data();
          assert.equal(state.projects.length, 2);
          assert.equal(
            state.projects.find((p) => p.name === "A").color,
            "#123456",
          );
          assert.equal(
            state.projects.find((p) => p.name === "A").isFavorite,
            true,
          );
          await denied(getDoc(doc(eve, "users", "alice", "meta", "projects")));
        },
      );

      await t.test(
        "queued offline subtask completion retains remote edits and never revives a purged task",
        async () => {
          const target = doc(alice, "users", "alice", "tasks", "offline-child");
          await setDoc(
            target,
            stamp({
              id: "offline-child",
              text: "Parent",
              ymd: "2026-10-02",
              completed: false,
              deleted: false,
              priority: false,
              subtasks: [
                {
                  id: "child",
                  text: "Edited on another device",
                  completed: false,
                  attachment: { name: "keep" },
                },
                { id: "remote", text: "New child", completed: false },
              ],
            }),
          );
          await commitSubtaskCompletion(alice, "alice", {
            taskID: "offline-child",
            childID: "child",
            completed: true,
          });
          const result = (await getDoc(target)).data();
          assert.equal(result.subtasks[0].text, "Edited on another device");
          assert.equal(result.subtasks[0].completed, true);
          assert.equal(result.subtasks.length, 2);
          assert.equal(result.subtasks[0].attachment.name, "keep");
          await setDoc(
            target,
            stamp({
              id: "offline-child",
              text: "",
              ymd: "2026-10-02",
              completed: false,
              priority: false,
              deleted: true,
              purged: true,
            }),
          );
          await commitSubtaskCompletion(alice, "alice", {
            taskID: "offline-child",
            childID: "child",
            completed: false,
          });
          assert.equal((await getDoc(target)).data().subtasks, undefined);
          await denied(
            commitSubtaskCompletion(eve, "alice", {
              taskID: "offline-child",
              childID: "child",
              completed: true,
            }),
          );
        },
      );
      await t.test(
        "identity mappings cannot be transferred or impersonated",
        async () => {
          await denied(
            updateDoc(doc(alice, "usernames", "alice"), stamp({ uid: "eve" })),
          );
          await denied(
            setDoc(
              doc(eve, "profiles", "eve"),
              stamp({ ...card("eve"), uid: "alice" }),
            ),
          );
          await denied(
            setDoc(
              doc(unverified, "emails", "unverified@example.com"),
              stamp({ uid: "unverified" }),
            ),
          );
          await setDoc(
            doc(alice, "emails", "alice@example.com"),
            stamp({ uid: "alice" }),
          );
        },
      );
    } finally {
      await Promise.all(apps.map(deleteApp));
    }
  },
);
