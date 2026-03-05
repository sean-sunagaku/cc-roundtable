"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/main/pty-manager.ts
var import_node_os = __toESM(require("node:os"));
var import_node_path = __toESM(require("node:path"));
var import_node_events = require("node:events");
var pty = __toESM(require("node-pty"));
var PtyManager = class extends import_node_events.EventEmitter {
  sessions = /* @__PURE__ */ new Map();
  start(meetingId, cwd, env) {
    this.stop(meetingId);
    const shell = process.platform === "win32" ? "powershell.exe" : "/bin/zsh";
    const args = process.platform === "win32" ? [] : ["-l"];
    const proc = pty.spawn(shell, args, {
      name: "xterm-color",
      cols: 120,
      rows: 28,
      cwd,
      env
    });
    this.sessions.set(meetingId, { process: proc, cwd });
    proc.onData((data) => this.emit("data", meetingId, data));
    proc.onExit(({ exitCode }) => this.emit("exit", meetingId, exitCode ?? 0));
  }
  runClaude(meetingId, initialPrompt) {
    const proc = this.sessions.get(meetingId)?.process;
    if (!proc) return;
    const claudeCommand = process.env.MEETING_ROOM_CLAUDE_CMD || "claude --dangerously-skip-permissions --no-chrome";
    proc.write(`${claudeCommand}
`);
    setTimeout(() => {
      if (initialPrompt.trim()) {
        proc.write(`${initialPrompt}
`);
      }
    }, 250);
  }
  write(meetingId, data) {
    const proc = this.sessions.get(meetingId)?.process;
    if (!proc) return false;
    proc.write(data);
    return true;
  }
  hasSession(meetingId) {
    return this.sessions.has(meetingId);
  }
  resize(meetingId, cols, rows) {
    const proc = this.sessions.get(meetingId)?.process;
    if (!proc) return;
    proc.resize(cols, rows);
  }
  stop(meetingId) {
    const session = this.sessions.get(meetingId);
    if (!session) return;
    session.process.kill();
    this.sessions.delete(meetingId);
  }
  stopAll() {
    for (const meetingId of this.sessions.keys()) {
      this.stop(meetingId);
    }
  }
  defaultProjectDir() {
    return import_node_path.default.resolve(process.cwd(), "..");
  }
  defaultEnv() {
    return {
      ...process.env,
      SHELL: process.env.SHELL || "zsh",
      HOME: process.env.HOME || import_node_os.default.homedir(),
      PATH: process.env.PATH || "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    };
  }
};

// src/main/meeting.ts
var import_node_fs = __toESM(require("node:fs"));
var import_node_path2 = __toESM(require("node:path"));
var import_node_os2 = __toESM(require("node:os"));
var DEFAULT_AGENT_PROFILES = [
  {
    id: "product-manager",
    name: "Product Manager",
    description: "\u8AB2\u984C\u3092\u8981\u4EF6\u306B\u5909\u63DB\u3057\u3001\u512A\u5148\u9806\u4F4D\u3068\u610F\u601D\u6C7A\u5B9A\u306E\u8EF8\u3092\u6574\u7406\u3059\u308B",
    enabledByDefault: true
  },
  {
    id: "ux-analyst",
    name: "UX Analyst",
    description: "\u30E6\u30FC\u30B6\u30FC\u4F53\u9A13\u3068\u8A8D\u77E5\u8CA0\u8377\u306E\u89B3\u70B9\u3067\u63D0\u6848\u306E\u5B9F\u52B9\u6027\u3092\u8A55\u4FA1\u3059\u308B",
    enabledByDefault: true
  },
  {
    id: "behavioral-psychologist",
    name: "Behavioral Psychologist",
    description: "\u884C\u52D5\u5FC3\u7406\u3068\u7FD2\u6163\u5316\u306E\u8996\u70B9\u3067\u7D99\u7D9A\u53EF\u80FD\u306A\u6539\u5584\u7B56\u3092\u51FA\u3059",
    enabledByDefault: true
  },
  {
    id: "tech-lead",
    name: "Tech Lead",
    description: "\u5B9F\u88C5\u30B3\u30B9\u30C8\u3001\u6280\u8853\u8CA0\u50B5\u3001\u904B\u7528\u6027\u3092\u8003\u616E\u3057\u3066\u5B9F\u88C5\u6848\u306B\u843D\u3068\u3059",
    enabledByDefault: true
  }
];
var MeetingService = class {
  constructor(ptyManager, broadcast) {
    this.ptyManager = ptyManager;
    this.broadcast = broadcast;
    this.activeFlagPath = import_node_path2.default.resolve(process.cwd(), "..", ".claude/meeting-room/.active");
    this.summaryDirPath = import_node_path2.default.resolve(process.cwd(), "..", ".claude/meeting-room/summaries");
    this.agentDirPath = import_node_path2.default.resolve(process.cwd(), "..", ".claude/meeting-room/agents");
    this.ensureDefaultAgentProfiles();
  }
  tabs = /* @__PURE__ */ new Map();
  activeFlagPath;
  summaryDirPath;
  agentDirPath;
  listTabs() {
    return [...this.tabs.values()];
  }
  defaultProjectDir() {
    return this.ptyManager.defaultProjectDir();
  }
  buildInitPrompt(_config) {
    return "";
  }
  startMeeting(config) {
    this.ensureMeetingFlag();
    const tab = {
      id: config.id,
      title: config.topic,
      config,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      status: "running"
    };
    this.tabs.set(config.id, tab);
    this.ptyManager.start(config.id, config.projectDir, this.ptyManager.defaultEnv());
    this.ptyManager.runClaude(config.id, this.buildInitPrompt(config));
    this.broadcast("meeting:tabs", this.listTabs());
    return tab;
  }
  sendHumanMessage(meetingId, input) {
    const normalizedInput = input.replace(/\s+/g, " ").trim();
    if (!normalizedInput) return false;
    return this.submitPrompt(meetingId, normalizedInput);
  }
  sendControlPrompt(meetingId, mode, extra) {
    const promptMap = {
      pause: "\u4F1A\u8B70\u3092\u4E00\u6642\u505C\u6B62\u3057\u3001\u73FE\u6642\u70B9\u306E\u8981\u70B9\u3092\u77ED\u304F\u307E\u3068\u3081\u3066\u304F\u3060\u3055\u3044\u3002",
      resume: "\u4F1A\u8B70\u3092\u518D\u958B\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u76F4\u524D\u306E\u8981\u70B9\u3092\u78BA\u8A8D\u3057\u3066\u7D9A\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
      end: "\u4F1A\u8B70\u3092\u7D42\u4E86\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u7D50\u8AD6\u30FB\u4FDD\u7559\u4E8B\u9805\u30FB\u6B21\u30A2\u30AF\u30B7\u30E7\u30F3\u3092\u307E\u3068\u3081\u3066\u304F\u3060\u3055\u3044\u3002",
      settings: `\u4F1A\u8B70\u306E\u8A2D\u5B9A\u5909\u66F4\u30EA\u30AF\u30A8\u30B9\u30C8\u3067\u3059\u3002\u4EE5\u4E0B\u3092\u53CD\u6620\u3057\u3066\u304F\u3060\u3055\u3044:
${extra ?? "(no details)"}`
    };
    this.submitPrompt(meetingId, promptMap[mode]);
  }
  retryMcp(meetingId) {
    return this.submitPrompt(meetingId, "/mcp");
  }
  endMeeting(meetingId) {
    const tab = this.tabs.get(meetingId);
    if (!tab) return;
    this.ptyManager.stop(meetingId);
    this.tabs.delete(meetingId);
    if (this.tabs.size === 0) {
      this.clearMeetingFlag();
    }
    this.broadcast("meeting:tabs", this.listTabs());
  }
  saveMeetingSummary(payload) {
    import_node_fs.default.mkdirSync(this.summaryDirPath, { recursive: true });
    const now = /* @__PURE__ */ new Date();
    const stamp = now.toISOString().replace(/[:.]/g, "-");
    const safeMeetingId = payload.meetingId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filePath = import_node_path2.default.join(this.summaryDirPath, `${stamp}_${safeMeetingId}.md`);
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
    import_node_fs.default.writeFileSync(filePath, content, "utf-8");
    return filePath;
  }
  attachWindow(_window) {
  }
  relayAgentMessage(payload) {
    this.broadcast("meeting:agent-message", payload);
  }
  listSkills() {
    const home = import_node_os2.default.homedir();
    const repoRoot = import_node_path2.default.resolve(process.cwd(), "..");
    const candidates = [
      import_node_path2.default.resolve(home, ".claude/skills"),
      import_node_path2.default.resolve(home, ".claude/plugins/cache/sunagaku-marketplace"),
      import_node_path2.default.resolve(repoRoot, ".claude/skills")
    ];
    const result = /* @__PURE__ */ new Map();
    for (const root of candidates) {
      if (!import_node_fs.default.existsSync(root)) continue;
      const entries = import_node_fs.default.readdirSync(root, { withFileTypes: true });
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
  listAgentProfiles() {
    this.ensureDefaultAgentProfiles();
    const result = /* @__PURE__ */ new Map();
    const entries = import_node_fs.default.readdirSync(this.agentDirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const filePath = import_node_path2.default.join(this.agentDirPath, entry.name);
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
  saveAgentProfile(input) {
    this.ensureDefaultAgentProfiles();
    const normalized = this.normalizeAgentProfileInput(input);
    const filePath = import_node_path2.default.join(this.agentDirPath, `${normalized.id}.json`);
    const payload = {
      id: normalized.id,
      name: normalized.name,
      description: normalized.description,
      enabledByDefault: normalized.enabledByDefault
    };
    import_node_fs.default.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}
`, "utf-8");
    return {
      ...normalized,
      source: filePath
    };
  }
  ensureMeetingFlag() {
    import_node_fs.default.mkdirSync(import_node_path2.default.dirname(this.activeFlagPath), { recursive: true });
    import_node_fs.default.writeFileSync(this.activeFlagPath, "", "utf-8");
  }
  clearMeetingFlag() {
    if (import_node_fs.default.existsSync(this.activeFlagPath)) {
      import_node_fs.default.rmSync(this.activeFlagPath);
    }
  }
  submitPrompt(meetingId, prompt) {
    const content = prompt.replace(/\r/g, "").trim();
    if (!content) return false;
    return this.ptyManager.write(meetingId, `${content}
`);
  }
  resolveMemberLines(memberIds) {
    const profiles = this.listAgentProfiles();
    const byId = /* @__PURE__ */ new Map();
    for (const profile of profiles) {
      byId.set(profile.id, profile);
    }
    const lines = [];
    for (const memberId of memberIds) {
      const profile = byId.get(memberId);
      if (!profile) {
        lines.push(`${memberId}: custom role`);
        continue;
      }
      lines.push(`${profile.id} (${profile.name}): ${profile.description}`);
    }
    return lines.length > 0 ? lines : ["(\u672A\u6307\u5B9A)"];
  }
  ensureDefaultAgentProfiles() {
    import_node_fs.default.mkdirSync(this.agentDirPath, { recursive: true });
    for (const profile of DEFAULT_AGENT_PROFILES) {
      const filePath = import_node_path2.default.join(this.agentDirPath, `${profile.id}.json`);
      if (import_node_fs.default.existsSync(filePath)) continue;
      const payload = {
        id: profile.id,
        name: profile.name,
        description: profile.description,
        enabledByDefault: profile.enabledByDefault
      };
      import_node_fs.default.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}
`, "utf-8");
    }
  }
  readAgentProfileFile(filePath) {
    try {
      const raw = import_node_fs.default.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
      if (!name) return null;
      const idSource = typeof parsed.id === "string" ? parsed.id : name;
      const id = this.slugify(idSource);
      const description = typeof parsed.description === "string" && parsed.description.trim() ? parsed.description.trim() : "\u5F79\u5272\u8AAC\u660E\u306F\u672A\u8A2D\u5B9A\u3067\u3059";
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
  normalizeAgentProfileInput(input) {
    const name = input.name.trim();
    if (!name) {
      throw new Error("Agent name is required");
    }
    const description = input.description.trim() || "\u5F79\u5272\u8AAC\u660E\u306F\u672A\u8A2D\u5B9A\u3067\u3059";
    const idSource = input.id?.trim() || name;
    return {
      id: this.slugify(idSource),
      name,
      description,
      enabledByDefault: Boolean(input.enabledByDefault)
    };
  }
  slugify(value) {
    const slug = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (slug) {
      return slug;
    }
    return `agent-${Date.now().toString(36)}`;
  }
};

// ../../../../../private/tmp/meeting_smoke_verify.ts
function stripAnsi(input) {
  return input.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "").replace(/\u001b\][^\u0007]*\u0007/g, "");
}
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function main() {
  const meetingId = `verify_${Date.now()}`;
  const pty2 = new PtyManager();
  const service = new MeetingService(pty2, () => {
  });
  let joined = "";
  const lines = [];
  pty2.on("data", (id, data) => {
    if (id !== meetingId) return;
    const c = stripAnsi(data).replace(/\u0007/g, "");
    joined += c;
    if (joined.length > 35e4) joined = joined.slice(-35e4);
    for (const line of c.replace(/\r/g, "\n").split(/\n+/)) {
      const t = line.trim();
      if (!t) continue;
      lines.push(t);
      if (lines.length > 1500) lines.shift();
    }
  });
  const config = {
    id: meetingId,
    skill: "feature-discussion",
    topic: "verify-chat",
    projectDir: "/Users/babashunsuke/Repository/cc-roundtable",
    members: []
  };
  console.log("[verify] start");
  service.startMeeting(config);
  const promptDeadline = Date.now() + 3e4;
  while (Date.now() < promptDeadline && !/ClaudeCode|❯|bypass permissions/i.test(joined)) {
    await sleep(500);
  }
  console.log(`[verify] prompt-ready=${/ClaudeCode|❯|bypass permissions/i.test(joined)}`);
  const beforeIdx = joined.length;
  const msg = "\u30ED\u30B0\u78BA\u8A8D\u30C6\u30B9\u30C8\u3067\u3059\u3002\u77ED\u304F\u8FD4\u7B54\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
  const sent = service.sendHumanMessage(meetingId, msg);
  console.log(`[verify] send=${sent}`);
  let foundAssistant = false;
  let usageBlocked = false;
  const deadline = Date.now() + 24e4;
  while (Date.now() < deadline) {
    const post = joined.slice(beforeIdx);
    if (/usage limit reached|weekly limit reached|limit has been reached/i.test(post)) {
      usageBlocked = true;
      break;
    }
    if (/\n\s*⏺[^\n]*/.test(post)) {
      foundAssistant = true;
      break;
    }
    await sleep(1200);
  }
  console.log(`[verify] assistant-marker=${foundAssistant}`);
  console.log(`[verify] usage-blocked=${usageBlocked}`);
  console.log("[verify] tail:");
  for (const line of lines.slice(-90)) {
    console.log(line);
  }
  service.endMeeting(meetingId);
  pty2.stopAll();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
