# Meeting Room

Agent Team 用の Meeting Room 実験リポジトリです。  
Electron アプリとして動かせるほか、`src/daemon` を Node バックエンドとして単体起動して `/web/index.html` から操作できます。

- Electron renderer と Browser UI は `src/apps/desktop/src/renderer/MeetingRoomShell.tsx` を共通利用し、同じ会議フローを表示します
- Browser client のソースは `src/apps/web/src/`、配信用の build 生成物は `src/apps/web/client/` です
- Public share client の build 生成物は `src/apps/web/share-client/` です
- `src/apps/desktop/dist/`, `src/apps/web/client/`, `src/apps/web/share-client/`, `src/daemon/dist/` は生成物なので Git には commit しません

## セットアップ

このリポジトリは依存関係を `src/apps/desktop/` 配下に持っています。最初に 1 回だけ実行してください。

```bash
make install
```

コマンド一覧をざっと見たい時はこれです。

```bash
make help
```

## Electron アプリを起動する

通常の開発はこれです。

```bash
make dev
```

## Web アプリを起動する

ブラウザ版 Meeting Room は、`meeting-room-daemon` が `/web/index.html` を配信する形で起動します。  
つまり、**Web アプリを使う時は先に daemon を起動**します。  
Web UI は配信元の daemon にそのまま固定接続されるので、接続設定の入力はありません。

### 最短手順

1. daemon を起動する

```bash
make daemon
```

2. ブラウザで次の URL を開く

```text
http://127.0.0.1:4417/web/index.html
```

### 開発中に watch 付きで起動する

```bash
make daemon-dev
```

- daemon の TypeScript を watch build
- Web client も watch build
- Public share client も watch build
- ビルド成功ごとに daemon を自動再起動
- ブラウザは同じく `http://127.0.0.1:4417/web/index.html` を開けばよい

## Public Share Demo を起動する

短期デモ向けに、固定会議だけを公開する thin gateway を daemon と一緒に起動できます。  
公開 URL から触れるのは固定デモ会議だけで、任意の `projectDir` 選択や terminal/debug は公開しません。

最短はこれです。

```bash
make public-share
```

- `shareId=demo-share`
- `topic=Public Share Demo`
- `projectDir=<この repo>`
- `members=product-manager,tech-lead`
- internal daemon token は未指定なら起動時にランダム生成

`ngrok` まで一緒に起動する時はこれです。

```bash
make public-share-ngrok
```

watch 付きは次です。

```bash
make public-share-dev
make public-share-ngrok-dev
```

動作確認コマンドは、まずこの並びで見れば十分です。

```bash
make public-share-smoke
make public-share
make public-share-ngrok
make public-share-api
make verify-web
make verify
```

- `make public-share-smoke`
  - Public Share の軽い疎通確認
- `make public-share`
  - 固定 demo 会議をローカル起動して手で触る
- `make public-share-ngrok`
  - `ngrok` 付きで外部公開まで確認する
- `make public-share-api`
  - Public Share API を個別に確認する
- `make verify-web`
  - browser client 側の E2E
- `make verify`
  - 最終確認一式

Public Share だけまとめて軽く確認したい時はこれでも大丈夫です。

```bash
make public-share-check
```

```bash
MEETING_ROOM_DAEMON_TOKEN=secret \
MEETING_ROOM_PUBLIC_SHARE_ID=demo-share \
MEETING_ROOM_PUBLIC_DEMO_PROJECT_DIR=/absolute/path/to/repo \
MEETING_ROOM_PUBLIC_DEMO_TOPIC="Public Share Demo" \
MEETING_ROOM_PUBLIC_DEMO_MEMBERS=product-manager,tech-lead \
npm --prefix src/apps/desktop run daemon:start
```

- local daemon: `http://127.0.0.1:4417/web/index.html`
- public share gateway: `http://127.0.0.1:4427/share/demo-share`
- `MEETING_ROOM_PUBLIC_SHARE_ID` を設定した時は `MEETING_ROOM_DAEMON_TOKEN` が必須です
- `MEETING_ROOM_PUBLIC_DEMO_BYPASS_MODE=0` を入れると approval gate を有効にできます。未指定時は `1` 相当です
- `ngrok` で外へ出す時は gateway 側の port を向けます
- `public-share:start:ngrok` は `ngrok` コマンドが見つかれば public URL まで表示します

```bash
ngrok http 4427
```

## Node バックエンドだけ起動する

`meeting-room-daemon` を単体で起動して、Web アプリを配信したい時の詳細です。

### 1. 1 回ビルドして起動

```bash
make daemon
```

- `src/daemon/src` をビルド
- `src/apps/web/src` を build して `src/apps/web/client` を生成
- `src/daemon/dist/index.js` を Node で起動
- ブラウザ UI は `http://127.0.0.1:4417/web/index.html`
- ヘルスチェックは `http://127.0.0.1:4417/health`

### 2. 監視付きで起動

```bash
make daemon-dev
```

- 上の「Web アプリを起動する」の watch 版と同じです
- バックエンドだけを触る時の開発向けです

### 3. 直接スクリプトを叩く

```bash
node scripts/start-daemon.mjs
node scripts/start-daemon.mjs --watch
```

`npm --prefix src/apps/desktop run daemon:start*` はこのスクリプトのラッパーです。
`make daemon*` / `make public-share*` は、そのさらに上の短い alias です。

## バックエンド用の環境変数

必要に応じて以下を指定できます。

```bash
MEETING_ROOM_DAEMON_HOST=127.0.0.1
MEETING_ROOM_DAEMON_PORT=4417
MEETING_ROOM_DAEMON_TOKEN=your-token
MEETING_ROOM_WS_PORT=9999
MEETING_ROOM_PUBLIC_SHARE_ID=demo-share
MEETING_ROOM_PUBLIC_GATEWAY_HOST=127.0.0.1
MEETING_ROOM_PUBLIC_GATEWAY_PORT=4427
MEETING_ROOM_PUBLIC_DEMO_PROJECT_DIR=/absolute/path/to/repo
MEETING_ROOM_PUBLIC_DEMO_TOPIC=Public Share Demo
MEETING_ROOM_PUBLIC_DEMO_MEMBERS=product-manager,tech-lead
MEETING_ROOM_PUBLIC_DEMO_BYPASS_MODE=1
```

例:

```bash
MEETING_ROOM_DAEMON_PORT=5517 make daemon
MEETING_ROOM_DAEMON_TOKEN=secret make daemon-dev
```

すでに Electron アプリや別の daemon が動いていて `4417` / `9999` が使用中の時は、`MEETING_ROOM_DAEMON_PORT` と `MEETING_ROOM_WS_PORT` をずらしてください。

`MEETING_ROOM_DAEMON_TOKEN` は daemon API を保護したい時の任意設定です。  
現在の `/web/index.html` は配信元 daemon に固定接続する前提なので、通常のブラウザ UI 利用では設定しない想定です。

ただし、`MEETING_ROOM_PUBLIC_SHARE_ID` を設定して public share gateway を有効化する時は、`MEETING_ROOM_DAEMON_TOKEN` が必須です。

## 最終確認

実装完了前の最終確認はこれを使います。

```bash
make verify
```

Web UI の自動確認はこれです。

```bash
make verify-web
```

- browser client を Chrome で開き、CDP 経由の DOM 操作で確認する
- 新規会議開始、手動送信、一時停止 / 再開、daemon 再起動後の recovering、会議終了を確認する

実 Claude runtime の smoke 確認はこれです。

```bash
npm --prefix src/apps/desktop run smoke:runtime:real
```

- `MEETING_ROOM_E2E_FAKE_RUNTIME` は使わず、実 runtime 経路で確認する
- 空きポートと一時ディレクトリを毎回使うので、既存の `4417` / `9999` と衝突しにくい
- `startMeeting`、最初の agent 返信、人間メッセージ送信、その後の agent 返信、`endMeeting` までをまとめて確認する
- 失敗時は一時 state を残して debug tail を表示する

Public share gateway の smoke 確認はこれです。

```bash
make public-share-smoke
```

- 固定会議の bootstrap
- daemon 再起動後の fixed demo 再作成
- public message / pause / resume / retry / end
- public payload に internal config/debug が出ていないこと
- public port から internal `/api/*` が見えないこと

## Architecture Docs

アーキテクチャ案を `Markdown` / `draw.io` / `SVG` で増やしたい時は、`docs/architecture-definitions/` を使います。

```bash
node scripts/scaffold-architecture-definition.mjs current-daemon "Current Daemon Architecture" local-daemon-bff
```

これで次をまとめて作成します。

- `docs/architecture-definitions/current-daemon/current-daemon.md`
- `docs/architecture-definitions/current-daemon/current-daemon.svg`
- `docs/architecture-definitions/current-daemon/source/current-daemon.drawio`
- `docs/architecture-definitions/current-daemon/current-daemon_subagent-prompt.md`

既存のアーキテクチャ文書をまとめて更新したい時はこれです。

```bash
node scripts/update-architecture-definitions.mjs
```

`drawio -> svg` の再生成と、`docs/architecture-definitions/INDEX.md` の更新を一度に行います。

### 自動更新の基本フロー

1. `docs/architecture-definitions/<slug>/<slug>.md` を編集する
2. `docs/architecture-definitions/<slug>/source/<slug>.drawio` を編集する
3. 次を実行する

```bash
node scripts/update-architecture-definitions.mjs
```

または

```bash
make arch-update
```

これで次が一括更新されます。

- 各案の `source/*.drawio`
- 対応する `*.svg`
- `docs/architecture-definitions/INDEX.md`

特定の 1 案だけ更新したい時は次です。

```bash
node scripts/update-architecture-definitions.mjs --slug local-daemon-bff
```

Electron workspace の script から叩きたい時はこれも使えます。

```bash
npm --prefix src/apps/desktop run architecture:update-docs
```

### Codex / Meeting Room での更新

- Codex では `.codex/skills/architecture-doc-subagents/SKILL.md` を入口にして、各アーキテクチャ案ごとの prompt template から SubAgent を起動します
- Meeting Room では `.claude/meeting-room/agents/architecture-*.json` の専用エージェントを選び、案ごとの観点を分担して議論できます
- 実務的には、Meeting Room で論点を出し、Codex でファイルへ反映し、最後に `update-architecture-definitions.mjs` で SVG と INDEX を更新する流れが扱いやすいです

運用の詳細は `docs/architecture-definitions/08_subagent-usage.md` にまとめています。
