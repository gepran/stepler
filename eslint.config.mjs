import eslint from "@electron-toolkit/eslint-config";
import eslintConfigPrettier from "@electron-toolkit/eslint-config-prettier";
import eslintPluginReact from "eslint-plugin-react";
import eslintPluginReactHooks from "eslint-plugin-react-hooks";
import eslintPluginReactRefresh from "eslint-plugin-react-refresh";

export default [
  // "index.js" is a stale esbuild bundle at the repo root, not a source
  // file. No "**/" prefix, so it matches only the root one and leaves
  // src/main/index.js and the preload entry point being linted.
  {
    ignores: [
      "**/node_modules",
      "**/dist",
      "**/dist-web",
      "**/out",
      "index.js",
    ],
  },
  eslint,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat["jsx-runtime"],
  {
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  // Folded into the main bundle by electron.vite.config.mjs at build time, so
  // they exist in the built file and nowhere in the source tree.
  {
    files: ["src/main/**/*.js"],
    languageOptions: {
      globals: {
        __GOOGLE_CLIENT_ID__: "readonly",
        __GOOGLE_CLIENT_SECRET__: "readonly",
      },
    },
  },
  {
    files: ["**/*.{js,jsx}"],
    plugins: {
      "react-hooks": eslintPluginReactHooks,
      "react-refresh": eslintPluginReactRefresh,
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules,
    },
  },
  eslintConfigPrettier,
];
