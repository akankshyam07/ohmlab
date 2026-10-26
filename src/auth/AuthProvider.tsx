import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useProgress, useProgressSync, validateProgress } from '../progress/store'
import type { Progress } from '../progress/types'
import { AuthProblem, authAvailable, createBackend, toProblem, type AuthUser, type Backend, type CloudProgress } from './client'
import { mergeProgress } from './merge'
import { SignInDialog } from './SignInDialog'
import { createSyncScheduler, type SyncScheduler, type SyncStatus } from './sync'

export interface AuthApi {
  /** Supabase is configured. When false no account UI renders anywhere. */
  available: boolean
  /** We know whether someone is signed in (the session has been read). */
  ready: boolean
  user: AuthUser | null
  sync: { status: SyncStatus; problem?: AuthProblem }
  /** Both throw AuthProblem with a message fit to show. */
  sendCode: (email: string) => Promise<void>
  verifyCode: (email: string, code: string) => Promise<void>
  signOut: () => Promise<void>
  openSignIn: () => void
}

const noop = async () => {}
const OFF: AuthApi = {
  available: false,
  ready: true,
  user: null,
  sync: { status: 'idle' },
  sendCode: noop,
  verifyCode: noop,
  signOut: noop,
  openSignIn: () => {},
}

const AuthContext = createContext<AuthApi>(OFF)

/** Outside an <AuthProvider> (e.g. in page tests) accounts are simply off. */
export const useAuth = () => useContext(AuthContext)

const CHANGED_KEY = 'ohmlab.progressChangedAt'

function readChangedAt(): number {
  try {
    return Date.parse(localStorage.getItem(CHANGED_KEY) ?? '') || 0
  } catch {
    return 0
  }
}

function writeChangedAt(iso: string) {
  try {
    localStorage.setItem(CHANGED_KEY, iso)
  } catch {
    // Blocked storage: the cloud copy just counts as newer for lastLessonId.
  }
}

/** Local progress + the cloud row → merged progress. The row is untrusted, so it is validated first. */
export function mergeCloud(local: Progress, cloud: CloudProgress | null): Progress {
  if (!cloud) return local
  const remote = validateProgress(cloud.data)
  if (!remote) {
    const version = (cloud.data as { version?: unknown } | null)?.version
    if (typeof version === 'number' && version > 1) throw new AuthProblem('newer-data') // never overwrite it
    return local // corrupted copy: replaced by this browser's progress
  }
  return mergeProgress(local, remote, (Date.parse(cloud.updatedAt) || 0) > readChangedAt() ? 'b' : 'a')
}

/**
 * Optional accounts. `backend` is for tests: omitted, the real one loads from env (or nothing does, without it);
 * null means "not configured".
 */
export function AuthProvider({ children, backend: injected }: { children: ReactNode; backend?: Backend | null }) {
  const available = injected === undefined ? authAvailable : injected !== null
  const [backend, setBackend] = useState<Backend | null>(injected ?? null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(!available)
  const [sync, setSync] = useState<AuthApi['sync']>({ status: 'idle' })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const scheduler = useRef<SyncScheduler | null>(null)
  const { progress } = useProgress()
  const local = useProgressSync()

  useEffect(() => {
    if (injected !== undefined || !authAvailable) return
    let live = true
    createBackend()
      .then((b) => live && setBackend(b))
      .catch(() => live && setReady(true)) // supabase-js failed to load: behave as signed out
    return () => {
      live = false
    }
  }, [injected])

  useEffect(() => {
    if (!backend) return
    return backend.onUserChange((next) => {
      setReady(true)
      setUser((u) => (u?.id === next?.id && u?.email === next?.email ? u : next))
    })
  }, [backend])

  // Signed in: merge once with the cloud copy (retrying until it works), then upload every change.
  const userId = user?.id
  useEffect(() => {
    if (!backend || !userId) return
    let live = true
    let merged = false
    const s = createSyncScheduler({
      onStatus: (status, error) => live && setSync({ status, problem: error ? toProblem(error) : undefined }),
      // Always uploads the latest local progress, never an older queued snapshot that predates the merge.
      push: async () => {
        const now = new Date().toISOString()
        if (merged) {
          const latest = local.current()
          await backend.saveProgress(userId, latest, now)
          return latest
        }
        const cloud = await backend.loadProgress(userId)
        if (!live) return
        const next = mergeCloud(local.current(), cloud) // current(): changes made while loading count too
        local.replace(next)
        await backend.saveProgress(userId, next, now)
        merged = true
        return next
      },
    })
    scheduler.current = s
    s.schedule(local.current(), 0)
    return () => {
      live = false
      s.dispose()
      scheduler.current = null
      setSync({ status: 'idle' })
    }
  }, [backend, userId, local])

  const seen = useRef(progress)
  useEffect(() => {
    if (!available || seen.current === progress) return
    seen.current = progress
    writeChangedAt(new Date().toISOString())
    scheduler.current?.schedule(progress)
  }, [available, progress])

  useEffect(() => {
    if (user) setDialogOpen(false)
  }, [user])

  const signOut = useCallback(async () => {
    if (!backend) return
    await scheduler.current?.flush() // the last changes reach the cloud first (best effort when offline)
    await backend.signOut().catch(() => {})
    setAnnouncement('Signed out. Your progress stays in this browser.')
  }, [backend])

  const api = useMemo<AuthApi>(() => {
    if (!available) return OFF
    const need = () => {
      if (!backend) throw new AuthProblem('unknown')
      return backend
    }
    return {
      available,
      ready,
      user,
      sync,
      sendCode: (email) => need().sendCode(email),
      verifyCode: async (email, code) => {
        await need().verifyCode(email, code)
        setAnnouncement(`Signed in as ${email}. Syncing your progress.`)
      },
      signOut,
      openSignIn: () => setDialogOpen(true),
    }
  }, [available, backend, ready, user, sync, signOut])

  return (
    <AuthContext.Provider value={api}>
      {children}
      {available && (
        <>
          <SignInDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
          <p className="sr-only" role="status">
            {announcement}
          </p>
        </>
      )}
    </AuthContext.Provider>
  )
}
