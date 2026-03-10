#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const electronNodeModules = path.join(rootDir, "src", "apps", "desktop", "node_modules");
const require = createRequire(import.meta.url);

let esbuild;
try {
  esbuild = require(path.join(electronNodeModules, "esbuild"));
} catch (error) {
  console.error("esbuild が見つかりません。先に `npm --prefix src/apps/desktop install` を実行してください。");
  process.exit(error instanceof Error ? 1 : 1);
}

const args = new Set(process.argv.slice(2));
if (args.has("--help") || args.has("-h")) {
  printHelp();
  process.exit(0);
}

const watch = args.has("--watch");
const daemonEntry = path.join(rootDir, "src", "daemon", "dist", "index.js");
const daemonSource = path.join(rootDir, "src", "daemon", "src", "index.ts");
const daemonTsconfig = path.join(rootDir, "src", "daemon", "tsconfig.json");
const daemonDistDir = path.join(rootDir, "src", "daemon", "dist");
const webBuilderScript = path.join(rootDir, "scripts", "build-web-client.mjs");
const host = process.env.MEETING_ROOM_DAEMON_HOST?.trim() || "127.0.0.1";
const port = process.env.MEETING_ROOM_DAEMON_PORT?.trim() || "4417";
const publicShareId = process.env.MEETING_ROOM_PUBLIC_SHARE_ID?.trim() || "";
const publicShareHost = process.env.MEETING_ROOM_PUBLIC_GATEWAY_HOST?.trim() || "127.0.0.1";
const publicSharePort = process.env.MEETING_ROOM_PUBLIC_GATEWAY_PORT?.trim() || "4427";

let daemonProcess = null;
let buildContext = null;
let webBuilderProcess = null;
let shuttingDown = false;
let restartChain = Promise.resolve();

function printHelp() {
  console.log(`Usage:
  node scripts/start-daemon.mjs
  node scripts/start-daemon.mjs --watch

Options:
  --watch   Build を監視し、成功時に daemon を再起動します
  --help    このヘルプを表示します`);
}

function log(message) {
  console.log(`[start-daemon] ${message}`);
}

function buildOptions(plugins = []) {
  return {
    entryPoints: [daemonSource],
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["node-pty"],
    outdir: daemonDistDir,
    sourcemap: true,
    tsconfig: daemonTsconfig,
    logLevel: "info",
    plugins
  };
}

function spawnDaemon() {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;

  const child = spawn(process.execPath, [daemonEntry], {
    cwd: rootDir,
    env,
    stdio: "inherit"
  });
  daemonProcess = child;

  child.once("exit", (code, signal) => {
    if (daemonProcess === child) {
      daemonProcess = null;
    }
    if (!shuttingDown) {
      log(`daemon stopped (code=${code ?? "null"}, signal=${signal ?? "null"})`);
    }
  });

  log(`daemon listening target: http://${host}:${port}`);
  log(`browser UI: http://${host}:${port}/web/index.html`);
  if (publicShareId) {
    log(`public share gateway: http://${publicShareHost}:${publicSharePort}/share/${publicShareId}`);
  }
}

async function stopDaemon() {
  const child = daemonProcess;
  daemonProcess = null;
  if (!child) {
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

async function runWebBuildOnce() {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [webBuilderScript], {
      cwd: rootDir,
      env: process.env,
      stdio: "inherit"
    });
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`web build failed with code ${code ?? "null"}`));
    });
  });
}

function startWebWatch() {
  if (webBuilderProcess) {
    return;
  }
  const child = spawn(process.execPath, [webBuilderScript, "--watch"], {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit"
  });
  webBuilderProcess = child;
  child.once("exit", (code, signal) => {
    if (webBuilderProcess === child) {
      webBuilderProcess = null;
    }
    if (!shuttingDown) {
      log(`web builder stopped (code=${code ?? "null"}, signal=${signal ?? "null"})`);
    }
  });
}

async function stopWebBuilder() {
  const child = webBuilderProcess;
  webBuilderProcess = null;
  if (!child) {
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

function queueRestart(reason) {
  restartChain = restartChain.then(async () => {
    if (shuttingDown) return;
    if (!fs.existsSync(daemonEntry)) {
      log(`skip restart: build output not found (${daemonEntry})`);
      return;
    }
    await stopDaemon();
    if (shuttingDown) return;
    log(reason);
    spawnDaemon();
  });
  return restartChain;
}

async function startWatchMode() {
  startWebWatch();
  const restartPlugin = {
    name: "restart-daemon-on-build",
    setup(build) {
      build.onEnd(async (result) => {
        if (result.errors.length > 0) {
          log("build failed. 既存 daemon はそのまま維持します。");
          return;
        }
        await queueRestart("build succeeded. restarting daemon...");
      });
    }
  };

  buildContext = await esbuild.context(buildOptions([restartPlugin]));
  await buildContext.watch();
  log("watch mode started");
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  await buildContext?.dispose();
  await stopWebBuilder();
  await stopDaemon();
  process.exit(exitCode);
}

process.on("SIGINT", () => {
  void shutdown(0);
});

process.on("SIGTERM", () => {
  void shutdown(0);
});

async function main() {
  if (watch) {
    await startWatchMode();
    return;
  }

  await runWebBuildOnce();
  await esbuild.build(buildOptions());
  if (!fs.existsSync(daemonEntry)) {
    throw new Error(`daemon entry file was not generated: ${daemonEntry}`);
  }
  spawnDaemon();
}

void main().catch(async (error) => {
  console.error(error);
  await shutdown(1);
});
