import type { MeetingControlMode } from "./ipc";
import type {
  AgentMessagePayload,
  AgentProfile,
  AgentProfileInput,
  ClaudeSessionDebug,
  MeetingRoomDaemonMeta,
  MeetingConfig,
  MeetingSessionView,
  MeetingTab,
  RuntimeEvent
} from "./types";

export interface MeetingRoomClient {
  startMeeting: (config: MeetingConfig) => Promise<MeetingTab>;
  endMeeting: (meetingId: string) => Promise<void>;
  sendHumanMessage: (meetingId: string, message: string) => Promise<boolean>;
  approveNextStep: (meetingId: string) => Promise<boolean>;
  sendControlMessage: (meetingId: string, mode: MeetingControlMode) => Promise<void>;
  listAgents: () => Promise<AgentProfile[]>;
  saveAgent: (input: AgentProfileInput) => Promise<AgentProfile>;
  listTabs: () => Promise<MeetingTab[]>;
  defaultProjectDir: () => Promise<string>;
  retryMcp: (meetingId: string) => Promise<boolean>;
  getSessionDebug: (meetingId: string) => Promise<ClaudeSessionDebug>;
  getSessionView: (meetingId: string) => Promise<MeetingSessionView | null>;
  getDaemonMeta: () => Promise<MeetingRoomDaemonMeta>;
  resizeTerminal: (meetingId: string, cols: number, rows: number) => Promise<void>;
  writeTerminal: (meetingId: string, data: string) => Promise<boolean>;
  onTerminalData: (handler: (meetingId: string, chunk: string) => void) => () => void;
  onRelayMessage: (handler: (payload: AgentMessagePayload) => void) => () => void;
  onTabsUpdate: (handler: (tabs: MeetingTab[]) => void) => () => void;
  onRuntimeEvent: (handler: (event: RuntimeEvent) => void) => () => void;
  openSessionDebugWindow?: (meetingId: string) => Promise<boolean>;
  openDevTools?: () => Promise<boolean>;
}
