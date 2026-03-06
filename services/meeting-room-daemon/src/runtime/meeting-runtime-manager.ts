import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ACTIVE_FLAG_RELATIVE_PATH, HOOKS_WS_PORT } from "../constants";
import { collectTailLines, suppressFallback } from "./terminal-utils";
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
}

export interface MeetingRuntimeManagerOptions {
  repoRoot: string;
  log: (message: string) => void;
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
    const runtime = this.spawnRuntimeProcess(options.meetingId, options.projectDir);
    runtime.pendingInitPrompt = options.initPrompt;
    suppressFallback(runtime, 10_000);
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
    suppressFallback(runtime, 5_000);
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
    suppressFallback(runtime, 5_000);
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

  markRelayTraffic(meetingId: string): void {
    const runtime = this.runtimes.get(meetingId);
    if (runtime) {
      runtime.hasRelayTraffic = true;
    }
  }

  shouldCaptureFallback(meetingId: string): boolean {
    const runtime = this.runtimes.get(meetingId);
    if (!runtime) {
      return false;
    }
    return !runtime.hasRelayTraffic && Date.now() >= (runtime.suppressFallbackUntil ?? 0);
  }

  collectTailLines(meetingId: string, chunk: string): string[] {
    const runtime = this.runtimes.get(meetingId);
    if (!runtime) {
      return [];
    }
    return collectTailLines(runtime, chunk);
  }

  rememberFallbackMessage(meetingId: string, content: string): boolean {
    const runtime = this.runtimes.get(meetingId);
    if (!runtime) {
      return false;
    }
    if (runtime.fallbackLastMessage === content) {
      return false;
    }
    runtime.fallbackLastMessage = content;
    return true;
  }

  private spawnRuntimeProcess(meetingId: string, projectDir: string): RuntimeHandle {
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
    return {
      process: proc,
      lineBuffer: ""
    };
  }

  private runtimeEnv(meetingId: string): NodeJS.ProcessEnv {
    return {
      ...process.env,
      SHELL: process.env.SHELL || "zsh",
      HOME: process.env.HOME || os.homedir(),
      PATH: process.env.PATH || "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin",
      MEETING_ROOM_MEETING_ID: meetingId,
      MEETING_ROOM_ACTIVE_FILE: path.resolve(this.options.repoRoot, ACTIVE_FLAG_RELATIVE_PATH),
      MEETING_ROOM_SETTINGS_FILE: path.resolve(this.options.repoRoot, ".claude/settings.json"),
      MEETING_ROOM_HOOKS_DIR: path.resolve(this.options.repoRoot, "hooks"),
      MEETING_ROOM_FALLBACK_LOG: path.resolve(this.options.repoRoot, ".claude/meeting-room/discussion.log.jsonl"),
      MEETING_ROOM_STOP_DEBUG_LOG: path.resolve(this.options.repoRoot, ".claude/meeting-room/stop-hook.log.jsonl"),
      MEETING_ROOM_WS_PORT: `${HOOKS_WS_PORT}`
    };
  }

  private buildClaudeLaunchCommand(): string {
    const baseCommand = process.env.MEETING_ROOM_CLAUDE_CMD || "claude --dangerously-skip-permissions";
    const settingsPath = path.resolve(this.options.repoRoot, ".claude", "settings.json");
    const hasSettingsArg = /(^|\s)--settings(\s|=)/.test(baseCommand);
    const settingsArg = fs.existsSync(settingsPath) && !hasSettingsArg
      ? ` --settings ${shellQuote(settingsPath)} --setting-sources user,project,local`
      : "";
    return `${baseCommand}${settingsArg}`;
  }
}
