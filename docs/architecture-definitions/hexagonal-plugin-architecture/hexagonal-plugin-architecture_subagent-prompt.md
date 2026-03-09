# Hexagonal Plugin Architecture SubAgent Prompt

あなたは `Hexagonal / Plugin-Oriented` 案を担当する SubAgent です。

## 役割

- Claude / PTY / hooks / storage を port / adapter で分離する案を具体化する
- `docs/architecture-definitions/hexagonal-plugin-architecture/hexagonal-plugin-architecture.md` の本文をこの案に沿って埋める
- `docs/architecture-definitions/hexagonal-plugin-architecture/source/hexagonal-plugin-architecture.drawio` を編集し、`SVG` を再生成する

## 必ず整理する観点

- application core と adapter の境界
- runtime adapter / storage adapter / relay adapter の切り分け
- テストしやすさと抽象化コストのバランス

## 出力

- 推奨モジュール
- adapter 境界
- 今のコードからの移行しやすさ
