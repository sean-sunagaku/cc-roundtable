import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import * as pty from "node-pty";

interface PtySession {
  process: pty.IPty;
  cwd: string;
}

export interface PtyEvents {
  data: (meetingId: string, data: string) => void;
  exit: (meetingId: string, exitCode: number) => void;
}

export class PtyManager extends EventEmitter {
  private sessions = new Map<string, PtySession>();

  start(meetingId: string, cwd: string, env: NodeJS.ProcessEnv): void {
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

  runClaude(meetingId: string, initialPrompt: string): void {
    const proc = this.sessions.get(meetingId)?.process;
    if (!proc) return;

    const claudeCommand = process.env.MEETING_ROOM_CLAUDE_CMD || "claude --dangerously-skip-permissions";
    proc.write(`${claudeCommand}\n`);
    setTimeout(() => {
      if (initialPrompt.trim()) {
        proc.write(`${initialPrompt}\n`);
      }
    }, 250);
  }

  write(meetingId: string, data: string): boolean {
    const proc = this.sessions.get(meetingId)?.process;
    if (!proc) return false;
    proc.write(data);
    return true;
  }

  hasSession(meetingId: string): boolean {
    return this.sessions.has(meetingId);
  }

  resize(meetingId: string, cols: number, rows: number): void {
    const proc = this.sessions.get(meetingId)?.process;
    if (!proc) return;
    proc.resize(cols, rows);
  }

  stop(meetingId: string): void {
    const session = this.sessions.get(meetingId);
    if (!session) return;
    session.process.kill();
    this.sessions.delete(meetingId);
  }

  stopAll(): void {
    for (const meetingId of this.sessions.keys()) {
      this.stop(meetingId);
    }
  }

  defaultProjectDir(): string {
    return path.resolve(process.cwd(), "..");
  }

  defaultEnv(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      SHELL: process.env.SHELL || "zsh",
      HOME: process.env.HOME || os.homedir(),
      PATH: process.env.PATH || "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    };
  }
}
