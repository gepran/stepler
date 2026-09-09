/**
 * Keep the site's /download/* redirects pointing at the release that actually
 * exists.
 *
 * The GitHub asset URL carries the version in its filename, so anything
 * written by hand goes stale the moment a release ships — which is how a
 * "Download for Mac" button ends up bouncing somebody to a GitHub page instead
 * of handing them a file. The version lives in exactly one place, package.json,
 * and this copies it into firebase.json before every web build.
 *
 * Run by the `prebuild:web` script, so there is no way to deploy the site
 * without it having run.
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
);

const RELEASES = "https://github.com/gepran/stepler/releases/download";

// One entry per platform the site offers. The asset names are the ones
// electron-builder produces; changing them in electron-builder.yml means
// changing them here.
const DOWNLOADS = {
  "/download/mac": `${RELEASES}/v${version}/stepler-${version}.dmg`,
  "/download/windows": `${RELEASES}/v${version}/stepler-${version}-setup.exe`,
};

const configPath = join(root, "firebase.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

// Anything that is not a download redirect is left exactly as it was found.
const others = (config.hosting.redirects || []).filter(
  (r) => !(r.source in DOWNLOADS),
);

config.hosting.redirects = [
  ...Object.entries(DOWNLOADS).map(([source, destination]) => ({
    source,
    destination,
    // 302, not 301: the destination changes with every release, and a browser
    // that cached a permanent redirect would keep downloading an old build
    // long after this file stopped mentioning it.
    type: 302,
  })),
  ...others,
];

writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Download redirects point at v${version}.`);
