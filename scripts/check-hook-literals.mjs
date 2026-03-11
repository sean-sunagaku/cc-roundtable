#!/usr/bin/env node

/**
 * CI check: detect hardcoded string literals in hooks that should use contracts.
 *
 * Scans all Python hooks for string literals that match values defined in
 * hook-contract.ts. These should be using the generated contracts.py constants.
 *
 * Usage:
 *   node scripts/check-hook-literals.mjs
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { transformSync } = require("../src/apps/desktop/node_modules/esbuild");

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(__filename), "..");
const hooksDir = resolve(repoRoot, "src/packages/meeting-room-hooks");
const contractTsPath = resolve(repoRoot, "src/packages/shared-contracts/src/hook-contract.ts");

// ---------------------------------------------------------------------------
// 1. Load contract values
// ---------------------------------------------------------------------------

const tsSource = readFileSync(contractTsPath, "utf-8");
const { code } = transformSync(tsSource, { loader: "ts", format: "cjs" });
const moduleExports = {};
const moduleFake = { exports: moduleExports };
new Function("module", "exports", code)(moduleFake, moduleExports);
const exports = moduleFake.exports;

// Collect all contract string values with their source
const contractValues = new Map(); // value → { exportName, key }
for (const [exportName, obj] of Object.entries(exports)) {
  if (typeof obj !== "object" || obj === null) continue;
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value !== "string") continue;
    contractValues.set(value, { exportName, key });
  }
}

// Values that are too generic to flag (would cause false positives)
// or are used as Claude Code input keys (not our output contract)
const IGNORE_VALUES = new Set([
  "type",
  "id",
  "content",
  "timestamp",
  "status",
  "team",
  "sender",
  "subagent",
  "mode",
  "reason",
  "open",
  "blocked",
  "active",
  "completed"
]);

// ---------------------------------------------------------------------------
// 2. Scan hooks for hardcoded literals
// ---------------------------------------------------------------------------

const hookFiles = readdirSync(hooksDir).filter(
  (f) => f.endsWith(".py") && f !== "contracts.py" && f !== "__pycache__"
);

const violations = [];

for (const file of hookFiles) {
  const filePath = resolve(hooksDir, file);
  const source = readFileSync(filePath, "utf-8");
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comments and import lines
    if (line.trimStart().startsWith("#") || line.trimStart().startsWith("from contracts")) continue;

    for (const [value, info] of contractValues) {
      if (IGNORE_VALUES.has(value)) continue;

      // Check for the value as a string literal (quoted)
      const patterns = [`"${value}"`, `'${value}'`];
      for (const pattern of patterns) {
        if (line.includes(pattern)) {
          violations.push({
            file,
            line: i + 1,
            value,
            exportName: info.exportName,
            key: info.key,
            context: line.trim()
          });
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Report
// ---------------------------------------------------------------------------

if (violations.length === 0) {
  console.log("[check-hook-literals] No hardcoded contract values found in hooks.");
  process.exit(0);
}

console.error(`[check-hook-literals] Found ${violations.length} hardcoded contract value(s):\n`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}`);
  console.error(`    Found: "${v.value}"`);
  console.error(`    Should use: ${v.exportName}.${v.key}`);
  console.error(`    Context: ${v.context}`);
  console.error();
}
process.exit(1);
