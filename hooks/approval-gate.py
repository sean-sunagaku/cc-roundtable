#!/usr/bin/env python3
"""PreToolUse hook to gate Agent Team progress until a human approves the next step."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any


BLOCK_MESSAGE = "[Meeting Room] 承認待ちです。ユーザーが確認してから次へ進めてください。"
APPROVAL_DIR_RELATIVE = Path(".claude") / "meeting-room" / "approval"


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
    return any(path.exists() for path in _candidate_active_paths())


def resolve_repo_root() -> Path:
    settings_path = os.environ.get("MEETING_ROOM_SETTINGS_FILE", "").strip()
    if settings_path:
        return Path(settings_path).expanduser().resolve().parent.parent

    hooks_dir = os.environ.get("MEETING_ROOM_HOOKS_DIR", "").strip()
    if hooks_dir:
        return Path(hooks_dir).expanduser().resolve().parent

    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", "").strip()
    if project_dir:
        return Path(project_dir).expanduser().resolve()

    return Path.cwd()


def resolve_approval_file() -> Path | None:
    direct = os.environ.get("MEETING_ROOM_APPROVAL_FILE", "").strip()
    if direct:
        return Path(direct).expanduser()

    meeting_id = os.environ.get("MEETING_ROOM_MEETING_ID", "").strip()
    if not meeting_id:
        return None

    approval_dir = os.environ.get("MEETING_ROOM_APPROVAL_DIR", "").strip()
    if approval_dir:
        return Path(approval_dir).expanduser() / f"{meeting_id}.json"

    return resolve_repo_root() / APPROVAL_DIR_RELATIVE / f"{meeting_id}.json"


def parse_approval_state(path: Path) -> dict[str, Any] | None:
    if not path.exists() or not path.is_file():
        return None
    try:
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
    except Exception:
        return None
    return data if isinstance(data, dict) else None


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

    mode = state.get("mode")
    if mode == "open":
        return 0

    reason = state.get("reason")
    if isinstance(reason, str) and reason.strip():
        print(f"{BLOCK_MESSAGE}\nReason: {reason.strip()}", file=sys.stderr)
        return 2

    print(BLOCK_MESSAGE, file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
