# Recommended Architecture

作成日: 2026-03-09

## 推奨方針

cc-roundtable の現状と将来像を踏まえると、最も現実的なのは次の組み合わせです。

- 外側のシステム境界は `Local Daemon BFF`
- 重要フローには `Event-Sourced State Machine` の規律を部分導入
- 実装詳細の隔離には `Hexagonal Plugin Architecture` を薄く取り入れる

## なぜこの組み合わせか

### 1. 現在の主系がすでに daemon-first に寄っている

このリポジトリでは、会議開始、状態保持、イベント配信、復元の中心が `meeting-room-daemon` 側にあります。したがって、今後も成長させるなら、daemon を session host と見なす設計が最も自然です。

### 2. 問題の中心は UI より非同期オーケストレーションにある

難しいのは画面描画ではなく、次のような流れです。

- Claude runtime の起動
- 初回プロンプト配送
- hook relay と terminal イベントの整合
- approval / bypass / recovering の状態管理

このため、UI 技術の選択よりも、実行系の境界と状態遷移の明示のほうが重要です。

### 3. ただし全面 event sourcing は重い

すべての状態を command / event / projection にすると、学習コストと実装コストが跳ね上がります。現実的には、壊れやすい重要フローだけに event log 的な規律を入れるのがよいバランスです。

### 4. adapter 境界は「薄く」効かせるのがよい

Claude / PTY / hooks / storage を application core から完全分離したくなりますが、今の段階で過剰に抽象化すると開発速度を落とします。まずは daemon 内の依存を薄い port / adapter として切り出す程度が適切です。

## 推奨する実装イメージ

- Renderer / Browser UI:
  - 会議状態の表示
  - command の送信
  - SSE / event stream の購読
- Daemon:
  - session host
  - lifecycle orchestration
  - runtime bridge
  - persistence
  - approval / recovery
- 内部設計:
  - 重要フローだけ explicit state transition
  - Claude / PTY / relay / storage は adapter 境界に寄せる

## 採用しない方がよい方針

- すべてを Electron main に戻す
- 最初から全面 event sourcing にする
- まだ必要が薄い段階で worker / supervisor モデルを本格導入する

## 次アクション

1. `Local Daemon BFF` を主系として docs とコードの境界をそろえる
2. 初回プロンプト配送、recovering、meeting end など重要フローの状態遷移を明文化する
3. runtime / relay / storage の adapter 境界を daemon 内で薄く整える
4. そのあとに Web / mobile 接続や追加 client を広げる
