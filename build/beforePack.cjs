const { readFileSync } = require("fs");
const path = require("path");

/**
 * 1.3.12 shipped to both platforms with no Google client id in it. The build
 * that made those artifacts printed the warning in electron.vite.config.mjs
 * and carried on, the artifacts looked perfect, and every person who installed
 * one was told "This copy of Stepler was built without Google sign-in" the
 * moment they clicked the Google button.
 *
 * A warning scrolls past. This does not: packaging stops unless the bundle
 * about to be wrapped actually contains the credentials. It reads the built
 * file rather than the config, because the file is what ends up in the asar —
 * a stale `out/` from an earlier credential-less build is exactly how this
 * went wrong, and only the artifact can tell you about that.
 *
 * Set STEPLER_ALLOW_NO_GOOGLE=1 to package without them on purpose.
 */
exports.default = async function (context) {
  if (process.env.STEPLER_ALLOW_NO_GOOGLE === "1") {
    console.warn(
      "\n  ⚠  STEPLER_ALLOW_NO_GOOGLE=1 — packaging without Google sign-in.\n",
    );
    return;
  }

  const bundle = path.join(context.packager.projectDir, "out/main/index.js");
  let source;
  try {
    source = readFileSync(bundle, "utf-8");
  } catch {
    throw new Error(
      `Cannot read ${bundle}. Run \`npm run build\` before packaging.`,
    );
  }

  // The define in electron.vite.config.mjs folds both values in literally, so
  // the fixed markers each one carries are what to look for. BOTH are checked:
  // an id with an empty secret is a worse failure than no credentials at all,
  // because the consent screen opens and the exchange fails afterwards — the
  // person has already handed Google their password by then.
  const missing = [];
  if (!source.includes("apps.googleusercontent.com")) missing.push("client id");
  if (!/GOCSPX-\S/.test(source)) missing.push("client secret");

  if (missing.length)
    throw new Error(
      `out/main/index.js carries no Google ${missing.join(" and no ")}, so ` +
        "this package would ship with Google sign-in dead — which is what " +
        "1.3.12 did.\n" +
        "Put GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET back in .env, re-run " +
        "`npm run build`, and package again.\n" +
        "Set STEPLER_ALLOW_NO_GOOGLE=1 to override.",
    );

  console.log("Google credentials present in out/main/index.js ✓");
};
