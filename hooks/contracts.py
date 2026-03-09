"""Auto-generated from packages/shared-contracts/src/hook-contract.ts

DO NOT EDIT MANUALLY. Run `make contracts` to regenerate.
"""


class AgentStatusValues:
    ACTIVE = "active"
    COMPLETED = "completed"


class ApprovalGateFields:
    MODE = "mode"
    BYPASS_MODE = "bypassMode"
    REASON = "reason"


class ApprovalGateModes:
    OPEN = "open"
    BLOCKED = "blocked"


class HookEnvVars:
    MEETING_ID = "MEETING_ROOM_MEETING_ID"
    ACTIVE_FILE = "MEETING_ROOM_ACTIVE_FILE"
    APPROVAL_DIR = "MEETING_ROOM_APPROVAL_DIR"
    APPROVAL_FILE = "MEETING_ROOM_APPROVAL_FILE"
    SETTINGS_FILE = "MEETING_ROOM_SETTINGS_FILE"
    HOOKS_DIR = "MEETING_ROOM_HOOKS_DIR"
    FALLBACK_LOG = "MEETING_ROOM_FALLBACK_LOG"
    STOP_DEBUG_LOG = "MEETING_ROOM_STOP_DEBUG_LOG"
    WS_DEBUG_LOG = "MEETING_ROOM_WS_DEBUG_LOG"
    WS_PORT = "MEETING_ROOM_WS_PORT"
    WS_HOST = "MEETING_ROOM_WS_HOST"
    WS_PATH = "MEETING_ROOM_WS_PATH"
    WS_TIMEOUT = "MEETING_ROOM_WS_TIMEOUT"
    STATUS_LOG = "MEETING_ROOM_STATUS_LOG"


class RelayPayloadFields:
    TYPE = "type"
    ID = "id"
    SENDER = "sender"
    SUBAGENT = "subagent"
    CONTENT = "content"
    TIMESTAMP = "timestamp"
    TEAM = "team"
    MEETING_ID = "meetingId"
    RAW_TYPE = "rawType"
    STATUS = "status"


class RelayPayloadTypes:
    AGENT_MESSAGE = "agent_message"
    AGENT_STATUS = "agent_status"


class ResponseMarkers:
    START = "[[[MEETING_ROOM_RESPONSE_START]]]"
    END = "[[[MEETING_ROOM_RESPONSE_END]]]"


# All contract classes for introspection
ALL_CONTRACTS = {
    "AGENT_STATUS_VALUES": AgentStatusValues,
    "APPROVAL_GATE_FIELDS": ApprovalGateFields,
    "APPROVAL_GATE_MODES": ApprovalGateModes,
    "HOOK_ENV_VARS": HookEnvVars,
    "RELAY_PAYLOAD_FIELDS": RelayPayloadFields,
    "RELAY_PAYLOAD_TYPES": RelayPayloadTypes,
    "RESPONSE_MARKERS": ResponseMarkers,
}
