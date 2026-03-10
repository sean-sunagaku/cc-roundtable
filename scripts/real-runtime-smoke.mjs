#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../", import.meta.url));
const daemonEntry = path.join(rootDir, "src", "daemon", "dist", "index.js");
const runId = `${Date.now()}`;
const topic = `Real runtime smoke ${runId}`;
const humanMessage =
  process.env.MEETING_ROOM_REAL_SMOKE_HUMAN_MESSAGE?.trim() ||
  "ここまでの状況を3行で要約してください。";
const projectDir = process.env.MEETING_ROOM_REAL_SMOKE_PROJECT_DIR?.trim() || rootDir;
const keepStateRequested = process.env.MEETING_ROOM_REAL_SMOKE_KEEP_STATE === "1";
const readyTimeoutMs = readIntEnv("MEETING_ROOM_REAL_SMOKE_READY_TIMEOUT_MS", 60_000);
const initialReplyTimeoutMs = readIntEnv("MEETING_ROOM_REAL_SMOKE_INITIAL_REPLY_TIMEOUT_MS", 180_000);
const humanReplyTimeoutMs = readIntEnv("MEETING_ROOM_REAL_SMOKE_HUMAN_REPLY_TIMEOUT_MS", 180_000);
const pollIntervalMs = readIntEnv("MEETING_ROOM_REAL_SMOKE_POLL_INTERVAL_MS", 5_000);

const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "meeting-room-real-smoke-"));
const daemonDataDir = path.join(stateDir, "daemon");
const approvalDir = path.join(stateDir, "approval");
const activeFile = path.join(stateDir, ".active");
const agentsDir = path.join(stateDir, "agents");
const summariesDir = path.join(stateDir, "summaries");

let daemonPort = 0;
let wsPort = 0;
let daemonProcess = null;
let meetingId = null;
let keepState = keepStateRequested;
let shuttingDown = false;

function logStep(message) {
  console.log(`[real-runtime-smoke] ${message}`);
}

function readIntEnv(name, fallback) {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  });

  if (result.status !== 0) {
    const stdout = (result.stdout ?? "").trim();
    const stderr = (result.stderr ?? "").trim();
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        stdout ? `stdout:\n${stdout}` : "",
        stderr ? `stderr:\n${stderr}` : ""
      ]
        .filter(Boolean)
        .join("\n\n")
    );
  }

  return (result.stdout ?? "").trim();
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to resolve free port")));
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
  });
}

async function waitFor(check, description, timeoutMs, intervalMs = pollIntervalMs) {
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

async function daemonJson(pathname, init = undefined) {
  const response = await fetch(`http://127.0.0.1:${daemonPort}${pathname}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${response.status} ${JSON.stringify(json)}`);
  }
  return json;
}

async function dispatch(command) {
  return daemonJson("/api/commands", {
    method: "POST",
    body: JSON.stringify({
      commandId: `smoke_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sentAt: new Date().toISOString(),
      command
    })
  });
}

async function getSessionView() {
  if (!meetingId) {
    throw new Error("Meeting ID is not set");
  }
  return daemonJson(`/api/sessions/${encodeURIComponent(meetingId)}`);
}

async function getSessionDebug() {
  if (!meetingId) {
    throw new Error("Meeting ID is not set");
  }
  return daemonJson(`/api/sessions/${encodeURIComponent(meetingId)}/debug`);
}

async function startDaemon() {
  fs.mkdirSync(approvalDir, { recursive: true });

  const env = {
    ...process.env,
    MEETING_ROOM_DAEMON_PORT: `${daemonPort}`,
    MEETING_ROOM_WS_PORT: `${wsPort}`,
    MEETING_ROOM_DAEMON_DATA_DIR: daemonDataDir,
    MEETING_ROOM_APPROVAL_DIR: approvalDir,
    MEETING_ROOM_ACTIVE_FILE: activeFile,
    MEETING_ROOM_AGENTS_DIR: agentsDir,
    MEETING_ROOM_SUMMARIES_DIR: summariesDir
  };
  delete env.MEETING_ROOM_E2E_FAKE_RUNTIME;

  daemonProcess = spawn(process.execPath, [daemonEntry], {
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

  daemonProcess.once("exit", (code, signal) => {
    if (!shuttingDown) {
      console.log(
        `[daemon] stopped unexpectedly (code=${code ?? "null"}, signal=${signal ?? "null"})`
      );
    }
  });

  await waitFor(() => daemonJson("/health").catch(() => null), "daemon health", 60_000, 750);
}

async function stopDaemon() {
  const child = daemonProcess;
  daemonProcess = null;
  if (!child || child.exitCode !== null) {
    return;
  }

  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };

    child.once("exit", finish);
    child.kill("SIGINT");
    setTimeout(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }, 1_500);
    setTimeout(finish, 5_000);
  });
}

async function dumpDebugTail() {
  if (!meetingId) {
    return;
  }
  try {
    const debug = await getSessionDebug();
    console.error(
      JSON.stringify(
        {
          step: "debug-tail",
          hasUsageLimit: debug.hasUsageLimit,
          hasMcpError: debug.hasMcpError,
          tail: debug.tail.slice(-40)
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          step: "debug-tail-error",
          message: error instanceof Error ? error.message : String(error)
        },
        null,
        2
      )
    );
  }
}

async function runSmoke() {
  meetingId = `real_smoke_${runId}`;
  const members = ["tech-lead", "user-liaison"];

  logStep(`starting meeting ${meetingId}`);
  const startAck = await dispatch({
    type: "startMeeting",
    meetingId,
    topic,
    projectDir,
    members,
    bypassMode: true
  });
  logStep(`startMeeting accepted=${startAck.accepted}`);

  const readySession = await waitFor(
    async () => {
      const session = await getSessionView();
      return session.health?.claudeReadyAt ? session : null;
    },
    "Claude ready signal",
    readyTimeoutMs
  );
  logStep(`claudeReadyAt=${readySession.health.claudeReadyAt}`);

  const readyDebug = await getSessionDebug();
  if (readyDebug.tail.some((line) => /e2e fake runtime/i.test(line))) {
    throw new Error("Real runtime smoke started with E2E fake runtime output");
  }

  const initialReplySession = await waitFor(
    async () => {
      const session = await getSessionView();
      const agentMessages = session.messages.filter((message) => message.source === "agent");
      return agentMessages.length > 0 ? session : null;
    },
    "initial agent reply",
    initialReplyTimeoutMs
  );
  const initialAgentMessages = initialReplySession.messages.filter(
    (message) => message.source === "agent"
  );
  logStep(
    `initial agent reply received at ${initialReplySession.health.lastAgentReplyAt ?? "unknown"}`
  );

  const humanAck = await dispatch({
    type: "sendHumanMessage",
    meetingId,
    message: humanMessage
  });
  logStep(`sendHumanMessage accepted=${humanAck.accepted}`);

  const agentMessagesBeforeHuman = initialAgentMessages.length;
  const humanReplySession = await waitFor(
    async () => {
      const session = await getSessionView();
      const agentMessages = session.messages.filter((message) => message.source === "agent");
      const inputDeliveredAt = session.health?.inputDeliveredAt;
      const lastAgentReplyAt = session.health?.lastAgentReplyAt;
      if (!inputDeliveredAt || !lastAgentReplyAt) {
        return null;
      }
      return agentMessages.length > agentMessagesBeforeHuman &&
        Date.parse(lastAgentReplyAt) >= Date.parse(inputDeliveredAt)
        ? session
        : null;
    },
    "agent reply after human message",
    humanReplyTimeoutMs
  );

  const finalAgentMessages = humanReplySession.messages.filter((message) => message.source === "agent");
  const lastAgentMessage = finalAgentMessages.at(-1) ?? null;
  logStep(`agent replied after human message at ${humanReplySession.health.lastAgentReplyAt}`);

  const endAck = await dispatch({
    type: "endMeeting",
    meetingId
  });
  logStep(`endMeeting accepted=${endAck.accepted}`);

  const endedSession = await waitFor(
    async () => {
      const session = await getSessionView();
      return session.tab?.status === "ended" ? session : null;
    },
    "meeting end",
    15_000,
    1_000
  );

  console.log(
    JSON.stringify(
      {
        step: "success",
        meetingId,
        daemonPort,
        wsPort,
        stateDir,
        summary: {
          status: endedSession.tab.status,
          agentMessages: finalAgentMessages.length,
          humanMessages: humanReplySession.messages.filter((message) => message.source === "human")
            .length,
          claudeReadyAt: humanReplySession.health.claudeReadyAt,
          inputDeliveredAt: humanReplySession.health.inputDeliveredAt,
          lastAgentReplyAt: humanReplySession.health.lastAgentReplyAt,
          firstAgentMessagePreview: initialAgentMessages[0]?.content?.slice(0, 160) ?? null,
          lastAgentMessagePreview: lastAgentMessage?.content?.slice(0, 240) ?? null
        }
      },
      null,
      2
    )
  );
}

async function cleanup() {
  shuttingDown = true;
  await stopDaemon();
  if (!keepState) {
    fs.rmSync(stateDir, { recursive: true, force: true });
    return;
  }
  logStep(`kept state at ${stateDir}`);
}

async function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }
  keepState = true;
  await cleanup();
  process.exit(exitCode);
}

process.on("SIGINT", () => {
  void shutdown(130);
});

process.on("SIGTERM", () => {
  void shutdown(143);
});

async function main() {
  daemonPort = Number(process.env.MEETING_ROOM_REAL_SMOKE_DAEMON_PORT) || (await getFreePort());
  wsPort = Number(process.env.MEETING_ROOM_REAL_SMOKE_WS_PORT) || (await getFreePort());

  logStep("building daemon bundle");
  runCommand("npm", ["--prefix", "src/apps/desktop", "run", "build:daemon"]);

  if (!fs.existsSync(daemonEntry)) {
    throw new Error(`Daemon entry file was not generated: ${daemonEntry}`);
  }

  logStep(`starting daemon on http://127.0.0.1:${daemonPort}`);
  await startDaemon();
  await runSmoke();
}

void main()
  .catch(async (error) => {
    keepState = true;
    console.error(
      JSON.stringify(
        {
          step: "error",
          message: error instanceof Error ? error.message : String(error),
          meetingId,
          daemonPort,
          wsPort,
          stateDir
        },
        null,
        2
      )
    );
    await dumpDebugTail();
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
  });
