/**
 * Pasted screenshots are by far the heaviest thing Stepler stores: one
 * full-screen grab on a Retina Mac is a 4–8 MB PNG, and the app keeps every one
 * of them forever. Re-encoding once, at the size the app can actually show,
 * gives most of those bytes back without the reader seeing a difference.
 *
 * This lives in lib/ rather than beside the Electron helpers on purpose: it
 * touches nothing but the browser, so the web app can call it for its own
 * uploads too.
 */

// The largest box a picture is ever shown in is the preview modal's
// `max-w-5xl` — 1024 CSS px, so 2048 device pixels on a Retina screen. 2560
// clears that with room to spare while still trimming the 3456 px-wide grabs a
// modern Mac produces. The timeline thumbnail is `max-h-32` and never binds.
const MAX_EDGE = 2560;

// Under this a re-encode buys back kilobytes and costs a generation of
// quality, so the file that arrived is the file that gets stored.
const SKIP_BELOW_BYTES = 256 * 1024;

// Higher than the 0.8 usually quoted for photographs: screenshots are mostly
// small text, where JPEG's ringing shows up long before it does on a face.
const QUALITY = 0.92;

// A picture that will not decode must not be able to hold up the task it is
// attached to — saving awaits this, and saving is on the way to the timeline.
const TIMEOUT_MS = 8000;

/**
 * GIF is missing on purpose — decoding one hands back a single frame, so
 * "compressing" it would quietly delete the animation. So is SVG: rasterising
 * a vector is a downgrade, not a saving. Everything else that reaches this
 * file (PDFs, archives) is not an image at all.
 */
const COMPRESSIBLE = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * WebP would be a little smaller again, but Electron's `nativeImage` cannot
 * decode it — copy-image-to-clipboard, the stored dimensions and the export
 * data URL all go through it. PNG and JPEG keep every one of those working,
 * and on a screenshot the difference is a few per cent of a file that has
 * already shrunk by ninety.
 */
function targetType(hasAlpha) {
  return hasAlpha ? "image/png" : "image/jpeg";
}

/**
 * An animation decodes to its first frame, so "compressing" one would quietly
 * delete every other frame — and because a single frame is far smaller than the
 * whole file, the not-smaller guard would wave it through. GIF is excluded by
 * type; WebP and PNG have to be sniffed, because an animated one is the same
 * MIME type as a still one. WebP announces itself with an ANIM/ANMF chunk in
 * its RIFF container, APNG with an acTL chunk before the first IDAT.
 */
async function isAnimated(file) {
  try {
    const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
    const ascii = String.fromCharCode(...head);
    // WebP puts its ANIM chunk immediately after VP8X, inside the first few
    // dozen bytes. Scanning further would eventually match those four letters
    // inside compressed pixel data and refuse to touch a still picture.
    if (file.type === "image/webp") return ascii.slice(0, 64).includes("ANIM");
    if (file.type === "image/png") {
      const idat = ascii.indexOf("IDAT");
      const actl = ascii.indexOf("acTL");
      return actl !== -1 && (idat === -1 || actl < idat);
    }
    return false;
  } catch {
    // Unreadable here means unreadable in the decoder too; leave it alone.
    return true;
  }
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(w, h);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/**
 * `from-image` is spelled out because Chromium's default has changed across
 * versions, and a phone photo that silently lands on its side is a worse
 * outcome than anything the compression saves.
 */
function decode(blob) {
  return createImageBitmap(blob, { imageOrientation: "from-image" });
}

function encode(canvas, type, quality) {
  if (typeof canvas.convertToBlob === "function")
    return canvas.convertToBlob({ type, quality });
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Whether anything in the picture is see-through. A JPEG never is, so the scan
 * is skipped; for the rest the loop leaves on the first transparent pixel,
 * which for a screenshot with a rounded window corner is the very first row.
 */
function hasTransparency(ctx, w, h, sourceType) {
  if (sourceType === "image/jpeg") return false;
  try {
    const { data } = ctx.getImageData(0, 0, w, h);
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) return true;
    return false;
  } catch {
    // A tainted canvas cannot be read. Assume alpha and keep PNG, which is
    // the choice that cannot lose anything.
    return true;
  }
}

/** `shot.png` → `shot.jpg`, with room left for the 120-char cap on the name. */
function swapExtension(name, type) {
  const ext = type === "image/png" ? "png" : "jpg";
  const base = String(name || "image")
    .replace(/\.[A-Za-z0-9]{1,12}$/, "")
    .slice(0, 110);
  return `${base}.${ext}`;
}

async function run(file, name) {
  if (!COMPRESSIBLE.has(file.type)) return null;
  if (file.size < SKIP_BELOW_BYTES) return null;
  if (await isAnimated(file)) return null;

  const bitmap = await decode(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  const alpha = hasTransparency(ctx, w, h, file.type);
  const type = targetType(alpha);
  // JPEG has no alpha channel, so anything transparent would be composited
  // against black. Nothing reaches this line unless the picture is opaque.
  bitmap.close?.();

  const blob = await encode(canvas, type, QUALITY);
  // A browser that cannot encode a format does not say so — it hands back a
  // PNG under the name you asked for. The blob's own type is the only honest
  // answer, and a PNG re-encode of a photograph is usually bigger than the
  // JPEG that arrived.
  if (!blob) return null;
  if (blob.size >= file.size) return null;
  return { blob, name: swapExtension(name, blob.type) };
}

/**
 * The smaller copy of a picture, or null when it should be stored as it
 * arrived. Never rejects and never hangs: every failure — an undecodable file,
 * a format the browser will not encode, a result that came out bigger — ends
 * as null, and the caller stores the original bytes.
 */
export function compressImage(file, name) {
  return Promise.race([
    run(file, name).catch((err) => {
      console.warn("Could not compress the image:", err?.message || err);
      return null;
    }),
    new Promise((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
  ]);
}
