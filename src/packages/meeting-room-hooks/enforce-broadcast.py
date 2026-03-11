#!/usr/bin/env python3
"""PreToolUse hook for Meeting Room.

Blocks directed SendMessage calls (`type: "message"`) from the leader only
while meeting mode is active. Subagent-to-subagent directed messages are allowed.
"""

from __future__ import annotations

import json
import sys
from typing import Any


from contracts import HookEnvVars as E
from hook_common import is_meeting_mode_active, is_subagent_context, parse_json_stdin

BLOCK_MESSAGE = """[Meeting Room] directed メッセージは禁止です。
type: "broadcast" を使って全員に共有してください。
会議室モードでは全メッセージが全員に見えます。"""


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


def main() -> int:
    if not is_meeting_mode_active():
        return 0

    payload = parse_json_stdin()
    msg_type = extract_send_message_type(payload)

    if msg_type == "message" and not is_subagent_context():
        print(BLOCK_MESSAGE, file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
