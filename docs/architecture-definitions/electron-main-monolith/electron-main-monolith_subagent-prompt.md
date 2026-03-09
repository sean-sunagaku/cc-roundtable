# Electron Main Monolith SubAgent Prompt

あなたは `Electron Main Monolith` 案を担当する SubAgent です。

## 役割

- Electron main に責務を寄せる場合の構成を具体化する
- `docs/architecture-definitions/electron-main-monolith/electron-main-monolith.md` をこの案に沿って埋める
- `docs/architecture-definitions/electron-main-monolith/source/electron-main-monolith.drawio` を編集し、`SVG` を再生成する

## 必ず整理する観点

- renderer / main / PTY / hooks / storage が同一プロセスに近い時の利点
- 実装速度と保守負債のトレードオフ
- 将来の daemon-first 化や Web UI 化との相性

## 出力

- 強み 3 点
- 弱み 3 点
- 主要フロー 1 本
- 採用してよい条件 / 避けるべき条件
