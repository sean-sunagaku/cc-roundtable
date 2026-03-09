import { startMeetingRoomDaemonServer } from "./http/start-meeting-room-daemon-server";

export { startMeetingRoomDaemonServer } from "./http/start-meeting-room-daemon-server";

async function main(): Promise<void> {
  const handle = await startMeetingRoomDaemonServer();
  const shutdown = (): void => {
    void handle.stop().finally(() => process.exit(0));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

if (require.main === module) {
  void main().catch((error) => {
    console.error("Failed to start meeting-room-daemon", error);
    process.exit(1);
  });
}
