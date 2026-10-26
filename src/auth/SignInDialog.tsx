import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Icon } from '../ui/primitives'
import { useAuth } from './AuthProvider'
import { AuthProblem, toProblem } from './client'
import { CodeInput } from './CodeInput'
import './auth.css'

const RESEND_SECONDS = 60 // Supabase's default minimum gap between two codes for one address
const CODE_LENGTH = 6
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const message = (e: unknown) => (e instanceof AuthProblem ? e : toProblem(e)).message

/**
 * Passwordless sign-in in a native modal dialog (the browser traps focus, Esc closes, focus returns to the opener):
 * email → 6-digit code. No magic links, so it works inside sandboxed iframes.
 */
export function SignInDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sendCode, verifyCode } = useAuth()
  const dialog = useRef<HTMLDialogElement>(null)
  const emailInput = useRef<HTMLInputElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [codeKey, setCodeKey] = useState(0) // remounts (clears) the code boxes
  const [code, setCode] = useState('')
  const [resendAt, setResendAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  const focusStep = (which: 'email' | 'code') =>
    requestAnimationFrame(() => {
      if (which === 'email') emailInput.current?.focus()
      else dialog.current?.querySelector<HTMLInputElement>('.code-box')?.focus()
    })

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) {
      opener.current = document.activeElement as HTMLElement | null
      d.showModal?.()
      if (!d.open) d.setAttribute('open', '') // jsdom
      focusStep(step)
    } else if (!open && d.open) {
      d.close?.()
      d.removeAttribute('open')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only open/close drive the dialog
  }, [open])

  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000))
  useEffect(() => {
    if (step !== 'code' || secondsLeft === 0) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [step, secondsLeft])

  const finishClose = () => {
    onClose()
    setError('')
    setNotice('')
    // After signing in the "Sign in" opener is gone; the account button replaces it.
    const target = opener.current?.isConnected ? opener.current : document.querySelector<HTMLElement>('[data-account-button]')
    target?.focus()
  }

  const send = async (address: string, resend = false) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await sendCode(address)
      setResendAt(Date.now() + RESEND_SECONDS * 1000)
      setNow(Date.now())
      setStep('code')
      setCode('')
      setCodeKey((k) => k + 1)
      if (resend) setNotice(`New code sent to ${address}.`)
      focusStep('code')
    } catch (e) {
      setError(message(e))
      if (!resend) focusStep('email')
    } finally {
      setBusy(false)
    }
  }

  const onEmailSubmit = (e: FormEvent) => {
    e.preventDefault()
    const address = email.trim()
    if (!EMAIL.test(address)) {
      setError('Enter your email address, like name@example.com.')
      emailInput.current?.focus()
      return
    }
    setEmail(address)
    void send(address)
  }

  const verify = async (value: string) => {
    if (busy || value.length !== CODE_LENGTH) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await verifyCode(email, value)
      // Signed in: the provider closes the dialog. Reset for next time.
      setStep('email')
      setCode('')
    } catch (e) {
      setError(message(e))
      setCode('')
      setCodeKey((k) => k + 1)
      focusStep('code')
    } finally {
      setBusy(false)
    }
  }

  const changeEmail = () => {
    setStep('email')
    setError('')
    setNotice('')
    focusStep('email')
  }

  return (
    <dialog
      ref={dialog}
      className="signin panel"
      aria-labelledby="signin-title"
      aria-describedby="signin-lead"
      onClose={finishClose}
      onCancel={(e) => {
        e.preventDefault() // close through state, so React and the element agree
        finishClose()
      }}
    >
      <div className="signin-top">
        {step === 'code' ? (
          <button type="button" className="signin-back" onClick={changeEmail} disabled={busy}>
            <Icon name="left" size={18} />
            Use a different email
          </button>
        ) : (
          <span className="signin-badge" aria-hidden="true">
            <Icon name="cloud" size={22} />
          </span>
        )}
        <button type="button" className="signin-close" aria-label="Close" onClick={finishClose}>
          <Icon name="close" size={20} />
        </button>
      </div>

      {step === 'email' ? (
        <form className="signin-body" onSubmit={onEmailSubmit} noValidate>
          <h2 id="signin-title">Keep your progress everywhere</h2>
          <p id="signin-lead" className="signin-lead">
            Sign in with your email and your lessons, quiz scores, streak and achievements follow you to any device.
            No password: we’ll email you a 6-digit code.
          </p>
          <label className="signin-label" htmlFor="signin-email">
            Email
          </label>
          <input
            ref={emailInput}
            id="signin-email"
            className="signin-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'signin-error' : undefined}
            disabled={busy}
          />
          {error && (
            <p id="signin-error" className="signin-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary signin-submit" disabled={busy} aria-busy={busy || undefined}>
            {busy ? (
              <>
                <span className="signin-spinner" aria-hidden="true" />
                Sending code…
              </>
            ) : (
              <>
                Email me a code
                <Icon name="right" size={18} />
              </>
            )}
          </button>
          <p className="signin-fine">Your progress in this browser is kept and merged with your account.</p>
        </form>
      ) : (
        <form
          className="signin-body"
          onSubmit={(e) => {
            e.preventDefault()
            void verify(code)
          }}
        >
          <h2 id="signin-title">Check your email</h2>
          <p id="signin-lead" className="signin-lead">
            We sent a 6-digit code to <strong className="signin-address">{email}</strong>. It may take a minute to
            arrive; check spam if it doesn’t.
          </p>
          <p id="signin-code-label" className="signin-label">
            6-digit code
          </p>
          <CodeInput
            key={codeKey}
            length={CODE_LENGTH}
            labelledBy="signin-code-label"
            describedBy={error ? 'signin-error' : undefined}
            invalid={Boolean(error)}
            disabled={busy}
            onChange={setCode}
            onComplete={(value) => void verify(value)}
          />
          {error && (
            <p id="signin-error" className="signin-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="btn btn-primary signin-submit"
            disabled={busy || code.length !== CODE_LENGTH}
            aria-busy={busy || undefined}
          >
            {busy ? (
              <>
                <span className="signin-spinner" aria-hidden="true" />
                Checking…
              </>
            ) : (
              'Sign in'
            )}
          </button>
          <div className="signin-resend">
            <span>Didn’t get it?</span>
            <button type="button" className="signin-link" disabled={busy || secondsLeft > 0} onClick={() => void send(email, true)}>
              {secondsLeft > 0 ? (
                <>
                  Resend in <span className="mono">{clock(secondsLeft)}</span>
                </>
              ) : (
                'Send a new code'
              )}
            </button>
          </div>
          <p className="signin-notice" role="status">
            {notice}
          </p>
        </form>
      )}
    </dialog>
  )
}
