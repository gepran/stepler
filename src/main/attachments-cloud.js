/**
 * Attachment bytes in the cloud.
 *
 * Firestore already carries what an attachment IS — its name, its kind, its
 * pixel size — but never the file itself, which is why a task that shows a
 * screenshot on the laptop showed nothing in the browser. This module moves the
 * bytes: up to Firebase Storage for a file only this machine has, and back down
 * for a file this machine knows only the name of.
 *
 * The storage path is the whole contract between the desktop and the web app.
 * Its last segment is the same string the desktop already uses as the file's
 * name on disk, so a machine that downloads an attachment files it under the id
 * every other machine agreed on and nobody has to translate anything.
 *
 * `id` therefore keeps meaning exactly what it always meant — the bytes are on
 * THIS disk — which is why an attachment made in the browser arrives without
 * one.
 *
 * Nothing here is load-bearing. Storage may not be enabled on the project, the
 * rules may refuse a file, the network may be gone — in each case tasks must
 * keep syncing exactly as they do today, so failures are remembered and dropped
 * rather than raised.
 */

import { getBytes, getStorage, ref, uploadBytes } from "firebase/storage";

/** The same shape the desktop already accepts as an on-disk attachment name. */
const FILE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;

/** storage.rules refuses a write at or above this, so never offer it one. */
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * How many files one pass moves. A first run has a whole history to get through
 * and there is no hurry, so it drips rather than saturating the connection on
 * the same tick the tasks are syncing on.
 */
const PER_PASS = 6;

/** After this many failures a file waits for the next launch instead of asking
 *  again every few seconds. */
const MAX_TRIES = 5;

const MIME = {
  avif: "image/avif",
  gif: "image/gif",
  heic: "image/heic",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  pdf: "application/pdf",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

let storage = null;

/** Files this session has already placed on disk, so a settled account costs a
 *  set lookup per attachment per tick instead of a stat. */
const present = new Set();

/** Failures per attachment, keyed the same way the patches are. */
const tries = new Map();

/** Handed the app sync.js signed in with, so an upload carries the session the
 *  storage rules actually check. */
export function initCloudFiles(app) {
  storage = getStorage(app);
}

/**
 * Both maps are account-scoped, and a `tries` entry keyed on a bare local id
 * would otherwise follow one account into the next sign-in.
 */
export function resetCloudFiles() {
  present.clear();
  tries.clear();
}

export function storagePathFor(uid, fileId) {
  return `users/${uid}/attachments/${fileId}`;
}

/**
 * The on-disk name for a cloud path, or null when the path is not one of ours.
 * Every byte of this comes off a task document, so it is checked rather than
 * trusted: a crafted path must not name a file outside the attachments folder
 * or inside somebody else's account.
 */
export function fileIdFromPath(uid, path) {
  const prefix = `users/${uid}/attachments/`;
  if (typeof path !== "string" || !path.startsWith(prefix)) return null;
  const id = path.slice(prefix.length);
  return FILE_ID_RE.test(id) && !id.includes("..") ? id : null;
}

function mimeFor(att) {
  const ext = String(att.name || "")
    .split(".")
    .pop()
    .toLowerCase();
  return MIME[ext] || "application/octet-stream";
}

/**
 * Bring one account's attachments and its Storage folder into agreement.
 *
 * Returns `patches` — the fields to merge into each attachment, keyed by
 * whatever already identified it: its path when the bytes are up, its local id
 * when they are not. String keys rather than object identity on purpose:
 * uploading megabytes takes long enough that the caller must re-read the data
 * before applying this, and by then the objects are different ones.
 *
 * Also returns `remaining` — files this pass did not get through, either
 * because it hit its own per-pass ceiling or because they failed. The caller
 * needs it: a pass where everything failed produces no patches, and without a
 * count there would be nothing to tell it to come back.
 */
export async function reconcileAttachments({ uid, tasks, disk }) {
  const patches = new Map();
  if (!storage || !uid || !disk) return { patches, remaining: 0 };

  const jobs = [];
  const seen = new Set();

  const consider = (att) => {
    if (!att || typeof att !== "object") return;
    const key = att.storagePath || att.id;
    if (typeof key !== "string" || seen.has(key)) return;
    seen.add(key);
    if ((tries.get(key) || 0) >= MAX_TRIES) return;

    if (att.storagePath) {
      const fileId = fileIdFromPath(uid, att.storagePath);
      if (!fileId) {
        tries.set(key, MAX_TRIES); // not a path we wrote; never will be
        return;
      }
      // The bytes are already up. All that is left is getting them down, and
      // only on a machine that does not have them.
      if (present.has(fileId)) return;
      if (disk.has(fileId)) {
        present.add(fileId);
        return;
      }
      jobs.push({ kind: "down", key, fileId, path: att.storagePath });
      return;
    }

    // No path: a file this machine made that nobody else can see yet.
    if (typeof att.id !== "string" || !FILE_ID_RE.test(att.id)) return;
    if (!disk.has(att.id)) return;
    jobs.push({
      kind: "up",
      key,
      fileId: att.id,
      path: storagePathFor(uid, att.id),
      mime: mimeFor(att),
    });
  };

  for (const task of tasks) {
    consider(task.attachment);
    (task.subtasks || []).forEach((st) => consider(st?.attachment));
  }

  const batch = jobs.slice(0, PER_PASS);
  let failures = 0;
  for (const job of batch) {
    try {
      if (job.kind === "up") {
        const bytes = disk.read(job.fileId);
        if (!bytes) continue;
        if (bytes.length >= MAX_BYTES) {
          // The desktop accepts files up to 64 MB and the rules stop at 25, so
          // this one simply stays where it is rather than being retried for the
          // rest of the session.
          console.warn(
            `Attachment ${job.fileId} is ${(bytes.length / 1048576).toFixed(1)} MB and stays on this machine; storage.rules stops at 25 MB.`,
          );
          tries.set(job.key, MAX_TRIES);
          continue;
        }
        await uploadBytes(ref(storage, job.path), bytes, {
          contentType: job.mime,
        });
        present.add(job.fileId);
        patches.set(job.key, { storagePath: job.path });
      } else {
        const buffer = await getBytes(ref(storage, job.path), MAX_BYTES);
        if (!disk.write(job.fileId, new Uint8Array(buffer))) continue;
        present.add(job.fileId);
        // `id` is what stops the renderer drawing a placeholder and starts it
        // drawing the file — and it is the id every other machine already uses.
        patches.set(job.key, { id: job.fileId });
      }
    } catch (err) {
      const n = (tries.get(job.key) || 0) + 1;
      tries.set(job.key, n);
      if (n < MAX_TRIES) failures += 1;
      console.warn(
        `Attachment ${job.kind === "up" ? "upload" : "download"} failed for ${job.fileId}:`,
        err?.code || "",
        err?.message || err,
      );
    }
  }
  // Whatever the ceiling left behind, plus whatever is still worth retrying.
  return { patches, remaining: jobs.length - batch.length + failures };
}
