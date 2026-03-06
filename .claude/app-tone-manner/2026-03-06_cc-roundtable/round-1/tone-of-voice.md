# Tone of Voice: cc-roundtable (Meeting Room)

**Author:** tone-of-voice-writer
**Date:** 2026-03-06
**Status:** Round 1 / Phase 3
**Design Tension:** "Scholarly but alive"

---

## 1. Brand Voice Matrix

5 dimensions that govern all written communication in cc-roundtable.

| Dimension | Score | Description |
|-----------|-------|-------------|
| **Formality** | **7/10** | Professional without being corporate. Uses "ですます" (polite form) in Japanese, but avoids excessive honorifics or enterprise stiffness. Technical terms remain in English where natural. Button labels are concise imperatives or nouns, never slang. The register is "a capable colleague briefing you on system state" -- not a boardroom presentation, not a Slack DM. |
| **Humor** | **2/10** | Essentially absent. cc-roundtable is an observation instrument, not a personality. No jokes in UI copy, no playful loading messages, no puns. The only acceptable "lightness" is the quiet satisfaction of well-crafted microcopy -- a precisely worded empty state that respects the user's intelligence. Humor in developer tools erodes trust faster than it builds rapport. The product's character comes from precision, not wit. |
| **Enthusiasm** | **3/10** | Restrained and purposeful. The product does not celebrate, exclaim, or congratulate. Energy is expressed structurally -- through real-time liveness (streaming messages, pulsing status indicators) rather than through exclamatory copy. Success states are confirmations, not celebrations. "会議を開始しました" (Meeting started), not "会議が始まりました！準備完了です！" (Meeting started! All set!). The "alive" pole of "Scholarly but alive" is carried by the UI's temporal dynamism, not by the voice's energy level. |
| **Respect** | **8/10** | Deep respect for the user's expertise and attention. Never explains what the user already knows. Never patronizes with tooltips on obvious functions. Error messages assume the user can act on technical information ("WebSocket 接続が切断されました。再接続を試行中..." is sufficient -- no need for "Don't worry, we're fixing it!"). Respects the user's time: every word in the UI earns its place. The product treats the user as the conductor -- someone with authority and competence. |
| **Complexity** | **6/10** | Technically precise but not dense. Uses correct technical terms (WebSocket, MCP, Agent) without hedging or simplification, but structures information for scannability. One concept per message. Status indicators use the minimum words needed for unambiguous communication. The voice assumes fluency in development concepts but does not assume familiarity with cc-roundtable's internal architecture. |

### Voice Matrix Summary

```
Formality:    7/10  ██████████████░░░░░░  (polite, professional, not corporate)
Humor:        2/10  ████░░░░░░░░░░░░░░░░  (essentially absent)
Enthusiasm:   3/10  ██████░░░░░░░░░░░░░░  (restrained, structural energy)
Respect:      8/10  ████████████████░░░░  (treats user as expert conductor)
Complexity:   6/10  ████████████░░░░░░░░  (precise, scannable, assumes fluency)
```

### Variable Assignments

| # | Variable | Value | Rationale |
|---|----------|-------|-----------|
| 36 | voice_humor | 2 | A scholars' observatory does not tell jokes. Humor undermines the Competence 9 / Sophistication 8 personality. Developer trust is built through precision, and "cute" copy is explicitly identified as a trust-destroying anti-pattern (user-psychology.md Section 1.4). The minimal 2 (not 0) acknowledges that well-crafted microcopy can have a quiet elegance that is not humor per se, but shares its lightness. |
| 37 | voice_enthusiasm | 3 | "Scholarly but alive" demands that aliveness come from temporal dynamism (real-time streaming, state transitions, connection pulses), not from copy energy. High enthusiasm in text ("Successfully connected!" "Meeting is live!") conflicts with the Poised design principle (confidence through restraint) and the Sincerity definition (transparency, not performed warmth). The 3 allows for subtle affirmative tone in onboarding contexts where the user is new, without infecting the core operational UI. |

---

## 2. UI Copy Examples (Japanese + English)

Each category provides OK examples and NG examples with rationale.

### 2.1 Button Labels

**New Meeting / Start**

| | Japanese | English | Notes |
|---|---------|---------|-------|
| OK | 会議を開始 | Start Meeting | Concise imperative. Clear action. |
| OK | 新規会議 | New Meeting | Noun form -- works for a primary action button. |
| NG | さあ、始めよう！ | Let's Get Started! | Too enthusiastic. Performed warmth. |
| NG | 会議を始める | Start a Meeting | Casual dictionary form (辞書形) drops below formality 7. |
| NG | 新しい会議を作成する | Create a New Meeting | Over-specified. "作成する" implies construction, not initiation. |

**End Meeting**

| | Japanese | English | Notes |
|---|---------|---------|-------|
| OK | 会議を終了 | End Meeting | Direct, unambiguous. |
| OK | 終了 | End | Minimal label for compact contexts (toolbar icon). |
| NG | 会議をおわりにする | Finish Up | Too casual / soft. |
| NG | お疲れ様でした！終了する | Great work! End meeting | Patronizing enthusiasm. The user decides when to end. |

**Pause / Resume**

| | Japanese | English | Notes |
|---|---------|---------|-------|
| OK | 一時停止 | Pause | Standard, unambiguous. |
| OK | 再開 | Resume | Minimal, clear. |
| NG | ちょっと待って | Hold On | Anthropomorphizes the system. |
| NG | 一時的にストップ！ | Quick Pause! | Exclamation + casual register. |

### 2.2 Error Messages

**WebSocket Disconnection**

| | Japanese | English | Notes |
|---|---------|---------|-------|
| OK | WebSocket 接続が切断されました。再接続を試行中... | WebSocket connection lost. Reconnecting... | Technical, specific, shows current action. Respects developer literacy. |
| OK | 接続が中断されました。自動再接続中 (試行 3/5) | Connection interrupted. Auto-reconnecting (attempt 3/5) | Progress indicator adds transparency. |
| NG | 接続に問題が発生しました | Something went wrong with the connection | Vague. "問題が発生しました" is the canonical anti-pattern. |
| NG | おっと！接続が切れてしまいました。心配しないで！ | Oops! Lost connection. Don't worry! | Patronizing, performed warmth, undermines Competence 9. |
| NG | ネットワークエラーです | Network error | Too terse -- no actionable information, no system state. |

**Agent Not Responding**

| | Japanese | English | Notes |
|---|---------|---------|-------|
| OK | Agent "product-manager" が応答していません (60秒経過) | Agent "product-manager" not responding (60s elapsed) | Names the specific agent, provides temporal context. |
| OK | product-manager: 応答なし。タイムアウトまで残り 30秒 | product-manager: No response. Timeout in 30s | Compact, actionable, progressive. |
| NG | エージェントが応答しません | An agent is not responding | Which agent? How long? No actionable information. |
| NG | もう少しお待ちください... | Please wait a moment... | Hides the problem. Violates transparency-driven sincerity. |

**MCP Error**

| | Japanese | English | Notes |
|---|---------|---------|-------|
| OK | MCP サーバーへの接続に失敗しました (ECONNREFUSED)。サーバーが起動しているか確認してください | MCP server connection failed (ECONNREFUSED). Verify the server is running | Includes error code, suggests action. |
| OK | MCP エラー: ツール "file_read" が見つかりません | MCP error: Tool "file_read" not found | Specific tool name aids debugging. |
| NG | MCP の問題が発生しました | There was an MCP issue | Useless. What problem? What can the user do? |
| NG | MCPがうまく動いていないようです。もう一度試してみてね | MCP doesn't seem to be working. Try again! | Casual tone, performative, no technical detail. |

### 2.3 Success Messages

**Meeting Started**

| | Japanese | English | Notes |
|---|---------|---------|-------|
| OK | 会議を開始しました | Meeting started | Statement of fact. No celebration. |
| OK | 会議 "API設計レビュー" を開始しました。Agent 3名が参加中 | Meeting "API Design Review" started. 3 agents participating | Contextual confirmation -- what started, with whom. |
| NG | 会議が始まりました！楽しんでください！ | Meeting started! Enjoy! | Celebration + irrelevant enthusiasm. |
| NG | 準備完了！さあ、会議をはじめましょう！ | All set! Let's begin! | Performed warmth. The system is a tool, not a host. |

**Connection Established**

| | Japanese | English | Notes |
|---|---------|---------|-------|
| OK | 接続を確立しました | Connected | Quiet confirmation. |
| OK | WebSocket 接続確立 (ws://localhost:3001) | WebSocket connected (ws://localhost:3001) | Technical detail for developer audience. |
| NG | 接続成功！すべて順調です！ | Connected! Everything's looking great! | Over-reassurance. The user didn't ask for emotional support. |

### 2.4 Onboarding

**Welcome**

| | Japanese | English | Notes |
|---|---------|---------|-------|
| OK | cc-roundtable へようこそ。Agent Teams の議論をリアルタイムで観察できます | Welcome to cc-roundtable. Observe Agent Teams discussions in real time | One sentence explains what the product does. No exclamation. |
| OK | 会議を開始するか、進行中の会議に接続してください | Start a new meeting or connect to one in progress | Immediate actionable guidance. |
| NG | ようこそ！cc-roundtableへ！AIエージェントたちの会議をのぞいてみましょう！ | Welcome!! Peek into AI agent meetings!! | Triple enthusiasm violation. "のぞいてみましょう" is too casual and voyeuristic. |
| NG | cc-roundtableはAIが会議してくれるツールです | cc-roundtable is a tool where AI has meetings for you | "AI が〜してくれます" expression -- explicitly banned anti-pattern. Frames AI as servant, not as observed participants. |

**Feature Introduction**

| | Japanese | English | Notes |
|---|---------|---------|-------|
| OK | 左パネル: Agent 一覧と接続状態。右パネル: 会議のメッセージストリーム | Left panel: Agent list and connection status. Right panel: Meeting message stream | Spatial, descriptive, scannable. |
| OK | メッセージを入力して会議に参加できます。Agent は入力を会議コンテキストとして受け取ります | Type a message to join the meeting. Agents receive your input as meeting context | Explains the participation model clearly. |
| NG | 簡単3ステップで使えます！ | 3 easy steps to get started! | "簡単" (simple/easy) is an empty adjective. |
| NG | 直感的なインターフェースで誰でもすぐに使えます | An intuitive interface anyone can use right away | "シンプル・直感的・パワフル" anti-pattern. |

### 2.5 Empty States

**No Messages**

| | Japanese | English | Notes |
|---|---------|---------|-------|
| OK | メッセージはまだありません | No messages yet | Minimal factual statement. |
| OK | 会議が開始されると、ここにメッセージが表示されます | Messages will appear here when the meeting starts | Explains what will happen -- useful for first-time users. |
| NG | まだ何もないよ！会議を始めてみよう！ | Nothing here yet! Start a meeting! | Casual + exclamatory. Empty states should be calm. |
| NG | (イラスト付き) 静かですね... | (with illustration) It's quiet here... | Anthropomorphizes the void. No illustrations (visual-style ruling). |

**No Agent Selected**

| | Japanese | English | Notes |
|---|---------|---------|-------|
| OK | Agent が選択されていません | No agent selected | Factual. |
| OK | 会議に参加する Agent を選択してください | Select agents to join the meeting | Actionable guidance. |
| NG | Agent を選んで会議をもっと楽しくしよう！ | Pick agents to make the meeting more fun! | Gamification. Agents are not collectibles. |

### 2.6 Status Indicators

**Connection Status**

| | Japanese | English | Notes |
|---|---------|---------|-------|
| OK | 接続中 | Connected | Green dot + label. |
| OK | 切断 | Disconnected | Red/grey dot + label. |
| OK | 再接続中... | Reconnecting... | Amber dot + label with ellipsis indicating process. |
| NG | オンライン！ | Online! | Exclamation on a persistent status indicator. |
| NG | 問題あり | Issue Detected | Vague. What issue? |

**Agent Status**

| | Japanese | English | Notes |
|---|---------|---------|-------|
| OK | active | active | English technical terms for status badges are acceptable in Japanese UI context. Lowercase, consistent with developer conventions. |
| OK | completed | completed | Same rationale. |
| OK | 待機中 | idle | Japanese alternative where full localization is preferred. |
| OK | エラー | error | Status, not narrative. |
| NG | がんばっています！ | Working hard! | Anthropomorphizes agent activity. |
| NG | 作業完了しました！お疲れ様！ | Done! Great job! | Celebrates agent completion. The user evaluates quality, not the system. |

---

## 3. Communication Style Guide

### Do (やること)

1. **State facts, not feelings.** "接続を確立しました" not "接続できて嬉しいです". The system reports state; it does not have emotions.

2. **Name the specific entity.** "Agent 'ux-analyst' が応答していません" not "Agent が応答していません". Specificity is respect.

3. **Include actionable context.** Error messages should answer: What happened? What is the system doing about it? What can the user do?

4. **Use consistent terminology.** (See Section 4 for the full term system.) "会議" not "セッション" or "ルーム". "Agent" not "エージェント" or "AI".

5. **Preserve technical terms in English.** WebSocket, MCP, Agent, active, completed -- these carry precise meaning that Japanese transliteration dilutes.

6. **Write for scanning, not reading.** Button labels: 2-4 characters. Status labels: 1 word. Error messages: 1-2 sentences max. Onboarding: 1 concept per screen.

7. **Use "ですます" (polite form) for system messages in Japanese.** This sits at formality 7 -- polite without being stiff.

8. **Differentiate urgency through specificity, not punctuation.** A critical error is communicated by its content ("データ損失の可能性があります"), not by exclamation marks.

9. **Let the visual design carry emotion.** The gold accent on human messages communicates authority. The pulsing status dot communicates liveness. The copy does not need to duplicate these signals verbally.

10. **Respect the 80/20 observation ratio.** Most copy supports observation (message display, status indicators). Participation copy (input placeholder, send confirmation) should be present but never pushy.

### Don't (やらないこと)

1. **Don't use exclamation marks in UI copy.** Period. The only exception: user-facing alert dialogs for destructive actions ("この操作は取り消せません。").

2. **Don't anthropomorphize the system.** The system is an instrument, not a companion. "会議を開始しました" (Meeting started) not "会議を準備しておきました" (I've prepared the meeting for you).

3. **Don't use empty adjectives.** "シンプル", "直感的", "パワフル", "簡単" are banned. If the product is well-designed, the user knows. If it's not, no adjective fixes it.

4. **Don't celebrate.** Success messages are confirmations, not celebrations. The user's satisfaction comes from watching agents perform, not from the system congratulating them.

5. **Don't apologize performatively.** "申し訳ございません" for an error adds noise. State the problem, state the remedy.

6. **Don't use "AI が〜してくれます" framing.** The product is an observation space, not an AI servant. Agents are participants in deliberation, not helpers performing tasks for the user.

7. **Don't use casual dictionary form (辞書形) in UI labels.** "始める" is too casual. "開始" or "会議を開始" maintains formality 7.

8. **Don't add disclaimers or hedging.** "〜かもしれません" (might), "おそらく" (probably) undermine Competence 9. If the system doesn't know, say what it does know.

9. **Don't use emoji in UI chrome.** Agents may produce emoji in their messages -- that is their content, displayed faithfully. The system's own voice (buttons, labels, status, errors) never uses emoji.

10. **Don't prompt the user to participate.** "何か言ってみませんか？" (Want to say something?) violates the observation-first principle. The InputBar's presence is sufficient affordance.

11. **Don't use loading messages with personality.** "考え中..." (Thinking...) or "もう少しで完了..." (Almost done...) anthropomorphize computation. Use factual progress indicators or silence.

---

## 4. cc-roundtable Specific Copy Rules

### 4.1 Meeting Metaphor Terminology

The product uses the "meeting room" interaction metaphor. All user-facing terminology must be consistent with this metaphor.

| Concept | Correct Term (JP) | Correct Term (EN) | Incorrect Alternatives | Rationale |
|---------|-------------------|--------------------|-----------------------|-----------|
| A discussion session | 会議 | Meeting | セッション, ルーム, チャット | "会議" is the core metaphor. "セッション" is too technical/generic. "チャット" trivializes the discourse. |
| Starting a discussion | 会議を開始 | Start Meeting | セッションを作成, 会話を始める | "開始" maintains formality. "作成" implies building, not convening. |
| Ending a discussion | 会議を終了 | End Meeting | セッションを閉じる, 退出する | "終了" is definitive. "退出" implies the user leaves but the meeting continues. |
| An AI participant | Agent | Agent | エージェント, AI, ボット, アシスタント | "Agent" in English, always. Katakana "エージェント" is acceptable in flowing Japanese prose but "Agent" is preferred in UI labels. Never "ボット" or "アシスタント" -- these carry wrong connotations. |
| The user | (implicit / あなた) | You / (implicit) | ユーザー, 参加者 | The user is addressed directly or implicitly, never labeled as "ユーザー" in copy they read. |
| A message from the user | メッセージ | Message | コメント, 入力, 発言 | "メッセージ" is neutral. "コメント" implies secondary status. "発言" is too formal for the input context. |
| The discussion topic | 議題 | Topic / Agenda | テーマ, お題 | "議題" aligns with meeting metaphor. "テーマ" is too abstract. "お題" is too casual. |
| The message stream | メッセージストリーム | Message Stream | チャットログ, タイムライン | "ストリーム" captures the real-time, flowing nature. "ログ" implies historical archive. |
| Connection to the system | 接続 | Connection | リンク, 通信 | Standard technical term. |
| System health | ステータス | Status | 健全性, ヘルス | "ステータス" is widely understood. Avoid translating "health" literally. |

### 4.2 Agent Message Display Rules

Agent messages are the primary content of the product. Their display must balance fidelity with readability.

**Principle: Faithful reproduction with structural formatting.**

| Rule | Description |
|------|-------------|
| **No content modification** | Agent messages are displayed exactly as received. No summarization, truncation, or rewording. The product is an observation instrument -- it does not editorialize. |
| **Markdown rendering** | Agent messages that contain Markdown (headers, lists, code blocks, bold/italic) are rendered as formatted text. This aids scannability without altering content. |
| **Code block syntax highlighting** | Code within agent messages receives syntax highlighting appropriate to the detected language. This is a display enhancement, not content modification. |
| **Agent identification** | Each message shows the agent's role name (e.g., "product-manager") with their assigned color as a 3px left border. Agent names use the display font (General Sans) at font-weight 600. |
| **Timestamp display** | Messages display relative timestamps ("2分前", "just now") that resolve to absolute on hover. Same-minute messages from the same agent are grouped under one timestamp. |
| **Long message handling** | Messages exceeding 80 lines are collapsed after line 20 with "... 残り 60行を表示" (Show remaining 60 lines). This prevents a single verbose agent from dominating the visual space while preserving content access. |

### 4.3 Human Message Display Rules

Human messages receive distinct visual treatment to reinforce the user's authority (the "conductor" identity).

| Rule | Description |
|------|-------------|
| **Gold accent treatment** | Human messages receive the burnished gold (#D4A847) left border, distinct from all agent colors. |
| **Visual weight** | Human messages may have slightly elevated surface treatment (surface-raised level) to distinguish from agent messages in the stream. |
| **Label** | Human messages are labeled "You" (EN) or "あなた" (JP), or the user's configured display name. Never "Human" or "ユーザー". |
| **InputBar placeholder** | "会議にメッセージを送信..." (Send a message to the meeting...) -- positions the user as addressing the meeting, not individual agents. The placeholder uses text-muted color. |
| **Send confirmation** | No toast or notification on send. The message appearing in the stream IS the confirmation. Inline, not modal. |

### 4.4 System Message Tone

System messages are the product's own voice -- status changes, errors, confirmations. These must be the most disciplined copy in the product.

| Category | Tone | Format | Example (JP) | Example (EN) |
|----------|------|--------|--------------|--------------|
| **State change** | Neutral, factual | "[Subject] [verb/state]" | Agent "ux-analyst" が会議に参加しました | Agent "ux-analyst" joined the meeting |
| **Error** | Direct, specific, actionable | "[What happened]. [Current action / user action]" | Daemon プロセスが停止しました。再起動してください | Daemon process stopped. Please restart |
| **Connection** | Technical, progressive | "[Component] [state] ([detail])" | WebSocket 接続確立 (ws://localhost:3001) | WebSocket connected (ws://localhost:3001) |
| **Informational** | Minimal, contextual | "[Fact]" | 会議時間: 15分経過 | Meeting duration: 15 min elapsed |

**System message formatting rules:**
- System messages appear inline in the message stream, not as floating toasts (unless critically urgent)
- Use a distinct visual treatment: centered text, muted color (text-muted / #94B3CE), smaller font size (font-size-sm / 12px)
- No sender avatar or color border -- system messages have no "identity"
- Connection state changes may also update the persistent status indicator in the header, providing redundant but non-intrusive feedback

### 4.5 InputBar Copy Rules

The InputBar is the single participation affordance. Its copy must be calm, inviting, and never pushy.

| Element | Copy (JP) | Copy (EN) | Notes |
|---------|-----------|-----------|-------|
| **Placeholder (default)** | 会議にメッセージを送信... | Send a message to the meeting... | Addresses "the meeting" as a collective, reinforcing the roundtable metaphor. |
| **Placeholder (no meeting)** | 会議を開始してください | Start a meeting to begin | Factual instruction when no meeting is active. |
| **Placeholder (disconnected)** | 接続されていません | Not connected | State, not instruction. Input is disabled in this state. |
| **Send button** | 送信 | Send | Or: arrow icon only (no text) in compact mode. |
| **Character limit warning** | (none) | (none) | No artificial limit. Users are developers writing to AI agents -- don't constrain them. |

---

## 5. Voice Consistency Verification

Cross-referencing the voice against all locked design variables to ensure alignment.

| Design Variable | Voice Alignment |
|-----------------|-----------------|
| Archetype: Sage + Explorer | Voice is observational and precise (Sage). Copy for empty states and onboarding carries quiet curiosity (Explorer): "Messages will appear here when the meeting starts" implies anticipation without excitement. |
| Competence 9 | Voice never hedges, guesses, or softens technical information. Error messages include error codes. Status is unambiguous. The voice IS competent -- it knows exactly what the system is doing and reports it without filler. |
| Sophistication 8 | Voice achieves sophistication through craft and restraint: no wasted words, no redundant phrases, considered word choices (会議 not チャット, 議題 not テーマ). Sophistication is the difference between "接続を確立しました" and "接続完了！準備OK！". |
| Sincerity 5 (transparency) | Voice displays system state openly. Connection attempts show count (3/5). Agent non-response shows elapsed time (60秒経過). No information is hidden or sugar-coated. |
| Excitement 6 (temporal) | Voice is calm; excitement is carried by the medium (streaming messages, live status). The voice's job is to frame and label, not to generate energy. |
| Ruggedness 3 | Voice has no rough, industrial, or raw quality. It is refined and measured. |
| Formality 7 | "ですます" form in Japanese. Professional English. No slang, no corporate jargon. |
| Cultural context: Japanese | Technical terms in English (Agent, WebSocket, MCP). UI labels in Japanese where natural. Mixed-language copy follows Japanese grammatical structure with English nouns inlined. |
| Design Tension: "Scholarly but alive" | The scholarly pole is expressed through the voice's precision, restraint, and measured register. The alive pole is NOT expressed through the voice -- it is carried by the real-time content stream and visual dynamism. The voice is the calm frame; the content is the motion. |

---

## 6. Copy Decision Framework

When writing new UI copy for cc-roundtable, apply these filters in order:

1. **Is it necessary?** If removing this text would not reduce comprehension, remove it.
2. **Is it factual?** If it contains opinion, emotion, or evaluation, rewrite as fact.
3. **Is it specific?** If it could apply to any product, rewrite to be specific to what is happening right now.
4. **Is it scannable?** If it takes more than 2 seconds to parse, shorten it.
5. **Does it respect the user?** If it explains something obvious, assumes ignorance, or performs warmth, remove the offending part.
6. **Does it maintain the meeting metaphor?** If it uses chat/session/room language, replace with meeting vocabulary.
7. **Would a conductor find it appropriate?** The user is orchestrating an AI ensemble. The copy should match the composed authority of that role.

---

## Appendix: Phase 1-2 Cross-References

This tone-of-voice document is built on and must remain consistent with:

- **brand-foundation.md**: Archetype (Sage/Explorer), personality scores, design principles, design tension
- **user-psychology.md**: Emotional needs (orchestration pride, control anxiety), trust signals, anti-patterns
- **competitor-analysis.md**: Competitive positioning ("Composed x Medium-minimal"), differentiation from "builder/IDE/debugger" framing
- **critique.md (Gate 1)**: Moderator resolutions on typography, metaphor, accent colors
- **critique.md (Gate 2)**: Phase 3 handoff directives (formality 7, measured voice, error message style, empty state restraint, Japanese-first)
- **color-palette.md**: Human message gold accent (#D4A847), agent identity colors, surface/text color system
- **typography.md**: General Sans display font, uppercase label tracking, strict weight hierarchy
- **visual-style.md**: Message bubble specification (3px left border), system message styling, animation restraint
