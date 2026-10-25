# Ohmlab

Learn electronics by experimenting. Ohmlab is an interactive course that starts at "what is voltage?" Every lesson has a live circuit you can poke, break and fix, solved by a real circuit simulator, so the numbers you see are the numbers a real circuit would give.

## Quick start

```bash
npm ci
npm run dev        # http://localhost:5173
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm test` | Unit and component tests (Vitest) |
| `npm run build` | Typecheck and production build into `dist/` |
| `npm run e2e` | Builds, serves the production preview, runs Playwright on desktop and mobile Chromium |
| `npm run preview` | Serve `dist/` locally |

First E2E run on a new machine: `npx playwright install chromium`.

## Project layout

```
src/
  sim/        DC circuit solver (modified nodal analysis + diode model)
  viz/        SVG schematic with live current flow
  features/   Lab (interactive circuit + challenges) and Quiz
  progress/   Progress, mastery, streaks, achievements (browser storage)
  content/    Lessons and the 100-day curriculum map
  app/        Shell, routing, pages
  ui/         Shared UI primitives and formatting
  styles/     Design tokens
docs/         PRD, specs, architecture, design system, test plan, roadmap
e2e/          Playwright tests
```

Start with [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit, and [docs/SIMULATION_SPEC.md](docs/SIMULATION_SPEC.md) for what the simulator does and doesn't model.

## Adding a lesson

1. Create `src/content/lessons/dayNN.ts` exporting a `Lesson` (schema in `src/content/types.ts`).
2. Add it to `lessons` in `src/content/index.ts` and set `lessonId` on its day in `src/content/curriculum.ts`.
3. Run `npm test`. The content tests check the schema, that the layout matches the circuit, and that every lab challenge is reachable.

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repo, go to **Settings → Pages → Build and deployment** and set Source to **GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml`: tests, build with `BASE_PATH=/<repo>/`, E2E, then deploy. The site appears at `https://<user>.github.io/<repo>/`.

Routing uses the URL hash (`#/lesson/first-led`), so deep links work on Pages without a 404 fallback.

## Progress and privacy

Progress is stored only in your browser (`localStorage`). There are no accounts and no tracking.
