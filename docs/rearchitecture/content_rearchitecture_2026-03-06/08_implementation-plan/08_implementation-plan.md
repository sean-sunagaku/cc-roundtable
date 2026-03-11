# 推奨案の実装計画

作成日: 2026-03-06

## この計画の前提

実装対象は最終推奨案に限定します。

- `Local Daemon / BFF`
- `重要イベント中心の event log`
- `薄い Claude runtime bridge`

目的は、設計の議論を実装順へ落とし込み、段階的に安全に移行することです。

## 進捗トラッキング

- [ ] Phase 1: Daemon Foundation
- [ ] Phase 2: Claude Runtime Bridge
- [ ] Phase 3: Session State and Event Log
- [ ] Phase 4: Electron Client Switchover
- [ ] Phase 5: Web Readiness and Hardening

## 実装方針

### 1. 先に境界を作る

いきなり全部を書き換えず、まず `meeting-room-daemon` と UI の境界を定義します。

### 2. runtime の詳細を閉じ込める

Claude / PTY / Hook の生仕様は daemon 内の runtime bridge に閉じ込めます。

### 3. source of truth を daemon に寄せる

renderer や Electron main にある会議状態を徐々に daemon 側へ移します。

### 4. event log は重要フローだけに限定する

全面 event sourcing は避け、次だけを対象にします。

- meeting lifecycle
- init prompt lifecycle
- human message submit
- agent message receive
- runtime warning / error

### 5. 将来の Web UI に備える

CLI は前提にせず、Electron と Web が同じ command / event 契約を使えるようにします。

### 6. 各 phase で実装と検証をセットにする

各 phase はコードを書いて終わりではなく、実際に対象 client や接続経路を動かして確認できるところまで含めます。

- daemon phase は process 起動と API 疎通を確認する
- runtime bridge phase は Claude runtime を実際に起動して確認する
- Electron integration phase は Electron UI を起動して確認する
- Web readiness phase はブラウザを起動して command / event / reconnect を確認する

## 実装フェーズ

### Phase 1: Daemon Foundation

目的:

- daemon を独立プロセスとして起動できるようにする
- Electron main が daemon を起動 / 接続できるようにする
- command API と event stream の最小契約を定義する

成果物:

- `meeting-room-daemon` の起動エントリ
- `/health` と command API の骨格
- WebSocket または SSE の骨格
- shared contracts の定義

詳細 Plan:

- `08_phase-1-daemon-foundation.md`

チェック:

- [ ] daemon package の土台がある
- [ ] Electron main から daemon の起動または接続ができる
- [ ] 最小 command / event 契約が shared contracts にある

### Phase 2: Claude Runtime Bridge

目的:

- PTY、Claude 起動、ready signal、Hook relay を `ClaudeRuntimeBridge` に集約する
- meeting core が Claude 生仕様を直接知らない状態を作る

成果物:

- `ClaudeRuntimeBridge`
- `RuntimeEventNormalizer`
- hook / terminal fallback 統合経路

詳細 Plan:

- `08_phase-2-runtime-bridge.md`

チェック:

- [ ] Claude / PTY / Hook の詳細が bridge に集約されている
- [ ] ready signal と relay 正規化が Electron main から外れている
- [ ] UI に Claude 生 payload を渡していない

### Phase 3: Session State and Event Log

目的:

- daemon を session source of truth にする
- 重要フローだけ append-only event log を残す
- projection で UI 向け状態を組み立てる

成果物:

- `SessionEventLog`
- `MeetingViewProjection`
- `HealthProjection`
- session persistence

詳細 Plan:

- `08_phase-3-session-state-events.md`

チェック:

- [ ] daemon が session state の source of truth になっている
- [ ] 重要イベントだけ append-only に保存される
- [ ] projection 再構築で session view を復元できる

### Phase 4: Electron Client Switchover

目的:

- Electron renderer / main を daemon client に寄せる
- 既存の orchestration を段階的に daemon へ移す

成果物:

- Electron からの command 呼び出し
- event stream 購読
- local state の削減
- session reconnect

詳細 Plan:

- `08_phase-4-electron-integration.md`

チェック:

- [ ] renderer が command / event ベースで動く
- [ ] Electron main が domain orchestration を持たない
- [ ] 再起動後の reconnect が成立する

### Phase 5: Web Readiness and Hardening

目的:

- 将来の iPhone / Web 接続に備えて API 契約と認証境界を固める
- tunnel 越し接続でも session host が Mac 側であることを維持する

成果物:

- auth / session access rule
- reconnect / resume policy
- observability / health policy
- Web client 用の最低限の契約固定

詳細 Plan:

- `08_phase-5-web-readiness.md`

チェック:

- [ ] Electron と Web が同じ契約を見られる
- [ ] tunnel 越し接続前提の auth / access rule がある
- [ ] Mac 上の daemon が session host のまま保たれる
- [ ] browser / client を使った実動作確認の観点が phase plan に入っている

## 実装順の理由

この順番にする理由は、後戻りコストを減らすためです。

- daemon 境界がないまま event log を作っても、最終配置が崩れる
- runtime bridge がないまま state を固めると、Claude 生仕様がコアに漏れる
- source of truth を daemon に寄せる前に Web を考えると責務がぶれる

## 全体の完了条件

- [ ] Electron が daemon client として動く
- [ ] Claude / PTY / Hook の詳細が runtime bridge に閉じ込められている
- [ ] meeting state の source of truth が daemon にある
- [ ] 重要イベントが append-only に記録される
- [ ] 再接続時に session を復元できる
- [ ] 将来 Web UI を載せるための command / event 契約が固まっている

## 非目標

- すぐに Web UI を完成させること
- すぐに runtime-agnostic plugin system を作ること
- remote worker / distributed supervisor を入れること

## 補足

この計画は「全部を理想形にしてから出す」ためのものではなく、段階的に価値を出しながら risk を潰すためのものです。
