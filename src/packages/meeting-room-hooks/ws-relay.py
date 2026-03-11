#!/usr/bin/env python3
"""PostToolUse hook for Meeting Room.

Relays SendMessage payloads to the Electron WebSocket server.
Falls back to local JSONL logging when relay is unavailable.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, TypedDict


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
    parse_json_stdin,
)
from hook_text import is_valid_message_content
from hook_transport import relay_json_with_fallback

DEFAULT_DEBUG_LOG = Path.cwd() / ".claude" / "meeting-room" / "ws-hook.log.jsonl"


class SendMessageToolInput(TypedDict, total=False):
    type: str
    recipient: str
    content: str
    summary: str


class SendMessageRouting(TypedDict, total=False):
    sender: str
    senderColor: str
    target: str
    targetColor: str
    summary: str
    content: str


class SendMessageToolResponse(TypedDict, total=False):
    success: bool
    message: str
    content: str
    routing: SendMessageRouting


class HookMetadata(TypedDict, total=False):
    agent: str
    team: str
    meetingId: str
    subagent: str


class SendMessageHookPayload(TypedDict, total=False):
    session_id: str
    cwd: str
    hook_event_name: str
    tool_name: str
    agent_id: str
    tool_input: SendMessageToolInput
    tool_response: SendMessageToolResponse
    metadata: HookMetadata


@dataclass(frozen=True)
class ResolvedMessage:
    sender: str
    subagent: str | None
    content: str
    team: str
    meeting_id: str | None
    raw_type: str
    sender_source: str


def _sender_from_agent_id(agent_id: str) -> str:
    if "@" in agent_id:
        return agent_id.split("@", 1)[0].strip()
    return agent_id.strip()


def _resolve_message(payload: SendMessageHookPayload) -> ResolvedMessage:
    tool_input = extract_mapping(payload, "tool_input")
    response = extract_mapping(payload, "tool_response")
    routing = extract_mapping(response, "routing")
    metadata = extract_mapping(payload, "metadata")

    routing_sender = as_str(routing.get("sender"))
    env_subagent = get_env_str("CLAUDE_SUBAGENT_NAME")
    env_agent = get_env_str("CLAUDE_AGENT_NAME")
    metadata_subagent = as_str(metadata.get("subagent"))
    metadata_agent = as_str(metadata.get("agent"))
    agent_id_sender = _sender_from_agent_id(as_str(payload.get("agent_id")))

    subagent = routing_sender or env_subagent or metadata_subagent or agent_id_sender or None
    sender = routing_sender
    sender_source = "routing"

    if not sender:
        if env_subagent:
            sender = env_subagent
            sender_source = "env_subagent"
        elif env_agent:
            sender = env_agent
            sender_source = "env_agent"
        elif metadata_agent:
            sender = metadata_agent
            sender_source = "metadata_agent"
        elif metadata_subagent:
            sender = metadata_subagent
            sender_source = "metadata_subagent"
        elif agent_id_sender:
            sender = agent_id_sender
            sender_source = "agent_id"
        else:
            sender = "leader"
            sender_source = "fallback"

    content_candidates = [
        as_str(routing.get("content")),
        as_str(response.get("content")),
        as_str(tool_input.get("content")),
    ]
    content = next((candidate for candidate in content_candidates if is_valid_message_content(candidate)), "")
    team = as_str(metadata.get("team")) or get_env_str("CLAUDE_TEAM_NAME") or "unknown"
    meeting_id = (
        as_str(metadata.get(F.MEETING_ID))
        or as_str(metadata.get("meeting_id"))
        or get_env_str(E.MEETING_ID)
        or None
    )
    raw_type = as_str(tool_input.get("type")) or "message"

    return ResolvedMessage(
        sender=sender,
        subagent=subagent,
        content=content,
        team=team,
        meeting_id=meeting_id,
        raw_type=raw_type,
        sender_source=sender_source,
    )


def write_debug(payload: SendMessageHookPayload, resolved: ResolvedMessage) -> None:
    path = get_env_str(E.WS_DEBUG_LOG)
    debug_path = Path(path).expanduser() if path else DEFAULT_DEBUG_LOG
    debug_path.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "payloadKeys": sorted(payload.keys()),
        "toolInputKeys": sorted(extract_mapping(payload, "tool_input").keys()),
        "toolResponseKeys": sorted(extract_mapping(payload, "tool_response").keys()),
        "routingKeys": sorted(extract_mapping(extract_mapping(payload, "tool_response"), "routing").keys()),
        "envSubagent": get_env_str("CLAUDE_SUBAGENT_NAME"),
        "envAgent": get_env_str("CLAUDE_AGENT_NAME"),
        "resolvedSender": resolved.sender,
        "resolvedSubagent": resolved.subagent,
        "senderSource": resolved.sender_source,
        F.MEETING_ID: resolved.meeting_id,
        F.RAW_TYPE: resolved.raw_type,
        "contentPreview": resolved.content[:200],
    }
    with debug_path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def build_message(resolved: ResolvedMessage) -> dict[str, Any]:
    timestamp = datetime.now(timezone.utc).isoformat()
    msg_id = f"msg_{int(datetime.now(tz=timezone.utc).timestamp())}_{resolved.sender.replace(' ', '_')}"

    return {
        F.TYPE: T.AGENT_MESSAGE,
        F.ID: msg_id,
        F.SENDER: resolved.sender,
        F.SUBAGENT: resolved.subagent,
        F.CONTENT: resolved.content,
        F.TIMESTAMP: timestamp,
        F.TEAM: resolved.team,
        F.MEETING_ID: resolved.meeting_id,
        F.RAW_TYPE: resolved.raw_type,
    }


def main() -> int:
    if not is_meeting_mode_active():
        return 0

    payload = parse_json_stdin()
    if not payload:
        return 0
    if as_str(payload.get("hook_event_name")).lower() != "posttooluse":
        return 0
    if as_str(payload.get("tool_name")).lower() != "sendmessage":
        return 0

    resolved = _resolve_message(payload)
    try:
        write_debug(payload, resolved)
    except Exception:
        pass
    if not is_valid_message_content(resolved.content):
        return 0

    message = build_message(resolved)
    relay_json_with_fallback(
        message,
        default_log_path=default_meeting_room_path("discussion.log.jsonl"),
        fallback_env_var=E.FALLBACK_LOG,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
