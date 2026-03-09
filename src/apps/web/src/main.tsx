import React from "react";
import { createRoot } from "react-dom/client";
import { WebRootApp } from "./WebRootApp";
import "../../desktop/src/renderer/styles/global.css";
import "@xterm/xterm/css/xterm.css";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("root element not found");
}

createRoot(root).render(
  <React.StrictMode>
    <WebRootApp />
  </React.StrictMode>
);
