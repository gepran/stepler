/**
 * Colours for the "#label" chips a task carries.
 *
 * The palette is the logo's, widened for separation rather than sampled for
 * smoothness: the landing page's gradient runs blue → violet → pink → amber →
 * red, and those stops plus five neighbours give ten hues nobody has to squint
 * at to tell apart. Sampling the gradient evenly would have produced two
 * oranges and no green.
 *
 * A label's colour is derived from its NAME, not stored. That is deliberate.
 * Settings never leave the machine — src/main/sync.js carries tasks and
 * nothing else — so a stored colour would be invisible on a second computer
 * and in the browser, while the `#name` on the task travels everywhere. A hash
 * of the name gives the same hue on every device with nothing to migrate and
 * nothing to sync, and it never drifts when another label is added.
 *
 * What IS stored is an override: pick a colour in Settings → Projects and a
 * `color` key lands on that saved project entry, for that machine.
 */

export const LABEL_COLORS = [
  "#41A1FF", // blue — the logo's cool end
  "#5856D6", // indigo
  "#9B6AFF", // violet — the logo's second stop
  "#D65DB1", // orchid
  "#FF5F9E", // pink — the bridge the gradient is routed through
  "#FF3B30", // red — the logo's warm end
  "#FF9A00", // amber
  "#8BC220", // lime
  "#34C759", // green
  "#00B8A9", // teal
];

/** Settings stores projects as bare strings (old data) or as objects. */
export function projectName(project) {
  return typeof project === "string" ? project : project?.name || "";
}

/**
 * FNV-1a: short, dependency-free, and it spreads single words well — which
 * matters, because label names are single words. `>>> 0` after every step is
 * what keeps it in unsigned 32-bit territory; without it the multiply spills
 * into a double and different names start landing on the same hue.
 */
function hashName(name) {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Only something shaped like one of the palette's values gets out of storage. */
export function validLabelColor(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : null;
}

/** The colour a saved project entry carries, if it carries one. */
export function savedColor(project) {
  return typeof project === "string" ? null : validLabelColor(project?.color);
}

/**
 * The colour to draw a label in: the override Settings holds for it, and
 * otherwise the one its name hashes to.
 *
 * `projects` may hold bare strings, so every read goes through the guards
 * above rather than reaching for `.color` on something that has none. Matching
 * is case-insensitive because the same word typed two ways is one label to the
 * person who typed it.
 */
export function colorForLabel(name, projects) {
  const clean = String(name || "");
  const saved = (projects || []).find(
    (p) => projectName(p).toLowerCase() === clean.toLowerCase(),
  );
  return (
    savedColor(saved) ||
    LABEL_COLORS[hashName(clean.toLowerCase()) % LABEL_COLORS.length]
  );
}

/**
 * The chip's colour reaches CSS as a custom property rather than as a finished
 * background, because the same hue needs a different tint in each theme and an
 * inline style cannot ask which theme it is in. `.label-chip` in base.css does
 * the mixing; this only says which hue to mix.
 */
export function labelStyle(color) {
  return { "--label": color };
}
