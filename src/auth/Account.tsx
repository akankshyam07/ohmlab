import { useEffect, useRef, useState } from 'react'
import { Icon } from '../ui/primitives'
import { useAuth } from './AuthProvider'
import type { SyncStatus } from './sync'
import './auth.css'

const STATUS_LABEL: Record<SyncStatus, string> = {
  idle: 'Connecting…',
  syncing: 'Syncing…',
  synced: 'Synced',
  offline: 'Offline, will retry',
  error: 'Couldn’t sync, will retry',
}

function useStatusLabel() {
  const { sync } = useAuth()
  return sync.problem?.fatal ? 'Not synced' : STATUS_LABEL[sync.status]
}

function Avatar({ email, large }: { email: string; large?: boolean }) {
  return (
    <span className="acct-avatar" data-large={large || undefined} aria-hidden="true">
      {(email.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}

/** "Synced ✓" / "Syncing…" / "Offline, will retry", plus the reason when syncing has stopped. */
export function SyncStatusLine({ live }: { live?: boolean }) {
  const { sync } = useAuth()
  const label = useStatusLabel()
  return (
    <div className="acct-status" data-status={sync.status} role={live ? 'status' : undefined}>
      <span className="acct-status-mark" aria-hidden="true">
        {sync.status === 'synced' ? <Icon name="check" size={14} /> : <span className="acct-status-dot" />}
      </span>
      <span>
        <span className="acct-status-label">{label}</span>
        {sync.problem && (sync.problem.fatal || sync.status === 'error') && (
          <span className="acct-status-detail">{sync.problem.message}</span>
        )}
      </span>
    </div>
  )
}

function focusAccountButton() {
  requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-account-button]')?.focus())
}

/** Top-bar control: "Sign in", or the learner's initial opening a small account panel. Absent without config. */
export function AccountButton() {
  const { available, ready, user, sync, openSignIn, signOut } = useAuth()
  const label = useStatusLabel()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!available) return null
  if (!ready) return <span className="acct-slot" aria-hidden="true" />
  if (!user)
    return (
      <button type="button" className="acct-signin" data-account-button onClick={openSignIn}>
        <Icon name="user" size={20} />
        <span>Sign in</span>
      </button>
    )

  return (
    <div
      className="acct"
      data-sync={sync.status}
      ref={wrap}
      onBlur={(e) => {
        if (!wrap.current?.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <button
        ref={button}
        type="button"
        className="acct-button"
        data-account-button
        aria-expanded={open}
        aria-controls="acct-panel"
        aria-label={`Account: ${user.email}. ${label}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar email={user.email} />
        <span className="acct-dot" aria-hidden="true" />
      </button>
      {open && (
        // tabIndex -1: a click on the panel's text keeps focus inside, so onBlur doesn't close it.
        <div id="acct-panel" className="acct-panel panel" role="group" aria-label="Account" tabIndex={-1}>
          <div className="acct-who">
            <Avatar email={user.email} large />
            <div className="acct-who-text">
              <p className="acct-caption">Signed in as</p>
              <p className="acct-email">{user.email}</p>
            </div>
          </div>
          <SyncStatusLine live />
          <p className="acct-note">Progress syncs to every device you sign in on.</p>
          <button
            type="button"
            className="btn btn-ghost acct-signout"
            onClick={async () => {
              setOpen(false)
              await signOut()
              focusAccountButton()
            }}
          >
            <Icon name="logout" size={18} />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

/** Settings → Account. */
export function AccountSection() {
  const { available, ready, user, openSignIn, signOut } = useAuth()
  if (!available) return null
  return (
    <section className="setting panel" aria-labelledby="set-account">
      <h2 id="set-account">Account</h2>
      {user ? (
        <>
          <div className="acct-who">
            <Avatar email={user.email} large />
            <div className="acct-who-text">
              <p className="acct-caption">Signed in as</p>
              <p className="acct-email">{user.email}</p>
            </div>
          </div>
          <SyncStatusLine />
          <p className="setting-help">
            Lessons, quiz scores, streak and achievements sync automatically to every device you sign in on. Signing
            out keeps your progress in this browser.
          </p>
          <button type="button" className="btn btn-ghost" onClick={() => void signOut().then(focusAccountButton)}>
            <Icon name="logout" size={18} />
            Sign out
          </button>
        </>
      ) : (
        <>
          <p className="setting-help">
            Sign in with your email to keep lessons, quiz scores, streak and achievements in sync across your devices.
            No password needed, and what you’ve done in this browser is kept and merged.
          </p>
          <button type="button" className="btn btn-primary" onClick={openSignIn} disabled={!ready}>
            <Icon name="cloud" size={18} />
            Sign in to sync
          </button>
        </>
      )}
    </section>
  )
}

const NUDGE_KEY = 'ohmlab.syncNudge'

function nudgeDone() {
  try {
    return localStorage.getItem(NUDGE_KEY) === 'done'
  } catch {
    return false
  }
}

/** Home: a one-time, dismissible invitation to sign in. Only when accounts exist and nobody is signed in. */
export function SyncNudge() {
  const { available, ready, user, openSignIn } = useAuth()
  const [done, setDone] = useState(nudgeDone)

  const finish = () => {
    setDone(true)
    try {
      localStorage.setItem(NUDGE_KEY, 'done')
    } catch {
      // Blocked storage: hidden until the next load.
    }
  }

  useEffect(() => {
    if (user && !done) finish() // signing in counts as having seen it
  }, [user, done])

  if (!available || !ready || user || done) return null
  return (
    <aside className="nudge panel" aria-labelledby="nudge-title">
      <span className="nudge-icon" aria-hidden="true">
        <Icon name="cloud" size={22} />
      </span>
      <div className="nudge-text">
        <p id="nudge-title" className="nudge-title">
          Save your progress across devices
        </p>
        <p className="nudge-help">Sign in with your email — no password — and pick up on any device.</p>
      </div>
      <button type="button" className="btn btn-primary nudge-cta" onClick={openSignIn}>
        Sign in
      </button>
      <button type="button" className="nudge-close" aria-label="Dismiss sign-in suggestion" onClick={finish}>
        <Icon name="close" size={18} />
      </button>
    </aside>
  )
}
