#!/usr/bin/env python3
"""PostToolUse hook for Meeting Room.

Relays SendMessage payloads to the Electron WebSocket server.
Falls back to local JSONL logging when relay is unavailable.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import secrets
import socket
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, TypedDict


GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
WS_HOST = os.environ.get("MEETING_ROOM_WS_HOST", "127.0.0.1")
WS_PORT = int(os.environ.get("MEETING_ROOM_WS_PORT", "9999"))
WS_PATH = os.environ.get("MEETING_ROOM_WS_PATH", "/")
WS_TIMEOUT = float(os.environ.get("MEETING_ROOM_WS_TIMEOUT", "0.8"))
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


PATH_ONLY_PATTERN = r"^(?:/Users/|/home/|[A-Za-z]:\\).+\.(?:jsonl|json|md|txt|log)$"


def _candidate_active_paths() -> list[Path]:
    env_path = os.environ.get("MEETING_ROOM_ACTIVE_FILE")
    paths: list[Path] = []
    if env_path:
        paths.append(Path(env_path).expanduser())
    cwd = Path.cwd()
    paths.append(cwd / ".claude" / "meeting-room" / ".active")
    paths.append(Path.home() / ".claude" / "meeting-room" / ".active")
    return paths


def is_meeting_mode_active() -> bool:
    for path in _candidate_active_paths():
        if path.exists():
            return True
    return False


def parse_payload() -> SendMessageHookPayload:
    raw = sys.stdin.read().strip()
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    if isinstance(data, dict):
        return data
    return {}


def _extract_mapping(payload: dict[str, Any], key: str) -> dict[str, Any]:
    value = payload.get(key)
    if isinstance(value, dict):
        return value
    return {}


def _as_str(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _is_valid_message_content(value: str) -> bool:
    if not value.strip():
        return False
    compact = value.strip()
    if compact.startswith("[[[MEETING_ROOM_RESPONSE_START]]]"):
        return False
    if compact.startswith("@") and "❯" in compact and "\n" not in compact:
        return False
    if re.match(PATH_ONLY_PATTERN, compact):
        return False
    return True


def _sender_from_agent_id(agent_id: str) -> str:
    if "@" in agent_id:
        return agent_id.split("@", 1)[0].strip()
    return agent_id.strip()


def _resolve_message(payload: SendMessageHookPayload) -> ResolvedMessage:
    tool_input = _extract_mapping(payload, "tool_input")
    response = _extract_mapping(payload, "tool_response")
    routing = _extract_mapping(response, "routing")
    metadata = _extract_mapping(payload, "metadata")

    routing_sender = _as_str(routing.get("sender"))
    env_subagent = _as_str(os.environ.get("CLAUDE_SUBAGENT_NAME"))
    env_agent = _as_str(os.environ.get("CLAUDE_AGENT_NAME"))
    metadata_subagent = _as_str(metadata.get("subagent"))
    metadata_agent = _as_str(metadata.get("agent"))
    agent_id_sender = _sender_from_agent_id(_as_str(payload.get("agent_id")))

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
        _as_str(routing.get("content")),
        _as_str(response.get("content")),
        _as_str(tool_input.get("content")),
    ]
    content = next((candidate for candidate in content_candidates if _is_valid_message_content(candidate)), "")
    team = _as_str(metadata.get("team")) or _as_str(os.environ.get("CLAUDE_TEAM_NAME")) or "unknown"
    meeting_id = _as_str(metadata.get("meeting_id")) or _as_str(os.environ.get("MEETING_ROOM_MEETING_ID")) or None
    raw_type = _as_str(tool_input.get("type")) or "message"

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
    path = os.environ.get("MEETING_ROOM_WS_DEBUG_LOG", "").strip()
    debug_path = Path(path).expanduser() if path else DEFAULT_DEBUG_LOG
    debug_path.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "payloadKeys": sorted(payload.keys()),
        "toolInputKeys": sorted(_extract_mapping(payload, "tool_input").keys()),
        "toolResponseKeys": sorted(_extract_mapping(payload, "tool_response").keys()),
        "routingKeys": sorted(_extract_mapping(_extract_mapping(payload, "tool_response"), "routing").keys()),
        "envSubagent": _as_str(os.environ.get("CLAUDE_SUBAGENT_NAME")),
        "envAgent": _as_str(os.environ.get("CLAUDE_AGENT_NAME")),
        "resolvedSender": resolved.sender,
        "resolvedSubagent": resolved.subagent,
        "senderSource": resolved.sender_source,
        "meetingId": resolved.meeting_id,
        "rawType": resolved.raw_type,
        "contentPreview": resolved.content[:200],
    }
    with debug_path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def build_message(resolved: ResolvedMessage) -> dict[str, Any]:
    timestamp = datetime.now(timezone.utc).isoformat()
    msg_id = f"msg_{int(datetime.now(tz=timezone.utc).timestamp())}_{resolved.sender.replace(' ', '_')}"

    return {
        "type": "agent_message",
        "id": msg_id,
        "sender": resolved.sender,
        "subagent": resolved.subagent,
        "content": resolved.content,
        "timestamp": timestamp,
        "team": resolved.team,
        "meetingId": resolved.meeting_id,
        "rawType": resolved.raw_type,
    }


def _recv_until(sock: socket.socket, marker: bytes) -> bytes:
    data = b""
    while marker not in data:
        chunk = sock.recv(4096)
        if not chunk:
            break
        data += chunk
        if len(data) > 65536:
            break
    return data


def _build_ws_frame(payload: bytes) -> bytes:
    # Client frames must be masked.
    first = bytes([0x81])  # FIN + text frame
    mask_bit = 0x80
    size = len(payload)

    if size < 126:
        header = first + bytes([mask_bit | size])
    elif size < (1 << 16):
        header = first + bytes([mask_bit | 126]) + size.to_bytes(2, "big")
    else:
        header = first + bytes([mask_bit | 127]) + size.to_bytes(8, "big")

    mask = secrets.token_bytes(4)
    masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
    return header + mask + masked


def send_ws_json(message: dict[str, Any]) -> None:
    body = json.dumps(message, ensure_ascii=False).encode("utf-8")
    key = base64.b64encode(secrets.token_bytes(16)).decode("ascii")
    expected_accept = base64.b64encode(hashlib.sha1(f"{key}{GUID}".encode("ascii")).digest()).decode("ascii")

    request = (
        f"GET {WS_PATH} HTTP/1.1\r\n"
        f"Host: {WS_HOST}:{WS_PORT}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        "Sec-WebSocket-Version: 13\r\n\r\n"
    ).encode("ascii")

    with socket.create_connection((WS_HOST, WS_PORT), timeout=WS_TIMEOUT) as sock:
        sock.settimeout(WS_TIMEOUT)
        sock.sendall(request)
        response = _recv_until(sock, b"\r\n\r\n").decode("latin1", errors="ignore")
        if "101" not in response.split("\r\n", 1)[0]:
            raise RuntimeError("websocket handshake failed")
        if expected_accept not in response:
            raise RuntimeError("invalid websocket accept key")
        sock.sendall(_build_ws_frame(body))


def fallback_log(message: dict[str, Any]) -> None:
    path_env = os.environ.get("MEETING_ROOM_FALLBACK_LOG")
    if path_env:
        log_path = Path(path_env).expanduser()
    else:
        log_path = Path.cwd() / ".claude" / "meeting-room" / "discussion.log.jsonl"

    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(message, ensure_ascii=False) + "\n")


def main() -> int:
    if not is_meeting_mode_active():
        return 0

    payload = parse_payload()
    if not payload:
        return 0
    if _as_str(payload.get("hook_event_name")).lower() != "posttooluse":
        return 0
    if _as_str(payload.get("tool_name")).lower() != "sendmessage":
        return 0

    resolved = _resolve_message(payload)
    try:
        write_debug(payload, resolved)
    except Exception:
        pass
    if not _is_valid_message_content(resolved.content):
        return 0

    message = build_message(resolved)
    try:
        send_ws_json(message)
    except Exception:
        try:
            fallback_log(message)
        except Exception:
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
