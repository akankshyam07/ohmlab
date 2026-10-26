import type { Progress } from '../progress/types'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'

export interface SyncOptions {
  /** Uploads a snapshot; may resolve to what was really stored (e.g. after a merge). Throws to retry. */
  push: (progress: Progress) => Promise<Progress | void>
  onStatus: (status: SyncStatus, error?: unknown) => void
  /** Quiet time after the last change before uploading. */
  delay?: number
}

const RETRY_BASE_MS = 2000
const RETRY_MAX_MS = 60_000

/** An error with `fatal: true` stops retrying (e.g. the cloud holds data from a newer app version). */
const isFatal = (e: unknown) => (e as { fatal?: unknown } | null)?.fatal === true
const isOffline = (e: unknown) => !navigator.onLine || (e as { offline?: unknown } | null)?.offline === true

/**
 * Debounced uploader for whole-progress snapshots. The newest snapshot always wins (each one is complete), an
 * unchanged snapshot is never sent twice, failures retry with exponential backoff (2 s … 60 s) and at once when the
 * browser comes back online, and leaving or hiding the page flushes immediately.
 */
export function createSyncScheduler({ push, onStatus, delay = 1500 }: SyncOptions) {
  let pending: Progress | null = null
  let lastPushed: string | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let inflight: Promise<void> | null = null
  let failures = 0
  let stopped = false

  const arm = (ms: number) => {
    clearTimeout(timer)
    timer = setTimeout(() => void run(), ms)
  }

  async function run(): Promise<void> {
    clearTimeout(timer)
    timer = undefined
    if (inflight) {
      await inflight
      return timer === undefined ? run() : undefined // a retry was armed after a failure: let it wait
    }
    if (stopped || !pending) return
    const next = pending
    pending = null
    if (JSON.stringify(next) === lastPushed) {
      onStatus('synced')
      return
    }
    onStatus('syncing')
    inflight = (async () => {
      try {
        lastPushed = JSON.stringify((await push(next)) ?? next)
        failures = 0
        if (pending && JSON.stringify(pending) === lastPushed) {
          pending = null // queued during the upload, and already what was stored (e.g. the merged copy)
          clearTimeout(timer)
          timer = undefined
        }
        if (!stopped && !pending) onStatus('synced')
      } catch (error) {
        pending ??= next // a newer snapshot, if any, replaces this one
        if (stopped) return
        if (isFatal(error)) {
          stopped = true
          onStatus('error', error)
          return
        }
        onStatus(isOffline(error) ? 'offline' : 'error', error)
        arm(Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** failures++))
      }
    })()
    try {
      await inflight
    } finally {
      inflight = null
    }
  }

  const flush = () => run()
  const onOnline = () => {
    if (pending && failures > 0) void run()
  }
  const onHidden = () => {
    if (document.visibilityState === 'hidden') void run()
  }
  window.addEventListener('online', onOnline)
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', onHidden)

  return {
    /** Queue a snapshot; uploads after `ms` of quiet (default `delay`; 0 = now). */
    schedule(progress: Progress, ms = delay) {
      if (stopped) return
      pending = progress
      if (failures > 0 && timer !== undefined) return // keep the backoff; the retry sends the newest snapshot
      if (ms === 0) void run()
      else arm(ms)
    },
    /** Upload anything pending now. Never rejects. */
    flush,
    dispose() {
      stopped = true
      clearTimeout(timer)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHidden)
    },
  }
}

export type SyncScheduler = ReturnType<typeof createSyncScheduler>
