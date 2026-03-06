# Meeting Room 再設計アーキテクチャ案

作成日: 2026-03-06

## この文書群の目的

この文書群は、現在の Meeting Room アプリケーションをゼロから作り直す前提で、複数の設計案を比較し、最終的にどの構成で再構築するかを判断するためのものです。

単なるアイデア整理ではなく、次の3点に使える粒度を目指します。

- 設計判断の根拠を共有する
- 実装順序を決める
- 将来の Web / iPhone 接続まで見据えた境界を決める

## 現在のプロダクト理解

現状のアプリは、概ね次の要素で構成されています。

- Electron デスクトップアプリ
- Setup、Meeting、Terminal、Debug を持つ React renderer
- 会議ライフサイクルと実行制御を持つ Electron main
- PTY 経由で起動される Claude Code ランタイム
- Hook と WebSocket を使ったサブエージェントから UI への中継

このため、主な難所は UI そのものではありません。難しいのは実行系の統合とオーケストレーションです。

- Claude セッションの起動と監視
- ターミナル駆動ランタイムへの確実なプロンプト配送
- Hook 出力と Terminal 出力の正規化
- セッション状態とサマリーの永続化
- PTY、MCP、Hook 失敗時の隔離と回復

## 今回の再設計で満たしたい要件

### 必須

- 会議セッションの source of truth を明確にする
- 初回プロンプト配送、relay、runtime health を安定化する
- UI を再起動してもセッションを復元しやすくする
- 将来の Web クライアント追加を妨げない境界を作る

### 将来要件

- Mac 上で会議セッションが継続して動き続ける
- iPhone からトンネル経由で同じセッションに後から接続できる
- Electron 以外に Web UI を追加できる
- CLI は現時点では優先しない

### 非目標

- 最初から完全なマルチランタイム抽象を作ること
- 分散 worker や remote execution を今すぐ入れること
- event sourcing を全面採用すること

## このシリーズに含まれるディレクトリ

- `01_electron-main-monolith/`
- `02_local-daemon-bff/`
- `03_event-sourced-state-machine/`
- `04_hexagonal-plugin-architecture/`
- `05_job-queue-supervisor/`
- `06_comparison/`
- `07_recommended-architecture/`
- `08_implementation-plan/`

## 各ディレクトリの中身

各ディレクトリ直下には、閲覧しやすさのため基本的に次だけを置きます。

- `*.md`
- `*.svg`

元の `*.drawio` ファイルは各ディレクトリ配下の `source/` にまとめます。

`01` から `05` の各案ディレクトリには、基本図に加えて次も含めます。

- `*_class-structure.svg`
- `*_processing-flow.svg`

対応する元ファイルは次のように `source/` に入ります。

- `source/*.drawio`
- `source/*_class-structure.drawio`
- `source/*_processing-flow.drawio`

## 評価観点

各案は次の観点で比較します。

- 開発速度
- 運用の単純さ
- 非同期タイミングバグへの強さ
- テストしやすさ
- 長期保守性
- ランタイム差し替えへの柔軟性
- Web / iPhone クライアントへの広がりやすさ
- 現プロダクトとの適合性

## 結論の先出し

最も有力なのは次の組み合わせです。

- システム境界としての `Local Daemon / Backend-for-Frontend`
- 状態管理としての `重要イベント中心の event log`
- 実行ランタイム境界としての `薄い adapter 層`

つまり、Electron は表示に集中し、Mac 上の daemon が会議セッションの実体を持ちます。
その上で、Claude / PTY / Hook の詳細は daemon 内の一箇所へ閉じ込め、重要な状態変化だけを event として残します。

将来的に iPhone などから Web 経由で同じセッションへ接続するなら、この形が最も自然です。

## この文書群の読み方

### まず読むもの

- `06_comparison`
- `07_recommended-architecture`
- `08_implementation-plan`

### 設計の背景を理解するために読むもの

- `01_electron-main-monolith`
- `02_local-daemon-bff`
- `03_event-sourced-state-machine`
- `04_hexagonal-plugin-architecture`
- `05_job-queue-supervisor`

## 期待する最終像

最終的に目指す運用イメージは次です。

1. Mac 上で `meeting-room-daemon` が常駐またはオンデマンド起動する
2. Electron はその daemon の 1 クライアントとして接続する
3. 将来は iPhone から Web UI で同じ daemon に接続する
4. セッション状態は daemon が保持し、UI は再接続可能にする
5. Claude 依存は runtime bridge に閉じ込め、meeting core に漏らさない

この文書群は、その最終像に向かうための判断材料と実装計画をまとめたものです。
