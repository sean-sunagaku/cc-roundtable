#!/usr/bin/env bash

set -euo pipefail

hook_name="${1:-}"
if [[ -z "$hook_name" ]]; then
  exit 0
fi

resolve_repo_root() {
  if [[ -n "${MEETING_ROOM_SETTINGS_FILE:-}" ]]; then
    local settings_dir=""
    settings_dir="$(cd "$(dirname "$MEETING_ROOM_SETTINGS_FILE")" && pwd)"
    cd "$settings_dir/.." && pwd
    return
  fi

  if [[ -n "${CLAUDE_PROJECT_DIR:-}" ]]; then
    printf '%s\n' "$CLAUDE_PROJECT_DIR"
    return
  fi

  local git_root=""
  git_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  if [[ -n "$git_root" ]]; then
    printf '%s\n' "$git_root"
    return
  fi

  pwd
}

repo_root="$(resolve_repo_root)"
hooks_dir="${MEETING_ROOM_HOOKS_DIR:-$repo_root/hooks}"

meeting_active=0
if [[ -n "${MEETING_ROOM_MEETING_ID:-}" ]]; then
  meeting_active=1
elif [[ -n "${MEETING_ROOM_ACTIVE_FILE:-}" && -f "${MEETING_ROOM_ACTIVE_FILE}" ]]; then
  meeting_active=1
fi

if [[ "$meeting_active" -ne 1 ]]; then
  exit 0
fi

script_path="$hooks_dir/$hook_name"
if [[ ! -f "$script_path" ]]; then
  echo "Meeting Room hook script not found: $script_path" >&2
  exit 1
fi

exec python3 "$script_path"
