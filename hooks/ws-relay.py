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


def build_message(payload: dict[str, Any]) -> dict[str, Any]:
    tool_input = _extract_dict(payload, "tool_input")
    response = _extract_dict(payload, "tool_response")
    metadata = _extract_dict(payload, "metadata")

    sender = (
        os.environ.get("CLAUDE_SUBAGENT_NAME")
        or os.environ.get("CLAUDE_AGENT_NAME")
        or metadata.get("agent")
        or "leader"
    )
    if not isinstance(sender, str):
        sender = "leader"

    content = response.get("content")
    if not isinstance(content, str) or not content.strip():
        content = tool_input.get("content")
    if not isinstance(content, str):
        content = ""

    team = (
        metadata.get("team")
        or os.environ.get("CLAUDE_TEAM_NAME")
        or "unknown"
    )
    if not isinstance(team, str):
        team = "unknown"

    meeting_id = metadata.get("meetingId") or os.environ.get("MEETING_ROOM_MEETING_ID")
    if not isinstance(meeting_id, str) or not meeting_id.strip():
        meeting_id = None
    else:
        meeting_id = meeting_id.strip()

    timestamp = datetime.now(timezone.utc).isoformat()
    msg_id = f"msg_{int(datetime.now(tz=timezone.utc).timestamp())}_{sender.replace(' ', '_')}"

    return {
        "type": "agent_message",
        "id": msg_id,
        "sender": sender,
        "content": content,
        "timestamp": timestamp,
        "team": team,
        "meetingId": meeting_id,
        "rawType": tool_input.get("type"),
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

    message = build_message(payload)
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
