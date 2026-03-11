# Hook Scripts

## Files

- `enforce-broadcast.py`: PreToolUse hook to block directed `SendMessage`.
- `approval-gate.py`: PreToolUse hook to block `SendMessage` / `Task` / `TeamCreate` while human approval is pending.
- `team-event-relay.py`: PostToolUse hook to relay `TeamCreate`/`Task` events to chat.
- `ws-relay.py`: PostToolUse hook to relay `SendMessage` payloads over WebSocket.
- `subagent-status-relay.py`: PostToolUse hook to relay `SubagentStop` status events.
- `stop-relay.py`: Stop hook to relay the latest assistant response over WebSocket.
- `hook_common.py`: meeting mode 判定、env/path 解決、stdin JSON 解析などの共通基盤。
- `hook_transport.py`: WebSocket relay と JSONL fallback log の共通 transport。
- `hook_text.py`: relay 用テキストフィルタの共通ロジック。

## Local Tests

```bash
python3 -m unittest discover -s src/packages/meeting-room-hooks/tests
```

## Quick Local Checks

```bash
touch .claude/meeting-room/.active
python3 src/packages/meeting-room-hooks/enforce-broadcast.py <<'EOF'
{"toolInput":{"type":"message","content":"hello"}}
EOF
```

```bash
python3 src/packages/meeting-room-hooks/ws-relay.py <<'EOF'
{"toolName":"SendMessage","toolInput":{"type":"broadcast","content":"hello team"},"toolResponse":{"success":true,"routing":{"sender":"product-manager","content":"hello team","target":"team"}},"agentId":"product-manager@team","metadata":{"meetingId":"meeting_test","team":"feature-discussion"}}
EOF
```

If Electron WebSocket is not running, `ws-relay.py` appends to `.claude/meeting-room/discussion.log.jsonl`.

## Observed SendMessage Payload Shape

`ws-relay.py` now resolves the sender from the actual `SendMessage` hook payload first:

- `toolResponse.routing.sender`
- `toolResponse.routing.target`
- `toolInput.type`
- `toolInput.content`

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
- `MEETING_ROOM_HOOKS_DIR` (repo `src/packages/meeting-room-hooks/`)
- `MEETING_ROOM_ACTIVE_FILE` (meeting active flag path)
- `MEETING_ROOM_APPROVAL_DIR` / `MEETING_ROOM_APPROVAL_FILE` (approval gate state path)
- `MEETING_ROOM_MEETING_ID` (current meeting id)
- `MEETING_ROOM_STOP_DEBUG_LOG` (Stop hook debug JSONL path)

Hook commands in settings first go through `src/packages/meeting-room-hooks/run-hook.sh`:

- `MEETING_ROOM_HOOKS_DIR` があればそれを使う
- なければ `CLAUDE_PROJECT_DIR` または `git rev-parse --show-toplevel` から repo root を解決する
- `MEETING_ROOM_MEETING_ID` または `MEETING_ROOM_ACTIVE_FILE` が渡された Meeting Room セッションだけ hook を起動する
- 通常の Claude セッションでは hook を起動せず、そのまま `exit 0` する
