import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HOOKS_WS_PORT } from "../constants";
import { HOOK_ENV_VARS } from "@contracts/hook-contract";
import type { PtyLike, RuntimeHandle } from "../types";
import { buildClaudeLaunchArgs, requireNodePty, shellQuote } from "../utils";

type RuntimeExitEvent = {
  exitCode?: number | undefined;
};

export interface StartMeetingRuntimeOptions {
  meetingId: string;
  projectDir: string;
  initPrompt: string;
  onData: (data: string) => void;
  onExit: (event: RuntimeExitEvent) => void;
  onInitPromptSent?: () => void;
  onSyntheticAgentMessage?: (content: string) => void;
}

export interface MeetingRuntimeManagerOptions {
  repoRoot: string;
  activeFile: string;
  approvalDir: string;
  log: (message: string) => void;
}

class InMemoryRuntimeProcess implements PtyLike {
  private readonly dataHandlers: Array<(data: string) => void> = [];
  private readonly exitHandlers: Array<(event: RuntimeExitEvent) => void> = [];
  private killed = false;

  constructor(
    private readonly meetingId: string,
    private readonly log: (message: string) => void
  ) {
    setTimeout(() => {
      if (this.killed) {
        return;
      }
      this.emitData("Meeting Room fallback runtime is active.\r\n❯ ");
    }, 50);
  }

  write(data: string): void {
    if (this.killed) {
      return;
    }
    const normalized = data.replace(/\r/g, "").trim();
    if (!normalized) {
      return;
    }
    const preview = normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
    this.log(`[daemon] fallback runtime received input for ${this.meetingId}: ${preview}`);
    if (normalized === "/mcp") {
      setTimeout(() => {
        if (!this.killed) {
          this.emitData("\r\n[fallback runtime] MCP is not attached in fallback mode.\r\n");
        }
      }, 10);
      return;
    }
    setTimeout(() => {
      if (!this.killed) {
        this.emitData("\r\n[fallback runtime] input accepted.\r\n");
      }
    }, 10);
  }

  resize(_cols: number, _rows: number): void {}

  kill(): void {
    if (this.killed) {
      return;
    }
    this.killed = true;
    queueMicrotask(() => {
      for (const handler of this.exitHandlers) {
        handler({ exitCode: 0 });
      }
    });
  }

  onData(handler: (data: string) => void): void {
    this.dataHandlers.push(handler);
  }

  onExit(handler: (event: RuntimeExitEvent) => void): void {
    this.exitHandlers.push(handler);
  }

  private emitData(data: string): void {
    for (const handler of this.dataHandlers) {
      handler(data);
    }
  }
}

class E2EFakeRuntimeProcess implements PtyLike {
  private readonly dataHandlers: Array<(data: string) => void> = [];
  private readonly exitHandlers: Array<(event: RuntimeExitEvent) => void> = [];
  private killed = false;
  private promptBuffer = "";

  constructor(
    private readonly meetingId: string,
    private readonly log: (message: string) => void,
    private readonly onSyntheticAgentMessage?: (content: string) => void
  ) {
    setTimeout(() => {
      if (this.killed) {
        return;
      }
      this.emitData("Meeting Room E2E fake runtime is active.\r\n❯ ");
    }, 50);
  }

  write(data: string): void {
    if (this.killed) {
      return;
    }
    const segments = data.split("\r");
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index] ?? "";
      this.promptBuffer += segment;
      const isPromptCommitted = index < segments.length - 1;
      if (!isPromptCommitted) {
        continue;
      }
      const prompt = this.promptBuffer.replace(/\r/g, "").trim();
      this.promptBuffer = "";
      if (!prompt) {
        continue;
      }
      this.handleCommittedPrompt(prompt);
    }
  }

  resize(_cols: number, _rows: number): void {}

  kill(): void {
    if (this.killed) {
      return;
    }
    this.killed = true;
    queueMicrotask(() => {
      for (const handler of this.exitHandlers) {
        handler({ exitCode: 0 });
      }
    });
  }

  onData(handler: (data: string) => void): void {
    this.dataHandlers.push(handler);
  }

  onExit(handler: (event: RuntimeExitEvent) => void): void {
    this.exitHandlers.push(handler);
  }

  private handleCommittedPrompt(prompt: string): void {
    const preview = prompt.length > 160 ? `${prompt.slice(0, 157)}...` : prompt;
    this.log(`[daemon] E2E fake runtime received input for ${this.meetingId}: ${preview}`);

    setTimeout(() => {
      if (!this.killed) {
        this.emitData(`\r\n[e2e fake runtime] accepted input for ${this.meetingId}.\r\n❯ `);
      }
    }, 10);

    if (!this.onSyntheticAgentMessage) {
      return;
    }
    if (!/(\[Human Input\]|人間参加者からの入力です)/.test(prompt)) {
      return;
    }

    setTimeout(() => {
      if (this.killed) {
        return;
      }
      this.onSyntheticAgentMessage?.(
        ["現在の状態です。", "会議は正常に稼働中です。", "次の確認をそのまま続けます。"].join("\n")
      );
      this.emitData("\r\n現在の状態です。短い状況共有を返しました。\r\n❯ ");
    }, 250);
  }

  private emitData(data: string): void {
    for (const handler of this.dataHandlers) {
      handler(data);
    }
  }
}

export class MeetingRuntimeManager {
  private readonly runtimes = new Map<string, RuntimeHandle>();

  constructor(private readonly options: MeetingRuntimeManagerOptions) {}

  hasRuntime(meetingId: string): boolean {
    return this.runtimes.has(meetingId);
  }

  listRuntimeMeetingIds(): string[] {
    return [...this.runtimes.keys()];
  }

  startRuntime(options: StartMeetingRuntimeOptions): void {
    this.stopRuntime(options.meetingId);
    const runtime = this.spawnRuntimeProcess(
      options.meetingId,
      options.projectDir,
      options.onSyntheticAgentMessage
    );
    runtime.pendingInitPrompt = options.initPrompt;
    runtime.initPromptTimer = setTimeout(() => {
      this.flushPendingInitPrompt(options.meetingId, options.onInitPromptSent);
    }, 20_000);
    runtime.process.onData(options.onData);
    runtime.process.onExit(options.onExit);
    this.runtimes.set(options.meetingId, runtime);
    this.options.log(`[daemon] launched Claude runtime for ${options.meetingId}`);
  }

  stopRuntime(meetingId: string): void {
    const runtime = this.runtimes.get(meetingId);
    if (!runtime) {
      return;
    }
    if (runtime.initPromptTimer) {
      clearTimeout(runtime.initPromptTimer);
    }
    runtime.process.kill();
    this.runtimes.delete(meetingId);
  }

  stopAll(): void {
    for (const meetingId of [...this.runtimes.keys()]) {
      this.stopRuntime(meetingId);
    }
  }

  writeRaw(meetingId: string, data: string): boolean {
    const runtime = this.runtimes.get(meetingId);
    if (!runtime) {
      return false;
    }
    runtime.process.write(data);
    return true;
  }

  writePrompt(meetingId: string, prompt: string): boolean {
    const runtime = this.runtimes.get(meetingId);
    if (!runtime) {
      return false;
    }
    const content = prompt.replace(/\r/g, "").trim();
    if (!content) {
      return false;
    }
    runtime.process.write(content);
    runtime.process.write("\r");
    return true;
  }

  resizeTerminal(meetingId: string, cols: number, rows: number): boolean {
    const runtime = this.runtimes.get(meetingId);
    if (!runtime) {
      return false;
    }
    runtime.process.resize(cols, rows);
    return true;
  }

  hasPendingInitPrompt(meetingId: string): boolean {
    return Boolean(this.runtimes.get(meetingId)?.pendingInitPrompt);
  }

  flushPendingInitPrompt(meetingId: string, onSent?: () => void): boolean {
    const runtime = this.runtimes.get(meetingId);
    if (!runtime?.pendingInitPrompt) {
      return false;
    }
    runtime.process.write(runtime.pendingInitPrompt);
    runtime.pendingInitPrompt = undefined;
    if (runtime.initPromptTimer) {
      clearTimeout(runtime.initPromptTimer);
      runtime.initPromptTimer = undefined;
    }
    setTimeout(() => {
      const current = this.runtimes.get(meetingId);
      if (!current) {
        return;
      }
      current.process.write("\r");
    }, 600);
    onSent?.();
    return true;
  }

  private spawnRuntimeProcess(
    meetingId: string,
    projectDir: string,
    onSyntheticAgentMessage?: (content: string) => void
  ): RuntimeHandle {
    if (process.env.MEETING_ROOM_E2E_FAKE_RUNTIME === "1") {
      this.options.log(`[daemon] using E2E fake runtime for ${meetingId}`);
      return {
        process: new E2EFakeRuntimeProcess(meetingId, this.options.log, onSyntheticAgentMessage)
      };
    }
    try {
      const ptyModule = requireNodePty();
      const shell = process.platform === "win32" ? "powershell.exe" : "/bin/zsh";
      const args = buildClaudeLaunchArgs(shell, this.buildClaudeLaunchCommand());
      const proc = ptyModule.spawn(shell, args, {
        name: "xterm-color",
        cols: 120,
        rows: 28,
        cwd: projectDir,
        env: this.runtimeEnv(meetingId)
      }) as PtyLike;
      return { process: proc };
    } catch (error) {
      if (!this.isSpawnFallbackError(error)) {
        throw error;
      }
      this.options.log(
        `[daemon] PTY launch failed for ${meetingId}; switching to fallback runtime: ${String(error)}`
      );
      return {
        process: new InMemoryRuntimeProcess(meetingId, this.options.log)
      };
    }
  }

  private runtimeEnv(meetingId: string): NodeJS.ProcessEnv {
    return {
      ...process.env,
      SHELL: process.env.SHELL || "zsh",
      HOME: process.env.HOME || os.homedir(),
      PATH: process.env.PATH || "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin",
      [HOOK_ENV_VARS.meetingId]: meetingId,
      [HOOK_ENV_VARS.activeFile]: this.options.activeFile,
      [HOOK_ENV_VARS.approvalDir]: this.options.approvalDir,
      [HOOK_ENV_VARS.approvalFile]: path.resolve(this.options.approvalDir, `${meetingId}.json`),
      [HOOK_ENV_VARS.settingsFile]: path.resolve(this.options.repoRoot, ".claude/settings.json"),
      [HOOK_ENV_VARS.hooksDir]: path.resolve(
        this.options.repoRoot,
        "src/packages/meeting-room-hooks"
      ),
      [HOOK_ENV_VARS.fallbackLog]: path.resolve(
        this.options.repoRoot,
        ".claude/meeting-room/discussion.log.jsonl"
      ),
      [HOOK_ENV_VARS.stopDebugLog]: path.resolve(
        this.options.repoRoot,
        ".claude/meeting-room/stop-hook.log.jsonl"
      ),
      [HOOK_ENV_VARS.wsDebugLog]: path.resolve(
        this.options.repoRoot,
        ".claude/meeting-room/ws-hook.log.jsonl"
      ),
      [HOOK_ENV_VARS.wsPort]: `${HOOKS_WS_PORT}`
    };
  }

  private buildClaudeLaunchCommand(): string {
    const baseCommand =
      process.env.MEETING_ROOM_CLAUDE_CMD || "claude --dangerously-skip-permissions";
    const settingsPath = path.resolve(this.options.repoRoot, ".claude", "settings.json");
    const hasSettingsArg = /(^|\s)--settings(\s|=)/.test(baseCommand);
    const settingsArg =
      fs.existsSync(settingsPath) && !hasSettingsArg
        ? ` --settings ${shellQuote(settingsPath)} --setting-sources user,project,local`
        : "";
    return `${baseCommand}${settingsArg}`;
  }

  private isSpawnFallbackError(error: unknown): boolean {
    return error instanceof Error && /posix_spawnp failed/i.test(error.message);
  }
}
