# Phase 3 Plan: Session State and Important Event Log

作成日: 2026-03-06

## 目的

meeting state の source of truth を daemon に寄せ、重要イベントだけ append-only に記録して、再現性と recovery の基盤を作る。

## スコープ

- session state モデル
- projection
- important event log
- summary / snapshot persistence

## 実装項目

- [ ] `MeetingSession` と `MeetingState` を daemon 側へ定義する
- [ ] current state を projection として組み立てる
- [ ] important event log を append-only で保存する
- [ ] summary / snapshot 更新を projection ベースにする
- [ ] health 状態を独立 projection として持つ

## event log に残す対象

- `MeetingStarted`
- `InitPromptQueued`
- `ClaudeReadyDetected`
- `InitPromptSent`
- `HumanMessageSubmitted`
- `AgentMessageReceived`
- `McpFailureDetected`
- `MeetingEnded`

## event log に残さない対象

- 生 terminal chunk
- 一時 UI 状態
- 細かすぎる内部デバッグログ

## projection の例

- `MeetingViewProjection`
- `HealthProjection`
- `SummaryProjection`

## 受け入れ条件

- [ ] daemon が meeting state の source of truth になる
- [ ] 重要イベントが append-only に記録される
- [ ] projection を再構築できる
- [ ] 再接続時に projection を返せる

## この段階でやらないこと

- 全面 event sourcing
- すべてのデバッグ情報の永続化
- CQRS の過剰分割

## 主なリスク

- event を増やしすぎて重くなる
- projection と current state の責務が曖昧になる

## リスク軽減

- 重要フロー限定で event log を導入する
- UI 用の projection を明示して分ける
