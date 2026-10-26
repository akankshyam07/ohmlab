import type { SupabaseClient } from '@supabase/supabase-js'
import type { Progress } from '../progress/types'

// ---------- configuration (public client keys only; never a service_role or secret key) ----------

export interface AuthConfig {
  url: string
  key: string
}

/** A publishable key (`sb_publishable_…`) or a legacy anon JWT. Secret and service_role keys are refused. */
export function isClientKey(key: string): boolean {
  if (key.startsWith('sb_publishable_')) return true
  const parts = key.split('.')
  if (parts.length !== 3) return false
  try {
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))?.role === 'anon'
  } catch {
    return false
  }
}

/** Build-time env → config, or null (accounts off, exactly the local-only app). */
export function readConfig(env: Record<string, unknown>): AuthConfig | null {
  const url = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : ''
  const key = typeof env.VITE_SUPABASE_PUBLISHABLE_KEY === 'string' ? env.VITE_SUPABASE_PUBLISHABLE_KEY.trim() : ''
  if (!url && !key) return null
  if (!/^https:\/\/[^/\s]+/.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url)) {
    console.error('Ohmlab: VITE_SUPABASE_URL must be your project URL (https://…). Accounts are off.')
    return null
  }
  if (!isClientKey(key)) {
    console.error('Ohmlab: VITE_SUPABASE_PUBLISHABLE_KEY must be a publishable or anon key. Accounts are off.')
    return null
  }
  return { url, key }
}

export const authConfig = readConfig(import.meta.env)

/** Dev only: `?mockAuth` (or `?mockAuth=signedin`) runs the account UI against an in-memory fake. */
const mockAuth = import.meta.env.DEV ? new URLSearchParams(globalThis.location?.search).get('mockAuth') : null

export const authAvailable = authConfig !== null || (import.meta.env.DEV && mockAuth !== null)

// ---------- errors the learner can understand ----------

export type ProblemKind =
  | 'offline'
  | 'rate-limit'
  | 'bad-code'
  | 'bad-email'
  | 'unavailable'
  | 'newer-data'
  | 'cloud-off'
  | 'unknown'

const MESSAGES: Record<ProblemKind, string> = {
  offline: 'You seem to be offline. Check your connection, then try again.',
  'rate-limit': 'That’s a lot of tries in a short time. Wait a minute, then try again.',
  'bad-code': 'That code didn’t work. It may have a typo or have expired — check the newest email, or send a new code.',
  'bad-email': 'That doesn’t look like an email address. Check it and try again.',
  unavailable: 'Sign-in isn’t available for this email right now. Your progress is still saved in this browser.',
  'newer-data': 'Your account has progress from a newer version of Ohmlab. Reload the page to update, then it will sync.',
  'cloud-off': 'Cloud saving isn’t available on this page right now. Your progress is still saved in this browser.',
  unknown: 'Something went wrong on our side. Please try again in a moment.',
}

export class AuthProblem extends Error {
  readonly kind: ProblemKind
  /** Read by the sync scheduler: offline shows "will retry", fatal stops retrying. */
  readonly offline: boolean
  readonly fatal: boolean
  constructor(kind: ProblemKind) {
    super(MESSAGES[kind])
    this.name = 'AuthProblem'
    this.kind = kind
    this.offline = kind === 'offline'
    this.fatal = kind === 'newer-data' || kind === 'cloud-off'
  }
}

/** Any error from supabase-js (AuthError, PostgrestError, fetch TypeError) → an AuthProblem. */
export function toProblem(error: unknown, httpStatus?: number): AuthProblem {
  if (error instanceof AuthProblem) return error
  const e = (error ?? {}) as { name?: unknown; status?: unknown; code?: unknown; message?: unknown }
  const status = httpStatus ?? (typeof e.status === 'number' ? e.status : undefined)
  const code = String(e.code ?? '')
  const message = String(e.message ?? '')
  if (!navigator.onLine || status === 0 || e.name === 'AuthRetryableFetchError' || e.name === 'TypeError')
    return new AuthProblem('offline')
  if (status === 429 || code.includes('rate_limit')) return new AuthProblem('rate-limit')
  if (code === 'otp_expired' || /token has expired|invalid (otp|token)/i.test(message)) return new AuthProblem('bad-code')
  if (code === 'email_address_invalid' || code === 'validation_failed') return new AuthProblem('bad-email')
  if (/disabled|not_authorized/.test(code)) return new AuthProblem('unavailable')
  return new AuthProblem('unknown')
}

// ---------- the backend the app talks to ----------

export interface AuthUser {
  id: string
  /** '' in artifact mode. */
  email: string
  /** Artifact mode only, for display; never stored. */
  name?: string
  avatarUrl?: string
}

export interface CloudProgress {
  /** Untrusted: validate before use. */
  data: unknown
  updatedAt: string
}

export interface Backend {
  /** 'email': Supabase, signed in with an emailed code. 'artifact': the claude.ai viewer, always signed in. */
  kind: 'email' | 'artifact'
  /** Calls back with the current user (once known) and on every sign-in or sign-out. Returns unsubscribe. */
  onUserChange: (callback: (user: AuthUser | null) => void) => () => void
  /** Email mode only. */
  sendCode?: (email: string) => Promise<void>
  verifyCode?: (email: string, code: string) => Promise<void>
  signOut?: () => Promise<void>
  loadProgress: (userId: string) => Promise<CloudProgress | null>
  saveProgress: (userId: string, data: Progress, updatedAt: string) => Promise<void>
}

/** The only place that knows supabase-js's shapes. Everything throws AuthProblem. */
export function supabaseBackend(client: SupabaseClient): Backend {
  return {
    kind: 'email',
    onUserChange(callback) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        const user = session?.user
        callback(user ? { id: user.id, email: user.email ?? '' } : null)
      })
      return () => data.subscription.unsubscribe()
    },
    async sendCode(email) {
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
      if (error) throw toProblem(error)
    },
    async verifyCode(email, token) {
      const { error } = await client.auth.verifyOtp({ email, token, type: 'email' })
      if (error) throw toProblem(error)
    },
    async signOut() {
      // 'local' signs out this browser only. supabase-js drops the local session even when the request fails.
      await client.auth.signOut({ scope: 'local' })
    },
    async loadProgress(userId) {
      const { data, error, status } = await client
        .from('progress')
        .select('data, updated_at')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw toProblem(error, status)
      return data ? { data: data.data, updatedAt: String(data.updated_at) } : null
    },
    async saveProgress(userId, data, updatedAt) {
      const { error, status } = await client.from('progress').upsert({ user_id: userId, data, updated_at: updatedAt })
      if (error) throw toProblem(error, status)
    },
  }
}

/** True when this page might be a claude.ai Artifact (the answer arrives asynchronously). */
export const mayBeArtifact = () => typeof (globalThis as { claude?: { use?: unknown } }).claude?.use === 'function'

/** Loads supabase-js only when accounts are configured, so the local-only app never downloads it. */
export async function createBackend(): Promise<Backend | null> {
  if (import.meta.env.DEV && mockAuth !== null) {
    const { createMockSupabase } = await import('./mock')
    return supabaseBackend(createMockSupabase({ signedIn: mockAuth === 'signedin' }).client)
  }
  if (!authConfig) return null
  const { createClient } = await import('@supabase/supabase-js')
  // Uploads started while the page is going away use keepalive, so the browser finishes them after unload.
  let leaving = false
  window.addEventListener('pagehide', () => (leaving = true), { capture: true })
  window.addEventListener('pageshow', () => (leaving = false))
  const client = createClient(authConfig.url, authConfig.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, leaving ? { ...init, keepalive: true } : init) },
  })
  return supabaseBackend(client)
}
