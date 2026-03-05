# Meeting Room Runtime Files

- `.active`: created while a meeting is active to enable hook behavior.
- `discussion.log.jsonl`: fallback log file used by `hooks/ws-relay.py` when Electron WS is unavailable.
- `agents/*.json`: file-based agent catalog used by Setup screen.

## Agent File Schema

```json
{
  "id": "researcher",
  "name": "Researcher",
  "description": "ユーザー調査と仮説検証を担当する",
  "enabledByDefault": false
}
```

This directory is intentionally lightweight and managed by the app at runtime.
