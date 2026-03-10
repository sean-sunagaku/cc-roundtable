import fs from "node:fs";
import type { HttpBindings } from "@hono/node-server";
import { RESPONSE_ALREADY_SENT } from "@hono/node-server/utils/response";
import { Hono } from "hono";
import type { Context } from "hono";
import type {
  AgentProfileInputPayload,
  MeetingRoomDaemonCommandEnvelope,
  MeetingRoomDaemonHealthResponse
} from "@contracts/meeting-room-daemon";
import {
  MEETING_ROOM_DAEMON_AGENTS_PATH,
  MEETING_ROOM_DAEMON_COMMANDS_PATH,
  MEETING_ROOM_DAEMON_DEFAULT_PROJECT_DIR_PATH,
  MEETING_ROOM_DAEMON_EVENTS_PATH,
  MEETING_ROOM_DAEMON_HEALTH_PATH,
  MEETING_ROOM_DAEMON_META_PATH,
  MEETING_ROOM_DAEMON_PICK_PROJECT_DIR_PATH,
  MEETING_ROOM_DAEMON_SESSIONS_PATH
} from "@contracts/meeting-room-daemon";
import { WEB_ROOT_PREFIX } from "../constants";
import { MeetingRoomDaemonApp } from "../app/meeting-room-daemon-app";
import { contentTypeFor, resolveWebFile } from "../utils";

type CreateMeetingRoomDaemonHttpAppOptions = {
  app: MeetingRoomDaemonApp;
  host: string;
  port: number;
  startedAt: number;
};

export function createMeetingRoomDaemonHttpApp({
  app,
  host,
  port,
  startedAt
}: CreateMeetingRoomDaemonHttpAppOptions): Hono<{ Bindings: HttpBindings }> {
  const web = new Hono<{ Bindings: HttpBindings }>();

  const unauthorized = (c: Context<{ Bindings: HttpBindings }>) => c.json({ error: "Unauthorized" }, 401);

  const healthPayload = (): MeetingRoomDaemonHealthResponse => ({
    status: "ok",
    service: "meeting-room-daemon",
    now: new Date().toISOString(),
    uptimeMs: Date.now() - startedAt,
    activeMeetings: app.getActiveMeetingCount(),
    transport: {
      host,
      port,
      commandsPath: MEETING_ROOM_DAEMON_COMMANDS_PATH,
      eventsPath: MEETING_ROOM_DAEMON_EVENTS_PATH,
      sessionsPath: MEETING_ROOM_DAEMON_SESSIONS_PATH,
      metaPath: MEETING_ROOM_DAEMON_META_PATH
    }
  });

  web.use("/api/*", async (c, next) => {
    if (app.isAuthorized(c.env.incoming)) {
      await next();
      return;
    }
    return unauthorized(c);
  });

  web.get(MEETING_ROOM_DAEMON_HEALTH_PATH, (c) => c.json(healthPayload()));
  web.get(MEETING_ROOM_DAEMON_META_PATH, (c) => c.json(app.meta()));
  web.get(MEETING_ROOM_DAEMON_DEFAULT_PROJECT_DIR_PATH, (c) =>
    c.json({ defaultProjectDir: app.defaultProjectDir() })
  );

  web.post(MEETING_ROOM_DAEMON_PICK_PROJECT_DIR_PATH, async (c) => {
    try {
      const body = c.req.header("content-length") ? ((await c.req.json()) as { currentDir?: string }) : null;
      return c.json({ projectDir: app.pickProjectDir(body?.currentDir) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Project directory picker failed";
      return c.json({ error: message }, 400);
    }
  });

  web.get(MEETING_ROOM_DAEMON_AGENTS_PATH, (c) => c.json({ agents: app.listAgentProfiles() }));

  web.post(MEETING_ROOM_DAEMON_AGENTS_PATH, async (c) => {
    try {
      const input = (await c.req.json()) as AgentProfileInputPayload;
      return c.json({ agent: app.saveAgentProfile(input) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent save failed";
      return c.json({ error: message }, 400);
    }
  });

  web.get(MEETING_ROOM_DAEMON_EVENTS_PATH, (c) => {
    app.addSseClient(c.env.outgoing);
    return RESPONSE_ALREADY_SENT;
  });

  web.get(MEETING_ROOM_DAEMON_SESSIONS_PATH, (c) => c.json({ sessions: app.listTabs() }));

  web.get(`${MEETING_ROOM_DAEMON_SESSIONS_PATH}/:meetingId`, (c) => {
    const view = app.getSessionView(c.req.param("meetingId"));
    if (!view) {
      return c.json({ error: "Session not found" }, 404);
    }
    return c.json(view);
  });

  web.get(`${MEETING_ROOM_DAEMON_SESSIONS_PATH}/:meetingId/debug`, (c) => {
    const debug = app.getSessionDebug(c.req.param("meetingId"));
    if (!debug) {
      return c.json({ error: "Session not found" }, 404);
    }
    return c.json(debug);
  });

  web.get(`${MEETING_ROOM_DAEMON_SESSIONS_PATH}/:meetingId/terminal`, (c) => {
    const terminal = app.getSessionTerminal(c.req.param("meetingId"));
    if (!terminal) {
      return c.json({ error: "Session not found" }, 404);
    }
    return c.json(terminal);
  });

  web.post(MEETING_ROOM_DAEMON_COMMANDS_PATH, async (c) => {
    try {
      const envelope = (await c.req.json()) as MeetingRoomDaemonCommandEnvelope;
      const ack = await app.handleCommand(envelope);
      return c.json(ack, ack.accepted ? 200 : 409);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown command error";
      return c.json({ error: message }, 400);
    }
  });

  web.get(WEB_ROOT_PREFIX, (c) => serveWebFile(c, `${WEB_ROOT_PREFIX}/`));
  web.get(`${WEB_ROOT_PREFIX}/*`, (c) => serveWebFile(c, c.req.path));

  web.notFound((c) => c.json({ error: "Not Found" }, 404));

  return web;
}

function serveWebFile(c: Context<{ Bindings: HttpBindings }>, requestPath: string) {
  const filePath = resolveWebFile(requestPath);
  if (!filePath || !fs.existsSync(filePath)) {
    return c.json({ error: "Not Found" }, 404);
  }
  const body = fs.readFileSync(filePath);
  c.header("Content-Type", contentTypeFor(filePath));
  return c.body(body);
}
