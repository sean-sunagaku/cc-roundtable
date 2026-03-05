import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentProfile,
  AgentProfileInput,
  AgentMessagePayload,
  ChatMessage,
  ClaudeSessionDebug,
  ConversationHealth,
  MeetingConfig,
  MeetingSummaryPayload,
  MeetingTab,
  RuntimeEvent,
  SessionSnapshot,
  SkillOption
} from "@shared/types";
import type { MeetingUiControlMode } from "@shared/ipc";
import { SetupScreen } from "./screens/SetupScreen";
import { MeetingScreen } from "./screens/MeetingScreen";
import { SessionDebugWindow } from "./screens/SessionDebugWindow";

const SESSION_KEY = "meeting-room:sessions";
const DEFAULT_PROJECT_DIR = "/";

function toChatMessage(payload: AgentMessagePayload): ChatMessage {
  return {
    id: payload.id,
    sender: payload.sender,
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

function loadSnapshots(): Record<string, ChatMessage[]> {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as SessionSnapshot[];
    const map: Record<string, ChatMessage[]> = {};
    for (const snapshot of parsed) {
      map[snapshot.meetingId] = snapshot.messages;
    }
    return map;
  } catch {
    return {};
  }
}

function saveSnapshots(byMeeting: Record<string, ChatMessage[]>): void {
  const snapshots: SessionSnapshot[] = Object.entries(byMeeting).map(([meetingId, messages]) => ({
    meetingId,
    messages,
    savedAt: new Date().toISOString()
  }));
  localStorage.setItem(SESSION_KEY, JSON.stringify(snapshots));
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

  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [tabs, setTabs] = useState<MeetingTab[]>([]);
  const [currentTabId, setCurrentTabId] = useState<string>("");
  const [defaultProjectDir, setDefaultProjectDir] = useState<string>(DEFAULT_PROJECT_DIR);
  const [messagesByMeeting, setMessagesByMeeting] = useState<Record<string, ChatMessage[]>>(() => loadSnapshots());
  const [agentStatuses, setAgentStatuses] = useState<Record<string, "active" | "completed">>({});
  const [runtimeEventsByMeeting, setRuntimeEventsByMeeting] = useState<Record<string, RuntimeEvent[]>>({});
  const [healthByMeeting, setHealthByMeeting] = useState<Record<string, ConversationHealth>>({});
  const [sessionDebug, setSessionDebug] = useState<ClaudeSessionDebug | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [ending, setEnding] = useState(false);
  const notifyRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    void window.meetingRoom.listSkills().then((list) => {
      setSkills(list);
    });
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

    const unsubRelay = window.meetingRoom.onRelayMessage((incoming) => {
      if (incoming.type === "agent_status") {
        setAgentStatuses((prev) => ({
          ...prev,
          [incoming.sender]: incoming.status ?? "completed"
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
        const nextMessages = maybeConfirmPending(current, chat);
        const next = { ...prev, [meetingId]: nextMessages };
        saveSnapshots(next);
        return next;
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
    let disposed = false;
    const load = async () => {
      const debug = await window.meetingRoom.getSessionDebug(currentTabId);
      if (!disposed) setSessionDebug(debug);
    };
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 2000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [currentTabId]);

  const currentMessages = useMemo(() => messagesByMeeting[currentTabId] ?? [], [messagesByMeeting, currentTabId]);

  const handleStart = async (config: MeetingConfig) => {
    const tab = await window.meetingRoom.startMeeting(config);
    setTabs((prev) => [...prev, tab]);
    setCurrentTabId(tab.id);
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
      const next = { ...prev, [currentTabId]: [...(prev[currentTabId] ?? []), optimistic] };
      saveSnapshots(next);
      return next;
    });
    setHealthByMeeting((prev) => ({
      ...prev,
      [currentTabId]: {
        ...prev[currentTabId],
        inputDeliveredAt: delivered ? new Date().toISOString() : prev[currentTabId]?.inputDeliveredAt
      }
    }));
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
    } finally {
      setEnding(false);
    }
  };

  const handleControl = async (mode: MeetingUiControlMode, extra?: string) => {
    if (!currentTabId) return;
    await window.meetingRoom.sendControlMessage(currentTabId, mode, extra);
  };

  const handleRetryMcp = async () => {
    if (!currentTabId) return;
    await window.meetingRoom.retryMcp(currentTabId);
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
        skills={skills}
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
      subscribeTerminal={window.meetingRoom.onTerminalData}
      onResizeTerminal={window.meetingRoom.resizeTerminal}
      agentStatuses={agentStatuses}
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
