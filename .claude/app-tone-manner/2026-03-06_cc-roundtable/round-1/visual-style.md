# Visual Style System: cc-roundtable

**Author:** visual-style-architect
**Date:** 2026-03-06
**Status:** Round 1 / Phase 2G
**Governing metaphor:** Observatory
**Design tension:** "Scholarly but alive"

---

## 1. Spacing System (#23 spacing_base_unit, #24 spacing_density)

### Base Unit: 6px

A 6px base unit provides the granularity needed for a dense-but-structured information display. It divides evenly into common screen dimensions, produces clean multiples, and avoids the coarseness of 8px grids (which waste space in IDE-adjacent contexts) while preventing the chaos of 4px grids (which offer too many options).

### Spacing Scale

| Token | Value | Computed | Usage |
|-------|-------|----------|-------|
| `--space-2xs` | 1 unit | 6px | Inline icon gaps, tight element pairs |
| `--space-xs` | 1.5 units | 9px | Intra-component padding (badge inner, compact list item gap) |
| `--space-s` | 2 units | 12px | Default component inner padding, form field padding |
| `--space-m` | 3 units | 18px | Card/panel inner padding, section gaps within a card |
| `--space-l` | 4 units | 24px | Page-level padding, major section gaps |
| `--space-xl` | 6 units | 36px | Hero spacing, large separators |
| `--space-2xl` | 8 units | 48px | Page-level vertical rhythm breaks |

### Density Profile: "Structured dense"

The spacing density sits at approximately 7/10 -- denser than Linear, sparser than Grafana. This reflects:

- **Japanese design context**: Higher information density tolerance (user-psychology finding)
- **IDE-adjacent usage**: App competes for screen real estate; every pixel must earn its place
- **"Scholarly" pole**: Generous enough to breathe, creating the composure of a well-set page
- **"Alive" pole**: Dense enough that real-time message flow feels substantial, not lost in whitespace

**Density rules:**
- Chat messages: `--space-xs` (9px) gap between bubbles. Dense enough to read as conversation flow, loose enough to distinguish senders.
- Status indicators: `--space-2xs` (6px) between adjacent badges. Compact, scannable.
- Cards/panels: `--space-m` (18px) inner padding. Enough for the content to breathe without feeling hollow.
- Page margins: `--space-l` (24px). Matches current implementation.

---

## 2. Corner Radius System (#25 corner_radius_style)

### Style: "Soft precision"

Corner radii follow a deliberate hierarchy tied to component elevation and size. The approach avoids both the generic `8px-everything` of Material defaults and the pill-shaped excess of consumer apps. Radii are proportional to element scale -- larger elements get larger radii, small elements stay tight.

| Token | Value | Applied to |
|-------|-------|------------|
| `--radius-xs` | 4px | Inline badges, tiny indicators, code blocks |
| `--radius-s` | 8px | Buttons, form inputs, status badges, agent status pills |
| `--radius-m` | 12px | Message bubbles, health cards, list items, terminal pane |
| `--radius-l` | 16px | Cards, panels, chat view container, setup sections |
| `--radius-xl` | 20px | Hero panels, primary modal |
| `--radius-full` | 999px | Connection status pill, avatar circles, toggle switches |

### Design rationale

- **Current CSS analysis**: The existing implementation uses 10px (sections, inputs, health cards), 12px (bubbles, terminal), and 14px (cards, chat view). This system formalizes and slightly widens the range.
- **"Observatory" metaphor**: Instrument panels use precise, functional curves -- not playful circles. The radii are noticeable but never dominant.
- **Bubble treatment**: Message bubbles at 12px radius feel conversational without approaching the "rounded chat bubble" anti-pattern flagged by user-psychology. They read as structured content containers, not speech bubbles.

### Special cases

- **Code blocks within messages**: `--radius-xs` (4px). Tighter radius signals "this is structured content" distinct from the surrounding bubble.
- **Nested elements**: Inner radius = outer radius - padding. A card at `--radius-l` (16px) with `--space-m` (18px) padding contains children at approximately `--radius-xs` (4px) or no radius, preventing the visual dissonance of mismatched curves.

---

## 3. Shadow & Elevation System (#26 shadow_style, #27 elevation_levels)

### Style: "Ambient glow" (not drop shadow)

Traditional drop shadows feel outdated and skeuomorphic in a dark UI. The observatory metaphor calls for something more atmospheric: ambient glows that suggest depth through light emission rather than light occlusion. This aligns with the "ambient glow" trend identified in user-psychology Section 3.3.

### Elevation Levels: 4

Four levels provide sufficient hierarchy without over-complication. In a dark UI, elevation differences are expressed primarily through background opacity/lightness shifts and subtle glow, not shadow intensity.

| Level | Token | Background shift | Glow | Usage |
|-------|-------|-----------------|------|-------|
| **0 -- Base** | `--elevation-0` | Base background color | None | Page background, inset areas |
| **1 -- Surface** | `--elevation-1` | +3% lightness | `0 0 0 1px rgba(border-color, 0.15)` | List items, message bubbles, health cards |
| **2 -- Raised** | `--elevation-2` | +5% lightness | `0 4px 24px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(border-color, 0.2)` | Cards, panels, chat view container |
| **3 -- Floating** | `--elevation-3` | +8% lightness | `0 8px 40px rgba(0, 0, 0, 0.35), 0 0 1px rgba(border-color, 0.25)` | Modals, dropdowns, tooltips, floating panels |

### Glow system (the "alive" dimension)

Beyond elevation, active/live elements receive a subtle colored glow that communicates state:

| State | Glow treatment |
|-------|---------------|
| Active agent | `0 0 12px rgba(agent-color, 0.15)` -- barely perceptible halo |
| Human message | `0 0 16px rgba(accent-warm, 0.10)` -- warm presence |
| Connection OK | `0 0 8px rgba(status-green, 0.12)` -- alive signal |
| Error state | `0 0 12px rgba(danger, 0.15)` -- alert without alarm |
| Hover (interactive) | `0 0 8px rgba(accent-cool, 0.10)` -- acknowledges interaction |

### Implementation note

The current CSS uses `box-shadow: 0 18px 60px rgba(0, 0, 0, 0.26)` on `.hero` and `.panel` in the web client. This is close to elevation-2 but slightly heavy. The refined system uses softer, more layered shadows with the hairline border (`0 0 0 1px`) as the primary depth cue (consistent with glassmorphism convention).

---

## 4. Icon System (#28 icon_style, #29 icon_stroke_width)

### Style: "Line icons, geometric construction"

**Recommended icon set: Lucide**

Rationale:
- **Open source**: MIT license, no vendor dependency
- **Consistent geometric construction**: All icons share a 24x24 grid with uniform stroke weight
- **Developer ecosystem fit**: Already widely adopted in React/TypeScript projects (Lucide React)
- **Completeness**: Covers all necessary categories -- status indicators, navigation, actions, system states
- **Not Phosphor**: Phosphor is excellent but heavily associated with Linear's design language. Lucide maintains independence while sharing the same quality tier.

### Stroke width: 1.5px

| Property | Value | Rationale |
|----------|-------|-----------|
| **Default stroke** | 1.5px | Crisp at 16-20px display size without feeling fragile. The "scholarly" pole demands precision; 2px feels heavy for this aesthetic. 1px feels too thin on non-Retina displays. 1.5px is the precise middle. |
| **Small icons (12-14px)** | 1.75px | Slightly thicker to maintain legibility at small sizes (status indicators, inline icons) |
| **Large icons (24px+)** | 1.25px | Slightly thinner to prevent visual heaviness at large scale |

### Icon usage guidelines

- **Prefer text over icons where meaning is ambiguous**. Developers trust text labels (user-psychology finding). Icons supplement, never replace, critical labels.
- **Status icons**: Use filled circles (not outline) for agent status -- the fill carries the semantic color. Outlined circles at 1.5px are too subtle for peripheral scanning.
- **Action icons**: Line style. Buttons pair icon + text label. Icon-only buttons are reserved for universally understood actions (close, minimize, settings gear).
- **No custom illustration icons**: Every icon comes from the Lucide set. Custom icons introduce visual inconsistency and maintenance burden.

### Key icon mappings

| Function | Icon | Notes |
|----------|------|-------|
| Agent active | `circle` (filled, agent color) | Status dot |
| Agent completed | `check-circle` (filled, success) | Completion |
| Connection OK | `wifi` | Network state |
| Connection error | `wifi-off` | Network state |
| Send message | `send` | Input bar action |
| Settings | `settings` | Gear icon |
| Terminal | `terminal` | Toggle terminal view |
| Collapse/expand | `chevron-down` / `chevron-up` | Progressive disclosure |
| Meeting topic | `message-square` | Contextual |
| Pause/resume | `pause` / `play` | Meeting controls |
| Stop meeting | `square` | Meeting controls |

---

## 5. Motion & Animation System (#30 animation_style, #31 animation_duration_base)

### Style: "Purposeful transitions"

The Gate 1 directive is explicit: **"purposeful transitions for state change only; no decorative animation."** Every animation must answer: "What state change am I communicating?" If the answer is "none -- it just looks nice," remove it.

### Duration base: 180ms

| Token | Value | Easing | Usage |
|-------|-------|--------|-------|
| `--duration-instant` | 80ms | `ease-out` | Hover states, focus rings, micro-feedback |
| `--duration-fast` | 180ms | `ease-out` | Button transitions, badge state changes, toggle switches |
| `--duration-moderate` | 280ms | `cubic-bezier(0.25, 0.1, 0.25, 1)` | Panel expand/collapse, message entrance, modal appear |
| `--duration-slow` | 400ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Page transitions, large panel animations |

### Why 180ms base (not 200ms or 300ms)

- 200ms+ creates perceptible lag for developers who are wired to expect instant response
- 150ms or less can feel jarring/snappy for anything beyond hover
- 180ms is the threshold of "felt but not waited for" -- the transition registers as intentional without introducing perceived delay
- This deliberately avoids the "one-size-fits-all 300ms ease-in-out" anti-pattern

### Animation catalog

| State change | Animation | Duration | Notes |
|--------------|-----------|----------|-------|
| **New message appears** | Slide up 8px + fade in | `--duration-moderate` | The "alive" heartbeat of the app. Messages should feel like they *arrive*, not *appear*. |
| **Agent status change** | Color crossfade | `--duration-fast` | Smooth transition from one state color to another |
| **Panel expand/collapse** | Height transition + content fade | `--duration-moderate` | Progressive disclosure animation. Content fades in 60ms after panel reaches full height. |
| **Connection state change** | Color pulse (1x) | `--duration-slow` | Single pulse to draw attention, then settle. Not repeating. |
| **Hover on interactive** | Background color shift | `--duration-instant` | Immediate feedback |
| **Button press** | Scale 0.97 + release | `--duration-instant` | Tactile feedback without bounce |
| **Modal appear** | Fade in + scale from 0.96 | `--duration-moderate` | Centered entry, no slide direction |
| **Toast/notification** | Slide in from edge + fade | `--duration-moderate` | Enter from relevant edge (top for global, bottom for input feedback) |
| **Scroll to new message** | Smooth scroll | `--duration-slow` | Auto-scroll uses CSS `scroll-behavior: smooth` |
| **Active agent glow** | Opacity pulse 0.10-0.20, 3s cycle | Continuous, `ease-in-out` | The ONE ambient animation. Barely visible. Communicates "this agent is currently generating." Respects `prefers-reduced-motion`. |

### Animations that do NOT exist

- No page load animations (content appears immediately)
- No staggered list entrance (all items appear together)
- No decorative particle effects
- No skeleton loading screens (use a single, static spinner if needed)
- No parallax or scroll-linked effects
- No bouncing, wobbling, or springy easing

### `prefers-reduced-motion` handling

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

All animations degrade to instant state changes. No functional information is lost.

---

## 6. Illustration & Photography Style (#32 illustration_style, #42 photography_style)

### Illustration style: "Schematic / diagrammatic"

cc-roundtable does not need illustrations in the traditional sense. The product is a technical tool; its visual richness comes from the live conversation data and the information architecture, not from decorative imagery.

If illustrations are ever needed (onboarding, empty states, documentation):

- **Style**: Technical diagrams, not character illustrations. Think architectural blueprints or observatory schematics -- line drawings with geometric precision.
- **Execution**: Monochrome (using the muted text color) with a single accent color highlight for the focal element.
- **Grid**: Constructed on the same 6px grid as the UI. Illustrations should feel like they belong to the interface, not pasted on top.
- **No**: unDraw, Humaaans, Blush, or any character illustration library. These introduce a casual, consumer tone that conflicts with the Sage archetype.
- **No**: Abstract gradient blobs, mesh backgrounds, or decorative patterns. The radial gradient on the body background is the maximum decorative allowance.

### Empty state treatment

When no content is available (no messages, no agents connected), the empty state uses:
- A single Lucide icon (muted, 48px) centered in the container
- One line of text below, in muted color
- No illustration, no animation, no call-to-action button

Example: An empty chat view shows a `message-square` icon with "Waiting for agents to join..." beneath it. Restrained, informative, not playful.

### Photography style: "Not applicable"

This product has no photography use case. Agent avatars are geometric/abstract (see Section 8). The app does not display user photos, stock images, or decorative photography.

If photography is ever required for marketing/landing pages:
- **Direction**: High-contrast, dark-toned, architectural or astronomical photography (observatory metaphor). Think telescope interiors, dark reading rooms, control panels.
- **Treatment**: Desaturated, overlaid with the dark background tint, used as texture rather than focal content.
- **Never**: Smiling people at computers, team photos, lifestyle shots. These conflict with the product's tool-first identity.

---

## 7. Message Bubble Style

### Structure

```
+-- bubble container (elevation-1, --radius-m) --+
| +-- header row --------------------------------+ |
| |  [color dot] Agent Name        12:34:56      | |
| +----------------------------------------------+ |
| +-- body ---------------------------------------+ |
| |  Message content with Markdown rendering...    | |
| |  ```code blocks at --radius-xs```              | |
| +------------------------------------------------+ |
+--------------------------------------------------+
```

### Visual treatment by sender type

| Sender | Left border | Background | Glow |
|--------|------------|------------|------|
| **Agent** | 3px solid, agent's identity color | `--elevation-1` base (semi-transparent) | None (unless agent is actively generating) |
| **Human** | 3px solid, accent-warm color | `--elevation-1` base, shifted +2% lightness | Subtle warm glow: `0 0 16px rgba(accent-warm, 0.08)` |
| **System** | None | `--elevation-0` (inset, dimmer) | None |

### Why left border (not full background tint)

- **Scanning efficiency**: A colored left border is visible in peripheral vision during rapid scrolling. It creates a vertical "lane" that the eye can track without reading text.
- **Color restraint**: Full background tints for each agent would create a patchwork quilt effect. The left border confines color to a narrow, intentional strip.
- **Scholarly composure**: The message body remains consistent across all senders -- only the border differentiates. This maintains the reading-focused surface.
- **Accessibility**: The 3px border provides a non-text visual differentiator that doesn't rely on background color contrast (WCAG requirement for non-color-only information).

### Bubble header

- **Agent name**: Semi-bold weight, in the agent's identity color
- **Color dot**: 8px filled circle in agent's identity color, preceding the name. Provides redundant identity signal (color + text).
- **Timestamp**: Muted color, right-aligned, `--font-size-xs` (11px)
- **Status badge** (if agent is active): Small animated dot after the name, pulsing at 3s cycle

### Human message distinction

Human messages must feel authoritative -- "this message has weight" (user-psychology finding). The distinction is achieved through:
1. Warm accent left border (vs agents' cool-spectrum colors)
2. Slightly lighter background
3. Subtle warm glow (the only glow on non-active elements)
4. Name displays as "You" in the accent-warm color

### Code blocks within bubbles

- Background: `--elevation-0` (darkest, inset)
- Border radius: `--radius-xs` (4px)
- Font: Monospace at body size
- Horizontal overflow: scroll with custom thin scrollbar
- No border; depth is communicated by background darkness alone

---

## 8. Per-Agent Color Identity System

### Philosophy

Each agent in the meeting receives a distinct color identity that persists throughout the session. The colors are drawn from a curated palette designed to:

1. Be distinguishable from each other on the dark background
2. Avoid semantic collision (no red/green for non-status purposes)
3. Maintain the muted, scholarly palette -- no neon, no full saturation
4. Pass WCAG-AA contrast ratio on dark backgrounds for text usage
5. Feel like they belong to the same "observatory" -- instruments in one control panel

### Agent color palette

The palette provides 8 distinct colors, ordered by assignment priority. Most meetings have 2-5 agents; colors 6-8 are reserved for larger groups.

| Slot | Name | Hex | HSL | Character |
|------|------|-----|-----|-----------|
| 1 | **Nebula blue** | `#6BA3D6` | hsl(210, 55%, 63%) | Cool, composed -- the default "first agent" color. Reads as primary/neutral. |
| 2 | **Patina teal** | `#5DB8A9` | hsl(168, 42%, 54%) | Organic warmth within cool spectrum. Distinct from blue but harmonious. |
| 3 | **Quartz violet** | `#9B8EC4` | hsl(252, 35%, 66%) | Scholarly, distinctive. Avoids the "warning" zone entirely. |
| 4 | **Sandstone rose** | `#C48B8B` | hsl(0, 33%, 66%) | Warm anchor. Low enough saturation to avoid "error red" association. |
| 5 | **Brass amber** | `#C4A85D` | hsl(44, 47%, 57%) | Warm gold tone. Close to the accent-warm color but desaturated for agent use. |
| 6 | **Lichen green** | `#7DB88B` | hsl(138, 30%, 60%) | Natural, restrained green. Distinguished from "success green" by its muted quality. |
| 7 | **Slate cyan** | `#6BB5C4` | hsl(190, 42%, 59%) | Cool variant between blue and teal. |
| 8 | **Heather mauve** | `#B08EAF` | hsl(301, 21%, 62%) | Soft purple-pink, for the rare 8th agent. |

### Color assignment rules

1. Colors are assigned in slot order (1, 2, 3...) as agents join the meeting.
2. The **human user** always receives the accent-warm color (not from this palette). The human is visually distinct from all agents.
3. If an agent disconnects and reconnects, it retains its original color assignment.
4. The team-lead agent (if present) receives slot 1 by convention.

### Visual expression of agent identity

The agent color appears in exactly four places per agent -- no more, preventing color noise:

1. **Left border of message bubble** (3px solid)
2. **Agent name text** in bubble header (semi-bold, agent color)
3. **Status dot** (8px filled circle: in status row AND in bubble header)
4. **Tab indicator** (when the agent's tab is active in the tab list)

The agent color does NOT appear in:
- Message body text (always the base text color)
- Message background (always the standard elevation-1)
- Icons within messages (always muted or base text color)

### Avatar system

Each agent gets a geometric avatar: a 28px circle filled with the agent's identity color, containing the first letter of the agent's role name in the dark base color.

```
+-------+
|       |
|   P   |   <-- "P" for "product-manager", in dark base color
|       |   <-- Circle filled with agent's identity color
+-------+
```

For the human user: same circle but with the accent-warm fill color, containing "Y" (for "You") or a user icon.

---

## 9. Global Visual Style (#33 visual_style)

### Style: "Observatory glassmorphism"

A dark, atmospheric interface built on semi-transparent layers with subtle depth cues. The governing visual impression is of looking through instrument panels at live data -- controlled, precise, but with a sense of the vast activity happening beneath.

### Core principles

1. **Dark base with atmospheric gradients**: The body background uses two or three soft radial gradients (cool + warm accent colors at very low opacity) to create a sense of spatial depth. This is the "observatory dome" -- the outermost layer.

2. **Semi-transparent panels**: All cards, containers, and panels use `rgba()` backgrounds with `backdrop-filter: blur(12-16px)`. This creates the layered, glassy depth that distinguishes the aesthetic from flat dark themes. Transparency values range from 0.65-0.85 depending on elevation.

3. **Hairline borders as structure**: 1px borders at low opacity (`rgba(border-color, 0.15-0.30)`) define panel edges. These are structural, not decorative -- they communicate container boundaries without visual weight.

4. **No decorative gradients on elements**: Gradient usage is restricted to the body background and the occasional button highlight. Cards, panels, and content areas are flat (single color) or semi-transparent. The anti-pattern of "gradient mesh on every surface" is explicitly rejected.

5. **Monochromatic surfaces, chromatic accents**: The vast majority of the UI is shades of the dark base color. Color enters only through accent colors (agent identity, status indicators, interactive highlights). This ensures that when color appears, it carries meaning.

### Background treatment

```css
body {
  background:
    radial-gradient(ellipse at 12% 8%, rgba(cool-accent, 0.18), transparent 35%),
    radial-gradient(ellipse at 85% 25%, rgba(warm-accent, 0.12), transparent 30%),
    var(--color-base);
}
```

Two ambient glows: a larger cool glow (top-left) and a smaller warm glow (top-right). These are permanently fixed -- they do not animate, scroll, or respond to interaction. They provide atmospheric depth and a sense of environment without becoming a distraction.

### Panel treatment (glassmorphism spec)

```css
.panel {
  background: rgba(var(--color-surface-rgb), 0.72);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(var(--color-border-rgb), 0.20);
  border-radius: var(--radius-l);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.20);
}
```

### Information density (#34)

**Value: 7/10 -- "Structured dense"**

- Dense enough for the developer's information-scanning needs and the Japanese cultural context
- Structured enough to maintain the scholarly composure
- The chat view is the densest area (messages stacked at 9px gaps)
- Status/control areas use more generous spacing (18px inner padding)
- Progressive disclosure keeps the default view clean while revealing depth on demand

### What this style is NOT

- **Not flat Material**: Material's uniform elevation with drop shadows doesn't apply to dark glassmorphism
- **Not Neumorphism**: No convex/concave illusions, no embossed surfaces
- **Not Glassmorphism-maximalist**: We use semi-transparency and blur, but not the frosted-glass-over-colorful-background treatment popularized by Apple. Our backgrounds are dark, so the blur effect is subtle.
- **Not Terminal-retro**: Despite the monospace code areas, this is not a retro-terminal aesthetic (no scanlines, no CRT effects, no green-on-black)

---

## 10. Variable Summary

| # | Variable | Value | Rationale |
|---|----------|-------|-----------|
| 23 | `spacing_base_unit` | 6px | Granular enough for dense info display, clean multiples, avoids 8px coarseness |
| 24 | `spacing_density` | 7/10 "Structured dense" | Japanese context + IDE-adjacent use + scholarly composure balance |
| 25 | `corner_radius_style` | "Soft precision" -- 4/8/12/16/20px scale | Proportional to element size, avoids generic 8px-everything |
| 26 | `shadow_style` | "Ambient glow" -- colored glows + hairline borders, not drop shadows | Dark UI depth through light emission; observatory atmosphere |
| 27 | `elevation_levels` | 4 (Base / Surface / Raised / Floating) | Sufficient hierarchy; expressed through lightness shift + glow, not shadow intensity |
| 28 | `icon_style` | Line icons, geometric construction (Lucide) | Open source, consistent, developer ecosystem native |
| 29 | `icon_stroke_width` | 1.5px (default), 1.75px (small), 1.25px (large) | Precision without fragility; scholarly sharpness |
| 30 | `animation_style` | "Purposeful transitions" -- state-change only, no decoration | Gate 1 binding directive; "alive" through content, not container |
| 31 | `animation_duration_base` | 180ms | Below perception-of-delay threshold; avoids 300ms anti-pattern |
| 32 | `illustration_style` | "Schematic / diagrammatic" -- technical line drawings, no character illustration | Sage archetype; tool identity; rejects unDraw/Humaaans |
| 33 | `visual_style` | "Observatory glassmorphism" -- dark, layered, semi-transparent, atmospheric | Synthesizes metaphor + existing CSS + developer trends |
| 34 | `information_density` | 7/10 "Structured dense" | Japanese context, IDE-adjacent, 80% observation mode |
| 42 | `photography_style` | "Not applicable" (if ever needed: dark architectural/astronomical, desaturated) | Product has no photography use case |

---

## 11. Design Token Quick Reference (CSS)

```css
:root {
  /* Spacing */
  --space-2xs: 6px;
  --space-xs: 9px;
  --space-s: 12px;
  --space-m: 18px;
  --space-l: 24px;
  --space-xl: 36px;
  --space-2xl: 48px;

  /* Corner radii */
  --radius-xs: 4px;
  --radius-s: 8px;
  --radius-m: 12px;
  --radius-l: 16px;
  --radius-xl: 20px;
  --radius-full: 999px;

  /* Elevation shadows */
  --shadow-1: 0 0 0 1px rgba(var(--color-border-rgb), 0.15);
  --shadow-2: 0 4px 24px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(var(--color-border-rgb), 0.20);
  --shadow-3: 0 8px 40px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(var(--color-border-rgb), 0.25);

  /* Motion */
  --duration-instant: 80ms;
  --duration-fast: 180ms;
  --duration-moderate: 280ms;
  --duration-slow: 400ms;
  --ease-default: ease-out;
  --ease-moderate: cubic-bezier(0.25, 0.1, 0.25, 1);
  --ease-expressive: cubic-bezier(0.16, 1, 0.3, 1);

  /* Icon */
  --icon-stroke: 1.5px;
  --icon-size-s: 16px;
  --icon-size-m: 20px;
  --icon-size-l: 24px;

  /* Agent colors */
  --agent-1: #6BA3D6; /* Nebula blue */
  --agent-2: #5DB8A9; /* Patina teal */
  --agent-3: #9B8EC4; /* Quartz violet */
  --agent-4: #C48B8B; /* Sandstone rose */
  --agent-5: #C4A85D; /* Brass amber */
  --agent-6: #7DB88B; /* Lichen green */
  --agent-7: #6BB5C4; /* Slate cyan */
  --agent-8: #B08EAF; /* Heather mauve */
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 12. Relationship to Other Phase 2 Deliverables

### Dependencies on color-expert
- The agent color palette (#1-8) should be validated against the final color system for harmony with the primary/secondary accents and the dark base.
- The `accent-warm` and `accent-cool` referenced throughout this document will be defined by color-expert. The visual style system is designed to accept any values in the muted teal + warm gold range established by Gate 1.

### Dependencies on typography-director
- Bubble header agent names reference "semi-bold weight" -- the exact weight depends on the selected typeface.
- Font size scale (`--font-size-xs` at 11px for timestamps) should align with the typography system.
- Code block styling depends on the selected monospace typeface.

### What this document provides to other agents
- **Spacing system**: All agents should use the 6px-base token scale for their elements.
- **Radius system**: Typography-director's input field styling should use `--radius-s` (8px).
- **Motion tokens**: Color-expert's status color transitions should use `--duration-fast` (180ms).
- **Agent color palette**: Color-expert should validate or adjust these values within their broader palette work.

---

*This document constitutes the Phase 2G visual style deliverable for cc-roundtable Round 1.*
