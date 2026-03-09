import { useEffect, useMemo, useState } from "react";
import { MeetingRoomShell } from "@renderer/MeetingRoomShell";
import { BrowserMeetingRoomClient } from "./browser-meeting-room-client";

export function WebRootApp(): JSX.Element {
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const [client, setClient] = useState<BrowserMeetingRoomClient | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const daemonOrigin = useMemo(() => window.location.origin.replace(/\/$/, ""), []);

  useEffect(() => {
    void connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      client?.dispose();
    };
  }, [client]);

  const connect = async () => {
    setConnecting(true);
    setConnectionError("");
    const nextClient = new BrowserMeetingRoomClient({
      baseUrl: daemonOrigin,
      token: ""
    });
    try {
      await nextClient.connect();
      client?.dispose();
      setClient(nextClient);
    } catch (error) {
      nextClient.dispose();
      const message = error instanceof Error ? error.message : "daemon connection failed";
      setConnectionError(message);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="web-client-shell">
      {connectionError ? (
        <div className="web-connection-error" role="alert">
          <strong>daemon に接続できませんでした。</strong>
          <span>{connectionError}</span>
          <button type="button" onClick={() => void connect()} disabled={connecting}>
            {connecting ? "再接続中..." : "再試行"}
          </button>
        </div>
      ) : null}

      {client ? (
        <MeetingRoomShell
          client={client}
          debugWindow={query.get("debugWindow") === "1"}
          debugMeetingId={query.get("meetingId") ?? ""}
          canOpenSessionDebugWindow
        />
      ) : (
        <div className="meeting-wrap">
          <h2>Meeting Room Web</h2>
          <p className="subtle">daemon への接続を待っています。</p>
        </div>
      )}
    </div>
  );
}
