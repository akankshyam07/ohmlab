import { AuthProblem, type Backend } from './client'

/**
 * Zero-setup cloud sync when Ohmlab runs as a claude.ai Artifact: the viewer is already signed in to claude.ai, so
 * progress goes to their private `db` subtree, `data/users/<id>/progress`, as `{ progress, updatedAt }`.
 * Only the subset of the platform's `db` and `user` capabilities used here is typed (see artifact-capabilities).
 */

interface DocSnapshot {
  exists: boolean
  data(): Record<string, unknown> | undefined
}
interface DocRef {
  get(): Promise<DocSnapshot>
  set(data: Record<string, unknown>): Promise<void>
}
export interface ArtifactDb {
  doc(path: string): DocRef
}
export interface ArtifactUser {
  me(): Promise<{ id: string | null; name: string; avatarUrl: string }>
}
interface ClaudeHost {
  use(name: string): Promise<unknown>
}

export const progressPath = (userId: string) => `data/users/${userId}/progress`

// Codes the platform documents as permanent for this page load; anything else (unavailable, resource_exhausted,
// unknown codes) is transient and retried with the scheduler's backoff.
const PERMANENT = new Set([
  'invalid_argument',
  'quota_exceeded',
  'revoked',
  'not_granted',
  'capability_disabled',
  'capability_removed',
  'transform_error',
])

export function toDbProblem(error: unknown): AuthProblem {
  if (!navigator.onLine) return new AuthProblem('offline')
  const code = (error as { code?: unknown } | null)?.code
  return new AuthProblem(typeof code === 'string' && PERMANENT.has(code) ? 'cloud-off' : 'unknown')
}

const USE_TIMEOUT_MS = 15_000 // the platform resolves null after ~10 s; this only guards a host that never does

function use(host: ClaudeHost, name: string): Promise<unknown> {
  return Promise.race([
    Promise.resolve()
      .then(() => host.use(name))
      .catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), USE_TIMEOUT_MS)),
  ])
}

/** The artifact backend, or null when this page isn't a claude.ai Artifact with `db` + `user` and a viewer id. */
export async function createArtifactBackend(): Promise<Backend | null> {
  const host = (globalThis as { claude?: Partial<ClaudeHost> }).claude
  if (typeof host?.use !== 'function') return null
  const [db, user] = (await Promise.all([use(host as ClaudeHost, 'db'), use(host as ClaudeHost, 'user')])) as [
    ArtifactDb | null,
    ArtifactUser | null,
  ]
  if (!db || !user) return null
  const me = await user.me().catch(() => null)
  if (!me?.id) return null // no identity here, so no private subtree: fall back
  let ref: DocRef
  try {
    ref = db.doc(progressPath(me.id))
  } catch {
    return null // an id the path grammar rejects
  }
  // Names are display-only: kept in memory for the account menu, never written anywhere.
  const viewer = { id: me.id, email: '', name: me.name || undefined, avatarUrl: me.avatarUrl || undefined }

  return {
    kind: 'artifact',
    onUserChange(callback) {
      queueMicrotask(() => callback(viewer))
      return () => {}
    },
    async loadProgress() {
      let snap: DocSnapshot
      try {
        snap = await ref.get()
      } catch (e) {
        throw toDbProblem(e)
      }
      if (!snap.exists) return null
      const body = snap.data()
      return { data: body?.progress, updatedAt: typeof body?.updatedAt === 'string' ? body.updatedAt : '' }
    },
    async saveProgress(_userId, progress, updatedAt) {
      try {
        await ref.set({ progress: structuredClone(progress) as unknown as Record<string, unknown>, updatedAt })
      } catch (e) {
        throw toDbProblem(e)
      }
    },
  }
}
