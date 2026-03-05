import { useMemo, useState } from "react";
import type { ChatMessage, ClaudeSessionDebug, ConversationHealth, MeetingTab, RuntimeEvent } from "@shared/types";
import { ChatView } from "../components/ChatView";
import { ConnectionStatus } from "../components/ConnectionStatus";
import { InputBar } from "../components/InputBar";
import { TerminalPane } from "../components/TerminalPane";

interface Props {
  tabs: MeetingTab[];
  currentTabId: string;
  messages: ChatMessage[];
  wsConnected: boolean;
  onSwitchTab: (tabId: string) => void;
  onSend: (message: string) => Promise<void>;
  onEnd: () => Promise<void>;
  onControl: (mode: "pause" | "resume" | "settings", extra?: string) => Promise<void>;
  subscribeTerminal: (handler: (meetingId: string, chunk: string) => void) => () => void;
  onResizeTerminal: (meetingId: string, cols: number, rows: number) => Promise<void>;
  agentStatuses: Record<string, "active" | "completed">;
  ending: boolean;
  health: ConversationHealth;
  runtimeEvents: RuntimeEvent[];
  onRetryMcp: () => Promise<void>;
  sessionDebug: ClaudeSessionDebug | null;
  onOpenDevTools: () => Promise<void>;
  onOpenSessionDebugWindow: () => Promise<void>;
}

export function MeetingScreen({
  tabs,
  currentTabId,
  messages,
  wsConnected,
  onSwitchTab,
  onSend,
  onEnd,
  onControl,
  subscribeTerminal,
  onResizeTerminal,
  agentStatuses,
  ending,
  health,
  runtimeEvents,
  onRetryMcp,
  sessionDebug,
  onOpenDevTools,
  onOpenSessionDebugWindow
}: Props): JSX.Element {
  const [showTerminal, setShowTerminal] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState("メンバー追加: researcher");
  const currentTab = useMemo(() => tabs.find((tab) => tab.id === currentTabId), [tabs, currentTabId]);
  const hasMcpError = runtimeEvents.some((event) => event.type === "mcp_error");

  return (
    <div className="meeting-wrap">
      <header className="meeting-header">
        <div>
          <h2>Meeting Room - {currentTab?.title ?? "Unknown"}</h2>
          <ConnectionStatus connected={wsConnected} />
        </div>
        <div className="actions">
          <button type="button" onClick={() => onControl("pause")}>
            一時停止
          </button>
          <button type="button" onClick={() => onControl("resume")}>
            再開
          </button>
          <button type="button" className="danger" onClick={() => void onEnd()} disabled={ending}>
            {ending ? "サマリー保存中..." : "会議終了"}
          </button>
        </div>
      </header>

      <nav className="tab-list">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={tab.id === currentTabId ? "active" : ""}
            onClick={() => onSwitchTab(tab.id)}
          >
            {tab.title}
          </button>
        ))}
      </nav>

      <section className="status-row">
        {Object.entries(agentStatuses).map(([agent, status]) => (
          <span key={agent} className={`agent-status ${status}`}>
            {agent}: {status}
          </span>
        ))}
      </section>

      <section className="health-row">
        <div className={`health-card ${health.inputDeliveredAt ? "ok" : "warn"}`}>
          <strong>Input到達</strong>
          <p>{health.inputDeliveredAt ? `OK (${new Date(health.inputDeliveredAt).toLocaleTimeString("ja-JP")})` : "未確認"}</p>
        </div>
        <div className={`health-card ${health.lastAgentReplyAt ? "ok" : "warn"}`}>
          <strong>Agent返信</strong>
          <p>{health.lastAgentReplyAt ? `受信 (${new Date(health.lastAgentReplyAt).toLocaleTimeString("ja-JP")})` : "未受信"}</p>
        </div>
      </section>

      <section className="runtime-events">
        {runtimeEvents.length === 0 ? (
          <p className="subtle">Claude利用上限・MCP状態の警告はありません。</p>
        ) : (
          runtimeEvents.map((event, idx) => (
            <div key={`${event.timestamp}_${idx}`} className={`runtime-event ${event.type}`}>
              <strong>{event.type === "usage_limit" ? "Claude利用上限" : event.type === "mcp_error" ? "MCPエラー" : "MCP情報"}</strong>
              <p>{event.message}</p>
            </div>
          ))
        )}
        {hasMcpError ? (
          <button type="button" onClick={() => void onRetryMcp()}>
            MCP再試行 (/mcp)
          </button>
        ) : null}
      </section>

      <section className="runtime-events">
        <div className="debug-header">
          <strong>Claude Session Debug</strong>
          <div className="actions">
            <button type="button" onClick={() => void onOpenDevTools()}>
              Open DevTools
            </button>
            <button type="button" onClick={() => void onOpenSessionDebugWindow()}>
              Debugを別Window
            </button>
            <button type="button" onClick={() => setShowDebug((v) => !v)}>
              {showDebug ? "Debugを閉じる" : "Debugを開く"}
            </button>
          </div>
        </div>
        {showDebug ? (
          <>
            <div className="health-row">
              <div className={`health-card ${sessionDebug?.hasUsageLimit ? "warn" : "ok"}`}>
                <strong>Usage Limit Flag</strong>
                <p>{sessionDebug?.hasUsageLimit ? "Detected" : "Not detected"}</p>
              </div>
              <div className={`health-card ${sessionDebug?.hasMcpError ? "warn" : "ok"}`}>
                <strong>MCP Error Flag</strong>
                <p>{sessionDebug?.hasMcpError ? "Detected" : "Not detected"}</p>
              </div>
            </div>
            <pre className="session-tail">{(sessionDebug?.tail ?? []).join("\n") || "(no session output yet)"}</pre>
          </>
        ) : null}
      </section>

      <ChatView messages={messages} />
      <InputBar onSend={onSend} />

      <section className="settings-inline">
        <input value={settingsDraft} onChange={(event) => setSettingsDraft(event.target.value)} />
        <button type="button" onClick={() => onControl("settings", settingsDraft)}>
          会議設定を更新
        </button>
      </section>

      <button className="terminal-toggle" type="button" onClick={() => setShowTerminal((state) => !state)}>
        {showTerminal ? "▲ Terminal を閉じる" : "▼ Terminal を開く"}
      </button>
      {showTerminal && currentTab ? (
        <TerminalPane
          meetingId={currentTab.id}
          onResize={onResizeTerminal}
          subscribeData={subscribeTerminal}
        />
      ) : null}
    </div>
  );
}
