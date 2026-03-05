# Hook Scripts

## Files
- `enforce-broadcast.py`: PreToolUse hook to block directed `SendMessage`.
- `ws-relay.py`: PostToolUse hook to relay `SendMessage` payloads over WebSocket.
- `subagent-status-relay.py`: PostToolUse hook to relay `SubagentStop` status events.
- `stop-relay.py`: Stop hook to relay the latest assistant response over WebSocket.

## Quick Local Checks

```bash
touch .claude/meeting-room/.active
python3 hooks/enforce-broadcast.py <<'EOF'
{"tool_input":{"type":"message","content":"hello"}}
EOF
```

```bash
python3 hooks/ws-relay.py <<'EOF'
{"tool_input":{"type":"broadcast","content":"hello team"},"metadata":{"agent":"product-manager","team":"feature-discussion"}}
EOF
```

If Electron WebSocket is not running, `ws-relay.py` appends to `.claude/meeting-room/discussion.log.jsonl`.

`stop-relay.py` wraps response text with markers:
- `[[[MEETING_ROOM_RESPONSE_START]]]`
- `[[[MEETING_ROOM_RESPONSE_END]]]`

Electron extracts only the marker-inside content before displaying it.

## Relay Mode (Electron)

- Default: `MEETING_ROOM_RELAY_MODE=hook_only`
  - Chat View relays only hook-originated payloads (recommended; avoids terminal TUI noise).
- Optional fallback:
  - `MEETING_ROOM_RELAY_MODE=mixed` enables both hook relay and terminal fallback parsing.
  - `MEETING_ROOM_RELAY_MODE=terminal_only` uses only terminal fallback parsing.

## Runtime Environment

Electron now exports these env vars to Claude sessions:
- `MEETING_ROOM_SETTINGS_FILE` (repo `.claude/settings.json`)
- `MEETING_ROOM_HOOKS_DIR` (repo `hooks/`)
- `MEETING_ROOM_ACTIVE_FILE` (meeting active flag path)
- `MEETING_ROOM_MEETING_ID` (current meeting id)
- `MEETING_ROOM_STOP_DEBUG_LOG` (Stop hook debug JSONL path)

Hook commands in settings resolve scripts using:
- `${MEETING_ROOM_HOOKS_DIR:-$PWD/hooks}`
