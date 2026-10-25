import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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

  it('predict: needs a guess, then reveals its why, the answer and what to try', () => {
    render(<BlockView block={predict} onHighlight={() => {}} />)
    expect(screen.getByText('Predict first')).toBeInTheDocument()
    const lock = screen.getByRole('button', { name: 'Lock in my guess' })
    expect(lock).toBeDisabled()
    expect(screen.queryByText(/Less resistance/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'It drops.' }))
    fireEvent.click(lock)

    expect(screen.getByText(/More resistance would drop it/)).toBeInTheDocument()
    expect(screen.getByText(/a wrong guess is how the idea sticks/)).toBeInTheDocument()
    expect(screen.getByText('The answer:').parentElement).toHaveTextContent('The answer: It rises.')
    expect(screen.getByText(/read the current meter/)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'It drops.' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Lock in my guess' })).not.toBeInTheDocument()
  })

  it('predict: a right guess is confirmed without repeating the answer', () => {
    render(<BlockView block={predict} onHighlight={() => {}} />)
    fireEvent.click(screen.getByRole('radio', { name: 'It rises.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lock in my guess' }))
    expect(screen.getByText('Good call.')).toBeInTheDocument()
    expect(screen.getByText(/Less resistance lets more current/)).toBeInTheDocument()
    expect(screen.queryByText('The answer:')).not.toBeInTheDocument()
  })
})
