import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ProgressProvider, emptyProgress, useProgress } from '../progress/store'
import { STORAGE_KEY, type Progress } from '../progress/types'
import { AccountButton, AccountSection, SyncNudge } from './Account'
import { AuthProvider } from './AuthProvider'
import { createArtifactBackend, progressPath } from './artifact'

type Body = Record<string, unknown>

/** A stand-in for claude.ai's `window.claude` with frozen `db` and `user` namespaces, as the platform serves them. */
function fakeClaude({ id = 'u_ada' as string | null, name = 'Ada Lovelace', db = true, user = true } = {}) {
  const docs = new Map<string, Body>()
  const sets: { path: string; body: Body }[] = []
  const failures: { op: 'get' | 'set'; code: string }[] = []
  const fail = (op: 'get' | 'set') => {
    const i = failures.findIndex((f) => f.op === op)
    if (i >= 0) throw { code: failures.splice(i, 1)[0].code, message: 'nope' }
  }
  const dbNs = Object.freeze({
    doc(path: string) {
      if (path.split('/').length % 2) throw new TypeError('a document path needs an even number of segments')
      return Object.freeze({
        async get() {
          fail('get')
          const body = docs.get(path)
          return Object.freeze({ exists: !!body, data: () => (body ? structuredClone(body) : undefined), metadata: {} })
        },
        async set(body: Body) {
          fail('set')
          sets.push({ path, body: structuredClone(body) })
          docs.set(path, structuredClone(body))
        },
      })
    },
  })
  const userNs = Object.freeze({ me: async () => ({ id, name, avatarUrl: '', color: '', email: null }) })
  const claude = Object.freeze({
    use: (cap: string) => Promise.resolve(cap === 'db' ? (db ? dbNs : null) : cap === 'user' ? (user ? userNs : null) : null),
  })
  ;(globalThis as { claude?: unknown }).claude = claude
  return { docs, sets, failNext: (op: 'get' | 'set', code: string) => failures.push({ op, code }) }
}

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

function mount() {
  render(
    <ProgressProvider>
      <AuthProvider>
        <AccountButton />
        <SyncNudge />
        <AccountSection />
        <Probe />
      </AuthProvider>
    </ProgressProvider>,
  )
  return userEvent.setup()
}

const PATH = progressPath('u_ada')
const lesson = (stepsSeen: string[]) => ({ stepsSeen, challengesDone: [], quizBest: 0, quizAttempts: 0 })

describe('artifact backend', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => delete (globalThis as { claude?: unknown }).claude)

  it('is absent without window.claude, without db or user, or without a viewer id', async () => {
    expect(await createArtifactBackend()).toBeNull()
    fakeClaude({ db: false })
    expect(await createArtifactBackend()).toBeNull()
    fakeClaude({ user: false })
    expect(await createArtifactBackend()).toBeNull()
    fakeClaude({ id: null })
    expect(await createArtifactBackend()).toBeNull()
  })

  it('reads and writes one private doc, data/users/<id>/progress, as { progress, updatedAt }', async () => {
    const fake = fakeClaude()
    const backend = (await createArtifactBackend())!
    expect(backend.kind).toBe('artifact')
    expect(await backend.loadProgress('u_ada')).toBeNull()
    const p = { ...emptyProgress(), activeDays: ['2026-10-01'] }
    await backend.saveProgress('u_ada', p, '2026-10-02T00:00:00.000Z')
    expect(fake.sets).toEqual([{ path: 'data/users/u_ada/progress', body: { progress: p, updatedAt: '2026-10-02T00:00:00.000Z' } }])
    expect(await backend.loadProgress('u_ada')).toEqual({ data: p, updatedAt: '2026-10-02T00:00:00.000Z' })
  })

  it('stops on permanent db errors and retries transient ones', async () => {
    const fake = fakeClaude()
    const backend = (await createArtifactBackend())!
    fake.failNext('set', 'invalid_argument')
    await expect(backend.saveProgress('u_ada', emptyProgress(), '')).rejects.toMatchObject({ kind: 'cloud-off', fatal: true })
    fake.failNext('get', 'unavailable')
    await expect(backend.loadProgress('u_ada')).rejects.toMatchObject({ kind: 'unknown', fatal: false })
    fake.failNext('get', 'some_future_code')
    await expect(backend.loadProgress('u_ada')).rejects.toMatchObject({ fatal: false })
  })

  it('shows the Claude account with no sign-in or sign-out UI, and syncs on start', async () => {
    const fake = fakeClaude()
    const user = mount()
    const account = await screen.findByRole('button', { name: /Account: Ada Lovelace/ })
    await waitFor(() => expect(account).toHaveAccessibleName('Account: Ada Lovelace. Synced with your Claude account'))
    expect(fake.sets).toHaveLength(1)
    expect(fake.sets[0].path).toBe(PATH)
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Save your progress across devices/)).not.toBeInTheDocument()
    expect(document.querySelector('dialog')).toBeNull()

    await user.click(account)
    const panel = screen.getByRole('group', { name: 'Account' })
    expect(within(panel).getByText('Your Claude account')).toBeInTheDocument()
    expect(within(panel).getByText('Ada Lovelace')).toBeInTheDocument()
    expect(within(panel).getByRole('status')).toHaveTextContent('Synced with your Claude account')
    expect(within(panel).queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Account' })).not.toHaveTextContent(/sign out/i)
  })

  it('without a name, says "Your Claude account" and never stores the name', async () => {
    const fake = fakeClaude({ name: '' })
    mount()
    expect(await screen.findByRole('button', { name: /Account: your Claude account/ })).toBeInTheDocument()
    await waitFor(() => expect(fake.sets).toHaveLength(1))
    expect(JSON.stringify(fake.sets)).not.toMatch(/Ada/)
  })

  it('merges the cloud copy into local progress (validated) and uploads the union', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...emptyProgress(), lessons: { 'first-led': lesson(['intro']) } }))
    const fake = fakeClaude()
    fake.docs.set(PATH, {
      progress: { ...emptyProgress(), lessons: { 'first-led': lesson(['lab']) }, activeDays: ['2026-10-03'] },
      updatedAt: '2026-10-03T00:00:00.000Z',
    })
    mount()
    await waitFor(() => expect(fake.sets).toHaveLength(1))
    const local: Progress = JSON.parse(screen.getByTestId('local').textContent!)
    expect(local.lessons['first-led'].stepsSeen).toEqual(['intro', 'lab'])
    expect(local.activeDays).toEqual(['2026-10-03'])
    expect(fake.sets[0].body.progress).toEqual(local)
  })

  it('writes nothing when the cloud copy already matches (key order aside)', async () => {
    const p = { ...emptyProgress(), lessons: { 'first-led': lesson(['intro']) } }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
    const fake = fakeClaude()
    // Same data, keys in another order, as a store may return them.
    fake.docs.set(PATH, { updatedAt: '2026-10-03T00:00:00.000Z', progress: JSON.parse(JSON.stringify({ activeDays: [], achievements: {}, lessons: p.lessons, version: 1 })) })
    mount()
    const account = await screen.findByRole('button', { name: /Account:/ })
    await waitFor(() => expect(account).toHaveAccessibleName(/Synced with your Claude account/))
    expect(fake.sets).toHaveLength(0)
  })

  it('uploads a later change once, flushing on pagehide', async () => {
    const fake = fakeClaude()
    const user = mount()
    await waitFor(() => expect(fake.sets).toHaveLength(1))
    await user.click(screen.getByRole('button', { name: 'probe-step' }))
    window.dispatchEvent(new Event('pagehide'))
    await waitFor(() => expect(fake.sets).toHaveLength(2))
    window.dispatchEvent(new Event('pagehide'))
    await new Promise((r) => setTimeout(r, 20))
    expect(fake.sets).toHaveLength(2) // unchanged: no second write
    expect((fake.sets[1].body.progress as Progress).lessons['first-led'].stepsSeen).toEqual(['lab'])
  })

  it('a refused write (view-only viewer) stops syncing and says so; progress stays local', async () => {
    const fake = fakeClaude()
    fake.failNext('set', 'invalid_argument')
    const user = mount()
    const account = await screen.findByRole('button', { name: /Account:/ })
    await waitFor(() => expect(account).toHaveAccessibleName(/Not synced/))
    await user.click(account)
    expect(screen.getByRole('group', { name: 'Account' })).toHaveTextContent(/Cloud saving isn’t available/)
  })

  it('falls back to local only (no account UI) when window.claude offers nothing and Supabase is not configured', async () => {
    fakeClaude({ db: false })
    mount()
    await waitFor(() => expect(document.querySelector('.acct-slot')).toBeNull())
    expect(screen.queryByRole('region', { name: 'Account' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign in|account/i })).not.toBeInTheDocument()
  })
})
