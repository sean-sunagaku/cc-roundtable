#!/usr/bin/env python3
"""PreToolUse hook for Meeting Room.

Blocks directed SendMessage calls (`type: "message"`) from the leader only
while meeting mode is active. Subagent-to-subagent directed messages are allowed.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any


BLOCK_MESSAGE = """[Meeting Room] directed メッセージは禁止です。
type: "broadcast" を使って全員に共有してください。
会議室モードでは全メッセージが全員に見えます。"""


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


def extract_send_message_type(payload: dict[str, Any]) -> str | None:
    candidate = payload.get("tool_input")
    if isinstance(candidate, dict):
        msg_type = candidate.get("type")
        if isinstance(msg_type, str):
            return msg_type

    msg_type = payload.get("type")
    if isinstance(msg_type, str):
        return msg_type
    return None


def is_subagent_context() -> bool:
    subagent = os.environ.get("CLAUDE_SUBAGENT_NAME", "").strip()
    return bool(subagent)


def main() -> int:
    if not is_meeting_mode_active():
        return 0

    payload = parse_payload()
    msg_type = extract_send_message_type(payload)

    if msg_type == "message" and not is_subagent_context():
        print(BLOCK_MESSAGE, file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
