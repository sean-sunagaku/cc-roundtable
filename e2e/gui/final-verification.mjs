#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..");
const electronDir = path.resolve(repoRoot, "src", "apps", "desktop");
const electronBin = path.resolve(electronDir, "node_modules", ".bin", "electron");
const cdpPort = process.env.MEETING_ROOM_E2E_CDP_PORT ?? "9222";
const daemonPort = process.env.MEETING_ROOM_DAEMON_PORT ?? "4467";
const wsPort = process.env.MEETING_ROOM_WS_PORT ?? "10117";
const runId = `${Date.now()}`;
const browserSession = `meeting-room-final-e2e-${runId}`;
const topic = `GUI E2E final verification ${runId}`;
const bypassTopic = `GUI E2E bypass verification ${runId}`;
const humanMessage = "GUI E2E の自動確認です。状態を短く返してください。";
const agentReplyTimeoutMs = 120_000;

let electronProcess = null;
let rendererCdp = null;

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

async function connectRendererCdp() {
  const target = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
    if (!response.ok) {
      return null;
    }
    const pages = await response.json();
    return pages.find((page) => page.type === "page" && String(page.title).includes("Meeting Room")) ?? pages.find((page) => page.type === "page") ?? null;
  }, "Electron renderer target", 30_000, 750);

  rendererCdp = new CdpClient(target.webSocketDebuggerUrl);
  await rendererCdp.connect();
  await rendererCdp.send("Page.enable");
  await rendererCdp.send("Runtime.enable");
}

async function evaluateRenderer(expression) {
  if (!rendererCdp) {
    throw new Error("Renderer CDP client is not connected");
  }
  const payload = await rendererCdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });

  if (payload.exceptionDetails) {
    const description =
      payload.exceptionDetails.exception?.description ||
      payload.exceptionDetails.text ||
      "Runtime.evaluate failed";
    throw new Error(description);
  }

  if ("value" in payload.result) {
    return payload.result.value;
  }
  return payload.result.unserializableValue ?? null;
}

async function waitForRendererDom(expression, description, timeoutMs = 30_000, intervalMs = 500) {
  return waitFor(async () => evaluateRenderer(expression), description, timeoutMs, intervalMs);
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
  await connectRendererCdp();
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
  if (rendererCdp) {
    await rendererCdp.close().catch(() => undefined);
    rendererCdp = null;
  }

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

async function startMeetingFromSetup({ meetingTopic = topic, bypassMode = false } = {}) {
  const snap = snapshot();
  const topicRef = findRef(snap, "textbox", "議題（ここを中心に議論）");
  if (!topicRef) {
    throw new Error(`Setup screen controls were not found.\n${snap}`);
  }
  if (bypassMode && !findRef(snap, "button", "進行モード設定")) {
    throw new Error(`Flow mode toggle button was not found.\n${snap}`);
  }

  runAgentBrowser("fill", `@${topicRef}`, meetingTopic);
  if (bypassMode) {
    const modeSettingsRef = findRef(snapshot(), "button", "進行モード設定");
    if (!modeSettingsRef) {
      throw new Error("Flow mode toggle button disappeared before expanding settings.");
    }
    runAgentBrowser("click", `@${modeSettingsRef}`);
    await delay(500);
    const expanded = snapshot();
    const bypassRef = findRef(expanded, "checkbox", "Bypass Mode");
    if (!bypassRef) {
      throw new Error(`Bypass Mode checkbox was not found after expanding flow mode settings.\n${expanded}`);
    }
    runAgentBrowser("click", `@${bypassRef}`);
  }
  const startRef = findRef(snapshot(), "button", "会議を開始");
  if (!startRef) {
    throw new Error("Start button was not found before launch.");
  }
  runAgentBrowser("click", `@${startRef}`);

  await waitFor(() => {
    const current = snapshot();
    return isMeetingScreen(current, meetingTopic) ? current : null;
  }, "meeting screen after start", 30_000, 750);

  return waitFor(() => currentMeetingIdByTitle(meetingTopic), "daemon session creation", 30_000, 750);
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

function isRenderableAgentMessage(message) {
  if (!message || message.source !== "agent") {
    return false;
  }
  const content = String(message.content ?? "").trim();
  if (!content || content === humanMessage) {
    return false;
  }
  if (/^(?:\/Users\/|\/home\/|[A-Za-z]:\\).+\.(?:jsonl|json|md|txt|log)$/u.test(content)) {
    return false;
  }
  return true;
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function buildExpectedAgentEntries(messages) {
  return messages
    .filter((message) => isRenderableAgentMessage(message))
    .map((message) => ({
      sender: normalizeText(message.subagent?.trim() || message.sender),
      snippet: normalizeText(message.content).slice(0, 40)
    }));
}

async function verifyAgentConversation(meetingId, label) {
  const view = await waitFor(async () => {
    const current = await currentMeetingView(meetingId);
    if (!current.health?.lastAgentReplyAt) {
      return null;
    }
    if (current.sessionDebug?.tail?.some((line) => /AskUserQuestion/i.test(String(line)))) {
      throw new Error(`AskUserQuestion detected during ${label} flow`);
    }
    return current.messages.some((message) => isRenderableAgentMessage(message)) ? current : null;
  }, `${label} agent message in daemon session`, agentReplyTimeoutMs, 1_000);

  const expectedEntries = buildExpectedAgentEntries(view.messages);
  if (expectedEntries.length === 0) {
    throw new Error(`No renderable agent messages found for ${label}`);
  }

  await waitForRendererDom(
    `(() => {
      const bubbles = [...document.querySelectorAll(".bubble.agent")];
      return bubbles.some((bubble) => {
        const sender = bubble.querySelector(".sender")?.textContent?.trim() || "";
        const body = bubble.querySelector(".bubble-body")?.textContent?.trim() || "";
        return sender.length > 0 && body.length > 0 && !/\\.jsonl$/i.test(body);
      });
    })()`,
    `${label} agent bubble in renderer`,
    agentReplyTimeoutMs,
    1_000
  );

  await waitForRendererDom(
    `(() => {
      const normalize = (value) => String(value ?? "").replace(/\\s+/g, " ").trim();
      const expectedEntries = ${JSON.stringify(expectedEntries)};
      const bubbles = [...document.querySelectorAll(".bubble.agent")].map((bubble) => ({
        sender: normalize(bubble.querySelector(".sender")?.textContent),
        body: normalize(bubble.querySelector(".bubble-body")?.textContent)
      }));
      return expectedEntries.every((expected) => bubbles.some((bubble) => {
        return bubble.sender === expected.sender && bubble.body.includes(expected.snippet);
      }));
    })()`,
    `${label} all agent messages in renderer`,
    agentReplyTimeoutMs,
    1_000
  );
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

async function verifyBypassModeStart() {
  const meetingId = await startMeetingFromSetup({ meetingTopic: bypassTopic, bypassMode: true });

  await waitFor(async () => {
    const view = await currentMeetingView(meetingId);
    return view.tab.config?.bypassMode === true && view.approvalGate?.bypassMode === true ? view : null;
  }, "bypass mode session config", 30_000, 750);

  await sendHumanMessageAndVerify(meetingId);
  await verifyAgentConversation(meetingId, "bypass");

  await endMeetingAndVerifyCleared();
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.socket = null;
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(this.wsUrl);
      const timer = setTimeout(() => {
        reject(new Error("CDP connection timed out"));
      }, 10_000);

      socket.addEventListener("open", () => {
        clearTimeout(timer);
        this.socket = socket;
        resolve();
      });

      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(String(event.data));
          if (!payload.id) {
            return;
          }
          const pending = this.pending.get(payload.id);
          if (!pending) {
            return;
          }
          this.pending.delete(payload.id);
          if (payload.error) {
            pending.reject(new Error(payload.error.message || "CDP error"));
            return;
          }
          pending.resolve(payload.result);
        } catch (error) {
          reject(error);
        }
      });

      socket.addEventListener("error", () => {
        reject(new Error("CDP websocket error"));
      });

      socket.addEventListener("close", () => {
        for (const pending of this.pending.values()) {
          pending.reject(new Error("CDP websocket closed"));
        }
        this.pending.clear();
      });
    });
  }

  send(method, params = {}) {
    if (!this.socket) {
      throw new Error("CDP socket is not connected");
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async close() {
    if (!this.socket) {
      return;
    }
    const socket = this.socket;
    this.socket = null;
    await new Promise((resolve) => {
      socket.addEventListener("close", () => resolve(), { once: true });
      socket.close();
      setTimeout(resolve, 1_000);
    });
  }
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
    await verifyAgentConversation(meetingId, "normal");

    logStep("verifying pause and resume");
    await verifyPauseAndResume(meetingId);

    logStep("verifying recovery after app restart");
    await verifyRecovery(meetingId);

    logStep("ending meeting and confirming cleanup");
    await endMeetingAndVerifyCleared();

    logStep("starting bypass mode meeting");
    await verifyBypassModeStart();

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
