import React from "react";
import { createRoot } from "react-dom/client";
import { PublicShareApp } from "./PublicShareApp";
import "../../desktop/src/renderer/styles/global.css";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("root element not found");
}

createRoot(root).render(
  <React.StrictMode>
    <PublicShareApp />
  </React.StrictMode>
);
