import {
  MEETING_ROOM_DAEMON_DEFAULT_HOST,
  MEETING_ROOM_PUBLIC_SHARE_DEFAULT_PORT
} from "@contracts/meeting-room-daemon";
import type { PublicShareDemoConfig } from "../types";

const PUBLIC_SHARE_ID_ENV = "MEETING_ROOM_PUBLIC_SHARE_ID";
const PUBLIC_SHARE_HOST_ENV = "MEETING_ROOM_PUBLIC_GATEWAY_HOST";
const PUBLIC_SHARE_PORT_ENV = "MEETING_ROOM_PUBLIC_GATEWAY_PORT";
const PUBLIC_SHARE_PROJECT_DIR_ENV = "MEETING_ROOM_PUBLIC_DEMO_PROJECT_DIR";
const PUBLIC_SHARE_TOPIC_ENV = "MEETING_ROOM_PUBLIC_DEMO_TOPIC";
const PUBLIC_SHARE_MEMBERS_ENV = "MEETING_ROOM_PUBLIC_DEMO_MEMBERS";
const PUBLIC_SHARE_BYPASS_ENV = "MEETING_ROOM_PUBLIC_DEMO_BYPASS_MODE";
const DAEMON_TOKEN_ENV = "MEETING_ROOM_DAEMON_TOKEN";

export function readPublicShareDemoConfig(): PublicShareDemoConfig | null {
  const rawShareId = process.env[PUBLIC_SHARE_ID_ENV]?.trim();
  if (!rawShareId) {
    return null;
  }

  if (!process.env[DAEMON_TOKEN_ENV]?.trim()) {
    throw new Error(`${DAEMON_TOKEN_ENV} is required when ${PUBLIC_SHARE_ID_ENV} is set.`);
  }

  const shareId = normalizeShareId(rawShareId);
  const projectDir = requireEnv(PUBLIC_SHARE_PROJECT_DIR_ENV);
  const topic = requireEnv(PUBLIC_SHARE_TOPIC_ENV);
  const members = parseMembers(requireEnv(PUBLIC_SHARE_MEMBERS_ENV));
  const rawPort = process.env[PUBLIC_SHARE_PORT_ENV]?.trim();
  const port = rawPort ? Number.parseInt(rawPort, 10) : MEETING_ROOM_PUBLIC_SHARE_DEFAULT_PORT;

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`${PUBLIC_SHARE_PORT_ENV} must be a positive integer.`);
  }

  return {
    shareId,
    meetingId: `public_${shareId}`,
    topic,
    projectDir,
    members,
    bypassMode: parseBoolean(process.env[PUBLIC_SHARE_BYPASS_ENV], true),
    host: process.env[PUBLIC_SHARE_HOST_ENV]?.trim() || MEETING_ROOM_DAEMON_DEFAULT_HOST,
    port
  };
}

function normalizeShareId(value: string): string {
  const normalized = value
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!normalized) {
    throw new Error(`${PUBLIC_SHARE_ID_ENV} must contain at least one URL-safe character.`);
  }
  return normalized;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required when ${PUBLIC_SHARE_ID_ENV} is set.`);
  }
  return value;
}

function parseMembers(value: string): string[] {
  const members = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (members.length === 0) {
    throw new Error(`${PUBLIC_SHARE_MEMBERS_ENV} must include at least one member id.`);
  }
  return members;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  const normalized = value?.trim();
  if (!normalized) {
    return defaultValue;
  }
  if (/^(1|true|yes|on)$/i.test(normalized)) {
    return true;
  }
  if (/^(0|false|no|off)$/i.test(normalized)) {
    return false;
  }
  throw new Error(
    `${PUBLIC_SHARE_BYPASS_ENV} must be one of true/false/1/0/yes/no/on/off when set.`
  );
}
