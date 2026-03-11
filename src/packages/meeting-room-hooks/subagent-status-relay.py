#!/usr/bin/env python3
"""PostToolUse hook to relay SubagentStop status to Meeting Room."""

from __future__ import annotations

from datetime import datetime, timezone


from contracts import (
    AgentStatusValues as S,
    HookEnvVars as E,
    RelayPayloadFields as F,
    RelayPayloadTypes as T,
)
from hook_common import default_meeting_room_path, get_env_str, is_meeting_mode_active, parse_json_stdin
from hook_transport import relay_json_with_fallback


def main() -> int:
    if not is_meeting_mode_active():
        return 0

    payload = parse_json_stdin()
    if not payload:
        return 0
    sender = get_env_str("CLAUDE_SUBAGENT_NAME") or get_env_str("CLAUDE_AGENT_NAME") or "agent"
    meeting_id = get_env_str(E.MEETING_ID) or None
    event = {
        F.TYPE: T.AGENT_STATUS,
        F.ID: f"status_{int(datetime.now(tz=timezone.utc).timestamp())}_{sender}",
        F.SENDER: sender,
        F.CONTENT: S.COMPLETED,
        F.TIMESTAMP: datetime.now(timezone.utc).isoformat(),
        F.TEAM: get_env_str("CLAUDE_TEAM_NAME") or "unknown",
        F.MEETING_ID: meeting_id,
        F.STATUS: S.COMPLETED,
    }
    relay_json_with_fallback(
        event,
        default_log_path=default_meeting_room_path("status.log.jsonl"),
        fallback_env_var=E.STATUS_LOG,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
