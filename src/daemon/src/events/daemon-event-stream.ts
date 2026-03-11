import type { ServerResponse } from "node:http";
import type {
  MeetingRoomDaemonEvent,
  MeetingRoomDaemonStreamFrame
} from "@contracts/meeting-room-daemon";
import type { EventFrameListener, SseClient } from "../types";

export class DaemonEventStream {
  private readonly clients = new Map<string, SseClient>();
  private readonly listeners = new Map<string, EventFrameListener>();
  private cursor = 0;

  addClient(response: ServerResponse): void {
    const id = `sse_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });
    response.write(": connected\n\n");
    this.clients.set(id, { id, response });
    response.on("close", () => {
      this.clients.delete(id);
    });
  }

  publish(event: MeetingRoomDaemonEvent): void {
    this.cursor += 1;
    const frame: MeetingRoomDaemonStreamFrame = {
      cursor: `${this.cursor}`,
      event
    };
    const payload = `data: ${JSON.stringify(frame)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      try {
        client.response.write(payload);
      } catch {
        this.clients.delete(id);
      }
    }
    for (const [id, listener] of this.listeners.entries()) {
      try {
        listener(frame);
      } catch {
        this.listeners.delete(id);
      }
    }
  }

  subscribe(listener: EventFrameListener): () => void {
    const id = `listener_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.listeners.set(id, listener);
    return () => {
      this.listeners.delete(id);
    };
  }

  closeAll(): void {
    for (const client of this.clients.values()) {
      try {
        client.response.end();
      } catch {
        // Ignore already-closed SSE connections.
      }
    }
    this.clients.clear();
    this.listeners.clear();
  }
}
