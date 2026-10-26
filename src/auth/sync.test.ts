import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyProgress } from '../progress/store'
import type { Progress } from '../progress/types'
import { createSyncScheduler, type SyncScheduler } from './sync'

const snap = (day: string): Progress => ({ ...emptyProgress(), activeDays: [day] })

describe('sync scheduler', () => {
  let scheduler: SyncScheduler
  let push: ReturnType<typeof vi.fn<(p: Progress) => Promise<Progress | void>>>
  let statuses: string[]

  const make = () => {
    statuses = []
    scheduler = createSyncScheduler({ push, onStatus: (s) => statuses.push(s) })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    push = vi.fn(async () => {})
    make()
  })
  afterEach(() => {
    scheduler.dispose()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('debounces changes for 1.5 s and sends only the newest snapshot', async () => {
    scheduler.schedule(snap('1'))
    await vi.advanceTimersByTimeAsync(1000)
    scheduler.schedule(snap('2'))
    await vi.advanceTimersByTimeAsync(1499)
    expect(push).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith(snap('2'))
    expect(statuses).toEqual(['syncing', 'synced'])
  })

  it('never re-sends a snapshot that is already stored', async () => {
    scheduler.schedule(snap('1'), 0)
    await vi.runAllTimersAsync()
    scheduler.schedule(snap('1'))
    await vi.runAllTimersAsync()
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('treats what push resolves to as stored, so a merged copy is not uploaded again', async () => {
    push.mockResolvedValueOnce(snap('merged'))
    scheduler.schedule(snap('local'), 0)
    await vi.runAllTimersAsync()
    scheduler.schedule(snap('merged'))
    await vi.runAllTimersAsync()
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('drops a snapshot queued during an upload when it equals what was stored', async () => {
    let finish!: (p: Progress) => void
    push.mockImplementationOnce(() => new Promise<Progress>((r) => (finish = r)))
    scheduler.schedule(snap('local'), 0)
    await vi.advanceTimersByTimeAsync(0)
    scheduler.schedule(snap('merged')) // e.g. the store re-rendering with the merged copy
    finish(snap('merged'))
    await vi.advanceTimersByTimeAsync(0)
    expect(statuses.at(-1)).toBe('synced')
    await vi.runAllTimersAsync()
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('retries with exponential backoff while offline, then reports synced', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    push.mockRejectedValue(new TypeError('Failed to fetch'))
    scheduler.schedule(snap('1'), 0)
    await vi.advanceTimersByTimeAsync(0)
    expect(statuses.at(-1)).toBe('offline')
    await vi.advanceTimersByTimeAsync(1999)
    expect(push).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(push).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(4000)
    expect(push).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(8000)
    expect(push).toHaveBeenCalledTimes(4)

    online.mockReturnValue(true)
    push.mockResolvedValue(undefined)
    await vi.advanceTimersByTimeAsync(16_000)
    expect(push).toHaveBeenCalledTimes(5)
    expect(statuses.at(-1)).toBe('synced')
  })

  it('caps the backoff at 60 s', async () => {
    push.mockRejectedValue(new Error('500'))
    scheduler.schedule(snap('1'), 0)
    await vi.advanceTimersByTimeAsync(2000 + 4000 + 8000 + 16000 + 32000)
    expect(push).toHaveBeenCalledTimes(6)
    expect(statuses.at(-1)).toBe('error')
    await vi.advanceTimersByTimeAsync(59_999)
    expect(push).toHaveBeenCalledTimes(6)
    await vi.advanceTimersByTimeAsync(1)
    expect(push).toHaveBeenCalledTimes(7)
  })

  it('retries at once when the browser comes back online, with the newest snapshot', async () => {
    push.mockRejectedValueOnce(Object.assign(new Error('net'), { offline: true }))
    scheduler.schedule(snap('1'), 0)
    await vi.advanceTimersByTimeAsync(0)
    expect(statuses.at(-1)).toBe('offline')
    scheduler.schedule(snap('2')) // during backoff: replaces the queued snapshot, keeps the timer
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)
    expect(push).toHaveBeenCalledTimes(2)
    expect(push).toHaveBeenLastCalledWith(snap('2'))
    expect(statuses.at(-1)).toBe('synced')
  })

  it('flushes on pagehide and when the page is hidden', async () => {
    scheduler.schedule(snap('1'))
    window.dispatchEvent(new Event('pagehide'))
    await vi.advanceTimersByTimeAsync(0)
    expect(push).toHaveBeenCalledTimes(1)

    scheduler.schedule(snap('2'))
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(push).toHaveBeenCalledTimes(2)
  })

  it('sends a change made during an upload right after it', async () => {
    let finish!: () => void
    push.mockImplementationOnce(() => new Promise<void>((r) => (finish = r)))
    scheduler.schedule(snap('1'), 0)
    await vi.advanceTimersByTimeAsync(0)
    scheduler.schedule(snap('2'))
    await vi.advanceTimersByTimeAsync(1500) // timer fires while the first upload is still out
    expect(push).toHaveBeenCalledTimes(1)
    finish()
    await vi.advanceTimersByTimeAsync(0)
    expect(push).toHaveBeenCalledTimes(2)
    expect(push).toHaveBeenLastCalledWith(snap('2'))
  })

  it('flush() waits for the upload and never rejects', async () => {
    push.mockRejectedValue(new Error('boom'))
    scheduler.schedule(snap('1'))
    await expect(scheduler.flush()).resolves.toBeUndefined()
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('stops for good on a fatal error', async () => {
    push.mockRejectedValue(Object.assign(new Error('newer'), { fatal: true }))
    scheduler.schedule(snap('1'), 0)
    await vi.runAllTimersAsync()
    scheduler.schedule(snap('2'), 0)
    await vi.runAllTimersAsync()
    expect(push).toHaveBeenCalledTimes(1)
    expect(statuses.at(-1)).toBe('error')
  })

  it('does nothing after dispose', async () => {
    scheduler.schedule(snap('1'))
    scheduler.dispose()
    window.dispatchEvent(new Event('pagehide'))
    await vi.runAllTimersAsync()
    expect(push).not.toHaveBeenCalled()
  })
})
