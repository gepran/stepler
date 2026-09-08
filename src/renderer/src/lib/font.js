// Chromium never fetches a lazily-declared @font-face on a file:// page: the
// face stays "unloaded" and text silently falls through to the system stack.
// Inlining the file and registering it by hand takes the fetch out of the
// picture entirely, so the family is there before the first paint that needs it.
import fontUrl from "../assets/fonts/BPGMrgvlovaniCaps2010.ttf?inline";

export function registerAppFont() {
  if (typeof FontFace !== "function" || !document.fonts) return;
  try {
    const face = new FontFace("BPG Mrgvlovani Caps", `url(${fontUrl})`, {
      weight: "normal",
      style: "normal",
    });
    face
      .load()
      .then((loaded) => document.fonts.add(loaded))
      .catch((err) =>
        console.warn("Could not load the app font:", err.message),
      );
  } catch (err) {
    console.warn("Could not register the app font:", err.message);
  }
}
