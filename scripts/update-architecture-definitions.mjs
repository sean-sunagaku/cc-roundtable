#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const docsRoot = path.join(repoRoot, "docs", "architecture-definitions");
const args = process.argv.slice(2);

const slugFilter = readOption("--slug");
const skipIndex = args.includes("--skip-index");
const usage = `Usage:
  node scripts/update-architecture-definitions.mjs
  node scripts/update-architecture-definitions.mjs --slug local-daemon-bff
  node scripts/update-architecture-definitions.mjs --skip-index

What it does:
  - re-export draw.io files to SVG via the official draw.io desktop path
  - regenerate docs/architecture-definitions/INDEX.md`;

if (args.includes("--help") || args.includes("-h")) {
  console.log(usage);
  process.exit(0);
}

const directories = listArchitectureDirectories(docsRoot, slugFilter);
if (directories.length === 0) {
  console.error("更新対象の architecture directory が見つかりませんでした。");
  process.exit(1);
}

const results = [];
for (const directory of directories) {
  const slug = path.basename(directory);
  const drawioPath = path.join(directory, "source", `${slug}.drawio`);
  const svgPath = path.join(directory, `${slug}.svg`);
  if (!fs.existsSync(drawioPath)) {
    results.push({ slug, status: "skipped", reason: "drawio missing" });
    continue;
  }

  const ok = exportSvg(drawioPath, svgPath);
  results.push({ slug, status: ok ? "updated" : "failed", reason: ok ? "" : "draw.io export failed" });
}

if (!skipIndex) {
  const indexPath = path.join(docsRoot, "INDEX.md");
  fs.writeFileSync(indexPath, buildIndexMarkdown(docsRoot), "utf-8");
  console.log(`Updated index: ${path.relative(repoRoot, indexPath)}`);
}

for (const result of results) {
  if (result.status === "updated") {
    console.log(`Updated SVG: docs/architecture-definitions/${result.slug}/${result.slug}.svg`);
    continue;
  }
  console.log(`Skipped ${result.slug}: ${result.reason}`);
}

function readOption(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

function listArchitectureDirectories(rootDir, slug) {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .filter((entry) => entry.name !== "templates")
    .filter((entry) => (slug ? entry.name === slug : true))
    .map((entry) => path.join(rootDir, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function exportSvg(inputDrawioPath, outputSvgPath) {
  const electronPath = path.join(repoRoot, "src", "apps", "desktop", "node_modules", ".bin", "electron");
  const drawioAppPath = path.join(repoRoot, "src", "apps", "desktop", "node_modules", "@hhhtj", "draw.io");
  if (!fs.existsSync(electronPath) || !fs.existsSync(drawioAppPath)) {
    return false;
  }

  const result = spawnSync(
    electronPath,
    [
      drawioAppPath,
      "--export",
      "--format",
      "svg",
      "--output",
      outputSvgPath,
      inputDrawioPath
    ],
    {
      cwd: path.join(repoRoot, "src", "apps", "desktop"),
      encoding: "utf-8"
    }
  );

  return result.status === 0 && fs.existsSync(outputSvgPath);
}

function buildIndexMarkdown(rootDir) {
  const specialDocs = [
    { file: "00_overview.md", title: "Overview" },
    { file: "06_comparison.md", title: "Comparison" },
    { file: "07_recommended-architecture.md", title: "Recommended Architecture" },
    { file: "08_subagent-usage.md", title: "SubAgent Usage" },
    { file: "README.md", title: "README" }
  ];

  const architectureDirs = listArchitectureDirectories(rootDir, null);
  const lines = [
    "# Architecture Definitions Index",
    "",
    `更新日: ${new Date().toISOString().slice(0, 10)}`,
    "",
    "## Top-level Docs",
    ""
  ];

  for (const doc of specialDocs) {
    const filePath = path.join(rootDir, doc.file);
    if (!fs.existsSync(filePath)) continue;
    lines.push(`- [${doc.title}](./${doc.file})`);
  }

  lines.push("");
  lines.push("## Architecture Directories");
  lines.push("");

  for (const directory of architectureDirs) {
    const slug = path.basename(directory);
    const markdownPath = path.join(directory, `${slug}.md`);
    const svgPath = path.join(directory, `${slug}.svg`);
    const promptPath = path.join(directory, `${slug}_subagent-prompt.md`);

    if (!fs.existsSync(markdownPath)) continue;

    lines.push(`### ${slug}`);
    lines.push("");
    lines.push(`- [Markdown](./${slug}/${slug}.md)`);
    if (fs.existsSync(svgPath)) {
      lines.push(`- [SVG](./${slug}/${slug}.svg)`);
    }
    if (fs.existsSync(promptPath)) {
      lines.push(`- [SubAgent Prompt](./${slug}/${slug}_subagent-prompt.md)`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}
