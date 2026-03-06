import { useEffect, useMemo, useRef, useState } from "react";
import type { MeetingRoomClient } from "@shared/meeting-room-client";
import type {
  ApprovalGate,
  AgentProfile,
  AgentProfileInput,
  ChatMessage,
  ClaudeSessionDebug,
  ConversationHealth,
  MeetingConfig,
  MeetingRoomDaemonMeta,
  MeetingSessionView,
  MeetingTab,
  RuntimeEvent
} from "@shared/types";
import type { MeetingControlMode } from "@shared/ipc";
import { SetupScreen } from "./screens/SetupScreen";
import { MeetingScreen } from "./screens/MeetingScreen";
import { SessionDebugWindow } from "./screens/SessionDebugWindow";

const DEFAULT_PROJECT_DIR = "/";
type AgentRunStatus = "active" | "completed";

interface Props {
  client: MeetingRoomClient;
  debugWindow?: boolean;
  debugMeetingId?: string;
  canOpenDevTools?: boolean;
  canOpenSessionDebugWindow?: boolean;
}

export function MeetingRoomShell({
  client,
  debugWindow,
  debugMeetingId,
  canOpenDevTools,
  canOpenSessionDebugWindow
}: Props): JSX.Element {
  if (debugWindow) {
    if (!debugMeetingId) {
      return (
        <div className="meeting-wrap">
          <h2>Claude Session Debug</h2>
          <p className="subtle">meetingId が指定されていません。</p>
        </div>
      );
    }
    return (
      <SessionDebugWindow
        client={client}
        meetingId={debugMeetingId}
        canOpenDevTools={canOpenDevTools}
      />
    );
  }

  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [tabs, setTabs] = useState<MeetingTab[]>([]);
  const [currentTabId, setCurrentTabId] = useState<string>("");
  const [defaultProjectDir, setDefaultProjectDir] = useState<string>(DEFAULT_PROJECT_DIR);
  const [messagesByMeeting, setMessagesByMeeting] = useState<Record<string, ChatMessage[]>>({});
  const [agentStatusesByMeeting, setAgentStatusesByMeeting] = useState<Record<string, Record<string, AgentRunStatus>>>({});
  const [runtimeEventsByMeeting, setRuntimeEventsByMeeting] = useState<Record<string, RuntimeEvent[]>>({});
  const [healthByMeeting, setHealthByMeeting] = useState<Record<string, ConversationHealth>>({});
  const [approvalGateByMeeting, setApprovalGateByMeeting] = useState<Record<string, ApprovalGate>>({});
  const [sessionDebug, setSessionDebug] = useState<ClaudeSessionDebug | null>(null);
  const [, setDaemonMeta] = useState<MeetingRoomDaemonMeta | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [ending, setEnding] = useState(false);
  const notifyRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    void client.listAgents().then((list) => {
      setAgents(list);
    });
    void client.listTabs().then((list) => {
      setTabs(list);
      if (!currentTabId && list[0]) setCurrentTabId(list[0].id);
    });
    void client.defaultProjectDir().then((dir) => {
      if (dir) setDefaultProjectDir(dir);
    });
    void client.getDaemonMeta().then((meta) => {
      setDaemonMeta(meta);
    });

    const unsubRelay = client.onRelayMessage((incoming) => {
      if (incoming.type === "agent_status") {
        const meetingId = incoming.meetingId || currentTabId || tabs[0]?.id;
        if (!meetingId) return;
        setAgentStatusesByMeeting((prev) => ({
          ...prev,
          [meetingId]: {
            ...(prev[meetingId] ?? {}),
            [incoming.sender]: incoming.status ?? "completed"
          }
        }));
        return;
      }
      if (incoming.type !== "agent_message") return;
      setWsConnected(true);
      const meetingId = incoming.meetingId || currentTabId || tabs[0]?.id;
      if (!meetingId) return;
      beep();
      void client.getSessionView(meetingId).then((view) => {
        if (view) {
          hydrateSessionView(view);
        }
      });
    });
    const unsubTabs = client.onTabsUpdate((nextTabs) => {
      setTabs(nextTabs);
      setCurrentTabId((prev) => {
        if (nextTabs.some((tab) => tab.id === prev)) {
          return prev;
        }
        return nextTabs[0]?.id ?? "";
      });
    });
    const unsubRuntime = client.onRuntimeEvent((event) => {
      setRuntimeEventsByMeeting((prev) => {
        const current = prev[event.meetingId] ?? [];
        const next = [...current, event].slice(-8);
        return { ...prev, [event.meetingId]: next };
      });
    });
    return () => {
      unsubRelay();
      unsubTabs();
      unsubRuntime();
    };
  }, [client, currentTabId, tabs]);

  useEffect(() => {
    if (!currentTabId) {
      setSessionDebug(null);
      return;
    }
    const load = async () => {
      const view = await client.getSessionView(currentTabId);
      if (view) {
        hydrateSessionView(view);
        return;
      }
      const debug = await client.getSessionDebug(currentTabId);
      setSessionDebug(debug);
    };
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 2000);
    return () => {
      window.clearInterval(timer);
    };
  }, [client, currentTabId]);

  const currentMessages = useMemo(() => messagesByMeeting[currentTabId] ?? [], [messagesByMeeting, currentTabId]);

  const hydrateSessionView = (view: MeetingSessionView) => {
    setMessagesByMeeting((prev) => ({
      ...prev,
      [view.tab.id]: view.messages
    }));
    setAgentStatusesByMeeting((prev) => ({
      ...prev,
      [view.tab.id]: view.agentStatuses
    }));
    setRuntimeEventsByMeeting((prev) => ({
      ...prev,
      [view.tab.id]: view.runtimeEvents
    }));
    setHealthByMeeting((prev) => ({
      ...prev,
      [view.tab.id]: view.health
    }));
    setApprovalGateByMeeting((prev) => ({
      ...prev,
      [view.tab.id]: view.approvalGate
    }));
    setSessionDebug(view.sessionDebug);
  };

  const handleStart = async (config: MeetingConfig) => {
    const tab = await client.startMeeting(config);
    const nextTabs = await client.listTabs();
    setTabs(nextTabs);
    setCurrentTabId(tab.id);
    const view = await client.getSessionView(tab.id);
    if (view) {
      hydrateSessionView(view);
    }
  };

  const handleSaveAgent = async (input: AgentProfileInput): Promise<AgentProfile> => {
    const saved = await client.saveAgent(input);
    const list = await client.listAgents();
    setAgents(list);
    return saved;
  };

  const handleReloadAgents = async (): Promise<void> => {
    const list = await client.listAgents();
    setAgents(list);
  };

  const handleSend = async (message: string) => {
    if (!currentTabId) return;
    const delivered = await client.sendHumanMessage(currentTabId, message);
    const optimistic: ChatMessage = {
      id: `human_${Date.now()}`,
      sender: "You",
      content: message,
      timestamp: new Date().toISOString(),
      source: "human",
      status: "pending"
    };
    setMessagesByMeeting((prev) => {
      return { ...prev, [currentTabId]: [...(prev[currentTabId] ?? []), optimistic] };
    });
    setHealthByMeeting((prev) => ({
      ...prev,
      [currentTabId]: {
        ...prev[currentTabId],
        inputDeliveredAt: delivered ? new Date().toISOString() : prev[currentTabId]?.inputDeliveredAt
      }
    }));
    if (delivered) {
      const view = await client.getSessionView(currentTabId);
      if (view) {
        hydrateSessionView(view);
      }
    }
  };

  const handleEnd = async () => {
    if (!currentTabId) return;
    setEnding(true);
    try {
      await client.endMeeting(currentTabId);
      const nextTabs = await client.listTabs();
      setTabs(nextTabs);
      setCurrentTabId((prev) => {
        if (nextTabs.some((tab) => tab.id === prev)) {
          return prev;
        }
        return nextTabs[0]?.id ?? "";
      });
      if (nextTabs[0]) {
        const view = await client.getSessionView(nextTabs[0].id);
        if (view) {
          hydrateSessionView(view);
        }
      }
    } finally {
      setEnding(false);
    }
  };

  const handleControl = async (mode: MeetingControlMode) => {
    if (!currentTabId) return;
    await client.sendControlMessage(currentTabId, mode);
    const view = await client.getSessionView(currentTabId);
    if (view) {
      hydrateSessionView(view);
    }
  };

  const handleRetryMcp = async () => {
    if (!currentTabId) return;
    await client.retryMcp(currentTabId);
    const view = await client.getSessionView(currentTabId);
    if (view) {
      hydrateSessionView(view);
    }
  };

  const handleOpenDevTools = async () => {
    await client.openDevTools?.();
  };

  const handleOpenSessionDebugWindow = async () => {
    if (!currentTabId) return;
    await client.openSessionDebugWindow?.(currentTabId);
  };

  const handleApproveNextStep = async () => {
    if (!currentTabId) return;
    await client.approveNextStep(currentTabId);
    const view = await client.getSessionView(currentTabId);
    if (view) {
      hydrateSessionView(view);
    }
  };

  const beep = () => {
    if (!notifyRef.current) {
      notifyRef.current = new AudioContext();
    }
    const ctx = notifyRef.current;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.03;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.07);
  };

  if (!currentTabId) {
    return (
      <SetupScreen
        agents={agents}
        defaultProjectDir={defaultProjectDir}
        onStart={handleStart}
        onSaveAgent={handleSaveAgent}
        onReloadAgents={handleReloadAgents}
      />
    );
  }

  return (
    <MeetingScreen
      tabs={tabs}
      currentTabId={currentTabId}
      messages={currentMessages}
      wsConnected={wsConnected}
      onSwitchTab={setCurrentTabId}
      onSend={handleSend}
      onEnd={handleEnd}
      onControl={handleControl}
      agentStatuses={agentStatusesByMeeting[currentTabId] ?? {}}
      ending={ending}
      health={healthByMeeting[currentTabId] ?? {}}
      approvalGate={approvalGateByMeeting[currentTabId] ?? {
        mode: "open",
        updatedAt: new Date(0).toISOString()
      }}
      runtimeEvents={runtimeEventsByMeeting[currentTabId] ?? []}
      onRetryMcp={handleRetryMcp}
      sessionDebug={sessionDebug}
      onOpenDevTools={handleOpenDevTools}
      onOpenSessionDebugWindow={handleOpenSessionDebugWindow}
      onApproveNextStep={handleApproveNextStep}
      canOpenDevTools={Boolean(canOpenDevTools && client.openDevTools)}
      canOpenSessionDebugWindow={Boolean(canOpenSessionDebugWindow && client.openSessionDebugWindow)}
      terminalControls={{
        onResize: client.resizeTerminal,
        subscribeData: client.onTerminalData,
        writeData: client.writeTerminal
      }}
    />
  );
}
