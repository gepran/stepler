import { clipboard, ClipboardItem } from "electron";
import { pathToFileURL } from "node:url";

/** Electron 44 uses async ClipboardItems, including a single text/image write. */
export async function writeClipboardImage(image, text) {
  const data = {
    "image/png": new Blob([image.toPNG()], { type: "image/png" }),
  };
  if (text !== undefined) data["text/plain"] = String(text);
  await clipboard.write([new ClipboardItem(data)]);
}

/** Materialize every format before another application changes the clipboard. */
export async function snapshotClipboard() {
  const items = await clipboard.read();
  return Promise.all(
    items.map(async (item) => {
      const entries = await Promise.all(
        item.types.map(async (type) => [type, await item.getType(type)]),
      );
      return new ClipboardItem(Object.fromEntries(entries));
    }),
  );
}

export async function restoreClipboard(items) {
  if (items.length) await clipboard.write(items);
  else clipboard.clear();
}

export function copyFileReference(path) {
  // Electron maps this MIME type to CF_HDROP on Windows and copied files on macOS.
  return clipboard.write([
    new ClipboardItem({ "text/uri-list": pathToFileURL(path).href }),
  ]);
}
