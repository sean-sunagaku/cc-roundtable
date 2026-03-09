# Workflow

## 目的

Codex がアーキテクチャ案の文書と図を作る時に、毎回 0 から考え直さずに SubAgent を切れるようにする。

## 典型フロー

1. 親エージェントが対象案の slug と title を決める
2. scaffold script で `docs/architecture-definitions/<slug>/` を作る
3. 対応する prompt template を読み、SubAgent に渡す
4. SubAgent が `Markdown` と `draw.io` を更新する
5. 親エージェントが `SVG` export と最終レビューを行う

## SubAgent への依頼文の型

次の要素を必ず入れる。

- 対象ディレクトリ
- 更新対象ファイル
- どのアーキテクチャ案か
- 何を強調したいか
- 既存 docs/rearchitecture から何を踏襲するか

## 例

```text
docs/architecture-definitions/current-daemon/ を担当してください。
local-daemon-bff 案として、current-daemon.md と source/current-daemon.drawio を更新してください。
cc-roundtable の daemon-first 構成との整合性、recovering、SSE、session host を明示してください。
```
