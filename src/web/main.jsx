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
