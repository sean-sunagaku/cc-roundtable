#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const args = process.argv.slice(2);

const usage = `Usage:
  node scripts/scaffold-architecture-definition.mjs <slug> "<title>" [architecture-kind]

Examples:
  node scripts/scaffold-architecture-definition.mjs current-daemon "Current Daemon Architecture" local-daemon-bff
  node scripts/scaffold-architecture-definition.mjs queue-option "Queue Supervisor Option" job-queue-supervisor

Architecture kinds:
  electron-main-monolith
  local-daemon-bff
  event-sourced-state-machine
  hexagonal-plugin-architecture
  job-queue-supervisor`;

if (args.includes("--help") || args.includes("-h")) {
  console.log(usage);
  process.exit(0);
}

const [slugArg, titleArg, kindArg = "local-daemon-bff"] = args;
if (!slugArg || !titleArg) {
  console.error(usage);
  process.exit(1);
}

const slug = normalizeSlug(slugArg);
const title = titleArg.trim();
const kind = normalizeSlug(kindArg);
const createdAt = new Date().toISOString().slice(0, 10);

const templateRoot = path.join(repoRoot, "docs", "architecture-definitions", "templates");
const outputDir = path.join(repoRoot, "docs", "architecture-definitions", slug);
const sourceDir = path.join(outputDir, "source");
const markdownPath = path.join(outputDir, `${slug}.md`);
const svgPath = path.join(outputDir, `${slug}.svg`);
const drawioPath = path.join(sourceDir, `${slug}.drawio`);
const promptPath = path.join(outputDir, `${slug}_subagent-prompt.md`);

const markdownTemplatePath = path.join(templateRoot, "architecture-template.md");
const drawioTemplatePath = path.join(templateRoot, "source", "architecture-template.drawio");
const promptTemplatePath = path.join(templateRoot, "subagents", `${kind}.md`);

if (!fs.existsSync(markdownTemplatePath) || !fs.existsSync(drawioTemplatePath)) {
  console.error("テンプレートが見つかりません。docs/architecture-definitions/templates を確認してください。");
  process.exit(1);
}

if (fs.existsSync(outputDir)) {
  console.error(`出力先がすでに存在します: ${path.relative(repoRoot, outputDir)}`);
  process.exit(1);
}

fs.mkdirSync(sourceDir, { recursive: true });

const replacements = {
  "__ARCH_SLUG__": slug,
  "__ARCH_TITLE__": title,
  "__ARCH_KIND__": kind,
  "__CREATED_AT__": createdAt,
};

writeFromTemplate(markdownTemplatePath, markdownPath, replacements);
writeFromTemplate(drawioTemplatePath, drawioPath, replacements);

if (fs.existsSync(promptTemplatePath)) {
  writeFromTemplate(promptTemplatePath, promptPath, replacements);
} else {
  fs.writeFileSync(
    promptPath,
    [
      `# ${title} Subagent Prompt`,
      "",
      "- この案の責務分割、主要データフロー、リスク、採用判断を整理する。",
      `- 出力対象は \`docs/architecture-definitions/${slug}/${slug}.md\` と \`docs/architecture-definitions/${slug}/${slug}.svg\`。`,
      "- 図の元データは source 配下の draw.io を編集し、SVG は公式 export で更新する。"
    ].join("\n"),
    "utf-8"
  );
}

const svgExported = exportSvg(drawioPath, svgPath);
if (!svgExported) {
  fs.writeFileSync(
    svgPath,
    [
      `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240" viewBox="0 0 1200 240">`,
      `  <rect width="1200" height="240" fill="#f8fafc" />`,
      `  <rect x="40" y="40" width="1120" height="160" rx="20" fill="#ffffff" stroke="#94a3b8" stroke-width="2" />`,
      `  <text x="80" y="96" fill="#0f172a" font-size="28" font-family="Helvetica, Arial, sans-serif">${escapeXml(title)}</text>`,
      `  <text x="80" y="136" fill="#475569" font-size="18" font-family="Helvetica, Arial, sans-serif">draw.io export is pending. Open the source file and re-run the export command.</text>`,
      `  <text x="80" y="172" fill="#64748b" font-size="16" font-family="Helvetica, Arial, sans-serif">${escapeXml(path.relative(repoRoot, drawioPath))}</text>`,
      `</svg>`,
      ""
    ].join("\n"),
    "utf-8"
  );
}

console.log(`Created: ${path.relative(repoRoot, outputDir)}`);
console.log(`- ${path.relative(repoRoot, markdownPath)}`);
console.log(`- ${path.relative(repoRoot, svgPath)}`);
console.log(`- ${path.relative(repoRoot, drawioPath)}`);
console.log(`- ${path.relative(repoRoot, promptPath)}`);
if (!svgExported) {
  console.log("SVG はプレースホルダーです。draw.io desktop export が利用可能な環境で再生成してください。");
}

function normalizeSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function writeFromTemplate(templatePath, outputPath, replacementsMap) {
  let content = fs.readFileSync(templatePath, "utf-8");
  for (const [needle, value] of Object.entries(replacementsMap)) {
    content = content.split(needle).join(value);
  }
  fs.writeFileSync(outputPath, content, "utf-8");
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

  if (result.status !== 0) {
    if (result.stderr?.trim()) {
      console.warn(result.stderr.trim());
    }
    return false;
  }
  return fs.existsSync(outputSvgPath);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
