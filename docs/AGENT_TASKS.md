# Agent Tasks

The Product Manager (the main session) coordinates, owns `docs/PRD.md`, `ARCHITECTURE.md`, `FEATURE_SPEC.md`, `USER_JOURNEYS.md`, `ROADMAP.md` and the contracts (`*/types.ts`, `styles/tokens.css`, `ui/RichText.tsx`, `ui/format.ts`), and does integration.

**Rules for every agent:** touch only the files you own. Don't install dependencies. Don't edit contracts; if one is wrong, say so in your report. Other agents work in the same checkout at the same time, so typecheck errors in files you don't own are expected until integration.

| Agent | Owns | Deliverables | Depends on | Acceptance |
|---|---|---|---|---|
| **Simulation Engineer** | `src/sim/solver.ts`, `src/sim/*.test.ts`, `docs/SIMULATION_SPEC.md` | `solveDC` (MNA + Newton–Raphson diode/LED model, statuses, short/floating detection) | `sim/types.ts` | Linear results within 0.1 % of hand calcs; red LED Vf 1.8–2.2 V at 5–20 mA; never throws; ≥15 tests |
| **Viz Engineer** | `src/viz/CircuitView.tsx`, `src/viz/*.css`, `src/viz/*.test.tsx` | SVG schematic: symbols, labels, LED glow by brightness, burnt/overload states, current animation scaled to solved current, probes, keyboard-clickable parts | `viz/types.ts`, `sim/types.ts`, tokens | Renders all 5 component kinds; flow speed monotonic in \|I\|; no animation under reduced motion; parts have aria-labels |
| **Frontend + UI/UX** | `src/main.tsx`, `src/App.tsx`, `src/app/**`, `src/ui/**` (except RichText/format), `src/index.css`, `docs/DESIGN_SYSTEM.md` | Hash router, app shell, Home (continue card, phase map of all 100 days, mastery, streak), Lesson page (step flow: sections → lab → quiz → build), Achievements, Settings (reset, flow toggle), toasts, 404 | all contracts | Works 320 px–1440 px; keyboard operable; no dead links; DESIGN_SYSTEM.md documents how it differs from the reference |
| **Lab & Progress Engineer** | `src/features/**`, `src/progress/store.tsx`, `src/progress/achievements.ts`, `src/progress/*.test.ts(x)` | `<Lab>` (controls, click-to-change, meters, live challenges, reset), `<Quiz>` (choice + numeric, per-option feedback, score, retry), `ProgressProvider`/`useProgress`, ≥6 achievements | sim, viz, content, progress contracts | Progress survives reload; corrupted storage falls back to empty; challenge completes the moment the live circuit satisfies it |
| **Content Developer + Learning Designer** | `src/content/lessons/**`, `src/content/curriculum.ts`, `src/content/index.ts`, `src/content/*.test.ts`, `docs/CURRICULUM.md` | Lessons Day 1, 2, 5, 6, 7, 8 with labs, walkthroughs, 5–7 quiz questions each, real-build guide; 100-day map | content/sim/viz contracts | Every number in the text matches a hand calc; each challenge is reachable with the lab's controls (tested); the language works for a total beginner |
| **DevOps + QA** (PM, then QA agent) | `README.md`, `.github/**`, `playwright.config.ts`, `e2e/**`, `docs/TEST_PLAN.md` | CI workflow (typecheck, unit, build, E2E, deploy to Pages), E2E for critical journeys | integrated app | CI green locally; journeys in TEST_PLAN pass |
| **Critical User Reviewer** | `docs/REVIEW.md` | Beginner and experienced walkthroughs, ranked friction list | integrated app | Every issue has repro steps and a severity |

## Accessible-name contract (E2E relies on these)

- Home: a heading "Ohmlab"; a link "Continue: Day N — <title>" (or "Start: Day 1 — …"); each available lesson is a link named "Day N: <title>".
- Lesson page: `h1` = lesson title; step navigation is a `nav` labelled "Lesson steps" with buttons named after each step; buttons "Next" and "Back".
- Lab: a `region` labelled "Circuit lab"; each readout is in an element with `role="status"`; parts are buttons named like "Resistor R1, 220 Ω"; button "Reset circuit".
- Quiz: a `region` labelled "Quiz"; buttons "Check answer", "Next question", "Retry quiz"; the final score is text "You scored X / Y".
- Settings: button "Reset progress" (asks for confirmation); checkbox "Animate current flow".

## Status

| Workstream | State |
|---|---|
| Contracts, tokens, PRD, architecture, reference analysis | Done (PM) |
| Solver | Dispatched |
| Circuit view | Dispatched |
| Shell + design system | Dispatched |
| Lab, quiz, progress | Dispatched |
| Content | Dispatched |
| CI, README, test plan | PM, in parallel |
| Integration, E2E, review | After workstreams land |
