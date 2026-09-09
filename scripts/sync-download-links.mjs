/**
 * Keep the site's /download/* redirects pointing at a file that actually
 * exists.
 *
 * The GitHub asset URL carries the version in its filename, so anything
 * written by hand goes stale the moment a release ships — which is how a
 * "Download for Mac" button ends up bouncing somebody to a GitHub page instead
 * of handing them a file.
 *
 * Asking GitHub which assets each release holds, rather than assuming every
 * release has all of them, is what covers the other half of that: the two
 * platforms are built on different machines and do not always ship together,
 * and a Windows button pointing at a release that only ever had a .dmg is a
 * 404 with a friendly label on it. Each platform gets the newest release that
 * genuinely carries its installer.
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

const REPO = "gepran/stepler";
const RELEASES = `https://github.com/${REPO}/releases/download`;

/**
 * One entry per platform the site offers. `asset` builds the filename
 * electron-builder produces for a given version; changing the artifactName in
 * electron-builder.yml means changing it here too.
 */
const PLATFORMS = {
  "/download/mac": { asset: (v) => `stepler-${v}.dmg` },
  "/download/windows": { asset: (v) => `stepler-${v}-setup.exe` },
};

/**
 * Releases newest-first, each with the set of filenames it holds.
 *
 * Unauthenticated and read-only: this is public data, and asking for a token
 * to build a static page would be a worse trade than the fallback below.
 */
async function fetchReleases() {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/releases?per_page=30`,
    { headers: { accept: "application/vnd.github+json" } },
  );
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const body = await res.json();
  return body
    .filter((r) => !r.draft)
    .map((r) => ({
      tag: r.tag_name,
      version: String(r.tag_name).replace(/^v/, ""),
      assets: new Set((r.assets || []).map((a) => a.name)),
    }));
}

/** The newest release that actually carries this platform's installer. */
function newestWith(releases, asset) {
  for (const release of releases) {
    if (release.assets.has(asset(release.version))) return release;
  }
  return null;
}

let releases = [];
try {
  releases = await fetchReleases();
} catch (err) {
  // Offline, rate-limited, or GitHub is having a day. The build should not
  // stop over it — the current version is the best guess available, and it is
  // right in every case except a platform that has fallen behind.
  console.warn(
    `Could not ask GitHub which assets exist (${err.message}); ` +
      `falling back to v${version} for every platform.`,
  );
}

const downloads = {};
for (const [source, { asset }] of Object.entries(PLATFORMS)) {
  const found = releases.length ? newestWith(releases, asset) : null;
  const use = found?.version || version;
  downloads[source] = `${RELEASES}/v${use}/${asset(use)}`;
  if (found && found.version !== version) {
    console.warn(
      `${source} still points at v${found.version} — v${version} has no ${asset(version)} yet.`,
    );
  }
}

const configPath = join(root, "firebase.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

// Anything that is not a download redirect is left exactly as it was found.
const others = (config.hosting.redirects || []).filter(
  (r) => !(r.source in downloads),
);

config.hosting.redirects = [
  ...Object.entries(downloads).map(([source, destination]) => ({
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
for (const [source, destination] of Object.entries(downloads)) {
  console.log(`${source} -> ${destination.split("/download/")[1]}`);
}
