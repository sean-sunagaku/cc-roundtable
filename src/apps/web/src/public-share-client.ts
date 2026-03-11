import type {
  MeetingRoomPublicShareBootstrapPayload,
  MeetingRoomPublicShareControlPayload,
  MeetingRoomPublicShareMessagePayload,
  MeetingRoomPublicShareStreamFrame,
  PublicShareControlAction
} from "@contracts/meeting-room-daemon";

type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "error";
type ConnectionListener = (state: ConnectionState, errorMessage?: string) => void;
type FrameListener = (frame: MeetingRoomPublicShareStreamFrame) => void;

const RECONNECT_BACKOFF_MS = [500, 1000, 2000, 5000];

export class PublicShareClient {
  private readonly baseUrl: string;
  private readonly shareId: string;
  private streamAbortController: AbortController | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private shouldReconnect = false;
  private readonly connectionListeners = new Set<ConnectionListener>();
  private readonly frameListeners = new Set<FrameListener>();
  private paths: Pick<
    MeetingRoomPublicShareBootstrapPayload,
    "eventsPath" | "messagePath" | "controlPath"
  > | null = null;

  constructor(shareId: string, baseUrl = window.location.origin) {
    this.shareId = shareId;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async bootstrap(): Promise<MeetingRoomPublicShareBootstrapPayload> {
    const payload = await this.request<MeetingRoomPublicShareBootstrapPayload>(
      `/share-api/${encodeURIComponent(this.shareId)}/bootstrap`
    );
    this.paths = {
      eventsPath: payload.eventsPath,
      messagePath: payload.messagePath,
      controlPath: payload.controlPath
    };
    return payload;
  }

  async connect(): Promise<MeetingRoomPublicShareBootstrapPayload> {
    this.shouldReconnect = true;
    this.reconnectAttempt = 0;
    this.notifyConnection("connecting");
    const payload = await this.bootstrap();
    this.startEventStream();
    return payload;
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.streamAbortController?.abort();
    this.streamAbortController = null;
    this.notifyConnection("idle");
  }

  dispose(): void {
    this.disconnect();
  }

  onConnectionState(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  onFrame(listener: FrameListener): () => void {
    this.frameListeners.add(listener);
    return () => {
      this.frameListeners.delete(listener);
    };
  }

  async sendMessage(message: string): Promise<void> {
    const body = { message } satisfies MeetingRoomPublicShareMessagePayload;
    await this.request(this.requirePaths().messagePath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  async sendControl(action: PublicShareControlAction): Promise<void> {
    const body = { action } satisfies MeetingRoomPublicShareControlPayload;
    await this.request(this.requirePaths().controlPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  private requirePaths() {
    if (!this.paths) {
      throw new Error("Public share bootstrap is not ready.");
    }
    return this.paths;
  }

  private async request<T = unknown>(requestPath: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${requestPath}`, {
      ...init,
      cache: "no-store"
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${response.status} ${body}`);
    }
    return response.json() as Promise<T>;
  }

  private startEventStream(): void {
    this.streamAbortController?.abort();
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const controller = new AbortController();
    this.streamAbortController = controller;
    void this.consumeEventStream(controller.signal);
  }

  private async consumeEventStream(signal: AbortSignal): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}${this.requirePaths().eventsPath}`, {
        headers: { Accept: "text/event-stream" },
        cache: "no-store",
        signal
      });
      if (!response.ok || !response.body) {
        throw new Error(`SSE ${response.status}`);
      }
      this.notifyConnection("connected");
      this.reconnectAttempt = 0;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const raw = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const dataLines = raw
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim());
          if (dataLines.length > 0) {
            const frame = JSON.parse(dataLines.join("\n")) as MeetingRoomPublicShareStreamFrame;
            for (const listener of this.frameListeners) {
              listener(frame);
            }
            if (frame.event.payload.session.tab.status === "ended") {
              this.shouldReconnect = false;
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      }

      if (!signal.aborted) {
        this.scheduleReconnect("SSE closed");
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }
      this.scheduleReconnect(error instanceof Error ? error.message : String(error));
    }
  }

  private scheduleReconnect(errorMessage: string): void {
    if (!this.shouldReconnect) {
      return;
    }
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
    }
    const delay =
      RECONNECT_BACKOFF_MS[Math.min(this.reconnectAttempt, RECONNECT_BACKOFF_MS.length - 1)];
    this.reconnectAttempt += 1;
    this.notifyConnection("reconnecting", errorMessage);
    this.reconnectTimer = window.setTimeout(() => {
      this.startEventStream();
    }, delay);
  }

  private notifyConnection(state: ConnectionState, errorMessage?: string): void {
    for (const listener of this.connectionListeners) {
      listener(state, errorMessage);
    }
  }
}
