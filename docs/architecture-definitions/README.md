# Architecture Definitions

`docs/architecture-definitions/` は、アーキテクチャ案を `Markdown` と `SVG` で管理するための作業ディレクトリです。  
このディレクトリでは `JSON` を正本にしません。各案ごとに次の 3 点を持つ前提です。

- `<slug>/<slug>.md`
- `<slug>/<slug>.svg`
- `<slug>/source/<slug>.drawio`

補助として、各案に対応する `SubAgent prompt` を同じディレクトリに置けます。

- `<slug>/<slug>_subagent-prompt.md`

## 新しい案を作る

```bash
node scripts/scaffold-architecture-definition.mjs <slug> "<title>" [architecture-kind]
```

例:

```bash
node scripts/scaffold-architecture-definition.mjs current-daemon "Current Daemon Architecture" local-daemon-bff
```

## 作られるもの

- `Markdown` テンプレート
- `draw.io` 元ファイル
- `SubAgent prompt` テンプレート
- `SVG`
- `SubAgent` の実運用手順は `08_subagent-usage.md` を参照

`SVG` は draw.io desktop の公式 export を優先します。  
依存が未インストール、または export に失敗した場合はプレースホルダー SVG が生成されます。

## Codex / Meeting Room での使い方

- Codex では `.codex/skills/architecture-doc-subagents/SKILL.md` を使い、各 prompt template を参照して `spawn_agent` します。
- Meeting Room では `.claude/meeting-room/agents/architecture-*.json` を組み合わせて、案ごとの議論を分担できます。

## アーキテクチャ種別

- `electron-main-monolith`
- `local-daemon-bff`
- `event-sourced-state-machine`
- `hexagonal-plugin-architecture`
- `job-queue-supervisor`
