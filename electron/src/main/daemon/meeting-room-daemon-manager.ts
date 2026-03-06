import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import {
  MEETING_ROOM_DAEMON_COMMANDS_PATH,
  MEETING_ROOM_DAEMON_DEFAULT_HOST,
  MEETING_ROOM_DAEMON_DEFAULT_PORT,
  MEETING_ROOM_DAEMON_EVENTS_PATH,
  MEETING_ROOM_DAEMON_HEALTH_PATH,
  MEETING_ROOM_DAEMON_META_PATH,
  MEETING_ROOM_DAEMON_SESSIONS_PATH,
  type MeetingRoomDaemonCommand,
  type MeetingRoomDaemonCommandAck,
  type MeetingRoomDaemonCommandEnvelope,
  type MeetingRoomDaemonHealthResponse,
  type MeetingRoomDaemonMetaPayload,
  type MeetingSessionViewPayload,
  type MeetingTabPayload,
  type MeetingRoomDaemonStreamFrame
} from "../../../../packages/shared-contracts/src/meeting-room-daemon";

export interface MeetingRoomDaemonManagerOptions {
  host?: string;
  port?: number;
  cwd?: string;
  entryFile?: string;
  token?: string;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
}

type FrameHandler = (frame: MeetingRoomDaemonStreamFrame) => void;

export class MeetingRoomDaemonManager {
  private readonly host: string;
  private readonly port: number;
  private readonly cwd: string;
  private readonly entryFile: string;
  private readonly token: string | null;
  private readonly onStdout: (chunk: string) => void;
  private readonly onStderr: (chunk: string) => void;
  private readonly onExit: (code: number | null, signal: NodeJS.Signals | null) => void;
  private child: ChildProcess | null = null;
  private streamAbortController: AbortController | null = null;

  constructor(options: MeetingRoomDaemonManagerOptions = {}) {
    this.host = options.host ?? process.env.MEETING_ROOM_DAEMON_HOST ?? MEETING_ROOM_DAEMON_DEFAULT_HOST;
    this.port = options.port ?? parsePort(process.env.MEETING_ROOM_DAEMON_PORT) ?? MEETING_ROOM_DAEMON_DEFAULT_PORT;
    this.cwd = options.cwd ?? path.resolve(process.cwd(), "..");
    this.entryFile = options.entryFile ?? path.resolve(this.cwd, "services/meeting-room-daemon/dist/index.js");
    this.token = options.token ?? process.env.MEETING_ROOM_DAEMON_TOKEN?.trim() ?? null;
    this.onStdout = options.onStdout ?? (() => undefined);
    this.onStderr = options.onStderr ?? (() => undefined);
    this.onExit = options.onExit ?? (() => undefined);
  }

  async start(): Promise<MeetingRoomDaemonHealthResponse> {
    const existing = await this.tryHealth();
    if (existing) {
      return existing;
    }

    if (!this.child) {
      this.spawnChild();
    }
    return this.waitUntilHealthy();
  }

  async waitUntilHealthy(timeoutMs = 10_000): Promise<MeetingRoomDaemonHealthResponse> {
    const startedAt = Date.now();
    let lastError: unknown;

    while (Date.now() - startedAt < timeoutMs) {
      try {
        return await this.health();
      } catch (error) {
        lastError = error;
        await delay(250);
      }
    }

    throw new Error(`meeting-room-daemon did not become healthy in time: ${String(lastError)}`);
  }

  async health(): Promise<MeetingRoomDaemonHealthResponse> {
    const response = await fetch(this.url(MEETING_ROOM_DAEMON_HEALTH_PATH), {
      headers: this.headers()
    });
    if (!response.ok) {
      throw new Error(`Health request failed with ${response.status}`);
    }
    return response.json() as Promise<MeetingRoomDaemonHealthResponse>;
  }

  async listSessions(): Promise<MeetingTabPayload[]> {
    const response = await fetch(this.url(MEETING_ROOM_DAEMON_SESSIONS_PATH), {
      headers: this.headers()
    });
    if (!response.ok) {
      throw new Error(`List sessions request failed with ${response.status}`);
    }
    const payload = await response.json() as { sessions: MeetingTabPayload[] };
    return payload.sessions;
  }

  async getSessionView(meetingId: string): Promise<MeetingSessionViewPayload | null> {
    const response = await fetch(this.url(`${MEETING_ROOM_DAEMON_SESSIONS_PATH}/${encodeURIComponent(meetingId)}`), {
      headers: this.headers()
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Get session view request failed with ${response.status}`);
    }
    return response.json() as Promise<MeetingSessionViewPayload>;
  }

  async getMeta(): Promise<MeetingRoomDaemonMetaPayload> {
    const response = await fetch(this.url(MEETING_ROOM_DAEMON_META_PATH), {
      headers: this.headers()
    });
    if (!response.ok) {
      throw new Error(`Meta request failed with ${response.status}`);
    }
    return response.json() as Promise<MeetingRoomDaemonMetaPayload>;
  }

  createEnvelope(command: MeetingRoomDaemonCommand): MeetingRoomDaemonCommandEnvelope {
    return {
      commandId: randomUUID(),
      sentAt: new Date().toISOString(),
      command
    };
  }

  async dispatch(envelope: MeetingRoomDaemonCommandEnvelope): Promise<MeetingRoomDaemonCommandAck> {
    const response = await fetch(this.url(MEETING_ROOM_DAEMON_COMMANDS_PATH), {
      method: "POST",
      headers: {
        ...this.headers(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(envelope)
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Command request failed with ${response.status}: ${body}`);
    }

    return response.json() as Promise<MeetingRoomDaemonCommandAck>;
  }

  async subscribe(handler: FrameHandler): Promise<() => void> {
    this.streamAbortController?.abort();
    const abortController = new AbortController();
    this.streamAbortController = abortController;

    const response = await fetch(this.url(MEETING_ROOM_DAEMON_EVENTS_PATH), {
      headers: {
        ...this.headers(),
        Accept: "text/event-stream"
      },
      signal: abortController.signal
    });

    if (!response.ok || !response.body) {
      throw new Error(`SSE request failed with ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const consume = async (): Promise<void> => {
      while (!abortController.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const rawFrame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const frame = parseSseFrame(rawFrame);
          if (frame) {
            handler(frame);
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
    };

    void consume().catch((error) => {
      if (abortController.signal.aborted) {
        return;
      }
      this.onStderr(`meeting-room-daemon SSE stream failed: ${String(error)}\n`);
    });

    return () => {
      abortController.abort();
      if (this.streamAbortController === abortController) {
        this.streamAbortController = null;
      }
    };
  }

  async stop(): Promise<void> {
    this.streamAbortController?.abort();
    this.streamAbortController = null;

    if (!this.child) {
      return;
    }

    const child = this.child;
    this.child = null;
    await new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
      }, 1500);
    });
  }

  async dispose(): Promise<void> {
    await this.stop();
  }

  private async tryHealth(): Promise<MeetingRoomDaemonHealthResponse | null> {
    try {
      return await this.health();
    } catch {
      return null;
    }
  }

  private spawnChild(): void {
    if (!fs.existsSync(this.entryFile)) {
      throw new Error(`meeting-room-daemon entry file was not found: ${this.entryFile}`);
    }

    const child = spawn(process.execPath, [this.entryFile], {
      cwd: this.cwd,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        NODE_PATH: [
          path.resolve(this.cwd, "electron/node_modules"),
          process.env.NODE_PATH ?? ""
        ]
          .filter(Boolean)
          .join(path.delimiter),
        MEETING_ROOM_DAEMON_HOST: this.host,
        MEETING_ROOM_DAEMON_PORT: `${this.port}`
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout?.on("data", (chunk) => this.onStdout(chunk.toString()));
    child.stderr?.on("data", (chunk) => this.onStderr(chunk.toString()));
    child.once("exit", (code, signal) => {
      if (this.child === child) {
        this.child = null;
      }
      this.onExit(code, signal);
    });
    this.child = child;
  }

  private url(pathname: string): string {
    return new URL(pathname, `http://${this.host}:${this.port}`).toString();
  }

  private headers(): Record<string, string> {
    if (!this.token) {
      return {};
    }
    return {
      Authorization: `Bearer ${this.token}`
    };
  }
}

function parsePort(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseSseFrame(rawFrame: string): MeetingRoomDaemonStreamFrame | null {
  const dataLines = rawFrame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart());

  if (dataLines.length === 0) {
    return null;
  }

  return JSON.parse(dataLines.join("\n")) as MeetingRoomDaemonStreamFrame;
}
