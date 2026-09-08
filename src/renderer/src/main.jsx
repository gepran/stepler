import "./assets/main.css";
import { registerAppFont } from "./lib/font";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

registerAppFont();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
