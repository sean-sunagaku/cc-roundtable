# Meeting Room - Agent Teams 会議室アプリ設計書

## 概要

Agent Teams の議論を「会議室」として可視化し、人間がリアルタイムで参加できる Electron デスクトップアプリ。
Claude Code をアプリ内に埋め込み、会議の作成・実行・参加を一つのウィンドウで完結させる。

### 現状の課題
- Agent 同士が個別メッセージ (directed) で会話するため、議論が分散する
- 人間は `AskUserQuestion` 経由でしか参加できない（受動的）
- 議論の全体像は `discussion.md` をテキストで読むしかない
- ターミナルで claude 起動 → スキル実行 → 別窓で監視、と手順がバラバラ

### 目指す姿
- Electron アプリを開く → 会議を設定 → 開始。全てワンストップ
- 全メッセージが一つの部屋に流れる（Slack チャンネルのような体験）
- 人間はアプリ内の入力欄から直接 Leader に指示 → 遅延ゼロで broadcast
- セッションの「外から覗く」のではなく、セッションそのものがアプリ内で生まれる

## アーキテクチャ

補足: 現在の実装主系は `src/daemon` を中心にした daemon-first 構成です。  
この設計書には初期構想としての Electron 中心表現も含みますが、実装上の source of truth は daemon 側にあります。

```
+----------------------------------------------------+
|  Electron App (Meeting Room)                       |
|                                                    |
|  +----------------------------------------------+  |
|  |  Chat View (上ペイン)                         |  |
|  |  - Agent/人間のメッセージをチャット形式で表示  |  |
|  |  - PostToolUse Hook → WebSocket → ここに表示   |  |
|  +----------------------------------------------+  |
|  |  Input Bar (入力欄)                           |  |
|  |  [メッセージを入力...                 ] [送信] |  |
|  |  → xterm.js (非表示 pty) 経由で Leader に直送  |  |
|  +----------------------------------------------+  |
|  |  Terminal (折りたたみ可)                       |  |
|  |  - xterm.js で Claude Code Leader を表示       |  |
|  |  - 通常は折りたたみ、展開で生のやりとりが見る  |  |
|  +----------------------------------------------+  |
|                                                    |
|  Main Process:                                     |
|  - pty で `claude` CLI を子プロセス起動            |
|  - WebSocket Server (port 9999) で Hook と通信     |
|  - Input Bar → pty.write() で Leader に直送        |
+----------------------------------------------------+
         ^
         | WebSocket (port 9999)
         |
+--------+---------+
| PostToolUse Hook |  ← SendMessage 後に発火
| (ws-relay.py)    |  → メッセージを Electron に push
+--------+---------+
         ^
         |
+--------+---------+
| PreToolUse Hook  |  ← SendMessage 前に発火
| (enforce-broadcast.py) → directed をブロック
+------------------+
```

## データフロー

### Agent → Chat View (表示)
```
Agent calls SendMessage(type: "broadcast", content: "...")
  |
  +---> PreToolUse Hook: type: "broadcast" → exit 0 (許可)
  |
  +---> SendMessage 実行 (全エージェントに配信)
  |
  +---> PostToolUse Hook: WebSocket で Electron に push
           |
           +---> Electron Main Process → IPC → Renderer
                    |
                    +---> Chat View にメッセージ表示
```

### Human → Agents (入力・遅延ゼロ)
```
人間が Input Bar にメッセージを入力 → [送信]
  |
  +---> Electron Main Process
           |
           +---> pty.write("チームに伝えて: {message}\n")
           |       → Leader の Claude Code に直接入力される
           |       → Leader が broadcast で全エージェントに中継
           |
           +---> Chat View に即座に表示（楽観的 UI）
                    → PostToolUse で戻ってきた時に confirmed に更新
```

**ポイント**: ファイル経由・ポーリング一切なし。
Input Bar → pty.write() → Leader に直送。遅延ゼロ。

## UI 設計

### 画面 1: 会議セットアップ

```
+--------------------------------------------------+
| Meeting Room                                 [x] |
+--------------------------------------------------+
|                                                  |
|  New Meeting                                     |
|                                                  |
|  スキル    [feature-discussion         v]        |
|  議題      [タスク優先順位の再設計       ]        |
|  プロジェクト  /Users/.../focus_one (auto)        |
|                                                  |
|  メンバー (スキルに応じて自動設定):               |
|    [x] product-manager (PM)                      |
|    [x] ux-analyst (UX)                           |
|    [x] behavioral-psychologist (心理学)           |
|    [x] tech-lead (テック)                        |
|                                                  |
|                        [会議を開始]               |
|                                                  |
+--------------------------------------------------+
```

### 画面 2: 会議中

```
+--------------------------------------------------+
| Meeting Room - タスク優先順位の再設計         [x] |
+--------------------------------------------------+
|                                                  |
| +----------------------------------------------+ |
| |                                              | |
| | [Robot] product-manager          11:30:15    | |
| | 課題の構造化について心理学的な観点から意見を  | |
| | 聞きたいです。                                | |
| |                                              | |
| | [Robot] ux-analyst               11:30:22    | |
| | 認知負荷の観点から言うと、進捗の可視化には    | |
| | 3つのアプローチが...                          | |
| |                                              | |
| | [You]                            11:31:05    | |
| | 実はユーザーは進捗バーよりも                  | |
| | 「今日何をすべきか」を知りたいんだよね        | |
| |                                              | |
| | [Robot] behavioral-psych         11:31:15    | |
| | 人間のコメントに同意します。認知心理学では    | |
| | 「次のアクション」の明確さが自己効力感に...   | |
| |                                              | |
| +----------------------------------------------+ |
|                                                  |
| +----------------------------------------------+ |
| | メッセージを入力...                   [送信]  | |
| +----------------------------------------------+ |
|                                                  |
| [v Terminal]  (折りたたみトグル)                   |
| +----------------------------------------------+ |
| | $ claude                                     | |
| | > TeamCreate...                              | |
| | > (Leader の生ログ)                           | |
| +----------------------------------------------+ |
+--------------------------------------------------+
```

**Input Bar の動作:**
- 見た目はチャットアプリの入力欄
- 送信すると裏で `pty.write()` で Leader に送られる
- Leader への指示はテンプレート化:
  - 入力: "進捗バーは逆効果かも"
  - pty送信: "チームに broadcast してください: 進捗バーは逆効果かも"
- Enter で送信、Shift+Enter で改行

**Terminal ペイン:**
- デフォルトは折りたたみ（非表示）
- 展開すると Leader の Claude Code の生のやりとりが見える
- デバッグ用。通常は Chat View + Input Bar だけで完結

## コンポーネント設計

### 1. PreToolUse Hook: broadcast 強制 (`enforce-broadcast.py`)

SendMessage の `type: "message"` (directed) をブロックし、broadcast を強制する。

**動作:**
- stdin から JSON を読み取り
- `type === "message"` なら非ゼロ exit + エラーメッセージ出力
- `type === "broadcast"` or `"shutdown_request"` なら exit 0

**出力（ブロック時）:**
```
[Meeting Room] directed メッセージは禁止です。
type: "broadcast" を使って全員に共有してください。
会議室モードでは全メッセージが全員に見えます。
```

**有効化制御:**
- `.claude/meeting-room/.active` フラグファイルの存在をチェック
- フラグなし → exit 0（素通り、通常の Agent Teams 動作）
- フラグあり → broadcast 強制ロジック実行

### 2. PostToolUse Hook: WebSocket relay (`ws-relay.py`)

SendMessage 完了後にメッセージを Electron アプリへ WebSocket で転送する。

**送信 JSON:**
```json
{
  "type": "agent_message",
  "id": "msg_1709623815_pm",
  "sender": "product-manager",
  "content": "課題の構造化について...",
  "timestamp": "2026-03-05T11:30:15",
  "team": "feature-discussion"
}
```

**フォールバック:**
- WebSocket 接続失敗時 → 既存の discussion.md ログに追記（agent-teams-log と同じ）
- Electron が起動していなくてもエージェント動作を妨げない

### 3. Electron App

#### Main Process (`src/apps/desktop/src/main/index.ts`)

```typescript
// 1. WebSocket Server (port 9999)
//    - Hook からのメッセージを受信 → IPC で renderer に転送

// 2. pty (node-pty)
//    - `claude` CLI を子プロセスとして起動
//    - Input Bar からの入力を pty.write() で送信
//    - pty の出力を Terminal ペインに表示

// 3. BrowserWindow
//    - Chat View + Input Bar + Terminal ペイン
```

#### Renderer (`src/apps/desktop/src/renderer/`)

| コンポーネント | 役割 |
|---------------|------|
| `ChatView` | メッセージリスト。WebSocket から受信したメッセージを時系列表示 |
| `MessageBubble` | 個別メッセージ。sender によりアイコン・色を切り替え |
| `InputBar` | チャット入力欄。送信 → main process → pty.write() |
| `TerminalPane` | xterm.js。Leader の Claude Code の生出力。折りたたみ可 |
| `SetupScreen` | 会議セットアップ画面。スキル選択、議題入力、メンバー確認 |
| `ConnectionStatus` | WebSocket 接続状態の表示 |

#### Input Bar → pty の変換ロジック

```typescript
// ユーザーの入力をLeader向けの指示に変換して送信
function sendToLeader(userMessage: string): void {
  const prompt = `チームに broadcast してください:\n${userMessage}`;
  pty.write(prompt + '\n');

  // 楽観的に Chat View にも表示
  addOptimisticMessage({
    sender: 'human',
    content: userMessage,
    status: 'pending' // PostToolUse で confirmed に更新
  });
}
```

### 4. 会議セットアップ → Claude Code 起動

```typescript
function startMeeting(config: MeetingConfig): void {
  // 1. フラグファイル作成（Hook の有効化）
  fs.writeFileSync('.claude/meeting-room/.active', '');

  // 2. Claude Code を pty で起動
  const ptyProcess = spawn('claude', [], {
    cwd: config.projectDir,
    env: { ...process.env, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1' }
  });

  // 3. 初期プロンプトを自動送信
  const initPrompt = buildInitPrompt(config);
  // 例: "/feature-discussion タスク優先順位の再設計"
  ptyProcess.write(initPrompt + '\n');
}
```

## エージェント定義の変更

全エージェントの定義に以下を追加:

```markdown
## コミュニケーションルール
- **broadcast のみ使用**: `type: "message"` (directed) は禁止。
  全メッセージは `type: "broadcast"` で全員に共有する。
  会議室モードでは人間の参加者も含め、全員が全メッセージを見ている。
- **人間の参加者がいる**: 人間からの broadcast メッセージが届くことがある。
  他のエージェントと同様に対等な議論参加者として扱い、意見に反応する。
- **「了解しました」だけの ACK 返信は不要**
```

## ディレクトリ構成

現在の実装構成は次です。

```text
root/
  ├── .claude/
  │   └── settings.json
  ├── docs/
  │   └── design/
  │       └── meeting-room-product-design.md
  ├── plans/
  │   ├── roadmap/
  │   └── tasks/
  ├── scripts/
  └── src/
      ├── apps/
      │   ├── desktop/
      │   │   ├── package.json
      │   │   └── src/
      │   │       ├── main/
      │   │       ├── renderer/
      │   │       └── shared/
      │   └── web/
      │       ├── src/
      │       └── client/
      ├── daemon/
      │   ├── src/app/
      │   ├── src/http/
      │   ├── src/runtime/
      │   ├── src/events/
      │   └── tsconfig.json
      └── packages/
          ├── shared-contracts/
          ├── meeting-room-support/
          └── meeting-room-hooks/
```

配置ルール:

- 実装コードは `src/` に集約する
- Electron は `src/apps/desktop`
- Browser UI は `src/apps/web`
- daemon は `src/daemon`
- hooks は `src/packages/meeting-room-hooks`
- 生成物は `src/apps/desktop/dist`, `src/apps/web/client`, `src/daemon/dist`
- 生成物は Git に commit せず、必要時に build で再生成する

## Hook 設定

```json
// settings.json に追加
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "SendMessage",
        "hooks": [
          {
            "type": "command",
            "command": "HOOKS_DIR=\"${MEETING_ROOM_HOOKS_DIR:-${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}/src/packages/meeting-room-hooks}\"; [ -f \"$HOOKS_DIR/run-hook.sh\" ] || exit 0; bash \"$HOOKS_DIR/run-hook.sh\" enforce-broadcast.py"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "SendMessage",
        "hooks": [
          {
            "type": "command",
            "command": "HOOKS_DIR=\"${MEETING_ROOM_HOOKS_DIR:-${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}/src/packages/meeting-room-hooks}\"; [ -f \"$HOOKS_DIR/run-hook.sh\" ] || exit 0; bash \"$HOOKS_DIR/run-hook.sh\" ws-relay.py"
          }
        ]
      }
    ]
  }
}
```

既存の `agent-teams-log` hook と共存可能（PostToolUse は複数登録 OK）。

## 有効化/無効化

`.claude/meeting-room/.active` フラグファイルで制御:

| 状態 | フラグ | PreToolUse | PostToolUse |
|------|--------|-----------|-------------|
| Meeting Room ON | `.active` あり | broadcast 強制 | WebSocket に送信 |
| Meeting Room OFF | `.active` なし | 素通り | 素通り（or discussion.md のみ） |

- Electron アプリ起動時: `.active` を作成
- Electron アプリ終了時: `.active` を削除
- 通常の Agent Teams は影響を受けない

## 実装フェーズ

### Phase 1: Hook 層
- [ ] `enforce-broadcast.py` - broadcast 強制
- [ ] `ws-relay.py` - WebSocket relay
- [ ] `.active` フラグによる有効化制御
- [ ] settings.json への hook 登録

### Phase 2: Electron 基盤
- [ ] Electron + node-pty + xterm.js プロジェクト初期化
- [ ] Main process: pty で Claude Code を起動
- [ ] Terminal ペイン: xterm.js で Leader の出力を表示（折りたたみ可）
- [ ] WebSocket Server: Hook からのメッセージ受信
- [ ] Agent 状態表示: SubagentStop hook と連携し、アクティブ/完了を表示
- [ ] タブ UI: 複数会議をタブで切り替え（各タブが独立した pty + WS）

### Phase 3: Chat UI
- [ ] Chat View: メッセージ表示
- [ ] Input Bar: 入力 → pty.write() → Leader に直送
- [ ] 楽観的 UI 表示 + PostToolUse で confirmed 更新
- [ ] MessageBubble: sender 別アイコン・色分け

### Phase 4: 会議セットアップ
- [ ] SetupScreen: スキル選択、議題入力
- [ ] スキル一覧の自動検出（.claude/skills/ をスキャン）
- [ ] 会議開始 → Claude Code 起動 → 初期プロンプト自動送信
- [ ] 会議終了 → クリーンアップ

### Phase 5: 磨き込み
- [ ] Markdown レンダリング（メッセージ内のコードブロック等）
- [ ] メッセージの折りたたみ（長文対応）
- [ ] セッション履歴の保存・閲覧
- [ ] 会議中の設定変更（メンバー追加等）
- [ ] 通知音（新メッセージ時）

## 技術スタック

| 層 | 技術 |
|---|------|
| Desktop | Electron |
| Terminal 埋め込み | node-pty + xterm.js |
| Chat UI | React + TypeScript |
| WebSocket | ws (Node.js) |
| Hook | Python 3 |
| スタイル | Tailwind CSS or CSS Modules |

## 決定事項

| # | 項目 | 決定 |
|---|------|------|
| 1 | Input Bar のプロンプト | `チームに broadcast してください:\n{message}` |
| 2 | 複数会議 | 1アプリ内でタブ切り替え |
| 3 | ログ出力 | Electron 内で完結。discussion.md は生成しない |
| 4 | Agent の状態表示 | Phase 2 から入れる。SubagentStop hook と連携 |
| 5 | メタ操作 | 専用ボタン（会議終了、一時停止等）。ボタンも pty.write() だがプロンプトが異なる。Input Bar は議論内容専用 |
| 6 | リポジトリ名 | `cc-roundtable` |
