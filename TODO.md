# Meeting Room Implementation TODO

## Status Legend
- `todo`: not started
- `doing`: in progress
- `blocked`: waiting on dependency
- `done`: completed and verified

## Master Tasks

| ID | Task | Status | Notes |
|---|---|---|---|
| T1 | Bootstrap planning documents | done | Parent TODO/PLAN + child plans |
| T2 | Implement Phase 1 hooks | done | Pre/Post hook + `.active` + fallback log + smoke tests |
| T3 | Implement Phase 2 Electron core | done | main process + pty + ws + tab model |
| T4 | Implement Phase 3 chat UI | done | chat view, optimistic messages, confirm flow |
| T5 | Implement Phase 4 setup flow | done | setup screen, skill scan, lifecycle |
| T6 | Implement Phase 5 polish | done | markdown, fold, history, in-meeting controls, sound |
| T7 | Verification and documentation sync | done | typecheck/build/manual checks + docs update |

## Request Tasks (2026-03-05)

| ID | Task | Status | Notes |
|---|---|---|---|
| R1 | 会議開始時に Agent Team 編成の初期指示を自動送信する | done | `meeting.ts` で初期プロンプト生成 + 起動後キュー送信に変更 |
| R2 | 人間入力を broadcast 前提で Leader に渡す | done | `sendHumanMessage` で broadcast 指示テンプレート化 |
| R3 | チャット欄でメッセージ本文を省略せず全文表示する | done | `MessageBubble` の折りたたみ表示を廃止 |
| R4 | SubAgent の Team 編成を画面に表示する | done | 会議開始時に Team 編成を system メッセージとして表示、メンバーステータスを初期表示 |
| R5 | 動作確認（build） | done | `cd electron && npm run build` 成功 |

## Agent Browser Try & Error (2026-03-05)

| Step | Check | Status | Result / Next |
|---|---|---|---|
| AB1 | ElectronへCDP接続できるか | done | `agent-browser connect 9222` 成功、Meeting Roomタブ検出 |
| AB2 | Setup→会議開始遷移 | done | Agent Browserで `会議を開始` 実行、Meeting画面に遷移 |
| AB3 | Team編成の画面表示 | done | チャット欄に `Team 編成` systemメッセージ表示を確認 |
| AB4 | 会議開始後のAgent Team会話表示 | doing | 未表示。初期送信/relay条件を継続切り分け中 |
| AB5 | 人間入力→broadcast経由で応答表示 | todo | AB4完了後に確認 |

### Loop Rule
- AB4, AB5 が `done` になるまで、ログ確認→修正→再検証を繰り返す。

## Nested Plan Index
- `PLAN.md` (top-level execution order)
- `plans/phase-1-hooks.md`
- `plans/phase-2-electron-core.md`
- `plans/phase-3-chat-ui.md`
- `plans/phase-4-setup.md`
- `plans/phase-5-polish.md`

## Execution Log
- 2026-03-05: Initialized implementation workspace and planning structure.
- 2026-03-05: Phase 1 hooks implemented and smoke-tested.
- 2026-03-05: Electron app implemented (Phase 2-5), typecheck/build passed.
- 2026-03-05: R1-R5 を実装・確認し、会議開始時の自動送信と Team 編成表示を追加。
