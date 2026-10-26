# Ohmlab design direction: "lab notebook at night"

This records why the UI changed in October 2026, what was wrong with it, and the decisions that replaced it. The
day-to-day rules live in `docs/DESIGN_SYSTEM.md`; the values live in `src/styles/tokens.css`.

## 1. Research summary: what reads as "AI-made"

Articles from 2026 on "AI slop" interfaces agree on a short list of tells. They are defaults, not mistakes, which is
why they show up together:

1. **Purple and indigo accents and gradients** (Tailwind's indigo default, violet focus rings, cyan→violet text).
2. **Inter as the only typeface**, or Inter plus one geometric grotesk, all set in bold.
3. **Three (or four) equal cards in a row** as the answer to every section.
4. **One exaggerated radius on everything**: pill buttons, pill badges, pill tabs, pill chips.
5. **Glassmorphism**: translucent, blurred panels over a glowing gradient.
6. **A centred hero over a dark gradient** with a glow behind it.
7. **ALL-CAPS, letter-spaced micro-labels** everywhere, often in mono.
8. Generic copy: exclamation marks in success states, "unleash", "seamless".

The fixes the same sources recommend are equally consistent: **one deliberate accent** with a reason to exist, **an
intentional display + body pairing**, **radii that change with nesting**, opaque layered surfaces with a little
texture, sentence-case labels, and plain specific copy. The method used here is the
`redesign-existing-projects` skill's audit checklist and fix order (font → colour → states → layout → components →
type polish).

## 2. Audit (before)

Screenshots: `scratchpad/design/before/*.png` at 1280 × 800 and 375 × 812 (home, lesson, Build step, Parts, ESP32
part page, Topics, Achievements, Settings, sign-in dialog).

1. **Every screen, `--brand: #a78bfa`**: the brand was Tailwind-adjacent violet, used for primary buttons, current
   nav item, progress, rings, eyebrows, focus rings and hover glows. The single strongest AI tell.
2. **Home, `.hero-accent`**: "experimenting" was cyan→violet gradient text.
3. **Every screen, `--font-display` / `--font-body`**: Space Grotesk + Inter, with JetBrains Mono. Headlines bold 700
   with heavy negative tracking.
4. **Every screen, `.panel`**: translucent gradient fill + `backdrop-filter: blur(10px)`; `.topbar` blurred and
   translucent; dialog backdrops blurred (`.signin::backdrop`, `.wiring-dialog::backdrop`, `.confirm::backdrop`).
5. **Every screen, `--radius-pill`**: 43 uses. `.btn`, `.topnav a`, `.step-btn`, `.chip`, `.segmented`, `.part-filter
   span`, `.part-chip`, `.topic-parts li`, `.stage-views`, `.acct-signin`, `.lab-segments`, `.quiz-button`,
   `.pv-zoom`, `.iso-tag`… Radii were otherwise 8/12/20 with no logic.
6. **Every screen, `.eyebrow`, `.lesson-meta`, `.step-count`, `.day-state`, `.topic-stats`, `.ach-status`,
   `.lesson-mastery-note`, `.checklist-detail`, `.blk-code-lang`**: small mono labels for words ("Trophy shelf",
   "Coming soon", "Locked", "steps read"). Uppercase tracked labels in `.pin-table thead`, `.pv-label`,
   `.iso-callout strong`, `.iso-legend strong`.
7. **Every screen, glows**: violet `box-shadow: 0 0 18–60px` on `.btn:hover`, `.btn-primary`, `.bench`, `.step-btn
   [aria-current]`, `.steps-glider`, `.phase-index`, `.phase-ticks`, `.day-live:hover`, `.topic-card:hover`,
   `.part-tile:hover`, `.part-filter :checked`, `.acct-avatar`, `.signin`, `.toast`, `.ring-value`, and a violet
   `text-shadow` on `.blk-formula-expr`. Glow had stopped meaning "signal or live control".
8. **Every screen, signal colours** at 100 % saturation (`#38e1ff`, `#ffc24b`, `#ff7a6b`, `#5ef2a0`) and
   `--sig-resistance` lavender `#c9a6ff` (purple again, also used for code keywords).
9. **Body background**: two radial lights (violet top right, cyan left) over the graticule, `background-attachment:
   fixed` (repaints on scroll in Chromium).
10. **Home, `.stats`**: three equal panels in a row ("Lessons completed / Average mastery / Streak").
11. **Home, `.part-feature-row`**: two equal featured parts, symmetric.
12. **Topics, `.topic-grid`**: seven equal cards in a 4 + 3 grid; "Coming soon" topics looked identical to live ones.
13. **Achievements, `.ach-grid`**: seven equal cards; locked and unlocked differ only by a border tint.
14. **Home, hero actions**: one filled pill + one ghost pill ("See the 100-day map"), and every section head ends in
    another ghost pill ("All topics", "All parts", "All achievements"): three button weights doing one job.
15. **Lesson, `.steps-meter`, `.topic-bar`**: cyan→violet gradient bars (cyan is reserved for current).
16. **Logo + favicon**: cyan→violet gradient zig-zag.
17. **Copy**: "Pop!", "Nice work, that's a pass!", "All challenges done!", "Too hot!", "…the one in your kit!", "live
    circuit" in lower case.

## 3. Decisions

### Type

| Role | Family | Use |
|---|---|---|
| Display | **Instrument Serif** 400 (+ italic) | `h1`, `h2`, phase titles, the wordmark. Sentence case, −0.01 to −0.02 em, line-height ~1.0–1.1, `text-wrap: balance`. One weight only: `font-synthesis-weight: none` so nothing is faux-bolded. One italic per page at most (the hero's *experimenting*, the wordmark's *lab*). |
| Body / UI | **IBM Plex Sans** 400 / 500 / 600 (+ 400 italic) | Everything else: `h3`/`h4`, buttons, nav, labels, card titles. Paragraphs max ~65 ch, `text-wrap: pretty`. |
| Numbers | **IBM Plex Mono** 400 / 500 | Meter readouts, values, units, code, step-number discs, day ranges. `tabular-nums`. Plex Sans backs it up for glyphs Plex Mono lacks (Ω). |

Scale: `--fs-xs 12`, `sm 14`, `md 16`, `lg 18`, `xl 24`, `2xl 36`, `3xl clamp(40–60)`, hero `clamp(48–92)`. Serif
section heads are 30 px (1.875 rem) so the serif is never set small. Part names (`.part-head h1`) stay in Plex 600:
model numbers like "V1", "1N4007" need an unambiguous 1/l, and Instrument Serif's 1 reads as l. Word labels that
were mono now use Plex Sans with `.num` (tabular figures).

### Palette (contrast computed, WCAG 2.x)

One cool graphite family (hue ~214°, saturation ≤ 14 %):

| Token | Hex | On `--surface-1` |
|---|---|---|
| `--bg` | `#0c0f13` | — |
| `--surface-1` | `#12161b` | — |
| `--surface-2` | `#181d23` | — |
| `--surface-3` | `#20262e` | — |
| `--text` | `#e6e8eb` | 14.8 : 1 |
| `--text-muted` | `#a2aab4` | 7.7 : 1 |
| `--text-faint` | `#7f8893` | 5.1 : 1 (4.2 on surface-3) |

One accent, **copper** ("a fresh solder pad"), for brand, primary actions, links, focus, selection and progress:

| Token | Hex | HSL saturation | Contrast |
|---|---|---|---|
| `--brand` | `#c98a5e` | 50 % | 6.3 on surface-1; `--brand-ink #1a0f08` on it 6.5 |
| `--brand-strong` (text, links, focus ring) | `#e0a77f` | 61 % | 8.7 on surface-1, 7.3 on surface-3 |

Signals, desaturated from 100 % to ≤ 74 % but kept apart:

| Token | Before | After | Sat. | On surface-1 | ΔE76 to copper |
|---|---|---|---|---|---|
| `--sig-current` | `#38e1ff` | `#5cc6dd` | 65 % | 9.2 | 70 |
| `--sig-voltage` / `--warn` | `#ffc24b` | `#e2b552` | 71 % | 9.5 | 29 |
| `--sig-power` | `#ff7a6b` | `#e9746a` | 74 % | 6.2 | 26 |
| `--ok` | `#5ef2a0` | `#6cc896` | 46 % | 8.9 | 61 |
| `--danger` | `#ff6b7d` | `#e5677f` | 71 % | 5.7 | 39 |
| `--sig-resistance` | `#c9a6ff` (lavender) | `#8ea9cc` (steel blue, the colour of the kit's metal-film resistor) | 38 % | 7.5 | — (ΔE 24 to current) |

Copper sits between amber and coral in hue, so it is kept quieter (50 % saturation, darker) than both and is never
used for an electrical quantity; ΔE ≥ 26 to every signal. No purple remains anywhere (code keywords moved to
`--brand-strong`).

### Surfaces, depth and texture

- **No glass.** `.panel` is opaque `--surface-1` with a 1 px hairline; the top bar is opaque `--bg`; dialog
  backdrops dim (84 %) without blur.
- **Layering by value**, not glow: bg → surface-1 (panels) → surface-2 (raised/hover) → surface-3 (selected).
  Things that have nothing to play yet (coming-soon phases, topics, locked achievements) go *flat*: transparent,
  dashed edge.
- **Tinted shadows, one light from above**: `--shadow-panel` and `--shadow-raised` use `rgba(3, 6, 11, …)` (the
  bg's hue), never neutral black, plus a 3–5 % top inner highlight.
- **Glow is for signals only** (current dots, lit LEDs, hotspots). Every brand glow was removed.
- **Graticule, quieter**: 40 px grid at 3.5 % (was 6 %), one low copper "desk lamp" radial top left (7 %), on a
  fixed `body::before` layer so scrolling never repaints it.
- **Grain**: `body::after`, fixed, `pointer-events: none`, one 160 px `feTurbulence` SVG tile as a data URI
  (`--grain`) at 5 % opacity, no blend mode. Rasterised once; costs nothing per frame (measured below).

### Shape

| Token | Value | Use |
|---|---|---|
| `--radius-lg` | 14 px | Containers: panels, cards, stage, dialogs |
| `--radius-md` | 8 px | Controls: buttons, nav items, step chips, inputs, filters, segmented frames |
| `--radius-sm` | 6 px | Inner rows and segments, meters, icon wells |
| `--radius-xs` | 4 px | Badges and chips (square-ish), inline code |
| `--radius-pill` | 999 px | Only where round means something: toggle tracks, dots, thin progress bars |

### States

- **Primary** `.btn-primary`: solid copper, dark ink, 1 px lighter top edge. Hover lightens toward
  `--brand-strong` with a short copper drop shadow; pressed moves 1 px down and drops the shadow.
- **Secondary** `.btn` / `.btn-ghost`: graphite with a hairline; hover lifts to surface-3 and a stronger edge.
- **Tertiary** `.link-arrow`: an underlined copper text link whose arrow nudges 3 px on hover (hero "See the
  100-day map", "All topics", "All parts", "All achievements").
- Pressed (`translateY(1px)`) on every button, chip, step, filter, segment, quiz option, lab control. Focus is a
  2 px `--brand-strong` outline, or for custom controls `--glow-brand` (2 px gap + 2 px copper ring).
- Selected segments and the Wiring/Simulator switch: surface-3 + hairline + a 2 px copper underline (a tab, not a
  glowing pill). Current nav item: copper icon + a 2 px copper rule on the bar's bottom edge.

### Layout changes

- Home stats: one ruled strip sized to its numbers instead of three equal cards.
- Home parts: ESP32 leads at 1.4 fr, the Uno sits beside it at 1 fr.
- Home phases: live phases are panels; coming-soon phases are flat outlines, so the map has a visible front.
- Topics (≥ 1024 px): a ledger, one ruled row per topic (index and days · title and summary · parts · progress),
  like a notebook's contents page. Phones keep stacked cards. Coming-soon topics recede.
- Achievements: locked badges are dashed outlines "waiting to be filled"; earned ones are solid with a copper top
  edge.

### Motion: untouched

Every animation, duration token, the view transitions, step glider, hero waves, 3D benches, zoomable parts and the
reduced-motion rules are unchanged. Only colours on them changed (the glider lost its glow).

### Copy

Exclamation marks removed where no test pins the text ("Pop.", "that's a pass.", "All challenges done.", "Too
hot.", "…in your kit."). "Correct!" (E2E contract) and "All done!" (unit test) are kept. "live circuit" →
"Live circuit".

## 4. Still different from the reference (learn-arduino)

| | Reference | Ohmlab now |
|---|---|---|
| Ground | Warm cream paper, navy ink | Cool graphite paper at night, a faint graticule and grain |
| Accent | Teal | Copper, one accent; signals keep fixed meanings (current cyan, voltage amber, power coral) |
| Type | Condensed, letter-spaced caps | Instrument Serif display in sentence case, Plex Sans body, Plex Mono numbers; no tracked caps |
| Main visual | Illustrated isometric board with hotspots | A live, solved circuit: 3D bench you can break, schematic whose dots move at the real current |
| Structure | Tabs about one board | A 100-day map, ledger of topics, guided lesson flow with the lab beside the text |
