import { spawnSync } from "node:child_process";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";

// Deploy receipt storage before Telegram is configured, without discovering
// secret parameters from the separate Telegram delivery entry point.
const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
if (
  args.length &&
  (args.length !== 2 ||
    args[0] !== "--account" ||
    !/^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+$/.test(args[1]))
) {
  throw new Error(
    "Use deploy:report-intake with an optional --account email address.",
  );
}
const temp = mkdtempSync(join(tmpdir(), "stepler-report-intake-"));
try {
  const source = join(temp, "functions");
  cpSync(join(root, "functions"), source, {
    recursive: true,
    filter: (path) =>
      !["node_modules", "test", ".secret.local"].includes(basename(path)) &&
      !basename(path).startsWith(".env"),
  });
  symlinkSync(
    join(root, "functions/node_modules"),
    join(source, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const pkg = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
  pkg.main = "intake.mjs";
  writeFileSync(join(source, "package.json"), JSON.stringify(pkg));
  const config = join(temp, "firebase.json");
  writeFileSync(
    config,
    JSON.stringify({
      functions: [
        {
          source: "functions",
          codebase: "reports",
          runtime: "nodejs22",
          ignore: ["node_modules", "test", ".env*", ".secret.local", "*.log"],
        },
      ],
    }),
  );
  const result = spawnSync(
    process.platform === "win32" ? "firebase.cmd" : "firebase",
    [
      "deploy",
      "--config",
      config,
      "--project",
      "stepler-490308",
      "--only",
      "functions:reports:reportIssue",
      "--non-interactive",
      ...args,
    ],
    { cwd: root, stdio: "inherit", shell: process.platform === "win32" },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
