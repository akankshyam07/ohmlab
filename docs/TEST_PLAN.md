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

## Results (2026-10-25, after the review-fix round)

**Specs:**
- `e2e/fixtures.ts`: an auto fixture that fails any test on a console or page error, plus the Day 1 helpers. Quiz answers are chosen by their text, because options are shuffled per attempt.
- `e2e/journeys.spec.ts`: journeys 1–7, plus a reduced-motion check, 320 px no-horizontal-scroll checks (home, a lesson, a lesson quiz), and focused checks:
  - clicking R1 never selects "No resistor";
  - challenges unlock in order and only on the learner's own moves;
  - a predict card reveals its why and try-it text;
  - a passed quiz with unfinished challenges says what is left;
  - "Go to challenges" opens the tray;
  - the burnt-part alert links to "How the simulator works".
- `e2e/bugs.spec.ts`: bug repros marked `test.fixme`.
- `e2e/smoke.spec.ts`: the existing smoke test.

**`npx playwright test` (desktop + mobile):** 37 passed, 1 skipped (the phone-only J6 stage check on desktop).

**Journey 1** follows the new challenge order on Day 1:
- Nothing is complete on load and later challenges show "Up next".
- 220 Ω gives 13.5–14.5 mA. Flipping the LED reads "0 A". "No resistor" burns the LED.
- Reset, then Blue and two R1 clicks (1 kΩ → 10 kΩ → 220 Ω) complete the last challenge.
- The quiz scores 6 / 6, at most 2 toasts show, the Build checklist says "Lesson complete", and the last Next opens Day 2.

**J6 (Pixel 7)** checks the intended phone layout:
- Once stuck, the mini-stage stays pinned under the top bar while the text scrolls.
- No page element covers the visible diagram, and every part's centre hits that part.
- "Hide circuit"/"Show circuit" toggles with `aria-expanded`.
- Alerts are chips with More/Less, and there's no horizontal scroll.

The reduced-motion check was confirmed to fail when motion is allowed (cv-flow, cv-pulse and cv-smoke are detected).

### Bugs

- **BUG-1 (S3, fixed):** the reversed-LED meter read "0.005 nA". It now reads "0 A", and J1 asserts that.
- **BUG-2 (S3, closed as by design):** the lesson Next stays enabled during the quiz. REVIEW #17's fix keeps the quiz place in sessionStorage, so leaving mid-quiz doesn't restart it. `e2e/bugs.spec.ts` now checks that the quiz resumes at Question 2 after Next → Back.
