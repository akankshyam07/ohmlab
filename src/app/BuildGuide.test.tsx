import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RealBuild } from '../content/types'
import type { BreadboardLayout, BreadboardViewProps } from '../viz/types'
import { BuildGuide, partIdsInStep, partsForStep } from './BuildGuide'

vi.mock('../viz/BreadboardView', () => ({
  BreadboardView: ({ ariaLabel, highlight }: BreadboardViewProps) => (
    <svg role="img" aria-label={ariaLabel} data-view="flat" data-highlight={(highlight ?? []).join(',')} />
  ),
}))
vi.mock('../viz/iso/IsoBench', () => ({
  IsoBench: (p: { ariaLabel?: string; highlight?: string[]; focus?: string[]; result?: unknown; animate?: boolean }) => (
    <svg
      role="img"
      aria-label={p.ariaLabel}
      data-view="iso"
      data-highlight={(p.highlight ?? []).join(',')}
      data-focus={(p.focus ?? []).join(',')}
      data-live={p.result ? 'yes' : 'no'}
      data-animate={String(p.animate)}
    />
  ),
}))

beforeEach(() => localStorage.clear())

const layout: BreadboardLayout = {
  supply: 'uno',
  parts: [
    { kind: 'resistor', id: 'R1', from: 'a10', to: 'a14', ohms: 220 } as never,
    { kind: 'led', id: 'D1', anode: 'b14', cathode: 'b15', color: 'red' } as never,
    { kind: 'resistor', id: 'R10', from: 'c1', to: 'c5', ohms: 1000 } as never,
    { kind: 'wire', id: 'W1', from: 'j1', to: 'j2', color: 'red' } as never,
  ],
}

describe('partIdsInStep', () => {
  it('finds whole-word ids, including inside bold, in layout order', () => {
    expect(partIdsInStep('Push **D1** in, then bridge it with R1.', layout)).toEqual(['R1', 'D1'])
  })
  it('does not match an id inside a longer one or a word', () => {
    expect(partIdsInStep('Use R10 here (not the R1-ish thing XR1).', layout)).toEqual(['R10'])
    expect(partIdsInStep('Plug the Uno into USB.', layout)).toEqual([])
    expect(partIdsInStep('', layout)).toEqual([])
  })
})

describe('partsForStep', () => {
  const steps = ['Place **R1** from row 10 to row 14.', 'Power the rails from the Uno.']
  it('uses the authored stepParts over id matching, even where the text names other parts', () => {
    const build: RealBuild = { parts: [], steps, breadboard: layout, stepParts: [['W1'], ['D1', 'R10']] }
    expect(partsForStep(build, 0)).toEqual(['W1'])
    expect(partsForStep(build, 1)).toEqual(['D1', 'R10'])
  })
  it('falls back to the ids a step names only when stepParts is absent', () => {
    expect(partsForStep({ parts: [], steps, breadboard: layout }, 0)).toEqual(['R1'])
    expect(partsForStep({ parts: [], steps, breadboard: layout, stepParts: [] }, 0)).toEqual([])
    expect(partsForStep({ parts: [], steps }, 0)).toEqual([])
  })
})

/** BuildGuide is controlled (the lesson owns the current step); this holds it the way LessonPage does. */
function Guide({ build }: { build: RealBuild }) {
  const [active, setActive] = useState<number | null>(null)
  return <BuildGuide build={build} title="First LED" active={active} onActive={setActive} />
}

describe('BuildGuide wiring diagram', () => {
  const build: RealBuild = {
    parts: ['Red LED'],
    steps: ['Place **R1** from row 10 to row 14.', 'Add D1 and wire W1.'],
    safety: ['Unplug first.'],
    breadboard: layout,
  }

  beforeEach(() => {
    // jsdom has no showModal/close; mimic the browser's open state and close event.
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  })
  afterEach(() => {
    delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal
    delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close
  })

  it('highlights the parts a step names when it is focused or clicked', () => {
    render(<Guide build={build} />)
    const board = screen.getByRole('img', { name: 'Breadboard wiring for First LED' })
    expect(board).toHaveAttribute('data-highlight', '')
    const step2 = screen.getByRole('button', { name: /Add D1 and wire W1/ })
    fireEvent.focus(step2)
    expect(board).toHaveAttribute('data-highlight', 'D1,W1')
    fireEvent.click(screen.getByRole('button', { name: /Place R1/ }))
    expect(board).toHaveAttribute('data-highlight', 'R1')
    expect(screen.getByRole('button', { name: /Place R1/ })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('note')).toHaveTextContent('Unplug first.')
  })

  it('opens full screen in a dialog, closes, and returns focus to the expand button', () => {
    render(<Guide build={build} />)
    const expand = screen.getByRole('button', { name: 'Full screen' })
    expect(screen.queryByRole('img', { name: /enlarged/ })).not.toBeInTheDocument()

    fireEvent.click(expand)
    const dialog = screen.getByRole<HTMLDialogElement>('dialog', { name: 'Wiring diagram' })
    expect(dialog).toHaveAttribute('open')
    expect(screen.getByRole('img', { name: 'Breadboard wiring for First LED, enlarged' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(dialog).not.toHaveAttribute('open')
    expect(screen.queryByRole('img', { name: /enlarged/ })).not.toBeInTheDocument()
    expect(expand).toHaveFocus()

    // Escape: the browser cancels the modal dialog and fires "close"; the same path runs.
    fireEvent.click(expand)
    act(() => dialog.close())
    expect(screen.queryByRole('img', { name: /enlarged/ })).not.toBeInTheDocument()
    expect(expand).toHaveFocus()
  })

  it('the step scrolled across the reading line becomes current, unless one was just picked', () => {
    let fire: (target: Element) => void = () => {}
    const observed: Element[] = []
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          fire = (target) => cb([{ target, isIntersecting: true } as unknown as IntersectionObserverEntry], this as never)
        }
        observe(el: Element) {
          observed.push(el)
        }
        disconnect() {}
      },
    )
    const now = vi.spyOn(Date, 'now').mockReturnValue(10_000)
    render(<Guide build={build} />)
    const board = screen.getByRole('img', { name: 'Breadboard wiring for First LED' })
    expect(observed).toHaveLength(2)
    act(() => fire(observed[1]))
    expect(board).toHaveAttribute('data-highlight', 'D1,W1')
    expect(screen.getByRole('button', { name: /Add D1/ })).toHaveAttribute('aria-current', 'step')

    fireEvent.click(screen.getByRole('button', { name: /Place R1/ }))
    act(() => fire(observed[1]))
    expect(board).toHaveAttribute('data-highlight', 'R1')
    now.mockReturnValue(20_000)
    act(() => fire(observed[1]))
    expect(board).toHaveAttribute('data-highlight', 'D1,W1')
    now.mockRestore()
    vi.unstubAllGlobals()
  })

  it('on a lesson stage (staged) the diagram is not repeated above the steps', () => {
    render(<BuildGuide build={build} title="First LED" active={null} onActive={() => {}} staged />)
    expect(screen.queryByRole('img', { name: /Breadboard wiring/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Place R1/ })).toBeInTheDocument()
  })

  it('shows the 3D bench by default; "Flat" swaps in the flat board and is remembered', () => {
    const { unmount } = render(<Guide build={build} />)
    const views = screen.getByRole('group', { name: 'Wiring view' })
    expect(within(views).getByRole('button', { name: '3D' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('img', { name: 'Breadboard wiring for First LED' })).toHaveAttribute('data-view', 'iso')
    fireEvent.click(screen.getByRole('button', { name: /Add D1/ }))
    expect(screen.getByRole('img', { name: 'Breadboard wiring for First LED' })).toHaveAttribute('data-focus', 'D1,W1')

    fireEvent.click(within(views).getByRole('button', { name: 'Flat' }))
    expect(screen.getByRole('img', { name: 'Breadboard wiring for First LED' })).toHaveAttribute('data-view', 'flat')
    unmount()
    render(<Guide build={build} />)
    expect(screen.getByRole('img', { name: 'Breadboard wiring for First LED' })).toHaveAttribute('data-view', 'flat')
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }))
    expect(screen.getByRole('img', { name: 'Breadboard wiring for First LED, enlarged' })).toHaveAttribute(
      'data-view',
      'flat',
    )
  })

  it('without a layout, steps stay a plain list', () => {
    render(<Guide build={{ ...build, breadboard: undefined }} />)
    expect(screen.queryByRole('figure')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Place R1/ })).not.toBeInTheDocument()
    expect(screen.getByText('Add D1 and wire W1.')).toBeInTheDocument()
  })
})
