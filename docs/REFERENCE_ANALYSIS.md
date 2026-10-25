# Reference Analysis — learn-arduino-red.vercel.app

Inspected 2026-10-25 on desktop (1024×768) and mobile (375×812): lessons 1–2, sketch runner, schematic toggle, progress persistence. Console was clean.

## What it is

A single-page Arduino course for beginners. An illustrated isometric 3D Uno sits in the centre with labelled hotspots. A right panel carries Overview / Pinout / Example / Specifications tabs and a "Try it yourself" code box. A bottom strip lists lessons (Meet the board, Blink, Button, Knob, Mix colours…). Progress is counted as "Basics 0/16" and stored in the browser.

## Strengths (keep the idea, not the execution)

| Strength | Why it works | Ohmlab takes |
|---|---|---|
| One object at the centre of the screen | Learner always knows what they're looking at | A single live circuit "stage" per lesson |
| Labelled hotspots on the hardware | Turns a scary board into named parts | Clickable parts that explain themselves and change values |
| Code + simulated serial output | Feels like real hardware | Deferred: Phase 2 (Arduino) lessons |
| Click a part to change it (resistor value, LED colour) | Learning by poking | Core interaction: every lab has click-to-change parts |
| Lesson strip always visible | Constant sense of a journey | Curriculum rail + phase map |
| Calm, crafted visual style | Feels premium, not textbook | Equally crafted, but a different look (below) |

## Weaknesses and gaps

1. **Output is scripted, not simulated.** The serial monitor prints canned `D13 → HIGH/LOW` lines; changing the resistor doesn't come from solving the circuit. Ohmlab solves the circuit (nodal analysis, real diode model), and every number shown comes from the solver.
2. **No "why".** It shows *what* parts are, but there's no Ohm's law, no current, no voltage. Ohmlab is built around making V, I and R visible.
3. **No check of understanding.** No quizzes, no challenges, no feedback. Ohmlab has a quiz per lesson with per-option explanations, plus lab challenges checked against the live circuit.
4. **Shallow progress model.** It counts lessons opened. Ohmlab tracks mastery (sections, challenges, quiz) and requires the quiz to complete a lesson.
5. **Mobile:** the schematic overlay covers the board and its open state persists across reloads. Ohmlab stacks the stage above the lesson on mobile, and overlays never hide the stage.
6. **Dead navigation:** the sidebar items link to `#`. Ohmlab ships no nav items that go nowhere.
7. **Arduino-first.** It starts at the microcontroller. Ohmlab starts at electricity itself, so learners can reason about any circuit, not just copy sketches.

## Differentiation (how Ohmlab must look and feel different)

| Aspect | Reference | Ohmlab |
|---|---|---|
| Palette | Warm cream paper, navy ink, teal | Dark "night lab" blue-black, with glowing signal colours: current cyan, voltage amber, power coral, brand violet |
| Main visual | Isometric illustrated 3D board | Live 2D schematic on an oscilloscope-style graticule, with animated current whose speed is the real current |
| Typography | Condensed, letter-spaced caps | Space Grotesk display, Inter body, JetBrains Mono for every measured value |
| Personality | Calm technical drawing | Curious lab partner: "try it, break it, see why" |
| Structure | Tabs about the board | A guided step-by-step lesson flow: Learn → Lab → Quiz → Build it for real |
| Brand | Arduino logo and colours | Own name, Ohmlab, and its own mark (a waveform). No third-party logos. |

Not reused: no branding, layout measurements, assets, code or copy from the reference.
