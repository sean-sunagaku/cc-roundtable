#!/usr/bin/env node

/**
 * Generate Python constants from the TypeScript hook contract.
 *
 * Usage:
 *   node scripts/generate-hook-contracts.mjs          # generate src/packages/meeting-room-hooks/contracts.py
 *   node scripts/generate-hook-contracts.mjs --check   # verify src/packages/meeting-room-hooks/contracts.py is up-to-date
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { transformSync } = require("../src/apps/desktop/node_modules/esbuild");

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(__filename), "..");
const contractTsPath = resolve(repoRoot, "src/packages/shared-contracts/src/hook-contract.ts");
const outputPath = resolve(repoRoot, "src/packages/meeting-room-hooks/contracts.py");
const checkMode = process.argv.includes("--check");

// ---------------------------------------------------------------------------
// 1. Compile TS → JS and eval to get the exported constants
// ---------------------------------------------------------------------------

const tsSource = readFileSync(contractTsPath, "utf-8");
const { code } = transformSync(tsSource, { loader: "ts", format: "cjs" });

const moduleExports = {};
const moduleFake = { exports: moduleExports };
new Function("module", "exports", code)(moduleFake, moduleExports);

const exports = moduleFake.exports;

// ---------------------------------------------------------------------------
// 2. Naming helpers
// ---------------------------------------------------------------------------

/** camelCase → UPPER_SNAKE_CASE  (e.g. "meetingId" → "MEETING_ID") */
function camelToUpperSnake(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toUpperCase();
}

/** UPPER_SNAKE_CASE → PascalCase  (e.g. "RELAY_PAYLOAD_FIELDS" → "RelayPayloadFields") */
function upperSnakeToPascal(str) {
  return str.toLowerCase().replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// 3. Generate Python source
// ---------------------------------------------------------------------------

const lines = [
  '"""Auto-generated from src/packages/shared-contracts/src/hook-contract.ts',
  "",
  "DO NOT EDIT MANUALLY. Run `make contracts` to regenerate.",
  '"""',
  "",
  ""
];

// Sort export names for stable output
const exportNames = Object.keys(exports).sort();

for (const exportName of exportNames) {
  const value = exports[exportName];
  if (typeof value !== "object" || value === null) continue;

  const className = upperSnakeToPascal(exportName);
  lines.push(`class ${className}:`);

  const entries = Object.entries(value);
  if (entries.length === 0) {
    lines.push("    pass");
  } else {
    for (const [key, val] of entries) {
      const pyName = camelToUpperSnake(key);
      const pyVal = JSON.stringify(val);
      lines.push(`    ${pyName} = ${pyVal}`);
    }
  }
  lines.push("");
  lines.push("");
}

// Add an ALL dict for introspection / runtime validation
lines.push("# All contract classes for introspection");
lines.push("ALL_CONTRACTS = {");
for (const exportName of exportNames) {
  if (typeof exports[exportName] !== "object" || exports[exportName] === null) continue;
  const className = upperSnakeToPascal(exportName);
  lines.push(`    "${exportName}": ${className},`);
}
lines.push("}");
lines.push("");

const output = lines.join("\n");

// ---------------------------------------------------------------------------
// 4. Write or check
// ---------------------------------------------------------------------------

if (checkMode) {
  let existing = "";
  try {
    existing = readFileSync(outputPath, "utf-8");
  } catch {
    console.error(
      `[contracts] src/packages/meeting-room-hooks/contracts.py does not exist. Run: make contracts`
    );
    process.exit(1);
  }
  if (existing !== output) {
    console.error(
      `[contracts] src/packages/meeting-room-hooks/contracts.py is out of date. Run: make contracts`
    );
    process.exit(1);
  }
  console.log("[contracts] src/packages/meeting-room-hooks/contracts.py is up to date.");
} else {
  writeFileSync(outputPath, output, "utf-8");
  console.log(`[contracts] Generated ${outputPath}`);
}
