#!/usr/bin/env python3
"""PostToolUse hook to relay TeamCreate/Task events to Meeting Room chat."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import socket
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
WS_HOST = os.environ.get("MEETING_ROOM_WS_HOST", "127.0.0.1")
WS_PORT = int(os.environ.get("MEETING_ROOM_WS_PORT", "9999"))
WS_PATH = os.environ.get("MEETING_ROOM_WS_PATH", "/")
WS_TIMEOUT = float(os.environ.get("MEETING_ROOM_WS_TIMEOUT", "0.8"))

EVENT_TOOL_NAMES = {"teamcreate", "create_team", "create-team", "task"}


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


def is_subagent_context() -> bool:
    return bool(os.environ.get("CLAUDE_SUBAGENT_NAME", "").strip())


def parse_payload() -> dict[str, Any]:
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


def _extract_dict(payload: dict[str, Any], key: str) -> dict[str, Any]:
    value = payload.get(key)
    return value if isinstance(value, dict) else {}


def _extract_tool_name(payload: dict[str, Any]) -> str:
    for key in ("tool_name", "tool", "name", "matcher"):
        candidate = payload.get(key)
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()
    metadata = _extract_dict(payload, "metadata")
    for key in ("tool_name", "tool"):
        candidate = metadata.get(key)
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()
    return ""


def _extract_task_text(payload: dict[str, Any]) -> str:
    tool_input = _extract_dict(payload, "tool_input")
    for key in ("description", "prompt", "task", "content", "message"):
        value = tool_input.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _extract_member_count(payload: dict[str, Any]) -> int | None:
    tool_input = _extract_dict(payload, "tool_input")
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
    team = os.environ.get("CLAUDE_TEAM_NAME", "").strip() or "meeting-room"
    meeting_id = os.environ.get("MEETING_ROOM_MEETING_ID", "").strip() or None
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
        "type": "agent_message",
        "id": msg_id,
        "sender": sender,
        "content": content,
        "timestamp": timestamp,
        "team": team,
        "meetingId": meeting_id,
        "rawType": normalized_tool_name,
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
    if is_subagent_context():
        return 0

    payload = parse_payload()
    if not payload:
        return 0

    should, normalized = should_emit(payload)
    if not should:
        return 0

    message = build_event_message(payload, normalized)
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
