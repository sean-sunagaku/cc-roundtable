import { WebSocketServer } from "ws";
import type { AgentMessagePayload } from "@shared/types";

export type RelayHandler = (payload: AgentMessagePayload) => void;

export class RelayServer {
  private wss: WebSocketServer | null = null;
  private readonly handlers = new Set<RelayHandler>();

  start(port = 9999): void {
    if (this.wss) return;
    this.wss = new WebSocketServer({ port });

    this.wss.on("connection", (socket) => {
      socket.on("message", (buffer) => {
        try {
          const payload = JSON.parse(buffer.toString()) as AgentMessagePayload;
          if (payload && (payload.type === "agent_message" || payload.type === "agent_status")) {
            for (const handler of this.handlers) {
              handler(payload);
            }
          }
        } catch {
          // Ignore malformed payloads.
        }
      });
    });
  }

  onRelay(handler: RelayHandler): void {
    this.handlers.add(handler);
  }

  close(): void {
    if (!this.wss) return;
    this.wss.close();
    this.wss = null;
    this.handlers.clear();
  }
}
