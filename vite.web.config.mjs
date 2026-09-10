import { readFileSync } from "fs";
import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * The web build. Separate from electron.vite.config.mjs on purpose: that one
 * produces three bundles for Electron's processes, while this is an ordinary
 * browser build with no main or preload half.
 *
 * Two pages, not one:
 *   index.html  the site anybody lands on, static and script-light
 *   app.html    the React app, served at /app once Firebase Hosting has
 *               rewritten the clean URL onto it
 * Keeping them apart is what stops a visitor reading the front page from
 * downloading the whole Firebase SDK to do it.
 *
 * The root is src/web but the app imports from src/renderer, so the server's
 * allow-list has to reach one level above the root or dev mode refuses to read
 * those files.
 */
// The service worker means a browser can be running a build from days ago, so
// the settings sheet prints which one. Read here rather than imported from the
// component: importing package.json would bundle the whole file —
// devDependencies, build config and all — into the client.
const { version } = JSON.parse(readFileSync(resolve("package.json"), "utf8"));

export default defineConfig({
  root: "src/web",
  base: "/",
  define: { "import.meta.env.VITE_APP_VERSION": JSON.stringify(version) },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@renderer": resolve("src/renderer/src") },
  },
  server: {
    port: 5174,
    fs: { allow: [resolve(".")] },
  },
  build: {
    outDir: resolve("dist-web"),
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        site: resolve("src/web/index.html"),
        app: resolve("src/web/app.html"),
        // Google will not publish an OAuth consent screen without a public
        // privacy policy, so this page is a shipping requirement, not a nicety.
        privacy: resolve("src/web/privacy.html"),
      },
    },
  },
});
