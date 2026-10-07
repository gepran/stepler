import { getStorage } from "firebase-admin/storage";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db } from "./admin.mjs";
import {
  attachmentsKey,
  enrichMentionAttachments,
} from "./mention-attachments.mjs";

const bucket = () => getStorage().bucket("stepler-490308.firebasestorage.app");
const options = { region: "us-central1", retry: true, maxInstances: 3 };

export const shareMentionAttachments = onDocumentWritten(
  { ...options, document: "users/{recipient}/mentions/{taskId}" },
  async (event) => {
    if (!event.data?.after.exists) return;
    await enrichMentionAttachments({ db, bucket: bucket(), ...event.params });
  },
);

export const refreshSharedAttachments = onDocumentWritten(
  { ...options, document: "users/{author}/tasks/{taskId}" },
  async (event) => {
    const after = event.data?.after.data();
    if (
      !after ||
      after.deleted ||
      attachmentsKey(after) === attachmentsKey(event.data?.before.data())
    )
      return;
    const { author, taskId } = event.params;
    const [log, connections] = await Promise.all([
      db.doc(`users/${author}/meta/mentions`).get(),
      db
        .collection(`users/${author}/connections`)
        .where("status", "==", "accepted")
        .get(),
    ]);
    const recipients = new Set([
      ...(log.data()?.sent?.[taskId] || []),
      ...connections.docs.map((doc) => doc.id),
    ]);
    for (const recipient of recipients)
      await enrichMentionAttachments({
        db,
        bucket: bucket(),
        recipient,
        taskId,
      });
  },
);
