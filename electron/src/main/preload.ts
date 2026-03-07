import { contextBridge } from "electron";
import { RendererIpcClient } from "./renderer-ipc-client";
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
import type { MeetingControlMode } from "@shared/ipc";
import type { MeetingRoomClient } from "@shared/meeting-room-client";

const ipc = new RendererIpcClient();

export type MeetingRoomApi = MeetingRoomClient & {
  saveSummary: (payload: MeetingSummaryPayload) => Promise<string>;
};

const api: MeetingRoomApi = {
  startMeeting: (config: MeetingConfig): Promise<MeetingTab> => ipc.invoke("meeting:start", config),
  endMeeting: (meetingId: string): Promise<void> => ipc.invoke("meeting:end", meetingId),
  sendHumanMessage: (meetingId: string, message: string): Promise<boolean> =>
    ipc.invoke("meeting:human-message", meetingId, message),
  approveNextStep: (meetingId: string): Promise<boolean> =>
    ipc.invoke("meeting:approve-next-step", meetingId),
  sendControlMessage: (meetingId: string, mode: MeetingControlMode): Promise<void> =>
    ipc.invoke("meeting:control-message", meetingId, mode),
  listAgents: (): Promise<AgentProfile[]> => ipc.invoke("meeting:list-agents"),
  saveAgent: (input: AgentProfileInput): Promise<AgentProfile> => ipc.invoke("meeting:save-agent", input),
  listTabs: (): Promise<MeetingTab[]> => ipc.invoke("meeting:list-tabs"),
  defaultProjectDir: (): Promise<string> => ipc.invoke("meeting:default-project-dir"),
  pickProjectDir: (currentDir?: string): Promise<string | null> => ipc.invoke("meeting:pick-project-dir", currentDir),
  saveSummary: (payload: MeetingSummaryPayload): Promise<string> => ipc.invoke("meeting:save-summary", payload),
  retryMcp: (meetingId: string): Promise<boolean> => ipc.invoke("meeting:retry-mcp", meetingId),
  getSessionDebug: (meetingId: string): Promise<ClaudeSessionDebug> => ipc.invoke("meeting:get-session-debug", meetingId),
  getSessionView: (meetingId: string): Promise<MeetingSessionView | null> => ipc.invoke("meeting:get-session-view", meetingId),
  getDaemonMeta: (): Promise<MeetingRoomDaemonMeta> => ipc.invoke("meeting:get-daemon-meta"),
  openSessionDebugWindow: (meetingId: string): Promise<boolean> =>
    ipc.invoke("meeting:open-session-debug-window", meetingId),
  openDevTools: (): Promise<boolean> => ipc.invoke("app:open-devtools"),
  resizeTerminal: (meetingId: string, cols: number, rows: number): Promise<void> =>
    ipc.invoke("meeting:resize-terminal", meetingId, cols, rows),
  writeTerminal: (meetingId: string, data: string): Promise<boolean> => ipc.invoke("meeting:terminal-write", meetingId, data),
  onTerminalData: (handler: (meetingId: string, chunk: string) => void): (() => void) => ipc.on("terminal:data", handler),
  onRelayMessage: (handler: (payload: AgentMessagePayload) => void): (() => void) =>
    ipc.on("meeting:agent-message", handler),
  onTabsUpdate: (handler: (tabs: MeetingTab[]) => void): (() => void) => ipc.on("meeting:tabs", handler),
  onRuntimeEvent: (handler: (event: RuntimeEvent) => void): (() => void) => ipc.on("meeting:runtime-event", handler)
};

contextBridge.exposeInMainWorld("meetingRoom", api);
