import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type {
  ApprovalGate,
  ChatMessage,
  ClaudeSessionDebug,
  ConversationHealth,
  MeetingTab,
  RuntimeEvent
} from "@shared/types";
import type { MeetingControlMode } from "@shared/ipc";
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
  onControl: (mode: MeetingControlMode) => Promise<void>;
  agentStatuses: Record<string, "active" | "completed">;
  ending: boolean;
  health: ConversationHealth;
  approvalGate: ApprovalGate;
  runtimeEvents: RuntimeEvent[];
  onRetryMcp: () => Promise<void>;
  sessionDebug: ClaudeSessionDebug | null;
  onOpenDevTools: () => Promise<void>;
  onOpenSessionDebugWindow: () => Promise<void>;
  onApproveNextStep: () => Promise<void>;
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
  approvalGate,
  runtimeEvents,
  onRetryMcp,
  sessionDebug,
  onOpenDevTools,
  onOpenSessionDebugWindow,
  onApproveNextStep
}: Props): JSX.Element {
  const [developerToolsVisible, setDeveloperToolsVisible] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const currentTab = useMemo(() => tabs.find((tab) => tab.id === currentTabId), [tabs, currentTabId]);
  const hasMcpError = runtimeEvents.some((event) => event.type === "mcp_error");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.shiftKey || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "d") {
        return;
      }
      event.preventDefault();
      setDeveloperToolsVisible((value) => !value);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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

      {approvalGate.mode === "blocked" ? (
        <section className="approval-gate-card">
          <div>
            <p className="approval-gate-label">承認待ち</p>
            <strong>AI の次アクションを Hook で停止中です。</strong>
            <p className="subtle">
              {approvalGate.reason?.startsWith("agent:")
                ? `${approvalGate.reason.slice("agent:".length)} の返答を確認したら、次へ進めてください。`
                : "返答を確認したら、次へ進めてください。"}
            </p>
          </div>
          <button type="button" onClick={() => void onApproveNextStep()}>
            次へ進める
          </button>
        </section>
      ) : null}

      <ChatView messages={messages} />
      <InputBar onSend={onSend} />

      {developerToolsVisible ? (
        <section className="debug-tools">
          <div className="debug-toggle-row">
            <button className="terminal-toggle" type="button" onClick={() => setShowDebugPanel((state) => !state)}>
              {showDebugPanel ? <ChevronUp size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
              {" "}Debug
            </button>
            <button className="terminal-toggle" type="button" onClick={() => void onOpenSessionDebugWindow()}>
              別 Window
            </button>
            <button className="terminal-toggle" type="button" onClick={() => void onOpenDevTools()}>
              DevTools
            </button>
          </div>

          {showDebugPanel ? (
            <div className="debug-drawer">
              <section className="debug-header">
                <div>
                  <strong>Claude Debug</strong>
                  <p className="subtle">Claude Code の実ターミナルと診断情報をまとめて表示しています。</p>
                </div>
              </section>

              <section className="meeting-terminal-pane">
                <TerminalPane
                  meetingId={currentTabId}
                  onResize={window.meetingRoom.resizeTerminal}
                  subscribeData={window.meetingRoom.onTerminalData}
                  initialContent={sessionDebug?.tail?.join("\n") ?? "(no session output yet)"}
                />
              </section>

              <section className="health-row">
                <div className={`health-card ${health.inputDeliveredAt ? "ok" : "warn"}`}>
                  <strong>Input 到達</strong>
                  <p>{health.inputDeliveredAt ? `OK (${new Date(health.inputDeliveredAt).toLocaleTimeString("ja-JP")})` : "未確認"}</p>
                </div>
                <div className={`health-card ${health.lastAgentReplyAt ? "ok" : "warn"}`}>
                  <strong>Agent 返信</strong>
                  <p>{health.lastAgentReplyAt ? `受信 (${new Date(health.lastAgentReplyAt).toLocaleTimeString("ja-JP")})` : "未受信"}</p>
                </div>
                <div className={`health-card ${sessionDebug?.hasUsageLimit ? "warn" : "ok"}`}>
                  <strong>Usage Limit</strong>
                  <p>{sessionDebug?.hasUsageLimit ? "Detected" : "Clear"}</p>
                </div>
                <div className={`health-card ${sessionDebug?.hasMcpError ? "warn" : "ok"}`}>
                  <strong>MCP Error</strong>
                  <p>{sessionDebug?.hasMcpError ? "Detected" : "Clear"}</p>
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
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
