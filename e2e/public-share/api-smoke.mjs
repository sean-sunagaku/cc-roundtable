#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../../", import.meta.url));
const runId = `${Date.now()}`;
const daemonPort = process.env.MEETING_ROOM_DAEMON_PORT ?? "4667";
const publicPort = process.env.MEETING_ROOM_PUBLIC_GATEWAY_PORT ?? "4668";
const wsPort = process.env.MEETING_ROOM_WS_PORT ?? "10667";
const shareId = process.env.MEETING_ROOM_PUBLIC_SHARE_ID ?? `demo-share-${runId}`;
const stateDir = path.join(os.tmpdir(), `meeting-room-public-share-${runId}`);
const daemonDataDir = path.join(stateDir, "daemon");
const approvalDir = path.join(stateDir, "approval");
const activeFile = path.join(stateDir, ".active");
const agentsDir = path.join(stateDir, "agents");
const summariesDir = path.join(stateDir, "summaries");

let daemonProcess = null;

function logStep(message) {
  console.log(`[public-share-smoke] ${message}`);
}

function runShell(command) {
  spawnSync("bash", ["-lc", command], {
    cwd: rootDir,
    stdio: "ignore"
  });
}

function killPortListeners(port) {
  runShell(`pids=$(lsof -nP -iTCP:${port} -sTCP:LISTEN -t 2>/dev/null || true); if [ -n "$pids" ]; then kill -KILL $pids 2>/dev/null || true; fi`);
}

async function waitFor(check, description, timeoutMs = 30_000, intervalMs = 500) {
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

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function startDaemon() {
  killPortListeners(daemonPort);
  killPortListeners(publicPort);
  killPortListeners(wsPort);
  fs.rmSync(stateDir, { recursive: true, force: true });
  fs.mkdirSync(approvalDir, { recursive: true });

  const env = {
    ...process.env,
    MEETING_ROOM_DAEMON_PORT: daemonPort,
    MEETING_ROOM_PUBLIC_GATEWAY_PORT: publicPort,
    MEETING_ROOM_WS_PORT: wsPort,
    MEETING_ROOM_E2E_FAKE_RUNTIME: "1",
    MEETING_ROOM_DAEMON_TOKEN: "public-share-smoke-token",
    MEETING_ROOM_DAEMON_DATA_DIR: daemonDataDir,
    MEETING_ROOM_APPROVAL_DIR: approvalDir,
    MEETING_ROOM_ACTIVE_FILE: activeFile,
    MEETING_ROOM_AGENTS_DIR: agentsDir,
    MEETING_ROOM_SUMMARIES_DIR: summariesDir,
    MEETING_ROOM_PUBLIC_SHARE_ID: shareId,
    MEETING_ROOM_PUBLIC_DEMO_PROJECT_DIR: rootDir,
    MEETING_ROOM_PUBLIC_DEMO_TOPIC: `Public share smoke ${runId}`,
    MEETING_ROOM_PUBLIC_DEMO_MEMBERS: "product-manager,tech-lead"
  };

  daemonProcess = spawn(process.execPath, ["scripts/start-daemon.mjs"], {
    cwd: rootDir,
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  daemonProcess.stdout?.on("data", (chunk) => {
    const line = chunk.toString().trim();
    if (line) {
      console.log(`[daemon] ${line}`);
    }
  });
  daemonProcess.stderr?.on("data", (chunk) => {
    const line = chunk.toString().trim();
    if (line) {
      console.log(`[daemon] ${line}`);
    }
  });

  await waitFor(
    () => fetchJson(`http://127.0.0.1:${publicPort}/health`).catch(() => null),
    "public share gateway health",
    60_000,
    750
  );
}

async function stopDaemon() {
  const child = daemonProcess;
  daemonProcess = null;
  if (!child || child.exitCode !== null) {
    return;
  }
  child.kill("SIGINT");
  await new Promise((resolve) => child.once("exit", resolve));
}

async function main() {
  try {
    await startDaemon();

    logStep("bootstrap");
    const bootstrap = await fetchJson(`http://127.0.0.1:${publicPort}/share-api/${shareId}/bootstrap`);
    if (!bootstrap.session || bootstrap.shareId !== shareId) {
      throw new Error("bootstrap payload is incomplete");
    }
    if ("config" in bootstrap.session.tab || "sessionDebug" in bootstrap.session || "health" in bootstrap.session) {
      throw new Error("bootstrap payload leaked internal daemon fields");
    }

    logStep("message");
    const messageAck = await fetchJson(`http://127.0.0.1:${publicPort}${bootstrap.messagePath}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "public share api smoke" })
    });
    if (!messageAck.accepted) {
      throw new Error("message command was rejected");
    }

    logStep("pause/resume/retry/end");
    for (const action of ["pause", "resume", "retryMcp", "endMeeting"]) {
      const ack = await fetchJson(`http://127.0.0.1:${publicPort}${bootstrap.controlPath}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
      });
      if (!ack.accepted) {
        throw new Error(`${action} command was rejected`);
      }
    }

    logStep("health after end");
    const health = await fetchJson(`http://127.0.0.1:${publicPort}/health`);
    if (!["ended", "idle"].includes(String(health.sessionStatus))) {
      throw new Error(`unexpected sessionStatus after end: ${health.sessionStatus}`);
    }

    logStep("ok");
  } finally {
    await stopDaemon();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
