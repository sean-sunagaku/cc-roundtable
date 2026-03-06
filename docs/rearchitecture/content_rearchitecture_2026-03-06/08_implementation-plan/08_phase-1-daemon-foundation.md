# Phase 1 Plan: Daemon Foundation

作成日: 2026-03-06

## 目的

`meeting-room-daemon` を独立した実行主体として立ち上げ、Electron から接続できる最小骨格を作る。

## スコープ

- daemon の起動エントリ
- Electron main からの起動 / 接続
- `health` 確認
- command API の最小骨格
- event stream の最小骨格
- shared contracts の導入

## 実装項目

- [ ] daemon package / service ディレクトリを作る
- [ ] 起動時設定、port、ログ出力の基盤を作る
- [ ] `/health` 相当の確認 endpoint を作る
- [ ] command API の初期形を作る
- [ ] WebSocket または SSE の event stream を作る
- [ ] Electron main から daemon 起動 / 接続 / 再接続の基盤を作る
- [ ] shared contracts に command / event 型を置く

## 初期 command 契約

- `startMeeting`
- `sendHumanMessage`
- `endMeeting`
- `retryMcp`

## 初期 event 契約

- `meeting.started`
- `runtime.error`
- `meeting.ended`

## 受け入れ条件

- [ ] daemon が単独起動できる
- [ ] Electron から daemon に ping できる
- [ ] `startMeeting` を受けて応答を返せる
- [ ] event stream に接続できる
- [ ] command / event の型定義が shared package にある

## 動作確認

- [ ] daemon を単独起動してログと listen port を確認する
- [ ] `health` endpoint に実際にアクセスして正常応答を確認する
- [ ] command API に対してサンプル request を送り、期待する response を確認する
- [ ] event stream client を接続して、最低限の接続成立を確認する

## この段階でやらないこと

- Claude 実行の本実装
- event log
- persistence の本格実装
- Web UI

## 主なリスク

- Electron main が daemon 起動責務を持ちすぎる
- API 契約を早く決めすぎて後で崩す

## リスク軽減

- 最小 command / event だけ先に定義する
- domain 用語で型を置き、Claude 固有語を避ける
