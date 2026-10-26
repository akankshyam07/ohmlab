import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProgressProvider, emptyProgress, useProgress } from '../progress/store'
import { STORAGE_KEY, type Progress } from '../progress/types'
import { AccountButton, AccountSection, SyncNudge } from './Account'
import { AuthProvider } from './AuthProvider'
import { supabaseBackend } from './client'
import { MOCK_CODE, createMockSupabase } from './mock'

const EMAIL = 'ada@example.com'

function Probe() {
  const { progress, markStep } = useProgress()
  return (
    <>
      <button type="button" onClick={() => markStep('first-led', 'lab')}>
        probe-step
      </button>
      <output data-testid="local">{JSON.stringify(progress)}</output>
    </>
  )
}

const localProgress = (): Progress => JSON.parse(screen.getByTestId('local').textContent!)

function setup({ signedIn = false, local, configured = true }: { signedIn?: boolean; local?: Progress; configured?: boolean } = {}) {
  if (local) localStorage.setItem(STORAGE_KEY, JSON.stringify(local))
  const mock = createMockSupabase({ latency: 0, signedIn, email: EMAIL })
  render(
    <ProgressProvider>
      <AuthProvider backend={configured ? supabaseBackend(mock.client) : null}>
        <AccountButton />
        <SyncNudge />
        <AccountSection />
        <Probe />
      </AuthProvider>
    </ProgressProvider>,
  )
  return { mock, user: userEvent.setup() }
}

const dialog = () => document.querySelector('dialog.signin') as HTMLDialogElement

async function signIn(user: ReturnType<typeof userEvent.setup>) {
  await user.click((await screen.findAllByRole('button', { name: 'Sign in' }))[0])
  await user.type(screen.getByLabelText('Email'), EMAIL)
  await user.click(screen.getByRole('button', { name: /Email me a code/ }))
  await screen.findByRole('heading', { name: 'Check your email' })
  await waitFor(() => expect(screen.getByLabelText('Digit 1 of 6')).toHaveFocus())
  await user.keyboard(MOCK_CODE)
}

describe('accounts', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.useRealTimers())

  it('renders no account UI at all without configuration', () => {
    setup({ configured: false })
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Save your progress across devices/)).not.toBeInTheDocument()
    expect(document.querySelector('dialog')).toBeNull()
  })

  it('signs in with email and a 6-digit code, then syncs', async () => {
    const { mock, user } = setup()
    await user.click((await screen.findAllByRole('button', { name: 'Sign in' }))[0])
    expect(dialog()).toHaveAttribute('open')
    expect(within(dialog()).getByRole('heading', { name: 'Keep your progress everywhere' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveFocus())

    await user.type(screen.getByLabelText('Email'), `  ${EMAIL} `)
    await user.click(screen.getByRole('button', { name: /Email me a code/ }))
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(mock.calls.send).toEqual([EMAIL])
    expect(within(dialog()).getByText(EMAIL)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Digit 1 of 6')).toHaveFocus())

    await user.keyboard(MOCK_CODE) // auto-submits on the sixth digit
    const account = await screen.findByRole('button', { name: new RegExp(`Account: ${EMAIL}`) })
    await waitFor(() => expect(dialog()).not.toHaveAttribute('open'))
    expect(mock.calls.verify).toEqual([MOCK_CODE])
    await waitFor(() => expect(account).toHaveAccessibleName(`Account: ${EMAIL}. Synced`))
    expect(mock.calls.save).toHaveLength(1)
    expect(screen.getByText(`Signed in as ${EMAIL}. Syncing your progress.`)).toBeInTheDocument()
  })

  it('checks the email before sending anything', async () => {
    const { mock, user } = setup()
    await user.click((await screen.findAllByRole('button', { name: 'Sign in' }))[0])
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: /Email me a code/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your email address, like name@example.com.')
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(/Enter your email address/)
    expect(mock.calls.send).toEqual([])
  })

  it.each([
    [{ status: 429, code: 'over_email_send_rate_limit', message: 'rate' }, /a lot of tries/],
    [{ name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' }, /offline/],
    [{ status: 400, code: 'email_address_invalid', message: 'bad' }, /doesn’t look like an email/],
    [{ status: 422, code: 'signup_disabled', message: 'nope' }, /isn’t available/],
    [{ status: 500, message: 'boom' }, /Something went wrong/],
  ])('explains a failed send kindly (%o)', async (error, text) => {
    const { mock, user } = setup()
    mock.failNext('send', error)
    await user.click((await screen.findAllByRole('button', { name: 'Sign in' }))[0])
    await user.type(screen.getByLabelText('Email'), EMAIL)
    await user.click(screen.getByRole('button', { name: /Email me a code/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(text)
    expect(screen.getByRole('heading', { name: 'Keep your progress everywhere' })).toBeInTheDocument()
  })

  it('a wrong or expired code shows an error, clears the boxes, and a pasted right code still works', async () => {
    const { user } = setup()
    await user.click((await screen.findAllByRole('button', { name: 'Sign in' }))[0])
    await user.type(screen.getByLabelText('Email'), EMAIL)
    await user.click(screen.getByRole('button', { name: /Email me a code/ }))
    await screen.findByRole('heading', { name: 'Check your email' })
    await waitFor(() => expect(screen.getByLabelText('Digit 1 of 6')).toHaveFocus())
    await user.keyboard('000000')

    expect(await screen.findByRole('alert')).toHaveTextContent(/That code didn’t work/)
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveValue('')
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(screen.getByLabelText('Digit 1 of 6')).toHaveFocus())

    await user.paste(MOCK_CODE)
    expect(await screen.findByRole('button', { name: new RegExp(`Account: ${EMAIL}`) })).toBeInTheDocument()
  })

  it('resend waits out a 60 s countdown, then sends a new code', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { mock } = setup()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click((await screen.findAllByRole('button', { name: 'Sign in' }))[0])
    await user.type(screen.getByLabelText('Email'), EMAIL)
    await user.click(screen.getByRole('button', { name: /Email me a code/ }))
    const resend = await screen.findByRole('button', { name: /Resend in 1:00/ })
    expect(resend).toBeDisabled()

    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(resend).toHaveTextContent(/Resend in 0:[23]\d/)
    await act(() => vi.advanceTimersByTimeAsync(31_000))
    const again = screen.getByRole('button', { name: 'Send a new code' })
    expect(again).toBeEnabled()
    await user.click(again)
    await waitFor(() => expect(mock.calls.send).toHaveLength(2))
    expect(await screen.findByText(`New code sent to ${EMAIL}.`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Resend in 1:00/ })).toBeDisabled()
  })

  it('"Use a different email" goes back to the email step with the address kept', async () => {
    const { user } = setup()
    await user.click((await screen.findAllByRole('button', { name: 'Sign in' }))[0])
    await user.type(screen.getByLabelText('Email'), EMAIL)
    await user.click(screen.getByRole('button', { name: /Email me a code/ }))
    await user.click(await screen.findByRole('button', { name: /Use a different email/ }))
    expect(screen.getByLabelText('Email')).toHaveValue(EMAIL)
  })

  it('Escape (the dialog’s cancel) and Close both close it', async () => {
    const { user } = setup()
    await user.click((await screen.findAllByRole('button', { name: 'Sign in' }))[0])
    fireEvent(dialog(), new Event('cancel', { cancelable: true }))
    expect(dialog()).not.toHaveAttribute('open')
    await user.click(screen.getAllByRole('button', { name: /Sign in/ })[0])
    expect(dialog()).toHaveAttribute('open')
    await user.click(within(dialog()).getByRole('button', { name: 'Close' }))
    expect(dialog()).not.toHaveAttribute('open')
  })

  it('merges cloud and local progress on sign-in and uploads the result', async () => {
    const local: Progress = {
      ...emptyProgress(),
      lessons: { 'first-led': { stepsSeen: ['intro'], challengesDone: [], quizBest: 0.5, quizAttempts: 1 } },
      activeDays: ['2026-10-01'],
    }
    const { mock, user } = setup({ local })
    mock.rows.set(`user-${EMAIL}`, {
      user_id: `user-${EMAIL}`,
      updated_at: '2026-10-02T00:00:00.000Z',
      data: {
        ...emptyProgress(),
        lessons: { 'first-led': { stepsSeen: ['lab'], challengesDone: ['c1'], quizBest: 0.9, quizAttempts: 2 } },
        achievements: { 'first-light': '2026-10-02T00:00:00.000Z' },
        activeDays: ['2026-10-02'],
        lastLessonId: 'first-led',
      },
    })
    await signIn(user)
    await waitFor(() => expect(mock.calls.save).toHaveLength(1))
    const merged = localProgress()
    expect(merged.lessons['first-led']).toEqual({
      stepsSeen: ['intro', 'lab'],
      challengesDone: ['c1'],
      quizBest: 0.9,
      quizAttempts: 2,
    })
    expect(merged.activeDays).toEqual(['2026-10-01', '2026-10-02'])
    expect(merged.achievements).toEqual({ 'first-light': '2026-10-02T00:00:00.000Z' })
    expect(mock.calls.save[0].data).toEqual(merged)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(merged)
  })

  it('ignores a corrupted cloud copy (untrusted) and replaces it with local progress', async () => {
    const local: Progress = { ...emptyProgress(), activeDays: ['2026-10-01'] }
    const { mock, user } = setup({ local })
    mock.rows.set(`user-${EMAIL}`, {
      user_id: `user-${EMAIL}`,
      updated_at: '2026-10-02T00:00:00.000Z',
      data: { version: 1, lessons: { x: { stepsSeen: 'oops' } }, achievements: {}, activeDays: [] },
    })
    await signIn(user)
    await waitFor(() => expect(mock.calls.save).toHaveLength(1))
    expect(mock.calls.save[0].data).toEqual(local)
    expect(localProgress()).toEqual(local)
  })

  it('never overwrites progress saved by a newer app version', async () => {
    const { mock, user } = setup({ signedIn: true })
    mock.rows.set(`user-${EMAIL}`, { user_id: `user-${EMAIL}`, updated_at: '2026-10-02T00:00:00.000Z', data: { version: 2 } })
    await user.click(await screen.findByRole('button', { name: /Account:/ }))
    expect((await screen.findAllByText(/progress from a newer version/)).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Not synced').length).toBeGreaterThan(0)
    expect(mock.calls.save).toHaveLength(0)
  })

  it('uploads later changes, and flushes at once on pagehide', async () => {
    const { mock, user } = setup({ signedIn: true })
    await waitFor(() => expect(mock.calls.save).toHaveLength(1))
    await user.click(screen.getByRole('button', { name: 'probe-step' }))
    window.dispatchEvent(new Event('pagehide'))
    await waitFor(() => expect(mock.calls.save).toHaveLength(2))
    expect((mock.calls.save[1].data as Progress).lessons['first-led'].stepsSeen).toEqual(['lab'])
  })

  it('shows "Offline, will retry" when the first sync fails offline', async () => {
    const { mock } = setup({ signedIn: true })
    mock.failNext('load', { message: 'TypeError: Failed to fetch', code: '' }, 0)
    const account = await screen.findByRole('button', { name: /Account:/ })
    await waitFor(() => expect(account).toHaveAccessibleName(`Account: ${EMAIL}. Offline, will retry`))
    expect(mock.calls.save).toHaveLength(0) // nothing is uploaded before a successful merge
  })

  it('the account panel shows email and status, closes on Escape, and Sign out keeps local progress', async () => {
    const { mock, user } = setup({ signedIn: true })
    await user.click(screen.getByRole('button', { name: 'probe-step' }))
    const account = await screen.findByRole('button', { name: /Account:/ })
    await waitFor(() => expect(account).toHaveAccessibleName(`Account: ${EMAIL}. Synced`))

    await user.click(account)
    expect(account).toHaveAttribute('aria-expanded', 'true')
    const panel = screen.getByRole('group', { name: 'Account' })
    expect(within(panel).getByText(EMAIL)).toBeInTheDocument()
    expect(within(panel).getByRole('status')).toHaveTextContent('Synced')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('group', { name: 'Account' })).not.toBeInTheDocument()
    expect(account).toHaveFocus()

    await user.click(account)
    await user.click(within(screen.getByRole('group', { name: 'Account' })).getByRole('button', { name: 'Sign out' }))
    expect(await screen.findAllByRole('button', { name: /Sign in/ })).not.toHaveLength(0)
    expect(mock.calls.signOut).toBe(1)
    expect(localProgress().lessons['first-led'].stepsSeen).toEqual(['lab'])
  })

  it('the Home nudge shows only while signed out and stays dismissed', async () => {
    const { user } = setup()
    const nudge = await screen.findByRole('complementary', { name: 'Save your progress across devices' })
    await user.click(within(nudge).getByRole('button', { name: 'Dismiss sign-in suggestion' }))
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(localStorage.getItem('ohmlab.syncNudge')).toBe('done')
  })

  it('Settings shows a sign-in invitation, or the account with sign out', async () => {
    setup()
    const section = await screen.findByRole('region', { name: 'Account' })
    expect(within(section).getByRole('button', { name: 'Sign in to sync' })).toBeEnabled()
  })
})
