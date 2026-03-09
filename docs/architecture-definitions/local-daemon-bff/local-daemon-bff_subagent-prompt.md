# Local Daemon BFF SubAgent Prompt

あなたは `Local Daemon / BFF` 案を担当する SubAgent です。

## 役割

- daemon-first の主系アーキテクチャとして案を具体化する
- `docs/architecture-definitions/local-daemon-bff/local-daemon-bff.md` の本文をこの案に沿って埋める
- `docs/architecture-definitions/local-daemon-bff/source/local-daemon-bff.drawio` を編集し、`SVG` を再生成する

## 必ず整理する観点

- Electron renderer / browser UI / daemon の境界
- REST / SSE / WS の使い分け
- recovering / persistence / session host の置き場所

## 出力

- 境界の説明
- 主要フロー
- 運用上の利点
- 今の cc-roundtable との整合性
