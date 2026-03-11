#!/usr/bin/env python3
"""PostToolUse hook to relay TeamCreate/Task events to Meeting Room chat."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any


from contracts import (
    HookEnvVars as E,
    RelayPayloadFields as F,
    RelayPayloadTypes as T,
)
from hook_common import (
    as_str,
    default_meeting_room_path,
    extract_mapping,
    get_env_str,
    is_meeting_mode_active,
    is_subagent_context,
    parse_json_stdin,
)
from hook_transport import relay_json_with_fallback

EVENT_TOOL_NAMES = {"teamcreate", "create_team", "create-team", "task"}


def _extract_tool_name(payload: dict[str, Any]) -> str:
    for key in ("tool_name", "tool", "name", "matcher"):
        candidate = payload.get(key)
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()
    metadata = extract_mapping(payload, "metadata")
    for key in ("tool_name", "tool"):
        candidate = metadata.get(key)
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()
    return ""


def _extract_task_text(payload: dict[str, Any]) -> str:
    tool_input = extract_mapping(payload, "tool_input")
    for key in ("description", "prompt", "task", "content", "message"):
        value = tool_input.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _extract_member_count(payload: dict[str, Any]) -> int | None:
    tool_input = extract_mapping(payload, "tool_input")
    for key in ("members", "member_ids", "agents"):
        value = tool_input.get(key)
        if isinstance(value, list):
            return len(value)
    return None


def should_emit(payload: dict[str, Any]) -> tuple[bool, str]:
    tool_name = _extract_tool_name(payload)
    if not tool_name:
        return False, ""
    normalized = tool_name.strip().lower()
    if normalized in EVENT_TOOL_NAMES:
        return True, normalized
    return False, normalized


def build_event_message(payload: dict[str, Any], normalized_tool_name: str) -> dict[str, Any]:
    sender = "system"
    team = get_env_str("CLAUDE_TEAM_NAME") or "meeting-room"
    meeting_id = get_env_str(E.MEETING_ID) or None
    timestamp = datetime.now(timezone.utc).isoformat()
    msg_id = f"team_event_{int(datetime.now(tz=timezone.utc).timestamp())}_{secrets.token_hex(3)}"

    if normalized_tool_name in {"teamcreate", "create_team", "create-team"}:
        member_count = _extract_member_count(payload)
        if isinstance(member_count, int):
            content = f"### Team Event\n- TeamCreate を実行\n- メンバー数: {member_count}"
        else:
            content = "### Team Event\n- TeamCreate を実行"
    else:
        task_text = _extract_task_text(payload)
        if task_text:
            task_preview = task_text if len(task_text) <= 200 else f"{task_text[:200]}..."
            content = f"### Team Event\n- Task を作成\n- 内容: {task_preview}"
        else:
            content = "### Team Event\n- Task を作成"

    return {
        F.TYPE: T.AGENT_MESSAGE,
        F.ID: msg_id,
        F.SENDER: sender,
        F.CONTENT: content,
        F.TIMESTAMP: timestamp,
        F.TEAM: team,
        F.MEETING_ID: meeting_id,
        F.RAW_TYPE: normalized_tool_name,
    }


def main() -> int:
    if not is_meeting_mode_active():
        return 0
    if is_subagent_context():
        return 0

    payload = parse_json_stdin()
    if not payload:
        return 0
    hook_event = as_str(payload.get("hook_event_name")).lower()
    if hook_event != "posttooluse":
        return 0

    should, normalized = should_emit(payload)
    if not should:
        return 0

    message = build_event_message(payload, normalized)
    relay_json_with_fallback(
        message,
        default_log_path=default_meeting_room_path("discussion.log.jsonl"),
        fallback_env_var=E.FALLBACK_LOG,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
