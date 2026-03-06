import path from "node:path";
import type {
  AgentProfile,
  AgentProfileInput,
  MeetingConfig,
  MeetingSummaryPayload
} from "@shared/types";
import { LocalMeetingRoomSupport } from "../../../packages/meeting-room-support/src/local-meeting-room-support";
import { PtyManager } from "./pty-manager";

export class MeetingService {
  private readonly support = new LocalMeetingRoomSupport(path.resolve(process.cwd(), ".."));

  constructor(private readonly ptyManager: PtyManager) {}

  defaultProjectDir(): string {
    return this.support.defaultProjectDir();
  }

  buildInitPrompt(config: MeetingConfig): string {
    return this.support.buildInitPrompt(config);
  }

  saveMeetingSummary(payload: MeetingSummaryPayload): string {
    return this.support.saveMeetingSummary(payload);
  }

  listAgentProfiles(): AgentProfile[] {
    return this.support.listAgentProfiles();
  }

  saveAgentProfile(input: AgentProfileInput): AgentProfile {
    return this.support.saveAgentProfile(input);
  }
}
