# Hook Scripts

## Files
- `enforce-broadcast.py`: PreToolUse hook to block directed `SendMessage`.
- `team-event-relay.py`: PostToolUse hook to relay `TeamCreate`/`Task` events to chat.
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

## Observed SendMessage Payload Shape

`ws-relay.py` now resolves the sender from the actual `SendMessage` hook payload first:

- `tool_response.routing.sender`
- `tool_response.routing.target`
- `tool_input.type`
- `tool_input.content`

This matches the Agent Teams logger hook contract under:

- `~/.claude/plugins/cache/sunagaku-marketplace/agent-teams-log/.../hook.py`

For debugging, `ws-relay.py` also writes normalized resolution results to:

- `.claude/meeting-room/ws-hook.log.jsonl`

`stop-relay.py` wraps response text with markers:
- `[[[MEETING_ROOM_RESPONSE_START]]]`
- `[[[MEETING_ROOM_RESPONSE_END]]]`

Electron extracts only the marker-inside content before displaying it.

## Relay Mode (Electron)

- Chat View relays only hook-originated payloads.
- PTY terminal output から会話を復元する terminal fallback は廃止済み。
- Claude TUI の進捗文 (`Tool loaded`, `Beaming…`, `Read 1 file` など) はチャットに載せない。

## Chat Filtering

- `TeamCreate` / `Task` の system relay は内部イベントとして扱い、通常のチャット欄には表示しない。
- チャット欄には `SendMessage` / `Stop` / `SubagentStop` 由来の会話と状態更新を優先して表示する。

## Runtime Environment

Electron now exports these env vars to Claude sessions:
- `MEETING_ROOM_SETTINGS_FILE` (repo `.claude/settings.json`)
- `MEETING_ROOM_HOOKS_DIR` (repo `hooks/`)
- `MEETING_ROOM_ACTIVE_FILE` (meeting active flag path)
- `MEETING_ROOM_MEETING_ID` (current meeting id)
- `MEETING_ROOM_STOP_DEBUG_LOG` (Stop hook debug JSONL path)

Hook commands in settings resolve scripts using:
- `${MEETING_ROOM_HOOKS_DIR:-$PWD/hooks}`
