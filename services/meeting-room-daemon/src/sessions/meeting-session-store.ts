import type {
  ClaudeSessionDebugPayload,
  MeetingSessionViewPayload,
  MeetingTabPayload
} from "@contracts/meeting-room-daemon";
import { DurableEventLogStore } from "../events/durable-event-log-store";
import { collectDebugTail, hasMcpFailureSignal, isUsageLimitReached } from "../runtime/terminal-utils";
import type { DurableEvent } from "../types";
import { deepClone } from "../utils";

export class MeetingSessionStore {
  private readonly sessions = new Map<string, MeetingSessionViewPayload>();
  private readonly logStore: DurableEventLogStore;

  constructor(private readonly eventLogDir: string) {
    this.logStore = new DurableEventLogStore(this.eventLogDir);
    this.loadPersistedSessions();
  }

  hasSession(meetingId: string): boolean {
    return this.sessions.has(meetingId);
  }

  isSessionOpen(meetingId: string): boolean {
    const status = this.sessions.get(meetingId)?.tab.status;
    return Boolean(status && status !== "ended");
  }

  getActiveMeetingCount(): number {
    return [...this.sessions.values()].filter((session) => session.tab.status !== "ended").length;
  }

  listTabs(): MeetingTabPayload[] {
    return [...this.sessions.values()]
      .filter((session) => session.tab.status !== "ended")
      .map((session) => deepClone(session.tab))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  getSessionView(meetingId: string): MeetingSessionViewPayload | null {
    const session = this.sessions.get(meetingId);
    return session ? deepClone(session) : null;
  }

  getSessionDebug(meetingId: string): ClaudeSessionDebugPayload | null {
    const session = this.sessions.get(meetingId);
    return session ? deepClone(session.sessionDebug) : null;
  }

  getSessionStatus(meetingId: string): MeetingTabPayload["status"] | null {
    return this.sessions.get(meetingId)?.tab.status ?? null;
  }

  getTab(meetingId: string): MeetingTabPayload | null {
    const tab = this.sessions.get(meetingId)?.tab;
    return tab ? deepClone(tab) : null;
  }

  getSkill(meetingId: string): string | null {
    return this.sessions.get(meetingId)?.tab.config.skill ?? null;
  }

  listMeetingIdsByStatus(statuses: MeetingTabPayload["status"][]): string[] {
    return [...this.sessions.values()]
      .filter((session) => statuses.includes(session.tab.status))
      .map((session) => session.tab.id);
  }

  append(event: DurableEvent): void {
    this.apply(event);
    this.logStore.append(event);
  }

  appendTerminalChunk(meetingId: string, chunk: string): void {
    const session = this.sessions.get(meetingId);
    if (!session) {
      return;
    }
    const lines = collectDebugTail(session.sessionDebug.tail, chunk);
    session.sessionDebug.tail = lines.slice(-120);
    session.sessionDebug.hasUsageLimit = session.sessionDebug.hasUsageLimit || isUsageLimitReached(chunk);
    session.sessionDebug.hasMcpError = session.sessionDebug.hasMcpError || hasMcpFailureSignal(chunk);
    session.sessionDebug.lastUpdatedAt = new Date().toISOString();
  }

  private apply(event: DurableEvent): void {
    switch (event.kind) {
      case "MeetingStarted": {
        const tab = deepClone(event.payload.tab);
        this.sessions.set(event.meetingId, {
          tab,
          messages: [],
          agentStatuses: Object.fromEntries(tab.config.members.map((memberId) => [memberId, "active"])),
          runtimeEvents: [],
          health: {},
          sessionDebug: {
            meetingId: event.meetingId,
            tail: [],
            hasUsageLimit: false,
            hasMcpError: false
          }
        });
        return;
      }
      case "InitPromptQueued":
        return;
      case "ClaudeReadyDetected": {
        const session = this.sessions.get(event.meetingId);
        if (session) {
          session.health.claudeReadyAt = event.at;
        }
        return;
      }
      case "InitPromptSent":
        return;
      case "HumanMessageSubmitted": {
        const session = this.sessions.get(event.meetingId);
        if (!session) return;
        session.messages.push(event.payload.message);
        session.health.inputDeliveredAt = event.at;
        return;
      }
      case "AgentMessageReceived": {
        const session = this.sessions.get(event.meetingId);
        if (!session) return;
        session.messages.push(event.payload.message);
        session.health.lastAgentReplyAt = event.at;
        return;
      }
      case "AgentStatusChanged": {
        const session = this.sessions.get(event.meetingId);
        if (!session) return;
        session.agentStatuses[event.payload.sender] = event.payload.status;
        return;
      }
      case "RuntimeWarningRaised":
      case "RuntimeErrorRaised": {
        const session = this.sessions.get(event.meetingId);
        if (!session) return;
        session.runtimeEvents = [...session.runtimeEvents, event.payload.runtimeEvent].slice(-8);
        if (event.kind === "RuntimeWarningRaised") {
          session.health.lastWarningAt = event.at;
        } else {
          session.health.lastErrorAt = event.at;
        }
        if (event.payload.runtimeEvent.type === "mcp_error") {
          session.sessionDebug.hasMcpError = true;
        }
        if (event.payload.runtimeEvent.type === "usage_limit") {
          session.sessionDebug.hasUsageLimit = true;
        }
        return;
      }
      case "McpFailureDetected":
        return;
      case "MeetingPaused": {
        const session = this.sessions.get(event.meetingId);
        if (session) {
          session.tab.status = "paused";
        }
        return;
      }
      case "MeetingResumed": {
        const session = this.sessions.get(event.meetingId);
        if (session) {
          session.tab.status = "running";
        }
        return;
      }
      case "MeetingEnded": {
        const session = this.sessions.get(event.meetingId);
        if (session) {
          session.tab.status = "ended";
        }
        return;
      }
      default:
        return;
    }
  }

  private loadPersistedSessions(): void {
    for (const event of this.logStore.readAll()) {
      this.apply(event);
    }
    for (const session of this.sessions.values()) {
      if (session.tab.status !== "ended") {
        session.tab.status = "recovering";
      }
    }
  }
}
