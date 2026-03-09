import type {
  ApprovalGatePayload,
  ClaudeSessionDebugPayload,
  MeetingSessionViewPayload,
  MeetingTabPayload
} from "@contracts/meeting-room-daemon";
import { DurableEventLogStore } from "../events/durable-event-log-store";
import {
  collectDebugTail,
  filterVisibleTailLines,
  hasMcpFailureSignal,
  isUsageLimitReached
} from "../runtime/terminal-utils";
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
    if (!session) {
      return null;
    }
    if (!session.approvalGate) {
      session.approvalGate = this.defaultApprovalGate(session.tab.config.bypassMode);
    } else {
      session.approvalGate.bypassMode = Boolean(
        session.approvalGate.bypassMode ?? session.tab.config.bypassMode
      );
    }
    const view = deepClone(session);
    view.sessionDebug.tail = filterVisibleTailLines(view.sessionDebug.tail);
    return view;
  }

  getSessionDebug(meetingId: string): ClaudeSessionDebugPayload | null {
    const session = this.sessions.get(meetingId);
    if (!session) {
      return null;
    }
    return {
      ...deepClone(session.sessionDebug),
      tail: filterVisibleTailLines(session.sessionDebug.tail)
    };
  }

  getSessionStatus(meetingId: string): MeetingTabPayload["status"] | null {
    return this.sessions.get(meetingId)?.tab.status ?? null;
  }

  getTab(meetingId: string): MeetingTabPayload | null {
    const tab = this.sessions.get(meetingId)?.tab;
    return tab ? deepClone(tab) : null;
  }

  getApprovalGate(meetingId: string): ApprovalGatePayload | null {
    const session = this.sessions.get(meetingId);
    if (!session) {
      return null;
    }
    if (!session.approvalGate) {
      session.approvalGate = this.defaultApprovalGate(session.tab.config.bypassMode);
    } else {
      session.approvalGate.bypassMode = Boolean(
        session.approvalGate.bypassMode ?? session.tab.config.bypassMode
      );
    }
    const gate = session.approvalGate;
    return gate ? deepClone(gate) : null;
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
        tab.config.bypassMode = Boolean(tab.config.bypassMode);
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
          },
          approvalGate: {
            mode: "open",
            bypassMode: tab.config.bypassMode,
            updatedAt: event.at
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
      case "ApprovalGateUpdated": {
        const session = this.sessions.get(event.meetingId);
        if (!session) return;
        session.approvalGate = {
          ...deepClone(event.payload.approvalGate),
          bypassMode: Boolean(event.payload.approvalGate.bypassMode ?? session.tab.config.bypassMode)
        };
        if (session.tab.status !== "ended") {
          if (!session.approvalGate.bypassMode && event.payload.approvalGate.mode === "blocked") {
            session.tab.status = "awaiting_review";
          } else if (session.tab.status === "awaiting_review") {
            session.tab.status = "running";
          }
        }
        return;
      }
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
      if (!session.approvalGate) {
        session.approvalGate = this.defaultApprovalGate(session.tab.config.bypassMode);
      } else {
        session.approvalGate.bypassMode = Boolean(
          session.approvalGate.bypassMode ?? session.tab.config.bypassMode
        );
      }
      if (session.tab.status !== "ended") {
        session.tab.status = "recovering";
      }
    }
  }

  private defaultApprovalGate(bypassMode = false): ApprovalGatePayload {
    return {
      mode: "open",
      bypassMode,
      updatedAt: new Date(0).toISOString()
    };
  }
}
