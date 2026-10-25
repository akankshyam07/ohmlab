import { flushSync } from 'react-dom'

/** Kinds of change, set as `data-nav` on <html> while their view transition runs: CSS names and animates by kind. */
export type NavKind = 'page' | 'step'

let running: ViewTransition | null = null

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * Apply a state change inside a view transition where the browser has them (and motion is welcome): the old view is
 * captured, React renders the new one synchronously, and the CSS in index.css animates between the two. Elsewhere
 * the change just happens.
 */
export function withViewTransition(update: () => void, kind?: NavKind) {
  if (typeof document.startViewTransition !== 'function' || reducedMotion()) {
    update()
    return
  }
  const root = document.documentElement
  if (kind) root.dataset.nav = kind
  else delete root.dataset.nav
  // A newer navigation wins: finish the old transition now. Its promises reject when skipped ("Transition was
  // skipped"), which is expected here, so they're caught rather than surfacing as unhandled errors.
  running?.skipTransition()
  const transition = document.startViewTransition(() => flushSync(update))
  transition.ready.catch(() => {})
  transition.updateCallbackDone.catch(() => {})
  running = transition
  const done = () => {
    if (running !== transition) return
    running = null
    delete root.dataset.nav
  }
  transition.finished.then(done, done)
}

/** Run `fn` once the current view transition (if any) has finished: scrolling during one would only show at its end. */
export function afterViewTransition(fn: () => void) {
  if (running) running.finished.then(fn, fn)
  else fn()
}
