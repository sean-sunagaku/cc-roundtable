#!/usr/bin/env python3
"""PostToolUse hook to relay SubagentStop status to Meeting Room."""

from __future__ import annotations

import json
import os
import base64
import hashlib
import secrets
import socket
import sys
from datetime import datetime, timezone


def parse_payload() -> dict:
    raw = sys.stdin.read().strip()
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


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
    first = bytes([0x81])
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


def send_json(payload: dict) -> None:
    host = os.environ.get("MEETING_ROOM_WS_HOST", "127.0.0.1")
    port = int(os.environ.get("MEETING_ROOM_WS_PORT", "9999"))
    ws_path = os.environ.get("MEETING_ROOM_WS_PATH", "/")
    timeout = float(os.environ.get("MEETING_ROOM_WS_TIMEOUT", "0.8"))
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    guid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
    key = base64.b64encode(secrets.token_bytes(16)).decode("ascii")
    expected_accept = base64.b64encode(hashlib.sha1(f"{key}{guid}".encode("ascii")).digest()).decode("ascii")
    request = (
        f"GET {ws_path} HTTP/1.1\r\n"
        f"Host: {host}:{port}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        "Sec-WebSocket-Version: 13\r\n\r\n"
    ).encode("ascii")

    with socket.create_connection((host, port), timeout=timeout) as sock:
        sock.settimeout(timeout)
        sock.sendall(request)
        response = _recv_until(sock, b"\r\n\r\n").decode("latin1", errors="ignore")
        if "101" not in response.split("\r\n", 1)[0] or expected_accept not in response:
            raise RuntimeError("websocket handshake failed")
        sock.sendall(_build_ws_frame(body))


def fallback_log(payload: dict) -> None:
    log_path = os.environ.get("MEETING_ROOM_STATUS_LOG")
    if not log_path:
        log_path = os.path.join(os.getcwd(), ".claude", "meeting-room", "status.log.jsonl")
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    with open(log_path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(payload, ensure_ascii=False) + "\n")


def main() -> int:
    payload = parse_payload()
    if not payload:
        return 0
    sender = os.environ.get("CLAUDE_SUBAGENT_NAME") or os.environ.get("CLAUDE_AGENT_NAME") or "agent"
    event = {
        "type": "agent_status",
        "id": f"status_{int(datetime.now(tz=timezone.utc).timestamp())}_{sender}",
        "sender": sender,
        "content": "completed",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "team": os.environ.get("CLAUDE_TEAM_NAME", "unknown"),
        "status": "completed"
    }
    try:
        send_json(event)
    except Exception:
        try:
            fallback_log(event)
        except Exception:
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
