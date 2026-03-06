import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ChatMessage, ClaudeSessionDebug, ConversationHealth, MeetingTab, RuntimeEvent } from "@shared/types";
import type { MeetingControlMode } from "@shared/ipc";
import { ChatView } from "../components/ChatView";
import { ConnectionStatus } from "../components/ConnectionStatus";
import { InputBar } from "../components/InputBar";

function formatActivityTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

function toPreviewLine(text: string, maxLength = 220): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (!singleLine) {
    return "";
  }
  if (singleLine.length <= maxLength) {
    return singleLine;
  }
  return `${singleLine.slice(0, maxLength - 1)}…`;
}

function runtimeEventLabel(event: RuntimeEvent): string {
  switch (event.type) {
    case "usage_limit":
      return "Usage Limit";
    case "mcp_error":
      return "MCP Error";
    case "mcp_info":
      return "MCP Info";
    default:
      return "Runtime";
  }
}

function buildActivityPreview(messages: ChatMessage[], runtimeEvents: RuntimeEvent[]): string[] {
  const items: Array<{ at: string; line: string }> = [];

  for (const message of messages.slice(-8)) {
    const content = toPreviewLine(message.content, message.source === "human" ? 110 : 140);
    if (!content) {
      continue;
    }
    items.push({
      at: message.timestamp,
      line: `${message.sender}: ${content}`
    });
  }

  for (const event of runtimeEvents.slice(-4)) {
    const content = toPreviewLine(event.message, 120);
    if (!content) {
      continue;
    }
    items.push({
      at: event.timestamp,
      line: `${runtimeEventLabel(event)}: ${content}`
    });
  }

  return items
    .sort((left, right) => left.at.localeCompare(right.at))
    .slice(-10)
    .map(({ at, line }) => `[${formatActivityTime(at)}] ${line}`);
}

interface Props {
  tabs: MeetingTab[];
  currentTabId: string;
  messages: ChatMessage[];
  wsConnected: boolean;
  onSwitchTab: (tabId: string) => void;
  onSend: (message: string) => Promise<void>;
  onEnd: () => Promise<void>;
  onControl: (mode: MeetingControlMode) => Promise<void>;
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
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showDebugTools, setShowDebugTools] = useState(false);
  const [showSessionTail, setShowSessionTail] = useState(false);
  const currentTab = useMemo(() => tabs.find((tab) => tab.id === currentTabId), [tabs, currentTabId]);
  const hasMcpError = runtimeEvents.some((event) => event.type === "mcp_error");
  const activityLines = useMemo(() => {
    const lines = buildActivityPreview(messages, runtimeEvents);
    if (lines.length > 0) {
      return lines;
    }
    if (sessionDebug?.lastUpdatedAt) {
      return [
        `[${formatActivityTime(sessionDebug.lastUpdatedAt)}] セッションは起動中です。詳細な生ログは「別 Window」で確認できます。`
      ];
    }
    return ["(no session output yet)"];
  }, [messages, runtimeEvents, sessionDebug?.lastUpdatedAt]);

  return (
    <div className="meeting-wrap">
      <header className="meeting-header">
        <div>
          <h2>{currentTab?.title ?? "Meeting"}</h2>
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
            {ending ? "保存中..." : "会議終了"}
          </button>
        </div>
      </header>

      {tabs.length > 1 ? (
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
      ) : null}

      <section className="status-row">
        {Object.entries(agentStatuses).map(([agent, status]) => (
          <span key={agent} className={`agent-status ${status}`}>
            {agent}: {status}
          </span>
        ))}
      </section>

      <ChatView messages={messages} />
      <InputBar onSend={onSend} />

      <section className="debug-tools">
        <div className="debug-toggle-row">
          <button className="terminal-toggle" type="button" onClick={() => setShowTerminal((state) => !state)}>
            {showTerminal ? <ChevronUp size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
            {" "}Terminal
          </button>
          <button className="terminal-toggle" type="button" onClick={() => setShowDiagnostics((value) => !value)}>
            {showDiagnostics ? <ChevronUp size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
            {" "}Diagnostics
          </button>
        </div>

        {showTerminal || showDiagnostics ? (
          <div className="debug-drawer">
            {showTerminal ? (
              <div className="debug-block">
                <section className="terminal-preview">
                  <pre>{activityLines.join("\n")}</pre>
                </section>
                <p className="subtle">詳細な生ログは「別 Window」で確認できます。</p>
              </div>
            ) : null}

            {showDiagnostics ? (
              <section className="debug-block">
                <section className="health-row">
                  <div className={`health-card ${health.inputDeliveredAt ? "ok" : "warn"}`}>
                    <strong>Input 到達</strong>
                    <p>{health.inputDeliveredAt ? `OK (${new Date(health.inputDeliveredAt).toLocaleTimeString("ja-JP")})` : "未確認"}</p>
                  </div>
                  <div className={`health-card ${health.lastAgentReplyAt ? "ok" : "warn"}`}>
                    <strong>Agent 返信</strong>
                    <p>{health.lastAgentReplyAt ? `受信 (${new Date(health.lastAgentReplyAt).toLocaleTimeString("ja-JP")})` : "未受信"}</p>
                  </div>
                </section>

                <section className="runtime-events">
                  {runtimeEvents.length === 0 ? (
                    <p className="subtle">警告なし</p>
                  ) : (
                    runtimeEvents.map((event, idx) => (
                      <div key={`${event.timestamp}_${idx}`} className={`runtime-event ${event.type}`}>
                        <strong>{event.type === "usage_limit" ? "利用上限" : event.type === "mcp_error" ? "MCP Error" : "MCP Info"}</strong>
                        <p>{event.message}</p>
                      </div>
                    ))
                  )}
                  {hasMcpError ? (
                    <button type="button" onClick={() => void onRetryMcp()}>
                      MCP 再試行
                    </button>
                  ) : null}
                </section>

                <section className="debug-panel">
                  <div className="debug-header">
                    <strong>開発用デバッグ</strong>
                    <button type="button" onClick={() => setShowDebugTools((value) => !value)}>
                      {showDebugTools ? "隠す" : "表示する"}
                    </button>
                  </div>

                  {showDebugTools ? (
                    <>
                      <div className="health-row">
                        <div className={`health-card ${sessionDebug?.hasUsageLimit ? "warn" : "ok"}`}>
                          <strong>Usage Limit</strong>
                          <p>{sessionDebug?.hasUsageLimit ? "Detected" : "Clear"}</p>
                        </div>
                        <div className={`health-card ${sessionDebug?.hasMcpError ? "warn" : "ok"}`}>
                          <strong>MCP Error</strong>
                          <p>{sessionDebug?.hasMcpError ? "Detected" : "Clear"}</p>
                        </div>
                      </div>

                      <div className="setup-actions">
                        <button type="button" onClick={() => void onOpenDevTools()}>
                          DevTools
                        </button>
                        <button type="button" onClick={() => void onOpenSessionDebugWindow()}>
                          別 Window
                        </button>
                        <button type="button" onClick={() => setShowSessionTail((value) => !value)}>
                          {showSessionTail ? "ログを閉じる" : "ログを開く"}
                        </button>
                      </div>

                      {showSessionTail ? (
                        <>
                          <pre className="session-tail">{activityLines.join("\n")}</pre>
                          <p className="subtle">詳細な生ログは「別 Window」で確認できます。</p>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </section>
              </section>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
