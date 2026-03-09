# Meeting Room - Agent 開発ガイド

AI エージェント（Cursor/Claude）がこのプロジェクトを編集・調査する際のコンテキストです。

## ドキュメントの役割

- `AGENTS.md`: エージェント向けの正本。実装ルール、既知不具合、調査起点をまとめる
- `CLAUDE.md`: Claude 系エージェント向けの短い入口
- `docs/design/meeting-room-product-design.md`: プロダクト設計資料の正本

## サービス概要

Meeting Room は、ローカルのコードベースを題材に複数 Agent で議論・実装を進めるための実験用サービスです。

- ユーザーは議題、対象プロジェクト、参加 Agent を指定して会議を開始する
- 1 会議ごとに Claude ランタイムが PTY 上で起動し、初回プロンプトが自動投入される
- 画面上では chat と terminal を分けて観察でき、会話は hook relay 済みのメッセージを優先表示する
- Electron デスクトップ UI でも、`meeting-room-daemon` + ブラウザ UI でも同じ会議状態を扱える
- 会議状態は durable event log に保存され、再起動後は `recovering` として復元される

重要: 現在の実装は **daemon-first** です。Electron main が直接 PTY を握るのではなく、ローカル daemon を起動して API/SSE 経由で会議を操作する構成が主系です。

## 最初に読むファイル

サービス把握の最短経路は次です。

1. `docs/service-overview.md`
2. `README.md`
3. `src/packages/shared-contracts/src/meeting-room-daemon.ts`
4. `src/packages/meeting-room-hooks/README.md`
5. `docs/current-architecture-overview.svg`

実装詳細が必要になったら次を読むと早いです。

| 関心 | 最初に見るファイル |
|------|--------------------|
| Electron から daemon をどう叩いているか | `src/apps/desktop/src/main/index.ts`, `src/apps/desktop/src/main/daemon/meeting-room-daemon-manager.ts` |
| 会議開始、初回プロンプト、Agent 構成 | `src/apps/desktop/src/main/meeting.ts` |
| daemon 側の API とライフサイクル | `src/daemon/src/http/start-meeting-room-daemon-server.ts`, `src/daemon/src/app/meeting-room-daemon-app.ts` |
| Claude runtime / PTY / ready 検出 | `src/daemon/src/runtime/meeting-runtime-manager.ts`, `src/apps/desktop/src/main/pty-manager.ts` |
| 会話・状態の永続化と復元 | `src/daemon/src/sessions/meeting-session-store.ts`, `src/daemon/src/events/` |
| ブラウザ UI | `src/apps/web/src/WebRootApp.tsx`, `src/apps/web/src/browser-meeting-room-client.ts`, `src/apps/web/src/index.html` |
| Electron renderer UI | `src/apps/desktop/src/renderer/screens/SetupScreen.tsx`, `src/apps/desktop/src/renderer/screens/MeetingScreen.tsx` |
| 契約型 / API surface | `src/packages/shared-contracts/src/meeting-room-daemon.ts`, `src/apps/desktop/src/shared/types.ts` |
| Hook relay の挙動 | `.claude/settings.json`, `src/packages/meeting-room-hooks/README.md`, `src/packages/meeting-room-hooks/*.py` |
| GUI 最終検証 | `e2e/gui/final-verification.mjs` |

## 現在の構成

### 1. Electron renderer

- Setup 画面で議題・projectDir・参加 Agent を選ぶ
- Meeting 画面で chat / terminal / runtime diagnostics を表示する
- 共通 UI 本体は `src/apps/desktop/src/renderer/MeetingRoomShell.tsx`、Electron 側の入口は `src/apps/desktop/src/renderer/App.tsx`

### 2. Electron main

- ローカル daemon を起動・監視し、IPC を daemon command に変換する
- `MeetingService` は今も重要だが、主責務は Agent profile 管理、初回プロンプト生成、summary 保存などの補助側
- 会議本体の start / pause / resume / end / sendHumanMessage は `index.ts` から daemon へ流れる

### 3. Daemon (`src/daemon`)

- `/api/commands`, `/api/events`, `/api/sessions`, `/api/meta`, `/api/agents`, `/api/default-project-dir`, `/health` を提供するローカルバックエンド
- Claude runtime 起動、terminal I/O、イベント永続化、SSE 配信、復元を担当する
- 実体は `MeetingRoomDaemonApp`、runtime 実装は `MeetingRuntimeManager`、状態保持は `MeetingSessionStore`

### 5. Browser UI

- `src/apps/web/src/` で Browser client を実装し、`src/apps/web/client/` を生成して配信する
- `src/apps/desktop/dist/`, `src/apps/web/client/`, `src/daemon/dist/` は生成物なので commit しない
- `BrowserMeetingRoomClient` が daemon REST/SSE を直接叩き、`MeetingRoomShell` を再利用して Electron と同じ会議フローを表示する

### 4. Hooks / relay

- `.claude/settings.json` から `src/packages/meeting-room-hooks/run-hook.sh` 経由で Python hooks を起動する
- `approval-gate.py` が `SendMessage` / `Task` / `TeamCreate` を承認待ち中にブロックする
- `SendMessage`, `SubagentStop`, `Stop`, `TeamCreate`, `Task` を relay し、chat 表示や状態更新に使う
- terminal 生ログから会話を再構成する fallback は廃止済みで、hook 起点の payload が正系

## Project knowledge の取り方

- まず `docs/service-overview.md` を読めば、概要・起動方法・責務分割・調査起点が一通りわかります
- 契約を先に掴みたい場合は `src/packages/shared-contracts/src/meeting-room-daemon.ts` を起点にすると、API と event の全体像を短時間で把握できます
- 「なぜ今こうなっているか」を知りたい時は `docs/rearchitecture/content_rearchitecture_2026-03-06/` を読むと設計意図の比較材料があります
- Hook relay の表示仕様やノイズ除去ルールは `src/packages/meeting-room-hooks/README.md` が一次情報です
- エージェント向けドキュメントを更新する時は、`AGENTS.md` / `CLAUDE.md` / `docs/service-overview.md` をセットで同期してください
- この環境で Project memory を使えるエージェントは、project overview / commands / completion notes も参照してください

## 既知の不具合と修正履歴

### 1. Claude Code で Hook が読み込まれない（Hooks: Found 0 total hooks）

**症状**: デバッグログに `Hooks: Found 0 total hooks in registry` と表示され、`.claude/settings.json` の Stop/PostToolUse 等の Hook が認識されない。

**原因**: `pty-manager.ts` の `runClaude` が `process.env.MEETING_ROOM_SETTINGS_FILE` を参照していたが、この環境変数は Electron メインプロセスには設定されていない。`meeting.ts` の `startMeeting` では PTY に渡す env に `MEETING_ROOM_SETTINGS_FILE` を入れて `start()` に渡すが、その env は PTY 子プロセスにのみ継承され、Node の `process.env` には反映されない。

**修正**: `PtySession` に `env` を保持し、`runClaude` で `sessionEnv.MEETING_ROOM_SETTINGS_FILE` を優先して参照する。これにより `--settings` が正しく付与され、claude 起動コマンドに `--settings '/path/to/.claude/settings.json' --setting-sources user,project,local` が付く。

```typescript
// pty-manager.ts - セッション env を保持
this.sessions.set(meetingId, { process: proc, cwd, env });

// runClaude で sessionEnv を参照
const settingsPath =
  sessionEnv.MEETING_ROOM_SETTINGS_FILE || process.env.MEETING_ROOM_SETTINGS_FILE || ...
```

---

### 2. 初回プロンプトが送信されない

**症状**: 会議開始後、議題・参加メンバー等の初回プロンプトが自動で Claude に送信されず、ユーザーが手動で入力する必要がある。

**原因**: 初回プロンプト送信が `queueInitPrompt` → `flushPendingInitPrompt` 経由だが、次のどちらかで失敗していた可能性がある。

1. **ready 検出**: `hasClaudeReadySignal`（`❯` や `what task would you like the agent team`）が Claude Code の出力形式変更でマッチしない
2. **タイミング**: フォールバックの 5 秒が短く、Claude TUI がまだ受け付け可能になる前に送信していた

**修正**: 初回プロンプトを**手動送信と全く同じ経路**（`MeetingService.submitPrompt`）で送るように統一。

- `queueInitPrompt` でプロンプトをキューに積む
- `hasClaudeReadySignal` が検出されたら `onClaudeReady` → `flushPendingInitPrompt` → `submitPrompt` で即送信
- 検出されない場合は 20 秒後に `flushPendingInitPrompt` → `submitPrompt` で送信

重要: 手動送信（Input Bar → sendHumanMessage → submitPrompt）と同一の `submitPrompt` を使用することで、改行を含むプロンプトも正しく `write(content)` + `write("\r")` で Enter 送信され、確実に送信される。

```typescript
// meeting.ts - submitPrompt は手動送信と共通
private submitPrompt(meetingId: string, prompt: string): boolean {
  const content = prompt.replace(/\r/g, "").trim();
  if (!content) return false;
  const ok = this.ptyManager.write(meetingId, content);
  if (!ok) return false;
  this.ptyManager.write(meetingId, "\r");  // Enter で送信
  return true;
}
```

---

### 3. 初回プロンプトと手動送信の動作を統一する

**方針**: 初回プロンプト送信は `PtyManager` で直接 `write` せず、必ず `MeetingService` 経由にする。

- `PtyManager.runClaude(meetingId)`: claude コマンドの起動のみ担当
- `MeetingService.queueInitPrompt(meetingId, prompt)`: 初回プロンプトを ready 検出または 8 秒フォールバックで送信

---

### 4. 初回プロンプトが「改行だけ」になる（Enter が送信されない）

**症状**: 初回プロンプトの内容は表示されるが改行だけになり、送信されない。手動送信（Input Bar）では同じ `submitPrompt` で問題なく送れる。

**原因**: ready 検出の瞬間は TUI がまだ描画・処理中の transitional な状態。そのタイミングで `content` と `\r` を同時送信すると、`\r` が「送信」ではなく「改行」として解釈される。

**修正のポイント: content と Enter の送信タイミングを分ける**

1. **content を即送信** → TUI がすぐ受け取り、表示・バッファ処理を開始
2. **`\r` を 600ms 後に送信** → TUI が content の処理を終えて、「次の Enter は送信」と解釈できる状態になってから送る

```typescript
// meeting.ts - flushPendingInitPrompt
const ok = this.ptyManager.write(meetingId, pending);  // content 即送信
// ...
setTimeout(() => {
  this.ptyManager.write(meetingId, "\r");  // Enter は 600ms 遅延
}, 600);
```

---

### 5. draw.io を SVG 化する時は公式 Export を使う

**症状**: 汎用の Draw.io → SVG 変換ライブラリで出力すると、表示はできてもレイアウトやテキストが一部崩れることがある。

**原因**: draw.io 固有の `foreignObject` / text fallback / レイアウト処理の再現度が不十分な変換器がある。

**方針**: `.drawio` から `.svg` を作る時は、`draw.io / diagrams.net desktop` の **公式 export 経路**を使う。  
このリポジトリでは `src/apps/desktop/package.json` の devDependencies に入っている `@hhhtj/draw.io` を使う。

**コマンド例**:

```bash
cd src/apps/desktop
./node_modules/.bin/electron ./node_modules/@hhhtj/draw.io --export --format svg --output ../../../docs/architecture.svg ../../../docs/architecture.drawio
./node_modules/.bin/electron ./node_modules/@hhhtj/draw.io --export --format svg --output ../../../docs/current-architecture-overview.svg ../../../docs/current-architecture-overview.drawio
```

**補足**:
- 出力された SVG は `foreignObject` を含むが、公式 export は `<switch>` 内に `<text>` フォールバックも入るため、汎用変換より壊れにくい。
- XML 妥当性は `xmllint --noout docs/*.svg` で確認できる。
- `@markdown-viewer/drawio2svg` のような非公式変換は、このプロジェクトでは再現度不足だったため採用しない。

---

### 6. `docs/rearchitecture/content_rearchitecture_2026-03-06` の配置ルール

**方針**: 各案ディレクトリの直下には、閲覧対象の `*.md` と `*.svg` だけを置く。  
編集用・元データの `*.drawio` は、各ディレクトリ配下の `source/` にまとめる。

**例**:

```text
01_electron-main-monolith/
  01_electron-main-monolith.md
  01_electron-main-monolith.svg
  01_electron-main-monolith_class-structure.svg
  01_electron-main-monolith_processing-flow.svg
  source/
    01_electron-main-monolith.drawio
    01_electron-main-monolith_class-structure.drawio
    01_electron-main-monolith_processing-flow.drawio
```

**運用ルール**:
- 新しい案ディレクトリを追加する時も同じ構成にする。
- 直下に `md/svg` 以外を増やさない。
- `.drawio` を更新したら、対応する `.svg` を公式 export で再生成する。

---

### 7. 実装完了前に必ず最終 GUI E2E を通す

**方針**: このプロジェクトでは、実装が完了したと判断する前に、必ず Electron の最終 GUI E2E を実行する。  
型チェックや build だけで完了扱いにしない。

**実行コマンド**:

```bash
npm --prefix src/apps/desktop run verify:final
npm --prefix src/apps/desktop run e2e:web
```

**内容**:
- `typecheck`
- `build`
- `e2e/gui/final-verification.mjs` による GUI E2E

**E2E の確認範囲**:
- Setup 画面まで戻せること
- 新規会議を開始できること
- 手動送信が通ること
- 一時停止 / 再開が通ること
- Electron 再起動後に `recovering` で復元されること
- 会議終了後に Setup 画面へ戻り、`/api/sessions` が空になること

**運用ルール**:
- エージェントは、実装完了を報告する前にこのコマンドを実行する。
- 実行できなかった場合は、未実行のまま完了扱いにせず、ブロッカーを明示する。
- GUI 上でノイズや不要文言が見えた場合は、そのままにせずフィルタや表示制御まで修正する。

---

## 関連ファイル

| 責務 | ファイル |
|------|----------|
| PTY 管理・claude 起動・--settings 付与 | `src/apps/desktop/src/main/pty-manager.ts` |
| 会議ライフサイクル・submitPrompt | `src/apps/desktop/src/main/meeting.ts` |
| ready 検出・flush トリガー | `src/apps/desktop/src/main/index.ts` (`ptyManager.on("data")`) |
| Hook 設定 | `.claude/settings.json` |
| draw.io 公式 export 用依存 | `src/apps/desktop/package.json` (`@hhhtj/draw.io`) |
| 元図 | `docs/architecture.drawio`, `docs/current-architecture-overview.drawio` |
| 生成 SVG | `docs/architecture.svg`, `docs/current-architecture-overview.svg` |
| rearchitecture 文書群 | `docs/rearchitecture/content_rearchitecture_2026-03-06/` |
