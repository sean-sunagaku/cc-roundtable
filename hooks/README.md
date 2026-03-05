# Hook Scripts

## Files
- `enforce-broadcast.py`: PreToolUse hook to block directed `SendMessage`.
- `ws-relay.py`: PostToolUse hook to relay `SendMessage` payloads over WebSocket.
- `subagent-status-relay.py`: PostToolUse hook to relay `SubagentStop` status events.

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
