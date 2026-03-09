#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../../", import.meta.url));
const daemonPort = process.env.MEETING_ROOM_DAEMON_PORT ?? "4567";
const wsPort = process.env.MEETING_ROOM_WS_PORT ?? "10167";
const chromePort = process.env.MEETING_ROOM_WEB_E2E_CDP_PORT ?? "9333";
const chromeAppName = process.env.MEETING_ROOM_WEB_E2E_CHROME_APP ?? "Google Chrome";
const runId = `${Date.now()}`;
const topic = `Web E2E final verification ${runId}`;
const humanMessage = "Web E2E の自動確認です。状態を短く返してください。";
const bypassTopic = `Web E2E bypass verification ${runId}`;
const webUrl = `http://127.0.0.1:${daemonPort}/web/index.html?runId=${runId}`;
const e2eStateDir = path.join(os.tmpdir(), `meeting-room-web-e2e-${runId}`);
const daemonDataDir = path.join(e2eStateDir, "daemon");
const approvalDir = path.join(e2eStateDir, "approval");
const activeFile = path.join(e2eStateDir, ".active");
const agentsDir = path.join(e2eStateDir, "agents");
const summariesDir = path.join(e2eStateDir, "summaries");
const chromeUserDataDir = path.join(e2eStateDir, "chrome-profile");

let daemonProcess = null;
let cdpClient = null;

function logStep(message) {
  console.log(`[web-e2e] ${message}`);
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
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

function killPortListeners(port) {
  spawnSync(
    "bash",
    ["-lc", `pids=$(lsof -nP -iTCP:${port} -sTCP:LISTEN -t 2>/dev/null || true); if [ -n "$pids" ]; then kill -KILL $pids 2>/dev/null || true; fi`],
    { cwd: rootDir, stdio: "ignore" }
  );
}

function killChromeProfileProcesses() {
  spawnSync(
    "bash",
    ["-lc", `pkill -f '${chromeUserDataDir.replace(/'/g, "'\\''")}' 2>/dev/null || true`],
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

async function startDaemon({ resetState = false } = {}) {
  killPortListeners(daemonPort);
  killPortListeners(wsPort);
  await delay(500);

  if (resetState) {
    fs.rmSync(e2eStateDir, { recursive: true, force: true });
  }
  fs.mkdirSync(e2eStateDir, { recursive: true });
  fs.mkdirSync(approvalDir, { recursive: true });

  const env = {
    ...process.env,
    MEETING_ROOM_DAEMON_PORT: daemonPort,
    MEETING_ROOM_WS_PORT: wsPort,
    MEETING_ROOM_DAEMON_DATA_DIR: daemonDataDir,
    MEETING_ROOM_APPROVAL_DIR: approvalDir,
    MEETING_ROOM_ACTIVE_FILE: activeFile,
    MEETING_ROOM_AGENTS_DIR: agentsDir,
    MEETING_ROOM_SUMMARIES_DIR: summariesDir
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

  await waitFor(() => daemonJson("/health").catch(() => null), "daemon health", 60_000, 750);
}

async function stopDaemon() {
  const child = daemonProcess;
  daemonProcess = null;
  if (!child) {
    return;
  }
  if (child.exitCode !== null) {
    return;
  }

  child.kill("SIGINT");
  await new Promise((resolve) => child.once("exit", resolve));
  await waitFor(async () => {
    try {
      await daemonJson("/health");
      return false;
    } catch {
      return true;
    }
  }, "daemon shutdown", 10_000, 500);
}

async function launchChrome() {
  killPortListeners(chromePort);
  killChromeProfileProcesses();
  fs.rmSync(chromeUserDataDir, { recursive: true, force: true });

  runCommand("open", [
    "-na",
    chromeAppName,
    "--args",
    `--remote-debugging-port=${chromePort}`,
    `--user-data-dir=${chromeUserDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    webUrl
  ]);

  const target = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${chromePort}/json/list`);
    if (!response.ok) {
      return null;
    }
    const pages = await response.json();
    return pages.find((page) => page.type === "page" && String(page.url).startsWith(webUrl)) ?? null;
  }, "Chrome target page", 30_000, 750);

  cdpClient = new CdpClient(target.webSocketDebuggerUrl);
  await cdpClient.connect();
  await cdpClient.send("Page.enable");
  await cdpClient.send("Runtime.enable");
}

async function stopChrome() {
  await cdpClient?.close().catch(() => undefined);
  cdpClient = null;
  killPortListeners(chromePort);
  killChromeProfileProcesses();
}

function mustHaveClient() {
  if (!cdpClient) {
    throw new Error("CDP client is not connected");
  }
  return cdpClient;
}

async function evaluate(expression) {
  const client = mustHaveClient();
  const payload = await client.send("Runtime.evaluate", {
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

function json(value) {
  return JSON.stringify(value);
}

async function waitForDom(predicateExpression, description, timeoutMs = 30_000, intervalMs = 500) {
  return waitFor(async () => {
    return await evaluate(predicateExpression);
  }, description, timeoutMs, intervalMs);
}

async function domAction(actionExpression, description) {
  const ok = await evaluate(actionExpression);
  if (!ok) {
    throw new Error(`DOM action failed: ${description}`);
  }
}

function buttonClickExpression(labelText) {
  return `(() => {
    const normalize = (value) => String(value ?? "").replace(/\\s+/g, " ").trim();
    const button = [...document.querySelectorAll("button")].find((node) => normalize(node.textContent) === ${json(labelText)});
    if (!button) return false;
    button.click();
    return true;
  })()`;
}

function checkboxClickExpression(ariaLabel) {
  return `(() => {
    const checkbox = document.querySelector(${json(`input[type="checkbox"][aria-label="${ariaLabel}"]`)});
    if (!checkbox) return false;
    checkbox.click();
    return true;
  })()`;
}

function fillByLabelExpression(labelText, value) {
  return `(() => {
    const setValue = (field, nextValue) => {
      const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
      descriptor?.set?.call(field, nextValue);
    };
    const label = [...document.querySelectorAll("label")].find((node) => node.textContent?.includes(${json(labelText)}));
    const field = label?.querySelector("input, textarea");
    if (!field) return false;
    field.focus();
    setValue(field, ${json(value)});
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`;
}

function fillByPlaceholderExpression(placeholder, value) {
  return `(() => {
    const setValue = (field, nextValue) => {
      const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
      descriptor?.set?.call(field, nextValue);
    };
    const field = document.querySelector(${json(`[placeholder="${placeholder}"]`)});
    if (!field) return false;
    field.focus();
    setValue(field, ${json(value)});
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`;
}

function fieldValueByLabelExpression(labelText) {
  return `(() => {
    const label = [...document.querySelectorAll("label")].find((node) => node.textContent?.includes(${json(labelText)}));
    const field = label?.querySelector("input, textarea");
    return field ? field.value : null;
  })()`;
}

async function openWebClient() {
  await waitForDom(
    `(() => {
      return document.readyState !== "loading" &&
        [...document.querySelectorAll("button")].some((node) => node.textContent?.includes("会議を開始")) &&
        [...document.querySelectorAll("label")].some((node) => node.textContent?.includes("議題（ここを中心に議論）"));
    })()`,
    "browser setup screen",
    45_000,
    750
  );
}

async function addAgentFromSetup() {
  const agentName = `web-reviewer-${runId}`;
  const agentDescription = "Web parity の画面確認と E2E の補助を担当する。";
  const agentId = `web_reviewer_${runId}`;

  await domAction(buttonClickExpression("Agent 追加"), "open agent form");
  await waitForDom(
    `(() => [...document.querySelectorAll("label")].some((node) => node.textContent?.includes("Agent名")))()`,
    "agent form",
    10_000,
    500
  );

  await domAction(fillByLabelExpression("Agent名", agentName), "fill agent name");
  await domAction(fillByLabelExpression("Agent ID（任意）", agentId), "fill agent id");
  await domAction(fillByLabelExpression("役割説明", agentDescription), "fill agent description");
  await waitForDom(fieldValueByLabelExpression("Agent名"), "agent name field value", 5_000, 250);
  await waitForDom(fieldValueByLabelExpression("Agent ID（任意）"), "agent id field value", 5_000, 250);
  await domAction(buttonClickExpression("Agent を保存"), "save agent");

  await delay(500);
  const pageError = await evaluate(`(() => document.querySelector(".error-text")?.textContent?.trim() || "")()`);
  if (pageError) {
    throw new Error(`Agent save validation failed: ${pageError}`);
  }

  await waitFor(async () => {
    const payload = await daemonJson("/api/agents");
    return payload.agents.some((agent) => agent.id === agentId) ? payload : null;
  }, "saved agent in daemon", 20_000, 750);
}

async function startMeetingFromSetup({ meetingTopic = topic, bypassMode = false } = {}) {
  await domAction(fillByLabelExpression("議題（ここを中心に議論）", meetingTopic), "fill topic");
  if (bypassMode) {
    await domAction(buttonClickExpression("進行モード設定"), "open flow mode settings");
    await domAction(checkboxClickExpression("Bypass Mode"), "toggle bypass mode");
  }
  await domAction(buttonClickExpression("会議を開始"), "start meeting");

  await waitForDom(
    `(() => {
      return [...document.querySelectorAll("button")].some((node) => node.textContent?.includes("会議終了")) &&
        [...document.querySelectorAll("button")].some((node) => node.textContent?.includes("一時停止")) &&
        Boolean(document.querySelector('[placeholder="メッセージを入力..."]'));
    })()`,
    "meeting screen after start",
    45_000,
    750
  );

  return waitFor(() => currentMeetingIdByTitle(meetingTopic), "daemon session creation", 30_000, 750);
}

async function sendHumanMessageAndVerify(meetingId) {
  await domAction(fillByPlaceholderExpression("メッセージを入力...", humanMessage), "fill human message");
  await domAction(buttonClickExpression("送信"), "send human message");

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
  }, `${label} agent message in daemon session`, 120_000, 1_000);

  const expectedEntries = buildExpectedAgentEntries(view.messages);
  if (expectedEntries.length === 0) {
    throw new Error(`No renderable agent messages found for ${label}`);
  }

  await waitForDom(
    `(() => {
      const bubbles = [...document.querySelectorAll(".bubble.agent")];
      return bubbles.some((bubble) => {
        const sender = bubble.querySelector(".sender")?.textContent?.trim() || "";
        const body = bubble.querySelector(".bubble-body")?.textContent?.trim() || "";
        return sender.length > 0 && body.length > 0 && !/\\.jsonl$/i.test(body);
      });
    })()`,
    `${label} agent bubble in DOM`,
    120_000,
    1_000
  );

  await waitForDom(
    `(() => {
      const normalize = (value) => String(value ?? "").replace(/\\s+/g, " ").trim();
      const expectedEntries = ${json(expectedEntries)};
      const bubbles = [...document.querySelectorAll(".bubble.agent")].map((bubble) => ({
        sender: normalize(bubble.querySelector(".sender")?.textContent),
        body: normalize(bubble.querySelector(".bubble-body")?.textContent)
      }));
      return expectedEntries.every((expected) => bubbles.some((bubble) => {
        return bubble.sender === expected.sender && bubble.body.includes(expected.snippet);
      }));
    })()`,
    `${label} all agent messages in DOM`,
    120_000,
    1_000
  );
}

async function verifyPauseAndResume(meetingId) {
  await domAction(buttonClickExpression("一時停止"), "pause meeting");
  await waitFor(async () => {
    const view = await currentMeetingView(meetingId);
    return view.tab.status === "paused" ? view : null;
  }, "paused status", 30_000, 750);

  await domAction(buttonClickExpression("再開"), "resume meeting");
  await waitFor(async () => {
    const view = await currentMeetingView(meetingId);
    return view.tab.status === "running" ? view : null;
  }, "running status after resume", 30_000, 750);
}

async function verifyRecovery(meetingId) {
  logStep("stopping daemon for recovery check");
  await stopDaemon();
  await delay(1500);

  logStep("restarting daemon for recovery check");
  await startDaemon();

  await waitFor(async () => {
    const view = await currentMeetingView(meetingId);
    return view.tab.status === "recovering" ? view : null;
  }, "recovering status after daemon restart", 60_000, 1_000);

  await waitForDom(
    `(() => [...document.querySelectorAll("button")].some((node) => node.textContent?.includes("会議終了")))()`,
    "meeting screen after daemon restart",
    45_000,
    750
  );
}

async function endMeetingAndVerifyCleared() {
  await domAction(buttonClickExpression("会議終了"), "end meeting");

  await waitForDom(
    `(() => {
      return [...document.querySelectorAll("button")].some((node) => node.textContent?.includes("会議を開始")) &&
        [...document.querySelectorAll("label")].some((node) => node.textContent?.includes("議題（ここを中心に議論）"));
    })()`,
    "setup screen after end",
    30_000,
    750
  );

  await waitFor(async () => {
    const payload = await daemonJson("/api/sessions");
    return payload.sessions.length === 0 ? payload : null;
  }, "empty session list after end", 30_000, 750);

  await waitFor(() => {
    if (!fs.existsSync(summariesDir)) {
      return null;
    }
    const summaries = fs.readdirSync(summariesDir).filter((name) => name.endsWith(".md"));
    return summaries.length > 0 ? summaries : null;
  }, "saved meeting summary", 10_000, 500);
}

async function verifyBypassConversation() {
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
  logStep("starting daemon");
  await startDaemon({ resetState: true });

  try {
    logStep("launching Chrome and connecting via CDP");
    await launchChrome();

    logStep("waiting for browser setup screen");
    await openWebClient();

    logStep("starting a new meeting");
    const meetingId = await startMeetingFromSetup();
    logStep(`meeting started: ${meetingId}`);

    logStep("sending a human message");
    await sendHumanMessageAndVerify(meetingId);
    await verifyAgentConversation(meetingId, "normal");

    logStep("verifying pause and resume");
    await verifyPauseAndResume(meetingId);

    logStep("verifying daemon restart recovery");
    await verifyRecovery(meetingId);

    logStep("ending meeting and confirming cleanup");
    await endMeetingAndVerifyCleared();

    logStep("starting bypass mode meeting");
    await verifyBypassConversation();

    logStep("Web E2E passed");
  } finally {
    await stopChrome().catch(() => undefined);
    await stopDaemon().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(`[web-e2e] FAILED: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  void stopChrome()
    .catch(() => undefined)
    .finally(() => {
      void stopDaemon()
        .catch(() => undefined)
        .finally(() => {
          process.exitCode = 1;
        });
    });
});
