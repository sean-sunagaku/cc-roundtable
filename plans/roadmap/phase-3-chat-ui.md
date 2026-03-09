# Phase 3 Plan: Chat UI

## Goal
Deliver meeting-time chat experience with optimistic human messages and confirmed agent updates.

## Tasks
- [x] Implement `MeetingScreen` layout
- [x] Implement `ChatView` with time-ordered messages
- [x] Implement `MessageBubble` sender styles
- [x] Implement `InputBar` (Enter send / Shift+Enter newline)
- [x] Implement optimistic pending state and confirm update rules
- [x] Implement `ConnectionStatus` indicator

## Verification
- Human input appears instantly as pending.
- Agent relay updates append in order.
- Pending messages become confirmed when echoed back.

## Result
- Completed on 2026-03-05.
- Added tabbed meeting UI, connection badge, and sender-aware bubbles.
