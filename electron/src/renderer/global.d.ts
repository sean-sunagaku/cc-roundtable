import type { MeetingRoomApi } from "../main/preload";

declare global {
  interface Window {
    meetingRoom: MeetingRoomApi;
  }
}

export {};
