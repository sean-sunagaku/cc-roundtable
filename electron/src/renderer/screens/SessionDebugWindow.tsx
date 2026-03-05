import { useEffect, useState } from "react";
import type { ClaudeSessionDebug } from "@shared/types";
import { TerminalPane } from "../components/TerminalPane";

interface Props {
  meetingId: string;
}

export function SessionDebugWindow({ meetingId }: Props): JSX.Element {
  const [debug, setDebug] = useState<ClaudeSessionDebug | null>(null);
  const initialTail = debug?.tail?.join("\n") ?? "";

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      const result = await window.meetingRoom.getSessionDebug(meetingId);
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
  }, [meetingId]);

  return (
    <div className="meeting-wrap">
      <header className="meeting-header">
        <div>
          <h2>Claude Session Debug</h2>
          <p className="subtle">meetingId: {meetingId}</p>
        </div>
        <div className="actions">
          <button type="button" onClick={() => void window.meetingRoom.openDevTools()}>
            Open DevTools
          </button>
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
          onResize={window.meetingRoom.resizeTerminal}
          subscribeData={window.meetingRoom.onTerminalData}
          initialContent={initialTail || "(no session output yet)"}
        />
      </div>
    </div>
  );
}
