import { readFileSync } from "fs";
import { resolve } from "path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * The OAuth client has to reach the packaged app somehow. `.env` deliberately
 * does not ship, and until this existed nothing took its place: a packaged
 * build read credentials only from a file in the user's own data folder, which
 * nobody but the developer had ever written. Every installed copy therefore
 * answered "Sign in with Google" with a dead button, on every platform, while
 * the developer's machine worked fine and hid it.
 *
 * Folding the values into the main bundle here is what an installed app can
 * actually use. An installed app cannot keep a client secret — Google says so
 * itself for this client type — so the flow leans on the loopback redirect and
 * on PKCE, not on this string staying hidden.
 */
function envFromFile() {
  const out = {};
  try {
    const raw = readFileSync(resolve(".env"), "utf-8");
    for (const line of raw.split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env — the warning below is the whole point */
  }
  return out;
}

const buildEnv = envFromFile();
const googleClientId =
  process.env.GOOGLE_CLIENT_ID || buildEnv.GOOGLE_CLIENT_ID || "";
const googleClientSecret =
  process.env.GOOGLE_CLIENT_SECRET || buildEnv.GOOGLE_CLIENT_SECRET || "";

// A build missing these looks perfect on the machine that made it and is
// broken for everyone who installs it. 1.3.12 shipped exactly that to both
// platforms: the warning that used to live here scrolled past unread, the
// artifacts were uploaded, and every person who downloaded one was told
// "This copy of Stepler was built without Google sign-in".
//
// So `electron-vite build` now refuses. Development still only warns, because
// a contributor without the credentials must still be able to run the app —
// and build/beforePack.cjs re-checks the built file before it is packaged,
// which is the check that catches a stale `out/` left by an earlier
// credential-less build.
const missingGoogle = !googleClientId || !googleClientSecret;
// `preview` is not a lighter mode — electron-vite runs the identical
// production build before serving it (its `preview()` calls `build()` unless
// asked not to), and `npm run start` is exactly that. Only `dev` is allowed to
// carry on with a warning, so a contributor without credentials can still run
// the app without leaving a credential-less bundle in out/ for a later
// `npx electron-builder` to package.
const isBuild = ["build", "preview"].some((cmd) => process.argv.includes(cmd));
if (missingGoogle) {
  const message =
    "No GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET found in .env or the " +
    "environment. This build ships WITHOUT Google sign-in — everyone who " +
    "installs it will only be able to sign in by email.";
  if (isBuild && process.env.STEPLER_ALLOW_NO_GOOGLE !== "1")
    throw new Error(
      `${message}\nSet STEPLER_ALLOW_NO_GOOGLE=1 to build one on purpose.`,
    );
  console.warn(`\n  ⚠  ${message}\n`);
}

export default defineConfig({
  main: {
    define: {
      __GOOGLE_CLIENT_ID__: JSON.stringify(googleClientId),
      __GOOGLE_CLIENT_SECRET__: JSON.stringify(googleClientSecret),
    },
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
      },
    },
    plugins: [react(), tailwindcss()],
  },
});
