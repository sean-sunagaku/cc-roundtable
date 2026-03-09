# Meeting Room

Agent Team 用の Meeting Room 実験リポジトリです。  
Electron アプリとして動かせるほか、`src/daemon` を Node バックエンドとして単体起動して `/web/index.html` から操作できます。

- Electron renderer と Browser UI は `src/apps/desktop/src/renderer/MeetingRoomShell.tsx` を共通利用し、同じ会議フローを表示します
- Browser client のソースは `src/apps/web/src/`、配信用の build 生成物は `src/apps/web/client/` です
- `src/apps/desktop/dist/`, `src/apps/web/client/`, `src/daemon/dist/` は生成物なので Git には commit しません

## セットアップ

このリポジトリは依存関係を `src/apps/desktop/` 配下に持っています。最初に 1 回だけ実行してください。

```bash
npm --prefix src/apps/desktop install
```

## Electron アプリを起動する

通常の開発はこれです。

```bash
npm --prefix src/apps/desktop run dev
```

## Web アプリを起動する

ブラウザ版 Meeting Room は、`meeting-room-daemon` が `/web/index.html` を配信する形で起動します。  
つまり、**Web アプリを使う時は先に daemon を起動**します。  
Web UI は配信元の daemon にそのまま固定接続されるので、接続設定の入力はありません。

### 最短手順

1. daemon を起動する

```bash
npm --prefix src/apps/desktop run daemon:start
```

2. ブラウザで次の URL を開く

```text
http://127.0.0.1:4417/web/index.html
```

### 開発中に watch 付きで起動する

```bash
npm --prefix src/apps/desktop run daemon:start:dev
```

- daemon の TypeScript を watch build
- Web client も watch build
- ビルド成功ごとに daemon を自動再起動
- ブラウザは同じく `http://127.0.0.1:4417/web/index.html` を開けばよい

## Node バックエンドだけ起動する

`meeting-room-daemon` を単体で起動して、Web アプリを配信したい時の詳細です。

### 1. 1 回ビルドして起動

```bash
npm --prefix src/apps/desktop run daemon:start
```

- `src/daemon/src` をビルド
- `src/apps/web/src` を build して `src/apps/web/client` を生成
- `src/daemon/dist/index.js` を Node で起動
- ブラウザ UI は `http://127.0.0.1:4417/web/index.html`
- ヘルスチェックは `http://127.0.0.1:4417/health`

### 2. 監視付きで起動

```bash
npm --prefix src/apps/desktop run daemon:start:dev
```

- 上の「Web アプリを起動する」の watch 版と同じです
- バックエンドだけを触る時の開発向けです

### 3. 直接スクリプトを叩く

```bash
node scripts/start-daemon.mjs
node scripts/start-daemon.mjs --watch
```

`npm --prefix src/apps/desktop run daemon:start*` はこのスクリプトのラッパーです。

## バックエンド用の環境変数

必要に応じて以下を指定できます。

```bash
MEETING_ROOM_DAEMON_HOST=127.0.0.1
MEETING_ROOM_DAEMON_PORT=4417
MEETING_ROOM_DAEMON_TOKEN=your-token
MEETING_ROOM_WS_PORT=9999
```

例:

```bash
MEETING_ROOM_DAEMON_PORT=5517 npm --prefix src/apps/desktop run daemon:start
MEETING_ROOM_DAEMON_TOKEN=secret npm --prefix src/apps/desktop run daemon:start:dev
```

すでに Electron アプリや別の daemon が動いていて `4417` / `9999` が使用中の時は、`MEETING_ROOM_DAEMON_PORT` と `MEETING_ROOM_WS_PORT` をずらしてください。

`MEETING_ROOM_DAEMON_TOKEN` は daemon API を保護したい時の任意設定です。  
現在の `/web/index.html` は配信元 daemon に固定接続する前提なので、通常のブラウザ UI 利用では設定しない想定です。

## 最終確認

実装完了前の最終確認はこれを使います。

```bash
npm --prefix src/apps/desktop run verify:final
```

Web UI の自動確認はこれです。

```bash
npm --prefix src/apps/desktop run e2e:web
```

- browser client を Chrome で開き、CDP 経由の DOM 操作で確認する
- 新規会議開始、手動送信、一時停止 / 再開、daemon 再起動後の recovering、会議終了を確認する
