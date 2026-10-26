import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * In-memory stand-in for the parts of supabase-js that src/auth/client.ts uses. Used by tests and by the dev-only
 * `?mockAuth` flag (never in production builds). The right code is 123456; anything else is "expired or invalid".
 */

type Op = 'send' | 'verify' | 'load' | 'save'
interface Row {
  user_id: string
  data: unknown
  updated_at: string
}
type Session = { user: { id: string; email: string } } | null
type Listener = (event: string, session: Session) => void

export const MOCK_CODE = '123456'

export function createMockSupabase({ signedIn = false, latency = 600, email = 'ada@example.com' } = {}) {
  const listeners = new Set<Listener>()
  const sessionFor = (address: string): Session => ({ user: { id: `user-${address}`, email: address } })
  let session: Session = signedIn ? sessionFor(email) : null
  const rows = new Map<string, Row>()
  const failures: { op: Op; error: object; status?: number }[] = []
  const calls = { send: [] as string[], verify: [] as string[], load: 0, save: [] as Row[], signOut: 0 }

  const wait = () => new Promise((resolve) => setTimeout(resolve, latency))
  const failure = (op: Op) => {
    const i = failures.findIndex((f) => f.op === op)
    return i < 0 ? null : failures.splice(i, 1)[0]
  }
  const emit = (event: string) => listeners.forEach((l) => l(event, session))

  const auth = {
    onAuthStateChange(listener: Listener) {
      listeners.add(listener)
      queueMicrotask(() => listener('INITIAL_SESSION', session))
      return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } }
    },
    async signInWithOtp({ email: address }: { email: string }) {
      await wait()
      calls.send.push(address)
      const f = failure('send')
      return { data: {}, error: f?.error ?? null }
    },
    async verifyOtp({ email: address, token }: { email: string; token: string }) {
      await wait()
      calls.verify.push(token)
      const f = failure('verify')
      if (f) return { data: {}, error: f.error }
      if (token !== MOCK_CODE)
        return {
          data: {},
          error: { name: 'AuthApiError', status: 403, code: 'otp_expired', message: 'Token has expired or is invalid' },
        }
      session = sessionFor(address)
      emit('SIGNED_IN')
      return { data: { session }, error: null }
    },
    async signOut() {
      calls.signOut++
      session = null
      emit('SIGNED_OUT')
      return { error: null }
    },
  }

  const from = () => ({
    select: () => ({
      eq: (_column: string, userId: string) => ({
        async maybeSingle() {
          await wait()
          calls.load++
          const f = failure('load')
          if (f) return { data: null, error: f.error, status: f.status ?? 500 }
          const row = rows.get(userId)
          return { data: row ? { data: row.data, updated_at: row.updated_at } : null, error: null, status: 200 }
        },
      }),
    }),
    async upsert(row: Row) {
      await wait()
      const f = failure('save')
      if (f) return { error: f.error, status: f.status ?? 500 }
      calls.save.push(row)
      rows.set(row.user_id, structuredClone(row))
      return { error: null, status: 201 }
    },
  })

  return {
    client: { auth, from } as unknown as SupabaseClient,
    calls,
    rows,
    /** Make the next call of `op` fail with this supabase-style error. */
    failNext(op: Op, error: object, status?: number) {
      failures.push({ op, error, status })
    },
  }
}
