# P1: Implement daemon-side public share gateway

## Status
- Status: done
- Owner: main
- Last Updated: 2026-03-10 21:30

## Goal
- Add a localhost-only public share gateway that auto-starts a fixed demo meeting and relays only the safe public operations to the internal daemon.

## Parent / Depends On
- Parent: `plans/tasks/current-tasks.md` Public Share Gateway (2026-03-10)
- Dependencies: None

## Done When
- Public gateway server starts on its own localhost port.
- Gateway reads fixed share/demo config from env and auto-starts the fixed meeting on bootstrap.
- Only message/pause/resume/retry/end and filtered session/events access are exposed publicly.
- Existing daemon API/web surface remains private to the daemon port.

## Checklist
- [x] Define public share config and gateway-local API contract.
- [x] Add gateway server with bootstrap, filtered SSE relay, message, and control endpoints.
- [x] Wire daemon startup / scripts to launch the gateway alongside the daemon.
- [x] Add daemon-side tests or smoke coverage for share bootstrap and command forwarding.

## Progress Log
- 2026-03-10 21:00: Created task and set status to doing.
- 2026-03-10 21:20: Added public share config parsing, separate public gateway server startup, filtered SSE relay hooks, and localhost-only gateway wiring. `npm --prefix src/apps/desktop run typecheck` passed after the daemon-side changes.
- 2026-03-10 21:30: Verified bootstrap auto-start, message/control relay, and public-port isolation with fake runtime smoke against `scripts/start-daemon.mjs`.
- 2026-03-10 21:35: Tightened auto-start semantics so only `bootstrap` recreates the fixed meeting. Post-end message calls now return `409`, while a fresh bootstrap restarts the fixed meeting cleanly.
- 2026-03-10 21:45: Added `scripts/public-share-smoke.mjs` and a desktop package script so the gateway bootstrap/end/restart path can be regression-checked automatically.
- 2026-03-10 21:35: Manual smoke with fake runtime passed for `GET /health`, `GET /share-api/:shareId/bootstrap`, `POST /message`, and `POST /control` (`pause`) against the public gateway on a dedicated port.
- 2026-03-10 21:40: Added `e2e/public-share/api-smoke.mjs` so bootstrap/message/pause/resume/retry/end can be replayed as a dedicated API smoke.

## Blockers
- None

## Verification
- 2026-03-10 21:20: `npm --prefix src/apps/desktop run typecheck` ✅
- 2026-03-10 21:30: Manual smoke with fake runtime ✅ `bootstrap` returned fixed meeting, `message` and `retryMcp` accepted, `/api/sessions` on the public port returned `404`.
- 2026-03-10 21:35: Post-end behavior smoke ✅ `endMeeting` closed the public session, subsequent `message` returned `409`, and a new `bootstrap` recreated the fixed meeting with `running` status.
- 2026-03-10 21:45: `npm --prefix src/apps/desktop run smoke:public-share` ✅
- 2026-03-10 21:35: Public gateway smoke via `node scripts/start-daemon.mjs` with `MEETING_ROOM_PUBLIC_*` env + curl on ports `4567/4568` ✅
- 2026-03-10 21:40: `node e2e/public-share/api-smoke.mjs` ✅

## Decision Log
- 2026-03-10 21:00: Keep existing daemon contract intact and expose a separate public gateway API.
- 2026-03-10 21:00: Use a single fixed `shareId` and stable `meetingId` derived from config.

## Next Action
- Support P2/P3 integration questions if the thin public UI needs small gateway adjustments.
