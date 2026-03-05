export type MessageStatus = "pending" | "confirmed";

export interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  team?: string;
  status: MessageStatus;
  source: "human" | "agent";
}

export interface AgentMessagePayload {
  type: "agent_message" | "agent_status";
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  team: string;
  status?: "active" | "completed";
  meetingId?: string;
}

export interface MeetingConfig {
  id: string;
  skill: string;
  topic: string;
  projectDir: string;
  members: string[];
}

export interface MeetingTab {
  id: string;
  title: string;
  config: MeetingConfig;
  createdAt: string;
  status: "running" | "paused" | "ended";
}

export interface SkillOption {
  name: string;
  source: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  enabledByDefault: boolean;
  source: string;
}

export interface AgentProfileInput {
  id?: string;
  name: string;
  description: string;
  enabledByDefault?: boolean;
}

export interface SessionSnapshot {
  meetingId: string;
  messages: ChatMessage[];
  savedAt: string;
}

export interface MeetingSummaryPayload {
  meetingId: string;
  title: string;
  topic: string;
  messages: ChatMessage[];
}

export interface RuntimeEvent {
  meetingId: string;
  type: "usage_limit" | "mcp_error" | "mcp_info";
  message: string;
  timestamp: string;
}

export interface ConversationHealth {
  inputDeliveredAt?: string;
  lastAgentReplyAt?: string;
}

export interface ClaudeSessionDebug {
  meetingId: string;
  tail: string[];
  hasUsageLimit: boolean;
  hasMcpError: boolean;
  lastUpdatedAt?: string;
}
