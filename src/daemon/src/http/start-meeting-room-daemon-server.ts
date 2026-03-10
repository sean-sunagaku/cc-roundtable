import { MeetingRoomDaemonApp } from "../app/meeting-room-daemon-app";
import { createMeetingRoomDaemonHttpApp } from "./create-meeting-room-daemon-http-app";
import type { MeetingRoomDaemonServerHandle, MeetingRoomDaemonServerOptions } from "../types";
import { readHost, readPort } from "../utils";
import { readPublicShareDemoConfig } from "../public-share/config";
import { createPublicShareHttpApp } from "../public-share/create-public-share-http-app";
import { startHttpServer } from "./start-http-server";

export async function startMeetingRoomDaemonServer(
  options: MeetingRoomDaemonServerOptions = {}
): Promise<MeetingRoomDaemonServerHandle> {
  const host = options.host ?? readHost();
  const port = options.port ?? readPort();
  const log = options.log ?? ((message: string) => console.log(message));
  const startedAt = Date.now();
  const app = new MeetingRoomDaemonApp(log);
  const publicShareConfig = readPublicShareDemoConfig();
  await app.start();
  const web = createMeetingRoomDaemonHttpApp({
    app,
    host,
    port,
    startedAt
  });

  let server: Awaited<ReturnType<typeof startHttpServer>> | null = null;
  let publicShareServer: Awaited<ReturnType<typeof startHttpServer>> | null = null;

  try {
    server = await startHttpServer(web.fetch, host, port);
    if (publicShareConfig) {
      publicShareServer = await startHttpServer(
        createPublicShareHttpApp({
          app,
          config: publicShareConfig
        }).fetch,
        publicShareConfig.host,
        publicShareConfig.port
      );
    }
  } catch (error) {
    await Promise.allSettled([
      publicShareServer ? closeServer(publicShareServer) : Promise.resolve(),
      server ? closeServer(server) : Promise.resolve(),
      app.stop()
    ]);
    throw error;
  }

  log(`meeting-room-daemon listening on http://${host}:${port}`);
  if (publicShareConfig) {
    log(
      `meeting-room-public-share listening on http://${publicShareConfig.host}:${publicShareConfig.port}/share/${publicShareConfig.shareId}`
    );
  }

  return {
    host,
    port,
    publicShare: publicShareConfig
      ? {
          host: publicShareConfig.host,
          port: publicShareConfig.port,
          sharePath: `/share/${publicShareConfig.shareId}`
        }
      : undefined,
    stop: async () => {
      await app.stop();
      await Promise.all([
        closeServer(server),
        publicShareServer ? closeServer(publicShareServer) : Promise.resolve()
      ]);
    }
  };
}

async function closeServer(server: Awaited<ReturnType<typeof startHttpServer>>): Promise<void> {
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
