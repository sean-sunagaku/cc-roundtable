#!/usr/bin/env node

import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const eslintBin = path.join(
  rootDir,
  "src",
  "apps",
  "desktop",
  "node_modules",
  "eslint",
  "bin",
  "eslint.js"
);
const passthroughArgs = process.argv.slice(2);

const result = spawnSync(
  process.execPath,
  [
    eslintBin,
    "--max-warnings=0",
    "--config",
    path.join(rootDir, "eslint.config.mjs"),
    ...passthroughArgs,
    "e2e",
    "scripts",
    "src",
    "src/apps/desktop/vite.config.ts"
  ],
  {
    cwd: rootDir,
    stdio: "inherit"
  }
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
