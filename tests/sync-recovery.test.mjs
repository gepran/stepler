import test from "node:test";
import assert from "node:assert/strict";
import { waitForSync, syncFailure } from "../src/main/sync-wait.js";

test("sync preserves permission and invalid-document errors instead of blaming the connection", async () => {
  const error = Object.assign(
    new Error("Missing or insufficient permissions"),
    { code: "permission-denied" },
  );
  await assert.rejects(
    waitForSync(Promise.reject(error), 100),
    (caught) => caught === error,
  );
  assert.equal(syncFailure(error).state, "error");
  assert.equal(syncFailure(error).errorCode, "permission-denied");
});

test("offline write releases the wait and can still settle after reconnecting", async () => {
  let acknowledge;
  const write = new Promise((resolve) => {
    acknowledge = resolve;
  });
  await assert.rejects(waitForSync(write, 5), (error) => {
    assert.equal(syncFailure(error).state, "offline");
    return error.code === "sync/timeout";
  });
  acknowledge("committed");
  assert.equal(await waitForSync(write, 100), "committed");
});

test("successful sync returns the committed task", async () => {
  const task = { id: "task", text: "saved" };
  assert.equal(await waitForSync(Promise.resolve(task), 100), task);
});
