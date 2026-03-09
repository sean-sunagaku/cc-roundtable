import type {
  AgentProfileInputPayload,
  AgentProfilePayload,
  ChatMessagePayload,
  MeetingRoomDaemonAgentsResponse,
  MeetingRoomDaemonCommand,
  MeetingRoomDaemonCommandAck,
  MeetingRoomDaemonCommandEnvelope,
  MeetingRoomDaemonDefaultProjectDirResponse,
  MeetingRoomDaemonMetaPayload,
  MeetingRoomDaemonPickProjectDirResponse,
  MeetingRoomDaemonStreamFrame,
  MeetingSessionViewPayload,
  MeetingTabPayload
} from "@contracts/meeting-room-daemon";
import {
  MEETING_ROOM_DAEMON_AGENTS_PATH,
  MEETING_ROOM_DAEMON_COMMANDS_PATH,
  MEETING_ROOM_DAEMON_DEFAULT_PROJECT_DIR_PATH,
  MEETING_ROOM_DAEMON_EVENTS_PATH,
  MEETING_ROOM_DAEMON_META_PATH,
  MEETING_ROOM_DAEMON_PICK_PROJECT_DIR_PATH,
  MEETING_ROOM_DAEMON_SESSIONS_PATH
} from "@contracts/meeting-room-daemon";
import type { MeetingControlMode } from "@shared/ipc";
import type { MeetingRoomClient } from "@shared/meeting-room-client";
import type {
  AgentMessagePayload,
  AgentProfile,
  AgentProfileInput,
  ClaudeSessionDebug,
  MeetingRoomDaemonMeta,
  MeetingConfig,
  MeetingSessionView,
  MeetingSummaryPayload,
  MeetingTab,
  RuntimeEvent
} from "@shared/types";

const SESSION_DEBUG_SUFFIX = "/debug";
const RECONNECT_BACKOFF_MS = [500, 1000, 2000, 5000];

type RelayListener = (payload: AgentMessagePayload) => void;
type TabsListener = (tabs: MeetingTab[]) => void;
type RuntimeListener = (event: RuntimeEvent) => void;
type TerminalListener = (meetingId: string, chunk: string) => void;
type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "error";
type ConnectionListener = (state: ConnectionState, errorMessage?: string) => void;

interface Config {
  baseUrl: string;
  token: string;
}

export class BrowserMeetingRoomClient implements MeetingRoomClient {
  private config: Config;
  private streamAbortController: AbortController | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private shouldReconnect = false;
  private readonly relayListeners = new Set<RelayListener>();
  private readonly tabsListeners = new Set<TabsListener>();
  private readonly runtimeListeners = new Set<RuntimeListener>();
  private readonly terminalListeners = new Set<TerminalListener>();
  private readonly connectionListeners = new Set<ConnectionListener>();

  constructor(config?: Partial<Config>) {
    this.config = {
      baseUrl: (config?.baseUrl ?? window.location.origin).replace(/\/$/, ""),
      token: config?.token ?? ""
    };
  }

  configure(config: Partial<Config>): void {
    this.config = {
      baseUrl: (config.baseUrl ?? this.config.baseUrl).replace(/\/$/, ""),
      token: config.token ?? this.config.token
    };
  }

  getConfig(): Config {
    return { ...this.config };
  }

  async connect(): Promise<void> {
    this.shouldReconnect = true;
    this.reconnectAttempt = 0;
    this.notifyConnection("connecting");
    await this.getDaemonMeta();
    this.startEventStream();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.streamAbortController?.abort();
    this.streamAbortController = null;
    this.notifyConnection("idle");
  }

  dispose(): void {
    this.disconnect();
  }

  onConnectionState(handler: ConnectionListener): () => void {
    this.connectionListeners.add(handler);
    return () => {
      this.connectionListeners.delete(handler);
    };
  }

  async startMeeting(config: MeetingConfig): Promise<MeetingTab> {
    const ack = await this.dispatch({
      type: "startMeeting",
      meetingId: config.id,
      topic: config.topic,
      projectDir: config.projectDir,
      members: [...config.members],
      bypassMode: config.bypassMode
    });
    if (!ack.accepted) {
      throw new Error("Meeting start was rejected.");
    }
    const view = await this.getSessionView(config.id);
    if (view) {
      return view.tab;
    }
    return {
      id: config.id,
      title: config.topic,
      config,
      createdAt: new Date().toISOString(),
      status: "running"
    };
  }

  async endMeeting(meetingId: string): Promise<void> {
    const ack = await this.dispatch({
      type: "endMeeting",
      meetingId
    });
    if (!ack.accepted) {
      throw new Error("Meeting end was rejected.");
    }
  }

  async sendHumanMessage(meetingId: string, message: string): Promise<boolean> {
    const ack = await this.dispatch({
      type: "sendHumanMessage",
      meetingId,
      message
    });
    return ack.accepted;
  }

  async approveNextStep(meetingId: string): Promise<boolean> {
    const ack = await this.dispatch({
      type: "approveNextStep",
      meetingId
    });
    return ack.accepted;
  }

  async sendControlMessage(meetingId: string, mode: MeetingControlMode): Promise<void> {
    const ack = await this.dispatch({
      type: mode === "pause" ? "pauseMeeting" : "resumeMeeting",
      meetingId
    });
    if (!ack.accepted) {
      throw new Error(`${mode} command was rejected.`);
    }
  }

  async listAgents(): Promise<AgentProfile[]> {
    const payload = await this.request<MeetingRoomDaemonAgentsResponse>(MEETING_ROOM_DAEMON_AGENTS_PATH);
    return payload.agents.map(toAgentProfile);
  }

  async saveAgent(input: AgentProfileInput): Promise<AgentProfile> {
    const payload = await this.request<{ agent: AgentProfilePayload }>(MEETING_ROOM_DAEMON_AGENTS_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input satisfies AgentProfileInputPayload)
    });
    return toAgentProfile(payload.agent);
  }

  async listTabs(): Promise<MeetingTab[]> {
    const payload = await this.request<{ sessions: MeetingTabPayload[] }>(MEETING_ROOM_DAEMON_SESSIONS_PATH);
    return payload.sessions.map(toMeetingTab);
  }

  async defaultProjectDir(): Promise<string> {
    const payload = await this.request<MeetingRoomDaemonDefaultProjectDirResponse>(
      MEETING_ROOM_DAEMON_DEFAULT_PROJECT_DIR_PATH
    );
    return payload.defaultProjectDir;
  }

  async pickProjectDir(currentDir?: string): Promise<string | null> {
    const payload = await this.request<MeetingRoomDaemonPickProjectDirResponse>(
      MEETING_ROOM_DAEMON_PICK_PROJECT_DIR_PATH,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentDir })
      }
    );
    return payload.projectDir;
  }

  async saveSummary(_payload: MeetingSummaryPayload): Promise<string> {
    return "";
  }

  async retryMcp(meetingId: string): Promise<boolean> {
    const ack = await this.dispatch({
      type: "retryMcp",
      meetingId
    });
    return ack.accepted;
  }

  async getSessionDebug(meetingId: string): Promise<ClaudeSessionDebug> {
    const payload = await this.request<ClaudeSessionDebug>(
      `${MEETING_ROOM_DAEMON_SESSIONS_PATH}/${encodeURIComponent(meetingId)}${SESSION_DEBUG_SUFFIX}`
    );
    return payload;
  }

  async getSessionView(meetingId: string): Promise<MeetingSessionView | null> {
    try {
      const payload = await this.request<MeetingSessionViewPayload>(
        `${MEETING_ROOM_DAEMON_SESSIONS_PATH}/${encodeURIComponent(meetingId)}`
      );
      return toMeetingSessionView(payload);
    } catch (error) {
      if (error instanceof Error && /404/.test(error.message)) {
        return null;
      }
      throw error;
    }
  }

  async getDaemonMeta(): Promise<MeetingRoomDaemonMeta> {
    const payload = await this.request<MeetingRoomDaemonMetaPayload>(MEETING_ROOM_DAEMON_META_PATH);
    return {
      accessPolicy: {
        ...payload.accessPolicy
      },
      reconnectPolicy: {
        strategy: payload.reconnectPolicy.strategy,
        backoffMs: [...payload.reconnectPolicy.backoffMs],
        snapshotRequired: payload.reconnectPolicy.snapshotRequired
      },
      browserClientPath: payload.browserClientPath
    };
  }

  async resizeTerminal(meetingId: string, cols: number, rows: number): Promise<void> {
    await this.dispatch({
      type: "resizeTerminal",
      meetingId,
      cols,
      rows
    });
  }

  async writeTerminal(meetingId: string, data: string): Promise<boolean> {
    const ack = await this.dispatch({
      type: "writeTerminal",
      meetingId,
      data
    });
    return ack.accepted;
  }

  onTerminalData(handler: TerminalListener): () => void {
    this.terminalListeners.add(handler);
    return () => {
      this.terminalListeners.delete(handler);
    };
  }

  onRelayMessage(handler: RelayListener): () => void {
    this.relayListeners.add(handler);
    return () => {
      this.relayListeners.delete(handler);
    };
  }

  onTabsUpdate(handler: TabsListener): () => void {
    this.tabsListeners.add(handler);
    return () => {
      this.tabsListeners.delete(handler);
    };
  }

  onRuntimeEvent(handler: RuntimeListener): () => void {
    this.runtimeListeners.add(handler);
    return () => {
      this.runtimeListeners.delete(handler);
    };
  }

  async openSessionDebugWindow(meetingId: string): Promise<boolean> {
    const url = new URL(window.location.href);
    url.searchParams.set("debugWindow", "1");
    url.searchParams.set("meetingId", meetingId);
    const child = window.open(url.toString(), "_blank", "popup=yes,width=960,height=720");
    return Boolean(child);
  }

  private headers(extra: HeadersInit = {}): HeadersInit {
    if (!this.config.token) {
      return extra;
    }
    return {
      ...extra,
      Authorization: `Bearer ${this.config.token}`
    };
  }

  private async request<T>(requestPath: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${requestPath}`, {
      ...init,
      headers: this.headers(init.headers ?? {}),
      cache: "no-store"
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${response.status} ${body}`);
    }
    return response.json() as Promise<T>;
  }

  private async dispatch(command: MeetingRoomDaemonCommand): Promise<MeetingRoomDaemonCommandAck> {
    const envelope: MeetingRoomDaemonCommandEnvelope = {
      commandId: `web_${Date.now()}`,
      sentAt: new Date().toISOString(),
      command
    };
    const response = await fetch(`${this.config.baseUrl}${MEETING_ROOM_DAEMON_COMMANDS_PATH}`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(envelope),
      cache: "no-store"
    });
    const payload = (await response.json()) as MeetingRoomDaemonCommandAck | { error: string };
    if (!response.ok && response.status !== 409) {
      throw new Error("error" in payload ? payload.error : `Command failed with ${response.status}`);
    }
    if ("accepted" in payload) {
      return payload;
    }
    throw new Error(payload.error);
  }

  private startEventStream(): void {
    this.streamAbortController?.abort();
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const controller = new AbortController();
    this.streamAbortController = controller;
    void this.consumeEventStream(controller.signal);
  }

  private async consumeEventStream(signal: AbortSignal): Promise<void> {
    try {
      const streamUrl = new URL(MEETING_ROOM_DAEMON_EVENTS_PATH, this.config.baseUrl);
      if (this.config.token) {
        streamUrl.searchParams.set("token", this.config.token);
      }
      const response = await fetch(streamUrl, {
        headers: this.headers({ Accept: "text/event-stream" }),
        cache: "no-store",
        signal
      });
      if (!response.ok || !response.body) {
        throw new Error(`SSE ${response.status}`);
      }
      this.notifyConnection("connected");
      this.reconnectAttempt = 0;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const raw = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const dataLines = raw
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim());
          if (dataLines.length > 0) {
            const frame = JSON.parse(dataLines.join("\n")) as MeetingRoomDaemonStreamFrame;
            void this.handleFrame(frame);
          }
          boundary = buffer.indexOf("\n\n");
        }
      }

      if (!signal.aborted) {
        this.scheduleReconnect("SSE closed");
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }
      this.scheduleReconnect(error instanceof Error ? error.message : String(error));
    }
  }

  private scheduleReconnect(errorMessage: string): void {
    if (!this.shouldReconnect) {
      this.notifyConnection("error", errorMessage);
      return;
    }
    if (this.reconnectTimer !== null) {
      return;
    }

    this.notifyConnection("reconnecting", errorMessage);
    const waitMs = RECONNECT_BACKOFF_MS[Math.min(this.reconnectAttempt, RECONNECT_BACKOFF_MS.length - 1)];
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.startEventStream();
    }, waitMs);
  }

  private async handleFrame(frame: MeetingRoomDaemonStreamFrame): Promise<void> {
    const event = frame.event;
    switch (event.type) {
      case "meeting.started":
      case "meeting.ended":
      case "session.view.updated": {
        const tabs = await this.listTabs();
        for (const listener of this.tabsListeners) {
          listener(tabs);
        }
        return;
      }
      case "message.received": {
        const message = event.payload.message;
        if (message.source !== "agent") {
          return;
        }
        const payload: AgentMessagePayload = {
          type: "agent_message",
          id: message.id,
          sender: message.sender,
          subagent: message.subagent,
          content: message.content,
          timestamp: message.timestamp,
          team: message.team ?? "daemon",
          meetingId: event.meetingId
        };
        for (const listener of this.relayListeners) {
          listener(payload);
        }
        return;
      }
      case "agent.status_changed": {
        const payload: AgentMessagePayload = {
          type: "agent_status",
          id: `status_${event.eventId}`,
          sender: event.payload.sender,
          content: "",
          timestamp: event.emittedAt,
          team: "daemon",
          status: event.payload.status,
          meetingId: event.meetingId
        };
        for (const listener of this.relayListeners) {
          listener(payload);
        }
        return;
      }
      case "runtime.warning":
      case "runtime.error": {
        const runtimeEvent = toRuntimeEvent(event.payload.runtimeEvent);
        for (const listener of this.runtimeListeners) {
          listener(runtimeEvent);
        }
        return;
      }
      case "terminal.chunk":
        for (const listener of this.terminalListeners) {
          listener(event.meetingId, event.payload.chunk);
        }
        return;
      default:
        return;
    }
  }

  private notifyConnection(state: ConnectionState, errorMessage?: string): void {
    for (const listener of this.connectionListeners) {
      listener(state, errorMessage);
    }
  }
}

function toAgentProfile(profile: AgentProfilePayload): AgentProfile {
  return {
    id: profile.id,
    name: profile.name,
    description: profile.description,
    enabledByDefault: profile.enabledByDefault,
    source: profile.source
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
      members: [...tab.config.members],
      bypassMode: Boolean(tab.config.bypassMode)
    },
    createdAt: tab.createdAt,
    status: tab.status
  };
}

function toChatMessage(message: ChatMessagePayload) {
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

function toRuntimeEvent(event: RuntimeEvent): RuntimeEvent {
  return {
    meetingId: event.meetingId,
    type: event.type,
    message: event.message,
    timestamp: event.timestamp
  };
}

function toMeetingSessionView(view: MeetingSessionViewPayload): MeetingSessionView {
  const approvalGate = view.approvalGate ?? {
    mode: "open" as const,
    bypassMode: false,
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
    sessionDebug: {
      meetingId: view.sessionDebug.meetingId,
      tail: [...view.sessionDebug.tail],
      hasUsageLimit: view.sessionDebug.hasUsageLimit,
      hasMcpError: view.sessionDebug.hasMcpError,
      lastUpdatedAt: view.sessionDebug.lastUpdatedAt
    },
    approvalGate: {
      mode: approvalGate.mode,
      bypassMode: Boolean(approvalGate.bypassMode),
      reason: approvalGate.reason,
      updatedAt: approvalGate.updatedAt
    }
  };
}
