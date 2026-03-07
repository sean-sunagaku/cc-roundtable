import type { MeetingRoomClient } from "@shared/meeting-room-client";

declare global {
  interface Window {
    meetingRoom: MeetingRoomClient;
  }
}

export {};
