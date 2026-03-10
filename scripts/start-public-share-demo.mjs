#!/usr/bin/env node

import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const rawArgs = process.argv.slice(2);

if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
  printHelp();
  process.exit(0);
}

const options = parseOptions(rawArgs);
const watch = Boolean(options.watch);
const useNgrok = Boolean(options.ngrok);
const daemonPort = options.daemonPort ?? process.env.MEETING_ROOM_DAEMON_PORT ?? "4417";
const gatewayPort = options.gatewayPort ?? process.env.MEETING_ROOM_PUBLIC_GATEWAY_PORT ?? "4427";
const wsPort = options.wsPort ?? process.env.MEETING_ROOM_WS_PORT ?? "9999";
const shareId = options.shareId ?? process.env.MEETING_ROOM_PUBLIC_SHARE_ID ?? "demo-share";
const topic = options.topic ?? process.env.MEETING_ROOM_PUBLIC_DEMO_TOPIC ?? "Public Share Demo";
const projectDir = normalizeProjectDir(
  options.projectDir ?? process.env.MEETING_ROOM_PUBLIC_DEMO_PROJECT_DIR ?? rootDir
);
const members = normalizeMembers(
  options.members ?? process.env.MEETING_ROOM_PUBLIC_DEMO_MEMBERS ?? "product-manager,tech-lead"
);
const bypassMode = normalizeBypassMode(
  options.bypassMode ?? process.env.MEETING_ROOM_PUBLIC_DEMO_BYPASS_MODE ?? "1"
);
const daemonToken = process.env.MEETING_ROOM_DAEMON_TOKEN?.trim() || crypto.randomBytes(16).toString("hex");
const ngrokApiUrl = process.env.NGROK_API_URL?.trim() || "http://127.0.0.1:4040/api/tunnels";

let daemonProcess = null;
let ngrokProcess = null;
let shuttingDown = false;

function printHelp() {
  console.log(`Usage:
  node scripts/start-public-share-demo.mjs
  node scripts/start-public-share-demo.mjs --ngrok
  node scripts/start-public-share-demo.mjs --watch --ngrok

Options:
  --watch                 daemon を watch build 付きで起動
  --ngrok                 public share gateway を ngrok で公開
  --share-id <id>         公開 URL の shareId (default: demo-share)
  --topic <text>          固定会議の議題
  --project-dir <path>    固定会議で使う projectDir
  --members <csv>         参加 Agent の csv (default: product-manager,tech-lead)
  --daemon-port <port>    internal daemon port (default: 4417)
  --gateway-port <port>   public share gateway port (default: 4427)
  --ws-port <port>        daemon websocket port (default: 9999)
  --bypass-mode <bool>    1/0/true/false/yes/no/on/off (default: 1)
  --help                  このヘルプを表示

Env fallback:
  MEETING_ROOM_DAEMON_TOKEN
  MEETING_ROOM_PUBLIC_SHARE_ID
  MEETING_ROOM_PUBLIC_DEMO_PROJECT_DIR
  MEETING_ROOM_PUBLIC_DEMO_TOPIC
  MEETING_ROOM_PUBLIC_DEMO_MEMBERS
  MEETING_ROOM_PUBLIC_DEMO_BYPASS_MODE
  NGROK_API_URL
`);
}

function log(message) {
  console.log(`[public-share-demo] ${message}`);
}

function parseOptions(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--watch":
        parsed.watch = true;
        break;
      case "--ngrok":
        parsed.ngrok = true;
        break;
      case "--share-id":
        parsed.shareId = requireValue(args, ++index, arg);
        break;
      case "--topic":
        parsed.topic = requireValue(args, ++index, arg);
        break;
      case "--project-dir":
        parsed.projectDir = requireValue(args, ++index, arg);
        break;
      case "--members":
        parsed.members = requireValue(args, ++index, arg);
        break;
      case "--daemon-port":
        parsed.daemonPort = requireValue(args, ++index, arg);
        break;
      case "--gateway-port":
        parsed.gatewayPort = requireValue(args, ++index, arg);
        break;
      case "--ws-port":
        parsed.wsPort = requireValue(args, ++index, arg);
        break;
      case "--bypass-mode":
        parsed.bypassMode = requireValue(args, ++index, arg);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  return parsed;
}

function requireValue(args, index, flag) {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function normalizeBypassMode(value) {
  const normalized = String(value).trim();
  if (/^(1|true|yes|on)$/i.test(normalized)) {
    return "1";
  }
  if (/^(0|false|no|off)$/i.test(normalized)) {
    return "0";
  }
  throw new Error("--bypass-mode must be one of true/false/1/0/yes/no/on/off.");
}

function normalizeProjectDir(value) {
  const resolved = path.resolve(value);
  if (!fs.existsSync(resolved)) {
    throw new Error(`--project-dir does not exist: ${resolved}`);
  }
  return resolved;
}

function normalizeMembers(value) {
  const list = String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (list.length === 0) {
    throw new Error("--members must include at least one member id.");
  }
  return list.join(",");
}

function commandExists(name) {
  const result = spawnSync("bash", ["-lc", `command -v ${name}`], {
    cwd: rootDir,
    stdio: "ignore"
  });
  return result.status === 0;
}

async function waitFor(check, description, timeoutMs = 60_000, intervalMs = 750) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await check();
      if (result) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }
  throw new Error(`Timed out while waiting for ${description}${lastError ? `: ${String(lastError)}` : ""}`);
}

function spawnDaemon() {
  const child = spawn(process.execPath, ["scripts/start-daemon.mjs", ...(watch ? ["--watch"] : [])], {
    cwd: rootDir,
    env: {
      ...process.env,
      MEETING_ROOM_DAEMON_PORT: daemonPort,
      MEETING_ROOM_PUBLIC_GATEWAY_PORT: gatewayPort,
      MEETING_ROOM_WS_PORT: wsPort,
      MEETING_ROOM_DAEMON_TOKEN: daemonToken,
      MEETING_ROOM_PUBLIC_SHARE_ID: shareId,
      MEETING_ROOM_PUBLIC_DEMO_PROJECT_DIR: projectDir,
      MEETING_ROOM_PUBLIC_DEMO_TOPIC: topic,
      MEETING_ROOM_PUBLIC_DEMO_MEMBERS: members,
      MEETING_ROOM_PUBLIC_DEMO_BYPASS_MODE: bypassMode
    },
    stdio: "inherit"
  });
  daemonProcess = child;
  child.once("exit", (code, signal) => {
    if (daemonProcess === child) {
      daemonProcess = null;
    }
    if (!shuttingDown) {
      log(`daemon stopped (code=${code ?? "null"}, signal=${signal ?? "null"})`);
      void shutdown(code ?? 0);
    }
  });
}

function spawnNgrok() {
  if (!commandExists("ngrok")) {
    throw new Error("`ngrok` command が見つかりません。先に ngrok をインストールしてください。");
  }
  const child = spawn("ngrok", ["http", gatewayPort, "--log", "stdout", "--log-format", "logfmt", "--log-level", "warn"], {
    cwd: rootDir,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  ngrokProcess = child;
  child.stdout?.on("data", (chunk) => {
    const line = chunk.toString().trim();
    if (line) {
      console.log(`[ngrok] ${line}`);
    }
  });
  child.stderr?.on("data", (chunk) => {
    const line = chunk.toString().trim();
    if (line) {
      console.log(`[ngrok] ${line}`);
    }
  });
  child.once("exit", (code, signal) => {
    if (ngrokProcess === child) {
      ngrokProcess = null;
    }
    if (!shuttingDown) {
      log(`ngrok stopped (code=${code ?? "null"}, signal=${signal ?? "null"})`);
    }
  });
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) {
    return;
  }
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    child.once("exit", finish);
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }, 1500);
    setTimeout(finish, 3000);
  });
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  await Promise.all([stopChild(ngrokProcess), stopChild(daemonProcess)]);
  process.exit(exitCode);
}

process.on("SIGINT", () => {
  void shutdown(0);
});

process.on("SIGTERM", () => {
  void shutdown(0);
});

async function printNgrokUrl() {
  const tunnelUrl = await waitFor(async () => {
    const response = await fetch(ngrokApiUrl);
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    const tunnel = Array.isArray(payload?.tunnels)
      ? payload.tunnels.find((entry) => String(entry?.config?.addr).includes(String(gatewayPort)))
      : null;
    return tunnel?.public_url || null;
  }, "ngrok tunnel url");

  log(`ngrok public URL: ${tunnelUrl}`);
  log(`share URL: ${tunnelUrl}/share/${shareId}`);
}

async function main() {
  log(`projectDir: ${projectDir}`);
  log(`topic: ${topic}`);
  log(`members: ${members}`);
  log(`gateway: http://127.0.0.1:${gatewayPort}/share/${shareId}`);
  if (!process.env.MEETING_ROOM_DAEMON_TOKEN?.trim()) {
    log("MEETING_ROOM_DAEMON_TOKEN は未指定だったので、この起動専用のランダム token を生成しました。");
  }

  spawnDaemon();
  await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${gatewayPort}/health`);
    return response.ok;
  }, "public share gateway health");

  if (useNgrok) {
    spawnNgrok();
    await printNgrokUrl();
  } else {
    log(`ngrok は起動していません。外部公開する時は別 terminal で \`ngrok http ${gatewayPort}\` を実行してください。`);
  }
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  await shutdown(1);
});
