import { MeetingRoomShell } from "./MeetingRoomShell";

export function App(): JSX.Element {
  const urlParams = new URLSearchParams(window.location.search);

  return (
    <MeetingRoomShell
      client={window.meetingRoom}
      debugWindow={urlParams.get("debugWindow") === "1"}
      debugMeetingId={urlParams.get("meetingId") ?? ""}
      canOpenDevTools
      canOpenSessionDebugWindow
    />
  );
}
