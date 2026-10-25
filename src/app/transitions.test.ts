import { afterEach, describe, expect, it, vi } from 'vitest'
import { afterViewTransition, withViewTransition } from './transitions'

describe('withViewTransition', () => {
  afterEach(() => {
    delete (document as Partial<Document>).startViewTransition
  })

  it('without view transitions, applies the update at once', () => {
    const update = vi.fn()
    withViewTransition(update, 'page')
    expect(update).toHaveBeenCalledOnce()
    expect(document.documentElement.dataset.nav).toBeUndefined()
  })

  it('runs the update inside a transition, tags its kind, and runs follow-ups after it finishes', async () => {
    let finish = () => {}
    const finished = new Promise<void>((resolve) => (finish = resolve))
    document.startViewTransition = ((cb: () => void) => {
      cb()
      return { finished } as ViewTransition
    }) as Document['startViewTransition']
    const update = vi.fn()
    const after = vi.fn()
    withViewTransition(update, 'step')
    expect(update).toHaveBeenCalledOnce()
    expect(document.documentElement.dataset.nav).toBe('step')
    afterViewTransition(after)
    expect(after).not.toHaveBeenCalled()
    finish()
    await finished
    await Promise.resolve()
    expect(after).toHaveBeenCalledOnce()
    expect(document.documentElement.dataset.nav).toBeUndefined()
  })
})
