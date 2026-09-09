import { compressImage } from "./images";

export const ipc = window.electron?.ipcRenderer;

/**
 * Attachments live as files in the app's data folder and are served over the
 * app's own `stepler-file:` scheme. `previewUrl` is an object URL used only
 * while a pasted file is still pending, `url` only appears on legacy data that
 * has not been migrated yet.
 */
export function attachmentSrc(att) {
  if (!att) return null;
  if (att.previewUrl) return att.previewUrl;
  if (att.id) return `stepler-file://attachments/${encodeURIComponent(att.id)}`;
  if (typeof att.url === "string" && att.url.startsWith("data:"))
    return att.url;
  return null;
}

export function isMissing(att) {
  return !!att && !att.id && !att.previewUrl && !att.url;
}

/**
 * width/height attributes for an image attachment. The browser reserves the
 * right box before a lazy image loads, so nothing jumps while you scroll.
 */
export function imageBox(att) {
  if (att?.w && att?.h) return { width: att.w, height: att.h };
  return {};
}

/** Wrap a picked/pasted File for preview without writing anything to disk yet. */
export function pendingAttachment(file) {
  const name = file.name || `pasted-${Date.now()}.png`;
  return {
    file,
    name,
    type: file.type.startsWith("image/") ? "image" : "file",
    previewUrl: URL.createObjectURL(file),
    // Started here rather than at save time so the re-encode runs while the
    // user is still typing; by the time Enter lands it has almost always
    // finished. The preview chip keeps showing the original — the smaller copy
    // and its corrected extension only ever apply to what gets stored.
    compressed: compressImage(file, name),
  };
}

export function releasePending(pending) {
  if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
}

/** Persist a pending attachment; returns the stored `{ id, name, type }`. */
export async function persistAttachment(pending) {
  if (!pending) return null;
  if (pending.id)
    return { id: pending.id, name: pending.name, type: pending.type };
  if (!pending.file || !ipc) return null;
  try {
    // Null means the picture was left alone: too small to be worth it, not a
    // raster image, or it came out no smaller than it arrived.
    const smaller = await pending.compressed;
    const bytes = new Uint8Array(
      await (smaller?.blob || pending.file).arrayBuffer(),
    );
    const res = await ipc.invoke("save-attachment", {
      bytes,
      name: smaller?.name || pending.name,
      type: pending.type,
    });
    if (res?.success) return res.attachment;
    console.error("Could not store attachment:", res?.error);
  } catch (err) {
    console.error("Could not store attachment:", err);
  } finally {
    releasePending(pending);
  }
  return null;
}

export function copyAttachmentImage(att) {
  if (!att?.id || !ipc) return Promise.resolve({ success: false });
  return ipc.invoke("copy-attachment-image", { id: att.id });
}

export function copyAttachmentFile(att) {
  if (!att?.id || !ipc) return Promise.resolve({ success: false });
  return ipc.invoke("copy-attachment-file", { id: att.id, name: att.name });
}

export function downloadAttachment(att) {
  if (!att?.id || !ipc) return Promise.resolve({ success: false });
  return ipc.invoke("save-attachment-to-disk", { id: att.id, name: att.name });
}

export function openAttachment(att) {
  if (!att?.id || !ipc) return Promise.resolve({ success: false });
  return ipc.invoke("open-file-attachment", { id: att.id, name: att.name });
}

/** Read an attachment back as a Blob (used by the PDF preview). */
export async function attachmentBlob(att) {
  if (!att?.id || !ipc) return null;
  const res = await ipc.invoke("read-attachment", { id: att.id });
  if (!res?.success) return null;
  return new Blob([res.bytes], {
    type: att.name?.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "application/octet-stream",
  });
}

/** Copy a task: its text and subtasks, plus the image itself when there is one. */
export async function copyTask(task) {
  let text = task.text || task.title || "";
  if (task.subtasks?.length)
    text += "\n" + task.subtasks.map((st) => `- ${st.text}`).join("\n");
  const imageId = task.attachment?.type === "image" ? task.attachment.id : null;
  // The main process owns this: the renderer cannot fetch its own attachment
  // scheme under the page CSP, and Electron can put text and image on the
  // clipboard in a single write.
  if (ipc) return ipc.invoke("copy-task", { text, attachmentId: imageId });
  await navigator.clipboard.writeText(text);
  return { success: true };
}
