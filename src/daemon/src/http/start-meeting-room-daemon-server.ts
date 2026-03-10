import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { MeetingRoomDaemonApp } from "../app/meeting-room-daemon-app";
import { createMeetingRoomDaemonHttpApp } from "./create-meeting-room-daemon-http-app";
import type { MeetingRoomDaemonServerHandle, MeetingRoomDaemonServerOptions } from "../types";
import { readHost, readPort } from "../utils";

export async function startMeetingRoomDaemonServer(
  options: MeetingRoomDaemonServerOptions = {}
): Promise<MeetingRoomDaemonServerHandle> {
  const host = options.host ?? readHost();
  const port = options.port ?? readPort();
  const log = options.log ?? ((message: string) => console.log(message));
  const startedAt = Date.now();
  const app = new MeetingRoomDaemonApp(log);
  await app.start();
  const web = createMeetingRoomDaemonHttpApp({
    app,
    host,
    port,
    startedAt
  });

  const server = await new Promise<ReturnType<typeof serve>>((resolve, reject) => {
    const handleError = (error: Error) => {
      server.off("error", handleError);
      reject(error);
    };

    const server = serve(
      {
        fetch: web.fetch,
        hostname: host,
        port
      },
      (_info: AddressInfo) => {
        server.off("error", handleError);
        resolve(server);
      }
    );
    server.once("error", handleError);
  });

  log(`meeting-room-daemon listening on http://${host}:${port}`);

  return {
    host,
    port,
    stop: async () => {
      await app.stop();
      await new Promise<void>((resolve, reject) => {
        server.close((error?: Error) => {
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
