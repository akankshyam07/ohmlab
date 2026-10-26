import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ProgressProvider, useProgress } from './progress/store'
import { Home } from './app/Home'
import { LessonPage } from './app/LessonPage'
import { AchievementsPage, NotFound, SettingsPage } from './app/pages'
import { href, navKind, useRoute, type Route } from './app/router'
import { afterViewTransition } from './app/transitions'
import { SettingsProvider } from './app/settings'
import { AccountButton } from './auth/Account'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { Icon, LogoMark, type IconName } from './ui/primitives'
import './app/shell.css'

export default function App() {
  return (
    <ProgressProvider>
      <SettingsProvider>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </SettingsProvider>
    </ProgressProvider>
  )
}

const NAV: { label: string; icon: IconName; path: string[]; match: Route['name'][] }[] = [
  { label: 'Learn', icon: 'learn', path: [], match: ['home', 'lesson'] },
  { label: 'Achievements', icon: 'trophy', path: ['achievements'], match: ['achievements'] },
  { label: 'Settings', icon: 'gear', path: ['settings'], match: ['settings'] },
]

function Shell() {
  const route = useRoute()
  const { user, mode } = useAuth()
  const main = useRef<HTMLElement>(null)
  const routeKey = JSON.stringify(route)
  const previous = useRef(route)

  // A layout effect, so it runs inside the view transition's update (the new page is captured already at the top).
  // A new page starts at the top. A new lesson step keeps the scroll position, and only when its heading is out of
  // view does the page then glide to it.
  useLayoutEffect(() => {
    const from = previous.current
    previous.current = route
    if (JSON.stringify(from) === routeKey) return
    const heading = document.querySelector<HTMLElement>('[data-autofocus]')
    if (navKind(from, route) === 'page') {
      window.scrollTo(0, 0)
      ;(heading ?? main.current)?.focus({ preventScroll: true })
      return
    }
    heading?.focus({ preventScroll: true })
    if (heading) afterViewTransition(() => revealHeading(heading))
  }, [routeKey])

  return (
    <div className="shell">
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          main.current?.focus()
        }}
      >
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href={href()} aria-label="Ohmlab home">
            <LogoMark size={34} />
            <span className="brand-word" aria-hidden="true">
              Ohm<span>lab</span>
            </span>
          </a>
          <nav className="topnav" aria-label="Main">
            <ul>
              {NAV.map((item) => (
                <li key={item.label}>
                  <a href={href(...item.path)} aria-current={item.match.includes(route.name) ? 'page' : undefined}>
                    <Icon name={item.icon} size={20} />
                    <span>{item.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <AccountButton />
        </div>
      </header>

      <main id="main" ref={main} tabIndex={-1}>
        {route.name === 'home' && <Home />}
        {route.name === 'lesson' && <LessonPage id={route.id} step={route.step} />}
        {route.name === 'achievements' && <AchievementsPage />}
        {route.name === 'settings' && <SettingsPage />}
        {route.name === 'notFound' && <NotFound />}
      </main>

      <footer className="footer">
        <LogoMark size={20} />
        <span>Ohmlab — try it, break it, see why. {user
            ? mode === 'artifact'
              ? 'Your progress syncs with your Claude account.'
              : 'Your progress syncs to your account.'
            : 'Your progress stays in this browser.'}</span>
      </footer>

      <Toasts />
    </div>
  )
}

/** Scroll a step heading into view (below the bar, and the mini-stage on phones) if it isn't already. */
function revealHeading(heading: HTMLElement) {
  const covered = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
  const { top, bottom } = heading.getBoundingClientRect()
  if (top >= covered && bottom <= window.innerHeight) return
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  heading.scrollIntoView?.({ block: 'start', behavior: reduced ? 'auto' : 'smooth' })
}

const TOAST_MS = 5000

/**
 * Achievement toasts: one compact card ("Unlocked: Title +N more"), bottom left on wide screens and under the
 * top bar on phones, never over the nav or the mini-stage's toggle. Auto-dismissed (all of them) after 5 s unless
 * hovered or focused; Dismiss shows the next one.
 */
function Toasts() {
  const { recentlyUnlocked, dismissUnlocked } = useProgress()
  const [dismissed, setDismissed] = useState<string[]>([])
  const [paused, setPaused] = useState(false)
  const queue = recentlyUnlocked.filter((a) => !dismissed.includes(a.id))
  const first = queue[0]

  const dismissAll = useCallback(() => {
    dismissUnlocked()
    setDismissed([])
    setPaused(false)
  }, [dismissUnlocked])

  // A removed toast never fires blur/mouseleave, so dismissing also resumes the timer.
  const dismiss = (id: string) => {
    setPaused(false)
    if (queue.length <= 1) dismissAll()
    else setDismissed((d) => [...d, id])
  }

  useEffect(() => {
    if (queue.length === 0 || paused) return
    const timer = window.setTimeout(dismissAll, TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [queue.length, paused, dismissAll])

  return (
    <div
      className="toasts"
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {first && (
        <div key={first.id} className="toast panel">
          <span className="toast-icon" aria-hidden="true">
            {first.icon}
          </span>
          <div className="toast-text">
            <p className="toast-title">
              {first.title}
              {queue.length > 1 && <span className="toast-more mono"> +{queue.length - 1} more</span>}
            </p>
            <p className="sr-only">{first.description}</p>
          </div>
          <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => dismiss(first.id)}>
            <Icon name="close" size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
