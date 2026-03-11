#!/usr/bin/env python3
"""Stop hook to relay the latest assistant response to Meeting Room."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


from contracts import (
    HookEnvVars as E,
    RelayPayloadFields as F,
    RelayPayloadTypes as T,
    ResponseMarkers as M,
)
from hook_common import (
    as_str,
    default_meeting_room_path,
    get_env_str,
    is_meeting_mode_active,
    is_subagent_context,
    parse_json_stdin,
)
from hook_text import is_valid_assistant_text
from hook_transport import relay_json_with_fallback

DEFAULT_DEBUG_LOG = Path.cwd() / ".claude" / "meeting-room" / "stop-hook.log.jsonl"


def _extract_str_any(payload: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = payload.get(key)
        compact = as_str(value)
        if compact:
            return compact
    return ""


def _extract_str(payload: dict[str, Any], key: str) -> str:
    return as_str(payload.get(key))


def _extract_text_blocks(value: Any) -> list[str]:
    if isinstance(value, str):
        compact = value.strip()
        return [compact] if compact else []

    texts: list[str] = []
    if isinstance(value, list):
        for item in value:
            texts.extend(_extract_text_blocks(item))
        return texts

    if isinstance(value, dict):
        block_type = value.get("type")
        if isinstance(block_type, str) and block_type == "text":
            text = value.get("text")
            if isinstance(text, str) and text.strip():
                texts.append(text.strip())

        for key in ("text", "content", "message", "response", "output"):
            if key in value:
                texts.extend(_extract_text_blocks(value.get(key)))
    return texts


def _extract_assistant_text_from_record(record: Any) -> str:
    if not isinstance(record, dict):
        return ""

    role = record.get("role")
    if not isinstance(role, str) or role.lower() != "assistant":
        return ""

    message = record.get("message")
    candidates = _extract_text_blocks(message)
    if not candidates:
        candidates = _extract_text_blocks(record.get("content"))
    return _pick_best_text(candidates)


def _extract_assistant_from_transcript(payload: dict[str, Any]) -> str:
    transcript_path = _extract_str_any(payload, "transcript_path")
    if not transcript_path:
        transcript_path = get_env_str("CLAUDE_TRANSCRIPT_PATH")
    if not transcript_path:
        return ""

    path = Path(transcript_path).expanduser()
    if not path.exists() or not path.is_file():
        return ""

    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except Exception:
        return ""

    for line in reversed(lines):
        compact = line.strip()
        if not compact:
            continue
        try:
            record = json.loads(compact)
        except json.JSONDecodeError:
            continue
        candidate = _extract_assistant_text_from_record(record)
        if candidate:
            return candidate
    return ""


def _collect_text_values(value: Any) -> list[str]:
    texts: list[str] = []
    if isinstance(value, str):
        compact = value.strip()
        if compact:
            texts.append(compact)
        return texts

    if isinstance(value, list):
        for item in value:
            texts.extend(_collect_text_values(item))
        return texts

    if isinstance(value, dict):
        prioritized_keys = (
            "text",
            "content",
            "message",
            "response",
            "output",
            "last_assistant_message",
            "assistant_message",
            "final_response",
        )
        for key in prioritized_keys:
            if key in value:
                texts.extend(_collect_text_values(value.get(key)))

        ignored_keys = {
            "id",
            "type",
            "role",
            "event",
            "session_id",
            "timestamp",
            "stop_reason",
            "tool_name",
            "tool_input",
            "tool_response",
            "metadata",
        }
        for key, item in value.items():
            if key in prioritized_keys or key in ignored_keys:
                continue
            texts.extend(_collect_text_values(item))
    return texts


def _pick_best_text(candidates: list[str]) -> str:
    cleaned: list[str] = []
    seen = set()
    for item in candidates:
        compact = item.strip()
        if not compact:
            continue
        if compact in seen:
            continue
        seen.add(compact)
        cleaned.append(compact)
    if not cleaned:
        return ""
    cleaned.sort(key=len, reverse=True)
    return cleaned[0]


def _is_valid_assistant_text(value: str) -> bool:
    return is_valid_assistant_text(value)


def extract_assistant_response(payload: dict[str, Any]) -> str:
    env_candidates = [
        get_env_str("CLAUDE_RESPONSE"),
        get_env_str("CLAUDE_LAST_ASSISTANT_MESSAGE"),
        get_env_str("CLAUDE_ASSISTANT_MESSAGE"),
    ]
    for item in env_candidates:
        if _is_valid_assistant_text(item):
            return item

    direct_candidates: list[str] = [
        _extract_str_any(payload, "last_assistant_message"),
        _extract_str_any(payload, "assistant_message"),
        _extract_str(payload, "response"),
        _extract_str_any(payload, "final_response"),
    ]
    direct_picked = _pick_best_text(direct_candidates)
    if direct_picked and _is_valid_assistant_text(direct_picked):
        return direct_picked

    structured_candidates = _collect_text_values(
        {
            "lastAssistantMessage": payload.get("last_assistant_message"),
            "assistantMessage": payload.get("assistant_message"),
            "response": payload.get("response"),
            "finalResponse": payload.get("final_response"),
            "content": payload.get("content"),
            "message": payload.get("message"),
        }
    )
    structured_picked = _pick_best_text(structured_candidates)
    if structured_picked and _is_valid_assistant_text(structured_picked):
        return structured_picked

    transcript_picked = _extract_assistant_from_transcript(payload)
    if transcript_picked and _is_valid_assistant_text(transcript_picked):
        return transcript_picked

    fallback_picked = _pick_best_text(_collect_text_values(payload))
    if fallback_picked and _is_valid_assistant_text(fallback_picked):
        return fallback_picked
    return ""


def write_debug(payload: dict[str, Any], content: str) -> None:
    path = get_env_str(E.STOP_DEBUG_LOG)
    debug_path = Path(path).expanduser() if path else DEFAULT_DEBUG_LOG
    debug_path.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "stopReason": get_env_str("CLAUDE_STOP_REASON"),
        "payloadKeys": sorted(payload.keys()),
        "hasContent": bool(content.strip()),
        "contentPreview": content[:200],
    }
    with debug_path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def build_message(content: str) -> dict[str, Any]:
    sender = get_env_str("CLAUDE_AGENT_NAME") or "leader"
    team = get_env_str("CLAUDE_TEAM_NAME") or "leader"
    meeting_id = get_env_str(E.MEETING_ID) or None
    timestamp = datetime.now(timezone.utc).isoformat()
    msg_id = f"stop_{int(datetime.now(tz=timezone.utc).timestamp())}_{sender.replace(' ', '_')}"

    marked_content = f"{M.START}\n{content.strip()}\n{M.END}"

    return {
        F.TYPE: T.AGENT_MESSAGE,
        F.ID: msg_id,
        F.SENDER: sender,
        F.CONTENT: marked_content,
        F.TIMESTAMP: timestamp,
        F.TEAM: team,
        F.MEETING_ID: meeting_id,
        F.RAW_TYPE: "stop",
    }


def main() -> int:
    if not is_meeting_mode_active():
        return 0
    if is_subagent_context():
        return 0

    payload = parse_json_stdin()
    if _extract_str_any(payload, "hook_event_name").lower() != "stop":
        return 0
    content = extract_assistant_response(payload)
    try:
        write_debug(payload, content)
    except Exception:
        pass
    if not _is_valid_assistant_text(content):
        return 0

    message = build_message(content)
    relay_json_with_fallback(
        message,
        default_log_path=default_meeting_room_path("discussion.log.jsonl"),
        fallback_env_var=E.FALLBACK_LOG,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
