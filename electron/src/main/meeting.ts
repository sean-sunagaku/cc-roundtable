import fs from "node:fs";
import path from "node:path";
import type {
  AgentProfile,
  AgentProfileInput,
  MeetingConfig,
  MeetingSummaryPayload
} from "@shared/types";
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
  },
  {
    id: "researcher",
    name: "Researcher",
    description: "ユーザー調査と仮説検証を担当する",
    enabledByDefault: false
  },
  {
    id: "user-liaison",
    name: "User Liaison",
    description: "前提不足や曖昧さを見つけたら、ユーザーに確認すべき論点を整理して共有する",
    enabledByDefault: true
  }
];

export class MeetingService {
  private readonly summaryDirPath: string;
  private readonly agentDirPath: string;

  constructor(private readonly ptyManager: PtyManager) {
    this.summaryDirPath = path.resolve(process.cwd(), "..", ".claude/meeting-room/summaries");
    this.agentDirPath = path.resolve(process.cwd(), "..", ".claude/meeting-room/agents");
    this.ensureDefaultAgentProfiles();
  }

  defaultProjectDir(): string {
    return this.ptyManager.defaultProjectDir();
  }

  buildInitPrompt(config: MeetingConfig): string {
    const topic = config.topic.trim();
    const memberLines = this.resolveMemberLines(config.members).map((line) => `- ${line}`);

    return [
      "Meeting Room 起動指示:",
      "- いまから Agent Teams 会議を開始してください。",
      "- 最初の相談内容（議題）をもとに、必要な Team 編成を最初に提案・確定してください。",
      "- サブエージェントを起動する場合は general-purpose タイプのみを使ってください。Plan タイプの起動は禁止です。",
      "- 理由: Plan タイプはこの会議フローで必要な SendMessage / shutdown_response を扱えず、不整合の原因になります。",
      "- もし誤って Plan タイプを起動した場合、そのまま進行せず、結果共有や shutdown 応答を待たずに破棄し、general-purpose タイプで起動し直してください。",
      "- Team 編成や再編成の際も同じです。常に broadcast 可能な general-purpose タイプだけで構成してください。",
      "- 会議中の SendMessage は必ず type: \"broadcast\" のみを使ってください。directed は禁止です。",
      "- すべての重要な検討結果は、チャット欄に表示されるよう broadcast で共有してください。",
      "- 前提不足や未確定事項がある場合は、user-liaison の役割でユーザーへの確認事項を整理し、先に確認を優先してください。",
      "- 返答は一度に広げすぎず、次に人間が判断できる粒度で区切ってください。",
      "- 返答は『結論 / 根拠 / 次アクション』の順で簡潔に整理してください。",
      "",
      `議題: ${topic || "(未指定)"}`,
      "参加メンバー:",
      ...memberLines,
      "",
      "最初に実行すること:",
      "1. 相談内容から Team 構成案を作る",
      "2. Team 構成は general-purpose タイプのみで確定し、その方針を broadcast で共有する",
      "3. 初期分析を broadcast で共有し、必要ならユーザーへの確認事項を出す",
      "4. broadcast ができないエージェント種別は採用しない。必要なら general-purpose で再作成する"
    ].join("\n");
  }

  saveMeetingSummary(payload: MeetingSummaryPayload): string {
    fs.mkdirSync(this.summaryDirPath, { recursive: true });

    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, "-");
    const safeMeetingId = payload.meetingId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filePath = path.join(this.summaryDirPath, `${stamp}_${safeMeetingId}.md`);

    const total = payload.messages.length;
    const humanCount = payload.messages.filter((message) => message.source === "human").length;
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
