# Phase 1 Plan: Hook Layer

## Goal

Implement robust PreToolUse/PostToolUse hooks with meeting mode activation guard.

## Tasks

- [x] Create `src/packages/meeting-room-hooks/enforce-broadcast.py`
- [x] Create `src/packages/meeting-room-hooks/ws-relay.py`
- [x] Implement `.claude/meeting-room/.active` gate for both hooks
- [x] Add fallback logging for relay failures
- [x] Add quick local test commands in docs

## Implementation Notes

- Pre hook blocks only `type: "message"` when meeting mode is active.
- Post hook should never break agent execution on network failures.

## Verification

- Directed message payload returns non-zero and expected Japanese warning.
- Broadcast/shutdown payload exits 0.
- WebSocket relay sends JSON to `ws://127.0.0.1:9999`.
- When WS unavailable, fallback log file receives serialized event.

## Result

- Completed on 2026-03-05.
- Added hook registration file: `.claude/settings.json`.
- Smoke-tested both hooks with sample payloads.
