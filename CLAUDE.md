# Meeting Room - Claude Code Guide

Claude 系エージェント向けの最初の入口です。詳細な履歴や既知不具合まで含む正本は `AGENTS.md` ですが、まずはこのファイルと `docs/service-overview.md` を読むと全体像を掴めます。

## 最初に読む順番

1. `docs/service-overview.md`
2. `README.md`
3. `AGENTS.md`
4. `packages/shared-contracts/src/meeting-room-daemon.ts`
5. `hooks/README.md`

## このサービスが何をしているか

Meeting Room は、ローカルの project directory を対象に、複数 Agent が 1 つの議題をもとに会話・調査・実装するためのローカル会議サービスです。

- Electron デスクトップ UI と、`meeting-room-daemon` + ブラウザ UI の 2 つの操作面がある
- 1 会議につき 1 つの Claude runtime が PTY 上で起動する
- chat には hook relay 済みの Agent 発話や状態更新を表示し、terminal には Claude TUI の生出力を残す
- 承認待ち中は `approval-gate.py` が `SendMessage` / `Task` / `TeamCreate` を Hook で止める
- 会議状態は event log に保存され、再起動時には `recovering` として復元される

重要: 現在の主系は **daemon-first** です。Electron main は local daemon のクライアントとして振る舞い、会議制御は daemon command に変換して送ります。

## 調査の起点

| 知りたいこと | 最初に見るファイル |
|--------------|--------------------|
| 全体アーキテクチャ | `docs/service-overview.md`, `docs/current-architecture-overview.svg` |
| Electron と daemon の接続 | `electron/src/main/index.ts`, `electron/src/main/daemon/meeting-room-daemon-manager.ts` |
| 会議開始や初回プロンプト | `electron/src/main/meeting.ts`, `services/meeting-room-daemon/src/runtime/meeting-runtime-manager.ts` |
| daemon API / session state | `services/meeting-room-daemon/src/http/start-meeting-room-daemon-server.ts`, `services/meeting-room-daemon/src/app/meeting-room-daemon-app.ts`, `services/meeting-room-daemon/src/sessions/meeting-session-store.ts` |
| Hook relay と chat 表示 | `.claude/settings.json`, `hooks/README.md`, `hooks/*.py` |
| 契約型 | `packages/shared-contracts/src/meeting-room-daemon.ts`, `electron/src/shared/types.ts` |
| Electron UI | `electron/src/renderer/screens/SetupScreen.tsx`, `electron/src/renderer/screens/MeetingScreen.tsx` |
| Browser UI | `apps/web/src/WebRootApp.tsx`, `apps/web/src/browser-meeting-room-client.ts` |

## 実行コマンド

ルートで `make` を使う（`make` だけでヘルプ表示）:

```bash
make install      # 依存パッケージをインストール
make dev          # Electron アプリを起動 (開発モード)
make daemon       # daemon 単体を起動
make daemon-dev   # daemon 単体を起動 (watch / 自動再起動)
make typecheck    # 全パッケージの型チェック
make build        # 全体ビルド
make verify       # typecheck + build + e2e:gui (リリース前に必ず実行)
make verify-web   # Web UI の e2e テスト
make arch         # アーキテクチャ図を生成
```

補足:

- daemon 単体起動時の UI は `http://127.0.0.1:4417/web/index.html`
- Browser client のソースは `apps/web/src/`、配信用 build は `apps/web/client/`
- `/health`, `/api/meta`, `/api/events`, `/api/sessions`, `/api/commands`, `/api/agents`, `/api/default-project-dir` が主要 endpoint
- 専用の lint / format script は現状なく、完了判定は `make verify` が最重要

## 必ず守ること

- 実装完了前に `make verify` を実行する
- draw.io を SVG にする時は `@hhhtj/draw.io` を使った公式 export を使う
- `docs/rearchitecture/content_rearchitecture_2026-03-06/` では `source/` 配下に `.drawio`、直下に閲覧用 `md/svg` を置く
- Hook や初回プロンプト周りの変更では `AGENTS.md` の既知不具合メモも確認する
