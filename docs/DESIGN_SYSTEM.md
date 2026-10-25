# Ohmlab Design System

**Identity: night lab.** A dark blue-black bench with an oscilloscope graticule, where the only bright things are signals and the things you can touch. If something glows, it either carries meaning (a signal) or responds to you (a control).

All values live in `src/styles/tokens.css`. Never write a raw hex value anywhere else. Translucent variants are made with `color-mix(in srgb, var(--token) N%, transparent)`.

## 1. Colour roles

| Token | Role | Allowed | Never |
|---|---|---|---|
| `--bg` | Page background, scope screens (formula, bench SVG) | Under the 40 px graticule (`--bg-grid`) | As a panel fill |
| `--surface-1/2/3` | Panels, tiles, inputs, from lowest to highest | `1` inputs/inner wells, `2` cards and buttons, `3` raised/selected states | Text |
| `--border`, `--border-strong` | Panel edges; strong = interactive or selected | Every panel has a 1 px border | Thicker than 1 px, except 2–3 px signal accents |
| `--text` | Body text, headings, values | Everywhere | — |
| `--text-muted` | Secondary copy, labels, captions | Taglines, `dt`, help text | Body paragraphs |
| `--text-faint` | Tertiary: day numbers, footer, "Coming soon" tiles | ≥ 12 px only | Anything the learner must read to continue |
| `--brand`, `--brand-strong`, `--brand-ink` | Ohmlab violet: primary actions, current position, progress, focus | Primary buttons, `aria-current`, rings, progress bars, focus ring, eyebrows | Electrical quantities |
| `--sig-current` (cyan) | **Current only**: flow dots, current readouts, active walkthrough step (it traces current in the lab), "on" switch | Diagrams, meters, walkthrough highlights | Decoration unrelated to current |
| `--sig-voltage` (amber) | **Voltage only**: sources, voltage readouts, walkthrough maths, objective bullets (bolt icon) | Diagrams, meters, maths | Warnings (use `--warn`) |
| `--sig-power` (coral) | **Power/heat**: power readouts, streak flame, open-circuit endpoints | Meters, heat states | Errors (use `--danger`) |
| `--sig-resistance` | Resistor bodies | Diagrams | UI chrome |
| `--sig-ground` | Wires and ground | Diagrams, 404 trace | — |
| `--ok`, `--warn`, `--danger`, `--info` | Feedback: done/complete, careful, destructive/burnt, neutral note | Callouts, completion states, Reset button, burnt LED | As brand colour |

Rules: one signal colour = one meaning, in diagrams, meters and text alike. Never put two signal colours on the same element. A red LED glows in `--danger` because that *is* its light; that is the only physical-colour exception.

## 2. Type

| Use | Family | Size token | Weight |
|---|---|---|---|
| Hero line | Space Grotesk (`--font-display`) | `clamp(2.5rem, 5.6vw, 4.6rem)` (hero only) | 700, −0.035em |
| Page `h1` | display | `--fs-3xl` | 700, −0.03em |
| Section `h2` | display | `--fs-2xl` | 700, −0.02em |
| Card `h3` | display | `--fs-xl` / `--fs-lg` | 600–700 |
| Body | Inter (`--font-body`) | `--fs-md`; lesson prose 17 px, line-height 1.7 | 400 |
| Labels, help | body | `--fs-sm` | 400–500 |
| **Every measured value, unit, day number, step number** | JetBrains Mono (`--font-mono`) | `--fs-xs` … `--fs-2xl` | 400 / 600, `tabular-nums` |

Electrical values are always produced by `formatSI` and always set in mono. No letter-spaced uppercase labels; eyebrows are small mono in `--brand-strong`.

## 3. Space, shape, depth

- Spacing scale `--sp-1…7` (4, 8, 12, 16, 24, 32, 48 px). Panels pad `--sp-5` (24 px), `--sp-4` on phones. Page sections are separated by `--sp-7 + --sp-4` (64 px).
- Radii: `--radius-sm` small chips/rows, `--radius-md` tiles and inputs, `--radius-lg` panels, `--radius-pill` buttons and step chips.
- Depth = `--shadow-panel` + a 1 px border + a top-lit gradient (`surface-2 → surface-1`). Glow (`0 0 N px color-mix(brand 25–35 %)`) only on interactive or live elements.
- Background: `--bg` + 40 px graticule (matches the 1 grid unit of the circuit layout) + two faint radial lights (violet top right, cyan left).

## 4. Components and states

| Component | Where | States |
|---|---|---|
| `.btn` (+ `-primary`, `-ghost`, `-danger`) | `src/ui/ui.css` | hover: brand border + glow; active: 1 px down, 0.98 scale; disabled: 45 % opacity, no glow; focus: ring |
| `.panel` | glassy card | static; selected/unlocked variants tint the border with brand |
| `.chip` (`data-tone=ok|brand`) | small mono status | — |
| `ProgressRing` | `src/ui/primitives.tsx`, `role="img"` "Mastery N %" | brand; turns `--ok` at 100 % |
| `Icon`, `LogoMark` | inline SVG, `aria-hidden` | inherit `currentColor` |
| `.segmented` | radio group as pill switch (hero bench) | checked: surface-3 + brand inset ring; focus ring on the visible pill |
| `.switch` | checkbox as toggle (Settings) | checked: cyan track (it controls current animation) |
| Day tile `.day-live` | phase map link | not-started / in-progress (% + bar) / complete (green, check); hover lifts 2 px |
| Day tile `.day-soon` | not a link | dashed border, faint text, "Coming soon" |
| Step chip `.step-btn` | lesson step nav | unseen (outline number) / seen (violet number) / done (green check) / current (`aria-current="step"`, raised + glow) |
| Walkthrough step | `aria-pressed` button | active: cyan border + glow, highlights parts in the lab (and expands a collapsed mini-stage). The step text is one inline `<span>` so bold words never break the line |
| Callout | `role="note"` | tone tip (`--ok`), warn (`--warn`), info (`--info`) as a 3 px left rule |
| Predict card `.blk-predict` | `predict` block, violet-tinted card "Predict first" | radio group (fieldset/legend = prompt) + "Lock in my guess" (disabled until a choice, so arrow keys never commit by accident). Locked: options disable, the picked one turns `--warn` (wrong) and the correct one `--ok`; a reveal panel takes focus with the picked option's `why`, "The answer: …" when missed, and "Try it in the lab" with an arrow pointing at the stage (left on desktop, up on phones). Kind wording, nothing stored |
| Completion checklist `.checklist` | lesson header and the Build step, `role="group"` "To complete this lesson" | pills "Quiz ≥ 80 %" (best score or "not taken yet") and "Lab challenges n / m", ✓ (`--ok`) or ✗ (muted); "Go to challenges" expands the stage, opens the Lab's challenge tray and focuses its summary |
| Build guide | Build step | warn callout "Before you plug anything in" listing every safety line first; parts as a checkbox grid with "n / m ready" (component state only); steps as a list with cyan mono number discs |
| Stage toggle `.stage-toggle` | mini-stage bar, < 1024 px only | "Hide circuit" / "Show circuit", `aria-expanded` + `aria-controls` |
| Toast | `role="status"` + `aria-live="polite"` | at most 2 visible; from a third on, the second slot becomes a "N more" summary with a link to Achievements. Desktop: bottom right, stacked. Phones: one compact 60 px banner over the top bar ("Unlocked: Title +N more"), never over the stage. Auto-dismiss after 5 s, paused while hovered or focused; each has a Dismiss button |
| Confirm dialog | native `<dialog>` with `showModal()` | focus is trapped by the browser; Cancel has initial focus; Esc cancels |

## 5. Layout and breakpoints

| Width | Shell | Home | Lesson |
|---|---|---|---|
| ≥ 1024 px | 64 px top bar, wordmark + text nav; content max 1440 px, 24 px gutters | Hero two columns (copy / live bench) | Two columns: sticky stage 58 % and step panel 42 %. The stage is exactly `100vh − (bar + 16 px) − 16 px` tall and gives the Lab that height (`.lesson-stage-lab`, `container: stage / size`); the Lab fits schematic, meters and controls inside, so there is no tall inner scroll |
| 640–1023 px | same bar | Hero stacked: copy, then bench | Mini-stage: sticky under the bar, full bleed, 45 % of the viewport (min 220 px), opaque `--bg` with a bottom rule; a 44 px bar holds the lab title and the Hide/Show toggle. Collapsed it is just that one-line bar. The step panel scrolls beneath it; `scroll-padding-top` keeps focused content clear of it |
| < 640 px | 60 px compact bar: mark only, nav as icon-over-label tabs (≥ 56 × 44 px) | Stats as rows; day tiles one column | as tablet, plus a compact header (smaller `h1`, ring top-right, no meta line) and the step chips as one horizontally scrolling row that keeps the current chip in view; panel padding 16 px |

**Reading order:** the step panel (nav, step text, Back/Next) comes before the stage in the DOM, so screen readers and Tab reach the lesson first. Visually the stage is on the left (desktop, grid area) or pinned above the text (phones, `order: -1`).

Lessons without a lab use a single centred 760 px column. Nothing ever overlays the stage: desktop toasts sit bottom right over the step panel, phone toasts replace the top bar for 5 s; there are no drawers or modals on lesson pages. Must work from 320 px with no horizontal page scroll; wide tables scroll inside their own focusable container, with an edge shadow while more is hidden.

## 6. Motion

- Durations come only from `--dur-fast` (120 ms: press), `--dur-med` (220 ms: hover, colour, toggle), `--dur-slow` (420 ms: step entrance, toast, ring fill). Easing is `--ease-out`.
- Micro-interactions: button press dip, tile lift on hover, step card fade-up on step change, toast slide-in, ring/meter fills.
- Ambient loops (hero waves, live dot, bench current dots) are slow and low-contrast. Current dots move at a speed proportional to the solved current, never decoratively.
- **Reduced motion:** tokens drop durations to 0 and `index.css` stops every animation (1 iteration, 0.01 ms). Current flow also obeys the in-app "Animate current flow" setting. Nothing conveys information through motion alone; values are always printed.

## 7. Accessibility rules

- Contrast: text tokens pass WCAG AA on `--surface-1`; `--text-faint` only at ≥ 12 px for non-essential text. Never put text on a signal colour except `--brand-ink` on brand.
- Focus: every control shows a 2 px `--brand-strong` outline + `--glow-brand`. Visually hidden inputs move the ring to their visible pill/track. Programmatic focus targets (`main`, step `h2`) don't show a ring.
- Route changes scroll to top and move focus to the step heading (`[data-autofocus]`) or `main`. Skip link "Skip to content" is the first tab stop.
- Hit targets ≥ 44 × 44 px for every button, link tile, step chip, radio pill and toast close.
- Names: follow the accessible-name contract in `docs/AGENT_TASKS.md`. Step buttons are named by the step title; their state (Done / Seen / Not seen yet) is the accessible description. Day links are "Day N: Title" with the mastery state as description. Icons are `aria-hidden`.
- Live regions: toasts (`aria-live="polite"`) and the hero bench verdict are `role="status"`. The predict reveal is not a live region; it receives focus instead.

## 8. How Ohmlab differs from the reference

| Aspect | Reference (learn-arduino) | Ohmlab |
|---|---|---|
| Palette | Warm cream paper, navy ink, teal accents | Blue-black night bench, graticule grid, glowing signal colours with fixed meanings (cyan current, amber voltage, coral power) and violet brand |
| Main visual | An illustrated isometric board with hotspots | A live, solved 2D circuit: on the home page a mini bench you can break in one click (no resistor → burnt LED), in lessons a sticky schematic stage whose dots move at the real current |
| Type | Condensed, letter-spaced caps | Space Grotesk display, Inter body, JetBrains Mono for every number; no tracked caps |
| Personality | Calm technical drawing, describes the board | Curious lab partner: "try it, break it, see why"; copy talks about what you just did |
| Structure | Tabs about one board, lesson strip at the bottom | Home with a 100-day, 7-phase map (lit days are playable, the rest honestly "Coming soon"), then a guided lesson flow: steps → quiz → build it for real, with the lab always beside or above the text |
| Brand | Arduino marks | Own name and mark: a resistor zig-zag that doubles as a waveform, cyan→violet |
