/**
 * Every icon the app ships, rendered from the two SVGs that define them.
 *
 * There are two sources rather than one because they are different pictures:
 * build/icon.svg is the bare mark, which macOS and Windows then put in their
 * own frame, while favicon.svg carries the white squircle itself — that is
 * what a browser tab and a home screen expect to be handed.
 *
 * Run it with `node gen-icons.mjs` after either SVG changes. The PNGs are
 * committed, so a build never depends on this having been run.
 */

import sharp from "sharp";
import { readFileSync } from "fs";

const WEB = "src/web/public";

/** The squircle, at the size a given surface asks for. */
const square = (svg, size, out) =>
  sharp(svg).resize(size, size).png().toFile(out);

async function generate() {
  const mark = readFileSync("build/icon.svg");
  const squircle = readFileSync(`${WEB}/favicon.svg`);

  // The desktop app's icon: the bare mark, no frame of its own.
  await square(mark, 1024, "build/icon.png");
  await square(mark, 1024, "resources/icon.png");

  // The web app's icons. iOS ignores transparency and composites whatever it
  // finds onto black, so the Apple one is flattened onto the page's own
  // background rather than left with an alpha channel.
  await square(squircle, 192, `${WEB}/icon-192.png`);
  await square(squircle, 512, `${WEB}/icon-512.png`);
  await sharp(squircle)
    .resize(180, 180)
    .flatten({ background: "#ffffff" })
    .png()
    .toFile(`${WEB}/apple-touch-icon.png`);

  /**
   * The maskable one is a different shape of problem: a launcher crops it to
   * whatever silhouette it likes — a circle, a rounded square, a teardrop —
   * and only the middle ~80% is guaranteed to survive. So the squircle is
   * drawn small and centred on a full bleed of the app's own background, and
   * the crop takes the margin instead of the icon.
   */
  const MASKABLE = 512;
  const INSET = Math.round(MASKABLE * 0.58);
  const inner = await sharp(squircle).resize(INSET, INSET).png().toBuffer();
  await sharp({
    create: {
      width: MASKABLE,
      height: MASKABLE,
      channels: 4,
      // The same colour as the manifest's background_color, so the icon and
      // the splash screen behind it are one surface.
      background: "#fafafa",
    },
  })
    .composite([{ input: inner, gravity: "center" }])
    .png()
    .toFile(`${WEB}/icon-maskable-512.png`);

  console.log("Icons rebuilt from build/icon.svg and favicon.svg.");
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
