import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * The web build. Separate from electron.vite.config.mjs on purpose: that one
 * produces three bundles for Electron's processes, while this is an ordinary
 * single-page app with no main or preload half.
 *
 * The root is src/web but the app imports from src/renderer, so the server's
 * allow-list has to reach one level above the root or dev mode refuses to read
 * those files.
 */
export default defineConfig({
  root: "src/web",
  base: "/",
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
  },
});
