import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import express from "express";
import { getFirestore } from "firebase-admin/firestore";

test("report endpoint durably receives once, rejects malformed reports and limits abuse", async () => {
  assert.match(
    process.env.FIRESTORE_EMULATOR_HOST || "",
    /^(localhost|127\.0\.0\.1):\d+$/,
  );
  process.env.GCLOUD_PROJECT = "demo-stepler-review";
  const { reportIssue } = await import("../index.mjs");
  const app = express();
  app.use(express.json({ limit: "16kb" }));
  app.all("/report", reportIssue);
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const url = `http://127.0.0.1:${server.address().port}/report`;
  const report = {
    id: randomUUID(),
    title: "Image copy fails",
    description: "The copy image button did not place pixels on the clipboard.",
    diagnostics: { platform: "win32", version: "test", syncState: "offline" },
  };
  const send = (body) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await fetch(url)).status, 405);
    assert.equal((await send({ ...report, description: "" })).status, 400);
    const received = await send(report);
    assert.equal(received.status, 202);
    assert.equal((await received.json()).id, report.id);
    const db = getFirestore();
    const first = await db.collection("issueReports").doc(report.id).get();
    assert.equal(first.data().delivery, "pending");
    assert.equal(first.data().description, report.description);
    assert.ok(first.data().createdAt);
    assert.equal((await send(report)).status, 202);
    assert.equal(
      (await db.collection("issueReports").doc(report.id).get())
        .data()
        .createdAt.toMillis(),
      first.data().createdAt.toMillis(),
    );
    for (let i = 0; i < 4; i++)
      assert.equal((await send({ ...report, id: randomUUID() })).status, 202);
    assert.equal((await send({ ...report, id: randomUUID() })).status, 429);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
