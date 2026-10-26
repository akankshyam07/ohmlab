import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Block } from '../content/types'
import { BlockView } from './blocks'

const predict: Block = {
  type: 'predict',
  id: 'p1',
  prompt: 'Swap 1 kΩ for **220 Ω**. What happens to the current?',
  options: [
    { text: 'It drops.', why: 'More resistance would drop it, but 220 Ω is *less*.' },
    { text: 'It rises.', correct: true, why: 'Less resistance lets more current through.' },
  ],
  tryIt: 'Pick **220 Ω** and read the current meter.',
}

describe('BlockView', () => {
  beforeEach(() => localStorage.clear())

  it('renders walkthrough step text with bold words as one text container', () => {
    const block: Block = {
      type: 'walkthrough',
      title: 'Trace the loop',
      steps: [{ text: 'Start at the **+** side of **V1**. This is the push.', math: 'V = 5 V', highlight: ['V1'] }],
    }
    const onHighlight = vi.fn()
    render(<BlockView block={block} onHighlight={onHighlight} />)
    const step = screen.getByRole('button', { name: /Start at the \+ side of V1/ })
    const body = step.querySelector('.blk-walk-body')!
    // Two children: the sentence (one inline flow, bold included) and the maths line.
    expect(body.children).toHaveLength(2)
    expect(body.children[0].textContent).toBe('Start at the + side of V1. This is the push.')
    expect(body.children[0].querySelectorAll('strong')).toHaveLength(2)
    fireEvent.click(step)
    expect(onHighlight).toHaveBeenCalledWith(['V1'])
  })

  it('predict: needs a guess, sends the learner to the lab, then reveals on request', () => {
    render(<BlockView block={predict} onHighlight={() => {}} />)
    expect(screen.getByText('Predict first')).toBeInTheDocument()
    const lock = screen.getByRole('button', { name: 'Lock in my guess' })
    expect(lock).toBeDisabled()

    fireEvent.click(screen.getByRole('radio', { name: 'It drops.' }))
    fireEvent.click(lock)

    // Locked, but the lab answers first.
    expect(screen.getByText(/read the current meter/)).toBeInTheDocument()
    expect(screen.queryByText(/More resistance would drop it/)).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'It drops.' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Lock in my guess' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show the answer' }))
    expect(screen.getByText(/More resistance would drop it/)).toBeInTheDocument()
    expect(screen.getByText(/a wrong guess is how the idea sticks/)).toBeInTheDocument()
    expect(screen.getByText('The answer:').parentElement).toHaveTextContent('The answer: It rises.')
  })

  it('predict: a right guess is confirmed without repeating the answer, and is kept after a reload', () => {
    const { unmount } = render(<BlockView block={predict} onHighlight={() => {}} />)
    fireEvent.click(screen.getByRole('radio', { name: 'It rises.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lock in my guess' }))
    unmount()

    render(<BlockView block={predict} onHighlight={() => {}} />)
    expect(screen.getByRole('radio', { name: 'It rises.' })).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Show the answer' }))
    expect(screen.getByText('Good call.')).toBeInTheDocument()
    expect(screen.getByText(/Less resistance lets more current/)).toBeInTheDocument()
    expect(screen.queryByText('The answer:')).not.toBeInTheDocument()
  })

  it('table: every cell carries its column name for the phone card layout', () => {
    const block: Block = { type: 'table', head: ['Divider', 'Sag'], rows: [['1 kΩ / 1 kΩ', 'about 5 %']] }
    render(<BlockView block={block} onHighlight={() => {}} />)
    expect(screen.getByRole('cell', { name: 'about 5 %' })).toHaveAttribute('data-label', 'Sag')
    expect(screen.getByRole('columnheader', { name: 'Divider' })).toBeInTheDocument()
  })
})

describe('code block', () => {
  const code: Block = {
    type: 'code',
    language: 'cpp',
    code: 'void setup() {\n  pinMode(23, OUTPUT);\n}\n',
    caption: 'The sketch.',
    notes: [{ line: 2, text: 'GPIO23 drives the LED.' }],
  }

  it('shows numbered, highlighted lines, and a note lights its line on hover or focus', () => {
    render(<BlockView block={code} onHighlight={() => {}} />)
    const region = screen.getByRole('region', { name: 'Arduino C++ code' })
    const lines = region.querySelectorAll('.blk-code-line')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toHaveTextContent('2 pinMode(23, OUTPUT);1')
    expect(lines[1].querySelector('.tok-number')).toHaveTextContent('23')
    const note = within(screen.getByRole('list', { name: 'Notes on the code' })).getByRole('listitem')
    expect(note).toHaveTextContent('Line 2 GPIO23 drives the LED.')
    fireEvent.mouseEnter(note)
    expect(lines[1]).toHaveAttribute('data-hot')
    fireEvent.mouseLeave(note)
    expect(lines[1]).not.toHaveAttribute('data-hot')
    fireEvent.focus(note)
    expect(lines[1]).toHaveAttribute('data-hot')
  })

  it('"Copy code" copies the source and confirms; falls back to execCommand when the clipboard is refused', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<BlockView block={code} onHighlight={() => {}} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy code' })))
    expect(writeText).toHaveBeenCalledWith('void setup() {\n  pinMode(23, OUTPUT);\n}\n')
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Code copied to the clipboard')

    writeText.mockRejectedValue(new Error('denied'))
    const exec = vi.fn().mockReturnValue(true)
    document.execCommand = exec
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copied' })))
    expect(exec).toHaveBeenCalledWith('copy')
  })
})
