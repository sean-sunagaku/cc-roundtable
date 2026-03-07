import { useEffect, useState } from "react";
import type { MeetingRoomClient } from "@shared/meeting-room-client";
import type { ClaudeSessionDebug } from "@shared/types";
import { TerminalPane } from "../components/TerminalPane";

interface Props {
  client: MeetingRoomClient;
  meetingId: string;
  canOpenDevTools?: boolean;
}

export function SessionDebugWindow({ client, meetingId, canOpenDevTools }: Props): JSX.Element {
  const [debug, setDebug] = useState<ClaudeSessionDebug | null>(null);
  const initialTail = debug?.tail?.join("\n") ?? "";

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      const result = await client.getSessionDebug(meetingId);
      if (!disposed) setDebug(result);
    };
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 1500);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [client, meetingId]);

  return (
    <div className="meeting-wrap">
      <header className="meeting-header">
        <div>
          <h2>Claude Session Debug</h2>
          <p className="subtle">meetingId: {meetingId}</p>
        </div>
        <div className="actions">
          {canOpenDevTools ? (
            <button type="button" onClick={() => void client.openDevTools?.()}>
              Open DevTools
            </button>
          ) : null}
        </div>
      </header>

      <section className="health-row">
        <div className={`health-card ${debug?.hasUsageLimit ? "warn" : "ok"}`}>
          <strong>Usage Limit Flag</strong>
          <p>{debug?.hasUsageLimit ? "Detected" : "Not detected"}</p>
        </div>
        <div className={`health-card ${debug?.hasMcpError ? "warn" : "ok"}`}>
          <strong>MCP Error Flag</strong>
          <p>{debug?.hasMcpError ? "Detected" : "Not detected"}</p>
        </div>
      </section>

      <div className="session-debug-terminal">
        <TerminalPane
          meetingId={meetingId}
          onResize={client.resizeTerminal}
          subscribeData={client.onTerminalData}
          writeData={client.writeTerminal}
          initialContent={initialTail || "(no session output yet)"}
        />
      </div>
    </div>
  );
}
