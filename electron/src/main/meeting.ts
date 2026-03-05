import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { BrowserWindow } from "electron";
import type {
  AgentProfile,
  AgentProfileInput,
  AgentMessagePayload,
  MeetingConfig,
  MeetingSummaryPayload,
  MeetingTab,
  SkillOption
} from "@shared/types";
import type { BroadcastToRenderer, MeetingControlMode } from "@shared/ipc";
import { PtyManager } from "./pty-manager";

interface AgentProfileFile {
  id?: string;
  name?: string;
  description?: string;
  enabledByDefault?: boolean;
}

const DEFAULT_AGENT_PROFILES: Array<Omit<AgentProfile, "source">> = [
  {
    id: "product-manager",
    name: "Product Manager",
    description: "課題を要件に変換し、優先順位と意思決定の軸を整理する",
    enabledByDefault: true
  },
  {
    id: "ux-analyst",
    name: "UX Analyst",
    description: "ユーザー体験と認知負荷の観点で提案の実効性を評価する",
    enabledByDefault: true
  },
  {
    id: "behavioral-psychologist",
    name: "Behavioral Psychologist",
    description: "行動心理と習慣化の視点で継続可能な改善策を出す",
    enabledByDefault: true
  },
  {
    id: "tech-lead",
    name: "Tech Lead",
    description: "実装コスト、技術負債、運用性を考慮して実装案に落とす",
    enabledByDefault: true
  }
];

export class MeetingService {
  private tabs = new Map<string, MeetingTab>();
  private readonly activeFlagPath: string;
  private readonly summaryDirPath: string;
  private readonly agentDirPath: string;

  constructor(
    private readonly ptyManager: PtyManager,
    private readonly broadcast: BroadcastToRenderer
  ) {
    this.activeFlagPath = path.resolve(process.cwd(), "..", ".claude/meeting-room/.active");
    this.summaryDirPath = path.resolve(process.cwd(), "..", ".claude/meeting-room/summaries");
    this.agentDirPath = path.resolve(process.cwd(), "..", ".claude/meeting-room/agents");
    this.ensureDefaultAgentProfiles();
  }

  listTabs(): MeetingTab[] {
    return [...this.tabs.values()];
  }

  defaultProjectDir(): string {
    return this.ptyManager.defaultProjectDir();
  }

  buildInitPrompt(_config: MeetingConfig): string {
    // 通常対話モードでは起動直後にプロンプトを送らず、
    // ユーザーの最初の入力をそのままClaudeに渡す。
    return "";
  }

  startMeeting(config: MeetingConfig): MeetingTab {
    this.ensureMeetingFlag();
    const tab: MeetingTab = {
      id: config.id,
      title: config.topic,
      config,
      createdAt: new Date().toISOString(),
      status: "running"
    };
    this.tabs.set(config.id, tab);

    this.ptyManager.start(config.id, config.projectDir, this.ptyManager.defaultEnv());
    this.ptyManager.runClaude(config.id, this.buildInitPrompt(config));
    this.broadcast("meeting:tabs", this.listTabs());
    return tab;
  }

  sendHumanMessage(meetingId: string, input: string): boolean {
    const normalizedInput = input.replace(/\s+/g, " ").trim();
    if (!normalizedInput) return false;
    return this.submitPrompt(meetingId, normalizedInput);
  }

  sendControlPrompt(meetingId: string, mode: MeetingControlMode, extra?: string): void {
    const promptMap = {
      pause: "会議を一時停止し、現時点の要点を短くまとめてください。",
      resume: "会議を再開してください。直前の要点を確認して続行してください。",
      end: "会議を終了してください。結論・保留事項・次アクションをまとめてください。",
      settings: `会議の設定変更リクエストです。以下を反映してください:\n${extra ?? "(no details)"}`
    };
    this.submitPrompt(meetingId, promptMap[mode]);
  }

  retryMcp(meetingId: string): boolean {
    return this.submitPrompt(meetingId, "/mcp");
  }

  endMeeting(meetingId: string): void {
    const tab = this.tabs.get(meetingId);
    if (!tab) return;
    this.ptyManager.stop(meetingId);
    this.tabs.delete(meetingId);
    if (this.tabs.size === 0) {
      this.clearMeetingFlag();
    }
    this.broadcast("meeting:tabs", this.listTabs());
  }

  saveMeetingSummary(payload: MeetingSummaryPayload): string {
    fs.mkdirSync(this.summaryDirPath, { recursive: true });

    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, "-");
    const safeMeetingId = payload.meetingId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filePath = path.join(this.summaryDirPath, `${stamp}_${safeMeetingId}.md`);

    const total = payload.messages.length;
    const humanCount = payload.messages.filter((m) => m.source === "human").length;
    const agentCount = total - humanCount;
    const lastMessages = payload.messages.slice(-8);

    const content = [
      "# Meeting Summary",
      "",
      `- SavedAt: ${now.toISOString()}`,
      `- MeetingId: ${payload.meetingId}`,
      `- Title: ${payload.title}`,
      `- Topic: ${payload.topic}`,
      `- TotalMessages: ${total}`,
      `- HumanMessages: ${humanCount}`,
      `- AgentMessages: ${agentCount}`,
      "",
      "## Recent Messages",
      ...lastMessages.map((message) => {
        const role = message.source === "human" ? "You" : message.sender;
        return `- [${message.timestamp}] ${role}: ${message.content.replace(/\n/g, " ").trim()}`;
      }),
      "",
      "## Auto Notes",
      "- This summary is generated automatically at meeting end.",
      "- For full context, see session history in app storage."
    ].join("\n");

    fs.writeFileSync(filePath, content, "utf-8");
    return filePath;
  }

  attachWindow(_window: BrowserWindow): void {
    // The service uses the broadcast callback; no direct window references needed.
  }

  relayAgentMessage(payload: AgentMessagePayload): void {
    this.broadcast("meeting:agent-message", payload);
  }

  listSkills(): SkillOption[] {
    const home = os.homedir();
    const repoRoot = path.resolve(process.cwd(), "..");
    const candidates = [
      path.resolve(home, ".claude/skills"),
      path.resolve(home, ".claude/plugins/cache/sunagaku-marketplace"),
      path.resolve(repoRoot, ".claude/skills")
    ];

    const result = new Map<string, SkillOption>();
    for (const root of candidates) {
      if (!fs.existsSync(root)) continue;
      const entries = fs.readdirSync(root, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const name = entry.name;
        if (!result.has(name)) {
          result.set(name, { name, source: root });
        }
      }
    }

    if (!result.has("feature-discussion")) {
      result.set("feature-discussion", { name: "feature-discussion", source: "built-in fallback" });
    }
    return [...result.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  listAgentProfiles(): AgentProfile[] {
    this.ensureDefaultAgentProfiles();
    const result = new Map<string, AgentProfile>();

    const entries = fs.readdirSync(this.agentDirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const filePath = path.join(this.agentDirPath, entry.name);
      const parsed = this.readAgentProfileFile(filePath);
      if (!parsed) continue;
      if (!result.has(parsed.id)) {
        result.set(parsed.id, parsed);
      }
    }

    if (result.size === 0) {
      for (const defaultProfile of DEFAULT_AGENT_PROFILES) {
        result.set(defaultProfile.id, {
          ...defaultProfile,
          source: "built-in fallback"
        });
      }
    }

    return [...result.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  saveAgentProfile(input: AgentProfileInput): AgentProfile {
    this.ensureDefaultAgentProfiles();
    const normalized = this.normalizeAgentProfileInput(input);
    const filePath = path.join(this.agentDirPath, `${normalized.id}.json`);
    const payload: AgentProfileFile = {
      id: normalized.id,
      name: normalized.name,
      description: normalized.description,
      enabledByDefault: normalized.enabledByDefault
    };
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
    return {
      ...normalized,
      source: filePath
    };
  }

  private ensureMeetingFlag(): void {
    fs.mkdirSync(path.dirname(this.activeFlagPath), { recursive: true });
    fs.writeFileSync(this.activeFlagPath, "", "utf-8");
  }

  private clearMeetingFlag(): void {
    if (fs.existsSync(this.activeFlagPath)) {
      fs.rmSync(this.activeFlagPath);
    }
  }

  private submitPrompt(meetingId: string, prompt: string): boolean {
    const content = prompt.replace(/\r/g, "").trim();
    if (!content) return false;
    const ok = this.ptyManager.write(meetingId, content);
    if (!ok) return false;
    this.ptyManager.write(meetingId, "\r");
    return true;
  }

  private resolveMemberLines(memberIds: string[]): string[] {
    const profiles = this.listAgentProfiles();
    const byId = new Map<string, AgentProfile>();
    for (const profile of profiles) {
      byId.set(profile.id, profile);
    }

    const lines: string[] = [];
    for (const memberId of memberIds) {
      const profile = byId.get(memberId);
      if (!profile) {
        lines.push(`${memberId}: custom role`);
        continue;
      }
      lines.push(`${profile.id} (${profile.name}): ${profile.description}`);
    }
    return lines.length > 0 ? lines : ["(未指定)"];
  }

  private ensureDefaultAgentProfiles(): void {
    fs.mkdirSync(this.agentDirPath, { recursive: true });
    for (const profile of DEFAULT_AGENT_PROFILES) {
      const filePath = path.join(this.agentDirPath, `${profile.id}.json`);
      if (fs.existsSync(filePath)) continue;
      const payload: AgentProfileFile = {
        id: profile.id,
        name: profile.name,
        description: profile.description,
        enabledByDefault: profile.enabledByDefault
      };
      fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
    }
  }

  private readAgentProfileFile(filePath: string): AgentProfile | null {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw) as AgentProfileFile;
      const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
      if (!name) return null;

      const idSource = typeof parsed.id === "string" ? parsed.id : name;
      const id = this.slugify(idSource);
      const description =
        typeof parsed.description === "string" && parsed.description.trim()
          ? parsed.description.trim()
          : "役割説明は未設定です";

      return {
        id,
        name,
        description,
        enabledByDefault: Boolean(parsed.enabledByDefault),
        source: filePath
      };
    } catch {
      return null;
    }
  }

  private normalizeAgentProfileInput(input: AgentProfileInput): Omit<AgentProfile, "source"> {
    const name = input.name.trim();
    if (!name) {
      throw new Error("Agent name is required");
    }

    const description = input.description.trim() || "役割説明は未設定です";
    const idSource = input.id?.trim() || name;
    return {
      id: this.slugify(idSource),
      name,
      description,
      enabledByDefault: Boolean(input.enabledByDefault)
    };
  }

  private slugify(value: string): string {
    const slug = value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (slug) {
      return slug;
    }
    return `agent-${Date.now().toString(36)}`;
  }
}
