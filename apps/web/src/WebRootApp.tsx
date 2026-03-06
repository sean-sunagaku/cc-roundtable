import { FormEvent, useEffect, useMemo, useState } from "react";
import { MeetingRoomShell } from "@renderer/MeetingRoomShell";
import { BrowserMeetingRoomClient } from "./browser-meeting-room-client";

const STORAGE_KEY = "meeting-room-web-client-config";

interface StoredConfig {
  baseUrl?: string;
  token?: string;
}

function readStoredConfig(): StoredConfig {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredConfig;
  } catch {
    return {};
  }
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, "");
}

export function WebRootApp(): JSX.Element {
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const stored = useMemo(() => readStoredConfig(), []);
  const initialBaseUrl = normalizeBaseUrl(query.get("baseUrl") ?? stored.baseUrl ?? window.location.origin);
  const initialToken = query.get("token") ?? stored.token ?? "";
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl);
  const [token, setToken] = useState(initialToken);
  const [client, setClient] = useState<BrowserMeetingRoomClient | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState("");

  useEffect(() => {
    void connect(initialBaseUrl, initialToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      client?.dispose();
    };
  }, [client]);

  const connect = async (nextBaseUrl: string, nextToken: string) => {
    const normalizedBaseUrl = normalizeBaseUrl(nextBaseUrl) || window.location.origin;
    setConnecting(true);
    setConnectionError("");
    const nextClient = new BrowserMeetingRoomClient({
      baseUrl: normalizedBaseUrl,
      token: nextToken
    });
    try {
      await nextClient.connect();
      client?.dispose();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        baseUrl: normalizedBaseUrl,
        token: nextToken
      }));
      setClient(nextClient);
      setBaseUrl(normalizedBaseUrl);
      setToken(nextToken);
    } catch (error) {
      nextClient.dispose();
      const message = error instanceof Error ? error.message : "daemon connection failed";
      setConnectionError(message);
    } finally {
      setConnecting(false);
    }
  };

  const submitConnection = async (event: FormEvent) => {
    event.preventDefault();
    await connect(baseUrl, token);
  };

  return (
    <div className="web-client-shell">
      <form className="web-connection-bar" onSubmit={(event) => void submitConnection(event)}>
        <div className="web-connection-copy">
          <strong>ブラウザ版 Meeting Room</strong>
          <span className="subtle">この画面は Web UI です。接続先の daemon URL と token を切り替えて会議を操作できます。</span>
        </div>
        <label>
          Base URL
          <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
        </label>
        <label>
          Bearer Token
          <input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="任意" />
        </label>
        <button type="submit" disabled={connecting}>
          {connecting ? "接続中..." : "Reconnect"}
        </button>
      </form>

      {connectionError ? (
        <div className="web-connection-error" role="alert">
          接続失敗: {connectionError}
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
