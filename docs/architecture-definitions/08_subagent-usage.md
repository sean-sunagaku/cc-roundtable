# SubAgent Usage

作成日: 2026-03-09

## 結論

このリポジトリでは、アーキテクチャ文書を作る時に `JSON` の静的定義を増やすより、次の 2 段構えで進めるのが扱いやすいです。

- Codex では skill + prompt template から `spawn_agent` する
- Meeting Room では `agents/*.json` から役割を選んで議論させる

## Codex での使い方

Codex 側の入口は次です。

- `.codex/skills/architecture-doc-subagents/SKILL.md`

基本手順は次の通りです。

1. `node scripts/scaffold-architecture-definition.mjs <slug> "<title>" [architecture-kind]` で雛形を作る
2. `docs/architecture-definitions/<slug>/<slug>_subagent-prompt.md` を読む
3. その内容をベースに `spawn_agent` で SubAgent を起動する
4. SubAgent に `<slug>.md` と `source/<slug>.drawio` を担当させる
5. 親エージェントが SVG export と比較・総括を行う

### Codex 依頼文の例

```text
docs/architecture-definitions/local-daemon-bff/ を担当してください。
local-daemon-bff 案として local-daemon-bff.md と source/local-daemon-bff.drawio を更新してください。
cc-roundtable の daemon-first 構成、recovering、REST / SSE、session host の置き方を必ず明記してください。
```

## Meeting Room での使い方

Meeting Room 側では次のエージェントを追加済みです。

- `architecture-electron-main-monolith`
- `architecture-local-daemon-bff`
- `architecture-event-sourced-state-machine`
- `architecture-hexagonal-plugin`
- `architecture-job-queue-supervisor`

これらは `.claude/meeting-room/agents/` にあり、Setup 画面から選択できます。

### 向いている使い方

- 案ごとに担当を分けて比較観点を集める
- `product-manager` や `tech-lead` と一緒に、実装速度と保守性の観点をぶつける
- `user-liaison` を混ぜて、前提不足や比較漏れを拾う

## どちらを使うべきか

- 文書ファイルを直接更新したいなら Codex の SubAgent
- 多人数の観点比較や議論ログを残したいなら Meeting Room
- 実務的には「Meeting Room で論点を出し、Codex でファイルへ落とす」が一番使いやすいです
