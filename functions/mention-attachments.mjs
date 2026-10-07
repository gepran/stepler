import { createHash, randomUUID } from "node:crypto";

const MAX_BYTES = 25 * 1024 * 1024;
const validKey = (value) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 128 &&
  value !== "." &&
  value !== ".." &&
  !value.includes("/");

function description(attachment) {
  if (!attachment || typeof attachment !== "object") return null;
  const result = {
    name: String(attachment.name || "Attachment").slice(0, 120),
    type: attachment.type === "image" ? "image" : "file",
  };
  for (const key of ["w", "h"])
    if (Number.isFinite(attachment[key]) && attachment[key] > 0)
      result[key] = attachment[key];
  return result;
}

export function ownedAttachmentPath(author, path) {
  if (!validKey(author) || typeof path !== "string") return false;
  const prefix = `users/${author}/attachments/`;
  if (!path.startsWith(prefix)) return false;
  const name = path.slice(prefix.length);
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(name) && !name.includes("..");
}

/** A private copy belongs to the recipient; existing owner-only Storage rules apply. */
export async function shareAttachment({
  bucket,
  author,
  recipient,
  taskId,
  attachment,
}) {
  const body = description(attachment);
  if (!body) return null;
  if (!ownedAttachmentPath(author, attachment.storagePath)) return body;
  const source = bucket.file(attachment.storagePath);
  let metadata;
  try {
    [metadata] = await source.getMetadata();
  } catch (error) {
    if (Number(error.code) === 404) return body;
    throw error;
  }
  if (
    !metadata.generation ||
    !Number.isFinite(Number(metadata.size)) ||
    Number(metadata.size) >= MAX_BYTES
  )
    return body;
  const key = createHash("sha256")
    .update(
      `${author}/${taskId}/${attachment.storagePath}/${metadata.generation}`,
    )
    .digest("hex")
    .slice(0, 48);
  const extension =
    /\.[a-z0-9]{1,10}$/i.exec(attachment.storagePath)?.[0] || "";
  const storagePath = `users/${recipient}/attachments/mention-${key}${extension}`;
  const target = bucket.file(storagePath);
  const contentType = metadata.contentType || "application/octet-stream";
  if (!(await target.exists())[0]) {
    try {
      // Pin the source generation so a replacement photo cannot race this copy.
      await bucket
        .file(attachment.storagePath, { generation: metadata.generation })
        .copy(target, {
          preconditionOpts: { ifGenerationMatch: 0 },
          contentType,
          metadata: { firebaseStorageDownloadTokens: randomUUID() },
        });
    } catch (error) {
      if (Number(error.code) !== 412) throw error;
    }
  } else {
    const [existing] = await target.getMetadata();
    const token = existing.metadata?.firebaseStorageDownloadTokens;
    if (
      existing.contentType !== contentType ||
      typeof token !== "string" ||
      !token ||
      token === metadata.metadata?.firebaseStorageDownloadTokens
    ) {
      await target.setMetadata({
        contentType,
        metadata: {
          firebaseStorageDownloadTokens: randomUUID(),
          contentType: null,
          metadata: null,
        },
      });
    }
  }
  return { ...body, storagePath };
}

const childrenOf = (task) =>
  Array.isArray(task?.subtasks)
    ? task.subtasks.filter(
        (child) => child && typeof child === "object" && child.id != null,
      )
    : [];

const attachmentsKey = (task) =>
  JSON.stringify([
    task?.deleted === true,
    task?.text || "",
    task?.attachment || null,
    childrenOf(task).map((child) => [
      String(child.id),
      child.attachment || null,
    ]),
  ]);

/** Also repairs mentions sent by older clients, which omitted the top-level file. */
export async function enrichMentionAttachments({
  db,
  bucket,
  recipient,
  taskId,
}) {
  if (!validKey(recipient) || !validKey(taskId)) return false;
  const mentionRef = db.doc(`users/${recipient}/mentions/${taskId}`);
  const mention = (await mentionRef.get()).data();
  const author = mention?.fromUid;
  if (!validKey(author) || author === recipient || mention.taskId !== taskId)
    return false;
  const taskRef = db.doc(`users/${author}/tasks/${taskId}`);
  const task = (await taskRef.get()).data();
  if (!task || task.deleted) return false;
  const [identity, outgoing, incoming] = await Promise.all([
    db.doc(`profiles/${recipient}`).get(),
    db.doc(`users/${author}/connections/${recipient}`).get(),
    db.doc(`users/${recipient}/connections/${author}`).get(),
  ]);
  const handle = identity.data()?.username;
  const handles = [
    ...String(task.text || "")
      .replace(/```[\s\S]*?```/g, " ")
      .matchAll(/(^|[^\w@/.-])@([a-z0-9._-]{2,24})/gi),
  ].map((match) => match[2].toLowerCase());
  if (
    typeof handle !== "string" ||
    !handles.includes(handle.toLowerCase()) ||
    outgoing.data()?.status !== "accepted" ||
    incoming.data()?.status !== "accepted"
  )
    return false;
  const fingerprint = attachmentsKey(task);
  const share = (attachment) =>
    shareAttachment({ bucket, author, recipient, taskId, attachment });
  const attachment = await share(task.attachment);
  const children = new Map();
  for (const child of childrenOf(task).slice(0, 500))
    children.set(String(child.id), await share(child.attachment));
  return db.runTransaction(async (transaction) => {
    const currentMention = (await transaction.get(mentionRef)).data();
    const currentTask = (await transaction.get(taskRef)).data();
    if (
      !currentMention ||
      currentMention.fromUid !== author ||
      currentMention.taskId !== taskId ||
      attachmentsKey(currentTask) !== fingerprint
    )
      return false;
    const patch = {};
    if (
      JSON.stringify(currentMention.attachment || null) !==
      JSON.stringify(attachment)
    )
      patch.attachment = attachment || null;
    const subtasks = childrenOf(currentMention).map((child) => {
      if (!children.has(String(child.id))) return child;
      const next = { ...child };
      const file = children.get(String(child.id));
      if (file) next.attachment = file;
      else delete next.attachment;
      return next;
    });
    if (
      JSON.stringify(subtasks) !== JSON.stringify(currentMention.subtasks || [])
    )
      patch.subtasks = subtasks;
    if (!Object.keys(patch).length) return false;
    transaction.update(mentionRef, patch);
    return true;
  });
}

export { attachmentsKey };
