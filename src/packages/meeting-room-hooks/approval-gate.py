#!/usr/bin/env python3
"""PreToolUse hook to gate Agent Team progress until a human approves the next step."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


from contracts import (
    ApprovalGateFields as AG,
)
from hook_common import is_meeting_mode_active, resolve_approval_file

BLOCK_MESSAGE = "[Meeting Room] 承認待ちです。ユーザーが確認してから次へ進めてください。"


def parse_approval_state(path: Path) -> dict[str, Any] | None:
    if not path.exists() or not path.is_file():
        return None
    try:
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
    except Exception:
        return None
    return data if isinstance(data, dict) else None


def is_bypass_mode_enabled(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "on", "yes"}
    return False


def main() -> int:
    if not is_meeting_mode_active():
        return 0

    approval_file = resolve_approval_file()
    if approval_file is None:
        print(f"{BLOCK_MESSAGE} (meetingId 不明)", file=sys.stderr)
        return 2

    state = parse_approval_state(approval_file)
    if not state:
        print(f"{BLOCK_MESSAGE} (承認状態を取得できません)", file=sys.stderr)
        return 2

    if is_bypass_mode_enabled(state.get(AG.BYPASS_MODE)):
        return 0

    mode = state.get(AG.MODE)
    if mode == "open":
        return 0

    reason = state.get(AG.REASON)
    if isinstance(reason, str) and reason.strip():
        print(f"{BLOCK_MESSAGE}\nReason: {reason.strip()}", file=sys.stderr)
        return 2

    print(BLOCK_MESSAGE, file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
