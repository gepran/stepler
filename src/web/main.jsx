import "./styles.css";
import { registerAppFont } from "../renderer/src/lib/font";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

registerAppFont();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Registered after load so it never competes with the first paint. A failure
// here costs the install prompt and offline start, nothing else, so it is
// logged rather than surfaced.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) =>
        console.warn("Service worker not registered:", err.message),
      );
  });
}
