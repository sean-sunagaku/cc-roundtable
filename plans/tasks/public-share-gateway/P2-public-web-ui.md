# P2: Build public share web UI

## Status

- Status: done
- Owner: main
- Last Updated: 2026-03-10 22:35

## Goal

- Build a thin public share UI that connects only to the public gateway and exposes chat plus the approved control actions.

## Parent / Depends On

- Parent: `plans/tasks/current-tasks.md` Public Share Gateway (2026-03-10)
- Dependencies: P1

## Done When

- Public share route renders a dedicated UI distinct from the full web client.
- UI can bootstrap the fixed meeting, receive filtered SSE events, send messages, and invoke pause/resume/retry/end.
- Setup/project picker/terminal/debug/agent management are absent from the public view.

## Checklist

- [x] Add public share client and UI components for bootstrap, SSE, message send, and control actions.
- [x] Add public share HTML entry and styling without affecting the existing `/web/index.html`.
- [x] Handle loading/reconnecting/error states for the fixed meeting flow.

## Progress Log

- 2026-03-10 21:00: Created task with dependency on P1.
- 2026-03-10 21:20: P1 API shape is available enough to start. Assigned to worker for isolated UI/build work.
- 2026-03-10 21:50: Added dedicated public share client, thin React UI, and share-specific bundle/html output under `src/apps/web/share-client`.
- 2026-03-10 21:55: Tuned the UI for fixed-demo operation: public share defaults to bypass mode unless explicitly disabled, and the share page can restart the fixed meeting after `endMeeting`.
- 2026-03-10 22:10: UI を既存 Meeting Room に寄せ、`ChatView` / `InputBar` / `ConnectionStatus` を再利用する形へ調整した。
- 2026-03-10 22:25: public share 専用 contract に切り替え、公開 payload から `projectDir` / `health` / `sessionDebug` を除外した。
- 2026-03-10 22:30: daemon 再起動後の `recovering` セッションや env mismatch を bootstrap 時に安全に再生成するよう gateway を補強した。

## Blockers

- None

## Verification

- 2026-03-10 21:52: `npm --prefix src/apps/desktop run typecheck` ✅
- 2026-03-10 21:56: `npm --prefix src/apps/desktop run smoke:public-share` ✅ (share HTML path + bootstrap/message/end/rebootstrap/public-port isolation)
- 2026-03-10 22:20: Chrome CDP で public share page を実確認 ✅ Meeting Room に近い header/chat/input layout で、message / pause / resume / retry / end が動作
- 2026-03-10 22:28: `npm --prefix src/apps/desktop run smoke:public-share` ✅ (public payload sanitization + daemon restart recovery)

## Decision Log

- 2026-03-10 21:00: Use a dedicated thin UI instead of reusing the full setup/meeting shell.
- 2026-03-10 21:55: Default public share demos to bypass mode for smoother fixed-meeting operation; allow explicit opt-out via env if approval gating is desired.

## Next Action

- Support P3 docs / validation sync only.
