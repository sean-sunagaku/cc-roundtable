#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..");
const electronDir = path.resolve(repoRoot, "electron");
const electronBin = path.resolve(electronDir, "node_modules", ".bin", "electron");
const cdpPort = process.env.MEETING_ROOM_E2E_CDP_PORT ?? "9222";
const daemonPort = process.env.MEETING_ROOM_DAEMON_PORT ?? "4467";
const wsPort = process.env.MEETING_ROOM_WS_PORT ?? "10117";
const runId = `${Date.now()}`;
const browserSession = `meeting-room-final-e2e-${runId}`;
const topic = `GUI E2E final verification ${runId}`;
const humanMessage = "GUI E2E の自動確認です。状態を短く返してください。";

let electronProcess = null;

function logStep(message) {
  console.log(`[gui-e2e] ${message}`);
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  });

  if (result.status !== 0) {
    const stderr = (result.stderr ?? "").trim();
    const stdout = (result.stdout ?? "").trim();
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        stdout ? `stdout:\n${stdout}` : "",
        stderr ? `stderr:\n${stderr}` : ""
      ].filter(Boolean).join("\n\n")
    );
  }

  return (result.stdout ?? "").trim();
}

function runAgentBrowser(...args) {
  return runCommand(process.env.AGENT_BROWSER_BIN ?? "agent-browser", ["--session", browserSession, ...args]);
}

function snapshot() {
  return runAgentBrowser("snapshot", "-i");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findRef(text, role, label) {
  const match = text.match(new RegExp(`- ${escapeRegex(role)} "${escapeRegex(label)}" \\[ref=(e\\d+)\\]`, "u"));
  return match?.[1] ?? null;
}

function hasControl(text, role, label) {
  return findRef(text, role, label) !== null;
}

function isSetupScreen(text) {
  return hasControl(text, "button", "会議を開始") && text.includes('textbox "議題（ここを中心に議論）"');
}

function isMeetingScreen(text, title) {
  return (
    hasControl(text, "button", "一時停止") &&
    hasControl(text, "button", "会議終了") &&
    text.includes('textbox "メッセージを入力..."')
  );
}

function isAnyKnownScreen(text) {
  return isSetupScreen(text) || hasControl(text, "button", "会議終了") || hasControl(text, "button", "一時停止");
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

async function daemonJson(pathname) {
  const response = await fetch(`http://127.0.0.1:${daemonPort}${pathname}`);
  if (!response.ok) {
    throw new Error(`Daemon request failed (${response.status}) for ${pathname}`);
  }
  return response.json();
}

async function currentMeetingIdByTitle(title) {
  const payload = await daemonJson("/api/sessions");
  const match = payload.sessions.find((session) => session.title === title);
  return match?.id ?? null;
}

async function currentMeetingView(meetingId) {
  return daemonJson(`/api/sessions/${encodeURIComponent(meetingId)}`);
}

async function connectBrowser() {
  await waitFor(() => {
    try {
      runAgentBrowser("connect", cdpPort);
      return true;
    } catch {
      return false;
    }
  }, "Electron CDP connection", 20_000, 750);
}

async function focusMeetingRoomTab() {
  await waitFor(() => {
    const tabs = runAgentBrowser("tab");
    const match = tabs.match(/→?\s*\[(\d+)\]\s+Meeting Room/u);
    if (!match) {
      return false;
    }
    runAgentBrowser("tab", match[1]);
    return true;
  }, "Meeting Room tab", 30_000, 750);
}

async function launchElectron() {
  if (!fs.existsSync(electronBin)) {
    throw new Error(`Electron binary not found: ${electronBin}`);
  }

  logStep(`clearing ports cdp=${cdpPort} daemon=${daemonPort}`);
  killPortListeners(cdpPort);
  killPortListeners(daemonPort);
  await delay(500);

  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  env.MEETING_ROOM_DAEMON_PORT = daemonPort;
  env.MEETING_ROOM_WS_PORT = wsPort;
  electronProcess = spawn(electronBin, [".", `--remote-debugging-port=${cdpPort}`], {
    cwd: electronDir,
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  electronProcess.stdout?.on("data", (chunk) => {
    const line = chunk.toString().trim();
    if (line) {
      console.log(`[electron] ${line}`);
    }
  });
  electronProcess.stderr?.on("data", (chunk) => {
    const line = chunk.toString().trim();
    if (line) {
      console.log(`[electron] ${line}`);
    }
  });

  await connectBrowser();
  await focusMeetingRoomTab();
  await waitFor(() => {
    const snap = snapshot();
    return isAnyKnownScreen(snap) ? snap : null;
  }, "Meeting Room UI", 30_000, 750);
}

function killPortListeners(port) {
  spawnSync("bash", ["-lc", `pids=$(lsof -nP -iTCP:${port} -sTCP:LISTEN -t 2>/dev/null || true); if [ -n "$pids" ]; then kill -KILL $pids 2>/dev/null || true; fi`], {
    cwd: repoRoot,
    stdio: "ignore"
  });
}

async function stopElectron() {
  if (!electronProcess) {
    return;
  }

  const child = electronProcess;
  electronProcess = null;

  if (child.exitCode !== null) {
    return;
  }

  logStep("stopping Electron");
  child.kill("SIGINT");
  await new Promise((resolve) => child.once("exit", resolve));
  logStep("stopping daemon");
  killPortListeners(daemonPort);
  await waitFor(async () => {
    try {
      await daemonJson("/health");
      return false;
    } catch {
      return true;
    }
  }, "daemon shutdown", 10_000, 500);
}

async function resetToSetupScreen() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const snap = snapshot();
    if (isSetupScreen(snap)) {
      return;
    }

    const endRef = findRef(snap, "button", "会議終了");
    if (!endRef) {
      throw new Error(`Could not find 会議終了 button while resetting UI.\n${snap}`);
    }
    runAgentBrowser("click", `@${endRef}`);
    await delay(1200);
  }

  throw new Error("Failed to return to setup screen");
}

async function startMeetingFromSetup() {
  const snap = snapshot();
  const topicRef = findRef(snap, "textbox", "議題（ここを中心に議論）");
  const startRef = findRef(snap, "button", "会議を開始");
  if (!topicRef || !startRef) {
    throw new Error(`Setup screen controls were not found.\n${snap}`);
  }

  runAgentBrowser("fill", `@${topicRef}`, topic);
  runAgentBrowser("click", `@${startRef}`);

  await waitFor(() => {
    const current = snapshot();
    return isMeetingScreen(current, topic) ? current : null;
  }, "meeting screen after start", 30_000, 750);

  return waitFor(() => currentMeetingIdByTitle(topic), "daemon session creation", 30_000, 750);
}

async function sendHumanMessageAndVerify(meetingId) {
  const snap = snapshot();
  const inputRef = findRef(snap, "textbox", "メッセージを入力...");
  const sendRef = findRef(snap, "button", "送信");
  if (!inputRef || !sendRef) {
    throw new Error(`Meeting screen controls for send were not found.\n${snap}`);
  }

  runAgentBrowser("fill", `@${inputRef}`, humanMessage);
  await delay(500);
  runAgentBrowser("click", `@${sendRef}`);

  await waitFor(async () => {
    const view = await currentMeetingView(meetingId);
    return view.messages.some((message) => message.source === "human" && message.content === humanMessage) ? view : null;
  }, "human message persistence", 30_000, 750);
}

async function verifyPauseAndResume(meetingId) {
  let snap = snapshot();
  const pauseRef = findRef(snap, "button", "一時停止");
  const resumeRef = findRef(snap, "button", "再開");
  if (!pauseRef || !resumeRef) {
    throw new Error(`Pause/Resume controls were not found.\n${snap}`);
  }

  runAgentBrowser("click", `@${pauseRef}`);
  await waitFor(async () => {
    const view = await currentMeetingView(meetingId);
    return view.tab.status === "paused" ? view : null;
  }, "paused status", 30_000, 750);

  snap = snapshot();
  const resumeRefAfterPause = findRef(snap, "button", "再開");
  if (!resumeRefAfterPause) {
    throw new Error(`Resume button disappeared after pause.\n${snap}`);
  }
  runAgentBrowser("click", `@${resumeRefAfterPause}`);
  await waitFor(async () => {
    const view = await currentMeetingView(meetingId);
    return view.tab.status === "running" ? view : null;
  }, "running status after resume", 30_000, 750);
}

async function verifyRecovery(meetingId) {
  logStep("stopping app for recovery check");
  await stopElectron();
  await delay(1500);
  logStep("relaunching app for recovery check");
  await launchElectron();

  logStep("waiting for recovered meeting screen");
  await waitFor(() => {
    const snap = snapshot();
    return isMeetingScreen(snap, topic) ? snap : null;
  }, "recovered meeting screen", 30_000, 750);

  logStep("waiting for recovering status");
  await waitFor(async () => {
    const view = await currentMeetingView(meetingId);
    return view.tab.status === "recovering" ? view : null;
  }, "recovering status after restart", 30_000, 750);
}

async function endMeetingAndVerifyCleared() {
  const snap = snapshot();
  const endRef = findRef(snap, "button", "会議終了");
  if (!endRef) {
    throw new Error(`End button was not found.\n${snap}`);
  }

  runAgentBrowser("click", `@${endRef}`);

  await waitFor(() => {
    const current = snapshot();
    return isSetupScreen(current) ? current : null;
  }, "setup screen after end", 30_000, 750);

  await waitFor(async () => {
    const payload = await daemonJson("/api/sessions");
    return payload.sessions.length === 0 ? payload : null;
  }, "empty session list after end", 30_000, 750);
}

async function main() {
  logStep("launching Electron");
  await launchElectron();

  try {
    logStep("resetting UI to setup screen");
    await resetToSetupScreen();

    logStep("starting a new meeting from setup");
    const meetingId = await startMeetingFromSetup();
    logStep(`meeting started: ${meetingId}`);

    logStep("sending a human message");
    await sendHumanMessageAndVerify(meetingId);

    logStep("verifying pause and resume");
    await verifyPauseAndResume(meetingId);

    logStep("verifying recovery after app restart");
    await verifyRecovery(meetingId);

    logStep("ending meeting and confirming cleanup");
    await endMeetingAndVerifyCleared();

    logStep("GUI E2E passed");
  } finally {
    await stopElectron().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(`[gui-e2e] FAILED: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  void stopElectron().finally(() => {
    process.exitCode = 1;
  });
});
