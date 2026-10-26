import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CodeInput } from './CodeInput'

function setup() {
  const onComplete = vi.fn()
  const onChange = vi.fn()
  render(
    <>
      <p id="label">6-digit code</p>
      <CodeInput labelledBy="label" onComplete={onComplete} onChange={onChange} />
    </>,
  )
  const boxes = screen.getAllByRole('textbox') as HTMLInputElement[]
  return { onComplete, onChange, boxes, user: userEvent.setup() }
}

const values = (boxes: HTMLInputElement[]) => boxes.map((b) => b.value).join('')

describe('CodeInput', () => {
  it('is a labelled group of six numeric boxes, the first one autofillable', () => {
    const { boxes } = setup()
    expect(screen.getByRole('group', { name: '6-digit code' })).toBeInTheDocument()
    expect(boxes).toHaveLength(6)
    expect(boxes[0]).toHaveAccessibleName('Digit 1 of 6')
    expect(boxes[5]).toHaveAccessibleName('Digit 6 of 6')
    expect(boxes[0]).toHaveAttribute('autocomplete', 'one-time-code')
    expect(boxes[0]).toHaveAttribute('inputmode', 'numeric')
  })

  it('advances as you type and completes once, with the whole code', async () => {
    const { boxes, user, onComplete } = setup()
    await user.click(boxes[0])
    await user.keyboard('1234')
    expect(boxes[4]).toHaveFocus()
    expect(onComplete).not.toHaveBeenCalled()
    await user.keyboard('56')
    expect(values(boxes)).toBe('123456')
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith('123456')
  })

  it('ignores letters and spaces', async () => {
    const { boxes, user, onChange } = setup()
    await user.click(boxes[0])
    await user.keyboard('a 7')
    expect(values(boxes)).toBe('7')
    expect(boxes[1]).toHaveFocus()
    expect(onChange).toHaveBeenLastCalledWith('7')
  })

  it('spreads a pasted code across the boxes, ignoring separators', async () => {
    const { boxes, user, onComplete } = setup()
    await user.click(boxes[2])
    await user.paste('Your code: 987-654')
    expect(values(boxes)).toBe('987654')
    expect(onComplete).toHaveBeenCalledWith('987654')
    expect(boxes[5]).toHaveFocus()
  })

  it('pastes a partial code from the focused box on', async () => {
    const { boxes, user } = setup()
    await user.click(boxes[1])
    await user.paste('42')
    expect(boxes.map((b) => b.value)).toEqual(['', '4', '2', '', '', ''])
    expect(boxes[3]).toHaveFocus()
  })

  it('accepts a whole code autofilled into the first box (iOS one-time-code)', () => {
    const { boxes, onComplete } = setup()
    fireEvent.change(boxes[0], { target: { value: '314159' } })
    expect(values(boxes)).toBe('314159')
    expect(onComplete).toHaveBeenCalledWith('314159')
  })

  it('replaces a digit typed over a filled box', () => {
    const { boxes } = setup()
    fireEvent.change(boxes[0], { target: { value: '3' } })
    fireEvent.change(boxes[0], { target: { value: '38' } })
    expect(boxes[0].value).toBe('8')
    expect(boxes[1]).toHaveFocus()
  })

  it('Backspace clears the box, then steps back and clears the previous one', async () => {
    const { boxes, user } = setup()
    await user.click(boxes[0])
    await user.keyboard('123')
    expect(boxes[3]).toHaveFocus()
    await user.keyboard('{Backspace}')
    expect(values(boxes)).toBe('12')
    expect(boxes[2]).toHaveFocus()
    await user.keyboard('{Backspace}')
    expect(values(boxes)).toBe('1')
    expect(boxes[1]).toHaveFocus()
  })

  it('moves with the arrow keys, Home and End', async () => {
    const { boxes, user } = setup()
    await user.click(boxes[2])
    await user.keyboard('{ArrowLeft}')
    expect(boxes[1]).toHaveFocus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(boxes[3]).toHaveFocus()
    await user.keyboard('{End}')
    expect(boxes[5]).toHaveFocus()
    await user.keyboard('{Home}')
    expect(boxes[0]).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(boxes[0]).toHaveFocus()
  })
})
