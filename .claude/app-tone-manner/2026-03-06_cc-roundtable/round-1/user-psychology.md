# User Psychology Analysis: cc-roundtable

Author: user-psychologist
Date: 2026-03-06
Status: Round 1 / Phase 1C

---

## 1. Persona Attributes -> Design Variable Mapping

### 1.1 Cognitive Style: Analytical-Dominant with Pattern-Seeking

Target users are software engineers aged 20-40 who use Claude Code daily. Their cognitive processing is **strongly analytical** but with a significant appetite for **visual pattern recognition**.

**Key characteristics:**

- **Information scanning, not reading**: Engineers scan for structure -- headings, code blocks, timestamps, sender names. They do not read chat messages linearly. Design must support rapid scanning with strong visual hierarchy.
- **Mental model: "system observability"**: These users think of AI agent conversations the same way they think of logs, metrics dashboards, or CI/CD pipelines. The mental model is *monitoring a distributed system*, not *chatting with friends*.
- **Pattern matching over decoration**: They seek signal-to-noise ratio. Every visual element must carry information. Decorative elements that don't convey state are perceived as clutter.
- **Code-literate visual grammar**: Monospace text, diff coloring (green/red), status indicators (green dot = active, grey = idle) are already deeply wired. Lean into these conventions rather than inventing new ones.

**Design implication**: The UI should feel like a **high-end observability dashboard** (think Grafana, Linear, or Vercel's deployment logs) rather than a consumer chat app (Slack, Discord). Information density should be high, but structured -- not overwhelming.

### 1.2 Work Context: IDE-Adjacent, Extended Use

Users run cc-roundtable **alongside their IDE** (VS Code, Cursor, terminal). This is not a full-screen app; it occupies one portion of a multi-monitor or split-screen setup.

**Implications:**

- **Eye fatigue**: Dark theme is essential. The current dark navy (#071019) is a strong foundation -- pure black (#000) causes more eye strain than deep navy/charcoal.
- **Peripheral awareness**: Users glance at the app intermittently, not stare at it. New messages must be noticeable in peripheral vision -- subtle animation or color shift, not intrusive notifications.
- **Compact density**: The app competes for screen real estate with IDE, terminal, and browser. Every pixel must earn its place. Generous whitespace is a luxury this context cannot afford -- but *structured density* (clear grid, consistent spacing) prevents visual chaos.
- **Font size**: 13-14px body text minimum. Engineers often have high-resolution displays but run them at native resolution. Smaller than 13px becomes unreadable in peripheral use.

### 1.3 Emotional Needs: The Psychology of "Observing AI Deliberation"

This is the most unique aspect of cc-roundtable's UX. Users are **watching AI agents discuss and debate in real time**. This triggers several psychological states:

#### a) Curiosity & Intellectual Voyeurism
The primary emotional draw is **curiosity** -- "What are they saying? Are they making good points? Will they arrive at the right conclusion?" This is similar to watching a live strategy discussion or a panel debate. The design should foster this by making agent identities distinct (differentiated visual treatment per agent) and making the conversation flow easy to follow.

#### b) Control Anxiety ("Am I needed? Should I intervene?")
Users experience tension between wanting to observe passively and feeling they *should* contribute. If the agents are heading in the wrong direction, the user needs confidence that their intervention will be received and acted upon. The **InputBar must feel authoritative** -- not like shouting into a void.

**Design solution**: When the user sends a message, it should have a visually distinct treatment that signals "this message has weight." A different border color, a slight glow, or a human-specific avatar distinguishes human input from agent chatter and reinforces agency.

#### c) Pride & Orchestration Satisfaction
Users experience a unique satisfaction from **having set up the meeting and watching it work**. This is the "conductor" feeling -- you defined the topic, chose the agents, and now they're performing. The design should subtly reinforce this by keeping the meeting topic and user's role visible, and by showing agent status (active/completed) as a sign that the system is functioning as designed.

#### d) Anxiety About Reliability ("Is it actually working?")
Because the system involves WebSocket connections, daemon processes, and multiple Claude instances, there's persistent low-level anxiety about whether things are functioning. The **ConnectionStatus and health indicators are psychologically critical** -- they serve as the user's "heartbeat monitor." These must be always-visible, compact, and unambiguous.

### 1.4 Trust Formation: What Makes Developers Trust a Tool

Developers form trust through **transparency, predictability, and competence signals**:

| Trust Signal | Visual Element | Priority |
|---|---|---|
| **Transparency** | Show system state openly -- connection status, agent activity, message delivery confirmation | Critical |
| **Predictability** | Consistent layout, no surprising UI shifts, messages appear in chronological order without jumping | Critical |
| **Competence** | Clean typography, no broken layouts, fast rendering, no lag between message receipt and display | High |
| **Craftsmanship** | Subtle details -- proper code syntax highlighting, timestamp formatting, smooth scrolling | Medium |
| **Restraint** | No unnecessary animations, no gamification, no "fun" loading messages -- this is a professional tool | High |

**Anti-patterns that destroy developer trust:**
- Loading spinners that last more than 200ms without explanation
- "Cute" error messages (e.g., "Oops! Something went wrong")
- Rounded, bubbly UI that feels like a consumer app
- Inconsistent spacing or alignment
- Visual noise that doesn't map to system state

---

## 2. Design Variable Proposals

### Variable #35: formality_level = 7

**Rationale**: The app occupies a space between "professional enterprise tool" (formality 9-10) and "developer-friendly modern SaaS" (formality 5-6). It should feel serious and capable -- this is a tool for orchestrating AI systems, not a toy. But it should not feel corporate or stiff.

A formality level of 7 means:
- Professional typography with personality (the current Serif choice is bold and distinctive -- formality 8+. A slight adjustment toward a clean sans-serif or a monospace hybrid might bring this to 7)
- Structured layout with clear hierarchy
- No emoji in UI chrome (but agents may use them in messages)
- Understated color palette with intentional accent usage
- Labels and buttons use clear, direct language (not corporate jargon, not slang)

The "roundtable" metaphor itself sits at about 7 -- it implies serious deliberation but not boardroom formality. The tool should feel like a well-designed war room or a research lab's monitoring station.

### Variable #38: target_age_primary = millennial

**Rationale**: The 20-40 age range spans late Gen-Z (20-28) and core millennial (29-40). However, the **primary** target skews millennial because:

1. **Claude Code adoption profile**: Users who orchestrate multi-agent AI teams are likely mid-career developers with enough experience to appreciate the value of AI collaboration -- more likely 28-38 than 22-25.
2. **Design aesthetic preference**: Millennials in tech gravitate toward clean, minimal interfaces (Linear, Raycast, Arc Browser) rather than the more expressive/maximalist aesthetics of Gen-Z (gradient-heavy, neo-brutalism, playful illustration).
3. **Professional context**: Using AI agent teams implies working on complex projects, which correlates with more experienced developers.

Gen-Z developers are a secondary audience and should not be excluded -- but the primary aesthetic should be the "millennial developer" taste: minimal, functional, dark-themed, with craft in the details.

### Variable #39: cultural_context = japanese

**Rationale**: The current UI is Japanese-first (all labels are Japanese: "会議を開始", "一時停止", "会議終了"). The project creator's environment is Japanese macOS. While the tool concept is globally relevant, the **primary cultural context is Japanese developer culture**.

This has specific design implications:

- **Information density tolerance**: Japanese users are accustomed to higher information density than Western users (compare Japanese web design norms). The "cramped" concern of Western design sensibility doesn't fully apply -- structured density is culturally natural.
- **Typography**: Japanese text requires specific consideration. Serif fonts for Japanese (Hiragino Mincho) read as "classical/literary" which is distinctive but may feel incongruent with a tech monitoring tool. Gothic/sans-serif (Hiragino Kaku Gothic, Noto Sans JP) is the norm for technical interfaces.
- **Aesthetic vocabulary**: Japanese developer culture appreciates "craftsman" aesthetics -- think monozukuri applied to software. Clean lines, intentional negative space (ma), subtle gradients over flat colors. The current dark navy + translucent layers approach aligns well with this.
- **Restraint over expressiveness**: Japanese design culture values understatement. Avoid overly loud accent colors or attention-grabbing animations. The current cyan (#7af5dc) and golden yellow (#ffdd95) accents are well-calibrated -- present but not shouting.

**Note on localization**: If the app expands to English-speaking markets, the cultural context shifts to "global" but the foundational design choices (density, restraint, craft) translate well internationally. Japanese-first design often needs less adjustment going global than the reverse.

### Variable #40: accessibility_level = wcag-aa

**Rationale**: WCAG-AA is the appropriate baseline for this tool, not WCAG-AAA, because:

1. **User base**: Tech-literate users on modern hardware with good displays. The extreme accommodations of AAA (7:1 contrast ratio for all text) would constrain the dark-theme aesthetic unnecessarily.
2. **Contrast requirements**: AA requires 4.5:1 for normal text and 3:1 for large text. The current palette (light blue #d6ecff on dark navy #071019) achieves approximately 12:1 contrast -- well above AA. The subtle text (#8fb7d4 on #071019) is approximately 5.5:1 -- also AA-compliant.
3. **Focus indicators**: AA requires visible focus indicators. The current CSS lacks explicit `:focus` styles -- this needs attention regardless of which level is chosen.
4. **Keyboard navigation**: The app's chat interface must be keyboard-navigable (Tab through messages, Enter to send). AA is sufficient to ensure this.
5. **Color-only information**: Agent status (active/completed) currently uses color alone. AA requires non-color indicators -- add text labels or icons alongside color coding. The current implementation already includes text labels ("active", "completed"), which is good.

**Specific accessibility gaps to address:**
- Add `:focus-visible` styles for all interactive elements
- Ensure the terminal pane (xterm.js) has adequate contrast
- Provide `aria-live="polite"` on the chat view for screen reader users who want to hear new messages
- Consider `prefers-reduced-motion` media query for any future animations

---

## 3. Age/Cultural Context Impact Analysis

### 3.1 Millennial/Gen-Z Developer Visual Preferences

**Shared preferences (both cohorts):**
- Dark mode as default (non-negotiable)
- Clean sans-serif or monospace typography
- Minimal chrome -- content over decoration
- Flat or very subtle shadows (no skeuomorphism)
- Status communicated through color and iconography, not text-heavy alerts

**Millennial-specific tendencies (primary target):**
- Value "taste" and "craft" -- notice kerning, spacing, color harmony
- Prefer monochromatic palettes with 1-2 accent colors
- Influenced by: Linear, Vercel, Raycast, Notion, Arc Browser
- Associate quality with restraint -- "less is more"
- Comfortable with information density if well-organized

**Gen-Z-specific tendencies (secondary target):**
- More receptive to personality and expression in UI
- Appreciate subtle gradients, glassmorphism, animated transitions
- Influenced by: Discord, Figma, Cursor, v0.dev
- May find overly austere interfaces "boring" or "cold"
- Expect micro-interactions (hover effects, transitions)

**Design recommendation**: Target the overlap. A clean, dark-themed interface with **subtle glassmorphism** (the current semi-transparent backgrounds do this well) and **one or two micro-interactions** (message appearance animation, status transitions) satisfies both cohorts without alienating either.

### 3.2 Japanese vs. Global Design Sensibility

| Dimension | Japanese Developer | Global Developer | cc-roundtable Recommendation |
|---|---|---|---|
| Information density | High tolerance; scan-heavy | Moderate; prefer whitespace | Lean toward high density with clear structure |
| Color meaning | Red = danger/stop, green = success | Same, but less nuanced | Standard semantic colors; add Japanese-influenced muted tones |
| Typography priority | Readability over personality | Personality acceptable | Gothic/sans-serif for Japanese text; allow personality in English-only headings |
| Emotion in UI | Understated, implicit | More explicit (emoji, illustration) | Keep understated; let content carry emotion |
| Error handling | Polite, specific, actionable | Can be casual | Direct but respectful ("MCP接続に失敗しました。再試行してください。") |
| "Cool" factor | Craft, precision, technical elegance | Bold, novel, distinctive | Technical elegance -- the "well-engineered" feel |

### 3.3 What Developers Find "Cool" (Developer Aesthetic)

The developer community has a remarkably consistent aesthetic sensibility, heavily influenced by tools they use daily:

**Currently "cool" in developer tooling (2025-2026):**
1. **Terminal-native aesthetic**: Dark backgrounds, monospace text, subtle grid patterns. Think: GitHub's Monaspace font, WezTerm, Ghostty terminal.
2. **Ambient glows**: Soft color bleeds behind elements (the current radial gradients in body background align with this).
3. **Semantic density**: Dense but organized information -- Linear's issue tracker, Vercel's deployment dashboard.
4. **Muted palettes with vivid accents**: Mostly greys/dark blues with one or two vivid accent colors that draw the eye to what matters.
5. **Motion with purpose**: Transitions that communicate state change (element appearing = new data), not decoration.

**Not cool / dated:**
- Skeuomorphic shadows or gradients
- Rainbow/multi-color palettes
- Rounded "friendly" UI (Slack-style bubbles)
- Animated illustrations or mascots
- Excessive use of icons where text suffices

**cc-roundtable's current position**: The existing dark navy + translucent layer approach is well-positioned. The Serif font choice (Iowan Old Style) is the most distinctive and potentially polarizing element -- it signals "intellectual" and "literary" which is unique in the developer tool space but may feel incongruent to some users who expect sans-serif/monospace in technical tools.

---

## 4. "Observing a Meeting" Experience: Design Psychology

### 4.1 Bystander Effect vs. Participation Prompting

The **bystander effect** in this context means: "The agents are discussing fine on their own, so I don't need to contribute." This can be positive (the user relaxes and observes) or negative (the user misses a chance to correct course).

**Design strategies to balance observation and participation:**

| Strategy | Implementation | Psychological Mechanism |
|---|---|---|
| **Visible input affordance** | InputBar always visible at bottom, never hidden behind a toggle | Reduces friction to participation; constant reminder that input is possible |
| **Input confirmation feedback** | Human message appears instantly with distinct styling; agent acknowledgment shows within seconds | Reinforces that input "matters" and is received |
| **No explicit "join" barrier** | User doesn't need to click "join meeting" -- they're always a participant by default | Removes psychological barrier to first message |
| **Conversation pause awareness** | If agents pause for >30s, subtle indicator ("Agents are thinking...") | Prevents user from thinking the system is broken; natural pause for user to interject |
| **Topic drift detection** | When conversation diverges from original topic, subtle visual cue | Prompts user to redirect if needed |

**What NOT to do:**
- Don't prompt the user to speak ("It's been 2 minutes since you last said something!")
- Don't add a "raise hand" metaphor -- it implies permission is needed
- Don't dim or collapse the InputBar when agents are actively talking

### 4.2 Cognitive Load of Real-Time Information

Real-time chat from multiple agents creates significant cognitive load. Key factors:

**Message arrival rate**: During active discussion, agents may send 3-5 messages per minute. At this rate, users can keep up through scanning. If rate exceeds 8-10 messages per minute, consider:
- Auto-collapsing older messages
- Grouping rapid exchanges into a "thread" view
- Slowing scroll to let users catch up

**Sender differentiation**: The brain's ability to track conversation depends on distinguishing speakers. Current implementation uses text labels -- this is minimum viable. **Color-coding per agent** (subtle left-border or background tint) dramatically reduces cognitive load by allowing pre-attentive processing. Users can see "the blue agent spoke, then the green one replied" without reading names.

**Content scanning**: Agent messages often contain structured content (lists, code, analysis). The Markdown rendering is crucial -- well-formatted messages are scannable; plain text walls are not.

**Recommended cognitive load mitigations:**
1. **Per-agent color accent**: Assign a subtle, unique color to each agent's messages (left border or avatar)
2. **Auto-scroll with smart pause**: Auto-scroll to newest message, but pause if user has scrolled up
3. **Message timestamp grouping**: Group messages within same minute under a single timestamp header
4. **Compact mode option**: Allow toggling between full messages and a condensed view (sender + first line)

### 4.3 Making Agents Feel Like "Participants" (Not Machines)

The design challenge: make agents feel like distinct participants in a meeting without pretending they're human. The "uncanny valley" of AI interfaces means overdoing anthropomorphism feels creepy, while underdoing it makes messages feel like log output.

**Elements that create "personality" without deception:**

| Element | Effect | Risk Level |
|---|---|---|
| **Distinct name/role** | "product-manager", "ux-analyst" -- already implemented | Low risk, high value |
| **Consistent color per agent** | Creates visual identity, aids tracking | Low risk, high value |
| **Avatar (geometric/abstract)** | Differentiates agents visually without implying humanity | Low risk if abstract |
| **Typing indicator** | Shows agent is "thinking" -- creates conversational rhythm | Medium risk -- may feel artificial |
| **Emoji in agent messages** | Agents may naturally use emoji in content; let this through | Low risk |
| **Human-like avatars/photos** | Implies agents are people | High risk -- avoid |
| **Personality in agent names** | "Kenji the PM" vs "product-manager" | Medium risk -- may feel forced |

**Recommended approach**: Use **abstract, geometric avatars** (colored circles, initials, or simple icons) with consistent per-agent colors. This creates identity and trackability without anthropomorphism. The agent's role name (e.g., "product-manager") already provides enough personality through its function.

**The "round table" metaphor itself helps**: By framing the experience as a "meeting room" or "roundtable," the app pre-establishes that these are participants in deliberation. The user's mental model naturally grants agents "participant" status within this metaphor. The design should reinforce the metaphor through spatial arrangement (all messages in one stream, like sitting around a table) rather than the separated columns of typical chat apps.

---

## 5. Summary: Design Variable Recommendations

| # | Variable | Proposed Value | Confidence | Rationale Summary |
|---|---|---|---|---|
| 35 | formality_level | 7 | High | Professional yet approachable; "well-engineered monitoring tool" feel |
| 38 | target_age_primary | millennial | High | Core Claude Code power users are 28-38; aesthetic matches millennial dev tools |
| 39 | cultural_context | japanese | High | Japanese-first UI, Japanese creator, but design choices export well globally |
| 40 | accessibility_level | wcag-aa | High | Appropriate for tech-literate audience; current palette already compliant |

---

## 6. Key Psychological Insights for Other Workstreams

For **brand-strategist**: The core emotional experience is **"orchestration pride"** -- the satisfaction of conducting an AI ensemble. The brand should evoke mastery and command, not friendliness or playfulness.

For **competitor-analyst**: The closest UX analogues are **observability dashboards** (Grafana, Datadog) and **collaborative dev tools** (Linear, GitHub Projects) -- not chat apps. Competitive positioning should target this intersection.

For **identity-critic**: The highest-risk design decision is the **Serif typography** choice. It's distinctive but may conflict with the "technical monitoring" mental model. This deserves specific scrutiny in Gate 1.

---

## 7. Post-Discussion Refinements (Round 1 Debate)

### 7.1 Orchestration Pride vs. Scholarly Observation: Layering Clarified

Following competitor-analyst's challenge, the relationship between these two psychological states is now more precisely defined:

- **"Orchestration pride"** is the **motivational** layer -- WHY users open the app. They set up agents, defined the topic, and want to see their ensemble perform. This dominates during the **setup phase** and **intervention moments** (~20% of session time).
- **"Scholarly observation"** is the **experiential** layer -- WHAT users do once the app is open. They read, follow arguments, track positions, and comprehend. This dominates during the **observation phase** (~80% of session time).

**Design implication**: Since users spend 80% of time in scholarly observation mode, the **surface layer should be optimized for reading and comprehension** (chat view, message rendering, conversation flow). The orchestration layer (status indicators, health cards, controls) should be **present but secondary, revealed progressively**.

This maps to brand-strategist's "Layered" design principle:
- Layer 1 (surface): Scholarly reading experience -- clean, legible, conversation-focused
- Layer 2 (infrastructure): Orchestration controls -- status, health, agent management

**Reference model refinement**: Linear's issue detail view is a better visual reference for the primary content area than Grafana. Linear achieves density + readability for structured text content. Grafana remains a good reference for Layer 2 (status/health indicators).

### 7.2 Excitement Quality: Temporal, Not Energetic

Converged with competitor-analyst's refinement: cc-roundtable's Excitement (scored 5-6) is **temporal** (live, unfolding, unpredictable content) not **energetic** (vivid colors, bold animations, stimulating visuals). This distinction prevents downstream design agents from expressing "excitement" through visual intensity. The excitement comes from the content stream, not the container.

### 7.3 Sincerity Annotation

Sincerity at 5 is maintained but annotated: **"transparency-driven sincerity, not warmth-driven sincerity."** The product's sincerity is structural (showing exactly what agents say) rather than styled (performing warmth through design). This prevents the score from being misinterpreted as a directive to "make the UI warmer/softer."

### 7.4 Color Convergence

Cross-team consensus emerged on accent color strategy:
- **Primary accent**: Refined teal/cyan (evolving current #7af5dc) -- distinctive competitive position, no overlap
- **Secondary accent**: Warm gold (#C9A856 to #D4AF37 range) -- reads as "premium/refined" not "warning"
- **Background warmth**: Shift from cold navy toward subtly warm dark tones -- warmth through environment, not accents
- **Rejected**: Amber/orange as primary accent due to warning-color cognitive interference in developer contexts
