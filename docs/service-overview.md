# Meeting Room サービス概要

このドキュメントは、Meeting Room を初めて触る人や、AI エージェントが project knowledge を短時間で掴むための一次入口です。

## 何をするサービスか

Meeting Room は、ローカルのコードベースを対象に、複数 Agent で議論・調査・実装を進めるためのローカル会議サービスです。

- ユーザーは議題、project directory、参加 Agent を指定して会議を開始する
- 会議ごとに Claude runtime を 1 本立ち上げ、初回プロンプトで参加 Agent と進め方を投入する
- chat では Agent の発話や status relay を見られ、terminal では Claude TUI の生出力を確認できる
- 一時停止、再開、手動送信、MCP リトライ、会議終了、再起動後の復元までを扱う

## 現在の提供形態

### Electron デスクトップ

日常の開発で使う主 UI です。

- renderer: `electron/src/renderer/`
- main: `electron/src/main/`
- Setup 画面で会議設定を作り、Meeting 画面で chat / terminal / diagnostics を扱う

### Local daemon + Browser UI

同じ会議コアを Node バックエンドとして単体起動し、ブラウザから操作する形です。

- daemon: `services/meeting-room-daemon/`
- browser client: `apps/web/client/`
- 入口 URL: `http://127.0.0.1:4417/web/index.html`

## 現在のアーキテクチャ

重要: 2026-03-06 時点の主系は **daemon-first** です。

1. Electron renderer が IPC を送る
2. Electron main が local daemon を起動・監視し、command を daemon API に変換する
3. daemon が Claude runtime を PTY 上で起動する
4. hooks が Agent の発話や status を relay する
5. daemon が event log に会議状態を保存し、SSE と session snapshot を配信する
6. renderer / browser UI が snapshot と event から画面を更新する

このため、会議ライフサイクルを直す時は Electron 側だけでなく daemon 側の責務も必ず確認してください。

## コンポーネント別の責務

| レイヤ | 主な責務 | ファイル |
|--------|----------|----------|
| Renderer | Setup / Meeting / Debug UI | `electron/src/renderer/App.tsx`, `electron/src/renderer/screens/*` |
| Electron main | daemon 起動、IPC bridge、window 管理 | `electron/src/main/index.ts`, `electron/src/main/daemon/meeting-room-daemon-manager.ts` |
| Meeting helper | init prompt 生成、agent profile、summary 保存 | `electron/src/main/meeting.ts` |
| Daemon API | `/health`, `/api/meta`, `/api/events`, `/api/sessions`, `/api/commands` | `services/meeting-room-daemon/src/http/start-meeting-room-daemon-server.ts` |
| Daemon core | command 処理、event 発火、session 更新 | `services/meeting-room-daemon/src/app/meeting-room-daemon-app.ts` |
| Runtime | Claude 起動、PTY I/O、init prompt flush | `services/meeting-room-daemon/src/runtime/meeting-runtime-manager.ts` |
| Session persistence | durable event log、recovering 復元、chat/debug filtering | `services/meeting-room-daemon/src/sessions/meeting-session-store.ts`, `services/meeting-room-daemon/src/events/` |
| Shared contracts | command / event / payload schema | `packages/shared-contracts/src/meeting-room-daemon.ts` |
| Hooks | SendMessage / Stop / SubagentStop relay | `.claude/settings.json`, `hooks/README.md`, `hooks/*.py` |
| Browser client | daemon 操作用の薄い Web UI | `apps/web/client/app.js`, `apps/web/client/index.html` |

## 会議の基本フロー

1. Setup 画面で議題、対象ディレクトリ、参加 Agent を選ぶ
2. `meeting:start` が daemon command に変換される
3. daemon が session を作り、Claude runtime を起動する
4. 初回プロンプトを送信し、hook relay が chat 向けのイベントを返す
5. 人間の追加メッセージ、pause/resume、retry、end が command として流れる
6. session state は event log に追記され、再起動後は `recovering` に戻る

## 知識を素早く取りに行く順番

### サービス概要だけ知りたい

1. この `docs/service-overview.md`
2. `README.md`
3. `docs/current-architecture-overview.svg`

### API / event の全体像を知りたい

1. `packages/shared-contracts/src/meeting-room-daemon.ts`
2. `services/meeting-room-daemon/src/http/start-meeting-room-daemon-server.ts`
3. `services/meeting-room-daemon/src/app/meeting-room-daemon-app.ts`

### runtime / prompt / hook 周りを知りたい

1. `services/meeting-room-daemon/src/runtime/meeting-runtime-manager.ts`
2. `electron/src/main/meeting.ts`
3. `electron/src/main/pty-manager.ts`
4. `hooks/README.md`
5. `.claude/settings.json`

### 再起動復元や状態永続化を知りたい

1. `services/meeting-room-daemon/src/sessions/meeting-session-store.ts`
2. `services/meeting-room-daemon/src/events/durable-event-log-store.ts`
3. `e2e/gui/final-verification.mjs`

### UI を触る時

1. `electron/src/renderer/screens/SetupScreen.tsx`
2. `electron/src/renderer/screens/MeetingScreen.tsx`
3. `apps/web/client/app.js`

## 実行コマンド

```bash
npm --prefix electron install
npm --prefix electron run dev
npm --prefix electron run daemon:start
npm --prefix electron run daemon:start:dev
npm --prefix electron run verify:final
```

補足:

- `daemon:start` は build 後に daemon を起動する
- `daemon:start:dev` は watch build + 自動再起動付き
- daemon のデフォルト host/port は `127.0.0.1:4417`
- 必要なら `MEETING_ROOM_DAEMON_PORT`, `MEETING_ROOM_WS_PORT`, `MEETING_ROOM_DAEMON_TOKEN` を使う

## 変更前に意識しておくこと

- chat 表示は hook relay ベースが正系で、terminal fallback に戻さない
- 会議開始や prompt 送信周りは timing 依存があるので、Electron 側 helper と daemon runtime の両方を確認する
- 画面や会議ライフサイクルを変えたら `npm --prefix electron run verify:final` を通す
- 設計検討や将来像は `docs/rearchitecture/content_rearchitecture_2026-03-06/` を参照する
