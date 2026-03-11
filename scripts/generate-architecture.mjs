#!/usr/bin/env node
/**
 * Static analysis of cc-roundtable → draw.io architecture diagram.
 *
 * Usage:  node scripts/generate-architecture.mjs
 * Output: docs/architecture.drawio
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ELECTRON_SRC = path.join(ROOT, "electron", "src");
const HOOKS_DIR = path.join(ROOT, "hooks");
const AGENTS_DIR = path.join(ROOT, ".claude", "meeting-room", "agents");
const SETTINGS_PATH = path.join(ROOT, ".claude", "settings.json");
const OUTPUT = path.join(ROOT, "docs", "architecture.drawio");

// ═══════════════════════════════════════════════════════════════════
//  XML helpers
// ═══════════════════════════════════════════════════════════════════

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let _id = 100;
const nid = (prefix = "c") => `${prefix}${_id++}`;

function cell(id, value, x, y, w, h, style, parent = "1") {
  return (
    `<mxCell id="${id}" value="${esc(value)}" ` +
    `style="${style}" vertex="1" parent="${parent}">` +
    `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>` +
    `</mxCell>`
  );
}

function group(id, value, x, y, w, h, style, parent = "1") {
  return (
    `<mxCell id="${id}" value="${esc(value)}" ` +
    `style="${style}" vertex="1" connectable="0" parent="${parent}">` +
    `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>` +
    `</mxCell>`
  );
}

function arrow(id, src, tgt, label = "", style = "", parent = "1") {
  const v = label ? ` value="${esc(label)}"` : "";
  return (
    `<mxCell id="${id}"${v} ` +
    `style="${style}" edge="1" source="${src}" target="${tgt}" parent="${parent}">` +
    `<mxGeometry relative="1" as="geometry"/>` +
    `</mxCell>`
  );
}

function page(name, pageId, cells) {
  const pad = "        ";
  return [
    `<diagram name="${esc(name)}" id="${pageId}">`,
    `    <mxGraphModel dx="1422" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1400" pageHeight="900" math="0" shadow="0">`,
    `      <root>`,
    `        <mxCell id="0"/>`,
    `        <mxCell id="1" parent="0"/>`,
    ...cells.map((c) => pad + c),
    `      </root>`,
    `    </mxGraphModel>`,
    `  </diagram>`
  ].join("\n");
}

function drawioFile(pages) {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<mxfile host="generate-architecture.mjs" modified="${new Date().toISOString()}" type="device">`,
    `  ${pages.join("\n  ")}`,
    `</mxfile>`
  ].join("\n");
}

// ═══════════════════════════════════════════════════════════════════
//  Styles
// ═══════════════════════════════════════════════════════════════════

const S = {
  external:
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1;fontSize=13;",
  hook: "rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=12;",
  mainMod: "rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontSize=12;",
  renderer: "rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;fontSize=12;",
  shared: "rounded=1;whiteSpace=wrap;html=1;fillColor=#fce5cd;strokeColor=#d79b00;fontSize=12;",
  fsBox:
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;fontStyle=2;fontSize=12;",
  container:
    "rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#4D4D4D;dashed=1;fontSize=14;fontStyle=1;verticalAlign=top;spacingTop=8;",
  subContainer:
    "rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#999;dashed=1;fontSize=13;fontStyle=1;verticalAlign=top;spacingTop=8;",
  title:
    "text;html=1;align=center;verticalAlign=middle;resizable=0;points=[];autosize=1;strokeColor=none;fillColor=none;fontSize=20;fontStyle=1;",
  subtitle:
    "text;html=1;align=left;verticalAlign=middle;resizable=0;points=[];autosize=1;strokeColor=none;fillColor=none;fontSize=11;fontColor=#888;",
  colHeader:
    "text;html=1;align=center;verticalAlign=middle;resizable=0;points=[];autosize=1;strokeColor=none;fillColor=none;fontSize=13;fontStyle=5;fontColor=#555;",
  arr: "rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;",
  arrDash: "rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=1;dashed=1;",
  arrWs: "rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;strokeColor=#d6b656;",
  arrIpc: "rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;strokeColor=#82b366;",
  arrBold: "rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=3;strokeColor=#6c8ebf;",
  ipcBox:
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#E6F7FF;strokeColor=#1890FF;fontSize=11;fontFamily=monospace;",
  ipcDir:
    "text;html=1;align=center;verticalAlign=middle;resizable=0;points=[];autosize=1;strokeColor=none;fillColor=none;fontSize=11;fontColor=#1890FF;fontStyle=3;",
  flowStep: "rounded=1;whiteSpace=wrap;html=1;fontSize=11;",
  leader:
    "shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;fillColor=#08519c;fontColor=#ffffff;strokeColor=#08519c;fontSize=13;fontStyle=1;size=0.1;",
  agent:
    "ellipse;whiteSpace=wrap;html=1;fillColor=#6baed6;strokeColor=#3182bd;fontSize=12;fontStyle=1;",
  agentDesc:
    "text;html=1;align=center;verticalAlign=top;resizable=0;points=[];autosize=1;strokeColor=none;fillColor=none;fontSize=9;fontColor=#666;",
  human:
    "shape=mxgraph.basic.smiley;whiteSpace=wrap;html=1;fillColor=#f0ad4e;strokeColor=#d68910;fontSize=12;fontStyle=1;dx=0.15;",
  humanBox:
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#fdebd0;strokeColor=#d68910;fontSize=12;fontStyle=1;",
  broadcast:
    "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;strokeColor=#3182bd;startArrow=none;endArrow=classic;dashed=1;dashPattern=8 4;",
  hookIntercept:
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=11;fontStyle=2;",
  lifecycle:
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#deebf7;strokeColor=#3182bd;fontSize=12;fontStyle=1;",
  lifecycleActive:
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontSize=12;fontStyle=1;",
  lifecycleEnd:
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontSize=12;fontStyle=1;",
  flagFile:
    "shape=document;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666;fontSize=11;fontStyle=2;boundedLbl=1;size=0.15;",
  envVar:
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#e8eaf6;strokeColor=#5c6bc0;fontSize=10;fontFamily=monospace;",
  arrFlow:
    "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;strokeColor=#3182bd;",
  arrLifecycle:
    "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=3;strokeColor=#2196F3;"
};

// ═══════════════════════════════════════════════════════════════════
//  Static analysis
// ═══════════════════════════════════════════════════════════════════

function walk(dir, exts = [".ts", ".tsx", ".py"]) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, exts));
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

function extractImports(src) {
  const re = /import\s+(?:type\s+)?(?:\{[^}]*\}|[^{;]+)\s+from\s+["']([^"']+)["']/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

function extractClasses(src) {
  const re = /export\s+(?:default\s+)?class\s+(\w+)/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

function extractFunctions(src) {
  const re = /export\s+(?:default\s+)?function\s+(\w+)/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

function extractInterfaces(src) {
  const re = /export\s+(?:type|interface)\s+(\w+)/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

function extractIpcHandles(src) {
  const re = /ipcMain\.handle\(\s*["']([^"']+)["']/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) out.push({ ch: m[1], dir: "renderer→main" });
  return out;
}

function extractIpcSends(src) {
  const re = /webContents\.send\(\s*["']([^"']+)["']/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) out.push({ ch: m[1], dir: "main→renderer" });
  return out;
}

function extractPreloadChannels(src) {
  const out = [];
  let m;
  const reInvoke = /ipcRenderer\.invoke\(\s*["']([^"']+)["']/g;
  while ((m = reInvoke.exec(src))) out.push({ ch: m[1], dir: "renderer→main", method: "invoke" });
  const reOn = /ipcRenderer\.on\(\s*["']([^"']+)["']/g;
  while ((m = reOn.exec(src))) out.push({ ch: m[1], dir: "main→renderer", method: "on" });
  return out;
}

function analyze() {
  const files = [];
  const ipcChannels = [];
  const hooks = [];

  for (const fp of walk(ELECTRON_SRC, [".ts", ".tsx"])) {
    const src = fs.readFileSync(fp, "utf-8");
    const rel = path.relative(ROOT, fp);
    const layer = rel.includes("/main/")
      ? "main"
      : rel.includes("/renderer/")
        ? "renderer"
        : "shared";
    const name = path.basename(fp, path.extname(fp));

    files.push({
      rel,
      name,
      layer,
      sublayer: rel.includes("/screens/")
        ? "screen"
        : rel.includes("/components/")
          ? "component"
          : "root",
      imports: extractImports(src),
      classes: extractClasses(src),
      functions: extractFunctions(src),
      interfaces: extractInterfaces(src)
    });

    if (layer === "main") {
      ipcChannels.push(...extractIpcHandles(src));
      ipcChannels.push(...extractIpcSends(src));
    }
    if (name === "preload") {
      ipcChannels.push(...extractPreloadChannels(src));
    }
  }

  for (const fp of walk(HOOKS_DIR, [".py"])) {
    const src = fs.readFileSync(fp, "utf-8");
    const name = path.basename(fp);
    hooks.push({
      name,
      rel: path.relative(ROOT, fp),
      type: /PreToolUse/i.test(src) || name.includes("enforce") ? "PreToolUse" : "PostToolUse",
      usesWs: /websocket|WS_|ws_/i.test(src)
    });
  }

  const seen = new Set();
  const uniqueIpc = ipcChannels.filter((c) => {
    const k = `${c.ch}:${c.dir}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Agent profiles from .claude/meeting-room/agents/
  const agents = [];
  if (fs.existsSync(AGENTS_DIR)) {
    for (const entry of fs.readdirSync(AGENTS_DIR, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      try {
        const raw = fs.readFileSync(path.join(AGENTS_DIR, entry.name), "utf-8");
        const parsed = JSON.parse(raw);
        agents.push({
          id: parsed.id || entry.name.replace(".json", ""),
          name: parsed.name || parsed.id || entry.name,
          description: parsed.description || "",
          enabledByDefault: Boolean(parsed.enabledByDefault)
        });
      } catch {
        /* skip malformed */
      }
    }
  }

  // Hook registrations from .claude/settings.json
  const hookRegistrations = { pre: [], post: [] };
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
      for (const reg of settings.hooks?.PreToolUse ?? []) {
        hookRegistrations.pre.push({
          matcher: reg.matcher,
          command: reg.hooks?.[0]?.command || ""
        });
      }
      for (const reg of settings.hooks?.PostToolUse ?? []) {
        hookRegistrations.post.push({
          matcher: reg.matcher,
          command: reg.hooks?.[0]?.command || ""
        });
      }
    } catch {
      /* skip */
    }
  }

  // Extract DEFAULT_AGENT_PROFILES from meeting.ts as fallback
  const meetingTs = files.find((f) => f.name === "meeting" && f.layer === "main");
  const defaultProfiles = [];
  if (meetingTs) {
    const src = fs.readFileSync(path.join(ROOT, meetingTs.rel), "utf-8");
    const re = /id:\s*"([^"]+)",\s*\n\s*name:\s*"([^"]+)",\s*\n\s*description:\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(src))) {
      defaultProfiles.push({ id: m[1], name: m[2], description: m[3] });
    }
  }

  return { files, ipcChannels: uniqueIpc, hooks, agents, hookRegistrations, defaultProfiles };
}

// ═══════════════════════════════════════════════════════════════════
//  Page 1 – System Overview
// ═══════════════════════════════════════════════════════════════════

function pageOverview(a) {
  _id = 100;
  const c = [];

  c.push(cell(nid(), "cc-roundtable  System Architecture", 310, 10, 420, 35, S.title));
  c.push(
    cell(
      nid(),
      `Generated ${new Date().toISOString().slice(0, 10)} by generate-architecture.mjs`,
      340,
      42,
      360,
      20,
      S.subtitle
    )
  );

  // ── Layer 1: External ──
  const claude = nid();
  c.push(
    cell(claude, "<b>Claude Code</b><br/>(Agent Teams + SubAgents)", 80, 80, 300, 80, S.external)
  );

  const fsId = nid();
  c.push(
    cell(
      fsId,
      "<b>File System</b><br/>.claude/meeting-room/<br/>(.active │ agents/ │ summaries/)",
      880,
      80,
      320,
      80,
      S.fsBox
    )
  );

  // ── Layer 2: Python Hooks ──
  const hookGrp = nid();
  c.push(group(hookGrp, "Python Hook Layer", 80, 210, 780, 110, S.subContainer));

  const hookIds = {};
  let hx = 20;
  for (const h of a.hooks) {
    const hid = nid();
    c.push(cell(hid, `<b>${h.name}</b><br/>(${h.type})`, hx, 35, 240, 55, S.hook, hookGrp));
    hookIds[h.name] = hid;
    hx += 260;
  }

  // ── Layer 3: Electron App ──
  const elGrp = nid();
  c.push(
    group(elGrp, "Electron Desktop App (meeting-room-electron)", 80, 380, 1120, 470, S.container)
  );

  // Main Process
  const mainGrp = nid();
  c.push(
    group(mainGrp, "Main Process (Node.js + esbuild)", 20, 40, 500, 410, S.subContainer, elGrp)
  );

  const mainMods = {};
  const mainFiles = a.files.filter((f) => f.layer === "main");
  let my = 40;
  for (const f of mainFiles) {
    const mid = nid();
    const extra = f.classes.length ? `<br/><i>${f.classes.join(", ")}</i>` : "";
    c.push(cell(mid, `<b>${f.name}.ts</b>${extra}`, 20, my, 220, 55, S.mainMod, mainGrp));
    mainMods[f.name] = mid;
    my += 72;
  }

  // Shared
  const sharedFiles = a.files.filter((f) => f.layer === "shared");
  const sy = 40 + 72 * mainFiles.length + 10;
  for (const f of sharedFiles) {
    const sid = nid();
    c.push(
      cell(
        sid,
        `<b>${f.name}.ts</b><br/>(${f.interfaces.length} exported types)`,
        260,
        sy - 72 * (mainFiles.length - 2),
        210,
        55,
        S.shared,
        mainGrp
      )
    );
    mainMods[f.name] = sid;
  }

  // Renderer Process
  const renGrp = nid();
  c.push(
    group(renGrp, "Renderer Process (React 18 + Vite 7)", 560, 40, 540, 410, S.subContainer, elGrp)
  );

  const renMods = {};
  const skipNames = new Set(["main", "global", "global.d"]);
  const screens = a.files.filter(
    (f) =>
      f.layer === "renderer" &&
      (f.sublayer === "root" || f.sublayer === "screen") &&
      !skipNames.has(f.name)
  );
  const comps = a.files.filter((f) => f.layer === "renderer" && f.sublayer === "component");

  let ry = 40;
  for (const f of screens) {
    const rid = nid();
    const extra = f.functions.length ? `<br/><i>${f.functions.join(", ")}</i>` : "";
    c.push(cell(rid, `<b>${f.name}.tsx</b>${extra}`, 20, ry, 240, 55, S.renderer, renGrp));
    renMods[f.name] = rid;
    ry += 72;
  }

  let cy = 40;
  for (const f of comps) {
    const cid = nid();
    c.push(cell(cid, `<b>${f.name}.tsx</b>`, 290, cy, 220, 45, S.renderer, renGrp));
    renMods[f.name] = cid;
    cy += 58;
  }

  // ── Arrows ──

  // Claude → Hooks
  for (const h of a.hooks) {
    const hid = hookIds[h.name];
    if (!hid) continue;
    const label =
      h.type === "PreToolUse"
        ? "SendMessage\n(PreToolUse)"
        : h.name.includes("subagent")
          ? "SubagentStop\n(PostToolUse)"
          : "SendMessage\n(PostToolUse)";
    c.push(arrow(nid(), claude, hid, label, S.arr));
  }

  // Hooks(WS) → RelayServer
  for (const h of a.hooks.filter((h) => h.usesWs)) {
    if (hookIds[h.name] && mainMods["ws-server"]) {
      c.push(arrow(nid(), hookIds[h.name], mainMods["ws-server"], "WebSocket :9999", S.arrWs));
    }
  }

  // FS ← Hooks (.active gate)
  if (hookIds["enforce-broadcast.py"]) {
    c.push(arrow(nid(), fsId, hookIds["enforce-broadcast.py"], ".active check", S.arrDash));
  }

  // Main internal
  for (const dep of ["ws-server", "pty-manager", "meeting"]) {
    if (mainMods["index"] && mainMods[dep]) {
      c.push(arrow(nid(), mainMods["index"], mainMods[dep], "", S.arrDash));
    }
  }

  // PtyManager → Claude
  if (mainMods["pty-manager"]) {
    c.push(arrow(nid(), mainMods["pty-manager"], claude, "node-pty → zsh → claude CLI", S.arrBold));
  }

  // MeetingService → FS
  if (mainMods["meeting"]) {
    c.push(arrow(nid(), mainMods["meeting"], fsId, ".active / agents/ / summaries/", S.arrDash));
  }

  // preload → App (IPC bridge)
  if (mainMods["preload"] && renMods["App"]) {
    c.push(arrow(nid(), mainMods["preload"], renMods["App"], "contextBridge (IPC)", S.arrIpc));
  }

  // App → screens
  for (const scr of ["SetupScreen", "MeetingScreen", "SessionDebugWindow"]) {
    if (renMods["App"] && renMods[scr]) {
      c.push(arrow(nid(), renMods["App"], renMods[scr], "", S.arrDash));
    }
  }

  // MeetingScreen → components
  for (const comp of ["ChatView", "InputBar", "TerminalPane", "ConnectionStatus"]) {
    if (renMods["MeetingScreen"] && renMods[comp]) {
      c.push(arrow(nid(), renMods["MeetingScreen"], renMods[comp], "", S.arrDash));
    }
  }

  return c;
}

// ═══════════════════════════════════════════════════════════════════
//  Page 2 – Module Dependencies
// ═══════════════════════════════════════════════════════════════════

function pageDeps(a) {
  _id = 300;
  const c = [];

  c.push(cell(nid(), "Module Dependency Graph (import analysis)", 330, 10, 400, 30, S.title));

  const cols = [
    {
      key: "main",
      label: "Main Process",
      x: 30,
      style: S.mainMod,
      files: a.files.filter((f) => f.layer === "main")
    },
    {
      key: "shared",
      label: "Shared",
      x: 310,
      style: S.shared,
      files: a.files.filter((f) => f.layer === "shared")
    },
    {
      key: "screen",
      label: "Screens",
      x: 590,
      style: S.renderer,
      files: a.files.filter(
        (f) =>
          f.layer === "renderer" &&
          (f.sublayer === "root" || f.sublayer === "screen") &&
          !["main", "global", "global.d"].includes(f.name)
      )
    },
    {
      key: "component",
      label: "Components",
      x: 870,
      style: S.renderer,
      files: a.files.filter((f) => f.layer === "renderer" && f.sublayer === "component")
    },
    { key: "hook", label: "Hooks (Python)", x: 1150, style: S.hook, files: [] }
  ];

  const nodeById = {};

  for (const col of cols) {
    c.push(cell(nid(), `<b>${col.label}</b>`, col.x, 60, 250, 25, S.colHeader));
    let y = 100;
    for (const f of col.files) {
      const fid = nid();
      const lines = [
        ...f.classes.map((x) => `class ${x}`),
        ...f.functions.map((x) => `fn ${x}`),
        ...f.interfaces.map((x) => `type ${x}`)
      ];
      const trunc = lines.length > 4 ? [...lines.slice(0, 4), `+${lines.length - 4} more`] : lines;
      const detail = trunc.length
        ? `<br/><font style="font-size:9px;color:#666">${trunc.join(", ")}</font>`
        : "";
      const h = trunc.length > 2 ? 70 : trunc.length ? 58 : 48;
      c.push(cell(fid, `<b>${f.name}</b>${detail}`, col.x, y, 250, h, col.style));
      nodeById[f.name] = fid;
      y += h + 18;
    }
  }

  // Hooks column
  let hy = 100;
  for (const h of a.hooks) {
    const hid = nid();
    c.push(cell(hid, `<b>${h.name}</b><br/>(${h.type})`, 1150, hy, 250, 50, S.hook));
    nodeById[h.name] = hid;
    hy += 68;
  }

  // Import arrows
  for (const f of a.files) {
    const src = nodeById[f.name];
    if (!src) continue;
    for (const imp of f.imports) {
      let tgtName = imp;
      if (imp.startsWith("./") || imp.startsWith("../")) {
        tgtName = path.basename(imp);
      } else if (imp.startsWith("@shared/")) {
        tgtName = imp.replace("@shared/", "");
      } else {
        continue;
      }
      const tgt = nodeById[tgtName];
      if (tgt && src !== tgt) {
        c.push(arrow(nid(), src, tgt, "", S.arrDash));
      }
    }
  }

  return c;
}

// ═══════════════════════════════════════════════════════════════════
//  Page 3 – IPC Channel Map
// ═══════════════════════════════════════════════════════════════════

function pageIpc(a) {
  _id = 500;
  const c = [];

  c.push(cell(nid(), "IPC &amp; WebSocket Channel Map", 350, 10, 350, 30, S.title));

  const toMain = a.ipcChannels.filter((x) => x.dir === "renderer→main");
  const toRenderer = a.ipcChannels.filter((x) => x.dir === "main→renderer");

  // Renderer box
  const renBox = nid();
  c.push(
    cell(renBox, "<b>Renderer</b><br/>(preload.ts → ipcRenderer)", 420, 60, 260, 55, S.renderer)
  );

  // Main box
  const mainBox = nid();
  const mainY = 60 + 80 + Math.max(toMain.length, toRenderer.length) * 38 + 40;
  c.push(
    cell(
      mainBox,
      "<b>Main Process</b><br/>(index.ts → ipcMain.handle)",
      420,
      mainY,
      260,
      55,
      S.mainMod
    )
  );

  // Left col: renderer→main (invoke)
  c.push(cell(nid(), "<b>renderer → main</b> (invoke)", 30, 140, 220, 22, S.ipcDir));
  let ly = 170;
  for (const ch of toMain) {
    const cid = nid();
    c.push(cell(cid, ch.ch, 30, ly, 300, 28, S.ipcBox));
    c.push(arrow(nid(), renBox, cid, "", S.arrIpc));
    c.push(arrow(nid(), cid, mainBox, "", S.arrIpc));
    ly += 38;
  }

  // Right col: main→renderer (send / on)
  c.push(cell(nid(), "<b>main → renderer</b> (send)", 770, 140, 220, 22, S.ipcDir));
  let ry2 = 170;
  for (const ch of toRenderer) {
    const cid = nid();
    c.push(cell(cid, ch.ch, 770, ry2, 300, 28, S.ipcBox));
    c.push(arrow(nid(), mainBox, cid, "", S.arrWs));
    c.push(arrow(nid(), cid, renBox, "", S.arrWs));
    ry2 += 38;
  }

  // WebSocket section
  const wsY = mainY + 100;
  c.push(cell(nid(), "<b>WebSocket (port 9999)</b>", 420, wsY, 260, 22, S.colHeader));
  const hookBox = nid();
  c.push(
    cell(
      hookBox,
      "<b>Python Hooks</b><br/>(ws-relay.py, subagent-status-relay.py)",
      80,
      wsY + 35,
      320,
      55,
      S.hook
    )
  );
  const relayBox = nid();
  c.push(cell(relayBox, "<b>RelayServer</b> (ws-server.ts)", 680, wsY + 35, 280, 55, S.mainMod));
  c.push(arrow(nid(), hookBox, relayBox, "WebSocket :9999", S.arrWs));
  c.push(arrow(nid(), relayBox, mainBox, "relayAgentMessage → IPC", S.arrIpc));

  return c;
}

// ═══════════════════════════════════════════════════════════════════
//  Page 4 – Data Flow
// ═══════════════════════════════════════════════════════════════════

function pageDataFlow() {
  _id = 700;
  const c = [];

  c.push(cell(nid(), "Data Flow Diagrams", 400, 10, 280, 30, S.title));

  // ── Flow 1: Agent → Chat UI (left) ──
  c.push(cell(nid(), "<b>Agent Message → Chat UI</b>", 60, 55, 300, 22, S.colHeader));

  const flow1 = [
    { t: "1. Agent calls SendMessage\n(type: broadcast, content: ...)", s: S.external },
    { t: "2. enforce-broadcast.py\nPreToolUse: blocks directed messages", s: S.hook },
    { t: "3. ws-relay.py\nPostToolUse: build JSON, open WebSocket", s: S.hook },
    { t: "4. WebSocket → RelayServer\n(port 9999, parse AgentMessagePayload)", s: S.mainMod },
    { t: "5. MeetingService.relayAgentMessage()\n→ IPC meeting:agent-message", s: S.mainMod },
    { t: "6. App.tsx onRelayMessage\n→ toChatMessage() → state update", s: S.renderer },
    { t: "7. ChatView → MessageBubble\nMarkdown rendering + beep()", s: S.renderer }
  ];
  let y1 = 90;
  let prev1 = null;
  for (const step of flow1) {
    const sid = nid();
    c.push(cell(sid, step.t, 40, y1, 340, 55, step.s));
    if (prev1) c.push(arrow(nid(), prev1, sid, "", S.arr));
    prev1 = sid;
    y1 += 78;
  }

  // ── Flow 2: Human → Agents (right) ──
  c.push(cell(nid(), "<b>Human Message → Agents</b>", 560, 55, 300, 22, S.colHeader));

  const flow2 = [
    { t: "1. User types in InputBar\npress Enter → handleSend()", s: S.renderer },
    { t: "2. Optimistic UI update\nstatus: pending → ChatView", s: S.renderer },
    { t: "3. IPC meeting:human-message\n(meetingId, message)", s: S.shared },
    { t: "4. MeetingService.sendHumanMessage()\n→ PtyManager.write()", s: S.mainMod },
    { t: '5. PTY writes to Claude CLI\n"チームに broadcast してください:\\n{msg}"', s: S.mainMod },
    { t: "6. Claude Leader processes\n→ broadcasts to team via SendMessage", s: S.external },
    { t: "7. Agent reply arrives via WebSocket\npending → confirmed", s: S.renderer }
  ];
  let y2 = 90;
  let prev2 = null;
  for (const step of flow2) {
    const sid = nid();
    c.push(cell(sid, step.t, 540, y2, 340, 55, step.s));
    if (prev2) c.push(arrow(nid(), prev2, sid, "", S.arr));
    prev2 = sid;
    y2 += 78;
  }

  // Legend
  const legY = Math.max(y1, y2) + 20;
  c.push(cell(nid(), "<b>Legend</b>", 40, legY, 80, 22, S.colHeader));
  c.push(cell(nid(), "External (Claude Code)", 40, legY + 30, 160, 28, S.external));
  c.push(cell(nid(), "Python Hook", 210, legY + 30, 130, 28, S.hook));
  c.push(cell(nid(), "Main Process", 350, legY + 30, 130, 28, S.mainMod));
  c.push(cell(nid(), "Renderer (React)", 490, legY + 30, 150, 28, S.renderer));
  c.push(cell(nid(), "Shared / IPC", 650, legY + 30, 130, 28, S.shared));

  return c;
}

// ═══════════════════════════════════════════════════════════════════
//  Page 5 – Type Map
// ═══════════════════════════════════════════════════════════════════

function pageTypes(a) {
  _id = 900;
  const c = [];

  c.push(cell(nid(), "Shared Types (shared/types.ts)", 350, 10, 340, 30, S.title));

  const sharedFile = a.files.find((f) => f.name === "types" && f.layer === "shared");
  if (!sharedFile) return c;

  const types = sharedFile.interfaces;
  const cols = 3;
  const colW = 320;
  const rowH = 50;
  const gap = 16;

  for (let i = 0; i < types.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 50 + col * (colW + gap);
    const y = 70 + row * (rowH + gap);
    c.push(cell(nid(), `<b>${types[i]}</b>`, x, y, colW, rowH, S.shared));
  }

  // Show which files use them
  const consumers = a.files.filter((f) =>
    f.imports.some((imp) => imp.includes("@shared/types") || imp.includes("shared/types"))
  );
  const consY = 70 + Math.ceil(types.length / cols) * (rowH + gap) + 30;
  c.push(cell(nid(), "<b>Consumed by:</b>", 50, consY, 150, 22, S.colHeader));

  let cx = 50;
  for (const f of consumers) {
    const style = f.layer === "main" ? S.mainMod : S.renderer;
    c.push(cell(nid(), `${f.name}.ts`, cx, consY + 30, 180, 35, style));
    cx += 200;
    if (cx > 1100) {
      cx = 50;
    }
  }

  return c;
}

// ═══════════════════════════════════════════════════════════════════
//  Page 6 – Agent Teams Architecture
// ═══════════════════════════════════════════════════════════════════

function pageAgentTeams(a) {
  _id = 1000;
  const c = [];

  c.push(cell(nid(), "Agent Teams &amp; SubAgent Architecture", 280, 10, 480, 35, S.title));
  c.push(
    cell(
      nid(),
      `${a.agents.length} registered agents + human participant`,
      360,
      42,
      320,
      20,
      S.subtitle
    )
  );

  // ── Claude Code Process ──
  const claudeBox = nid();
  c.push(group(claudeBox, "Claude Code Process (PTY)", 40, 80, 1100, 640, S.container));

  // Leader agent
  const leader = nid();
  c.push(cell(leader, "<b>Leader Agent</b><br/>Claude CLI", 420, 40, 240, 70, S.leader, claudeBox));

  // env var
  c.push(
    cell(nid(), "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1", 100, 48, 300, 24, S.envVar, claudeBox)
  );

  // Skill invocation
  const skillBox = nid();
  c.push(
    cell(
      skillBox,
      '<b>Skill Invocation</b><br/>"/{skill-name} {topic}"<br/>→ Leader spawns SubAgents',
      380,
      130,
      320,
      60,
      S.lifecycle,
      claudeBox
    )
  );
  c.push(arrow(nid(), leader, skillBox, "initial prompt", S.arrFlow, claudeBox));

  // SubAgents ring
  const agentIds = {};
  const profiles = a.agents.length > 0 ? a.agents : a.defaultProfiles;
  const count = profiles.length;
  const centerX = 540;
  const centerY = 340;
  const radiusX = 380;
  const radiusY = 160;

  for (let i = 0; i < count; i++) {
    const agent = profiles[i];
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const ax = Math.round(centerX + radiusX * Math.cos(angle)) - 80;
    const ay = Math.round(centerY + radiusY * Math.sin(angle)) - 25;

    const aid = nid();
    c.push(cell(aid, `<b>${agent.name}</b>`, ax, ay, 170, 50, S.agent, claudeBox));
    agentIds[agent.id] = aid;

    // Description below
    const descId = nid();
    const desc = agent.description || agent.id;
    c.push(cell(descId, desc, ax - 15, ay + 52, 200, 20, S.agentDesc, claudeBox));

    // Leader → SubAgent spawn
    c.push(arrow(nid(), skillBox, aid, "", S.arrDash, claudeBox));
  }

  // Broadcast arrows between agents (circular)
  const agentIdList = Object.values(agentIds);
  if (agentIdList.length >= 2) {
    for (let i = 0; i < agentIdList.length; i++) {
      const next = (i + 1) % agentIdList.length;
      c.push(arrow(nid(), agentIdList[i], agentIdList[next], "", S.broadcast, claudeBox));
    }
    // Center label
    c.push(
      cell(
        nid(),
        "<b>SendMessage</b><br/>(type: broadcast)<br/>全員に公開",
        centerX - 90,
        centerY - 30,
        180,
        60,
        "text;html=1;align=center;verticalAlign=middle;resizable=0;points=[];autosize=1;strokeColor=none;fillColor=none;fontSize=12;fontColor=#3182bd;fontStyle=1;",
        claudeBox
      )
    );
  }

  // ── Human Participant (outside Claude Code) ──
  const humanBox = nid();
  c.push(
    cell(humanBox, "<b>Human Participant</b><br/>(Meeting Room UI)", 40, 750, 280, 70, S.humanBox)
  );

  // Electron App bridge
  const electronBridge = nid();
  c.push(
    cell(
      electronBridge,
      "<b>Electron App</b><br/>InputBar → PTY.write()",
      400,
      750,
      280,
      70,
      S.mainMod
    )
  );

  c.push(arrow(nid(), humanBox, electronBridge, "message input", S.arr));
  c.push(
    arrow(
      nid(),
      electronBridge,
      leader,
      'pty.write("チームに broadcast してください:\\n{msg}")',
      S.arrBold
    )
  );

  // ── Hook Layer (right side) ──
  const hookLayer = nid();
  c.push(group(hookLayer, "Hook Intercept Layer", 760, 750, 380, 160, S.subContainer));

  // Pre hook
  const preHook = nid();
  c.push(
    cell(
      preHook,
      "<b>PreToolUse</b><br/>enforce-broadcast.py<br/>⛔ blocks directed msgs",
      20,
      35,
      160,
      65,
      S.hookIntercept,
      hookLayer
    )
  );

  // Post hooks
  const postHook1 = nid();
  c.push(
    cell(
      postHook1,
      "<b>PostToolUse</b><br/>ws-relay.py<br/>📡 → WebSocket",
      200,
      35,
      160,
      65,
      S.hookIntercept,
      hookLayer
    )
  );

  const postHook2 = nid();
  c.push(
    cell(
      postHook2,
      "<b>PostToolUse</b><br/>subagent-status-relay.py<br/>📊 agent completed",
      110,
      108,
      170,
      45,
      S.hookIntercept,
      hookLayer
    )
  );

  // Arrows: Hooks → Electron
  c.push(arrow(nid(), postHook1, electronBridge, "WebSocket :9999\n→ ChatView", S.arrWs));

  // .active flag
  const flagBox = nid();
  c.push(cell(flagBox, ".claude/meeting-room/<br/><b>.active</b>", 760, 920, 180, 50, S.flagFile));
  c.push(arrow(nid(), flagBox, preHook, "gate", S.arrDash));
  c.push(arrow(nid(), flagBox, postHook1, "gate", S.arrDash));

  // ── Hook Registration Info ──
  const regY = 920;
  c.push(cell(nid(), "<b>.claude/settings.json</b>", 40, regY, 200, 22, S.colHeader));
  let ry = regY + 30;
  for (const r of a.hookRegistrations.pre) {
    c.push(
      cell(
        nid(),
        `Pre: ${r.matcher} → ${path.basename(r.command.split('"').find((s) => s.endsWith(".py")) || "")}`,
        40,
        ry,
        380,
        24,
        S.envVar
      )
    );
    ry += 30;
  }
  for (const r of a.hookRegistrations.post) {
    c.push(
      cell(
        nid(),
        `Post: ${r.matcher} → ${path.basename(r.command.split('"').find((s) => s.endsWith(".py")) || "")}`,
        40,
        ry,
        380,
        24,
        S.envVar
      )
    );
    ry += 30;
  }

  // Legend
  const legY = Math.max(ry, 980) + 20;
  c.push(cell(nid(), "<b>Legend</b>", 40, legY, 80, 22, S.colHeader));
  c.push(cell(nid(), "Leader", 40, legY + 28, 100, 32, S.leader));
  c.push(cell(nid(), "SubAgent", 160, legY + 28, 100, 40, S.agent));
  c.push(cell(nid(), "Human", 280, legY + 28, 120, 32, S.humanBox));
  c.push(cell(nid(), "Hook", 420, legY + 28, 100, 32, S.hookIntercept));
  c.push(cell(nid(), ".active gate", 540, legY + 28, 120, 32, S.flagFile));
  c.push(
    cell(
      nid(),
      "broadcast",
      680,
      legY + 28,
      120,
      20,
      "text;html=1;align=center;verticalAlign=middle;strokeColor=none;fillColor=none;fontSize=10;fontColor=#3182bd;fontStyle=3;"
    )
  );

  return c;
}

// ═══════════════════════════════════════════════════════════════════
//  Page 7 – Meeting Lifecycle
// ═══════════════════════════════════════════════════════════════════

function pageMeetingLifecycle(a) {
  _id = 1200;
  const c = [];

  c.push(cell(nid(), "Meeting Lifecycle &amp; State Machine", 320, 10, 420, 35, S.title));

  // ── Timeline ──
  const phases = [
    {
      label: "<b>1. Setup</b>",
      detail: "SetupScreen で設定\n• スキル選択\n• 議題入力\n• プロジェクトDir\n• メンバー選択",
      style: S.lifecycle,
      h: 120
    },
    {
      label: "<b>2. Start Meeting</b>",
      detail:
        "MeetingService.startMeeting()\n• .active flag 作成\n• PTY 起動 (zsh)\n• claude CLI 実行\n• 初期プロンプト送信\n  (/{skill} {topic})",
      style: S.lifecycleActive,
      h: 140
    },
    {
      label: "<b>3. Running</b>",
      detail:
        "会議進行中\n• Agent 間 broadcast\n• Human → InputBar → PTY\n• Hook → WS → ChatView\n• SubagentStop → status",
      style: S.lifecycleActive,
      h: 120
    },
    {
      label: "<b>4. Control</b>",
      detail:
        "会議中操作\n• pause: 要点まとめ\n• resume: 再開\n• settings: 設定変更\n• retryMcp: MCP 復旧",
      style: S.lifecycle,
      h: 120
    },
    {
      label: "<b>5. End Meeting</b>",
      detail:
        "MeetingService.endMeeting()\n• サマリー保存(.md)\n• PTY kill\n• .active flag 削除\n• タブ削除",
      style: S.lifecycleEnd,
      h: 120
    }
  ];

  const phaseIds = [];
  let px = 40;
  for (const phase of phases) {
    const pid = nid();
    c.push(
      cell(
        pid,
        `${phase.label}<br/><font style="font-size:10px">${phase.detail.replace(/\n/g, "<br/>")}</font>`,
        px,
        80,
        240,
        phase.h,
        phase.style
      )
    );
    phaseIds.push(pid);
    px += 260;
  }

  // Phase arrows
  for (let i = 0; i < phaseIds.length - 1; i++) {
    c.push(arrow(nid(), phaseIds[i], phaseIds[i + 1], "", S.arrLifecycle));
  }
  // Loop: Control → Running
  c.push(
    arrow(nid(), phaseIds[3], phaseIds[2], "resume", S.arrDash + "strokeColor=#82b366;curved=1;")
  );

  // ── State detail: MeetingTab.status ──
  const stateY = 290;
  c.push(cell(nid(), "<b>MeetingTab.status State Machine</b>", 40, stateY, 300, 25, S.colHeader));

  const states = [
    { label: '"running"', x: 120, y: stateY + 40, style: S.lifecycleActive },
    { label: '"paused"', x: 420, y: stateY + 40, style: S.lifecycle },
    { label: '"ended"', x: 720, y: stateY + 40, style: S.lifecycleEnd }
  ];
  const stateIds = [];
  for (const st of states) {
    const sid = nid();
    c.push(cell(sid, `<b>${st.label}</b>`, st.x, st.y, 180, 45, st.style));
    stateIds.push(sid);
  }
  c.push(arrow(nid(), stateIds[0], stateIds[1], "pause", S.arrLifecycle));
  c.push(arrow(nid(), stateIds[1], stateIds[0], "resume", S.arrLifecycle));
  c.push(arrow(nid(), stateIds[0], stateIds[2], "end", S.arrLifecycle));

  // ── Data stores ──
  const dsY = stateY + 130;
  c.push(cell(nid(), "<b>Data Stores &amp; Persistence</b>", 40, dsY, 300, 25, S.colHeader));

  const stores = [
    {
      label: "<b>localStorage</b><br/>meeting-room:sessions<br/>(SessionSnapshot[])",
      style: S.renderer
    },
    { label: "<b>.claude/meeting-room/</b><br/>agents/*.json<br/>(AgentProfile)", style: S.fsBox },
    { label: "<b>.claude/meeting-room/</b><br/>summaries/*.md<br/>(会議サマリー)", style: S.fsBox },
    { label: "<b>.claude/meeting-room/</b><br/>.active<br/>(Hook gate flag)", style: S.flagFile },
    {
      label: "<b>In-Memory</b><br/>MeetingService.tabs<br/>Map&lt;string, MeetingTab&gt;",
      style: S.mainMod
    }
  ];

  let sx = 40;
  for (const store of stores) {
    c.push(cell(nid(), store.label, sx, dsY + 35, 220, 70, store.style));
    sx += 240;
  }

  // ── Agent Profile Structure ──
  const apY = dsY + 145;
  c.push(cell(nid(), "<b>Registered Agent Profiles</b>", 40, apY, 280, 25, S.colHeader));

  const profDisplay = a.agents.length > 0 ? a.agents : a.defaultProfiles;
  let ax = 40;
  let apRow = 0;
  for (const agent of profDisplay) {
    if (ax > 900) {
      ax = 40;
      apRow++;
    }
    const aid = nid();
    const lbl = `<b>${agent.name}</b><br/><font style="font-size:9px">${agent.id}</font><br/><font style="font-size:9px;color:#666">${agent.description}</font>`;
    c.push(cell(aid, lbl, ax, apY + 35 + apRow * 85, 220, 75, S.agent));
    ax += 240;
  }

  // ── Initial Prompt Template ──
  const ipY = apY + 35 + (apRow + 1) * 85 + 20;
  c.push(
    cell(
      nid(),
      "<b>Initial Prompt Template</b> (MeetingService.buildInitPrompt)",
      40,
      ipY,
      450,
      25,
      S.colHeader
    )
  );

  const promptLines = [
    "/{skill}",
    "以下の議題で会議を開始してください。",
    "議題: {topic}",
    "参加メンバー（ロール）:",
    "- {id} ({name}): {description}",
    "進め方: 1.議題再定義 2.論点整理 3.具体案 4.結論"
  ];
  c.push(
    cell(
      nid(),
      promptLines
        .map((l) => `<font style="font-family:monospace;font-size:10px">${l}</font>`)
        .join("<br/>"),
      40,
      ipY + 35,
      520,
      100,
      "rounded=1;whiteSpace=wrap;html=1;fillColor=#f9f9f9;strokeColor=#ccc;fontSize=10;align=left;spacingLeft=10;spacingTop=5;"
    )
  );

  return c;
}

// ═══════════════════════════════════════════════════════════════════
//  Main
// ═══════════════════════════════════════════════════════════════════

function main() {
  const a = analyze();

  console.log("📊 Static analysis results:");
  console.log(`   Files:        ${a.files.length}`);
  console.log(`   IPC channels: ${a.ipcChannels.length}`);
  console.log(
    `   Hooks:        ${a.hooks.length} (Pre: ${a.hookRegistrations.pre.length}, Post: ${a.hookRegistrations.post.length})`
  );
  console.log(
    `   Agents:       ${a.agents.length} profiles (${a.defaultProfiles.length} defaults in code)`
  );
  console.log(
    `   Types:        ${a.files.filter((f) => f.layer === "shared").flatMap((f) => f.interfaces).length}`
  );

  const pages = [
    page("System Overview", "page-overview", pageOverview(a)),
    page("Agent Teams", "page-agents", pageAgentTeams(a)),
    page("Meeting Lifecycle", "page-lifecycle", pageMeetingLifecycle(a)),
    page("Module Dependencies", "page-deps", pageDeps(a)),
    page("IPC Channel Map", "page-ipc", pageIpc(a)),
    page("Data Flow", "page-flow", pageDataFlow()),
    page("Shared Types", "page-types", pageTypes(a))
  ];

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, drawioFile(pages), "utf-8");
  console.log(`\n✅ Generated: ${path.relative(ROOT, OUTPUT)}`);
  console.log(`   Pages: ${pages.length}`);
  console.log(`   Open with draw.io / diagrams.net / VS Code draw.io extension`);
}

main();
