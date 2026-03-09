import { WebSocketServer } from "ws";
import type { AgentMessagePayload } from "@shared/types";
import { RESPONSE_MARKERS } from "@contracts/hook-contract";

export type RelayHandler = (payload: AgentMessagePayload) => void;

const RESPONSE_MARKER_START = RESPONSE_MARKERS.start;
const RESPONSE_MARKER_END = RESPONSE_MARKERS.end;

function extractMarkedContent(content: string): string {
  const start = content.indexOf(RESPONSE_MARKER_START);
  if (start < 0) return content;

  const bodyStart = start + RESPONSE_MARKER_START.length;
  const end = content.indexOf(RESPONSE_MARKER_END, bodyStart);
  if (end < 0) return content;

  return content.slice(bodyStart, end).trim();
}

export class RelayServer {
  private wss: WebSocketServer | null = null;
  private readonly handlers = new Set<RelayHandler>();

  start(port = 9999): void {
    if (this.wss) return;
    this.wss = new WebSocketServer({ port });

    this.wss.on("connection", (socket) => {
      socket.on("message", (buffer) => {
        try {
          const parsed = JSON.parse(buffer.toString()) as AgentMessagePayload;
          if (!parsed) return;

          let payload: AgentMessagePayload = parsed;
          if (payload.type === "agent_message" && typeof payload.content === "string") {
            payload = {
              ...payload,
              content: extractMarkedContent(payload.content)
            };
            if (!payload.content.trim()) {
              return;
            }
          }

          if (payload.type === "agent_message" || payload.type === "agent_status") {
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
