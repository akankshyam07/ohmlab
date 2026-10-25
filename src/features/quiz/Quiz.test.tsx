import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { QuizQuestion } from '../../content/types'
import { ProgressProvider } from '../../progress/store'
import { STORAGE_KEY } from '../../progress/types'
import { Quiz } from './Quiz'

vi.mock('../../content', () => ({ lessons: [], getLesson: () => undefined, phases: [] }))

const questions: QuizQuestion[] = [
  {
    id: 'q1',
    type: 'choice',
    prompt: 'What limits the current through an LED?',
    options: [
      { text: 'The LED itself', why: 'An LED barely resists once it turns on.' },
      { text: 'A series resistor', correct: true, why: 'The resistor sets the current.' },
    ],
  },
  {
    id: 'q2',
    type: 'numeric',
    prompt: 'What current flows? (3 V across 220 Ω)',
    answer: 13.6,
    tolerance: 0.05,
    unit: 'mA',
    hint: 'Use I = V / R.',
    explanation: '3 V / 220 Ω ≈ 13.6 mA.',
  },
]

const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')?.lessons?.day01

function setup() {
  render(
    <ProgressProvider>
      <Quiz lessonId="day01" questions={questions} />
    </ProgressProvider>,
  )
  return userEvent.setup()
}

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('Quiz', () => {
  it('explains a wrong choice, allows one numeric retry, scores first attempts only, records once', async () => {
    const user = setup()
    expect(screen.getByRole('region', { name: 'Quiz' })).toBeInTheDocument()
    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check answer' })).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: 'The LED itself' }))
    await user.click(screen.getByRole('button', { name: 'Check answer' }))
    expect(screen.getByText('Not quite.')).toBeInTheDocument()
    expect(screen.getByText('An LED barely resists once it turns on.')).toBeInTheDocument()
    expect(screen.getByText(/The resistor sets the current\./)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next question' }))
    expect(screen.getByText('Question 2 of 2')).toBeInTheDocument()
    const input = screen.getByRole('textbox', { name: /your answer/i })

    await user.type(input, 'lots')
    await user.click(screen.getByRole('button', { name: 'Check answer' }))
    expect(screen.getByText(/type a number/i)).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, '5')
    await user.click(screen.getByRole('button', { name: 'Check answer' }))
    expect(screen.getByText('Use I = V / R.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next question' })).not.toBeInTheDocument()

    await user.clear(input)
    await user.type(input, '0.0136 A')
    await user.click(screen.getByRole('button', { name: 'Check answer' }))
    expect(screen.getByText('Correct!')).toBeInTheDocument()
    expect(screen.getByText('3 V / 220 Ω ≈ 13.6 mA.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next question' }))
    expect(screen.getByText('You scored 0 / 2')).toBeInTheDocument()
    expect(saved()).toMatchObject({ quizBest: 0, quizAttempts: 1 })
  })

  it('shows the answer after a second wrong numeric attempt', async () => {
    const user = setup()
    await user.click(screen.getByRole('radio', { name: 'A series resistor' }))
    await user.click(screen.getByRole('button', { name: 'Check answer' }))
    await user.click(screen.getByRole('button', { name: 'Next question' }))
    const input = screen.getByRole('textbox', { name: /your answer/i })
    await user.type(input, '5{Enter}')
    await user.clear(input)
    await user.type(input, '6{Enter}')
    expect(screen.getByText('Not quite.')).toBeInTheDocument()
    expect(screen.getByText('The answer is 13.6 mA.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next question' }))
    expect(screen.getByText('You scored 1 / 2')).toBeInTheDocument()
  })

  it('passes at 80 % and Retry quiz starts over', async () => {
    const user = setup()
    for (let round = 0; round < 2; round++) {
      await user.click(screen.getByRole('radio', { name: 'A series resistor' }))
      await user.click(screen.getByRole('button', { name: 'Check answer' }))
      await user.click(screen.getByRole('button', { name: 'Next question' }))
      await user.type(screen.getByRole('textbox', { name: /your answer/i }), '13.6 mA')
      await user.click(screen.getByRole('button', { name: 'Check answer' }))
      await user.click(screen.getByRole('button', { name: 'Next question' }))
      expect(screen.getByText('You scored 2 / 2')).toBeInTheDocument()
      expect(screen.getByText(/that’s a pass/)).toBeInTheDocument()
      if (round === 0) {
        await user.click(screen.getByRole('button', { name: 'Retry quiz' }))
        expect(screen.getByText('Question 1 of 2')).toBeInTheDocument()
      }
    }
    expect(saved()).toMatchObject({ quizBest: 1, quizAttempts: 2 })
  })
})
