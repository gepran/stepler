import { useEffect, useState } from "react";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { app } from "./firebase";
import { compressImage } from "../renderer/src/lib/images";

/**
 * The web half of attachments. A task document carries only the description of
 * a file — its name, its kind, its pixel size — plus a `storagePath`; the bytes
 * themselves live in Firebase Storage, put there either by the desktop app or
 * by this one.
 */

export const storage = getStorage(app);

/** storage.rules refuses a write at or above this. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/**
 * One download URL per path, remembered for the life of the page. The timeline
 * re-groups every row on every Firestore snapshot, so without this a month of
 * screenshots would ask Storage for the same handful of URLs each time anybody
 * ticked a checkbox.
 *
 * A rejection is deliberately not remembered: a file still uploading from the
 * laptop resolves a moment later, and caching the failure would leave the row
 * showing a placeholder until the page was reloaded.
 */
const urls = new Map();

export function attachmentUrl(path) {
  let pending = urls.get(path);
  if (!pending) {
    pending = getDownloadURL(ref(storage, path)).catch((err) => {
      urls.delete(path);
      throw err;
    });
    urls.set(path, pending);
  }
  return pending;
}

/**
 * `url` is null while it is on its way; `failed` says it is not coming.
 *
 * The result is keyed by the path it belongs to and compared during render
 * rather than reset from inside the effect: writing state synchronously in an
 * effect body costs a second render pass for every row on the page.
 */
export function useAttachmentUrl(att) {
  const path = att?.storagePath || null;
  const [done, setDone] = useState({ path: null, url: null, failed: false });
  // A phone opens the app on no signal, every lookup rejects, and the effect's
  // only other dependency — the path — never changes again. Without this the
  // whole page would show "no file yet" chips until a full reload.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const again = () => setAttempt((n) => n + 1);
    window.addEventListener("online", again);
    return () => window.removeEventListener("online", again);
  }, []);

  useEffect(() => {
    if (!path) return undefined;
    let live = true;
    attachmentUrl(path).then(
      (url) => live && setDone({ path, url, failed: false }),
      (err) => {
        // Expected whenever the desktop has not got round to uploading this
        // one, so it is a note rather than something to put in front of anyone.
        console.warn("No file yet for", path, err.code || err.message);
        if (live) setDone({ path, url: null, failed: true });
      },
    );
    return () => {
      live = false;
    };
  }, [path, attempt]);

  if (!path) return { url: null, failed: true };
  if (done.path !== path) return { url: null, failed: false };
  return { url: done.url, failed: done.failed };
}

const EXT_RE = /\.([a-z0-9]{1,12})$/i;

function extOf(name) {
  const m = EXT_RE.exec(String(name || ""));
  return m ? `.${m[1].toLowerCase()}` : "";
}

/** Intrinsic size, so a row reserves the right box before the image loads and
 *  nothing jumps under the reader while it scrolls. */
async function imageBox(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const box = { w: bitmap.width, h: bitmap.height };
    bitmap.close?.();
    return box;
  } catch {
    return null; // an image this browser cannot decode still uploads fine
  }
}

/**
 * Put a picked or pasted file in Storage and describe it the way a task
 * document wants it.
 *
 * Deliberately no `id`: on the desktop that field means "the bytes are in this
 * machine's attachments folder", and claiming it here would make every desktop
 * draw a broken image until it had downloaded the file. The last segment of the
 * path is the id the desktop will adopt once it has.
 */
export async function uploadAttachment(uid, file) {
  const type = file.type.startsWith("image/") ? "image" : "file";
  const original = String(file.name || `pasted-${Date.now()}.png`).slice(
    0,
    120,
  );
  // Same re-encode the desktop composer runs, so a photo taken on the phone
  // does not go up at twelve megapixels.
  const smaller = await compressImage(file, original);
  const body = smaller?.blob || file;
  const name = smaller?.name || original;
  // randomUUID needs a secure context, which the LAN address a phone reaches a
  // dev server on is not. The id only has to be unique inside this user's own
  // folder and match the desktop's ATTACH_ID_RE.
  const rid =
    crypto.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const storagePath = `users/${uid}/attachments/${rid}${extOf(name)}`;
  await uploadBytes(ref(storage, storagePath), body, {
    contentType: body.type || "application/octet-stream",
  });
  const box = type === "image" ? await imageBox(body) : null;
  return { name, type, storagePath, ...(box || {}) };
}
