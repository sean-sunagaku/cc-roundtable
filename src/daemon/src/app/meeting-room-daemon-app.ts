import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  ApprovalGatePayload,
  AgentProfileInputPayload,
  AgentProfilePayload,
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
import { HOOK_ENV_VARS, RELAY_PAYLOAD_TYPES } from "@contracts/hook-contract";
import { LocalMeetingRoomSupport } from "../../../packages/meeting-room-support/src/local-meeting-room-support";
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
  isUsageLimitReached,
  stripAnsi
} from "../runtime/terminal-utils";
import { MeetingRuntimeManager } from "../runtime/meeting-runtime-manager";
import { MeetingSessionStore } from "../sessions/meeting-session-store";
import type { RelayPayload } from "../types";
import { createId, ensureWorkspaceTrustAccepted, resolveRepoRoot } from "../utils";

export class MeetingRoomDaemonApp {
  private shuttingDown = false;
  private readonly repoRoot = resolveRepoRoot();
  private readonly dataDir =
    process.env.MEETING_ROOM_DAEMON_DATA_DIR?.trim() ||
    path.resolve(this.repoRoot, ".claude/meeting-room/daemon");
  private readonly approvalDir =
    process.env[HOOK_ENV_VARS.approvalDir]?.trim() ||
    path.resolve(this.repoRoot, APPROVAL_STATE_RELATIVE_DIR);
  private readonly activeFile =
    process.env[HOOK_ENV_VARS.activeFile]?.trim() ||
    path.resolve(this.repoRoot, ACTIVE_FLAG_RELATIVE_PATH);
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
  private readonly support: LocalMeetingRoomSupport;

  constructor(log: (message: string) => void) {
    this.sessions = new MeetingSessionStore(path.resolve(this.dataDir, "events"));
    this.runtimes = new MeetingRuntimeManager({
      repoRoot: this.repoRoot,
      activeFile: this.activeFile,
      approvalDir: this.approvalDir,
      log
    });
    this.support = new LocalMeetingRoomSupport(this.repoRoot);
    this.accessPolicy = {
      sessionHost: "mac-daemon",
      authMode: this.authToken ? "token-required" : "local-open",
      authHeader: "authorization",
      tunnelReady: Boolean(this.authToken)
    };
  }

  async start(): Promise<void> {
    this.shuttingDown = false;
    this.syncApprovalFiles();
    this.relayReceiver.start((payload) => {
      this.handleRelayPayload(payload);
    });
  }

  async stop(): Promise<void> {
    this.shuttingDown = true;
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

  defaultProjectDir(): string {
    return this.support.defaultProjectDir();
  }

  pickProjectDir(currentDir?: string): string | null {
    return this.support.pickProjectDir(currentDir);
  }

  listAgentProfiles(): AgentProfilePayload[] {
    return this.support.listAgentProfiles();
  }

  saveAgentProfile(input: AgentProfileInputPayload): AgentProfilePayload {
    return this.support.saveAgentProfile(input);
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
    const initPrompt = command.initPrompt?.trim() || this.support.buildInitPrompt({
      id: command.meetingId,
      topic: command.topic,
      projectDir: command.projectDir,
      members: [...command.members],
      bypassMode: command.bypassMode
    });

    this.sessions.append({
      kind: "InitPromptQueued",
      at: new Date().toISOString(),
      meetingId: command.meetingId,
      payload: { prompt: initPrompt }
    });
    this.writeApprovalGate(command.meetingId, {
      mode: "open",
      bypassMode: command.bypassMode,
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
      initPrompt,
      onData: (data) => {
        this.handlePtyData(command.meetingId, data);
      },
      onExit: ({ exitCode }) => {
        if (this.shuttingDown) {
          return;
        }
        this.recordTerminalChunk(command.meetingId, `\n[pty exited: ${exitCode ?? 0}]\n`);
        this.endMeeting(command.meetingId, "runtime_exit");
      },
      onInitPromptSent: () => {
        this.sessions.append({
          kind: "InitPromptSent",
          at: new Date().toISOString(),
          meetingId: command.meetingId
        });
      },
      onSyntheticAgentMessage: (content) => {
        const timestamp = new Date().toISOString();
        this.recordAgentMessage(command.meetingId, {
          id: createId("synthetic_agent"),
          sender: "leader",
          content,
          timestamp,
          team: "leader",
          source: "agent",
          status: "confirmed"
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

    const prompt = this.buildHumanMessagePrompt(meetingId, normalized);

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
    const approvalGate = this.sessions.getApprovalGate(meetingId);
    if (!approvalGate) {
      return false;
    }
    if (approvalGate.bypassMode || approvalGate.mode !== "blocked") {
      this.emitSessionViewUpdated(meetingId);
      return true;
    }
    this.updateApprovalGate(meetingId, "open");
    if (this.runtimes.hasRuntime(meetingId)) {
      this.runtimes.writePrompt(meetingId, this.buildApprovalResumePrompt(meetingId));
    }
    this.emitSessionViewUpdated(meetingId);
    return true;
  }

  private sendControlPrompt(meetingId: string, mode: "pause" | "resume"): boolean {
    const promptMap = {
      pause: "会議を一時停止し、現時点の要点を短くまとめてください。",
      resume: this.buildResumePrompt(meetingId)
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
    const tab = this.sessions.getTab(meetingId);

    this.sessions.append({
      kind: "MeetingEnded",
      at: new Date().toISOString(),
      meetingId,
      payload: { reason }
    });
    this.runtimes.stopRuntime(meetingId);

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
    this.persistMeetingSummary(meetingId, tab);
    return true;
  }

  private persistMeetingSummary(meetingId: string, tab: MeetingTabPayload | null): void {
    if (!tab) {
      return;
    }
    const sessionView = this.sessions.getSessionView(meetingId);
    if (!sessionView) {
      return;
    }
    try {
      this.support.saveMeetingSummary({
        meetingId,
        title: tab.title,
        topic: tab.config.topic,
        messages: sessionView.messages
      });
    } catch (error) {
      console.warn(
        `[meeting-room-daemon] failed to persist summary for ${meetingId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
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

    if (payload.type === RELAY_PAYLOAD_TYPES.agentStatus) {
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

    if (!payload.content.trim()) {
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
    if (!this.sessions.getApprovalGate(meetingId)?.bypassMode) {
      this.updateApprovalGate(meetingId, "blocked", `agent:${message.sender}`);
    }
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
      members: [...command.members],
      bypassMode: command.bypassMode
    };
    return {
      id: command.meetingId,
      title: command.topic,
      config,
      createdAt: new Date().toISOString(),
      status: "running"
    };
  }

  private buildHumanMessagePrompt(meetingId: string, message: string): string {
    return [
      "人間参加者からの入力です。内容を必ずチーム全体へ broadcast してください。",
      "ただし最優先は、人間への通常返答として 2〜4 行の短い状況説明をすぐ返すことです。",
      "その短い返答を先に出してから、必要な TeamCreate / Task / SendMessage を続けてください。",
      "追加情報が足りなくても AskUserQuestion は使わず、合理的な仮定を明示して回答してください。",
      "会議コンテキストを再掲するので、これを前提に検討と提案を続けてください。",
      ...this.buildMeetingContextLines(meetingId),
      "",
      "[Human Input]",
      message
    ].join("\n");
  }

  private buildApprovalResumePrompt(meetingId: string): string {
    const view = this.sessions.getSessionView(meetingId);
    const reason = view?.approvalGate.reason;
    return [
      "ユーザーが直前の返答を確認して承認しました。",
      "以下の会議コンテキストを前提に、承認待ちで止まった作業をそのまま再開してください。",
      ...(reason ? [`承認待ち理由: ${reason}`] : []),
      ...this.buildMeetingContextLines(meetingId),
      "",
      "必要なら失敗した SendMessage / Task / TeamCreate をやり直し、次の進捗を broadcast で共有してください。",
      "会議コンテキストが不足しているとは扱わず、上の議題と直近の会話を前提に続行してください。",
      "不足情報があっても AskUserQuestion は使わず、合理的な仮定を置いて進めてください。"
    ].join("\n");
  }

  private buildResumePrompt(meetingId: string): string {
    return [
      "会議を再開してください。",
      "以下の会議コンテキストを確認し、直前の要点を踏まえて続行してください。",
      ...this.buildMeetingContextLines(meetingId),
      "",
      "次の進捗は broadcast で共有してください。",
      "不足情報があってもユーザー確認で止まらず、必要な仮定を置いて進めてください。"
    ].join("\n");
  }

  private buildMeetingContextLines(meetingId: string): string[] {
    const view = this.sessions.getSessionView(meetingId);
    if (!view) {
      return ["議題: (不明)", "直近の会話: (取得不可)"];
    }

    const recentMessages = view.messages
      .slice(-6)
      .map((message) => this.toPromptMessageLine(message));

    return [
      `議題: ${view.tab.config.topic || "(未指定)"}`,
      `project directory: ${view.tab.config.projectDir || "(未指定)"}`,
      `参加 Agent: ${view.tab.config.members.length > 0 ? view.tab.config.members.join(", ") : "(未指定)"}`,
      "直近の会話:",
      ...(recentMessages.length > 0 ? recentMessages : ["- (まだ会話なし)"])
    ];
  }

  private toPromptMessageLine(message: ChatMessagePayload): string {
    const speaker = message.source === "human"
      ? "You"
      : message.subagent?.trim() || message.sender;
    const compactContent = message.content.replace(/\s+/g, " ").trim();
    const preview = compactContent.length > 240 ? `${compactContent.slice(0, 237)}...` : compactContent;
    return `- ${speaker}: ${preview || "(empty)"}`;
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
    fs.mkdirSync(path.dirname(this.activeFile), { recursive: true });
    if (active) {
      fs.writeFileSync(this.activeFile, "", "utf-8");
      return;
    }
    if (fs.existsSync(this.activeFile)) {
      fs.rmSync(this.activeFile);
    }
  }

  private updateApprovalGate(meetingId: string, mode: ApprovalGatePayload["mode"], reason?: string): void {
    const current = this.sessions.getApprovalGate(meetingId);
    const bypassMode = current?.bypassMode ?? false;
    if (current?.mode === mode && current.reason === reason && current.bypassMode === bypassMode) {
      return;
    }

    const approvalGate: ApprovalGatePayload = {
      mode,
      bypassMode,
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
