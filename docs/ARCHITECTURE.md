# Architecture

Static single-page app: **Vite 8 + React 19 + TypeScript**, no backend of its own. Deployed to GitHub Pages. Optional accounts and cloud sync use Supabase (see "Accounts and sync"); without its env vars the app is local-only.

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
  auth/       optional accounts + cloud sync (Supabase); absent without config
    client.ts   env config, Backend interface, supabase-js adapter, friendly errors (AuthProblem)
    merge.ts    mergeProgress(a, b, newer): pure, lossless merge of two Progress copies
    sync.ts     createSyncScheduler: debounced upload, backoff retry, pagehide flush
    AuthProvider.tsx  useAuth(); sign-in state, first-sync merge, upload on change
    Account.tsx / SignInDialog.tsx / CodeInput.tsx  top-bar account, Settings section, Home nudge, sign-in dialog
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

## Accounts and sync

Optional. Configured at build time by `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (a `sb_publishable_…` key or a legacy anon JWT; secret/service_role keys are refused). Without them `useAuth().available` is false, no account UI renders and `@supabase/supabase-js` is never downloaded (it is a lazy chunk).

- **Sign-in:** passwordless email code: `signInWithOtp({ email, options: { shouldCreateUser: true } })`, then `verifyOtp({ email, token, type: 'email' })`. No magic links, so it works in sandboxed iframes. The session persists in `localStorage` (supabase-js default). Sign-out is `scope: 'local'` (this browser only) and keeps local progress.
- **First sync** (sign-in, or app start while signed in): fetch the row, validate `data` with the store's `validateProgress` (untrusted), `mergeProgress` it with local progress (union steps/challenges/days, max quiz best and attempts, earliest completion and achievement times, `lastLessonId` from the newer copy by `updated_at` vs `ohmlab.progressChangedAt`), write the result locally with `useProgressSync().replace` (no settle) and upsert it. Nothing is uploaded before this merge succeeds; it retries with backoff. A row with a newer `version` is never overwritten (sync stops with a message); a corrupt row is replaced by local progress.
- **Then:** every progress change is upserted after 1.5 s of quiet, always the latest local copy; failures retry with exponential backoff (2 s … 60 s) and at once on `online`; `pagehide`/hidden flushes (keepalive fetch).
- **Known limit:** "Reset progress" while signed in clears the cloud copy too, but another signed-in device merges its own local copy back on its next start.

```sql
create table public.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

create policy "Learners read their own progress" on public.progress
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Learners create their own progress" on public.progress
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Learners update their own progress" on public.progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
```

## Routing

`window.location.hash` drives a ~30-line router in `src/app/router.ts`, so GitHub Pages never sees deep paths (no 404 fallback needed). `base` comes from `BASE_PATH` at build time.

## Build & deploy

`npm run typecheck && npm test && npm run build && npm run e2e`. The GitHub Actions workflow `.github/workflows/deploy.yml` runs these on push, then deploys `dist/` with `actions/deploy-pages`.
