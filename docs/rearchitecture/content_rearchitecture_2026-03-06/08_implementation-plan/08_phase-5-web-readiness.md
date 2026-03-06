# Phase 5 Plan: Web Readiness and Tunnel Access

作成日: 2026-03-06

## 目的

将来 iPhone から Web 経由で同じ session host に接続できるよう、command / event 契約、認証、再接続ポリシーを固める。

## スコープ

- Web UI 用の command / event 契約固定
- auth / access rule
- tunnel 越し接続前提の session policy
- observability / operational policy

## 実装項目

- [ ] Electron 専用ではない command / event 契約へ整理する
- [ ] session access 権限のルールを決める
- [ ] WebSocket / SSE の再接続ポリシーを決める
- [ ] projection 再取得 API を整える
- [ ] tunnel 越し利用を想定した認証境界を決める
- [ ] health / metrics / logging の運用面を整える

## 重要な設計ルール

- session host は常に Mac 上の daemon
- UI は disposable client として扱う
- reconnect で projection を読み直せるようにする
- Claude の生仕様は Web に出さない

## 最低限固めたい契約

### Command

- `startMeeting`
- `sendHumanMessage`
- `pauseMeeting`
- `resumeMeeting`
- `endMeeting`
- `retryMcp`

### Event

- `meeting.started`
- `message.received`
- `agent.status_changed`
- `runtime.warning`
- `runtime.error`
- `meeting.ended`

## 受け入れ条件

- [ ] Electron と将来 Web が同じ契約を見られる
- [ ] reconnect 時の整合性ルールが決まっている
- [ ] session access の基本ルールが定義されている
- [ ] tunnel 越し利用で必要な auth 前提が明文化されている

## 動作確認

- [ ] ブラウザ client を実際に起動し、daemon の command API と event stream に接続できることを確認する
- [ ] browser から `startMeeting`、`sendHumanMessage`、`endMeeting` 相当の基本操作が問題なく流れることを確認する
- [ ] browser で `message.received` や `agent.status_changed` を受けて表示更新できることを確認する
- [ ] ブラウザを reload または再接続して projection 再取得から session を復元できることを確認する
- [ ] mobile viewport でも基本フローが破綻しないことを確認する
- [ ] tunnel 経由の接続を想定した auth 境界で、不正アクセスを防げる前提が成立することを確認する

## この段階でやらないこと

- Web UI の本実装
- remote worker 化
- distributed queue

## 主なリスク

- Electron 都合の API がそのまま残る
- tunnel 前提の auth を後回しにして境界が緩くなる

## リスク軽減

- 契約は client-agnostic に保つ
- session host / client の責務を早めに固定する
