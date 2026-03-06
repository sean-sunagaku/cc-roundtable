import fs from "node:fs";
import http from "node:http";
import type { MeetingRoomDaemonCommandEnvelope, MeetingRoomDaemonHealthResponse } from "@contracts/meeting-room-daemon";
import {
  MEETING_ROOM_DAEMON_COMMANDS_PATH,
  MEETING_ROOM_DAEMON_EVENTS_PATH,
  MEETING_ROOM_DAEMON_HEALTH_PATH,
  MEETING_ROOM_DAEMON_META_PATH,
  MEETING_ROOM_DAEMON_SESSIONS_PATH
} from "@contracts/meeting-room-daemon";
import { SESSION_DEBUG_SUFFIX, SESSION_TERMINAL_SUFFIX, WEB_ROOT_PREFIX } from "../constants";
import { MeetingRoomDaemonApp } from "../app/meeting-room-daemon-app";
import type { MeetingRoomDaemonServerHandle, MeetingRoomDaemonServerOptions } from "../types";
import { contentTypeFor, readHost, readJsonBody, readPort, resolveWebFile, sendJson } from "../utils";

export async function startMeetingRoomDaemonServer(
  options: MeetingRoomDaemonServerOptions = {}
): Promise<MeetingRoomDaemonServerHandle> {
  const host = options.host ?? readHost();
  const port = options.port ?? readPort();
  const log = options.log ?? ((message: string) => console.log(message));
  const startedAt = Date.now();
  const app = new MeetingRoomDaemonApp(log);
  await app.start();

  const ensureAuthorized = (request: http.IncomingMessage, response: http.ServerResponse): boolean => {
    if (app.isAuthorized(request)) {
      return true;
    }
    sendJson(response, 401, { error: "Unauthorized" });
    return false;
  };

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

  const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://${host}:${port}`);

    if (request.method === "GET" && requestUrl.pathname === MEETING_ROOM_DAEMON_HEALTH_PATH) {
      sendJson(response, 200, healthPayload());
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === MEETING_ROOM_DAEMON_META_PATH) {
      if (!ensureAuthorized(request, response)) return;
      sendJson(response, 200, app.meta());
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === MEETING_ROOM_DAEMON_EVENTS_PATH) {
      if (!ensureAuthorized(request, response)) return;
      app.addSseClient(response);
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === MEETING_ROOM_DAEMON_SESSIONS_PATH) {
      if (!ensureAuthorized(request, response)) return;
      sendJson(response, 200, { sessions: app.listTabs() });
      return;
    }

    if (request.method === "GET" && requestUrl.pathname.startsWith(`${MEETING_ROOM_DAEMON_SESSIONS_PATH}/`)) {
      if (!ensureAuthorized(request, response)) return;
      const sessionPath = requestUrl.pathname.slice(MEETING_ROOM_DAEMON_SESSIONS_PATH.length + 1);
      const [meetingId, suffix] = sessionPath.split("/", 2);
      if (!meetingId) {
        sendJson(response, 404, { error: "Session not found" });
        return;
      }
      if (!suffix) {
        const view = app.getSessionView(meetingId);
        if (!view) {
          sendJson(response, 404, { error: "Session not found" });
          return;
        }
        sendJson(response, 200, view);
        return;
      }
      if (`/${suffix}` === SESSION_DEBUG_SUFFIX) {
        const debug = app.getSessionDebug(meetingId);
        if (!debug) {
          sendJson(response, 404, { error: "Session not found" });
          return;
        }
        sendJson(response, 200, debug);
        return;
      }
      if (`/${suffix}` === SESSION_TERMINAL_SUFFIX) {
        const terminal = app.getSessionTerminal(meetingId);
        if (!terminal) {
          sendJson(response, 404, { error: "Session not found" });
          return;
        }
        sendJson(response, 200, terminal);
        return;
      }
    }

    if (request.method === "POST" && requestUrl.pathname === MEETING_ROOM_DAEMON_COMMANDS_PATH) {
      if (!ensureAuthorized(request, response)) return;
      try {
        const envelope = await readJsonBody<MeetingRoomDaemonCommandEnvelope>(request);
        const ack = await app.handleCommand(envelope);
        sendJson(response, ack.accepted ? 200 : 409, ack);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown command error";
        sendJson(response, 400, { error: message });
      }
      return;
    }

    if (request.method === "GET" && requestUrl.pathname.startsWith(WEB_ROOT_PREFIX)) {
      const filePath = resolveWebFile(requestUrl.pathname);
      if (filePath && fs.existsSync(filePath)) {
        response.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
        response.end(fs.readFileSync(filePath));
        return;
      }
    }

    sendJson(response, 404, { error: "Not Found" });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", () => resolve());
    server.listen(port, host);
  });
  log(`meeting-room-daemon listening on http://${host}:${port}`);

  return {
    host,
    port,
    stop: async () => {
      await app.stop();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  };
}
