/**
 * Shared contract between TypeScript and Python hooks.
 *
 * This file is the SINGLE SOURCE OF TRUTH for field names, env var names,
 * and constants shared across the TS ↔ Python boundary.
 *
 * Python constants are auto-generated from this file.
 * Run `make contracts` to regenerate `src/packages/meeting-room-hooks/contracts.py`.
 *
 * DO NOT duplicate these values as string literals in hooks.
 */

// ---------------------------------------------------------------------------
// Relay Payload: Python hooks → TS daemon (via WebSocket)
// ---------------------------------------------------------------------------

/** Field names used in the JSON payload that Python hooks send to the TS daemon. */
export const RELAY_PAYLOAD_FIELDS = {
  type: "type",
  id: "id",
  sender: "sender",
  subagent: "subagent",
  content: "content",
  timestamp: "timestamp",
  team: "team",
  meetingId: "meetingId",
  rawType: "rawType",
  status: "status"
} as const;

/** Valid values for RelayPayload.type */
export const RELAY_PAYLOAD_TYPES = {
  agentMessage: "agent_message",
  agentStatus: "agent_status"
} as const;

/** Valid values for RelayPayload.status / agent status */
export const AGENT_STATUS_VALUES = {
  active: "active",
  completed: "completed"
} as const;

// ---------------------------------------------------------------------------
// Environment Variables: TS daemon → Python hooks
// ---------------------------------------------------------------------------

/** Environment variable names that the TS daemon sets for Claude sessions. */
export const HOOK_ENV_VARS = {
  meetingId: "MEETING_ROOM_MEETING_ID",
  activeFile: "MEETING_ROOM_ACTIVE_FILE",
  approvalDir: "MEETING_ROOM_APPROVAL_DIR",
  approvalFile: "MEETING_ROOM_APPROVAL_FILE",
  settingsFile: "MEETING_ROOM_SETTINGS_FILE",
  hooksDir: "MEETING_ROOM_HOOKS_DIR",
  fallbackLog: "MEETING_ROOM_FALLBACK_LOG",
  stopDebugLog: "MEETING_ROOM_STOP_DEBUG_LOG",
  wsDebugLog: "MEETING_ROOM_WS_DEBUG_LOG",
  wsPort: "MEETING_ROOM_WS_PORT",
  wsHost: "MEETING_ROOM_WS_HOST",
  wsPath: "MEETING_ROOM_WS_PATH",
  wsTimeout: "MEETING_ROOM_WS_TIMEOUT",
  statusLog: "MEETING_ROOM_STATUS_LOG"
} as const;

// ---------------------------------------------------------------------------
// Response Markers: used by both stop-relay.py and TS daemon
// ---------------------------------------------------------------------------

export const RESPONSE_MARKERS = {
  start: "[[[MEETING_ROOM_RESPONSE_START]]]",
  end: "[[[MEETING_ROOM_RESPONSE_END]]]"
} as const;

// ---------------------------------------------------------------------------
// Approval Gate: TS daemon writes JSON, Python hook reads
// ---------------------------------------------------------------------------

/** Field names in the approval gate JSON file. */
export const APPROVAL_GATE_FIELDS = {
  mode: "mode",
  bypassMode: "bypassMode",
  reason: "reason"
} as const;

export const APPROVAL_GATE_MODES = {
  open: "open",
  blocked: "blocked"
} as const;
