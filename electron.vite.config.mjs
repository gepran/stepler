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
// broken for everyone who installs it. That trade is only worth making on
// purpose, so make the build say it out loud.
if (!googleClientId || !googleClientSecret)
  console.warn(
    "\n  ⚠  No GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET found in .env or the\n" +
      "     environment. This build ships WITHOUT Google sign-in — everyone\n" +
      "     who installs it will only be able to sign in by email.\n",
  );

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
