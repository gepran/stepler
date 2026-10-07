import { FieldValue } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { db } from "./admin.mjs";
import { sendToTelegram } from "./report-service.mjs";

const botToken = defineSecret("TELEGRAM_BOT_TOKEN");
const chatId = defineSecret("TELEGRAM_REPORT_CHAT_ID");

export const deliverIssueReport = onDocumentCreated(
  {
    document: "issueReports/{reportId}",
    region: "us-central1",
    secrets: [botToken, chatId],
    retry: true,
    maxInstances: 3,
  },
  async (event) => {
    const target = event.data?.ref;
    if (!target) return;
    const report = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(target);
      const data = snap.data();
      if (!data || data.delivery === "delivered") return null;
      if (data.leaseUntil > Date.now())
        throw new Error("Delivery already in progress; retry later");
      transaction.update(target, { leaseUntil: Date.now() + 60_000 });
      return data;
    });
    if (!report) return;
    try {
      const messageId = await sendToTelegram(report, {
        token: botToken.value(),
        chatId: chatId.value(),
      });
      await target.update({
        delivery: "delivered",
        telegramMessageId: messageId,
        deliveredAt: FieldValue.serverTimestamp(),
        leaseUntil: 0,
      });
    } catch {
      await target.update({ delivery: "pending", leaseUntil: 0 });
      // A sanitized error prevents the bot token or a user's description entering logs.
      throw new Error("Telegram delivery failed; report retained for retry");
    }
  },
);
