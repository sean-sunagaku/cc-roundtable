# cc-roundtable Tone & Manner Report

**Date:** 2026-03-06
**Round:** 1
**Status:** Complete (Gate 1 PASS / Gate 2 PASS / Gate 3 PASS)
**Design Tension:** "Scholarly but alive"

---

## Executive Summary

cc-roundtable is a scholars' observatory for AI deliberation -- a composed, technically elegant Electron desktop app where real-time multi-agent discourse unfolds within a calm, purposeful frame.

8 specialist agents across 3 phases designed a complete 42-variable tone-and-manner system through structured debate and gate-based quality control.

---

## 1. Brand Identity

| Item | Value |
|------|-------|
| **Primary Archetype** | Sage (understanding, truth-seeking) |
| **Secondary Archetype** | Explorer (discovery, curiosity) |
| **Design Tension** | "Scholarly but alive" |
| **Positioning** | Composed x Medium-minimal |
| **Visual Metaphor** | Observatory (calm, focused observation) |
| **Interaction Metaphor** | Meeting Room (participation, conversation flow) |

### Aaker Personality Scores

| Dimension | Score | Expression |
|-----------|-------|------------|
| Sincerity | 5/10 | Transparency-driven, not warmth-driven |
| Excitement | 6/10 | Temporal liveness, not chromatic energy |
| Competence | 9/10 | Dominant dimension -- technical excellence |
| Sophistication | 8/10 | Craft and restraint, not decoration |
| Ruggedness | 3/10 | Not part of brand voice |

### Design Principles

1. **Lucid** -- Every element serves comprehension
2. **Poised** -- Confidence expressed through restraint
3. **Alive** -- Real-time dynamism within a calm frame
4. **Layered** -- Depth reveals on demand

---

## 2. Color System

### Core Palette

| Role | Token | Hex | Usage |
|------|-------|-----|-------|
| Surface Base | `--color-surface-base` | #0B1A2A | App background |
| Surface Raised | `--color-surface-raised` | #122536 | Panels, cards |
| Surface Overlay | `--color-surface-overlay` | #1B3148 | Modals, dropdowns |
| Surface Hover | `--color-surface-hover` | #213C55 | Hover states |
| Surface Active | `--color-surface-active` | #294A66 | Active/pressed |
| Surface Border | `--color-surface-border` | #2A3F54 | Borders, dividers |
| Text Primary | `--color-text-primary` | #D8E8F5 | Headings, body text |
| Text Secondary | `--color-text-secondary` | #94B3CE | Timestamps, metadata |
| Text Muted | `--color-text-muted` | #6A8CA8 | Placeholders, disabled |
| Cool Accent | `--color-accent-cool` | #5BA8A0 | Interactive elements, links |
| Warm Accent | `--color-accent-warm` | #D4A847 | CTAs, user messages |

### Semantic Colors

| State | Hex | Notes |
|-------|-----|-------|
| Success | #4CAF82 | Connected, healthy |
| Warning | #D4A847 | Shares warm accent |
| Error | #E06B6B | Disconnected, failure |
| Info | #5BA8A0 | Shares cool accent |

### Agent Identity Colors (8)

| # | Name | Hex |
|---|------|-----|
| 1 | Teal | #5BA8A0 |
| 2 | Gold | #D4A847 |
| 3 | Lavender | #9B8EC4 |
| 4 | Rose | #C48A94 |
| 5 | Sage | #7BAA8E |
| 6 | Copper | #C4956A |
| 7 | Slate | #7E9BB5 |
| 8 | Mauve | #B088A8 |

**Color ratio:** 60% surfaces / 30% text / 10% accents
**Dark mode:** Dark-native only, no light mode. Layered elevation.
**Human user:** Burnished gold (#D4A847) accent for authority.
**WCAG:** All combinations verified AA-compliant.

---

## 3. Typography

### Font Stack

| Role | Font | Category |
|------|------|----------|
| Display | General Sans | Geometric-humanist sans-serif |
| Body | Switzer | Neo-grotesque sans-serif |
| Japanese | BIZ UDPGothic | UD Gothic (proportional) |
| Monospace | JetBrains Mono | Code/terminal |

### Type Scale (Minor Third 1.200, Base 14px)

| Level | Size | Weight | Font | Usage |
|-------|------|--------|------|-------|
| Display | 24px | Bold 700 | General Sans | Setup title (rare) |
| Heading | 20px | Semibold 600 | General Sans | Meeting title |
| Subheading | 16px | Semibold 600 | General Sans | Panel titles |
| Label | 12px | Semibold 600 | General Sans | Uppercase markers |
| Body | 14px | Regular 400 | Switzer | Agent messages |
| Body-emphasis | 14px | Medium 500 | Switzer | Agent names |
| Caption | 11px | Regular 400 | Switzer | Timestamps |

### Key Rules

- Line-height: 1.6 for body (scholarly spacing)
- Uppercase labels: +0.08em letter-spacing (institutional register)
- No weight below Regular 400 on dark backgrounds
- Max 2 weights per text block
- Japanese: Regular 400 / Bold 700 only (no synthetic bolding)

---

## 4. Visual Style

### Observatory Glassmorphism

- Semi-transparent panels: `rgba(surface-raised, 0.72)` + `backdrop-filter: blur(14px)`
- Hairline borders: `1px solid rgba(border, 0.20)`
- Ambient background glow: cool (top-left, 6%) + warm (top-right, 3%)

### Spacing

- Base unit: 6px
- Density: 7/10 "Structured dense"
- Scale: 6 / 9 / 12 / 18 / 24 / 36 / 48px

### Corner Radius

- xs: 4px (badges, code blocks)
- s: 8px (buttons, inputs)
- m: 12px (message bubbles)
- l: 16px (cards, panels)
- xl: 20px (modals)

### Elevation (4 levels)

| Level | Background Shift | Usage |
|-------|-----------------|-------|
| Base | -- | Page background |
| Surface | +3% lightness | Message bubbles, cards |
| Raised | +5% lightness | Panels, chat view |
| Floating | +8% lightness | Modals, tooltips |

### Motion

- Base duration: 180ms
- Style: Purposeful transitions (state-change only)
- New message: Slide up 8px + fade in (280ms)
- Hover: 80ms ease-out
- Active agent: Opacity pulse 0.10-0.20, 3s cycle (only ambient animation)
- `prefers-reduced-motion`: All animations disabled

### Icons

- Set: Lucide (line icons, MIT)
- Stroke: 1.5px default
- Agent status: Filled circles (not outline)

### Message Bubbles

| Sender | Left Border | Background | Glow |
|--------|------------|------------|------|
| Agent | 3px solid, agent color | Standard elevation-1 | None (unless active) |
| Human | 3px solid, gold | Slightly lighter | Subtle warm glow |
| System | None | Elevation-0, dimmer | None |

Agent color appears in exactly 4 places: left border, name text, status dot, tab indicator.

---

## 5. Tone of Voice

### Voice Matrix

| Dimension | Score | Expression |
|-----------|-------|------------|
| Formality | 7/10 | Professional, not corporate ("desumasu" form) |
| Humor | 2/10 | Essentially absent |
| Enthusiasm | 3/10 | Restrained; aliveness from UI dynamics |
| Respect | 8/10 | Treats user as expert conductor |
| Complexity | 6/10 | Precise, assumes developer fluency |

### Key Copy Rules

**Do:**
- State facts, not feelings
- Name the specific entity (which agent, which error)
- Include actionable context in errors
- Preserve technical terms in English (WebSocket, MCP, Agent)
- Use "desumasu" for Japanese system messages

**Don't:**
- Use exclamation marks in UI copy
- Anthropomorphize the system
- Use empty adjectives ("simple", "intuitive", "powerful")
- Celebrate success states
- Prompt the user to participate
- Use emoji in UI chrome

### Terminology

| Concept | JP | EN |
|---------|----|----|
| Discussion session | kaigi | Meeting |
| AI participant | Agent | Agent |
| Discussion topic | gidai | Topic/Agenda |
| Message stream | Message Stream | Message Stream |

---

## 6. Competitive Differentiation

| | cc-roundtable | LangGraph | CrewAI | AutoGen | Cursor | Warp |
|---|---|---|---|---|---|---|
| Color | Navy + Gold | Turquoise | Coral | MS Blue | Black + Blue | Purple/Blue |
| Tone | Scholarly | Technical | Energetic | Academic | Cool | Modern |
| Metaphor | Observatory | Lab/IDE | Builder | Research Lab | Editor | Terminal |
| Typography | General Sans | System sans | Barlow | Segoe UI | System sans | Hack |
| Archetype | Sage + Explorer | Creator/Sage | Explorer/Hero | Sage | Magician | Explorer |

**Unique position:** "Real-time AI discourse reader" -- conversation-flow UI as primary view (no competitor has this).

---

## 7. Implementation Priority

| Priority | Items | Impact |
|----------|-------|--------|
| 1 (Day 1) | Color tokens (CSS custom properties) | 80% visual identity |
| 2 (Day 1) | Font stack + type scale | Reading experience |
| 3 (Day 1) | Message bubble styling (3px left border) | Agent identity |
| 4 (Week 1) | Long-message collapsing (>80 lines) | Critical for real agent output |
| 5 (Week 1) | Motion system (180ms base) | "Alive" quality |
| 6 (Later) | Glassmorphism, ambient glow, icons | Polish |

---

## 8. Complete Variable List (42/42)

### Phase 1: Brand Foundation

| # | Variable | Value |
|---|----------|-------|
| 1 | brand_archetype | Sage |
| 2 | brand_archetype_secondary | Explorer |
| 3 | sincerity | 5 |
| 4 | excitement | 6 |
| 5 | competence | 9 |
| 6 | sophistication | 8 |
| 7 | ruggedness | 3 |
| 35 | formality_level | 7 |
| 38 | target_age_primary | millennial |
| 39 | cultural_context | japanese |
| 40 | accessibility_level | wcag-aa |
| 41 | design_tension | "Scholarly but alive" |

### Phase 2: Visual Language

| # | Variable | Value |
|---|----------|-------|
| 8 | color_primary | #1B2B3A |
| 9 | color_secondary | #5BA8A0 |
| 10 | color_accent | #D4A847 |
| 11 | color_harmony_type | Split-complementary |
| 12 | color_warmth | 4/10 |
| 13 | color_saturation_level | Muted |
| 14 | neutral_tone | Cool-gray |
| 15 | dark_mode_strategy | Dark-native |
| 16 | font_display | General Sans |
| 17 | font_body | Switzer |
| 18 | font_display_category | Sans-serif (geometric-humanist) |
| 19 | font_body_category | Sans-serif (neo-grotesque) |
| 20 | font_jp_category | Gothic (BIZ UDPGothic) |
| 21 | type_scale_ratio | 1.200 |
| 22 | type_base_size | 14px |
| 23 | spacing_base_unit | 6px |
| 24 | spacing_density | 7/10 |
| 25 | corner_radius_style | Soft precision (4-20px) |
| 26 | shadow_style | Ambient glow |
| 27 | elevation_levels | 4 |
| 28 | icon_style | Line, Lucide |
| 29 | icon_stroke_width | 1.5px |
| 30 | animation_style | Purposeful transitions |
| 31 | animation_duration_base | 180ms |
| 32 | illustration_style | Schematic/diagrammatic |
| 33 | visual_style | Observatory glassmorphism |
| 34 | information_density | 7/10 |
| 42 | photography_style | Not applicable |

### Phase 3: Tone of Voice

| # | Variable | Value |
|---|----------|-------|
| 36 | voice_humor | 2 |
| 37 | voice_enthusiasm | 3 |

---

## 9. Source Files

| File | Content |
|------|---------|
| `round-1/brand-foundation.md` | Archetype, personality, design principles, design tension |
| `round-1/competitor-analysis.md` | 5-company audit, positioning map |
| `round-1/user-psychology.md` | Cognitive analysis, emotional needs |
| `round-1/color-palette.md` | Full color system, WCAG verification, agent colors |
| `round-1/typography.md` | Font stack, scale, spacing, weight system |
| `round-1/visual-style.md` | Spacing, radius, elevation, icons, motion, bubbles |
| `round-1/tone-of-voice.md` | Voice matrix, UI copy examples, style guide |
| `round-1/critique.md` | Gate 1 + Gate 2 + Gate 3 assessments |

---

## 10. CSS Quick Reference

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

  /* Agent Identity */
  --color-agent-1: #5BA8A0;
  --color-agent-2: #D4A847;
  --color-agent-3: #9B8EC4;
  --color-agent-4: #C48A94;
  --color-agent-5: #7BAA8E;
  --color-agent-6: #C4956A;
  --color-agent-7: #7E9BB5;
  --color-agent-8: #B088A8;

  /* User */
  --color-user-accent: #D4A847;
  --color-user-message-bg: #3A3019;

  /* Font Families */
  --font-display: 'General Sans', 'BIZ UDPGothic', system-ui, sans-serif;
  --font-body: 'Switzer', 'BIZ UDPGothic', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;

  /* Type Scale (Minor Third 1.200) */
  --type-caption: 0.6875rem;  /* 11px */
  --type-small: 0.75rem;      /* 12px */
  --type-body: 0.875rem;      /* 14px */
  --type-sub: 1.0rem;         /* 16px */
  --type-heading: 1.25rem;    /* 20px */
  --type-display: 1.5rem;     /* 24px */

  /* Spacing */
  --space-2xs: 6px;
  --space-xs: 9px;
  --space-s: 12px;
  --space-m: 18px;
  --space-l: 24px;
  --space-xl: 36px;
  --space-2xl: 48px;

  /* Corner Radii */
  --radius-xs: 4px;
  --radius-s: 8px;
  --radius-m: 12px;
  --radius-l: 16px;
  --radius-xl: 20px;
  --radius-full: 999px;

  /* Elevation */
  --shadow-1: 0 0 0 1px rgba(42, 63, 84, 0.15);
  --shadow-2: 0 4px 24px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(42, 63, 84, 0.20);
  --shadow-3: 0 8px 40px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(42, 63, 84, 0.25);

  /* Motion */
  --duration-instant: 80ms;
  --duration-fast: 180ms;
  --duration-moderate: 280ms;
  --duration-slow: 400ms;

  /* Icons */
  --icon-stroke: 1.5px;
}
```

---

*Generated by app-tone-manner skill. 8 agents, 3 phases, 3 gates, 42 variables.*
