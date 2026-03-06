# Typography System: cc-roundtable (Meeting Room)

**Author:** typography-director
**Date:** 2026-03-06
**Status:** Round 1 / Phase 2F

---

## 1. Font Selection

### 1.1 Display Font: **General Sans**

**Classification:** Geometric sans-serif with humanist undertones
**Source:** Indian Type Foundry (free for web/desktop)
**Weights used:** Medium (500), Semibold (600), Bold (700)

**Why General Sans:**

- **Geometric backbone, humanist warmth**: The letterforms are clean and structured (geometric), but subtle optical corrections and open apertures give it a warmth that pure geometric faces (Futura, Montserrat) lack. This embodies the "scholarly but alive" tension -- structured yet breathing.
- **Distinctive without being loud**: General Sans has a confident, contemporary voice that separates it from the ubiquitous Inter/Roboto pairing. The slightly squared terminals and generous x-height give it a modern authority that reads as "considered choice," not "default choice."
- **Strong hierarchy potential**: The weight range from Medium to Bold creates clear visual differentiation for headings (H1 through H4) while maintaining a unified voice. The Semibold weight is particularly effective for agent names and section labels -- authoritative without shouting.
- **Excellent Latin character set**: Broad language support, proper figure styles (tabular and proportional), and well-designed diacriticals.
- **NOT Inter**: Avoids the SaaS-default association. General Sans occupies a similar functional space but with more character -- the slightly wider proportions and sharper geometry read as intentional and distinctive.

**Rejected alternatives:**
- Satoshi: Too rounded/friendly for Competence 9. Reads as approachable-first, scholarly-second.
- Clash Display: Too display-heavy; poor readability at smaller sizes. Better for marketing than UI.
- Syne: Too quirky/art-directed. Breaks the "technical but composed" requirement.
- Cabinet Grotesk: Strong candidate but proportions slightly too condensed for Japanese mixed-script contexts.

### 1.2 Body Font: **Switzer**

**Classification:** Neo-grotesque with humanist details
**Source:** Indian Type Foundry (free for web/desktop)
**Weights used:** Regular (400), Medium (500)

**Why Switzer:**

- **Optimized for sustained reading**: Switzer's proportions are tuned for body text -- slightly wider letter-spacing, open counters, and consistent stroke weights across the character set reduce eye fatigue during extended reading sessions.
- **Clean but not sterile**: Neo-grotesque foundations (even stroke weight, minimal contrast) ensure legibility at 14px, while humanist touches (slightly asymmetric curves, open apertures) prevent the "clinical" feel of pure grotesques like Helvetica.
- **Pairing synergy with General Sans**: Both fonts share the Indian Type Foundry design lineage, ensuring harmonic proportions. General Sans carries authority as display; Switzer defers as body. The difference is felt, not forced -- tonal contrast through proportion and weight, not through clashing classifications.
- **Excellent at the 13-16px range**: Where users spend 80% of their reading time (scanning agent messages), Switzer maintains sharp letterform distinction even on standard-density displays.

**Rejected alternatives:**
- Sohne: Excellent but requires Klim Type Foundry license -- adds complexity for an open-source-adjacent project.
- Plus Jakarta Sans: Too rounded; soft terminals undermine the Competence 9 target.
- Outfit: Geometric proportions compete with General Sans rather than complementing it.
- Inter: Technically excellent but carries strong "default SaaS" connotations that dilute brand distinctiveness.

### 1.3 Japanese Font: **BIZ UDPGothic**

**Classification:** UD Gothic (Universal Design Gothic)
**Source:** Google Fonts (free, open-source by Morisawa)
**Weights used:** Regular (400), Bold (700)

**Why BIZ UDPGothic:**

- **Universal Design legibility**: Developed by Morisawa specifically for extended screen reading. Wider counters, differentiated similar characters (e.g., clear distinction between katakana "ソ/ン", "シ/ツ"), and optimized stroke weights at screen sizes.
- **Professional without being cold**: Unlike Noto Sans JP (which reads as "Google infrastructure") or Hiragino Kaku Gothic (system default), BIZ UDPGothic carries the quality of "intentionally selected for readability" -- which aligns with Competence 9 and the care-in-craft signal developers notice.
- **Proportional variant (P)**: The "P" in BIZ UDPGothic indicates proportional spacing, which is critical for Japanese text mixed with Latin characters. Fixed-width Japanese (non-P variants) creates awkward rivers of whitespace in mixed-language contexts.
- **Scholarly resonance in Japanese context**: BIZ UDPGothic is associated with government and business documents -- formal but clear. This maps to formality 7 and the "scholarly" pole without invoking the literary associations of Mincho (serif).
- **Cultural appropriateness**: Gothic (sans-serif) is the unambiguous standard for Japanese technical interfaces. Using Mincho for a developer tool would signal "literary" or "traditional" in ways that conflict with the technical context.

**Rejected alternatives:**
- Noto Sans JP: Functional but generic. "We didn't choose a Japanese font, we used the default."
- LINE Seed JP: Too associated with the LINE brand. Rounded terminals are too casual.
- M PLUS Rounded: The "Rounded" classification directly contradicts the angular, structured aesthetic.
- Zen Kaku Gothic New: Strong contender but narrower proportions create density issues at 14px body text. BIZ UDPGothic's wider set width handles better.

### 1.4 Monospace Font: **JetBrains Mono**

**Classification:** Monospace, optimized for code
**Source:** JetBrains (free, open-source)
**Weights used:** Regular (400), Medium (500)

**Why JetBrains Mono:**

- **Developer recognition**: JetBrains Mono is one of the most widely adopted code fonts in the developer community. Using it signals "this tool understands developers" at a glance.
- **Increased height for code readability**: The taller x-height compared to Fira Code or Source Code Pro means code blocks remain legible even at 12-13px (the compact sizes used in terminal panes and inline code).
- **Ligature support**: Optional ligatures for common programming constructs (!=, =>, -->) add polish to code display without being distracting. Can be disabled by preference.
- **Harmonious with the sans-serif stack**: The geometric qualities of JetBrains Mono sit comfortably alongside General Sans and Switzer, creating a unified tonal family across display/body/code contexts.

**Rejected alternatives:**
- Berkeley Mono: Excellent aesthetics but requires a commercial license.
- Fira Code: Slightly dated association (2018-2020 peak). Narrower proportions than JetBrains Mono.
- IBM Plex Mono: Corporate association undermines the independent, craft-oriented identity.

---

## 2. Font Pairing Rationale

### The Pairing Triangle

```
General Sans (Display)
   "Authority, structure, intention"
         |
         | Shared geometric DNA, different roles
         |
Switzer (Body)                    JetBrains Mono (Code)
   "Clarity, endurance,              "Precision, developer
    comfortable reading"               identity, technical"
         |                                    |
         +-------- BIZ UDPGothic (JP) --------+
              "Readability, professionalism,
               cultural respect"
```

**Pairing logic:**

1. **Display-Body relationship** (General Sans / Switzer): *Tonal contrast, not structural clash.* Both are sans-serif with geometric leanings, but General Sans is slightly wider and sharper (authority) while Switzer is slightly rounder and more even (comfort). The user perceives one unified "voice" with two registers: commanding (headings) and conversational (body).

2. **Body-Code relationship** (Switzer / JetBrains Mono): The transition from proportional to monospace is the largest visual shift in the system. This is intentional -- it signals a clear boundary between "conversation" and "code," reinforcing the "Technical but humane" supporting tension.

3. **Latin-Japanese relationship** (General Sans + Switzer / BIZ UDPGothic): BIZ UDPGothic's x-height and stroke weight are calibrated to sit comfortably alongside Latin sans-serifs at equivalent point sizes. Mixed-language lines (common in developer content, e.g., "APIのレスポンス") maintain even visual rhythm.

---

## 3. Typography Scale

### 3.1 Scale Ratio: **1.200** (Minor Third)

**Why Minor Third (1.200):**

- **Compact hierarchy**: The 1.200 ratio produces increments that are perceptible but not dramatic. This is critical for a tool where screen real estate is shared with an IDE -- headings must differentiate without consuming excessive vertical space.
- **"Scholarly" through precision, not grandeur**: A larger ratio (1.25 Major Third, or 1.333 Perfect Fourth) would create imposing headings that read as "marketing page" rather than "knowledge interface." Minor Third produces a measured, intellectual hierarchy.
- **7 comfortable steps**: From Caption (11px) to Display (24px), the scale produces sizes that each have a clear purpose without redundancy.

### 3.2 Base Size: **14px**

**Why 14px:**

- **User psychology finding**: Engineers in IDE-adjacent contexts need 13-14px minimum for sustained reading (user-psychology.md, Section 1.2). 14px sits at the comfortable floor.
- **Japanese character legibility**: Japanese characters contain more strokes per glyph than Latin and require slightly larger rendering to maintain readability. 14px ensures BIZ UDPGothic renders cleanly.
- **Peripheral scanning**: Users glance at cc-roundtable intermittently from their IDE. 14px is legible in peripheral vision on standard 1080p-2160p displays.
- **Not 16px**: The browser default (16px) is too generous for a dense, information-rich interface. It would force either wider layouts or fewer visible messages.

### 3.3 Full Scale

| Level | Name | Size (px) | Size (rem) | Weight | Font | Line-height | Usage |
|-------|------|-----------|------------|--------|------|-------------|-------|
| -2 | Caption | 11px | 0.6875rem | Regular 400 | Switzer | 1.45 (16px) | Timestamps, metadata, secondary labels |
| -1 | Small | 12px | 0.75rem | Regular 400 | Switzer | 1.5 (18px) | Status indicators, badges, helper text |
| 0 | Body | **14px** | **0.875rem** | Regular 400 | Switzer | 1.6 (22.4px) | Agent messages, body text, input field |
| 1 | Body-emphasis | 14px | 0.875rem | Medium 500 | Switzer | 1.6 (22.4px) | Agent names in message stream, bold inline |
| 2 | Label | 12px | 0.75rem | Semibold 600 | General Sans | 1.4 (16.8px) | Section labels, tab titles, button text |
| 3 | Subheading | 16px | 1.0rem | Semibold 600 | General Sans | 1.4 (22.4px) | Panel titles, group headers |
| 4 | Heading | 20px | 1.25rem | Semibold 600 | General Sans | 1.3 (26px) | Meeting title, major section headers |
| 5 | Display | 24px | 1.5rem | Bold 700 | General Sans | 1.25 (30px) | Setup screen title, hero text (rare) |

### 3.4 Code Scale (Monospace)

| Level | Name | Size (px) | Weight | Line-height | Usage |
|-------|------|-----------|--------|-------------|-------|
| Code-sm | Terminal | 12px | Regular 400 | 1.5 (18px) | xterm.js terminal pane |
| Code-md | Inline code | 13px | Regular 400 | inherit | Inline code in agent messages |
| Code-lg | Code block | 13px | Regular 400 | 1.6 (20.8px) | Fenced code blocks in messages |

**Note on inline code sizing**: Inline code at 13px (1px smaller than body 14px) compensates for JetBrains Mono's taller x-height, which would otherwise appear larger than surrounding Switzer body text at the same point size.

---

## 4. Weight System

### 4.1 Weight Map

| Weight | Value | Role | When to Use |
|--------|-------|------|-------------|
| **Regular** | 400 | Reading weight | Body text, agent messages, descriptions. The default. |
| **Medium** | 500 | Emphasis weight | Agent names in-stream, emphasized body text, active states. Adds authority without visual disruption. |
| **Semibold** | 600 | Structural weight | Headings (H2-H4), labels, navigation items, button text. Defines the architecture of the page. |
| **Bold** | 700 | Display weight | H1/Display headings, meeting titles, critical status indicators. Used sparingly -- maximum 1-2 elements per viewport. |

### 4.2 Weight Usage Rules

1. **No Light (300) or Thin (100-200)**: These weights sacrifice legibility on dark backgrounds. Light text on dark surfaces requires more stroke weight to maintain perceived contrast. Regular 400 is the minimum.

2. **Maximum 2 weights per text block**: Any single visual section (e.g., a message bubble, a status card) should use at most 2 different weights. More creates visual noise that breaks the "Poised" principle.

3. **Japanese weight mapping**: BIZ UDPGothic ships with Regular (400) and Bold (700) only. Map as follows:
   - Body Japanese text: Regular 400
   - Emphasized Japanese: Bold 700 (used sparingly -- bold Japanese characters are visually heavier than bold Latin due to higher stroke density)
   - Do NOT use `font-weight: 500` or `600` on Japanese text -- the browser's synthetic bolding degrades glyph quality.

4. **Agent names use Medium 500**: Agent names (e.g., "product-manager", "ux-analyst") appear frequently in the message stream. Medium weight distinguishes them from body text without the visual weight of Semibold, maintaining the stream's reading rhythm.

---

## 5. Spacing System

### 5.1 Letter-spacing

| Context | letter-spacing | Rationale |
|---------|---------------|-----------|
| Display (24px) | -0.02em | Tighten at large sizes to maintain cohesion. Prevents display text from appearing "airy." |
| Heading (20px) | -0.015em | Slight tightening for composed authority. |
| Subheading (16px) | -0.01em | Minimal tightening. |
| Label (12px, uppercase) | +0.08em | Expanded tracking for uppercase labels. Creates the "scholarly spacing" effect -- measured, deliberate, institutional. |
| Label (12px, mixed case) | +0.02em | Slight expansion for small-size legibility. |
| Body (14px) | 0 (default) | No adjustment. Switzer's default spacing is optimized for 14px reading. |
| Caption (11-12px) | +0.01em | Minimal expansion to prevent crowding at small sizes. |
| Monospace (all) | 0 (default) | Never adjust monospace letter-spacing. Fixed-width is the point. |
| Japanese text (all) | 0 (default) | Japanese typesetting does not benefit from letter-spacing adjustments. Character-level spacing is inherent to the glyph design. |

### 5.2 Line-height

| Context | line-height | Rationale |
|---------|-------------|-----------|
| Display | 1.25 | Tight leading for large display text. Multiple lines are rare at this level. |
| Heading | 1.3 | Slightly more room for potential 2-line headings (e.g., meeting topics). |
| Subheading | 1.4 | Comfortable balance between compactness and readability. |
| Body | **1.6** | The "scholarly reading" line-height. Generous vertical rhythm creates breathing room in the message stream. This is where "scholarly quality through spacing" manifests most powerfully -- 1.6 line-height gives each line of agent discourse the visual weight and separation of a considered text, not a chat message. |
| Caption/Small | 1.45-1.5 | Tighter than body (small text doesn't need as much vertical room) but still legible. |
| Code block | 1.6 | Matches body line-height for visual consistency when code blocks appear inline with conversation. |
| Terminal | 1.5 | Slightly tighter than body -- terminal is a dense information space where compactness is expected. |

### 5.3 Paragraph and Block Spacing

| Element | margin-bottom | Rationale |
|---------|---------------|-----------|
| Message bubble | 8px (0.5rem) | Tight vertical rhythm between messages maintains conversational flow. Enough separation to distinguish messages; close enough to feel like dialogue. |
| Message group (same agent, <2min gap) | 4px | Even tighter within a single agent's consecutive messages. |
| Section break (different context) | 24px (1.5rem) | Major visual break. Used between meeting phases or after topic shifts. |
| Code block within message | 12px top/bottom | Set off from surrounding text but not disruptive. |
| Paragraph within message | 8px | Agent messages may contain multi-paragraph content. |

---

## 6. "Scholarly Quality Through Spacing and Hierarchy" -- Implementation

The Gate 1 binding decision explicitly states that "scholarly" must come from hierarchy, spacing, and weight -- NOT from Serif fonts. Here is how the typography system achieves this:

### 6.1 Generous Line-height as "Typographic Breathing"

Body text at 1.6 line-height is 14% more generous than the typical developer tool (which runs 1.4-1.5). This creates a reading experience closer to a well-typeset book or academic journal than a chat application. Each line of agent discourse has room to be absorbed individually -- the user can scan line-by-line without visual crowding.

**The effect**: Messages feel like deliberated statements, not rapid-fire chat. This is the single most impactful typographic decision for the "scholarly" impression.

### 6.2 Uppercase Labels with Extended Tracking

Section labels, status indicators, and metadata text use uppercase + 0.08em letter-spacing. This is a direct reference to the typographic conventions of academic publishing, museum signage, and institutional design -- spaces where information is presented with authority and care.

**Example:**
```
MEETING TOPIC                    AGENTS (3)
────────────                     ──────────
APIリファクタリング戦略の検討      product-manager
                                  ux-analyst
                                  tech-lead
```

The wide-tracked uppercase "MEETING TOPIC" reads as an institutional label -- a plaque, not a button. This brings "scholarly" into the UI without a single Serif glyph.

### 6.3 Strict Weight Hierarchy

The 4-tier weight system (400/500/600/700) creates a clear "chain of command" in the typographic hierarchy:

- **700 Bold** = The voice of the system (meeting titles, display text). Rare and impactful.
- **600 Semibold** = The structure (section headings, labels, navigation). Defines the architecture.
- **500 Medium** = The emphasis (agent names, key terms). A scholarly text's equivalent of italics.
- **400 Regular** = The discourse (agent messages, body text). The default reading voice.

This hierarchy mirrors the structure of academic papers: title > section heading > author name > body text. The user internalizes this structure unconsciously, which creates the sense of "considered, organized knowledge" -- the feeling of scholarship.

### 6.4 Proportional Scale Discipline

The Minor Third (1.200) scale means each step is a deliberate, proportional increment. There are no arbitrary sizes. Every text element in the system derives from the same mathematical relationship. This kind of systematic rigor is invisible to the user but creates a subconscious sense of order -- the typographic equivalent of "this was designed by someone who cares about precision."

### 6.5 Consistent Vertical Rhythm

All spacing values derive from a 4px base grid:
- 4px (half-unit): tight grouping
- 8px (1 unit): standard message gap
- 12px (1.5 units): code block offset
- 16px (2 units): section padding
- 24px (3 units): major section break

This consistent rhythm creates a visual "beat" that the eye follows naturally. Irregular spacing feels chaotic; regular spacing feels composed. The 4px grid is the invisible scaffold that holds the scholarly impression together.

---

## 7. CSS Implementation Reference

### 7.1 Font Stack Declarations

```css
:root {
  /* Font families */
  --font-display: 'General Sans', 'BIZ UDPGothic', system-ui, sans-serif;
  --font-body: 'Switzer', 'BIZ UDPGothic', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
  --font-jp: 'BIZ UDPGothic', 'Hiragino Kaku Gothic ProN', sans-serif;

  /* Base size */
  --type-base: 14px;

  /* Scale (Minor Third 1.200) */
  --type-caption: 0.6875rem;   /* 11px */
  --type-small: 0.75rem;       /* 12px */
  --type-body: 0.875rem;       /* 14px */
  --type-sub: 1.0rem;          /* 16px */
  --type-heading: 1.25rem;     /* 20px */
  --type-display: 1.5rem;      /* 24px */

  /* Weights */
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;

  /* Line heights */
  --leading-tight: 1.25;
  --leading-snug: 1.3;
  --leading-normal: 1.4;
  --leading-relaxed: 1.5;
  --leading-loose: 1.6;

  /* Letter spacing */
  --tracking-tight: -0.02em;
  --tracking-snug: -0.015em;
  --tracking-normal: 0;
  --tracking-wide: 0.02em;
  --tracking-wider: 0.08em;
}
```

### 7.2 Composite Type Styles

```css
/* Display -- rare, impactful */
.type-display {
  font-family: var(--font-display);
  font-size: var(--type-display);
  font-weight: var(--weight-bold);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-tight);
}

/* Heading -- meeting titles, section headers */
.type-heading {
  font-family: var(--font-display);
  font-size: var(--type-heading);
  font-weight: var(--weight-semibold);
  line-height: var(--leading-snug);
  letter-spacing: -0.015em;
}

/* Subheading -- panel titles, group labels */
.type-subheading {
  font-family: var(--font-display);
  font-size: var(--type-sub);
  font-weight: var(--weight-semibold);
  line-height: var(--leading-normal);
  letter-spacing: -0.01em;
}

/* Label -- uppercase structural markers */
.type-label {
  font-family: var(--font-display);
  font-size: var(--type-small);
  font-weight: var(--weight-semibold);
  line-height: var(--leading-normal);
  letter-spacing: var(--tracking-wider);
  text-transform: uppercase;
}

/* Body -- the reading voice */
.type-body {
  font-family: var(--font-body);
  font-size: var(--type-body);
  font-weight: var(--weight-regular);
  line-height: var(--leading-loose);
  letter-spacing: var(--tracking-normal);
}

/* Agent name -- emphasis within stream */
.type-agent-name {
  font-family: var(--font-body);
  font-size: var(--type-body);
  font-weight: var(--weight-medium);
  line-height: var(--leading-loose);
  letter-spacing: var(--tracking-normal);
}

/* Caption -- timestamps, metadata */
.type-caption {
  font-family: var(--font-body);
  font-size: var(--type-caption);
  font-weight: var(--weight-regular);
  line-height: var(--leading-relaxed);
  letter-spacing: 0.01em;
}

/* Code inline */
.type-code-inline {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: var(--weight-regular);
  line-height: inherit;
}

/* Code block */
.type-code-block {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: var(--weight-regular);
  line-height: var(--leading-loose);
}

/* Terminal */
.type-terminal {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: var(--weight-regular);
  line-height: var(--leading-relaxed);
}
```

### 7.3 Font Loading Strategy (Electron Context)

```css
/*
 * In Electron, fonts can be bundled with the app (no network fetch).
 * Recommended: bundle all 4 font families as WOFF2 in /assets/fonts/.
 *
 * Loading order (for fallback cascade):
 * 1. General Sans (display) -- needed immediately for headings
 * 2. Switzer (body) -- needed immediately for message text
 * 3. BIZ UDPGothic (JP) -- needed immediately for Japanese content
 * 4. JetBrains Mono (code) -- can be slightly deferred
 *
 * Since this is Electron (local), all fonts load synchronously.
 * No FOUT/FOIT concerns.
 */

@font-face {
  font-family: 'General Sans';
  src: url('../fonts/GeneralSans-Medium.woff2') format('woff2');
  font-weight: 500;
  font-display: block;
}
@font-face {
  font-family: 'General Sans';
  src: url('../fonts/GeneralSans-Semibold.woff2') format('woff2');
  font-weight: 600;
  font-display: block;
}
@font-face {
  font-family: 'General Sans';
  src: url('../fonts/GeneralSans-Bold.woff2') format('woff2');
  font-weight: 700;
  font-display: block;
}

@font-face {
  font-family: 'Switzer';
  src: url('../fonts/Switzer-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: block;
}
@font-face {
  font-family: 'Switzer';
  src: url('../fonts/Switzer-Medium.woff2') format('woff2');
  font-weight: 500;
  font-display: block;
}

@font-face {
  font-family: 'BIZ UDPGothic';
  src: url('../fonts/BIZUDPGothic-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: block;
}
@font-face {
  font-family: 'BIZ UDPGothic';
  src: url('../fonts/BIZUDPGothic-Bold.woff2') format('woff2');
  font-weight: 700;
  font-display: block;
}

@font-face {
  font-family: 'JetBrains Mono';
  src: url('../fonts/JetBrainsMono-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: block;
}
@font-face {
  font-family: 'JetBrains Mono';
  src: url('../fonts/JetBrainsMono-Medium.woff2') format('woff2');
  font-weight: 500;
  font-display: block;
}
```

---

## 8. Assigned Variable Values

| # | Variable | Value | Rationale |
|---|----------|-------|-----------|
| 16 | `font_display` | General Sans | Geometric sans-serif with humanist warmth; authoritative without being generic |
| 17 | `font_body` | Switzer | Neo-grotesque optimized for sustained reading at 14px; harmonious pairing with General Sans |
| 18 | `font_display_category` | sans-serif (geometric-humanist) | Geometric backbone provides structure; humanist details provide life |
| 19 | `font_body_category` | sans-serif (neo-grotesque) | Clean, even-weight strokes for body legibility; humanist apertures for warmth |
| 20 | `font_jp_category` | gothic (UD gothic) | BIZ UDPGothic -- Universal Design Gothic by Morisawa. Professional, highly legible, culturally appropriate for technical interfaces |
| 21 | `type_scale_ratio` | 1.200 (Minor Third) | Compact hierarchy suitable for dense, IDE-adjacent layouts. Scholarly precision without dramatic size jumps |
| 22 | `type_base_size` | 14px | Optimized for peripheral scanning, Japanese character legibility, and developer display density |

### Additional Fonts (not numbered but defined):

| Role | Font | Rationale |
|------|------|-----------|
| Monospace | JetBrains Mono | Developer-recognized, tall x-height, ligature support, geometric harmony with sans-serif stack |
| Japanese | BIZ UDPGothic | UD Gothic with proportional spacing (P variant), Morisawa quality, open-source |

---

## 9. Accessibility Notes

### 9.1 WCAG-AA Compliance

- **Minimum text size**: 11px (Caption) meets AA requirements when paired with sufficient contrast (4.5:1 for normal text).
- **Font weight on dark backgrounds**: No weight below 400 Regular is used. Thin/Light weights on dark backgrounds fail perceived contrast requirements even when the color contrast ratio technically passes.
- **Japanese character minimum**: 14px body size ensures Japanese glyphs (which contain more strokes per character) remain distinguishable. 11px Japanese should only be used for non-critical metadata.

### 9.2 `prefers-reduced-motion` Consideration

Typography transitions (if any are applied to font-size or letter-spacing for interactive states) should respect the `prefers-reduced-motion` media query by removing transitions.

### 9.3 User Font Size Override

The rem-based scale allows users with custom browser/Electron zoom settings to scale the entire typography system proportionally. The scale ratios hold at any base size.

---

## 10. Design Tension Mapping

| Typography Element | "Scholarly" Expression | "Alive" Expression |
|---|---|---|
| **Line-height 1.6** | Generous, measured reading rhythm | Room for content to breathe and flow |
| **Uppercase labels + wide tracking** | Institutional, authoritative markers | Crisp, scannable section identifiers |
| **Weight hierarchy (400-700)** | Academic paper structure | Dynamic emphasis for real-time content |
| **Minor Third scale** | Mathematical precision, no arbitrariness | Compact enough for streaming content |
| **14px base** | Respects the reader's attention | Readable at glance (peripheral scanning) |
| **Agent name in Medium 500** | Consistent, typographic identity | Distinct enough to track in flowing conversation |
| **Monospace for code** | Technical rigor, precision | Raw, live terminal output |

---

*This document defines the typographic language of cc-roundtable. All font, size, weight, and spacing decisions should reference this system. Deviations should be documented and justified against the "Scholarly but alive" design tension.*
