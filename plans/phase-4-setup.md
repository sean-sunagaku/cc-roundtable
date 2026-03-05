# Phase 4 Plan: Setup and Lifecycle

## Goal
Provide meeting setup screen and full lifecycle controls (start/pause/resume/end).

## Tasks
- [x] Build `SetupScreen` form (skill, topic, project path)
- [x] Auto-detect skills from `.claude/skills` and plugin caches
- [x] Build initial prompt from selected config
- [x] Create `.active` flag at start / remove at end
- [x] Add lifecycle controls that send specialized prompts

## Verification
- Starting meeting transitions to meeting screen.
- Initial prompt is written to pty.
- Ending meeting cleans process and flag file.

## Result
- Completed on 2026-03-05.
- Setup flow and meeting lifecycle implemented through IPC + `MeetingService`.
