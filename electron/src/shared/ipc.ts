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

export type MeetingControlMode = "pause" | "resume";

export interface MainInvokeContract {
  "meeting:start": {
    args: [config: MeetingConfig];
    result: MeetingTab;
  };
  "meeting:end": {
    args: [meetingId: string];
    result: void;
  };
  "meeting:human-message": {
    args: [meetingId: string, message: string];
    result: boolean;
  };
  "meeting:approve-next-step": {
    args: [meetingId: string];
    result: boolean;
  };
  "meeting:control-message": {
    args: [meetingId: string, mode: MeetingControlMode];
    result: void;
  };
  "meeting:list-agents": {
    args: [];
    result: AgentProfile[];
  };
  "meeting:save-agent": {
    args: [input: AgentProfileInput];
    result: AgentProfile;
  };
  "meeting:list-tabs": {
    args: [];
    result: MeetingTab[];
  };
  "meeting:default-project-dir": {
    args: [];
    result: string;
  };
  "meeting:save-summary": {
    args: [payload: MeetingSummaryPayload];
    result: string;
  };
  "meeting:retry-mcp": {
    args: [meetingId: string];
    result: boolean;
  };
  "meeting:resize-terminal": {
    args: [meetingId: string, cols: number, rows: number];
    result: void;
  };
  "meeting:terminal-write": {
    args: [meetingId: string, data: string];
    result: boolean;
  };
  "meeting:get-session-debug": {
    args: [meetingId: string];
    result: ClaudeSessionDebug;
  };
  "meeting:get-session-view": {
    args: [meetingId: string];
    result: MeetingSessionView | null;
  };
  "meeting:get-daemon-meta": {
    args: [];
    result: MeetingRoomDaemonMeta;
  };
  "app:open-devtools": {
    args: [];
    result: boolean;
  };
  "meeting:open-session-debug-window": {
    args: [meetingId: string];
    result: boolean;
  };
}

export type MainInvokeChannel = keyof MainInvokeContract;
export type MainInvokeArgs<C extends MainInvokeChannel> = MainInvokeContract[C]["args"];
export type MainInvokeResult<C extends MainInvokeChannel> = MainInvokeContract[C]["result"];

export interface RendererEventContract {
  "terminal:data": [meetingId: string, chunk: string];
  "meeting:agent-message": [payload: AgentMessagePayload];
  "meeting:tabs": [tabs: MeetingTab[]];
  "meeting:runtime-event": [event: RuntimeEvent];
}

export type RendererEventChannel = keyof RendererEventContract;
export type RendererEventArgs<C extends RendererEventChannel> = RendererEventContract[C];

export type BroadcastToRenderer = <C extends RendererEventChannel>(
  channel: C,
  ...args: RendererEventArgs<C>
) => void;
