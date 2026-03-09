# Architecture Definitions Overview

作成日: 2026-03-09

## 目的

`docs/architecture-definitions/` は、cc-roundtable の現在構成や将来案を、Codex と Meeting Room の両方で扱いやすい形にそろえるための文書置き場です。

ここでは `JSON` を正本にしません。理由は次の通りです。

- 設計議論の中心は構造化データよりも説明文と図の整合にある
- 実際にレビューされるのは `Markdown` と `SVG` である
- draw.io を元データにしたほうが図の編集自由度が高い
- Codex の SubAgent にとっても、`MD` と prompt template のほうが役割分担をしやすい

## このディレクトリで管理するもの

- 各アーキテクチャ案の `Markdown`
- 各アーキテクチャ案の `SVG`
- 各アーキテクチャ案の元図 `draw.io`
- Codex / Meeting Room から使うための SubAgent prompt template

## 含まれる案

- `electron-main-monolith/`
- `local-daemon-bff/`
- `event-sourced-state-machine/`
- `hexagonal-plugin-architecture/`
- `job-queue-supervisor/`

## 運用ルール

- 1 案につき 1 ディレクトリを切る
- ディレクトリ直下には `*.md` と `*.svg` を置く
- `drawio` の元ファイルは `source/` に置く
- `SVG` は draw.io desktop の公式 export で更新する
- Codex では `.codex/skills/architecture-doc-subagents/` を入口にして SubAgent を起動する
- Meeting Room では `.claude/meeting-room/agents/architecture-*.json` を選んで議論を分担する

## 使い方

新しい案を増やす時は、次のスクリプトで雛形を作ります。

```bash
node scripts/scaffold-architecture-definition.mjs <slug> "<title>" [architecture-kind]
```

例:

```bash
node scripts/scaffold-architecture-definition.mjs current-daemon "Current Daemon Architecture" local-daemon-bff
```

作成後は、対応する `*_subagent-prompt.md` を SubAgent に渡し、本文と図の更新を進めます。

## 期待する成果物

各案では、最低限次を明確にします。

- 概要
- 一言要約
- 想定コンポーネント
- 主要フロー
- メリット / デメリット
- リスク
- 採用判断の観点

これにより、単なる図のコレクションではなく、設計判断の比較資料として使える状態を保ちます。
