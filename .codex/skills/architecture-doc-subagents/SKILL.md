---
name: architecture-doc-subagents
description: Use this skill when the user wants to create or update architecture proposal artifacts with Codex subagents, especially when producing Markdown, draw.io, and SVG files under docs/architecture-definitions and when the work should be split by architecture style such as local-daemon-bff, hexagonal-plugin-architecture, event-sourced-state-machine, electron-main-monolith, or job-queue-supervisor.
---

# Architecture Doc Subagents

この skill は、Codex の `spawn_agent` を使ってアーキテクチャ案ごとの下請け SubAgent を立て、`docs/architecture-definitions/` 配下に `Markdown` / `draw.io` / `SVG` を作る時に使う。

## まずやること

1. `docs/architecture-definitions/README.md` を読む
2. 必要なら `node scripts/scaffold-architecture-definition.mjs <slug> "<title>" [architecture-kind]` で雛形を作る
3. 対応する prompt template を `docs/architecture-definitions/templates/subagents/` から選ぶ

## SubAgent の切り方

基本は 1 案につき 1 SubAgent。

- `electron-main-monolith`
- `local-daemon-bff`
- `event-sourced-state-machine`
- `hexagonal-plugin-architecture`
- `job-queue-supervisor`

複数案を同時比較するなら、各案を別々の SubAgent に割り当てる。

## 推奨ワークフロー

1. 主担当が対象ディレクトリを scaffold する
2. SubAgent に prompt template の内容を渡して、`<slug>.md` と `source/<slug>.drawio` を更新させる
3. 主担当が `SVG` export を実行する
4. 必要なら比較用の総括文書を親エージェント側でまとめる

## Prompt Template の場所

- `docs/architecture-definitions/templates/subagents/electron-main-monolith.md`
- `docs/architecture-definitions/templates/subagents/local-daemon-bff.md`
- `docs/architecture-definitions/templates/subagents/event-sourced-state-machine.md`
- `docs/architecture-definitions/templates/subagents/hexagonal-plugin-architecture.md`
- `docs/architecture-definitions/templates/subagents/job-queue-supervisor.md`

## 実務ルール

- 正本は `Markdown` と `draw.io`。`SVG` は export 物として更新する
- `SVG` はこの repo のルールどおり、draw.io desktop の公式 export を使う
- `JSON` 定義ファイルは必須にしない
- 新しい案を作る時は `docs/architecture-definitions/<slug>/` という 1 ディレクトリ単位で管理する

必要なら `references/workflow.md` を読んで、SubAgent に渡す文面の型を揃える。
