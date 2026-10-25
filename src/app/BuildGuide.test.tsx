import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RealBuild } from '../content/types'
import type { BreadboardLayout, BreadboardViewProps } from '../viz/types'
import { BuildGuide, partIdsInStep } from './BuildGuide'

vi.mock('../viz/BreadboardView', () => ({
  BreadboardView: ({ ariaLabel, highlight }: BreadboardViewProps) => (
    <svg role="img" aria-label={ariaLabel} data-highlight={(highlight ?? []).join(',')} />
  ),
}))

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
    render(<BuildGuide build={build} title="First LED" />)
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
    render(<BuildGuide build={build} title="First LED" />)
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

  it('without a layout, steps stay a plain list', () => {
    render(<BuildGuide build={{ ...build, breadboard: undefined }} title="First LED" />)
    expect(screen.queryByRole('figure')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Place R1/ })).not.toBeInTheDocument()
    expect(screen.getByText('Add D1 and wire W1.')).toBeInTheDocument()
  })
})
