const state = {
  baseUrl: window.location.origin || "http://127.0.0.1:4417",
  token: "",
  eventSource: null,
  sessions: []
};

const $ = (id) => document.getElementById(id);

const baseUrlInput = $("baseUrl");
const tokenInput = $("token");
const metaCard = $("metaCard");
const sessionsList = $("sessions");
const eventsPre = $("events");
const sessionViewPre = $("sessionView");

baseUrlInput.value = state.baseUrl;

function headers(extra = {}) {
  if (!state.token) return extra;
  return {
    ...extra,
    Authorization: `Bearer ${state.token}`
  };
}

async function request(path, init = {}) {
  const response = await fetch(`${state.baseUrl}${path}`, {
    ...init,
    headers: headers(init.headers || {})
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${body}`);
  }
  return response.json();
}

function logEvent(label, payload) {
  const line = `[${new Date().toLocaleTimeString("ja-JP")}] ${label}\n${JSON.stringify(payload, null, 2)}\n\n`;
  eventsPre.textContent = `${line}${eventsPre.textContent}`.slice(0, 16000);
}

function connectStream() {
  if (state.eventSource) {
    state.eventSource.close();
  }

  const url = new URL("/api/events", state.baseUrl);
  if (state.token) {
    url.searchParams.set("token", state.token);
  }

  fetch(url, { headers: headers({ Accept: "text/event-stream" }) })
    .then(async (response) => {
      if (!response.ok || !response.body) {
        throw new Error(`SSE ${response.status}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const raw = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const dataLines = raw
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim());
          if (dataLines.length === 0) {
            boundary = buffer.indexOf("\n\n");
            continue;
          }
          const frame = JSON.parse(dataLines.join("\n"));
          logEvent(frame.event.type, frame);
          if (frame.event.meetingId) {
            $("targetMeetingId").value = frame.event.meetingId;
          }
          if (frame.event.type === "meeting.started" || frame.event.type === "meeting.ended" || frame.event.type === "session.view.updated") {
            void loadSessions();
            if (frame.event.meetingId) {
              void loadSessionView(frame.event.meetingId);
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
    })
    .catch((error) => {
      logEvent("stream.error", { message: String(error) });
    });
}

async function loadMeta() {
  try {
    const meta = await request("/api/meta");
    metaCard.textContent = JSON.stringify(meta, null, 2);
  } catch (error) {
    metaCard.textContent = `meta 読込失敗: ${String(error)}`;
  }
}

async function loadSessions() {
  const data = await request("/api/sessions");
  state.sessions = data.sessions || [];
  sessionsList.innerHTML = "";
  for (const session of state.sessions) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${session.title} (${session.status})`;
    button.addEventListener("click", () => {
      $("targetMeetingId").value = session.id;
      void loadSessionView(session.id);
    });
    li.appendChild(button);
    sessionsList.appendChild(li);
  }
}

async function loadSessionView(meetingId) {
  const view = await request(`/api/sessions/${encodeURIComponent(meetingId)}`);
  sessionViewPre.textContent = JSON.stringify(view, null, 2);
}

async function dispatch(command) {
  const payload = {
    commandId: `web_${Date.now()}`,
    sentAt: new Date().toISOString(),
    command
  };
  const result = await request("/api/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  logEvent("command.ack", result);
  await loadSessions();
  if (command.meetingId) {
    await loadSessionView(command.meetingId);
  }
}

$("connectBtn").addEventListener("click", async () => {
  state.baseUrl = baseUrlInput.value.trim().replace(/\/$/, "");
  state.token = tokenInput.value.trim();
  await loadMeta();
  await loadSessions();
  connectStream();
});

$("reloadSessionsBtn").addEventListener("click", () => {
  void loadSessions();
});

$("startBtn").addEventListener("click", () => {
  const meetingId = $("meetingId").value.trim();
  const topic = $("topic").value.trim();
  const skill = $("skill").value.trim();
  const projectDir = $("projectDir").value.trim();
  const members = $("members").value.split(",").map((item) => item.trim()).filter(Boolean);
  const initPrompt = $("initPrompt").value.trim();
  $("targetMeetingId").value = meetingId;
  void dispatch({
    type: "startMeeting",
    meetingId,
    topic,
    skill,
    projectDir,
    members,
    initPrompt
  });
});

$("sendBtn").addEventListener("click", () => {
  void dispatch({
    type: "sendHumanMessage",
    meetingId: $("targetMeetingId").value.trim(),
    message: $("message").value
  });
});

$("retryBtn").addEventListener("click", () => {
  void dispatch({
    type: "retryMcp",
    meetingId: $("targetMeetingId").value.trim()
  });
});

$("pauseBtn").addEventListener("click", () => {
  void dispatch({
    type: "pauseMeeting",
    meetingId: $("targetMeetingId").value.trim()
  });
});

$("resumeBtn").addEventListener("click", () => {
  void dispatch({
    type: "resumeMeeting",
    meetingId: $("targetMeetingId").value.trim()
  });
});

$("endBtn").addEventListener("click", () => {
  void dispatch({
    type: "endMeeting",
    meetingId: $("targetMeetingId").value.trim()
  });
});

void loadMeta();
void loadSessions();
connectStream();
