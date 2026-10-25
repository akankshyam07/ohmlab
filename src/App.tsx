import { useEffect, useRef } from 'react'
import { ProgressProvider, useProgress } from './progress/store'
import { Home } from './app/Home'
import { LessonPage } from './app/LessonPage'
import { AchievementsPage, NotFound, SettingsPage } from './app/pages'
import { href, useRoute, type Route } from './app/router'
import { SettingsProvider } from './app/settings'
import { Icon, LogoMark, type IconName } from './ui/primitives'
import './app/shell.css'

export default function App() {
  return (
    <ProgressProvider>
      <SettingsProvider>
        <Shell />
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
  const main = useRef<HTMLElement>(null)
  const routeKey = JSON.stringify(route)
  const previousKey = useRef(routeKey)

  useEffect(() => {
    if (previousKey.current === routeKey) return
    previousKey.current = routeKey
    window.scrollTo(0, 0)
    const target = document.querySelector<HTMLElement>('[data-autofocus]') ?? main.current
    target?.focus({ preventScroll: true })
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
        <span>Ohmlab — try it, break it, see why. Your progress stays in this browser.</span>
      </footer>

      <Toasts />
    </div>
  )
}

const TOAST_MS = 6000

function Toasts() {
  const { recentlyUnlocked: toasts, dismissUnlocked } = useProgress()

  useEffect(() => {
    if (toasts.length === 0) return
    const timer = window.setTimeout(dismissUnlocked, TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toasts, dismissUnlocked])

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((a) => (
        <div key={a.id} className="toast panel">
          <span className="toast-icon" aria-hidden="true">
            {a.icon}
          </span>
          <div className="toast-text">
            <p className="toast-kicker">Achievement unlocked</p>
            <p className="toast-title">{a.title}</p>
            <p className="toast-desc">{a.description}</p>
          </div>
          <button
            type="button"
            className="toast-close"
            aria-label="Dismiss"
            onClick={dismissUnlocked}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      ))}
    </div>
  )
}
