# Ohmlab — Product Requirements

**Owner:** Product Manager (coordinator). **Status:** MVP approved 2026-10-25.

## Vision

Ohmlab teaches electronics from zero by letting learners experiment with circuits that behave like real ones. You change a part, the circuit is re-solved, and you *see* voltage, current and power respond. You understand why before you ever touch a breadboard, then you build it for real with a starter kit.

## Target learners

1. **Primary — the curious beginner:** no electronics, little or no code, owns (or will buy) an Arduino starter kit. Wants to "build anything" eventually. Gets lost in textbooks and copies tutorials without understanding.
2. **Secondary — the rusty tinkerer:** has blinked LEDs before, but guesses resistor values and can't debug. Wants the fundamentals done right, fast.

## Problem

Beginner resources either (a) explain theory with static diagrams, or (b) give recipes ("use 220Ω") with no reasoning. Neither lets you safely break things and see why. Simulators like Falstad and Wokwi are powerful, but they aren't courses.

## MVP scope (v1.0)

| # | Requirement | Priority |
|---|---|---|
| R1 | Six interactive Phase 1 lessons: Day 1 (V/I/R + first LED), Day 2 (Ohm's law & picking resistors), Day 5 (series & parallel), Day 6 (voltage dividers), Day 7 (power & ratings), Day 8 (diodes & LEDs) | Must |
| R2 | Real DC circuit solver (MNA + Newton–Raphson diode model). Every number in the UI comes from it. | Must |
| R3 | Live schematic per lesson: click-to-change parts, controls, meters, animated current proportional to the solved current, burnt or overloaded parts shown visibly | Must |
| R4 | Each lesson: guided steps (Learn), lab challenges checked against the live circuit, quiz with per-option explanations and numeric answers, and a "build it for real" kit guide | Must |
| R5 | Progress saved in the browser: steps seen, challenges, best quiz score, mastery %, completion, streak | Must |
| R6 | Curriculum map showing all 100 days in 7 phases; days without lessons shown as upcoming, never as dead links | Must |
| R7 | Achievements (≥6) with unlock toasts | Should |
| R8 | Responsive: desktop, tablet, phone (≥320 px), keyboard operable, WCAG AA contrast, reduced-motion support | Must |
| R9 | Static site on GitHub Pages with hash routing; CI runs typecheck, unit tests, build and E2E | Must |
| R10 | Settings: reset progress, toggle current animation | Should |
| R11 | Predict-then-test cards in every lesson | Must (added after review) |
| R12 | Illustrated breadboard wiring for every build, matching the lab circuit | Should (added after review) |

## Out of scope for MVP (see ROADMAP.md)

Free-form drag-and-drop circuit builder, capacitor/transient simulation, Arduino code execution, 3D views, light theme, i18n.

## Success metrics (local, measurable in tests and review)

- A beginner reviewer can complete Day 1 without outside help, and correctly explains why the LED needs a resistor.
- Every solver result is within 1 % of hand calculation for linear circuits. LED forward voltage is within 1.8–2.2 V at 5–20 mA for red.
- Lighthouse-style checks: no contrast failures; all controls reachable by keyboard.
- E2E: complete Day 1 → reload → progress persists.

## Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-10-25 | Name "Ohmlab"; dark night-lab identity | Clearly different from the reference's cream paper look; signals glow on dark |
| 2026-10-25 | 2D live schematic, not 3D | The educational value is in visible V/I. 3D adds weight without teaching more. Revisit in v2. |
| 2026-10-25 | Start at electricity fundamentals, not Arduino | Goal is "build anything"; fundamentals transfer to every platform |
| 2026-10-25 | Content as typed TS modules | Lab challenges need code (check functions); TS catches content schema errors at build |
| 2026-10-25 | Hand-rolled hash router, no router library | Two route shapes; GitHub Pages needs hash routing; avoids a dependency |
| 2026-10-25 | localStorage for progress | No backend on Pages; single-device MVP |
| 2026-10-25 | Predict-then-test blocks before lab moments | Review: "predict first" was asked but unsupported; committing to a guess is the core of the method |
| 2026-10-25 | Challenges unlock in order and only complete on learner actions | Review: accidental burns completed challenges and unlocked achievements before learners read anything |
| 2026-10-25 | One LED limit everywhere: ok ≤ 20 mA, warn above; reverse > 5 V flagged | Review: the simulator called states "fine" that the lessons call harmful |
| 2026-10-25 | Illustrated breadboard per build (pulled forward from v1.1) | Review: text-only builds were the main delight gap against the reference; wiring is topology-tested against the lab circuit |
| 2026-10-25 | Lesson "Next" stays usable mid-quiz as "Skip quiz" | Quiz place persists in the session, so peeking at the build doesn't cost progress |
| 2026-10-25 | Optional accounts with Supabase (`@supabase/supabase-js`, lazy-loaded): email 6-digit code sign-in, one `progress` row per learner with RLS, lossless merge on sign-in, debounced upload | Progress should follow the learner across devices. Hosted auth + Postgres with RLS means no backend of our own; codes (not magic links) work inside sandboxed iframes. Without env keys the app stays exactly local-only |
| 2026-10-25 | When running as a claude.ai Artifact, sync to the viewer's private `db` doc (`data/users/<id>/progress`) instead, with no sign-in UI; it takes priority over Supabase | Zero setup: the viewer is already signed in to claude.ai, and the user won't run Supabase. Same merge, scheduler and status UI |
