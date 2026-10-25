# Test Plan

## Commands

| What | Command | Where |
|---|---|---|
| Unit + component tests | `npm test` | Vitest + jsdom, `src/**/*.test.ts(x)` |
| Typecheck + production build | `npm run build` | tsc -b, vite build |
| E2E (builds, serves preview, runs desktop + mobile Chromium) | `npm run e2e` | Playwright, `e2e/` |
| CI | `.github/workflows/deploy.yml` | Runs the above with `BASE_PATH=/<repo>/` so asset paths are tested under Pages' sub-path |

## Unit and integration (owners in AGENT_TASKS.md)

| Area | What is asserted |
|---|---|
| `sim/solver` | Hand-calculated values (≤ 0.1 %), LED Vf windows per colour, statuses, shorts/garbage never throw, KCL and power balance, 20-node performance |
| `viz/CircuitView` | Accessible names, click/keyboard, flow speed monotonic in \|I\|, reduced-motion/`showFlow=false`, burnt tags, probe text |
| `features/lab` | Controls re-solve and update meters, flip, click-to-change, challenge completion, reset |
| `features/quiz` | `parseSI`, choice and numeric feedback, one retry, first-attempt scoring, a single `recordQuiz` |
| `progress` | Persistence, corruption fallback, idempotency, mastery weights, completion rule, streaks, achievements |
| `content` | Schema integrity, layout ↔ circuit ids, exactly one correct option, every challenge reachable and not pre-satisfied, numeric answers re-derived |
| `ui/format` | SI formatting |

## E2E critical journeys (`e2e/`)

1. **First visit → Day 1 complete:** home → "Start: Day 1" → steps → lab: choose 220 Ω, the LED-safe challenge completes → burn it with "No resistor", alert shown → quiz answered correctly → "You scored" ≥ 80 % → home shows Day 1 complete.
2. **Persistence:** after journey 1, reload; the mastery, completion, continue card and achievements are all still there.
3. **Deep link:** open `#/lesson/voltage-divider/quiz` directly and it renders the quiz step.
4. **Settings:** turn off "Animate current flow" and it persists; "Reset progress" → confirm → home shows Day 1 not started.
5. **Not found:** `#/nope` shows the 404 with a way home.
6. **Mobile (Pixel 7):** the lab stage is visible and not covered on the lesson page; there's no horizontal scroll on home or lesson.
7. **Hygiene:** no console errors on any visited route.

## Educational validation

- The Content Developer re-derives every number in lesson text and quizzes in `content/lessons.test.ts`.
- The Critical User Reviewer does a full beginner walkthrough and an experienced-learner walkthrough, recorded in `docs/REVIEW.md` with severity-ranked issues. Severity 1–2 issues block release.

## Accessibility

- Keyboard-only pass through journey 1.
- Contrast: all text tokens ≥ 4.5:1 on `--surface-1` (checked at design time; re-check new colours).
- Reduced motion: emulate `prefers-reduced-motion: reduce` in Playwright and check that no CSS animations run on the lab.

## Results (2026-10-25)

**Specs:** `e2e/fixtures.ts` (auto fixture that fails any test on a console or page error, plus the Day 1 helpers), `e2e/journeys.spec.ts` (journeys 1–7, a reduced-motion check and 320 px no-horizontal-scroll checks for home, a lesson and a lesson quiz), `e2e/bugs.spec.ts` (bug repros marked `test.fixme`), and the existing `e2e/smoke.spec.ts`.

**`npx playwright test` (desktop + mobile):** 23 passed, 3 skipped. The skipped tests are the BUG-1 repro on both projects (fixme) and the phone-only stage-coverage check on the desktop project.

Journey 1 completes Day 1 through the real controls. It checks the walkthrough highlights V1, R1 and D1, chooses 220 Ω (meter reads 13.5–14.5 mA), flips the LED by clicking it, burns it with "No resistor" (BURNT tag and alert shown), resets the circuit, cycles R1 to 220 Ω with a blue LED, and scores 6 / 6 on the quiz. It then checks mastery reaches 100 %, the last step's Next opens Day 2, and home shows Day 1 complete with "Continue: Day 2". The reduced-motion check was confirmed to fail when motion is allowed: cv-flow, cv-pulse, cv-smoke and lab-pop animations are all detected.

### Bugs

1. **BUG-1 (S3, fixed)** The reversed-LED meter is not 0.** Repro: open `#/lesson/first-led` and press "Flip the LED". Expected: the "Current through the loop" meter reads 0, as the "Flip it" success text says ("the meter reads 0"). Actual: it reads "0.005 nA". The solver leaks about 5 pA, and `formatSI` only rounds values below 1e-12 to 0. The Lab meters don't apply the diagram's 10 µA "no current" threshold. Suspected file: `src/features/lab/Lab.tsx` (meter value); `src/ui/format.ts` is an alternative. Tracked in `e2e/bugs.spec.ts`.
