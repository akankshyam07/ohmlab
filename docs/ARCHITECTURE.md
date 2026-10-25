# Architecture

Static single-page app: **Vite 8 + React 19 + TypeScript**, no backend. Deployed to GitHub Pages.

## Module map and ownership

```
src/
  sim/        Simulation Engineer — DC solver. Pure TS, no React.
    types.ts    CONTRACT (Circuit, Component, SolveResult)
    solver.ts   export function solveDC(c: Circuit): SolveResult
  viz/        Simulation/Viz — SVG schematic renderer
    types.ts    CONTRACT (CircuitLayout, CircuitViewProps)
    CircuitView.tsx  export function CircuitView(props: CircuitViewProps)
  content/    Content Developer + Learning Designer
    types.ts    CONTRACT (Lesson, Lab, QuizQuestion, Phase…)
    lessons/*.ts  one lesson per file, default export Lesson
    curriculum.ts export const phases: Phase[]   (all 100 days)
    index.ts      export const lessons: Lesson[]; export function getLesson(id): Lesson | undefined; export { phases }
  progress/   Quiz/Progress Engineer
    types.ts    CONTRACT (Progress, ProgressApi, STORAGE_KEY)
    store.tsx   export function ProgressProvider; export function useProgress(): ProgressApi
    achievements.ts export const achievements: Achievement[]
  features/
    lab/Lab.tsx     export function Lab(props: { lessonId: string; lab: Lab; highlight?: string[]; showFlow?: boolean })
    quiz/Quiz.tsx   export function Quiz(props: { lessonId: string; questions: QuizQuestion[] })
  app/        Frontend Engineer — shell, router, pages, layout
    router.ts   hash routes: #/ (home), #/lesson/:id, #/lesson/:id/:step, #/achievements, #/settings
  ui/         shared primitives (RichText; Button/Card/etc. added by Frontend)
  styles/tokens.css  CONTRACT — all colours, type, spacing, motion
```

## Data flow in a lesson

```
Lesson (content) ──► LessonPage (app) ──► Lab (features/lab)
                                            │  state: working Circuit + Layout (cloned from lab.circuit)
                                            │  controls/clicks mutate component props or flip terminals
                                            ▼
                                     solveDC(circuit) ──► SolveResult
                                            │
                       CircuitView ◄────────┤────────► meters/readouts, challenge.check(result, circuit)
                                                               │
                                              useProgress().completeChallenge
```

- `solveDC` is pure and synchronous. Phase 1 circuits have fewer than 20 nodes, so a full re-solve on every change is instant. Memoise on the circuit object.
- Content never computes physics. Challenges inspect `SolveResult`.
- Nothing in the UI shows electrical numbers that didn't come from `SolveResult`, except worked examples in lesson text, which content QA verifies against the solver in tests (`content/lessons.test.ts`).

## Conventions

- **Styling:** plain CSS files next to components (`Lab.css`), class names prefixed by the component (`lab-…`). Only tokens from `tokens.css`; no raw hex values outside tokens.css and the SVG signal colours, which read the CSS vars.
- **State:** React state plus one context (progress). No state library.
- **Formatting numbers:** `src/ui/format.ts` → `formatSI(value, unit)` gives `13.6 mA`, `2.01 V`, `220 Ω`, `1 kΩ`. Every agent uses it; never hand-format electrical values.
- **Layout grid:** 1 grid unit = 40 px at 100 % zoom. Two-terminal parts span 3 units (`from`→`to`), wires run on integer coordinates, a typical lab is 14×9 units.
- **Accessibility:** every interactive SVG part is a focusable `<g role="button" tabindex=0 aria-label>`. Meters use `aria-live="polite"`. Animation respects `prefers-reduced-motion` and the in-app toggle.
- **Tests:** Vitest + Testing Library (`*.test.ts(x)` next to the code), and Playwright in `e2e/`.
- **No new dependencies** without a decision-log entry in PRD.md.

## Routing

`window.location.hash` drives a ~30-line router in `src/app/router.ts`, so GitHub Pages never sees deep paths (no 404 fallback needed). `base` comes from `BASE_PATH` at build time.

## Build & deploy

`npm run typecheck && npm test && npm run build && npm run e2e`. The GitHub Actions workflow `.github/workflows/deploy.yml` runs these on push, then deploys `dist/` with `actions/deploy-pages`.
