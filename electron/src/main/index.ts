import path from "node:path";
import fs from "node:fs";
import { app, BrowserWindow, ipcMain } from "electron";
import { PtyManager } from "./pty-manager";
import { RelayServer } from "./ws-server";
import { MeetingService } from "./meeting";
import type {
  AgentMessagePayload,
  AgentProfileInput,
  ClaudeSessionDebug,
  MeetingConfig,
  MeetingSummaryPayload
} from "@shared/types";

let mainWindow: BrowserWindow | null = null;
let sessionDebugWindow: BrowserWindow | null = null;
const runtimeEventDebounce = new Map<string, number>();
const ptyTailByMeeting = new Map<string, string[]>();
const ptyLineBufferByMeeting = new Map<string, string>();
const fallbackRelayByMeeting = new Map<string, string>();
const ptyTailMaxLines = 120;
const ptyManager = new PtyManager();
const relayServer = new RelayServer();
const meetingService = new MeetingService(ptyManager, (channel, payload) => {
  if (mainWindow) {
    mainWindow.webContents.send(channel, payload);
  }
});

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: "#0b1119",
    webPreferences: {
      preload: path.resolve(__dirname, "preload.js"),
      contextIsolation: true
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    const indexHtml = path.resolve(__dirname, "../renderer/index.html");
    void mainWindow.loadFile(indexHtml);
  }

  meetingService.attachWindow(mainWindow);
}

function registerIpc(): void {
  ipcMain.handle("meeting:start", (_event, config: MeetingConfig) => meetingService.startMeeting(config));
  ipcMain.handle("meeting:end", (_event, meetingId: string) => {
    meetingService.endMeeting(meetingId);
  });
  ipcMain.handle("meeting:human-message", (_event, meetingId: string, message: string) => {
    return meetingService.sendHumanMessage(meetingId, message);
  });
  ipcMain.handle(
    "meeting:control-message",
    (_event, meetingId: string, mode: "pause" | "resume" | "end" | "settings", extra?: string) => {
      if (mode === "end") {
        meetingService.sendControlPrompt(meetingId, "end");
        meetingService.endMeeting(meetingId);
        return;
      }
      meetingService.sendControlPrompt(meetingId, mode, extra);
    }
  );
  ipcMain.handle("meeting:list-skills", () => meetingService.listSkills());
  ipcMain.handle("meeting:list-agents", () => meetingService.listAgentProfiles());
  ipcMain.handle("meeting:save-agent", (_event, input: AgentProfileInput) => meetingService.saveAgentProfile(input));
  ipcMain.handle("meeting:list-tabs", () => meetingService.listTabs());
  ipcMain.handle("meeting:default-project-dir", () => meetingService.defaultProjectDir());
  ipcMain.handle("meeting:save-summary", (_event, payload: MeetingSummaryPayload) =>
    meetingService.saveMeetingSummary(payload)
  );
  ipcMain.handle("meeting:retry-mcp", (_event, meetingId: string) => meetingService.retryMcp(meetingId));
  ipcMain.handle("meeting:resize-terminal", (_event, meetingId: string, cols: number, rows: number) => {
    ptyManager.resize(meetingId, cols, rows);
  });
  ipcMain.handle("meeting:terminal-write", (_event, meetingId: string, data: string) => {
    return ptyManager.write(meetingId, data);
  });
  ipcMain.handle("meeting:get-session-debug", (_event, meetingId: string): ClaudeSessionDebug => {
    const tail = ptyTailByMeeting.get(meetingId) ?? [];
    const joined = tail.join("\n");
    return {
      meetingId,
      tail,
      hasUsageLimit: isUsageLimitReached(joined),
      hasMcpError: hasMcpFailureSignal(joined),
      lastUpdatedAt: tail.length > 0 ? new Date().toISOString() : undefined
    };
  });
  ipcMain.handle("app:open-devtools", () => {
    if (!mainWindow) return false;
    if (!mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    } else {
      mainWindow.webContents.focus();
    }
    return true;
  });
  ipcMain.handle("meeting:open-session-debug-window", (_event, meetingId: string) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    if (sessionDebugWindow && !sessionDebugWindow.isDestroyed()) {
      sessionDebugWindow.close();
    }
    sessionDebugWindow = new BrowserWindow({
      width: 900,
      height: 680,
      minWidth: 700,
      minHeight: 500,
      backgroundColor: "#0b1119",
      title: `Claude Session Debug - ${meetingId}`,
      webPreferences: {
        preload: path.resolve(__dirname, "preload.js"),
        contextIsolation: true
      }
    });
    if (devUrl) {
      void sessionDebugWindow.loadURL(
        `${devUrl}?debugWindow=1&meetingId=${encodeURIComponent(meetingId)}`
      );
    } else {
      const indexHtml = path.resolve(__dirname, "../renderer/index.html");
      void sessionDebugWindow.loadFile(indexHtml, {
        query: {
          debugWindow: "1",
          meetingId
        }
      });
    }
    return true;
  });
}

function stripAnsi(input: string): string {
  return input.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "").replace(/\u001b\][^\u0007]*\u0007/g, "");
}

function extractUsagePercent(text: string): number | null {
  const match = text.match(/used\s+(\d+)%/i);
  if (!match) return null;
  const percent = Number.parseInt(match[1], 10);
  if (Number.isNaN(percent)) return null;
  return percent;
}

function isUsageLimitReached(text: string): boolean {
  if (/usage limit reached|weekly limit reached|limit has been reached/i.test(text)) {
    return true;
  }
  const percent = extractUsagePercent(text);
  return percent !== null && percent >= 100;
}

function isMcpStatusBadge(line: string): boolean {
  const compact = line.replace(/\s+/g, " ").trim();
  if (!compact) return false;
  if (!/\bmcp server failed\b/i.test(compact)) return false;
  if (!/\/mcp\b/i.test(compact)) return false;
  return /[·•]/.test(compact) || /\b\d+\s+mcp server failed\b/i.test(compact) || /\bmanage mcp servers\b/i.test(compact);
}

function hasMcpFailureSignal(text: string): boolean {
  const normalized = stripAnsi(text).replace(/\u0007/g, "");
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.some((line) => /mcp server failed/i.test(line) && !isMcpStatusBadge(line));
}

function shouldKeepTailLine(line: string): boolean {
  const compact = line.replace(/\s+/g, " ").trim();
  if (!compact) return false;
  if (/^[✢✳✶✻✽·⠂⠐⠒⠲⠴⠦⠧⠇⠋⠙⠸⏺]+$/.test(compact)) return false;
  if (/^\d+$/.test(compact)) return false;
  if (/^[a-zA-Z]$/.test(compact)) return false;
  return true;
}

function collectTailLines(meetingId: string, chunk: string): string[] {
  const text = stripAnsi(chunk).replace(/\u0007/g, "");
  let pending = ptyLineBufferByMeeting.get(meetingId) ?? "";
  const lines: string[] = [];

  for (const ch of text) {
    if (ch === "\r") {
      pending = "";
      continue;
    }
    if (ch === "\n") {
      const line = pending.trimEnd();
      if (shouldKeepTailLine(line)) {
        lines.push(line);
      }
      pending = "";
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code < 32 && ch !== "\t") {
      continue;
    }
    pending += ch;
    if (pending.length > 4000) {
      pending = pending.slice(-4000);
    }
  }

  ptyLineBufferByMeeting.set(meetingId, pending);
  return lines;
}

function isFallbackAgentLine(line: string): boolean {
  const compact = line.replace(/\s+/g, " ").trim();
  if (!compact) return false;
  if (compact.length < 6) return false;
  if (/^[/\\]/.test(compact)) return false;
  if (/^chore|^scampering|^calculating/i.test(compact)) return false;
  if (/tokens|thinking|ctrl\+g|weekly limit|mcp server failed|use skill/i.test(compact)) return false;
  if (/チームに\s*broadcast\s*してください/i.test(compact)) return false;
  if (/bypass permissions/i.test(compact)) return false;
  if (/^Pondering|^ClaudeAPI$/i.test(compact)) return false;
  if (/^resets \d+pm|^\d+ MCP server failed/i.test(compact)) return false;
  return true;
}

/** Extract Claude Code TUI response from chunk (responses often lack trailing newline, use cursor codes instead) */
function extractClaudeResponsesFromChunk(cleaned: string): string[] {
  const results: string[] = [];
  const seen = new Set<string>();
  const add = (s: string): void => {
    const c = s.replace(/\s+/g, " ").trim();
    if (c.length >= 8 && isFallbackAgentLine(c) && !seen.has(c)) {
      seen.add(c);
      results.push(c);
    }
  };
  const markerRe = /[⏺✳✶✢✻✽✿·]\s*([^\r\n]+?)(?=[\r\n]|─{2,}|❯\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(cleaned)) !== null) add(m[1]);
  const indentRe = /\s{2,}([^\r\n⏺✳✶✢✻✽✿·❯─\s][^\r\n⏺✳✶✢✻✽✿·❯─]*?)(?=[\r\n]|─{2,}|❯\s|[⏺✳✶✢✻✽✿·]|\s{4,}|$)/g;
  while ((m = indentRe.exec(cleaned)) !== null) add(m[1]);
  return results;
}

function emitRuntimeEvent(meetingId: string, type: "usage_limit" | "mcp_error" | "mcp_info", message: string): void {
  if (!mainWindow) return;
  const key = `${meetingId}:${type}:${message}`;
  const now = Date.now();
  const last = runtimeEventDebounce.get(key) ?? 0;
  if (now - last < 10_000) return;
  runtimeEventDebounce.set(key, now);

  mainWindow.webContents.send("meeting:runtime-event", {
    meetingId,
    type,
    message,
    timestamp: new Date().toISOString()
  });
}

app.whenReady().then(() => {
  createWindow();
  registerIpc();

  relayServer.start(9999);
  relayServer.onRelay((payload) => meetingService.relayAgentMessage(payload));
  ptyManager.on("data", (meetingId: string, data: string) => {
    if (!mainWindow) return;
    mainWindow.webContents.send("terminal:data", meetingId, data);
    const cleaned = stripAnsi(data).replace(/\u0007/g, "");
    const lines = collectTailLines(meetingId, data);
    const meetingTab = meetingService.listTabs().find((tab) => tab.id === meetingId);
    const relayFallback = (compact: string): void => {
      const lastRelayed = fallbackRelayByMeeting.get(meetingId);
      if (lastRelayed === compact) return;
      fallbackRelayByMeeting.set(meetingId, compact);
      meetingService.relayAgentMessage({
        type: "agent_message",
        id: `fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        sender: "leader",
        content: compact,
        timestamp: new Date().toISOString(),
        team: meetingTab?.config.skill ?? "terminal-fallback",
        meetingId
      });
    };
    for (const content of extractClaudeResponsesFromChunk(cleaned)) {
      relayFallback(content);
    }
    if (lines.length > 0) {
      const prev = ptyTailByMeeting.get(meetingId) ?? [];
      const next = [...prev, ...lines].slice(-ptyTailMaxLines);
      ptyTailByMeeting.set(meetingId, next);
      for (const line of lines) {
        if (!isFallbackAgentLine(line)) continue;
        const compact = line.replace(/\s+/g, " ").trim();
        if (!compact) continue;
        relayFallback(compact);
      }
    }
    if (isUsageLimitReached(cleaned)) {
      emitRuntimeEvent(meetingId, "usage_limit", "Claude利用上限に到達しています。");
    }
    if (hasMcpFailureSignal(cleaned)) {
      emitRuntimeEvent(meetingId, "mcp_error", "MCP server failed を検出しました。");
    }
    if (/\/mcp/i.test(cleaned) && /(connected|running|available|ok)/i.test(cleaned)) {
      emitRuntimeEvent(meetingId, "mcp_info", "MCP接続が回復した可能性があります。");
    }
    try {
      const logPath = path.resolve(process.cwd(), "..", ".claude/meeting-room/pty.log");
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      fs.appendFileSync(logPath, `[${new Date().toISOString()}][${meetingId}] ${data}`, "utf-8");
    } catch {
      // Best effort debug log.
    }
  });
  ptyManager.on("exit", (meetingId: string, exitCode: number) => {
    if (!mainWindow) return;
    ptyLineBufferByMeeting.delete(meetingId);
    fallbackRelayByMeeting.delete(meetingId);
    mainWindow.webContents.send("terminal:data", meetingId, `\n[pty exited: ${exitCode}]\n`);
  });
});

app.on("window-all-closed", () => {
  ptyManager.stopAll();
  relayServer.close();
  if (sessionDebugWindow && !sessionDebugWindow.isDestroyed()) {
    sessionDebugWindow.close();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
