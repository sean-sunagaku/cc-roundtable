#!/usr/bin/env python3
"""Stop hook to relay the latest assistant response to Meeting Room."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
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

RESPONSE_MARKER_START = "[[[MEETING_ROOM_RESPONSE_START]]]"
RESPONSE_MARKER_END = "[[[MEETING_ROOM_RESPONSE_END]]]"
DEFAULT_DEBUG_LOG = Path.cwd() / ".claude" / "meeting-room" / "stop-hook.log.jsonl"
PATH_ONLY_PATTERN = re.compile(r"^(?:/Users/|/home/|[A-Za-z]:\\).+\.(?:jsonl|json|md|txt|log)$")


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


def _extract_str_any(payload: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _extract_str(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    return value.strip() if isinstance(value, str) else ""


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
        transcript_path = os.environ.get("CLAUDE_TRANSCRIPT_PATH", "").strip()
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
    compact = value.strip()
    if not compact:
        return False
    if PATH_ONLY_PATTERN.match(compact):
        return False
    if compact.startswith("@") and "❯" in compact and "\n" not in compact:
        return False
    return True


def extract_assistant_response(payload: dict[str, Any]) -> str:
    env_candidates = [
        os.environ.get("CLAUDE_RESPONSE", "").strip(),
        os.environ.get("CLAUDE_LAST_ASSISTANT_MESSAGE", "").strip(),
        os.environ.get("CLAUDE_ASSISTANT_MESSAGE", "").strip(),
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
    path = os.environ.get("MEETING_ROOM_STOP_DEBUG_LOG", "").strip()
    debug_path = Path(path).expanduser() if path else DEFAULT_DEBUG_LOG
    debug_path.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "stopReason": os.environ.get("CLAUDE_STOP_REASON", ""),
        "payloadKeys": sorted(payload.keys()),
        "hasContent": bool(content.strip()),
        "contentPreview": content[:200],
    }
    with debug_path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


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


def build_message(content: str) -> dict[str, Any]:
    sender = os.environ.get("CLAUDE_AGENT_NAME", "").strip() or "leader"
    team = os.environ.get("CLAUDE_TEAM_NAME", "").strip() or "leader"
    meeting_id = os.environ.get("MEETING_ROOM_MEETING_ID", "").strip() or None
    timestamp = datetime.now(timezone.utc).isoformat()
    msg_id = f"stop_{int(datetime.now(tz=timezone.utc).timestamp())}_{sender.replace(' ', '_')}"

    marked_content = f"{RESPONSE_MARKER_START}\n{content.strip()}\n{RESPONSE_MARKER_END}"

    return {
        "type": "agent_message",
        "id": msg_id,
        "sender": sender,
        "content": marked_content,
        "timestamp": timestamp,
        "team": team,
        "meetingId": meeting_id,
        "rawType": "stop",
    }


def main() -> int:
    if not is_meeting_mode_active():
        return 0
    if is_subagent_context():
        return 0

    payload = parse_payload()
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
