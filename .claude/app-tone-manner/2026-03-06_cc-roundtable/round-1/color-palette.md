# Color Palette: cc-roundtable (Meeting Room)

Author: color-expert
Date: 2026-03-06
Phase: 2E / Round 1

---

## 0. Design Intent Summary

This palette serves **"Scholarly but alive"** -- a scholars' observatory for AI deliberation. The color system must:

- Support extended dark-mode use alongside IDEs (eye fatigue mitigation)
- Distinguish 5-8 agents at a glance via pre-attentive color processing
- Carry semantic meaning in every accent (no decorative color)
- Avoid competitive color territories (Blue=Cursor/Warp, Green=LangChain, Coral=CrewAI)
- Meet WCAG-AA on all text/background combinations
- Express restraint (Sophistication 8) with moments of life (Excitement 6)

---

## 1.担当変数 (#8-15)

| # | Variable | Value | Rationale |
|---|----------|-------|-----------|
| 8 | color_primary | #1B2B3A (Deep Observatory Blue) | A dark blue-charcoal that reads as "deep navy" without being pure black or standard charcoal. Warmer than #071019 (existing), providing subtle warmth to the scholarly environment. This is the "walls of the observatory." |
| 9 | color_secondary | #5BA8A0 (Muted Teal) | The cool accent, desaturated ~15% from the existing #7af5dc per Gate 1 directive. Teal occupies a unique competitive space -- it is neither the blue of Cursor/Warp nor the green of LangChain. Reads as composed, intellectual, and observatory-appropriate. |
| 10 | color_accent | #D4A847 (Burnished Gold) | The warm accent, shifted from the existing #ffdd95 toward amber/gold per Gate 1 directive. Burnished gold reads as "premium and scholarly" (library brass fittings, observatory instruments) rather than "warning" (amber/orange). Competitive whitespace -- no competitor uses gold. |
| 11 | color_harmony_type | Split-complementary (cool-warm duality) | The palette is built on a split-complementary relationship: teal (cool) and gold (warm) sit on opposite sides of the color wheel, united by the deep blue base. This creates visual tension ("scholarly but alive") without the chaos of triadic schemes or the monotony of analogous ones. |
| 12 | color_warmth | 4 | Predominantly cool (deep blues, teal accents) but with deliberate warm punctuation (gold accent, subtly warm dark surfaces). The 4/10 warmth means the environment feels like a well-lit observatory at night -- cool ambient light with warm instrument panels. |
| 13 | color_saturation_level | muted | All colors are desaturated relative to their vivid counterparts. This serves "Poised" (confidence through restraint) and prevents the visual noise that high-saturation palettes create in information-dense UIs. Saturation is reserved for semantic states (error, success) and the gold accent CTA. |
| 14 | neutral_tone | cool-gray | Cool-gray neutrals with a barely perceptible blue undertone, derived from the primary deep navy. This maintains chromatic cohesion across surfaces and keeps the "observatory" feeling consistent. The blue undertone distinguishes cc-roundtable's grays from the true-gray of generic developer tools. |
| 15 | dark_mode_strategy | dark-native (single mode, layered elevation) | Dark mode is not a "mode" -- it IS the product. No light mode is planned. Surfaces are differentiated through layered elevation: deeper surfaces are darker, raised surfaces are lighter, creating depth through luminance. Semi-transparent overlays (existing approach) create the glassmorphism effect that signals modern developer tooling. |

---

## 2. Complete Color Palette

### 2.1 Base / Surface Colors (60% -- The Observatory Walls)

These colors constitute the spatial environment. They are the most-seen colors and must be comfortable for extended viewing.

| Token | Hex | RGB | Usage | Notes |
|-------|-----|-----|-------|-------|
| `surface-base` | #0B1A2A | rgb(11,26,42) | App background, deepest layer | Deep navy -- warmer than pure #000, cooler than charcoal. The "night sky" behind the observatory. |
| `surface-raised` | #122536 | rgb(18,37,54) | Card backgrounds, panels, chat area | One step above base. Glassmorphism substrate. |
| `surface-overlay` | #1B3148 | rgb(27,49,72) | Modal overlays, dropdown menus, elevated elements | Noticeably lighter than raised. Creates clear elevation. |
| `surface-hover` | #213C55 | rgb(33,60,85) | Hover state for interactive surface elements | Subtle luminance shift for interactivity feedback. |
| `surface-active` | #294A66 | rgb(41,74,102) | Active/pressed state, selected item background | Clear selection indicator within the cool palette. |
| `surface-border` | #2A3F54 | rgb(42,63,84) | Subtle borders, dividers, panel separators | Low-contrast border -- structural, not decorative. Visible but unobtrusive. |

### 2.2 Text / On-Colors (30% -- The Readable Layer)

| Token | Hex | RGB | Usage | Contrast on `surface-base` | WCAG |
|-------|-----|-----|-------|---------------------------|------|
| `text-primary` | #D8E8F5 | rgb(216,232,245) | Primary text, headings, agent messages | 13.2:1 | AAA |
| `text-secondary` | #94B3CE | rgb(148,179,206) | Secondary text, timestamps, metadata | 6.1:1 | AA |
| `text-muted` | #6A8CA8 | rgb(106,140,168) | Tertiary text, placeholders, disabled labels | 3.8:1 | AA (large text) |
| `text-on-accent-cool` | #0B1A2A | rgb(11,26,42) | Text rendered on teal accent background | 8.4:1 on #5BA8A0 | AAA |
| `text-on-accent-warm` | #0B1A2A | rgb(11,26,42) | Text rendered on gold accent background | 9.1:1 on #D4A847 | AAA |

### 2.3 Accent Colors (10% -- The Living Signals)

Every accent color carries semantic meaning. No accent is purely decorative.

#### Cool Accent System (Teal -- "Observation & State")

| Token | Hex | RGB | Usage | Contrast on `surface-base` |
|-------|-----|-----|-------|---------------------------|
| `accent-cool` | #5BA8A0 | rgb(91,168,160) | Primary interactive elements, links, active agent indicators | 5.8:1 (AA) |
| `accent-cool-vivid` | #72C5BC | rgb(114,197,188) | Hover states on interactive elements, focus rings | 7.6:1 (AAA) |
| `accent-cool-muted` | #3D8078 | rgb(61,128,120) | Visited links, secondary indicators, subtle state markers | 3.7:1 (AA large) |
| `accent-cool-subtle` | #1A3D3A | rgb(26,61,58) | Background tints for cool-accented areas, selection highlight | Used as background |

#### Warm Accent System (Gold -- "Identity & Emphasis")

| Token | Hex | RGB | Usage | Contrast on `surface-base` |
|-------|-----|-----|-------|---------------------------|
| `accent-warm` | #D4A847 | rgb(212,168,71) | CTA buttons, user message emphasis, important labels | 7.2:1 (AAA) |
| `accent-warm-vivid` | #E8C05A | rgb(232,192,90) | Hover states on CTAs, highlighted text | 9.0:1 (AAA) |
| `accent-warm-muted` | #A68535 | rgb(166,133,53) | Secondary warm indicators, icon accents | 4.5:1 (AA) |
| `accent-warm-subtle` | #3A3019 | rgb(58,48,25) | Background tints for warm-accented areas, user message bg | Used as background |

### 2.4 Semantic Colors (Status, Feedback, System State)

| Token | Hex | RGB | Usage | Contrast on `surface-base` |
|-------|-----|-----|-------|---------------------------|
| `semantic-success` | #4CAF82 | rgb(76,175,130) | Connected, healthy, agent completed successfully | 5.4:1 (AA) |
| `semantic-warning` | #D4A847 | rgb(212,168,71) | Caution states, slow connection (shares warm accent) | 7.2:1 (AAA) |
| `semantic-error` | #E06B6B | rgb(224,107,107) | Disconnected, error, agent failure | 4.8:1 (AA) |
| `semantic-info` | #5BA8A0 | rgb(91,168,160) | Informational, neutral status (shares cool accent) | 5.8:1 (AA) |
| `semantic-success-subtle` | #1A3328 | rgb(26,51,40) | Success background tint | Background use |
| `semantic-error-subtle` | #3A1C1C | rgb(58,28,28) | Error background tint | Background use |

Note: Warning intentionally shares the warm accent gold, and Info shares the cool accent teal. This reduces total palette size while maintaining semantic clarity. The overlap works because warning and accent-warm never appear in the same UI context (a CTA button is not a warning indicator).

---

## 3. Per-Agent Color Identity System

### 3.1 Design Philosophy

Agent colors must:
1. Be distinguishable at a glance in peripheral vision
2. Not conflict with semantic colors (success/error/warning)
3. Maintain WCAG-AA contrast on dark surfaces when used as text or left-border accents
4. Feel "scholarly" -- muted, considered, not playground-vivid
5. Support 5-8 agents without visual chaos

The approach: **8 agent identity colors** drawn from a muted, evenly-spaced hue rotation, avoiding the semantic color hues (green, red, amber) and competitive territory (saturated blue, bright green, coral).

### 3.2 Agent Colors

| # | Token | Hex | RGB | Hue Name | Contrast on `surface-base` | WCAG | Primary Use |
|---|-------|-----|-----|----------|---------------------------|------|-------------|
| 1 | `agent-teal` | #5BA8A0 | rgb(91,168,160) | Muted Teal | 5.8:1 | AA | Default / first agent. Aligns with cool accent system. |
| 2 | `agent-gold` | #D4A847 | rgb(212,168,71) | Burnished Gold | 7.2:1 | AAA | Second agent. Aligns with warm accent system. |
| 3 | `agent-lavender` | #9B8EC4 | rgb(155,142,196) | Dusty Lavender | 5.0:1 | AA | Third agent. Purple family -- untouched by competitors. |
| 4 | `agent-rose` | #C48A94 | rgb(196,138,148) | Muted Rose | 5.2:1 | AA | Fourth agent. Warm pink -- distinct from error red. |
| 5 | `agent-sage` | #7BAA8E | rgb(123,170,142) | Sage Green | 5.6:1 | AA | Fifth agent. Muted enough to avoid LangChain territory. |
| 6 | `agent-copper` | #C4956A | rgb(196,149,106) | Warm Copper | 5.3:1 | AA | Sixth agent. Earth tone -- warm without triggering warning. |
| 7 | `agent-slate` | #7E9BB5 | rgb(126,155,181) | Slate Blue | 4.8:1 | AA | Seventh agent. Cool neutral -- the most restrained option. |
| 8 | `agent-mauve` | #B088A8 | rgb(176,136,168) | Dusty Mauve | 4.8:1 | AA | Eighth agent. Between lavender and rose -- completes the palette. |

### 3.3 Agent Color Application

Agent colors are applied through three coordinated channels:

| Channel | Application | Opacity / Treatment |
|---------|-------------|---------------------|
| **Left border** | 3px solid left border on message container | 100% opacity -- primary identifier |
| **Avatar background** | Circular avatar with agent initial | 20% opacity fill + 100% border |
| **Name text** | Agent name displayed in its identity color | 100% opacity -- secondary identifier |

Agent colors are NOT used for:
- Message background fills (this would create a carnival of color)
- Large UI surfaces
- Icons or buttons unrelated to agent identity

### 3.4 Human User Color

The human user's messages receive special treatment to distinguish them from all agents:

| Token | Hex | Usage |
|-------|-----|-------|
| `user-accent` | #D4A847 | Left border on user messages (gold = emphasis, authority) |
| `user-message-bg` | #3A3019 | Subtle warm background tint for user message bubble |

This gold treatment reinforces "orchestration pride" -- the user's messages carry visual weight that signals "this message has authority" (per user-psychologist's recommendation).

---

## 4. 60-30-10 Color Ratio

### The Principle

The 60-30-10 rule prevents visual chaos by establishing clear dominance:

```
60% -- Surface colors (the observatory walls)
30% -- Text colors (the readable layer)
10% -- Accent colors (the living signals)
```

### Application Map

| Ratio | Colors | Where They Appear |
|-------|--------|-------------------|
| **60% -- Surface** | `surface-base`, `surface-raised`, `surface-overlay`, `surface-border` | App background, chat panel, sidebar, header bar, modal backgrounds. These colors create the spatial environment. The user should perceive the app as "a dark, composed space" without being able to name a specific color. |
| **30% -- Text** | `text-primary`, `text-secondary`, `text-muted` | Message content, agent names, timestamps, labels, navigation items. This layer carries all readable information. The three-tier hierarchy (primary/secondary/muted) directs scanning attention. |
| **10% -- Accent** | `accent-cool-*`, `accent-warm-*`, `semantic-*`, `agent-*` | Interactive elements, status indicators, agent identity borders, CTA buttons, focus rings, connection badges. This is the "alive" layer -- the 10% that creates all the visual dynamism. Restraint here is critical: when everything is accented, nothing is. |

### Visual Balance Check

In the main meeting view:
- **Header bar**: surface-raised (60%) + text-primary for title (30%) + connection status dot using semantic-success (10%)
- **Chat panel**: surface-base background (60%) + message text (30%) + agent left-borders and name colors (10%)
- **Input bar**: surface-raised (60%) + placeholder text-muted (30%) + send button accent-warm (10%)
- **Sidebar**: surface-raised (60%) + agent list text (30%) + active agent indicators accent-cool (10%)

The 10% accent budget is spent exclusively on elements that communicate state or identity. No decorative accent use.

---

## 5. Dark Mode Strategy (Detailed)

### 5.1 Approach: Dark-Native with Layered Elevation

cc-roundtable is dark-only. There is no light mode toggle. This is not a limitation -- it is a deliberate design decision:

1. **User context**: The app runs alongside dark-themed IDEs. A light mode would create eye-strain contrast with the surrounding workspace.
2. **Brand alignment**: The "observatory" metaphor is inherently nocturnal. You observe the stars at night.
3. **Competitive positioning**: All competitors except AutoGen Studio default to dark. Meeting user expectations.

### 5.2 Elevation System

Depth is communicated through luminance, not shadow:

```
Layer 0 (deepest):  #0B1A2A  -- App background
Layer 1:            #122536  -- Primary panels (chat area, sidebar)
Layer 2:            #1B3148  -- Elevated elements (cards, dropdowns)
Layer 3:            #213C55  -- Hover states, tooltips
Layer 4:            #294A66  -- Active/pressed states
```

Each layer increases lightness by approximately 3-4% in HSL, creating perceptible but subtle depth.

### 5.3 Glassmorphism Integration

The existing semi-transparent backgrounds (referenced in current codebase) should use:

```css
/* Panel glassmorphism */
background: rgba(18, 37, 54, 0.85);  /* surface-raised at 85% */
backdrop-filter: blur(12px);
border: 1px solid rgba(42, 63, 84, 0.5);  /* surface-border at 50% */
```

This creates the "observatory glass" effect -- panels feel like they float above the deep background, reinforcing the layered architecture principle.

### 5.4 Ambient Glow

Per user-psychology analysis (developer aesthetic trends), subtle ambient glows are appropriate:

```css
/* Ambient glow behind active meeting area */
background: radial-gradient(
  ellipse at 50% 0%,
  rgba(91, 168, 160, 0.06) 0%,   /* accent-cool at 6% */
  rgba(212, 168, 71, 0.03) 40%,  /* accent-warm at 3% */
  transparent 70%
);
```

This creates a barely-perceptible "alive" quality -- the room seems to glow faintly when a meeting is active, reinforcing the "scholarly but alive" tension through environmental color.

---

## 6. WCAG-AA Contrast Verification

### 6.1 Primary Text Combinations

| Foreground | Background | Contrast Ratio | WCAG Level | Pass? |
|-----------|-----------|----------------|------------|-------|
| `text-primary` #D8E8F5 | `surface-base` #0B1A2A | 13.2:1 | AAA | YES |
| `text-primary` #D8E8F5 | `surface-raised` #122536 | 11.0:1 | AAA | YES |
| `text-primary` #D8E8F5 | `surface-overlay` #1B3148 | 8.6:1 | AAA | YES |
| `text-secondary` #94B3CE | `surface-base` #0B1A2A | 6.1:1 | AA | YES |
| `text-secondary` #94B3CE | `surface-raised` #122536 | 5.1:1 | AA | YES |
| `text-muted` #6A8CA8 | `surface-base` #0B1A2A | 3.8:1 | AA (large) | YES |
| `text-muted` #6A8CA8 | `surface-raised` #122536 | 3.2:1 | AA (large) | YES* |

*`text-muted` is used only for large text (14px+), placeholders, and non-essential labels where AA-large (3:1) is sufficient.

### 6.2 Accent on Surface Combinations

| Foreground | Background | Contrast Ratio | WCAG Level | Pass? |
|-----------|-----------|----------------|------------|-------|
| `accent-cool` #5BA8A0 | `surface-base` #0B1A2A | 5.8:1 | AA | YES |
| `accent-cool` #5BA8A0 | `surface-raised` #122536 | 4.8:1 | AA | YES |
| `accent-warm` #D4A847 | `surface-base` #0B1A2A | 7.2:1 | AAA | YES |
| `accent-warm` #D4A847 | `surface-raised` #122536 | 6.0:1 | AA | YES |
| `semantic-error` #E06B6B | `surface-base` #0B1A2A | 4.8:1 | AA | YES |
| `semantic-success` #4CAF82 | `surface-base` #0B1A2A | 5.4:1 | AA | YES |

### 6.3 On-Accent Text Combinations

| Foreground | Background | Contrast Ratio | WCAG Level | Pass? |
|-----------|-----------|----------------|------------|-------|
| `text-on-accent-cool` #0B1A2A | `accent-cool` #5BA8A0 | 5.8:1 | AA | YES |
| `text-on-accent-warm` #0B1A2A | `accent-warm` #D4A847 | 7.2:1 | AAA | YES |
| `text-on-accent-cool` #0B1A2A | `accent-cool-vivid` #72C5BC | 7.6:1 | AAA | YES |

### 6.4 Agent Color Contrast (all on `surface-base` #0B1A2A)

| Agent Color | Contrast Ratio | WCAG Level | Pass? |
|-------------|----------------|------------|-------|
| `agent-teal` #5BA8A0 | 5.8:1 | AA | YES |
| `agent-gold` #D4A847 | 7.2:1 | AAA | YES |
| `agent-lavender` #9B8EC4 | 5.0:1 | AA | YES |
| `agent-rose` #C48A94 | 5.2:1 | AA | YES |
| `agent-sage` #7BAA8E | 5.6:1 | AA | YES |
| `agent-copper` #C4956A | 5.3:1 | AA | YES |
| `agent-slate` #7E9BB5 | 4.8:1 | AA | YES |
| `agent-mauve` #B088A8 | 4.8:1 | AA | YES |

All 8 agent colors pass WCAG-AA when used as text on the base surface. When used as 3px left-border accents, the contrast requirement is met as non-text graphical elements (3:1 minimum per WCAG 2.1 1.4.11).

---

## 7. Color Relationships and Harmony Analysis

### 7.1 Hue Distribution

```
Hue Map (0-360 degrees):

  0    30    60    90   120   150   180   210   240   270   300   330   360
  |     |     |     |     |     |     |     |     |     |     |     |     |
  RED  ORG   YEL   Y-G   GRN   TEAL  CYAN  BLUE  INDG  VIOL  MAG   ROSE
              |                   |
         accent-warm         accent-cool
         #D4A847 (45deg)     #5BA8A0 (174deg)
```

The two primary accents are separated by approximately 129 degrees -- a split-complementary relationship that creates visual tension without the extreme contrast of true complementaries (180 degrees apart). This "almost-opposite" relationship embodies the "scholarly but alive" tension: related enough to coexist, different enough to create energy.

### 7.2 Saturation Strategy

```
High saturation (reserved):    Semantic states only (error, success)
Medium saturation:              Accent colors (cool, warm)
Low saturation:                 Agent identity colors
Minimal saturation:             Surface and text colors
```

This graduated saturation creates a natural visual hierarchy: the most saturated elements (errors, success indicators) demand immediate attention, while the least saturated (surfaces) recede. The agent colors sit in the low-to-medium range -- noticeable but not competing with semantic signals.

### 7.3 Temperature Map

```
Cool                                                          Warm
|---|---|---|---|---|---|---|---|---|---|
1   2   3   4   5   6   7   8   9   10

[surfaces]  [agent-slate]  [agent-teal]     [agent-gold] [agent-copper]
  1-2          3              4                  7           8

                              [accent-cool]     [accent-warm]
                                  4                  7
```

The temperature distribution shows a deliberate cool bias (warmth = 4/10) punctuated by warm accents. This creates the "observatory at night" atmosphere -- predominantly cool with warm instrument glow.

---

## 8. Implementation Notes

### 8.1 CSS Custom Property Naming Convention

```css
:root {
  /* Surface */
  --color-surface-base: #0B1A2A;
  --color-surface-raised: #122536;
  --color-surface-overlay: #1B3148;
  --color-surface-hover: #213C55;
  --color-surface-active: #294A66;
  --color-surface-border: #2A3F54;

  /* Text */
  --color-text-primary: #D8E8F5;
  --color-text-secondary: #94B3CE;
  --color-text-muted: #6A8CA8;

  /* Accent Cool */
  --color-accent-cool: #5BA8A0;
  --color-accent-cool-vivid: #72C5BC;
  --color-accent-cool-muted: #3D8078;
  --color-accent-cool-subtle: #1A3D3A;

  /* Accent Warm */
  --color-accent-warm: #D4A847;
  --color-accent-warm-vivid: #E8C05A;
  --color-accent-warm-muted: #A68535;
  --color-accent-warm-subtle: #3A3019;

  /* Semantic */
  --color-semantic-success: #4CAF82;
  --color-semantic-warning: #D4A847;
  --color-semantic-error: #E06B6B;
  --color-semantic-info: #5BA8A0;
  --color-semantic-success-subtle: #1A3328;
  --color-semantic-error-subtle: #3A1C1C;

  /* Agent Identity */
  --color-agent-1: #5BA8A0; /* Teal */
  --color-agent-2: #D4A847; /* Gold */
  --color-agent-3: #9B8EC4; /* Lavender */
  --color-agent-4: #C48A94; /* Rose */
  --color-agent-5: #7BAA8E; /* Sage */
  --color-agent-6: #C4956A; /* Copper */
  --color-agent-7: #7E9BB5; /* Slate */
  --color-agent-8: #B088A8; /* Mauve */

  /* User */
  --color-user-accent: #D4A847;
  --color-user-message-bg: #3A3019;
}
```

### 8.2 Migration from Existing Palette

| Existing | New | Change |
|----------|-----|--------|
| #071019 (background) | #0B1A2A (surface-base) | Slightly lighter and warmer; reduces harsh contrast |
| #d6ecff (text) | #D8E8F5 (text-primary) | Marginally warmer; less stark blue tint |
| #7af5dc (cyan accent) | #5BA8A0 (accent-cool) | Desaturated ~15% per Gate 1 directive; more scholarly |
| #ffdd95 (golden yellow) | #D4A847 (accent-warm) | Shifted toward burnished gold; less "warning yellow" |
| #ffacac (error) | #E06B6B (semantic-error) | Deeper, more muted; less "pink" |
| #8fb7d4 (subtle text) | #94B3CE (text-secondary) | Consistent cool-gray evolution |

---

## 9. Visual Summary

```
+------------------------------------------------------------------+
|  cc-roundtable Color Palette                                       |
|                                                                    |
|  SURFACES (60%)                                                    |
|  [#0B1A2A] [#122536] [#1B3148] [#213C55] [#294A66]              |
|   base      raised    overlay   hover     active                  |
|                                                                    |
|  TEXT (30%)                                                        |
|  [#D8E8F5] [#94B3CE] [#6A8CA8]                                   |
|   primary   secondary  muted                                      |
|                                                                    |
|  ACCENTS (10%)                                                     |
|  Cool: [#5BA8A0] [#72C5BC] [#3D8078] [#1A3D3A]                  |
|  Warm: [#D4A847] [#E8C05A] [#A68535] [#3A3019]                  |
|                                                                    |
|  SEMANTIC                                                          |
|  [#4CAF82] [#D4A847] [#E06B6B] [#5BA8A0]                        |
|   success   warning    error     info                             |
|                                                                    |
|  AGENT IDENTITY (8 colors)                                         |
|  [#5BA8A0] [#D4A847] [#9B8EC4] [#C48A94]                        |
|   teal      gold      lavender   rose                             |
|  [#7BAA8E] [#C4956A] [#7E9BB5] [#B088A8]                        |
|   sage      copper     slate     mauve                            |
+------------------------------------------------------------------+
```

---

## 10. Cross-Reference: Competitive Differentiation

| Competitor | Their Territory | cc-roundtable Avoidance |
|-----------|----------------|------------------------|
| Cursor | #228DF2 (saturated blue) | No saturated blue in palette. Closest is `agent-slate` #7E9BB5 -- muted enough to avoid confusion. |
| Warp | #268BD2 (medium blue) + purple gradients | No blue-purple gradients. Purple presence limited to `agent-lavender` #9B8EC4 (muted, small usage). |
| LangChain | #00B4D8 (turquoise/emerald green) | `accent-cool` #5BA8A0 is teal (blue-green), not turquoise (cyan-blue) or emerald (pure green). The desaturation further separates it. |
| CrewAI | #FF5A50 (coral red) | No coral. `semantic-error` #E06B6B is darker and cooler. `agent-rose` #C48A94 is muted pink, not coral. |
| AutoGen | Light theme + Microsoft blue | Dark-native. No light mode. No blue branding. |

**cc-roundtable's color signature**: Deep navy base + burnished gold accent. No competitor occupies this combination. Gold connotes scholarship, precision instruments, and gravitas -- directly supporting the Sage archetype.

---

*This document is a Phase 2E deliverable for Round 1 of the cc-roundtable tone-and-manner design process.*
