"""Shared runtime helpers for Meeting Room hook scripts."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Mapping, TextIO

from contracts import HookEnvVars as E

MEETING_ROOM_DIR = Path(".claude") / "meeting-room"
DEFAULT_APPROVAL_DIR = MEETING_ROOM_DIR / "approval"


def as_str(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def get_env_str(name: str, *, env: Mapping[str, str] | None = None) -> str:
    values = env if env is not None else os.environ
    return as_str(values.get(name))


def default_meeting_room_path(*parts: str, cwd: Path | None = None) -> Path:
    base_dir = cwd if cwd is not None else Path.cwd()
    return base_dir / MEETING_ROOM_DIR / Path(*parts)


def candidate_active_paths(
    *,
    env: Mapping[str, str] | None = None,
    cwd: Path | None = None,
    home: Path | None = None,
) -> list[Path]:
    values = env if env is not None else os.environ
    paths: list[Path] = []

    env_path = as_str(values.get(E.ACTIVE_FILE))
    if env_path:
        paths.append(Path(env_path).expanduser())

    current_dir = cwd if cwd is not None else Path.cwd()
    home_dir = home if home is not None else Path.home()
    paths.append(current_dir / MEETING_ROOM_DIR / ".active")
    paths.append(home_dir / MEETING_ROOM_DIR / ".active")
    return paths


def is_meeting_mode_active(
    *,
    env: Mapping[str, str] | None = None,
    cwd: Path | None = None,
    home: Path | None = None,
) -> bool:
    return any(path.exists() for path in candidate_active_paths(env=env, cwd=cwd, home=home))


def is_subagent_context(*, env: Mapping[str, str] | None = None) -> bool:
    return bool(get_env_str("CLAUDE_SUBAGENT_NAME", env=env))


def parse_json_stdin(stdin: TextIO | None = None) -> dict[str, Any]:
    stream = stdin if stdin is not None else sys.stdin
    raw = stream.read().strip()
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def extract_mapping(payload: Mapping[str, Any], key: str) -> dict[str, Any]:
    value = payload.get(key)
    return value if isinstance(value, dict) else {}


def resolve_repo_root(*, env: Mapping[str, str] | None = None, cwd: Path | None = None) -> Path:
    settings_path = get_env_str(E.SETTINGS_FILE, env=env)
    if settings_path:
        return Path(settings_path).expanduser().resolve().parent.parent

    hooks_dir = get_env_str(E.HOOKS_DIR, env=env)
    if hooks_dir:
        return Path(hooks_dir).expanduser().resolve().parent

    project_dir = get_env_str("CLAUDE_PROJECT_DIR", env=env)
    if project_dir:
        return Path(project_dir).expanduser().resolve()

    return cwd if cwd is not None else Path.cwd()


def resolve_approval_file(
    *,
    env: Mapping[str, str] | None = None,
    cwd: Path | None = None,
    repo_root: Path | None = None,
) -> Path | None:
    direct = get_env_str(E.APPROVAL_FILE, env=env)
    if direct:
        return Path(direct).expanduser()

    meeting_id = get_env_str(E.MEETING_ID, env=env)
    if not meeting_id:
        return None

    approval_dir = get_env_str(E.APPROVAL_DIR, env=env)
    if approval_dir:
        return Path(approval_dir).expanduser() / f"{meeting_id}.json"

    base_dir = repo_root if repo_root is not None else resolve_repo_root(env=env, cwd=cwd)
    return base_dir / DEFAULT_APPROVAL_DIR / f"{meeting_id}.json"
