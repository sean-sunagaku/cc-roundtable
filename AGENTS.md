# Meeting Room - Agent 開発ガイド

AI エージェント（Cursor/Claude）がこのプロジェクトを編集・調査する際のコンテキストです。

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
このリポジトリでは `electron/package.json` の devDependencies に入っている `@hhhtj/draw.io` を使う。

**コマンド例**:

```bash
cd electron
./node_modules/.bin/electron ./node_modules/@hhhtj/draw.io --export --format svg --output ../docs/architecture.svg ../docs/architecture.drawio
./node_modules/.bin/electron ./node_modules/@hhhtj/draw.io --export --format svg --output ../docs/current-architecture-overview.svg ../docs/current-architecture-overview.drawio
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

## 関連ファイル

| 責務 | ファイル |
|------|----------|
| PTY 管理・claude 起動・--settings 付与 | `electron/src/main/pty-manager.ts` |
| 会議ライフサイクル・submitPrompt | `electron/src/main/meeting.ts` |
| ready 検出・flush トリガー | `electron/src/main/index.ts` (`ptyManager.on("data")`) |
| Hook 設定 | `.claude/settings.json` |
| draw.io 公式 export 用依存 | `electron/package.json` (`@hhhtj/draw.io`) |
| 元図 | `docs/architecture.drawio`, `docs/current-architecture-overview.drawio` |
| 生成 SVG | `docs/architecture.svg`, `docs/current-architecture-overview.svg` |
| rearchitecture 文書群 | `docs/rearchitecture/content_rearchitecture_2026-03-06/` |
