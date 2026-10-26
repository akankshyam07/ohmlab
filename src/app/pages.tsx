import { useRef, useState } from 'react'
import { achievements } from '../progress/achievements'
import { useProgress } from '../progress/store'
import { AccountSection } from '../auth/Account'
import { useAuth } from '../auth/AuthProvider'
import { Icon } from '../ui/primitives'
import { href } from './router'
import { useSettings } from './settings'
import './pages.css'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

export function AchievementsPage() {
  const { progress } = useProgress()
  const unlocked = achievements.filter((a) => progress.achievements[a.id]).length
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Trophy shelf</p>
        <h1>Achievements</h1>
        <p>
          {unlocked} of {achievements.length} unlocked. Some come from finishing lessons, some from curiosity —
          and one from letting the magic smoke out.
        </p>
      </header>
      <ul className="ach-grid">
        {achievements.map((a) => {
          const at = progress.achievements[a.id]
          return (
            <li key={a.id} className="ach-card panel" data-unlocked={at ? true : undefined}>
              <span className="ach-icon ach-icon-lg" aria-hidden="true">
                {at ? a.icon : <Icon name="lock" size={22} />}
              </span>
              <h2>{a.title}</h2>
              <p>{a.description}</p>
              <p className="ach-status num">
                {at ? `Unlocked ${dateFormat.format(new Date(at))}` : 'Locked'}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function SettingsPage() {
  const { animateFlow, setAnimateFlow } = useSettings()
  const { reset } = useProgress()
  const { user } = useAuth()
  const dialog = useRef<HTMLDialogElement>(null)
  const [message, setMessage] = useState('')

  return (
    <div className="page page-narrow">
      <header className="page-head">
        <p className="eyebrow">Bench setup</p>
        <h1>Settings</h1>
      </header>

      <AccountSection />

      <section className="setting panel" aria-labelledby="set-motion">
        <h2 id="set-motion">Motion</h2>
        <label className="switch">
          <input type="checkbox" checked={animateFlow} onChange={(e) => setAnimateFlow(e.target.checked)} />
          <span className="switch-track" aria-hidden="true" />
          <span>Animate current flow</span>
        </label>
        <p className="setting-help">
          Moving dots show current in the circuit, faster for more current. Turn this off if motion is
          distracting. Animation also stays off when your system asks for reduced motion.
        </p>
      </section>

      <section className="setting panel" aria-labelledby="set-progress">
        <h2 id="set-progress">Progress</h2>
        <p className="setting-help">
          {user
            ? 'Progress is saved in this browser and synced to your account. Resetting clears lessons, quiz scores, streak and achievements here and in your account.'
            : 'Progress is saved in this browser only. Resetting clears lessons, quiz scores, streak and achievements.'}
        </p>
        <button type="button" className="btn btn-danger" onClick={() => dialog.current?.showModal?.()}>
          Reset progress
        </button>
        <p role="status" className="setting-status">
          {message}
        </p>
      </section>

      <dialog ref={dialog} className="confirm panel" aria-labelledby="confirm-title" aria-describedby="confirm-text">
        <form
          method="dialog"
          onSubmit={(e) => {
            const choice = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value')
            if (choice === 'reset') {
              reset()
              setMessage('Progress reset. Fresh bench, fresh start.')
            }
          }}
        >
          <h2 id="confirm-title">Reset all progress?</h2>
          <p id="confirm-text">This can’t be undone. Every lesson, score, streak and achievement will be cleared.</p>
          <div className="confirm-actions">
            <button className="btn btn-ghost" value="cancel" autoFocus>
              Cancel
            </button>
            <button className="btn btn-danger" value="reset">
              Yes, reset everything
            </button>
          </div>
        </form>
      </dialog>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="page page-narrow notfound">
      <svg className="notfound-trace" viewBox="0 0 240 80" aria-hidden="true">
        <path d="M0 40h60l6-14 8 28 8-28 8 28 6-14h6" />
        <circle cx="114" cy="40" r="4" />
        <circle cx="142" cy="40" r="4" />
        <path d="M146 40h94" />
      </svg>
      <p className="eyebrow">Open circuit</p>
      <h1>Nothing is connected here</h1>
      <p>That page doesn’t exist, so no current flows. Let’s get you back to the bench.</p>
      <a className="btn btn-primary" href={href()}>
        Back to the map
      </a>
    </div>
  )
}
