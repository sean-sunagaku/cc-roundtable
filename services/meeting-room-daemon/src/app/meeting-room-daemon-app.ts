import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  ApprovalGatePayload,
  AgentStatusChangedEvent,
  ChatMessagePayload,
  ClaudeSessionDebugPayload,
  DaemonAccessPolicyPayload,
  DaemonReconnectPolicyPayload,
  MeetingConfigPayload,
  MeetingEndedEvent,
  MeetingRoomDaemonCommand,
  MeetingRoomDaemonCommandAck,
  MeetingRoomDaemonCommandEnvelope,
  MeetingRoomDaemonEvent,
  MeetingRoomDaemonMetaPayload,
  MeetingSessionViewPayload,
  MeetingStartedEvent,
  MeetingTabPayload,
  MessageReceivedEvent,
  RuntimeErrorEvent,
  RuntimeEventPayload,
  RuntimeWarningEvent,
  SessionViewUpdatedEvent,
  TerminalChunkEvent
} from "@contracts/meeting-room-daemon";
import {
  ACTIVE_FLAG_RELATIVE_PATH,
  APPROVAL_STATE_RELATIVE_DIR,
  SESSION_VIEW_UPDATED_EVENT,
  WEB_ROOT_PREFIX
} from "../constants";
import { DaemonEventStream } from "../events/daemon-event-stream";
import { HooksRelayReceiver } from "../relay/hooks-relay-receiver";
import {
  hasClaudeReadySignal,
  hasMcpFailureSignal,
  shouldDisplayAgentMessageContent,
  isUsageLimitReached,
  stripAnsi
} from "../runtime/terminal-utils";
import { MeetingRuntimeManager } from "../runtime/meeting-runtime-manager";
import { MeetingSessionStore } from "../sessions/meeting-session-store";
import type { RelayPayload } from "../types";
import { createId, ensureWorkspaceTrustAccepted, resolveRepoRoot } from "../utils";

export class MeetingRoomDaemonApp {
  private readonly repoRoot = resolveRepoRoot();
  private readonly dataDir = path.resolve(this.repoRoot, ".claude/meeting-room/daemon");
  private readonly approvalDir = path.resolve(this.repoRoot, APPROVAL_STATE_RELATIVE_DIR);
  private readonly relayReceiver = new HooksRelayReceiver();
  private readonly eventStream = new DaemonEventStream();
  private readonly accessPolicy: DaemonAccessPolicyPayload;
  private readonly reconnectPolicy: DaemonReconnectPolicyPayload = {
    strategy: "sse-refetch",
    backoffMs: [500, 1000, 2000, 5000],
    snapshotRequired: true
  };
  private readonly authToken = process.env.MEETING_ROOM_DAEMON_TOKEN?.trim() || "";
  private readonly sessions: MeetingSessionStore;
  private readonly runtimes: MeetingRuntimeManager;

  constructor(log: (message: string) => void) {
    this.sessions = new MeetingSessionStore(path.resolve(this.dataDir, "events"));
    this.runtimes = new MeetingRuntimeManager({
      repoRoot: this.repoRoot,
      log
    });
    this.accessPolicy = {
      sessionHost: "mac-daemon",
      authMode: this.authToken ? "token-required" : "local-open",
      authHeader: "authorization",
      tunnelReady: Boolean(this.authToken)
    };
  }

  async start(): Promise<void> {
    this.syncApprovalFiles();
    this.relayReceiver.start((payload) => {
      this.handleRelayPayload(payload);
    });
  }

  async stop(): Promise<void> {
    await this.relayReceiver.stop();
    this.runtimes.stopAll();
    this.eventStream.closeAll();
  }

  isAuthorized(request: IncomingMessage): boolean {
    if (!this.authToken) {
      return true;
    }
    const header = request.headers.authorization ?? "";
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const tokenQuery = requestUrl.searchParams.get("token") ?? "";
    if (header === `Bearer ${this.authToken}` || tokenQuery === this.authToken) {
      return true;
    }
    return false;
  }

  getActiveMeetingCount(): number {
    return this.sessions.getActiveMeetingCount();
  }

  meta(): MeetingRoomDaemonMetaPayload {
    return {
      accessPolicy: this.accessPolicy,
      reconnectPolicy: this.reconnectPolicy,
      browserClientPath: `${WEB_ROOT_PREFIX}/index.html`
    };
  }

  listTabs(): MeetingTabPayload[] {
    return this.sessions.listTabs();
  }

  getSessionView(meetingId: string): MeetingSessionViewPayload | null {
    return this.sessions.getSessionView(meetingId);
  }

  getSessionDebug(meetingId: string): ClaudeSessionDebugPayload | null {
    return this.sessions.getSessionDebug(meetingId);
  }

  getSessionTerminal(meetingId: string): { tail: string[] } | null {
    const debug = this.sessions.getSessionDebug(meetingId);
    return debug ? { tail: debug.tail } : null;
  }

  addSseClient(response: ServerResponse): void {
    this.eventStream.addClient(response);
  }

  async handleCommand(envelope: MeetingRoomDaemonCommandEnvelope): Promise<MeetingRoomDaemonCommandAck> {
    const { commandId, command } = envelope;
    switch (command.type) {
      case "startMeeting":
        return this.ack(commandId, this.startMeeting(command), command.meetingId);
      case "sendHumanMessage":
        return this.ack(commandId, this.sendHumanMessage(command.meetingId, command.message), command.meetingId);
      case "approveNextStep":
        return this.ack(commandId, this.approveNextStep(command.meetingId), command.meetingId);
      case "pauseMeeting":
        return this.ack(commandId, this.sendControlPrompt(command.meetingId, "pause"), command.meetingId);
      case "resumeMeeting":
        return this.ack(commandId, this.sendControlPrompt(command.meetingId, "resume"), command.meetingId);
      case "endMeeting":
        return this.ack(commandId, this.endMeeting(command.meetingId, "command"), command.meetingId);
      case "retryMcp":
        return this.ack(commandId, this.writeRaw(command.meetingId, "/mcp"), command.meetingId);
      case "writeTerminal":
        return this.ack(commandId, this.writeRaw(command.meetingId, command.data), command.meetingId);
      case "resizeTerminal":
        return this.ack(commandId, this.resizeTerminal(command.meetingId, command.cols, command.rows), command.meetingId);
      default:
        return this.ack(commandId, false);
    }
  }

  private ack(commandId: string, accepted: boolean, meetingId?: string): MeetingRoomDaemonCommandAck {
    return {
      commandId,
      accepted,
      receivedAt: new Date().toISOString(),
      meetingId
    };
  }

  private startMeeting(command: Extract<MeetingRoomDaemonCommand, { type: "startMeeting" }>): boolean {
    if (this.sessions.isSessionOpen(command.meetingId)) {
      this.raiseRuntimeError(command.meetingId, "Meeting is already running.");
      return false;
    }

    ensureWorkspaceTrustAccepted(command.projectDir);
    this.writeMeetingFlag(true);

    const tab = this.createTab(command);
    this.sessions.append({
      kind: "MeetingStarted",
      at: new Date().toISOString(),
      meetingId: command.meetingId,
      payload: { tab }
    });
    this.sessions.append({
      kind: "InitPromptQueued",
      at: new Date().toISOString(),
      meetingId: command.meetingId,
      payload: { prompt: command.initPrompt }
    });
    this.writeApprovalGate(command.meetingId, {
      mode: "open",
      updatedAt: new Date().toISOString()
    });

    this.emitEvent({
      type: "meeting.started",
      eventId: createId("meeting_started"),
      emittedAt: new Date().toISOString(),
      meetingId: command.meetingId,
      payload: { tab }
    } satisfies MeetingStartedEvent);

    this.runtimes.startRuntime({
      meetingId: command.meetingId,
      projectDir: command.projectDir,
      initPrompt: command.initPrompt,
      onData: (data) => {
        this.handlePtyData(command.meetingId, data);
      },
      onExit: ({ exitCode }) => {
        this.recordTerminalChunk(command.meetingId, `\n[pty exited: ${exitCode ?? 0}]\n`);
        this.endMeeting(command.meetingId, "runtime_exit");
      },
      onInitPromptSent: () => {
        this.sessions.append({
          kind: "InitPromptSent",
          at: new Date().toISOString(),
          meetingId: command.meetingId
        });
      }
    });

    this.emitSessionViewUpdated(command.meetingId);
    this.emitTabsChanged();
    return true;
  }

  private sendHumanMessage(meetingId: string, message: string): boolean {
    const normalized = message.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return false;
    }
    if (!this.runtimes.hasRuntime(meetingId)) {
      this.raiseRuntimeError(meetingId, "Runtime is not available.");
      return false;
    }

    const prompt = [
      "人間参加者からの入力です。内容を必ずチーム全体へ broadcast してください。",
      "そのうえで、必要な検討と提案を続けてください。",
      "",
      "[Human Input]",
      normalized
    ].join("\n");

    if (!this.runtimes.writePrompt(meetingId, prompt)) {
      return false;
    }

    const messagePayload: ChatMessagePayload = {
      id: createId("human"),
      sender: "You",
      content: normalized,
      timestamp: new Date().toISOString(),
      source: "human",
      status: "confirmed"
    };
    this.sessions.append({
      kind: "HumanMessageSubmitted",
      at: messagePayload.timestamp,
      meetingId,
      payload: { message: messagePayload }
    });
    this.emitSessionViewUpdated(meetingId);
    return true;
  }

  private approveNextStep(meetingId: string): boolean {
    if (!this.sessions.hasSession(meetingId)) {
      return false;
    }
    this.updateApprovalGate(meetingId, "open");
    if (this.runtimes.hasRuntime(meetingId)) {
      this.runtimes.writePrompt(
        meetingId,
        [
          "ユーザーが直前の返答を確認して承認しました。",
          "直前に承認待ちで止まった作業をそのまま再開してください。",
          "必要なら失敗した SendMessage / Task / TeamCreate をやり直し、次の進捗を broadcast で共有してください。"
        ].join("\n")
      );
    }
    this.emitSessionViewUpdated(meetingId);
    return true;
  }

  private sendControlPrompt(meetingId: string, mode: "pause" | "resume"): boolean {
    const promptMap = {
      pause: "会議を一時停止し、現時点の要点を短くまとめてください。",
      resume: "会議を再開してください。直前の要点を確認して続行してください。"
    };
    const ok = this.runtimes.writePrompt(meetingId, promptMap[mode]);
    if (!ok) {
      return false;
    }
    if (mode === "pause" || mode === "resume") {
      this.sessions.append({
        kind: mode === "pause" ? "MeetingPaused" : "MeetingResumed",
        at: new Date().toISOString(),
        meetingId
      });
    }
    this.emitSessionViewUpdated(meetingId);
    return true;
  }

  private endMeeting(meetingId: string, reason: "command" | "runtime_exit"): boolean {
    const status = this.sessions.getSessionStatus(meetingId);
    if (!status || status === "ended") {
      return false;
    }
    if (reason === "command") {
      this.runtimes.writePrompt(meetingId, "会議を終了してください。結論・保留事項・次アクションをまとめてください。");
    }

    this.sessions.append({
      kind: "MeetingEnded",
      at: new Date().toISOString(),
      meetingId,
      payload: { reason }
    });
    this.runtimes.stopRuntime(meetingId);

    const tab = this.sessions.getTab(meetingId);
    if (tab) {
      this.emitEvent({
        type: "meeting.ended",
        eventId: createId("meeting_ended"),
        emittedAt: new Date().toISOString(),
        meetingId,
        payload: {
          tab,
          reason
        }
      } satisfies MeetingEndedEvent);
    }

    this.emitSessionViewUpdated(meetingId);
    this.emitTabsChanged();
    this.clearApprovalGate(meetingId);
    this.writeMeetingFlag(this.listTabs().length > 0);
    return true;
  }

  private writeRaw(meetingId: string, data: string): boolean {
    return this.runtimes.writeRaw(meetingId, data);
  }

  private resizeTerminal(meetingId: string, cols: number, rows: number): boolean {
    return this.runtimes.resizeTerminal(meetingId, cols, rows);
  }

  private handleRelayPayload(payload: RelayPayload): void {
    const meetingId = this.resolveRelayMeetingId(payload);
    if (!meetingId || !this.sessions.hasSession(meetingId)) {
      return;
    }

    if (payload.type === "agent_status") {
      this.sessions.append({
        kind: "AgentStatusChanged",
        at: payload.timestamp || new Date().toISOString(),
        meetingId,
        payload: {
          sender: payload.sender,
          status: payload.status ?? "completed"
        }
      });
      this.emitEvent({
        type: "agent.status_changed",
        eventId: createId("agent_status"),
        emittedAt: new Date().toISOString(),
        meetingId,
        payload: {
          sender: payload.sender,
          status: payload.status ?? "completed"
        }
      } satisfies AgentStatusChangedEvent);
      this.emitSessionViewUpdated(meetingId);
      return;
    }

    if (!shouldDisplayAgentMessageContent(payload.content)) {
      return;
    }

    const message: ChatMessagePayload = {
      id: payload.id,
      sender: payload.sender,
      subagent: payload.subagent,
      content: payload.content,
      timestamp: payload.timestamp || new Date().toISOString(),
      team: payload.team,
      source: "agent",
      status: "confirmed"
    };
    this.recordAgentMessage(meetingId, message);
  }

  private handlePtyData(meetingId: string, data: string): void {
    this.recordTerminalChunk(meetingId, data);
    if (!this.runtimes.hasRuntime(meetingId) || !this.sessions.hasSession(meetingId)) {
      return;
    }

    const cleaned = stripAnsi(data).replace(/\u0007/g, "");
    if (this.runtimes.hasPendingInitPrompt(meetingId) && hasClaudeReadySignal(cleaned)) {
      this.sessions.append({
        kind: "ClaudeReadyDetected",
        at: new Date().toISOString(),
        meetingId
      });
      this.runtimes.flushPendingInitPrompt(meetingId, () => {
        this.sessions.append({
          kind: "InitPromptSent",
          at: new Date().toISOString(),
          meetingId
        });
      });
    }

    if (isUsageLimitReached(cleaned)) {
      this.pushRuntimeEvent(meetingId, "usage_limit", "Claude利用上限に到達しています。", "warning");
    }
    if (hasMcpFailureSignal(cleaned)) {
      this.pushRuntimeEvent(meetingId, "mcp_error", "MCP server failed を検出しました。", "error", true);
    }
    if (/\/mcp/i.test(cleaned) && /(connected|running|available|ok)/i.test(cleaned)) {
      this.pushRuntimeEvent(meetingId, "mcp_info", "MCP接続が回復した可能性があります。", "warning");
    }
  }

  private recordAgentMessage(meetingId: string, message: ChatMessagePayload): void {
    this.sessions.append({
      kind: "AgentMessageReceived",
      at: message.timestamp,
      meetingId,
      payload: { message }
    });
    this.updateApprovalGate(meetingId, "blocked", `agent:${message.sender}`);
    this.emitEvent({
      type: "message.received",
      eventId: createId("message_received"),
      emittedAt: new Date().toISOString(),
      meetingId,
      payload: { message }
    } satisfies MessageReceivedEvent);
    this.emitSessionViewUpdated(meetingId);
  }

  private pushRuntimeEvent(
    meetingId: string,
    type: RuntimeEventPayload["type"],
    message: string,
    severity: "warning" | "error",
    durableMcpFailure = false
  ): void {
    const runtimeEvent: RuntimeEventPayload = {
      meetingId,
      type,
      message,
      timestamp: new Date().toISOString()
    };
    this.sessions.append({
      kind: severity === "error" ? "RuntimeErrorRaised" : "RuntimeWarningRaised",
      at: runtimeEvent.timestamp,
      meetingId,
      payload: { runtimeEvent }
    });
    if (durableMcpFailure) {
      this.sessions.append({
        kind: "McpFailureDetected",
        at: runtimeEvent.timestamp,
        meetingId,
        payload: { runtimeEvent }
      });
    }
    this.emitEvent({
      type: severity === "error" ? "runtime.error" : "runtime.warning",
      eventId: createId("runtime"),
      emittedAt: new Date().toISOString(),
      meetingId,
      payload: { runtimeEvent }
    } satisfies RuntimeWarningEvent | RuntimeErrorEvent);
    this.emitSessionViewUpdated(meetingId);
  }

  private emitTabsChanged(): void {
    for (const tab of this.listTabs()) {
      this.emitSessionViewUpdated(tab.id);
    }
  }

  private emitSessionViewUpdated(meetingId: string): void {
    const view = this.sessions.getSessionView(meetingId);
    if (!view) {
      return;
    }
    this.emitEvent({
      type: SESSION_VIEW_UPDATED_EVENT,
      eventId: createId("session_view"),
      emittedAt: new Date().toISOString(),
      meetingId,
      payload: { view }
    } satisfies SessionViewUpdatedEvent);
  }

  private recordTerminalChunk(meetingId: string, chunk: string): void {
    if (!this.sessions.hasSession(meetingId)) {
      return;
    }
    this.sessions.appendTerminalChunk(meetingId, chunk);
    this.emitEvent({
      type: "terminal.chunk",
      eventId: createId("terminal"),
      emittedAt: new Date().toISOString(),
      meetingId,
      payload: { chunk }
    } satisfies TerminalChunkEvent);
  }

  private emitEvent(event: MeetingRoomDaemonEvent): void {
    this.eventStream.publish(event);
  }

  private createTab(command: Extract<MeetingRoomDaemonCommand, { type: "startMeeting" }>): MeetingTabPayload {
    const config: MeetingConfigPayload = {
      id: command.meetingId,
      topic: command.topic,
      projectDir: command.projectDir,
      members: [...command.members]
    };
    return {
      id: command.meetingId,
      title: command.topic,
      config,
      createdAt: new Date().toISOString(),
      status: "running"
    };
  }

  private raiseRuntimeError(meetingId: string, message: string): void {
    const runtimeEvent: RuntimeEventPayload = {
      meetingId,
      type: "mcp_error",
      message,
      timestamp: new Date().toISOString()
    };
    this.sessions.append({
      kind: "RuntimeErrorRaised",
      at: runtimeEvent.timestamp,
      meetingId,
      payload: { runtimeEvent }
    });
    this.emitEvent({
      type: "runtime.error",
      eventId: createId("runtime_error"),
      emittedAt: new Date().toISOString(),
      meetingId,
      payload: { runtimeEvent }
    } satisfies RuntimeErrorEvent);
    this.emitSessionViewUpdated(meetingId);
  }

  private resolveRelayMeetingId(payload: RelayPayload): string | null {
    const fromPayload = payload.meetingId?.trim();
    if (fromPayload) {
      return fromPayload;
    }

    const runtimeMeetingIds = this.runtimes.listRuntimeMeetingIds();
    if (runtimeMeetingIds.length === 1) {
      return runtimeMeetingIds[0];
    }

    const liveSessions = this.sessions.listMeetingIdsByStatus(["running", "paused", "awaiting_review"]);
    if (liveSessions.length === 1) {
      return liveSessions[0];
    }

    const recoverableSessions = this.sessions.listMeetingIdsByStatus(["running", "paused", "awaiting_review", "recovering"]);
    if (recoverableSessions.length === 1) {
      return recoverableSessions[0];
    }

    return null;
  }

  private writeMeetingFlag(active: boolean): void {
    const flagPath = path.resolve(this.repoRoot, ACTIVE_FLAG_RELATIVE_PATH);
    fs.mkdirSync(path.dirname(flagPath), { recursive: true });
    if (active) {
      fs.writeFileSync(flagPath, "", "utf-8");
      return;
    }
    if (fs.existsSync(flagPath)) {
      fs.rmSync(flagPath);
    }
  }

  private updateApprovalGate(meetingId: string, mode: ApprovalGatePayload["mode"], reason?: string): void {
    const current = this.sessions.getApprovalGate(meetingId);
    if (current?.mode === mode && current.reason === reason) {
      return;
    }

    const approvalGate: ApprovalGatePayload = {
      mode,
      reason,
      updatedAt: new Date().toISOString()
    };
    this.sessions.append({
      kind: "ApprovalGateUpdated",
      at: approvalGate.updatedAt,
      meetingId,
      payload: { approvalGate }
    });
    this.writeApprovalGate(meetingId, approvalGate);
  }

  private writeApprovalGate(meetingId: string, approvalGate: ApprovalGatePayload): void {
    const filePath = path.resolve(this.approvalDir, `${meetingId}.json`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify({ meetingId, ...approvalGate }, null, 2)}\n`, "utf-8");
  }

  private clearApprovalGate(meetingId: string): void {
    const filePath = path.resolve(this.approvalDir, `${meetingId}.json`);
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath);
    }
  }

  private syncApprovalFiles(): void {
    fs.mkdirSync(this.approvalDir, { recursive: true });
    for (const tab of this.sessions.listTabs()) {
      const approvalGate = this.sessions.getApprovalGate(tab.id);
      if (!approvalGate) {
        continue;
      }
      this.writeApprovalGate(tab.id, approvalGate);
    }
  }
}
