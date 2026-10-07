import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

const platform = process.argv[2];
assert.ok(["mac", "win"].includes(platform), "Use verify:update -- mac or win");
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const names =
  platform === "mac"
    ? [`Stepler-${version}-universal-mac.zip`, `stepler-${version}.dmg`]
    : [`stepler-${version}-setup.exe`];
const manifest = yaml.load(
  readFileSync(`dist/latest${platform === "mac" ? "-mac" : ""}.yml`, "utf8"),
);
assert.equal(
  manifest.version,
  version,
  "The update manifest must match the app version",
);
assert.equal(
  manifest.path,
  names[0],
  "The updater must point at the expected installer",
);
assert.deepEqual(
  new Set(manifest.files.map((file) => file.url)),
  new Set(names),
);
for (const file of manifest.files) {
  const path = join("dist", file.url);
  assert.equal(statSync(path).size, file.size, `Wrong size for ${file.url}`);
  const hash = createHash("sha512");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  assert.equal(
    hash.digest("base64"),
    file.sha512,
    `Wrong checksum for ${file.url}`,
  );
  assert.ok(
    statSync(`${path}.blockmap`).size > 0,
    `Missing block map for ${file.url}`,
  );
}
assert.equal(manifest.sha512, manifest.files[0].sha512);
if (platform === "mac") {
  const app = "dist/mac-universal/Stepler.app";
  const architectures = execFileSync(
    "lipo",
    ["-archs", `${app}/Contents/MacOS/Stepler`],
    { encoding: "utf8" },
  )
    .trim()
    .split(/\s+/);
  assert.deepEqual(new Set(architectures), new Set(["arm64", "x86_64"]));
  execFileSync("codesign", ["--verify", "--deep", "--strict", app]);
}
console.log(
  `Verified ${platform} ${version}: update filenames, sizes, SHA-512 checksums and block maps.`,
);
