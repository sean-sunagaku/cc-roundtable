import type { ServerResponse } from "node:http";
import type {
  ApprovalGatePayload,
  ChatMessagePayload,
  MeetingTabPayload,
  RuntimeEventPayload
} from "@contracts/meeting-room-daemon";
import type { RELAY_PAYLOAD_TYPES } from "@contracts/hook-contract";

export type RelayPayload = {
  type: typeof RELAY_PAYLOAD_TYPES[keyof typeof RELAY_PAYLOAD_TYPES];
  id: string;
  sender: string;
  subagent?: string;
  content: string;
  timestamp: string;
  team: string;
  meetingId?: string;
  rawType?: string;
  status?: "active" | "completed";
};

export type DurableEvent =
  | { kind: "MeetingStarted"; at: string; meetingId: string; payload: { tab: MeetingTabPayload } }
  | { kind: "InitPromptQueued"; at: string; meetingId: string; payload: { prompt: string } }
  | { kind: "ClaudeReadyDetected"; at: string; meetingId: string }
  | { kind: "InitPromptSent"; at: string; meetingId: string }
  | { kind: "ApprovalGateUpdated"; at: string; meetingId: string; payload: { approvalGate: ApprovalGatePayload } }
  | { kind: "HumanMessageSubmitted"; at: string; meetingId: string; payload: { message: ChatMessagePayload } }
  | { kind: "AgentMessageReceived"; at: string; meetingId: string; payload: { message: ChatMessagePayload } }
  | { kind: "AgentStatusChanged"; at: string; meetingId: string; payload: { sender: string; status: "active" | "completed" } }
  | { kind: "RuntimeWarningRaised"; at: string; meetingId: string; payload: { runtimeEvent: RuntimeEventPayload } }
  | { kind: "RuntimeErrorRaised"; at: string; meetingId: string; payload: { runtimeEvent: RuntimeEventPayload } }
  | { kind: "McpFailureDetected"; at: string; meetingId: string; payload: { runtimeEvent: RuntimeEventPayload } }
  | { kind: "MeetingPaused"; at: string; meetingId: string }
  | { kind: "MeetingResumed"; at: string; meetingId: string }
  | { kind: "MeetingEnded"; at: string; meetingId: string; payload: { reason: "command" | "runtime_exit" } };

export type PtyLike = {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onData(handler: (data: string) => void): void;
  onExit(handler: (event: { exitCode?: number | undefined }) => void): void;
};

export interface RuntimeHandle {
  process: PtyLike;
  pendingInitPrompt?: string;
  initPromptTimer?: ReturnType<typeof setTimeout>;
}

export interface SseClient {
  id: string;
  response: ServerResponse;
}

export interface MeetingRoomDaemonServerOptions {
  host?: string;
  port?: number;
  log?: (message: string) => void;
}

export interface MeetingRoomDaemonServerHandle {
  host: string;
  port: number;
  stop: () => Promise<void>;
}
