import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentProfile,
  AgentProfileInput,
  AgentMessagePayload,
  ChatMessage,
  ClaudeSessionDebug,
  ConversationHealth,
  MeetingConfig,
  MeetingRoomDaemonMeta,
  MeetingSessionView,
  MeetingTab,
  MeetingSummaryPayload,
  RuntimeEvent
} from "@shared/types";
import type { MeetingControlMode } from "@shared/ipc";
import { SetupScreen } from "./screens/SetupScreen";
import { MeetingScreen } from "./screens/MeetingScreen";
import { SessionDebugWindow } from "./screens/SessionDebugWindow";

const DEFAULT_PROJECT_DIR = "/";
type AgentRunStatus = "active" | "completed";

function toChatMessage(payload: AgentMessagePayload): ChatMessage {
  return {
    id: payload.id,
    sender: payload.sender,
    subagent: payload.subagent,
    content: payload.content,
    timestamp: payload.timestamp,
    team: payload.team,
    source: "agent",
    status: "confirmed"
  };
}

function maybeConfirmPending(existing: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const pendingIndex = existing.findIndex(
    (item) => item.source === "human" && item.status === "pending" && incoming.content.includes(item.content)
  );
  if (pendingIndex < 0) return [...existing, incoming];
  const next = [...existing];
  next[pendingIndex] = { ...next[pendingIndex], status: "confirmed" };
  return [...next, incoming];
}

export function App(): JSX.Element {
  const urlParams = new URLSearchParams(window.location.search);
  const isDebugWindow = urlParams.get("debugWindow") === "1";
  const debugMeetingId = urlParams.get("meetingId") ?? "";

  if (isDebugWindow) {
    if (!debugMeetingId) {
      return (
        <div className="meeting-wrap">
          <h2>Claude Session Debug</h2>
          <p className="subtle">meetingId が指定されていません。</p>
        </div>
      );
    }
    return <SessionDebugWindow meetingId={debugMeetingId} />;
  }

  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [tabs, setTabs] = useState<MeetingTab[]>([]);
  const [currentTabId, setCurrentTabId] = useState<string>("");
  const [defaultProjectDir, setDefaultProjectDir] = useState<string>(DEFAULT_PROJECT_DIR);
  const [messagesByMeeting, setMessagesByMeeting] = useState<Record<string, ChatMessage[]>>({});
  const [agentStatusesByMeeting, setAgentStatusesByMeeting] = useState<Record<string, Record<string, AgentRunStatus>>>({});
  const [runtimeEventsByMeeting, setRuntimeEventsByMeeting] = useState<Record<string, RuntimeEvent[]>>({});
  const [healthByMeeting, setHealthByMeeting] = useState<Record<string, ConversationHealth>>({});
  const [sessionDebug, setSessionDebug] = useState<ClaudeSessionDebug | null>(null);
  const [, setDaemonMeta] = useState<MeetingRoomDaemonMeta | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [ending, setEnding] = useState(false);
  const notifyRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    void window.meetingRoom.listAgents().then((list) => {
      setAgents(list);
    });
    void window.meetingRoom.listTabs().then((list) => {
      setTabs(list);
      if (!currentTabId && list[0]) setCurrentTabId(list[0].id);
    });
    void window.meetingRoom.defaultProjectDir().then((dir) => {
      if (dir) setDefaultProjectDir(dir);
    });
    void window.meetingRoom.getDaemonMeta().then((meta) => {
      setDaemonMeta(meta);
    });

    const unsubRelay = window.meetingRoom.onRelayMessage((incoming) => {
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

      const chat = toChatMessage(incoming);
      setMessagesByMeeting((prev) => {
        const current = prev[meetingId] ?? [];
        return { ...prev, [meetingId]: maybeConfirmPending(current, chat) };
      });
      setHealthByMeeting((prev) => ({
        ...prev,
        [meetingId]: {
          ...prev[meetingId],
          lastAgentReplyAt: incoming.timestamp
        }
      }));
      beep();
    });
    const unsubTabs = window.meetingRoom.onTabsUpdate((nextTabs) => {
      setTabs(nextTabs);
      setCurrentTabId((prev) => {
        if (nextTabs.some((tab) => tab.id === prev)) {
          return prev;
        }
        return nextTabs[0]?.id ?? "";
      });
    });
    const unsubRuntime = window.meetingRoom.onRuntimeEvent((event) => {
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
  }, [currentTabId, tabs]);

  useEffect(() => {
    if (!currentTabId) {
      setSessionDebug(null);
      return;
    }
    const load = async () => {
      const view = await window.meetingRoom.getSessionView(currentTabId);
      if (view) {
        hydrateSessionView(view);
        return;
      }
      const debug = await window.meetingRoom.getSessionDebug(currentTabId);
      setSessionDebug(debug);
    };
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 2000);
    return () => {
      window.clearInterval(timer);
    };
  }, [currentTabId]);

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
    setSessionDebug(view.sessionDebug);
  };

  const handleStart = async (config: MeetingConfig) => {
    const tab = await window.meetingRoom.startMeeting(config);
    const nextTabs = await window.meetingRoom.listTabs();
    setTabs(nextTabs);
    setCurrentTabId(tab.id);
    const view = await window.meetingRoom.getSessionView(tab.id);
    if (view) {
      hydrateSessionView(view);
    }
  };

  const handleSaveAgent = async (input: AgentProfileInput): Promise<AgentProfile> => {
    const saved = await window.meetingRoom.saveAgent(input);
    const list = await window.meetingRoom.listAgents();
    setAgents(list);
    return saved;
  };

  const handleReloadAgents = async (): Promise<void> => {
    const list = await window.meetingRoom.listAgents();
    setAgents(list);
  };

  const handleSend = async (message: string) => {
    if (!currentTabId) return;
    const delivered = await window.meetingRoom.sendHumanMessage(currentTabId, message);
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
      const view = await window.meetingRoom.getSessionView(currentTabId);
      if (view) {
        hydrateSessionView(view);
      }
    }
  };

  const handleEnd = async () => {
    if (!currentTabId) return;
    const activeTab = tabs.find((tab) => tab.id === currentTabId);
    setEnding(true);
    try {
      const payload: MeetingSummaryPayload = {
        meetingId: currentTabId,
        title: activeTab?.title ?? "Untitled",
        topic: activeTab?.config.topic ?? "Unknown topic",
        messages: messagesByMeeting[currentTabId] ?? []
      };
      await window.meetingRoom.saveSummary(payload);
      await window.meetingRoom.endMeeting(currentTabId);
      const nextTabs = await window.meetingRoom.listTabs();
      setTabs(nextTabs);
      setCurrentTabId((prev) => {
        if (nextTabs.some((tab) => tab.id === prev)) {
          return prev;
        }
        return nextTabs[0]?.id ?? "";
      });
      if (nextTabs[0]) {
        const view = await window.meetingRoom.getSessionView(nextTabs[0].id);
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
    await window.meetingRoom.sendControlMessage(currentTabId, mode);
    const view = await window.meetingRoom.getSessionView(currentTabId);
    if (view) {
      hydrateSessionView(view);
    }
  };

  const handleRetryMcp = async () => {
    if (!currentTabId) return;
    await window.meetingRoom.retryMcp(currentTabId);
    const view = await window.meetingRoom.getSessionView(currentTabId);
    if (view) {
      hydrateSessionView(view);
    }
  };

  const handleOpenDevTools = async () => {
    await window.meetingRoom.openDevTools();
  };

  const handleOpenSessionDebugWindow = async () => {
    if (!currentTabId) return;
    await window.meetingRoom.openSessionDebugWindow(currentTabId);
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
      runtimeEvents={runtimeEventsByMeeting[currentTabId] ?? []}
      onRetryMcp={handleRetryMcp}
      sessionDebug={sessionDebug}
      onOpenDevTools={handleOpenDevTools}
      onOpenSessionDebugWindow={handleOpenSessionDebugWindow}
    />
  );
}
