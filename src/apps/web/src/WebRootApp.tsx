import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { MeetingRoomShell } from "@renderer/MeetingRoomShell";
import { BrowserMeetingRoomClient } from "./browser-meeting-room-client";

const WEB_DAEMON_TOKEN_STORAGE_KEY = "meeting-room-web-daemon-token";
const WEB_DAEMON_TOKEN_ENABLED_STORAGE_KEY = "meeting-room-web-daemon-token-enabled";

export function WebRootApp(): JSX.Element {
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialToken = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.sessionStorage.getItem(WEB_DAEMON_TOKEN_STORAGE_KEY) ?? "";
  }, []);
  const initialPasswordEnabled = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.sessionStorage.getItem(WEB_DAEMON_TOKEN_ENABLED_STORAGE_KEY) === "1";
  }, []);
  const [client, setClient] = useState<BrowserMeetingRoomClient | null>(null);
  const [password, setPassword] = useState(initialToken);
  const [passwordEnabled, setPasswordEnabled] = useState(initialPasswordEnabled);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const daemonOrigin = useMemo(() => window.location.origin.replace(/\/$/, ""), []);

  useEffect(() => {
    void connect(initialToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      client?.dispose();
    };
  }, [client]);

  const savePassword = (nextPassword: string): void => {
    if (typeof window === "undefined") {
      return;
    }
    if (nextPassword) {
      window.sessionStorage.setItem(WEB_DAEMON_TOKEN_STORAGE_KEY, nextPassword);
      return;
    }
    window.sessionStorage.removeItem(WEB_DAEMON_TOKEN_STORAGE_KEY);
  };

  const savePasswordEnabled = (nextValue: boolean): void => {
    if (typeof window === "undefined") {
      return;
    }
    if (nextValue) {
      window.sessionStorage.setItem(WEB_DAEMON_TOKEN_ENABLED_STORAGE_KEY, "1");
      return;
    }
    window.sessionStorage.removeItem(WEB_DAEMON_TOKEN_ENABLED_STORAGE_KEY);
  };

  const connect = async (tokenOverride = password) => {
    const token = passwordEnabled ? tokenOverride.trim() : "";
    setConnecting(true);
    setConnectionError("");
    const nextClient = new BrowserMeetingRoomClient({
      baseUrl: daemonOrigin,
      token
    });
    try {
      await nextClient.connect();
      client?.dispose();
      setClient(nextClient);
      savePassword(token);
    } catch (error) {
      nextClient.dispose();
      setClient(null);
      if (token) {
        savePassword("");
      }
      const message = error instanceof Error ? error.message : "daemon connection failed";
      if (/401|unauthorized/i.test(message)) {
        setPasswordEnabled(true);
        savePasswordEnabled(true);
      }
      setConnectionError(message);
    } finally {
      setConnecting(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void connect();
  };

  const showPasswordPrompt = !client;
  const isUnauthorized = /401|unauthorized/i.test(connectionError);

  return (
    <div className="web-client-shell">
      {connectionError ? (
        <div className="web-connection-error" role="alert">
          <strong>{isUnauthorized ? "パスワードが一致しませんでした。" : "daemon に接続できませんでした。"}</strong>
          <span>{connectionError}</span>
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
          <p className="subtle">共有 URL 用の接続パスワードを入力して daemon に接続します。</p>
          {showPasswordPrompt ? (
            <form className="web-password-card" onSubmit={handleSubmit}>
              <label className="web-password-toggle">
                <input
                  type="checkbox"
                  checked={passwordEnabled}
                  disabled={connecting}
                  onChange={(event) => {
                    const nextValue = event.target.checked;
                    setPasswordEnabled(nextValue);
                    savePasswordEnabled(nextValue);
                    setConnectionError("");
                  }}
                />
                <span>接続パスワードを使う</span>
              </label>
              {passwordEnabled ? (
                <label className="web-password-field">
                  <span>接続パスワード</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="MEETING_ROOM_DAEMON_TOKEN"
                    disabled={connecting}
                  />
                </label>
              ) : null}
              <div className="web-password-actions">
                <button type="submit" disabled={connecting}>
                  {connecting ? "接続中..." : password.trim() ? "接続する" : "パスワードなしで接続"}
                </button>
                {passwordEnabled && password ? (
                  <button
                    type="button"
                    className="secondary"
                    disabled={connecting}
                    onClick={() => {
                      setPassword("");
                      savePassword("");
                      setConnectionError("");
                    }}
                  >
                    クリア
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}
        </div>
      )}
    </div>
  );
}
