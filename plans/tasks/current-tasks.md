# Meeting Room Implementation TODO

## Status Legend

- `todo`: not started
- `doing`: in progress
- `blocked`: waiting on dependency
- `done`: completed and verified

## Master Tasks

| ID  | Task                                | Status | Notes                                                  |
| --- | ----------------------------------- | ------ | ------------------------------------------------------ |
| T1  | Bootstrap planning documents        | done   | `plans/roadmap` / `plans/tasks` + child plans          |
| T2  | Implement Phase 1 hooks             | done   | Pre/Post hook + `.active` + fallback log + smoke tests |
| T3  | Implement Phase 2 Electron core     | done   | main process + pty + ws + tab model                    |
| T4  | Implement Phase 3 chat UI           | done   | chat view, optimistic messages, confirm flow           |
| T5  | Implement Phase 4 setup flow        | done   | setup screen, skill scan, lifecycle                    |
| T6  | Implement Phase 5 polish            | done   | markdown, fold, history, in-meeting controls, sound    |
| T7  | Verification and documentation sync | done   | typecheck/build/manual checks + docs update            |

## Request Tasks (2026-03-05)

| ID  | Task                                                 | Status | Notes                                                                              |
| --- | ---------------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| R1  | 会議開始時に Agent Team 編成の初期指示を自動送信する | done   | `meeting.ts` で初期プロンプト生成 + 起動後キュー送信に変更                         |
| R2  | 人間入力を broadcast 前提で Leader に渡す            | done   | `sendHumanMessage` で broadcast 指示テンプレート化                                 |
| R3  | チャット欄でメッセージ本文を省略せず全文表示する     | done   | `MessageBubble` の折りたたみ表示を廃止                                             |
| R4  | SubAgent の Team 編成を画面に表示する                | done   | 会議開始時に Team 編成を system メッセージとして表示、メンバーステータスを初期表示 |
| R5  | 動作確認（build）                                    | done   | `npm --prefix src/apps/desktop run build` 成功                                     |

## Agent Browser Try & Error (2026-03-05)

| Step | Check                            | Status | Result / Next                                           |
| ---- | -------------------------------- | ------ | ------------------------------------------------------- |
| AB1  | ElectronへCDP接続できるか        | done   | `agent-browser connect 9222` 成功、Meeting Roomタブ検出 |
| AB2  | Setup→会議開始遷移               | done   | Agent Browserで `会議を開始` 実行、Meeting画面に遷移    |
| AB3  | Team編成の画面表示               | done   | チャット欄に `Team 編成` systemメッセージ表示を確認     |
| AB4  | 会議開始後のAgent Team会話表示   | doing  | 未表示。初期送信/relay条件を継続切り分け中              |
| AB5  | 人間入力→broadcast経由で応答表示 | todo   | AB4完了後に確認                                         |

### Loop Rule

- AB4, AB5 が `done` になるまで、ログ確認→修正→再検証を繰り返す。

## Nested Plan Index

- `plans/roadmap/current-plan.md` (top-level execution order)
- `plans/roadmap/phase-1-hooks.md`
- `plans/roadmap/phase-2-electron-core.md`
- `plans/roadmap/phase-3-chat-ui.md`
- `plans/roadmap/phase-4-setup.md`
- `plans/roadmap/phase-5-polish.md`
- `plans/roadmap/web-interface-parity.md`

## Execution Log

- 2026-03-05: Initialized implementation workspace and planning structure.
- 2026-03-05: Phase 1 hooks implemented and smoke-tested.
- 2026-03-05: Electron app implemented (Phase 2-5), typecheck/build passed.
- 2026-03-05: R1-R5 を実装・確認し、会議開始時の自動送信と Team 編成表示を追加。

## Web Interface Parity (2026-03-07)

### Parent Task

| ID  | Task                                                             | Status | Notes                                                                                                       |
| --- | ---------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| W0  | Web 版を Electron と同等の会議フローで完了させる                 | done   | 実装、Web E2E、Electron GUI E2E、DOM/CDP での Web UI 動作確認まで完了                                       |
| W1  | ToDo 運用を追加し、親子タスクとレビュー手順を固定する            | done   | `plans/tasks/current-tasks.md` と `plans/roadmap/web-interface-parity.md` を同期し、review 記録先も定義済み |
| W2  | daemon 側に Web parity 用の補助 API と共通ロジックを実装する     | done   | Agent profile/default project dir/init prompt/summary を daemon/shared support へ移し、Web から使える       |
| W3  | Web クライアントを Electron 相当の Setup/Meeting UI に置き換える | done   | Setup/Meeting/approval/debug/recovering まで Web shell で動作する                                           |
| W4  | Web build/serve 導線を正式化する                                 | done   | build / daemon:start / daemon:start:dev / e2e:web で Web 資産と daemon を同期できる                         |
| W5  | Web E2E と既存最終検証を通す                                     | done   | `e2e:web` と `verify:final` が成功し、Web UI は DOM/CDP 操作でもフロー確認済み                              |
| W6  | ドキュメントを同期する                                           | done   | README / service-overview / AGENTS / CLAUDE / TODO を実装実態へ更新                                         |

### Fine-Grained Execution Queue

| ID   | Parent | Task                                                                     | Status | Done When                                                                                              |
| ---- | ------ | ------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------ |
| W2.1 | W2     | Agent profile / init prompt / summary / default project dir を共通化する | done   | daemon から共通ロジックを使え、Electron でも同じ定義を参照できる                                       |
| W2.2 | W2     | daemon REST surface と start/end の責務を Web 対応に広げる               | done   | agent 一覧/保存、default project dir、prompt 省略 start、summary 保存 end が Web から使える            |
| W2.R | W2     | reviewer チェック                                                        | done   | backend review で見つかった `endMeeting` の summary persist 問題を修正済み                             |
| W3.1 | W3     | Web app の state/client 層を作る                                         | done   | SSE/REST で tabs/messages/runtime/terminal を購読・取得できる                                          |
| W3.2 | W3     | Setup 画面を Electron 同等にする                                         | done   | topic/project/agent select/add/save/start が Web で動く                                                |
| W3.3 | W3     | Meeting 画面と debug/terminal/recovery を Electron 同等にする            | done   | tabs/chat/send/pause/resume/end/approval/runtime/debug/recovering が Web で動く                        |
| W3.R | W3     | reviewer チェック                                                        | done   | Web UI が Electron 相当の会議フローを満たす                                                            |
| W4.1 | W4     | Web build/watch/serve を daemon 導線へ統合する                           | done   | build / daemon:start / daemon:start:dev で Web 資産が古くならない                                      |
| W4.2 | W4     | Web E2E を追加する                                                       | done   | 新規会議から recovering/end まで自動確認できる                                                         |
| W4.R | W4     | reviewer チェック                                                        | done   | build/serve/e2e/docs を別サブエージェント視点で確認し、blocking な抜けはなし                           |
| W5.1 | W5     | 型チェック / build / Electron GUI E2E / Web E2E を通す                   | done   | `npm --prefix src/apps/desktop run e2e:web` と `npm --prefix src/apps/desktop run verify:final` が成功 |
| W5.2 | W5     | DOM / CDP で Web UI を手動確認する                                       | done   | ユーザー了承のもと、実 DOM 操作で Setup/start/send/pause/resume/end を確認済み                         |
| W6.1 | W6     | README / docs/service-overview / AGENTS / TODO を同期する                | done   | docs の手順と実装が一致する                                                                            |
| W6.R | W6     | reviewer チェック                                                        | done   | docs/sync 方針は別サブエージェント観点でも blocking issue なし                                         |

### Review Rule

- Fine-Grained ToDo を `done` にする前に、実装担当とは別サブエージェントで対象差分をレビューする。
- レビューで指摘が出た場合、その Fine-Grained ToDo は `doing` に戻して修正する。
- レビュー結果は `Execution Log` に `reviewed by subagent / result` を記録する。
- 実装中に不足が見つかった場合は、新しい Fine-Grained ToDo をこの表へ追記してから進める。

### Review Log

- 2026-03-07: Web parity 実装開始。W1 から着手。
- 2026-03-07: W1.1/W1.2 reviewed by subagent (Lovelace) - DoD の具体化と review 記録先を追加。
- 2026-03-07: W3 reviewed by subagent (Helmholtz) - `MeetingRoomShell + MeetingRoomClient` 境界は妥当、`SessionDebugWindow` の結合も blocking ではない。
- 2026-03-07: W2 reviewed by subagent (Mencius) - `endMeeting` の summary persist タイミング/失敗時 handling を指摘。修正後、daemon parity は blocking issue なし。
- 2026-03-07: W4/W6 reviewed by subagent (Cicero) - build/serve/e2e/docs 整合性に blocking issue なし。
- 2026-03-07: W5.1 completed - `npm --prefix src/apps/desktop run e2e:web` 成功、`npm --prefix src/apps/desktop run verify:final` 成功。
- 2026-03-07: W5.2 completed - ユーザー了承のもと、Chrome CDP 経由の DOM 操作で Web UI の start/send/pause/resume/end を確認。

## Public Share Gateway (2026-03-10)

### Status Summary

- Goal: `ngrok free` 向けの短期公開用 thin gateway を追加し、固定デモ会議だけを安全に公開する。
- Overall status: done
- Current focus: validation / docs / final verification completed

### Execution Order

1. P1 tracker / daemon gateway
2. P2 public share UI
3. P3 validation / docs / final review

### Tracker

| ID  | Title                                      | Status | Owner | Depends On | File                                                     | Notes                                                          |
| --- | ------------------------------------------ | ------ | ----- | ---------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| P1  | Implement daemon-side public share gateway | done   | main  | -          | `plans/tasks/public-share-gateway/P1-daemon-gateway.md`  | fixed share config / bootstrap / relay / startup wiring        |
| P2  | Build public share web UI                  | done   | main  | P1         | `plans/tasks/public-share-gateway/P2-public-web-ui.md`   | original Meeting Room に寄せた thin UI と public client を実装 |
| P3  | Validate public share flow and sync docs   | done   | main  | P1, P2     | `plans/tasks/public-share-gateway/P3-validation-docs.md` | smoke/browser/manual/required E2E/docs sync 完了               |

### Active Blockers

- None

### Ready Queue

- None

### Done Log

- 2026-03-10: Public share gateway tracker initialized from approved plan. P1 started.
- 2026-03-10: P1 completed. Gateway bootstrap, filtered relay, and separate public port verified with fake runtime smoke.
- 2026-03-10: Dedicated public share API smoke script added and passing.
- 2026-03-10: P2 completed. Public share UI を Meeting Room の visual language に寄せつつ、固定会議専用の操作だけに絞った。
- 2026-03-10: P3 completed. public payload のサニタイズ、recovering 再起動、gateway fail-fast、SSE close/listener isolation を追加し、`smoke:public-share` / `e2e:web` / `verify:final` を通過。
- 2026-03-10: `public-share:start*` を追加し、fixed demo + ngrok の起動を 1 コマンドで扱えるようにした。

## Maintenance Tasks (2026-03-11)

| ID  | Task                                   | Status | Notes                                           |
| --- | -------------------------------------- | ------ | ----------------------------------------------- |
| M1  | Issue #9: lint / format 基盤を追加する | done   | ESLint + Prettier + Makefile + CI + docs を同期 |
