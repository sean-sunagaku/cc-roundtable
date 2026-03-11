#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../", import.meta.url));
const runId = `${Date.now()}`;
const daemonPort = process.env.MEETING_ROOM_DAEMON_PORT ?? "4667";
const gatewayPort = process.env.MEETING_ROOM_PUBLIC_GATEWAY_PORT ?? "4668";
const wsPort = process.env.MEETING_ROOM_WS_PORT ?? "10667";
const shareId = process.env.MEETING_ROOM_PUBLIC_SHARE_ID ?? `smoke-${runId}`;
const topic = `Public Share Smoke ${runId}`;
const demoProjectDir = process.env.MEETING_ROOM_PUBLIC_DEMO_PROJECT_DIR ?? rootDir;
const demoMembers = process.env.MEETING_ROOM_PUBLIC_DEMO_MEMBERS ?? "product-manager,tech-lead";
const tmpDir = path.join(os.tmpdir(), `meeting-room-public-share-${runId}`);

let daemonProcess = null;

function logStep(message) {
  console.log(`[public-share-smoke] ${message}`);
}

function killPortListeners(port) {
  spawnSync(
    "bash",
    [
      "-lc",
      `pids=$(lsof -nP -iTCP:${port} -sTCP:LISTEN -t 2>/dev/null || true); if [ -n "$pids" ]; then kill -KILL $pids 2>/dev/null || true; fi`
    ],
    { cwd: rootDir, stdio: "ignore" }
  );
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

  throw new Error(
    `Timed out while waiting for ${description}${lastError ? `: ${String(lastError)}` : ""}`
  );
}

async function gatewayJson(pathname, init = {}) {
  const response = await fetch(`http://127.0.0.1:${gatewayPort}${pathname}`, init);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${response.status} ${pathname} ${text}`);
  }
  return payload;
}

async function startDaemon() {
  killPortListeners(daemonPort);
  killPortListeners(gatewayPort);
  killPortListeners(wsPort);

  daemonProcess = spawn(process.execPath, ["scripts/start-daemon.mjs"], {
    cwd: rootDir,
    env: {
      ...process.env,
      MEETING_ROOM_DAEMON_PORT: daemonPort,
      MEETING_ROOM_PUBLIC_GATEWAY_PORT: gatewayPort,
      MEETING_ROOM_WS_PORT: wsPort,
      MEETING_ROOM_DAEMON_TOKEN: "smoke-secret-token",
      MEETING_ROOM_PUBLIC_SHARE_ID: shareId,
      MEETING_ROOM_PUBLIC_DEMO_PROJECT_DIR: demoProjectDir,
      MEETING_ROOM_PUBLIC_DEMO_TOPIC: topic,
      MEETING_ROOM_PUBLIC_DEMO_MEMBERS: demoMembers,
      MEETING_ROOM_E2E_FAKE_RUNTIME: "1",
      MEETING_ROOM_DAEMON_DATA_DIR: path.join(tmpDir, "daemon"),
      MEETING_ROOM_APPROVAL_DIR: path.join(tmpDir, "approval"),
      MEETING_ROOM_ACTIVE_FILE: path.join(tmpDir, ".active"),
      MEETING_ROOM_AGENTS_DIR: path.join(tmpDir, "agents"),
      MEETING_ROOM_SUMMARIES_DIR: path.join(tmpDir, "summaries")
    },
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
    async () => {
      const response = await fetch(`http://127.0.0.1:${gatewayPort}/health`);
      return response.ok;
    },
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
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    logStep("starting daemon with fake runtime");
    await startDaemon();

    logStep("bootstrapping public share session");
    const sharePage = await fetch(
      `http://127.0.0.1:${gatewayPort}/share/${encodeURIComponent(shareId)}`
    );
    if (!sharePage.ok) {
      throw new Error(`Public share page returned ${sharePage.status}`);
    }
    const shareHtml = await sharePage.text();
    if (!shareHtml.includes("Meeting Room Public Share")) {
      throw new Error("Public share page did not return the expected HTML.");
    }

    const bootstrap = await gatewayJson(`/share-api/${encodeURIComponent(shareId)}/bootstrap`);
    if (bootstrap.meetingId !== `public_${shareId}`) {
      throw new Error(`Unexpected meetingId: ${bootstrap.meetingId}`);
    }
    if (bootstrap.session.tab.status !== "running") {
      throw new Error(`Unexpected initial status: ${bootstrap.session.tab.status}`);
    }
    if ("config" in bootstrap.session.tab) {
      throw new Error("Public share bootstrap leaked internal tab config.");
    }
    if ("sessionDebug" in bootstrap.session || "health" in bootstrap.session) {
      throw new Error("Public share bootstrap leaked internal debug data.");
    }

    logStep("restarting daemon to verify recovering session is rebuilt");
    await stopDaemon();
    await startDaemon();
    const recovered = await gatewayJson(`/share-api/${encodeURIComponent(shareId)}/bootstrap`);
    if (recovered.session.tab.status !== "running") {
      throw new Error(
        `Expected restarted daemon bootstrap to return running, got ${recovered.session.tab.status}`
      );
    }

    logStep("sending message via public share gateway");
    const messageAck = await gatewayJson(`/share-api/${encodeURIComponent(shareId)}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Public share smoke input" })
    });
    if (!messageAck.accepted) {
      throw new Error("Public share message was rejected.");
    }

    logStep("ending session via public share gateway");
    const endAck = await gatewayJson(`/share-api/${encodeURIComponent(shareId)}/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "endMeeting" })
    });
    if (!endAck.accepted) {
      throw new Error("Public share endMeeting was rejected.");
    }

    logStep("verifying post-end message is rejected");
    const postEndResponse = await fetch(
      `http://127.0.0.1:${gatewayPort}/share-api/${encodeURIComponent(shareId)}/message`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "after end" })
      }
    );
    if (postEndResponse.status !== 409) {
      throw new Error(`Expected 409 after endMeeting, got ${postEndResponse.status}`);
    }

    logStep("verifying bootstrap recreates the fixed meeting");
    const restarted = await gatewayJson(`/share-api/${encodeURIComponent(shareId)}/bootstrap`);
    if (restarted.session.tab.status !== "running") {
      throw new Error(`Unexpected restarted status: ${restarted.session.tab.status}`);
    }

    logStep("verifying public port does not expose internal daemon api");
    const leaked = await fetch(`http://127.0.0.1:${gatewayPort}/api/sessions`);
    if (leaked.status !== 404) {
      throw new Error(`Expected public port /api/sessions to be 404, got ${leaked.status}`);
    }

    logStep("public share smoke passed");
  } finally {
    await stopDaemon();
  }
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
