# Brand Foundation: cc-roundtable (Meeting Room)

**Status:** Gate 1 PASS (2026-03-06)
**Post-discussion revision incorporating feedback from competitor-analyst, user-psychologist, and identity-critic Gate 1 rulings.**

---

## 1. Brand Archetype

### Primary: The Sage (賢者)

cc-roundtable is fundamentally about **understanding** -- making the invisible visible, illuminating the thought processes of AI agents in real time. The Sage archetype seeks truth and knowledge through observation, analysis, and insight. This maps directly to the core user motivation: developers don't just want to *use* AI agents, they want to **comprehend** how those agents think, argue, and arrive at decisions.

The "roundtable" metaphor itself is Sage-coded. It evokes the scholarly tradition of discourse -- from Arthurian legend's equal-among-peers to academic seminars and philosophical salons. The product positions the user not as a passive consumer but as an informed observer who can enter the discussion when insight calls for it.

**Why not The Magician?** While the product deals with AI (often coded as "magical"), cc-roundtable deliberately *demystifies* AI collaboration rather than mystifying it. The value proposition is clarity, not illusion.

**Competitive differentiation:** AutoGen Studio shares Sage-adjacent positioning but as a "research lab Sage" (prototyping/building). cc-roundtable is a "meeting room Sage" (observing/comprehending) -- a fundamentally different orientation.

### Secondary: The Explorer (探検家)

The secondary archetype captures the sense of **discovery** inherent in watching AI agents deliberate. Each meeting session is uncharted territory -- the user never knows exactly what the agents will discuss, what tangents they'll take, or what surprising solutions they'll propose. There's an element of voyeuristic curiosity: peering into a conversation you weren't supposed to hear.

The Explorer archetype also reflects the developer mindset: people who use Claude Code's Agent Teams are early adopters, experimenters who push boundaries. The product should feel like opening a door to an unexplored room.

**Sage x Explorer tension:** The Sage wants order and understanding; the Explorer wants novelty and surprise. This productive tension -- structured interface meeting unpredictable content -- is central to the experience and should be reflected in every design decision.

---

## 2. Aaker Brand Personality Scores (1-10)

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| **Sincerity (誠実性)** | 5 | Transparency-driven sincerity, not warmth-driven. The product is radically honest -- you see *exactly* what agents say, unfiltered. System state is displayed openly (connection health, agent activity, runtime events). This structural transparency IS the sincerity; the brand does not need to perform warmth on top. Mid-range score reflects: honest and transparent, but not approachable-for-its-own-sake. |
| **Excitement (刺激性)** | 6 | Expressed through **temporal liveness, not chromatic energy**. The real-time nature of agent conversations creates intellectual stimulation -- live data, unpredictable discourse, the thrill of watching thought unfold. This is the excitement of a live broadcast, not a fireworks show. Visually: subtle motion and state transitions, NOT saturated colors or bold animations. Distinct from CrewAI's energetic/vivid excitement. |
| **Competence (能力)** | 9 | The dominant dimension. cc-roundtable must feel **deeply capable and trustworthy** as a technical tool. Developers will judge it by precision, reliability, and the quality of information display. Every pixel should communicate "this tool knows what it's doing." Expert-grade, not enterprise-bland. Performance reliability (no dropped WebSocket messages, no scroll jank, instant rendering) falls here. |
| **Sophistication (洗練性)** | 8 | Expressed through **craft and restraint, not decoration**. Precise spacing and alignment (pixel-perfect grid), harmonious color relationships, typographic quality (excellent rendering, considered hierarchy, deliberate weight selection), and absence of visual noise. This is the developer's version of sophistication: the difference between a tool that looks "designed" and one that looks "well-engineered." We want the latter. |
| **Ruggedness (頑健性)** | 3 | Low by design. This is not a rugged, industrial tool. It's an observation space. The environment should feel curated and controlled, not raw. The only nod to ruggedness is the terminal pane -- a window into the raw CLI beneath the refined surface. Performance durability is Competence territory (scored 9), not Ruggedness. |

**Personality summary:** cc-roundtable is **the composed conductor's podium** -- a place of mastery, clarity, and quiet authority. Not a person, but a *space* that enables orchestration and observation. The user who opens cc-roundtable feels like they're stepping into a purpose-built environment for understanding.

---

## 3. Design Principles

### Principle 1: Lucid -- Every element serves comprehension

The interface exists to make complex multi-agent discourse **immediately legible**. No decoration for its own sake. Every visual choice -- color, spacing, typography, motion -- must answer: "Does this help the user understand what's happening right now?" Clarity is the product's core promise.

*In practice:* Information hierarchy is sacred. Agent identity is instantly distinguishable. Message flow reads naturally. Status indicators are unambiguous. When in doubt, remove rather than add.

### Principle 2: Poised -- Confidence expressed through restraint

The design carries authority not through boldness but through **composure**. Generous spacing, deliberate typographic hierarchy, muted color palettes with precise accent deployment. The interface should feel like it has nothing to prove -- it simply works, elegantly. Poise is also performance: a poised tool doesn't lag, stutter, or lose connection silently.

*In practice:* No attention-grabbing animations. No gratuitous gradients. Color accents are used surgically (status, identity, emphasis). Transitions are smooth and purposeful. The design "breathes."

### Principle 3: Alive -- Real-time dynamism within a calm frame

The product's soul is **liveness** -- messages streaming in, agents thinking, conversations unfolding. The design must honor this dynamism without becoming chaotic. Think of a calm aquarium: the glass is still, the water moves.

*In practice:* Subtle entrance animations for new messages. Gentle pulsing for active agents. Smooth scroll behavior. The container is stable; the content flows. Real-time updates feel organic, not jarring.

### Principle 4: Layered -- Depth reveals on demand

The UI operates at multiple levels of detail, with a clear hierarchy:

- **Surface (Layer 1):** Scholarly observation -- the chat view is the hero, optimized for reading and tracking multi-agent conversation flow. This is what users see 80% of the time.
- **Substrate (Layer 2):** Orchestration controls -- connection status, agent states, health indicators, terminal, meeting management. Present but secondary, available on demand.

*In practice:* Progressive disclosure is the default pattern. Collapsible sections, toggleable panels, information that appears when sought. The first impression is the conversation; expertise is rewarded with operational depth.

---

## 4. Design Tension (Core Contradiction Pair)

### "Scholarly but alive"

This is the single most important design guideline for cc-roundtable.

**Scholarly** captures the Sage archetype, the high Competence and Sophistication scores, the observatory/meeting room metaphor, and the intellectual weight of the product. It means: deliberate typographic hierarchy, muted palettes, considered layouts, a sense of composure and gravitas. The product should feel like a scholars' observatory -- purpose-built for focused observation of complex phenomena.

**Alive** captures the Explorer archetype, the real-time nature of the product, and the temporal excitement of live discourse. It means: responsive to change, dynamic content, presence indicators, the sense that things are happening *right now*. The product should feel like a living conversation, not a static document.

The tension is productive: too scholarly and the product becomes a static, lifeless archive. Too alive and it becomes a chaotic chat app. The sweet spot -- a calm, considered environment where dynamic thought unfolds in real time -- is what makes cc-roundtable unique.

**How this guides decisions:**

| Decision | Scholarly pull | Alive pull | Resolution |
|----------|---------------|------------|------------|
| Typography | Deliberate hierarchy, generous spacing, considered weight | -- | Scholarly quality through spacing, sizing, and hierarchy; sans-serif base (Gate 1 ruling) |
| Color | Muted, restrained palette | Accent colors for live state | Dark base with dual-accent system: cool (muted teal) + warm (amber/gold) |
| Motion | Minimal, dignified | Real-time feedback | Subtle transitions for state changes only; no decorative animation |
| Layout | Structured, grid-based | Adapts to content flow | Fixed frame with streaming content area; chat view as hero element |
| Information density | Clean, spacious | Show what's happening now | Progressive disclosure: scholarly reading surface (L1), orchestration depth (L2) |
| Agent identity | Consistent, composed | Distinct, recognizable | Per-agent color coding within a restrained palette |
| Sound/notification | Quiet, unobtrusive | Alert to new events | Optional, subtle audio cues (not default) |

### Supporting Tensions

These secondary tensions refine specific aspects of the design:

- **"Technical but humane"** -- The product is a developer tool built on WebSocket protocols and CLI processes, but it displays *conversations* between entities with names and personalities. The interface must honor both the technical substrate and the human-like discourse.

- **"Observant but participatory"** -- The primary mode is watching (80%), but the user can intervene (20%). The design should make observation the comfortable default while making participation feel natural and unintrusive. The InputBar must always be visible -- an "always available escape hatch," not a prompt to speak.

- **"Minimal but informative"** -- The surface is clean, but the product must convey a rich set of states (agent status, connection health, message flow, runtime events). Minimalism is achieved through hierarchy, not omission.

---

## 5. Positioning

### Governing Metaphors (Gate 1 ruling)

- **Visual language:** "Observatory" -- a place designed for focused observation of complex phenomena, operated by someone with expertise and intent. Calm, focused, technically elegant, purpose-built.
- **Interaction model:** "Meeting room" -- the user-facing frame. Users experience it as joining a meeting with participants, topics, and the ability to contribute. This governs InputBar, agent messages, topic framing.
- **NOT a dashboard:** cc-roundtable shows conversations, not metrics. But the information design principles of good dashboards (clear hierarchy, scannable, status-at-a-glance) apply to the infrastructure layer.

### Competitive Position

"Composed x Medium-minimal" -- not "Friendly" (which implies consumer warmth), not "Technical" (which implies IDE complexity). The product is *composed* -- controlled, intentional, and quietly confident.

Unique differentiator: "Real-time AI discourse reader" -- no competitor has a conversation-flow UI as their primary view. The chat view is not a feature of a bigger tool; it IS the product's signature interaction.

---

## Appendix: Archetype & Personality Quick Reference

```
Primary Archetype:   Sage (賢者)
Secondary Archetype: Explorer (探検家)

Sincerity:     5/10  ██████████░░░░░░░░░░  (transparency, not warmth)
Excitement:    6/10  ████████████░░░░░░░░  (temporal liveness, not vibrancy)
Competence:    9/10  ██████████████████░░  (dominant dimension)
Sophistication: 8/10 ████████████████░░░░  (craft and restraint)
Ruggedness:    3/10  ██████░░░░░░░░░░░░░░  (not part of brand voice)

Core Tension:  "Scholarly but alive"
Personality:   The composed conductor's podium
Position:      Composed x Medium-minimal
Metaphors:     Observatory (visual) + Meeting room (interaction)
```

---

## Appendix: Phase 1 Discussion Record

This document was refined through structured debate with competitor-analyst, user-psychologist, and identity-critic. Key evolutions:

1. **Sincerity** held at 5 after debate (competitor-analyst proposed 6-7 for competitive differentiation; user-psychologist proposed 4-5; resolved at 5 with "radical transparency" reframing)
2. **Excitement** held at 6 with qualitative clarification: temporal liveness, not chromatic energy (user-psychologist proposed 5; maintained at 6 as Explorer archetype contributes genuine discovery-thrill)
3. **Typography** evolved from full-Serif proposal to sans-serif base with scholarly quality through hierarchy/spacing (Gate 1 moderator ruling, overruling brand-strategist's Serif proposal due to cultural/technical risk)
4. **Positioning metaphor** evolved from "scholarly salon" to "Observatory + Meeting room" synthesis (Gate 1 moderator ruling, synthesizing all three agents' perspectives)
5. **Personality metaphor** evolved from "brilliant, composed colleague" (person) to "composed conductor's podium" (space) -- reflecting that the product is an environment, not a persona
6. **Accent color** direction converged across all agents toward cool-warm duality: muted teal + amber/warm gold, avoiding pure amber/orange (warning association) and pure cyan (LangChain overlap)
7. **Layer architecture** established: scholarly observation (surface/L1) > orchestration pride (substrate/L2), based on 80/20 observation/participation user behavior split
