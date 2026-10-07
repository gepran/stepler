import { createHash } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { db } from "./admin.mjs";
import { validateReport } from "./report-service.mjs";

const origins = [
  "https://steplerapp.web.app",
  "https://steplerapp.firebaseapp.com",
  /^http:\/\/localhost(:\d+)?$/,
];

export const reportIssue = onRequest(
  { region: "us-central1", cors: origins, maxInstances: 3, timeoutSeconds: 30 },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Use POST" });
      return;
    }
    if (Number(req.headers["content-length"]) > 16_384) {
      res.status(413).json({ error: "Report is too large" });
      return;
    }
    let report;
    try {
      report = validateReport(req.body);
    } catch (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    let uid = null;
    if (req.headers.authorization) {
      try {
        uid = (
          await getAuth().verifyIdToken(
            req.headers.authorization.replace(/^Bearer /, ""),
          )
        ).uid;
      } catch {
        res
          .status(401)
          .json({ error: "Please sign in again or submit after signing out." });
        return;
      }
    }
    // Limit both the account and the network. Raw IP addresses are never stored.
    const network = createHash("sha256")
      .update(req.ip || "unknown")
      .digest("hex");
    const requester = uid || network;
    const bucket = Math.floor(Date.now() / 900_000);
    const keys = [...new Set([network, uid].filter(Boolean))];
    const rates = keys.map((key) =>
      db
        .collection("reportLimits")
        .doc(createHash("sha256").update(`${key}/${bucket}`).digest("hex")),
    );
    const target = db.collection("issueReports").doc(report.id);
    try {
      await db.runTransaction(async (transaction) => {
        const existing = await transaction.get(target);
        if (existing.exists) {
          if (existing.data().requester !== requester)
            throw new Error("conflict");
          return; // Network retries use the same id and enqueue only once.
        }
        const limits = await Promise.all(
          rates.map((ref) => transaction.get(ref)),
        );
        if (limits.some((snap) => (snap.data()?.count || 0) >= 5))
          throw new Error("rate-limit");
        for (let i = 0; i < rates.length; i++)
          transaction.set(rates[i], {
            count: (limits[i].data()?.count || 0) + 1,
            expiresAt: new Date((bucket + 2) * 900_000),
          });
        transaction.create(target, {
          ...report,
          requester,
          createdAt: FieldValue.serverTimestamp(),
          delivery: "pending",
        });
      });
      res.status(202).json({ success: true, id: report.id });
    } catch (error) {
      if (error.message === "rate-limit")
        res
          .status(429)
          .json({ error: "Too many reports. Please try again in 15 minutes." });
      else if (error.message === "conflict")
        res
          .status(409)
          .json({ error: "Please reopen the report form and try again." });
      else
        res.status(503).json({
          error:
            "Could not receive the report. Your draft is still available; please retry.",
        });
    }
  },
);
