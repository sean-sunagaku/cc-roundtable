# Phase 4 Plan: Electron Client Integration

作成日: 2026-03-06

## 目的

Electron を session host ではなく daemon client へ寄せ、既存 UI を推奨アーキテクチャへ移す。

## スコープ

- Electron main の責務縮小
- renderer の command / event 化
- local state の削減
- session reconnect

## 実装項目

- [ ] Electron main から orchestration を外す
- [ ] daemon 起動 / 接続責務だけ main に残す
- [ ] renderer を command API 呼び出しに切り替える
- [ ] renderer を event stream 購読に切り替える
- [ ] session debug 表示を daemon 経由に寄せる
- [ ] reconnect 時の projection 再取得を実装する

## Electron 側に残す責務

- window 管理
- app lifecycle
- local desktop integration
- daemon 起動補助

## Electron 側から外す責務

- meeting orchestration
- runtime control
- state source of truth
- relay 正規化

## 受け入れ条件

- [ ] 会議開始 / 入力送信 / 終了が daemon 経由で動く
- [ ] renderer は event 購読で UI 更新できる
- [ ] Electron 再起動後に session を再接続できる
- [ ] main process に domain state が残らない

## 主なリスク

- 既存 UI と新 API のズレ
- 一時的に二重状態が発生する

## リスク軽減

- 画面ごとではなく操作ごとに切り替える
- source of truth を早めに daemon へ一本化する
