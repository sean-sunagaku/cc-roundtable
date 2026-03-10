# Step 4 - Logo Design Notes (Meaning-First Redesign)

## Design Philosophy Shift

Steps 1-3 failed because we were ASSEMBLING logos (ring + sparkle + dot = logo).
Step 4 follows the opposite approach: the **overlap pattern itself** is the entire identity.

Core rule: if you can't say "this element exists because ___", it doesn't exist.

---

## V1: Confluence

**One-sentence meaning**: Three agents meet, and the shared space between them glows brightest.

**Describe it in one noun**: A convergence.

**Why each element exists**:
- Three filled circles: Each is one agent's "presence" at the roundtable. Filled (not stroked) because agents are substantial participants, not empty outlines.
- Pairwise overlap zones (brighter teal): Where two agents engage, something new emerges that neither has alone.
- Triple overlap center (brightest): The room. The shared understanding that only exists when all agents converge.
- No outlines, no dots, no sparkles: Nothing decorative. Only the intersection math of three overlapping presences.

**Why it reads as ONE symbol**: The eye is drawn to the bright center, with the three circles reading as a single trefoil/clover shape. The gradient from dark edges to bright center creates a unified radial composition.

**Colors**:
- Circle 1: `#0D9488` (teal 600)
- Circle 2: `#14B8A6` (teal 500)
- Circle 3: `#0F766E` (teal 700)
- Pairwise overlap: `#2DD4BF` (teal 400) at 40% opacity
- Triple overlap: `#5EEAD4` (teal 300) at 70% opacity

**SVG**: `logos/v1-confluence.svg`
**Dimensions**: 128x128, circles r=32, centers at (64,42), (44,76), (84,76)

---

## V2: Borromean Knot

**One-sentence meaning**: Three agents woven together — remove one and the meeting dissolves.

**Describe it in one noun**: A knot.

**Why each element exists**:
- Three rings: Each is an agent. Rings (not filled) because this concept is about CONNECTION, not presence.
- Over-under weave: The rings pass over and under each other, creating a single interlocked structure. This is the Borromean property: no two rings are linked, but all three together are inseparable. This IS the meeting — it only exists as a collective.
- Thick strokes (8px): Professional weight. Visible at small sizes. Confident, not delicate.
- Three subtly different teal shades: Each agent is distinct but harmonious.

**Why it reads as ONE symbol**: The weave creates a single knot form. The eye follows the over-under pattern as one continuous visual rhythm. Like the Celtic triquetra, it's perceived as a unified knot, not three separate circles.

**Colors**:
- Ring 1: `#0D9488` (teal 600)
- Ring 2: `#14B8A6` (teal 500)
- Ring 3: `#0F766E` (teal 700)
- Stroke width: 8px on all rings

**SVG**: `logos/v2-borromean-knot.svg`
**Dimensions**: 128x128, circles r=26, centers at (64,44), (46,76), (82,76)

---

## V3: Petals

**One-sentence meaning**: The individual agents are invisible — only the shared spaces they create are visible.

**Describe it in one noun**: A flower.

**Why each element exists**:
- Three petal-shaped intersection zones: These are the ONLY visible shapes. We don't draw the circles — we draw only where circles overlap. This inverts the usual approach: the meeting spaces are the design, not the participants.
- Bright center: Where all three petals converge — the room at its most concentrated.
- No outlines of the parent circles: Deliberately hidden. The point is that the "room" (shared space) matters more than the individuals.

**Why it reads as ONE symbol**: Without the parent circles visible, the intersection zones form a single three-petaled flower or trefoil shape. There are no separate "parts" — just one organic form.

**Colors**:
- Petal 1 (top-left): `#14B8A6`
- Petal 2 (top-right): `#0D9488`
- Petal 3 (bottom): `#0F766E`
- Center: `#5EEAD4`

**SVG**: `logos/v3-petals.svg`
**Dimensions**: 128x128, underlying circles r=32

---

## V4: Venn Glow

**One-sentence meaning**: Three points of light converge in darkness, illuminating the room where they meet.

**Describe it in one noun**: An illumination.

**Why each element exists**:
- Dark background (`#0C1222`): The room before the meeting begins. Also provides the app-icon context (dark mode native).
- Three radial gradient circles: Each agent is a source of light/knowledge. Gradients fade to transparent at edges — agents don't have hard boundaries, their influence diffuses.
- Additive light at convergence: Where lights overlap, the room brightens. This is physically accurate (additive color) and metaphorically correct (more perspectives = more clarity).
- Bright center point (`#CCFBF1`): The emergent understanding — brightest where all three contribute.
- Rounded rectangle backdrop: Ready for macOS app icon context.

**Why it reads as ONE symbol**: The dark background unifies everything. The three glows merge into a single luminous form with a bright core. It reads as "a glowing point" — one thing — not three separate circles.

**Colors**:
- Background: `#0C1222` (near-black blue)
- Glow 1 center: `#2DD4BF`, edge: `#0D9488`
- Glow 2 center: `#34D399`, edge: `#14B8A6`
- Glow 3 center: `#5EEAD4`, edge: `#0F766E`
- Convergence point: `#CCFBF1` at 80% opacity
- Corner radius: 24px

**SVG**: `logos/v4-venn-glow.svg`
**Dimensions**: 128x128, circles r=36, center convergence r=8

---

## V5: Negative Room

**One-sentence meaning**: Three agents surround and define a room — the room is the empty space they create between them.

**Describe it in one noun**: An aperture.

**Why each element exists**:
- Three thick arcs (not full circles): Each arc is an agent in motion, approaching the central meeting point. They sweep around it without closing, creating dynamic tension.
- Pinwheel/rotation arrangement: The arcs rotate around a shared center, creating a sense of gathering, of coming together. Like a camera aperture or turbine.
- Negative space triangle at center: This IS the room. Just as architectural walls define a room by enclosure, the arcs define the meeting room by surrounding it. The room is what's NOT drawn.
- Round caps: Warm, organic terminations — Claude's rounded, approachable character.
- No center marker: The room doesn't need to be marked. It's self-evident from the surrounding form.

**Why it reads as ONE symbol**: The three arcs form a single pinwheel/rotation motif. The visual rhythm (arc-gap-arc-gap-arc-gap) is continuous and unified. It reads as "a spinning thing" — one dynamic shape.

**Colors**:
- Arc 1: `#0D9488` (teal 600)
- Arc 2: `#14B8A6` (teal 500)
- Arc 3: `#0F766E` (teal 700)
- Stroke width: 10px, round caps

**SVG**: `logos/v5-negative-room.svg`
**Dimensions**: 128x128, arc radius 32px

---

## Comparison Matrix

| Concept | Core Metaphor | Element Count | 16px Legibility | Claude Feel | Uniqueness |
|---------|--------------|---------------|-----------------|-------------|------------|
| V1 Confluence | Overlapping presences | 3 shapes | Good (trefoil reads clearly) | Warm, organic | Medium (Venn is familiar) |
| V2 Borromean | Interlocked interdependence | 3 rings woven | Good (knot reads as one mark) | Craft, connection | High (Borromean is rare in tech) |
| V3 Petals | Shared space > individuals | 3+1 intersection zones | Good (flower is simple) | Organic, warm | High (inverted Venn is novel) |
| V4 Venn Glow | Light from convergence | 3 glows + background | Excellent (glow on dark) | Modern, sophisticated | Medium-High |
| V5 Negative Room | Room defined by absence | 3 arcs | Good (pinwheel reads clearly) | Dynamic, minimal | High (aperture metaphor) |

## Recommendation

**V3 Petals** or **V5 Negative Room** are the strongest candidates:
- V3 is the most conceptually pure (you literally see only the "room", not the "agents")
- V5 has the most dynamic energy and the strongest "one symbol" read
- V4 is the most polished for dark-mode app icon use

V2 Borromean Knot has the richest meaning but may be too subtle at small sizes.
