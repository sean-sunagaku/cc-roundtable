# Phase 5 Plan: Polish

## Goal

Add quality-of-life features that improve readability, continuity, and interaction safety.

## Tasks

- [x] Markdown render for message body
- [x] Long-message folding and expand/collapse
- [x] Session persistence and replay
- [x] In-meeting settings updates (members/settings prompt helper)
- [x] Optional notification sound on new messages

## Verification

- Markdown code blocks render with sane styles.
- Fold toggle works on long messages.
- Reload restores prior sessions from persisted storage.

## Result

- Completed on 2026-03-05.
- Added Markdown bubbles, fold UI, localStorage snapshots, settings control prompt, and sound cue.
- Added runtime visibility panel (Claude usage limit / MCP errors), MCP retry action, and conversation health indicators.
