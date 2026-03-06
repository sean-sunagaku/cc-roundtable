# Phase 2 Plan: Claude Runtime Bridge

作成日: 2026-03-06

## 目的

Claude / PTY / Hook の詳細を daemon 内の一箇所へ集約し、meeting core がそれらの生仕様を直接扱わないようにする。

## スコープ

- PTY 起動
- Claude 起動コマンド
- stdin / stdout の扱い
- ready signal 検知
- Hook relay 受信
- terminal fallback
- runtime event の正規化

## 推奨モジュール

- `ClaudeRuntimeBridge`
- `ClaudeSessionHandle`
- `RuntimeEventNormalizer`
- `HooksRelayReceiver`

## 実装項目

- [ ] 既存の `pty-manager.ts` 相当の責務を daemon 側へ写す
- [ ] Claude 起動コマンドと settings 注入を bridge に閉じ込める
- [ ] ready signal 検知を bridge 内へ移す
- [ ] hook relay 受信を bridge 内経由へ寄せる
- [ ] terminal fallback を bridge 内の fallback path にする
- [ ] 出力を共通 runtime event へ正規化する

## 正規化したい event

- `runtime.ready`
- `runtime.warning`
- `runtime.error`
- `agent.message`
- `agent.status_changed`

## 受け入れ条件

- [ ] Claude 起動と停止が daemon からできる
- [ ] ready signal の検知が Electron main から外れる
- [ ] Hook relay と terminal fallback が同じ event モデルに変換される
- [ ] UI 側は Claude 固有の生 payload を見なくてよい

## この段階でやらないこと

- runtime-agnostic plugin system
- 2つ目のランタイム対応
- 過剰な Port 分割

## 主なリスク

- 抽象化を急ぎすぎて Port が vendor 固有になる
- 逆に bridge が何でも屋になる

## リスク軽減

- まずは `ClaudeRuntimeBridge` 1 まとまりで閉じ込める
- 2つ目の runtime が出るまでは過剰一般化しない
