import { contextBridge, ipcRenderer } from "electron";
import type {
  AgentProfile,
  AgentProfileInput,
  ClaudeSessionDebug,
  MeetingConfig,
  MeetingSummaryPayload,
  MeetingTab,
  RuntimeEvent,
  SkillOption
} from "@shared/types";

const api = {
  startMeeting: (config: MeetingConfig): Promise<MeetingTab> => ipcRenderer.invoke("meeting:start", config),
  endMeeting: (meetingId: string): Promise<void> => ipcRenderer.invoke("meeting:end", meetingId),
  sendHumanMessage: (meetingId: string, message: string): Promise<boolean> =>
    ipcRenderer.invoke("meeting:human-message", meetingId, message),
  sendControlMessage: (
    meetingId: string,
    mode: "pause" | "resume" | "end" | "settings",
    extra?: string
  ): Promise<void> => ipcRenderer.invoke("meeting:control-message", meetingId, mode, extra),
  listSkills: (): Promise<SkillOption[]> => ipcRenderer.invoke("meeting:list-skills"),
  listAgents: (): Promise<AgentProfile[]> => ipcRenderer.invoke("meeting:list-agents"),
  saveAgent: (input: AgentProfileInput): Promise<AgentProfile> => ipcRenderer.invoke("meeting:save-agent", input),
  listTabs: (): Promise<MeetingTab[]> => ipcRenderer.invoke("meeting:list-tabs"),
  defaultProjectDir: (): Promise<string> => ipcRenderer.invoke("meeting:default-project-dir"),
  saveSummary: (payload: MeetingSummaryPayload): Promise<string> => ipcRenderer.invoke("meeting:save-summary", payload),
  retryMcp: (meetingId: string): Promise<boolean> => ipcRenderer.invoke("meeting:retry-mcp", meetingId),
  getSessionDebug: (meetingId: string): Promise<ClaudeSessionDebug> => ipcRenderer.invoke("meeting:get-session-debug", meetingId),
  openSessionDebugWindow: (meetingId: string): Promise<boolean> =>
    ipcRenderer.invoke("meeting:open-session-debug-window", meetingId),
  openDevTools: (): Promise<boolean> => ipcRenderer.invoke("app:open-devtools"),
  resizeTerminal: (meetingId: string, cols: number, rows: number): Promise<void> =>
    ipcRenderer.invoke("meeting:resize-terminal", meetingId, cols, rows),
  writeTerminal: (meetingId: string, data: string): Promise<boolean> =>
    ipcRenderer.invoke("meeting:terminal-write", meetingId, data),
  onTerminalData: (handler: (meetingId: string, chunk: string) => void): (() => void) => {
    const listener = (_event: unknown, meetingId: string, chunk: string) => handler(meetingId, chunk);
    ipcRenderer.on("terminal:data", listener);
    return () => ipcRenderer.removeListener("terminal:data", listener);
  },
  onRelayMessage: (handler: (payload: unknown) => void): (() => void) => {
    const listener = (_event: unknown, payload: unknown) => handler(payload);
    ipcRenderer.on("meeting:agent-message", listener);
    return () => ipcRenderer.removeListener("meeting:agent-message", listener);
  },
  onTabsUpdate: (handler: (tabs: MeetingTab[]) => void): (() => void) => {
    const listener = (_event: unknown, tabs: MeetingTab[]) => handler(tabs);
    ipcRenderer.on("meeting:tabs", listener);
    return () => ipcRenderer.removeListener("meeting:tabs", listener);
  },
  onRuntimeEvent: (handler: (event: RuntimeEvent) => void): (() => void) => {
    const listener = (_event: unknown, event: RuntimeEvent) => handler(event);
    ipcRenderer.on("meeting:runtime-event", listener);
    return () => ipcRenderer.removeListener("meeting:runtime-event", listener);
  }
};

contextBridge.exposeInMainWorld("meetingRoom", api);

export type MeetingRoomApi = typeof api;
