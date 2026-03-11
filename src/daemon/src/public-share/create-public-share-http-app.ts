import fs from "node:fs";
import type { ServerResponse } from "node:http";
import type { HttpBindings } from "@hono/node-server";
import { RESPONSE_ALREADY_SENT } from "@hono/node-server/utils/response";
import { Hono } from "hono";
import type { Context } from "hono";
import type {
  MeetingRoomDaemonCommand,
  MeetingRoomDaemonCommandAck,
  MeetingRoomDaemonCommandEnvelope,
  MeetingRoomDaemonEvent,
  MeetingTabPayload,
  MeetingRoomPublicShareBootstrapPayload,
  MeetingRoomPublicShareControlPayload,
  MeetingRoomPublicShareMessagePayload,
  MeetingRoomPublicShareSessionPayload,
  MeetingRoomPublicShareSessionUpdatedEvent,
  MeetingRoomPublicShareStreamFrame,
  MeetingSessionViewPayload,
  PublicShareControlAction
} from "@contracts/meeting-room-daemon";
import {
  MEETING_ROOM_PUBLIC_SHARE_API_ROOT_PATH,
  MEETING_ROOM_PUBLIC_SHARE_ASSETS_ROOT_PATH,
  MEETING_ROOM_PUBLIC_SHARE_ROOT_PATH
} from "@contracts/meeting-room-daemon";
import type { EventFrameListener, PublicShareDemoConfig } from "../types";
import { contentTypeFor, createId, resolvePublicShareFile } from "../utils";

const HEARTBEAT_MS = 15_000;
const FORWARDED_EVENT_TYPES = new Set<MeetingRoomDaemonEvent["type"]>(["session.view.updated"]);
const ALLOWED_ACTIONS: PublicShareControlAction[] = ["pause", "resume", "retryMcp", "endMeeting"];

type PublicShareAppAdapter = {
  handleCommand: (
    envelope: MeetingRoomDaemonCommandEnvelope
  ) => Promise<MeetingRoomDaemonCommandAck>;
  listTabs: () => MeetingTabPayload[];
  getSessionView: (meetingId: string) => MeetingSessionViewPayload | null;
  subscribeToEventFrames: (listener: EventFrameListener) => () => void;
};

export function createPublicShareHttpApp({
  app,
  config
}: {
  app: PublicShareAppAdapter;
  config: PublicShareDemoConfig;
}): Hono<{ Bindings: HttpBindings }> {
  const web = new Hono<{ Bindings: HttpBindings }>();

  web.get("/health", (c) => {
    const view = app.getSessionView(config.meetingId);
    return c.json({
      status: "ok",
      service: "meeting-room-public-share-gateway",
      shareId: config.shareId,
      meetingId: config.meetingId,
      sessionStatus: view?.tab.status ?? "idle",
      allowedActions: ALLOWED_ACTIONS
    });
  });

  web.get(`${MEETING_ROOM_PUBLIC_SHARE_ROOT_PATH}/:shareId`, async (c) => {
    if (!matchesShareId(c.req.param("shareId"), config.shareId)) {
      return c.json({ error: "Not Found" }, 404);
    }
    return servePublicShareHtml(c);
  });

  web.get(`${MEETING_ROOM_PUBLIC_SHARE_ROOT_PATH}/:shareId/`, async (c) => {
    if (!matchesShareId(c.req.param("shareId"), config.shareId)) {
      return c.json({ error: "Not Found" }, 404);
    }
    return servePublicShareHtml(c);
  });

  web.get(`${MEETING_ROOM_PUBLIC_SHARE_ASSETS_ROOT_PATH}/*`, (c) => {
    return servePublicShareAsset(c, c.req.path);
  });

  web.get(`${MEETING_ROOM_PUBLIC_SHARE_API_ROOT_PATH}/:shareId/bootstrap`, async (c) => {
    if (!matchesShareId(c.req.param("shareId"), config.shareId)) {
      return c.json({ error: "Not Found" }, 404);
    }
    const view = await ensureBootstrappedSession(app, config);
    return c.json(toBootstrapPayload(config.shareId, config.meetingId, view));
  });

  web.post(`${MEETING_ROOM_PUBLIC_SHARE_API_ROOT_PATH}/:shareId/message`, async (c) => {
    if (!matchesShareId(c.req.param("shareId"), config.shareId)) {
      return c.json({ error: "Not Found" }, 404);
    }
    const body = (await c.req.json()) as MeetingRoomPublicShareMessagePayload;
    const message = body.message?.trim();
    if (!message) {
      return c.json({ error: "Message is required." }, 400);
    }
    const view = getCurrentSessionView(app, config);
    if (!view) {
      return c.json({ error: "Public share session is not active. Call bootstrap first." }, 409);
    }
    const ack = await dispatch(app, {
      type: "sendHumanMessage",
      meetingId: config.meetingId,
      message
    });
    return c.json(ack, ack.accepted ? 200 : 409);
  });

  web.post(`${MEETING_ROOM_PUBLIC_SHARE_API_ROOT_PATH}/:shareId/control`, async (c) => {
    if (!matchesShareId(c.req.param("shareId"), config.shareId)) {
      return c.json({ error: "Not Found" }, 404);
    }
    const body = (await c.req.json()) as MeetingRoomPublicShareControlPayload;
    if (!ALLOWED_ACTIONS.includes(body.action)) {
      return c.json({ error: "Unsupported action." }, 400);
    }
    const view = getCurrentSessionView(app, config);
    if (!view) {
      return c.json({ error: "Public share session is not active. Call bootstrap first." }, 409);
    }
    const ack = await dispatch(app, toControlCommand(config.meetingId, body.action));
    return c.json(ack, ack.accepted ? 200 : 409);
  });

  web.get(`${MEETING_ROOM_PUBLIC_SHARE_API_ROOT_PATH}/:shareId/events`, async (c) => {
    if (!matchesShareId(c.req.param("shareId"), config.shareId)) {
      return c.json({ error: "Not Found" }, 404);
    }
    const view = getCurrentSessionView(app, config);
    if (!view) {
      return c.json({ error: "Public share session is not active. Call bootstrap first." }, 409);
    }
    const response = c.env.outgoing;
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });
    response.write(": connected\n\n");
    writeFrame(response, initialFrame(config.meetingId, view));

    let closed = false;
    const cleanup = () => {
      if (closed) {
        return;
      }
      closed = true;
      clearInterval(heartbeat);
      unsubscribe();
      try {
        response.end();
      } catch {
        // Ignore already-closed responses.
      }
    };
    const unsubscribe = app.subscribeToEventFrames((frame) => {
      if (frame.event.meetingId !== config.meetingId) {
        return;
      }
      if (!FORWARDED_EVENT_TYPES.has(frame.event.type)) {
        return;
      }
      const nextView = app.getSessionView(config.meetingId);
      if (!nextView) {
        cleanup();
        return;
      }
      if (!writeFrame(response, toPublicFrame(frame.cursor, config.meetingId, nextView))) {
        cleanup();
        return;
      }
      if (nextView.tab.status === "ended") {
        cleanup();
      }
    });
    const heartbeat = setInterval(() => {
      try {
        response.write(": keepalive\n\n");
      } catch {
        cleanup();
      }
    }, HEARTBEAT_MS);

    response.on("close", () => {
      cleanup();
    });

    return RESPONSE_ALREADY_SENT;
  });

  web.notFound((c) => c.json({ error: "Not Found" }, 404));

  return web;
}

async function ensureBootstrappedSession(
  app: PublicShareAppAdapter,
  config: PublicShareDemoConfig
) {
  const current = getCurrentSessionView(app, config);
  if (current && !shouldRestartBootstrappedSession(current, config)) {
    return current;
  }

  if (current) {
    await dispatch(app, {
      type: "endMeeting",
      meetingId: config.meetingId
    });
  }

  const ack = await dispatch(app, {
    type: "startMeeting",
    meetingId: config.meetingId,
    topic: config.topic,
    projectDir: config.projectDir,
    members: [...config.members],
    bypassMode: config.bypassMode
  });
  if (!ack.accepted) {
    throw new Error("Public share bootstrap was rejected by daemon.");
  }

  const view = getCurrentSessionView(app, config);
  if (!view) {
    throw new Error("Public share session view is unavailable.");
  }
  return view;
}

function shouldRestartBootstrappedSession(
  session: MeetingSessionViewPayload,
  config: PublicShareDemoConfig
): boolean {
  if (session.tab.status === "recovering") {
    return true;
  }
  if (Boolean(session.tab.config.bypassMode) !== config.bypassMode) {
    return true;
  }
  if (Boolean(session.approvalGate.bypassMode) !== config.bypassMode) {
    return true;
  }
  if (
    session.tab.config.projectDir !== config.projectDir ||
    session.tab.config.topic !== config.topic
  ) {
    return true;
  }

  const currentMembers = session.tab.config.members;
  if (currentMembers.length !== config.members.length) {
    return true;
  }
  return currentMembers.some((memberId, index) => memberId !== config.members[index]);
}

function getCurrentSessionView(app: PublicShareAppAdapter, config: PublicShareDemoConfig) {
  const liveMeeting = app.listTabs().find((tab) => tab.id === config.meetingId);
  if (!liveMeeting) {
    return null;
  }
  return app.getSessionView(config.meetingId);
}

async function dispatch(app: PublicShareAppAdapter, command: MeetingRoomDaemonCommand) {
  return app.handleCommand({
    commandId: createId("public_share"),
    sentAt: new Date().toISOString(),
    command
  });
}

function toBootstrapPayload(
  shareId: string,
  meetingId: string,
  session: MeetingSessionViewPayload
): MeetingRoomPublicShareBootstrapPayload {
  return {
    shareId,
    meetingId,
    session: toPublicSession(session),
    allowedActions: [...ALLOWED_ACTIONS],
    eventsPath: `${MEETING_ROOM_PUBLIC_SHARE_API_ROOT_PATH}/${encodeURIComponent(shareId)}/events`,
    messagePath: `${MEETING_ROOM_PUBLIC_SHARE_API_ROOT_PATH}/${encodeURIComponent(shareId)}/message`,
    controlPath: `${MEETING_ROOM_PUBLIC_SHARE_API_ROOT_PATH}/${encodeURIComponent(shareId)}/control`
  };
}

function initialFrame(
  meetingId: string,
  view: MeetingSessionViewPayload
): MeetingRoomPublicShareStreamFrame {
  const event: MeetingRoomPublicShareSessionUpdatedEvent = {
    type: "public.session.updated",
    eventId: createId("public_share_bootstrap"),
    emittedAt: new Date().toISOString(),
    meetingId,
    payload: { session: toPublicSession(view) }
  };
  return {
    cursor: "bootstrap",
    event
  };
}

function toPublicFrame(
  cursor: string,
  meetingId: string,
  view: MeetingSessionViewPayload
): MeetingRoomPublicShareStreamFrame {
  return {
    cursor,
    event: {
      type: "public.session.updated",
      eventId: createId("public_share_update"),
      emittedAt: new Date().toISOString(),
      meetingId,
      payload: { session: toPublicSession(view) }
    }
  };
}

function toPublicSession(view: MeetingSessionViewPayload): MeetingRoomPublicShareSessionPayload {
  return {
    tab: {
      id: view.tab.id,
      title: view.tab.title,
      createdAt: view.tab.createdAt,
      status: view.tab.status
    },
    messages: view.messages,
    agentStatuses: view.agentStatuses,
    runtimeEvents: view.runtimeEvents,
    approvalGate: view.approvalGate
  };
}

function writeFrame(response: ServerResponse, frame: MeetingRoomPublicShareStreamFrame): boolean {
  try {
    response.write(`data: ${JSON.stringify(frame)}\n\n`);
    return true;
  } catch {
    return false;
  }
}

function toControlCommand(
  meetingId: string,
  action: PublicShareControlAction
): MeetingRoomDaemonCommand {
  switch (action) {
    case "pause":
      return { type: "pauseMeeting", meetingId };
    case "resume":
      return { type: "resumeMeeting", meetingId };
    case "retryMcp":
      return { type: "retryMcp", meetingId };
    case "endMeeting":
      return { type: "endMeeting", meetingId };
  }
}

function matchesShareId(actual: string, expected: string): boolean {
  return actual.trim() === expected;
}

function servePublicShareHtml(c: Context<{ Bindings: HttpBindings }>) {
  const filePath = resolvePublicShareFile("/");
  if (!filePath || !fs.existsSync(filePath)) {
    return c.json({ error: "Public share assets not built." }, 404);
  }
  const body = fs.readFileSync(filePath);
  c.header("Content-Type", "text/html; charset=utf-8");
  return c.body(body);
}

function servePublicShareAsset(c: Context<{ Bindings: HttpBindings }>, requestPath: string) {
  const filePath = resolvePublicShareFile(requestPath);
  if (!filePath || !fs.existsSync(filePath)) {
    return c.json({ error: "Not Found" }, 404);
  }
  const body = fs.readFileSync(filePath);
  c.header("Content-Type", contentTypeFor(filePath));
  return c.body(body);
}
