export const MEETING_ROOM_DAEMON_DEFAULT_HOST = "127.0.0.1";
export const MEETING_ROOM_DAEMON_DEFAULT_PORT = 4417;
export const MEETING_ROOM_DAEMON_HEALTH_PATH = "/health";
export const MEETING_ROOM_DAEMON_COMMANDS_PATH = "/api/commands";
export const MEETING_ROOM_DAEMON_EVENTS_PATH = "/api/events";
export const MEETING_ROOM_DAEMON_SESSIONS_PATH = "/api/sessions";
export const MEETING_ROOM_DAEMON_META_PATH = "/api/meta";
export const MEETING_ROOM_DAEMON_AGENTS_PATH = "/api/agents";
export const MEETING_ROOM_DAEMON_DEFAULT_PROJECT_DIR_PATH = "/api/default-project-dir";
export const MEETING_ROOM_DAEMON_PICK_PROJECT_DIR_PATH = "/api/pick-project-dir";

export interface AgentProfilePayload {
  id: string;
  name: string;
  description: string;
  enabledByDefault: boolean;
  source: string;
}

export interface AgentProfileInputPayload {
  id?: string;
  name: string;
  description: string;
  enabledByDefault?: boolean;
}

export interface MeetingRoomDaemonAgentsResponse {
  agents: AgentProfilePayload[];
}

export interface MeetingRoomDaemonDefaultProjectDirResponse {
  defaultProjectDir: string;
}

export interface MeetingRoomDaemonPickProjectDirResponse {
  projectDir: string | null;
}

export interface MeetingConfigPayload {
  id: string;
  topic: string;
  projectDir: string;
  members: string[];
  bypassMode: boolean;
}

export interface MeetingTabPayload {
  id: string;
  title: string;
  config: MeetingConfigPayload;
  createdAt: string;
  status: "running" | "paused" | "awaiting_review" | "ended" | "recovering";
}

export interface ChatMessagePayload {
  id: string;
  sender: string;
  subagent?: string;
  content: string;
  timestamp: string;
  team?: string;
  status: "pending" | "confirmed";
  source: "human" | "agent";
}

export interface ApprovalGatePayload {
  mode: "open" | "blocked";
  bypassMode: boolean;
  reason?: string;
  updatedAt: string;
}

export interface ConversationHealthPayload {
  inputDeliveredAt?: string;
  lastAgentReplyAt?: string;
  claudeReadyAt?: string;
  lastWarningAt?: string;
  lastErrorAt?: string;
}

export interface ClaudeSessionDebugPayload {
  meetingId: string;
  tail: string[];
  hasUsageLimit: boolean;
  hasMcpError: boolean;
  lastUpdatedAt?: string;
}

export interface RuntimeEventPayload {
  meetingId: string;
  type: "usage_limit" | "mcp_error" | "mcp_info";
  message: string;
  timestamp: string;
}

export interface MeetingSessionViewPayload {
  tab: MeetingTabPayload;
  messages: ChatMessagePayload[];
  agentStatuses: Record<string, "active" | "completed">;
  runtimeEvents: RuntimeEventPayload[];
  health: ConversationHealthPayload;
  sessionDebug: ClaudeSessionDebugPayload;
  approvalGate: ApprovalGatePayload;
}

export interface DaemonAccessPolicyPayload {
  sessionHost: "mac-daemon";
  authMode: "local-open" | "token-required";
  authHeader: "authorization";
  tunnelReady: boolean;
}

export interface DaemonReconnectPolicyPayload {
  strategy: "sse-refetch";
  backoffMs: number[];
  snapshotRequired: true;
}

export interface MeetingRoomDaemonMetaPayload {
  accessPolicy: DaemonAccessPolicyPayload;
  reconnectPolicy: DaemonReconnectPolicyPayload;
  browserClientPath: string;
}

export interface StartMeetingCommand {
  type: "startMeeting";
  meetingId: string;
  topic: string;
  projectDir: string;
  members: string[];
  bypassMode: boolean;
  initPrompt?: string;
}

export interface SendHumanMessageCommand {
  type: "sendHumanMessage";
  meetingId: string;
  message: string;
}

export interface ApproveNextStepCommand {
  type: "approveNextStep";
  meetingId: string;
}

export interface PauseMeetingCommand {
  type: "pauseMeeting";
  meetingId: string;
}

export interface ResumeMeetingCommand {
  type: "resumeMeeting";
  meetingId: string;
}

export interface EndMeetingCommand {
  type: "endMeeting";
  meetingId: string;
}

export interface RetryMcpCommand {
  type: "retryMcp";
  meetingId: string;
}

export interface WriteTerminalCommand {
  type: "writeTerminal";
  meetingId: string;
  data: string;
}

export interface ResizeTerminalCommand {
  type: "resizeTerminal";
  meetingId: string;
  cols: number;
  rows: number;
}

export type MeetingRoomDaemonCommand =
  | StartMeetingCommand
  | SendHumanMessageCommand
  | ApproveNextStepCommand
  | PauseMeetingCommand
  | ResumeMeetingCommand
  | EndMeetingCommand
  | RetryMcpCommand
  | WriteTerminalCommand
  | ResizeTerminalCommand;

export interface MeetingRoomDaemonCommandEnvelope {
  commandId: string;
  sentAt: string;
  command: MeetingRoomDaemonCommand;
}

export interface MeetingRoomDaemonCommandAck {
  commandId: string;
  accepted: boolean;
  receivedAt: string;
  meetingId?: string;
}

export interface MeetingStartedEvent {
  type: "meeting.started";
  eventId: string;
  emittedAt: string;
  meetingId: string;
  payload: {
    tab: MeetingTabPayload;
  };
}

export interface MessageReceivedEvent {
  type: "message.received";
  eventId: string;
  emittedAt: string;
  meetingId: string;
  payload: {
    message: ChatMessagePayload;
  };
}

export interface AgentStatusChangedEvent {
  type: "agent.status_changed";
  eventId: string;
  emittedAt: string;
  meetingId: string;
  payload: {
    sender: string;
    status: "active" | "completed";
  };
}

export interface RuntimeWarningEvent {
  type: "runtime.warning";
  eventId: string;
  emittedAt: string;
  meetingId: string;
  payload: {
    runtimeEvent: RuntimeEventPayload;
  };
}

export interface RuntimeErrorEvent {
  type: "runtime.error";
  eventId: string;
  emittedAt: string;
  meetingId: string;
  payload: {
    runtimeEvent: RuntimeEventPayload;
  };
}

export interface MeetingEndedEvent {
  type: "meeting.ended";
  eventId: string;
  emittedAt: string;
  meetingId: string;
  payload: {
    tab: MeetingTabPayload;
    reason: "command" | "runtime_exit";
  };
}

export interface TerminalChunkEvent {
  type: "terminal.chunk";
  eventId: string;
  emittedAt: string;
  meetingId: string;
  payload: {
    chunk: string;
  };
}

export interface SessionViewUpdatedEvent {
  type: "session.view.updated";
  eventId: string;
  emittedAt: string;
  meetingId: string;
  payload: {
    view: MeetingSessionViewPayload;
  };
}

export type MeetingRoomDaemonEvent =
  | MeetingStartedEvent
  | MessageReceivedEvent
  | AgentStatusChangedEvent
  | RuntimeWarningEvent
  | RuntimeErrorEvent
  | MeetingEndedEvent
  | TerminalChunkEvent
  | SessionViewUpdatedEvent;

export interface MeetingRoomDaemonStreamFrame {
  cursor: string;
  event: MeetingRoomDaemonEvent;
}

export interface MeetingRoomDaemonHealthResponse {
  status: "ok";
  service: "meeting-room-daemon";
  now: string;
  uptimeMs: number;
  activeMeetings: number;
  transport: {
    host: string;
    port: number;
    commandsPath: string;
    eventsPath: string;
    sessionsPath: string;
    metaPath: string;
  };
}
