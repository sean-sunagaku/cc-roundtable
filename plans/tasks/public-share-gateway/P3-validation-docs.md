# P3: Validate public share flow and sync docs

## Status
- Status: done
- Owner: main
- Last Updated: 2026-03-10 23:35

## Goal
- Verify the new public share flow end to end and document the ngrok-based short-term exposure path.

## Parent / Depends On
- Parent: `plans/tasks/current-tasks.md` Public Share Gateway (2026-03-10)
- Dependencies: P1, P2

## Done When
- Validation covers gateway bootstrap, public UI flow, and regression checks for existing daemon/web flows.
- README and task tracker reflect the new public share gateway and ngrok usage.
- Final review notes capture residual risks and any follow-up work.

## Checklist
- [x] Run targeted validation for gateway/public UI behavior.
- [x] Run required repo verification commands.
- [x] Update README / relevant docs and task tracker with results.
- [x] Record residual risks and close tracker entries.

## Progress Log
- 2026-03-10 21:00: Created task with validation/docs scope.
- 2026-03-10 22:05: Subagent review で public payload leak / recovering bootstrap / fail-fast / SSE close handling を指摘。P1/P2 実装へフィードバックして修正した。
- 2026-03-10 22:20: Browser で public share route を手動確認し、message / pause / resume / retry / end と Meeting Room 類似 UI を確認した。
- 2026-03-10 22:40: README / service overview / AGENTS / CLAUDE / tracker を public share 実装に同期した。
- 2026-03-10 22:55: `public-share:start*` ラッパーを追加し、repo ルート固定の短期デモ起動と ngrok 併用手順を 1 コマンド化した。
- 2026-03-10 23:35: `npm run public-share:start*` 経由の wrapper 実行も確認し、ngrok を非対話ログ化して Ctrl+C 挙動を単純化した。
- 2026-03-10 23:40: `docs/design` と architecture / rearchitecture 文書にも Public Share / `share-client` の実態を反映した。
- 2026-03-10 23:45: `docs/service-overview.md`, `AGENTS.md`, `current-daemon.md` に Browser UI と Public Share の FE / BE 責務差を明記した。

## Blockers
- None

## Verification
- 2026-03-10 21:45: `npm --prefix src/apps/desktop run smoke:public-share` ✅
- 2026-03-10 22:18: `node e2e/public-share/api-smoke.mjs` ✅
- 2026-03-10 22:28: `npm --prefix src/apps/desktop run smoke:public-share` ✅ (sanitization + restart recovery を追加後)
- 2026-03-10 22:20: Chrome CDP manual verification ✅ public share route で send / pause / resume / retry / end を確認
- 2026-03-10 22:14: `npm --prefix src/apps/desktop run e2e:web` ✅
- 2026-03-10 22:19: `npm --prefix src/apps/desktop run verify:final` ✅
- 2026-03-10 22:24: `MEETING_ROOM_PUBLIC_SHARE_ID` 有効時に `MEETING_ROOM_DAEMON_TOKEN` 未設定だと起動失敗することを確認 ✅
- 2026-03-10 22:25: `MEETING_ROOM_PUBLIC_DEMO_BYPASS_MODE=maybe` で起動失敗することを確認 ✅
- 2026-03-10 22:27: `node scripts/start-public-share-demo.mjs --share-id verify-share --daemon-port 4687 --gateway-port 4688 --ws-port 10687` ✅ local wrapper で gateway 起動と bootstrap を確認
- 2026-03-10 22:29: `node scripts/start-public-share-demo.mjs --ngrok --share-id ngrok-check --daemon-port 4697 --gateway-port 4698 --ws-port 10697` ✅ ngrok public URL の払い出しまで確認
- 2026-03-10 23:31: `npm --prefix src/apps/desktop run public-share:start -- --share-id npm-verify --daemon-port 4707 --gateway-port 4708 --ws-port 10707` ✅ npm script 経由でも gateway 起動と bootstrap を確認
- 2026-03-10 23:33: `npm --prefix src/apps/desktop run public-share:start:ngrok -- --share-id npm-ngrok --daemon-port 4717 --gateway-port 4718 --ws-port 10717` ✅ npm script 経由でも ngrok public URL の払い出しを確認
- 2026-03-10 23:34: `npm --prefix src/apps/desktop run verify:final` ✅ package script 追加後の最終再確認

## Decision Log
- 2026-03-10 21:00: Keep v1 focused on ngrok free operational guidance instead of provider abstraction.

## Next Action
- None.
