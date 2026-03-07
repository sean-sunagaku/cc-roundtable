import path from "node:path";
import { app, BrowserWindow, dialog } from "electron";
import type { OpenDialogOptions } from "electron";
// #region agent log
function _dbg(msg: string, data: Record<string, unknown>, hyp: string): void {
  fetch("http://127.0.0.1:7575/ingest/4b7c5fce-7a91-463a-ba06-c308da61067f", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8a3767" },
    body: JSON.stringify({
      sessionId: "8a3767",
      location: "index.ts",
      message: msg,
      data,
      hypothesisId: hyp,
      timestamp: Date.now()
    })
  }).catch(() => {});
}
// #endregion
import type { MainInvokeArgs, MainInvokeChannel, MainInvokeResult } from "@shared/ipc";
import type {
  AgentMessagePayload,
  ChatMessage,
  ClaudeSessionDebug,
  MeetingRoomDaemonMeta,
  MeetingSessionView,
  MeetingTab,
  RuntimeEvent
} from "@shared/types";
import type {
  ChatMessagePayload,
  MeetingRoomDaemonCommand,
  MeetingRoomDaemonMetaPayload,
  MeetingRoomDaemonStreamFrame,
  MeetingSessionViewPayload,
  MeetingTabPayload
} from "../../../packages/shared-contracts/src/meeting-room-daemon";
import { MainIpcRouter } from "./ipc-router";
import { MeetingService } from "./meeting";
import { PtyManager } from "./pty-manager";
import { MeetingRoomDaemonManager } from "./daemon";

let mainWindow: BrowserWindow | null = null;
let sessionDebugWindow: BrowserWindow | null = null;
let daemonReadyPromise: Promise<void> | null = null;
const helperMeetingService = new MeetingService(new PtyManager());
const ipcRouter = new MainIpcRouter(() => mainWindow);
const daemonManager = new MeetingRoomDaemonManager({
  onStdout: (chunk) => {
    const line = chunk.trim();
    if (line) {
      console.info(`[meeting-room-daemon] ${line}`);
    }
  },
  onStderr: (chunk) => {
    const line = chunk.trim();
    if (line) {
      console.warn(`[meeting-room-daemon] ${line}`);
    }
  },
  onExit: () => {
    daemonReadyPromise = null;
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
    return;
  }

  const indexHtml = path.resolve(__dirname, "../renderer/index.html");
  void mainWindow.loadFile(indexHtml);
}

type MaybePromise<T> = T | Promise<T>;

function handleIpc<C extends MainInvokeChannel>(
  channel: C,
  handler: (...args: MainInvokeArgs<C>) => MaybePromise<MainInvokeResult<C>>
): void {
  ipcRouter.handle(channel, handler);
}

function registerIpc(): void {
  handleIpc("meeting:start", async (config) => {
    await dispatchDaemonCommand({
      type: "startMeeting",
      meetingId: config.id,
      topic: config.topic,
      projectDir: config.projectDir,
      members: config.members,
      initPrompt: helperMeetingService.buildInitPrompt(config)
    });

    const view = await daemonManager.getSessionView(config.id);
    void refreshTabsFromDaemon();
    return view ? toMeetingTab(view.tab) : {
      id: config.id,
      title: config.topic,
      config,
      createdAt: new Date().toISOString(),
      status: "running"
    };
  });

  handleIpc("meeting:end", async (meetingId) => {
    await dispatchDaemonCommand({
      type: "endMeeting",
      meetingId
    });
    void refreshTabsFromDaemon();
  });

  handleIpc("meeting:human-message", async (meetingId, message) => {
    const ack = await dispatchDaemonCommand({
      type: "sendHumanMessage",
      meetingId,
      message
    });
    return ack.accepted;
  });

  handleIpc("meeting:approve-next-step", async (meetingId) => {
    const ack = await dispatchDaemonCommand({
      type: "approveNextStep",
      meetingId
    });
    return ack.accepted;
  });

  handleIpc("meeting:control-message", async (meetingId, mode) => {
    if (mode === "pause") {
      await dispatchDaemonCommand({
        type: "pauseMeeting",
        meetingId
      });
      return;
    }
    if (mode === "resume") {
      await dispatchDaemonCommand({
        type: "resumeMeeting",
        meetingId
      });
      return;
    }
  });

  handleIpc("meeting:list-agents", () => helperMeetingService.listAgentProfiles());
  handleIpc("meeting:save-agent", (input) => helperMeetingService.saveAgentProfile(input));
  handleIpc("meeting:list-tabs", async () => refreshTabsFromDaemon());
  handleIpc("meeting:default-project-dir", () => helperMeetingService.defaultProjectDir());
  handleIpc("meeting:pick-project-dir", async (currentDir) => {
    const options: OpenDialogOptions = {
      title: "Select project directory",
      defaultPath: currentDir || helperMeetingService.defaultProjectDir(),
      properties: ["openDirectory", "createDirectory"]
    };
    const selection = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);
    if (selection.canceled) {
      return null;
    }
    return selection.filePaths[0] ?? null;
  });
  handleIpc("meeting:save-summary", (payload) => helperMeetingService.saveMeetingSummary(payload));

  handleIpc("meeting:retry-mcp", async (meetingId) => {
    const ack = await dispatchDaemonCommand({
      type: "retryMcp",
      meetingId
    });
    return ack.accepted;
  });

  handleIpc("meeting:resize-terminal", async (meetingId, cols, rows) => {
    try {
      await dispatchDaemonCommand({
        type: "resizeTerminal",
        meetingId,
        cols,
        rows
      });
    } catch (error) {
      if (!isRejectedDaemonCommandError(error)) {
        throw error;
      }
    }
  });

  handleIpc("meeting:terminal-write", async (meetingId, data) => {
    try {
      const ack = await dispatchDaemonCommand({
        type: "writeTerminal",
        meetingId,
        data
      });
      return ack.accepted;
    } catch (error) {
      if (isRejectedDaemonCommandError(error)) {
        return false;
      }
      throw error;
    }
  });

  handleIpc("meeting:get-session-debug", async (meetingId) => {
    await ensureDaemonConnected();
    const view = await daemonManager.getSessionView(meetingId);
    return view ? toClaudeSessionDebug(view.sessionDebug) : emptySessionDebug(meetingId);
  });

  handleIpc("meeting:get-session-view", async (meetingId) => {
    await ensureDaemonConnected();
    const view = await daemonManager.getSessionView(meetingId);
    return view ? toMeetingSessionView(view) : null;
  });

  handleIpc("meeting:get-daemon-meta", async () => {
    await ensureDaemonConnected();
    const meta = await daemonManager.getMeta();
    return toMeetingRoomDaemonMeta(meta);
  });

  handleIpc("app:open-devtools", () => {
    if (!mainWindow) return false;
    if (!mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    } else {
      mainWindow.webContents.focus();
    }
    return true;
  });

  handleIpc("meeting:open-session-debug-window", (meetingId) => {
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
      return true;
    }

    const indexHtml = path.resolve(__dirname, "../renderer/index.html");
    void sessionDebugWindow.loadFile(indexHtml, {
      query: {
        debugWindow: "1",
        meetingId
      }
    });
    return true;
  });
}

async function ensureDaemonConnected(): Promise<void> {
  if (!daemonReadyPromise) {
    daemonReadyPromise = (async () => {
      await daemonManager.start();
      await daemonManager.subscribe((frame) => {
        bridgeDaemonFrame(frame);
      });
      const tabs = await loadTabsFromDaemon();
      ipcRouter.send("meeting:tabs", tabs);
    })().catch((error: unknown) => {
      daemonReadyPromise = null;
      throw error;
    });
  }
  return daemonReadyPromise;
}

async function dispatchDaemonCommand(command: MeetingRoomDaemonCommand) {
  await ensureDaemonConnected();
  return daemonManager.dispatch(daemonManager.createEnvelope(command));
}

function isRejectedDaemonCommandError(error: unknown): boolean {
  return error instanceof Error && /Command request failed with 409:/.test(error.message);
}

async function refreshTabsFromDaemon(): Promise<MeetingTab[]> {
  try {
    await ensureDaemonConnected();
    const tabs = await loadTabsFromDaemon();
    ipcRouter.send("meeting:tabs", tabs);
    return tabs;
  } catch (error) {
    console.warn("[meeting-room-daemon] list tabs failed", error);
    return [];
  }
}

async function loadTabsFromDaemon(): Promise<MeetingTab[]> {
  return (await daemonManager.listSessions()).map(toMeetingTab);
}

function bridgeDaemonFrame(frame: MeetingRoomDaemonStreamFrame): void {
  const event = frame.event;

  switch (event.type) {
    case "meeting.started":
    case "meeting.ended":
    case "session.view.updated":
      void refreshTabsFromDaemon();
      return;
    case "message.received": {
      const message = event.payload.message;
      if (message.source !== "agent") {
        return;
      }
      ipcRouter.send("meeting:agent-message", toAgentMessagePayload(event.meetingId, message));
      return;
    }
    case "agent.status_changed":
      ipcRouter.send("meeting:agent-message", {
        type: "agent_status",
        id: `status_${event.eventId}`,
        sender: event.payload.sender,
        content: "",
        timestamp: event.emittedAt,
        team: "daemon",
        status: event.payload.status,
        meetingId: event.meetingId
      });
      return;
    case "runtime.warning":
      ipcRouter.send("meeting:runtime-event", toRuntimeEvent(event.payload.runtimeEvent));
      return;
    case "runtime.error":
      ipcRouter.send("meeting:runtime-event", toRuntimeEvent(event.payload.runtimeEvent));
      return;
    case "terminal.chunk":
      ipcRouter.send("terminal:data", event.meetingId, event.payload.chunk);
      return;
    default:
      _dbg("ignored daemon event", { type: (event as { type: string }).type }, "DAEMON_EVT");
  }
}

function toAgentMessagePayload(meetingId: string, message: ChatMessagePayload): AgentMessagePayload {
  return {
    type: "agent_message",
    id: message.id,
    sender: message.sender,
    subagent: message.subagent,
    content: message.content,
    timestamp: message.timestamp,
    team: message.team ?? "daemon",
    meetingId
  };
}

function toRuntimeEvent(event: RuntimeEvent): RuntimeEvent {
  return {
    meetingId: event.meetingId,
    type: event.type,
    message: event.message,
    timestamp: event.timestamp
  };
}

function toMeetingTab(tab: MeetingTabPayload): MeetingTab {
  return {
    id: tab.id,
    title: tab.title,
    config: {
      id: tab.config.id,
      topic: tab.config.topic,
      projectDir: tab.config.projectDir,
      members: [...tab.config.members]
    },
    createdAt: tab.createdAt,
    status: tab.status
  };
}

function toChatMessage(message: ChatMessagePayload): ChatMessage {
  return {
    id: message.id,
    sender: message.sender,
    subagent: message.subagent,
    content: message.content,
    timestamp: message.timestamp,
    team: message.team,
    status: message.status,
    source: message.source
  };
}

function toClaudeSessionDebug(debug: MeetingSessionViewPayload["sessionDebug"]): ClaudeSessionDebug {
  return {
    meetingId: debug.meetingId,
    tail: [...debug.tail],
    hasUsageLimit: debug.hasUsageLimit,
    hasMcpError: debug.hasMcpError,
    lastUpdatedAt: debug.lastUpdatedAt
  };
}

function toMeetingSessionView(view: MeetingSessionViewPayload): MeetingSessionView {
  const approvalGate = view.approvalGate ?? {
    mode: "open" as const,
    updatedAt: new Date(0).toISOString()
  };
  return {
    tab: toMeetingTab(view.tab),
    messages: view.messages.map(toChatMessage),
    agentStatuses: { ...view.agentStatuses },
    runtimeEvents: view.runtimeEvents.map(toRuntimeEvent),
    health: {
      ...view.health
    },
    sessionDebug: toClaudeSessionDebug(view.sessionDebug),
    approvalGate: {
      mode: approvalGate.mode,
      reason: approvalGate.reason,
      updatedAt: approvalGate.updatedAt
    }
  };
}

function toMeetingRoomDaemonMeta(meta: MeetingRoomDaemonMetaPayload): MeetingRoomDaemonMeta {
  return {
    accessPolicy: {
      ...meta.accessPolicy
    },
    reconnectPolicy: {
      strategy: meta.reconnectPolicy.strategy,
      backoffMs: [...meta.reconnectPolicy.backoffMs],
      snapshotRequired: meta.reconnectPolicy.snapshotRequired
    },
    browserClientPath: meta.browserClientPath
  };
}

function emptySessionDebug(meetingId: string): ClaudeSessionDebug {
  return {
    meetingId,
    tail: [],
    hasUsageLimit: false,
    hasMcpError: false,
    lastUpdatedAt: undefined
  };
}

app.whenReady().then(() => {
  createWindow();
  registerIpc();
  void ensureDaemonConnected().catch((error) => {
    console.warn("[meeting-room-daemon] startup failed", error);
  });
});

app.on("window-all-closed", () => {
  void daemonManager.dispose().catch((error) => {
    console.warn("[meeting-room-daemon] shutdown failed", error);
  });
  if (sessionDebugWindow && !sessionDebugWindow.isDestroyed()) {
    sessionDebugWindow.close();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
