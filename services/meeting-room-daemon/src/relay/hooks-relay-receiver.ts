import path from "node:path";
import { createRequire } from "node:module";
import { RELAY_PAYLOAD_TYPES } from "@contracts/hook-contract";
import { HOOKS_WS_PORT } from "../constants";
import { extractMarkedContent } from "../runtime/terminal-utils";
import type { RelayPayload } from "../types";
import { resolveRepoRoot } from "../utils";

const requireFromRepo = createRequire(__filename);

export class HooksRelayReceiver {
  private server: { close(cb?: () => void): void } | null = null;

  constructor(private readonly port = HOOKS_WS_PORT) {}

  start(onPayload: (payload: RelayPayload) => void): void {
    if (this.server) return;
    const wsModule = requireFromRepo(path.resolve(resolveRepoRoot(), "electron/node_modules/ws")) as {
      WebSocketServer: new (options: { port: number }) => {
        on(
          event: "connection",
          handler: (socket: { on(event: "message", handler: (buffer: Buffer) => void): void }) => void
        ): void;
        close(cb?: () => void): void;
      };
    };
    const WebSocketServer = wsModule.WebSocketServer;
    const server = new WebSocketServer({ port: this.port });
    server.on("connection", (socket) => {
      socket.on("message", (buffer) => {
        try {
          const payload = JSON.parse(buffer.toString()) as RelayPayload;
          if (!payload || (payload.type !== RELAY_PAYLOAD_TYPES.agentMessage && payload.type !== RELAY_PAYLOAD_TYPES.agentStatus)) {
            return;
          }
          if (payload.type === RELAY_PAYLOAD_TYPES.agentMessage) {
            payload.content = extractMarkedContent(payload.content ?? "");
            if (!payload.content.trim()) {
              return;
            }
          }
          onPayload(payload);
        } catch {
          // Ignore malformed relay payloads.
        }
      });
    });
    this.server = server;
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    const server = this.server;
    this.server = null;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
