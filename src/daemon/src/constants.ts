import { HOOK_ENV_VARS, RESPONSE_MARKERS } from "@contracts/hook-contract";

export const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
} as const;

export const ACTIVE_FLAG_RELATIVE_PATH = ".claude/meeting-room/.active";
export const APPROVAL_STATE_RELATIVE_DIR = ".claude/meeting-room/approval";
export const HOOKS_WS_PORT =
  Number.parseInt(process.env[HOOK_ENV_VARS.wsPort] ?? "9999", 10) || 9999;
export const SESSION_DEBUG_SUFFIX = "/debug";
export const SESSION_TERMINAL_SUFFIX = "/terminal";
export const SESSION_VIEW_UPDATED_EVENT = "session.view.updated";
export const WEB_ROOT_PREFIX = "/web";
export const RESPONSE_MARKER_START = RESPONSE_MARKERS.start;
export const RESPONSE_MARKER_END = RESPONSE_MARKERS.end;
