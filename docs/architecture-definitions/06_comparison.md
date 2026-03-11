# Architecture Comparison

作成日: 2026-03-09

## 比較対象

この比較では次の 5 案を横並びで評価します。

- Electron Main Monolith
- Local Daemon BFF
- Event-Sourced State Machine
- Hexagonal Plugin Architecture
- Job Queue Supervisor

## 比較軸

| 観点                          | Electron Main Monolith | Local Daemon BFF | Event-Sourced State Machine | Hexagonal Plugin Architecture | Job Queue Supervisor |
| ----------------------------- | ---------------------: | ---------------: | --------------------------: | ----------------------------: | -------------------: |
| 開発速度                      |                      5 |                4 |                           2 |                             3 |                    1 |
| 運用の単純さ                  |                      4 |                3 |                           2 |                             3 |                    2 |
| 非同期信頼性                  |                      2 |                4 |                           5 |                             3 |                    4 |
| テストしやすさ                |                      2 |                5 |                           4 |                             5 |                    3 |
| 長期保守性                    |                      2 |                5 |                           4 |                             5 |                    3 |
| ランタイム柔軟性              |                      2 |                5 |                           4 |                             5 |                    4 |
| 現状の cc-roundtable との適合 |                      3 |                5 |                           3 |                             4 |                    2 |

## 短評

### Electron Main Monolith

最短距離で実装を進めやすい一方で、状態管理とランタイム統合の責務が Electron main に集中しやすく、将来の Web UI や daemon-first への移行コストが高くなります。

### Local Daemon BFF

現状のプロダクトの進化方向と最も整合します。UI と実行系の境界が明確で、復元、再接続、複数クライアント対応の土台を作りやすいのが強みです。

### Event-Sourced State Machine

初回プロンプト配送や会議ライフサイクルのような重要フローには強力ですが、全面採用すると複雑度が急上昇します。部分導入が現実的です。

### Hexagonal Plugin Architecture

Claude / PTY / hooks / storage の adapter 境界を整理するには有効です。BFF 境界の内側に取り込むと特に効きますが、抽象化を広げすぎると前倒し投資になります。

### Job Queue Supervisor

将来の並列実行や worker 管理には効くものの、今の cc-roundtable の規模ではオーバーエンジニアリングになりやすい案です。

## 実務的な読み替え

- すぐに成果を出したいだけなら `Electron Main Monolith`
- 今の主系を整理しつつ将来を見据えるなら `Local Daemon BFF`
- 重要な非同期フローの正しさを高めたいなら `Event-Sourced State Machine` を部分導入
- 実装詳細の依存を減らしたいなら `Hexagonal Plugin Architecture` を内側へ導入
- 本格的な並列 orchestration が必要になってから `Job Queue Supervisor` を検討
