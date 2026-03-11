import { useEffect, useMemo, useState } from "react";
import type {
  MeetingRoomPublicShareSessionPayload,
  MeetingRoomPublicShareStreamFrame,
  PublicShareControlAction
} from "@contracts/meeting-room-daemon";
import type { ChatMessage } from "@shared/types";
import { ChatView } from "@renderer/components/ChatView";
import { ConnectionStatus } from "@renderer/components/ConnectionStatus";
import { InputBar } from "@renderer/components/InputBar";
import { PublicShareClient } from "./public-share-client";

type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "error";

function readShareIdFromPath(): string {
  const match = window.location.pathname.match(/^\/share\/([^/]+)/);
  return decodeURIComponent(match?.[1] ?? "");
}

function controlLabel(action: PublicShareControlAction): string {
  switch (action) {
    case "pause":
      return "一時停止";
    case "resume":
      return "再開";
    case "retryMcp":
      return "MCP 再試行";
    case "endMeeting":
      return "会議終了";
  }
}

export function PublicShareApp(): JSX.Element {
  const shareId = readShareIdFromPath();
  const [client] = useState(() => new PublicShareClient(shareId));
  const [session, setSession] = useState<MeetingRoomPublicShareSessionPayload | null>(null);
  const [allowedActions, setAllowedActions] = useState<PublicShareControlAction[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [connectionError, setConnectionError] = useState("");
  const [controlPending, setControlPending] = useState<PublicShareControlAction | "">("");

  useEffect(() => {
    let active = true;

    const offConnection = client.onConnectionState((state, errorMessage) => {
      if (!active) return;
      setConnectionState(state);
      setConnectionError(state === "error" || state === "reconnecting" ? (errorMessage ?? "") : "");
    });

    const offFrame = client.onFrame((frame: MeetingRoomPublicShareStreamFrame) => {
      if (!active) return;
      if (frame.event.type === "public.session.updated") {
        setSession(frame.event.payload.session);
      }
    });

    void client
      .connect()
      .then((payload) => {
        if (!active) return;
        setSession(payload.session);
        setAllowedActions(payload.allowedActions);
        setConnectionError("");
      })
      .catch((error) => {
        if (!active) return;
        setConnectionState("error");
        setConnectionError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      active = false;
      offConnection();
      offFrame();
      client.dispose();
    };
  }, [client]);

  const messages = useMemo(
    () => (session?.messages ?? []).map((entry) => ({ ...entry }) satisfies ChatMessage),
    [session?.messages]
  );

  const handleSend = async (nextMessage: string) => {
    try {
      await client.sendMessage(nextMessage);
      setConnectionError("");
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : String(error));
    }
  };

  const sendControl = async (action: PublicShareControlAction) => {
    setControlPending(action);
    try {
      await client.sendControl(action);
      setConnectionError("");
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : String(error));
    } finally {
      setControlPending("");
    }
  };

  return (
    <div className="meeting-wrap share-meeting-wrap">
      <header className="meeting-header">
        <div>
          <h2>{session?.tab.title ?? "Public Share"}</h2>
          <ConnectionStatus connected={connectionState === "connected"} />
          <p className="subtle share-subtitle">
            固定デモ会議にそのまま参加できます。ローカルの任意ディレクトリや terminal
            には触れません。
          </p>
        </div>
        <div className="actions">
          {allowedActions.map((action) => (
            <button
              key={action}
              type="button"
              className={action === "endMeeting" ? "danger" : ""}
              disabled={controlPending !== "" || !session || !canUseAction(action, session)}
              onClick={() => {
                void sendControl(action);
              }}
            >
              {controlPending === action ? "処理中..." : controlLabel(action)}
            </button>
          ))}
        </div>
      </header>

      <section className="status-row">
        <span className="mode-pill">Public Share</span>
        <span className="agent-status active">shareId: {shareId || "share"}</span>
        <span
          className={`agent-status ${session?.tab.status === "running" ? "completed" : "active"}`}
        >
          status: {session?.tab.status ?? connectionState}
        </span>
        {Object.entries(session?.agentStatuses ?? {}).map(([agent, status]) => (
          <span key={agent} className={`agent-status ${status}`}>
            {agent}: {status}
          </span>
        ))}
      </section>

      {session?.approvalGate.mode === "blocked" && !session.approvalGate.bypassMode ? (
        <section className="approval-gate-card">
          <div>
            <p className="approval-gate-label">承認待ち</p>
            <strong>この固定デモ会議は現在レビュー待ちです。</strong>
            <p className="subtle">
              {session.approvalGate.reason?.startsWith("agent:")
                ? `${session.approvalGate.reason.slice("agent:".length)} の返答確認待ちです。`
                : "会議の次アクションが確認待ちです。"}
            </p>
          </div>
        </section>
      ) : null}

      {connectionError ? (
        <p className="error-text share-error-text" role="alert">
          {connectionError}
        </p>
      ) : null}

      <section className="share-note-card">
        <div>
          <strong>Conversation</strong>
          <p className="subtle">固定会議の流れをそのまま追いながら、短い操作と発言ができます。</p>
        </div>
        <div className="share-runtime-strip">
          {session?.runtimeEvents.slice(-2).map((event) => (
            <div
              key={`${event.timestamp}-${event.message}`}
              className={`runtime-event ${event.type}`}
            >
              <strong>{event.type}</strong>
              <p>{event.message}</p>
            </div>
          ))}
        </div>
      </section>

      <ChatView messages={messages} />
      <InputBar disabled={!session || session.tab.status === "ended"} onSend={handleSend} />
    </div>
  );
}

function canUseAction(
  action: PublicShareControlAction,
  session: MeetingRoomPublicShareSessionPayload
): boolean {
  switch (action) {
    case "pause":
      return session.tab.status === "running";
    case "resume":
      return session.tab.status === "paused" || session.tab.status === "awaiting_review";
    case "retryMcp":
      return (
        session.tab.status === "running" ||
        session.tab.status === "paused" ||
        session.tab.status === "awaiting_review"
      );
    case "endMeeting":
      return session.tab.status !== "ended";
  }
}
