import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Lesson } from '../content/types'
import type { LessonProgress } from '../progress/types'
import { LessonPage } from './LessonPage'
import { SettingsProvider } from './settings'

const state = vi.hoisted(() => ({
  lp: { stepsSeen: [], challengesDone: ['a'], quizBest: 0.5, quizAttempts: 1 } as LessonProgress,
}))

vi.mock('../content', () => {
  const lesson = {
    id: 'first-led',
    day: 1,
    phase: 1,
    title: 'First LED',
    tagline: 'Light it up',
    minutes: 20,
    objectives: [],
    sections: [{ id: 'intro', title: 'Intro', blocks: [{ type: 'text', text: 'Hello' }] }],
    lab: {
      title: 'LED loop',
      intro: '',
      challenges: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    },
    quiz: [],
    realBuild: {
      parts: ['Red LED', '220 Ω resistor'],
      steps: ['Push the LED in.', 'Add R1 next to D1.'],
      safety: ['Never skip the resistor.'],
      breadboard: { supply: 'uno', parts: [{ id: 'D1' }, { id: 'R1' }, { id: 'W1' }] },
      stepParts: [['D1', 'W1'], ['R1']],
    },
  } as unknown as Lesson
  return { lessons: [lesson], getLesson: (id: string) => (id === lesson.id ? lesson : undefined) }
})

vi.mock('../progress/store', () => ({
  useProgress: () => ({
    progress: { version: 1, lessons: { 'first-led': state.lp }, achievements: {}, activeDays: [] },
    markStep: () => {},
    mastery: () => 0.4,
    isComplete: () => false,
  }),
}))

vi.mock('../features/lab/Lab', () => ({ Lab: () => <section aria-label="Circuit lab" /> }))
vi.mock('../viz/iso/IsoBench', () => ({
  IsoBench: (p: { ariaLabel?: string; highlight?: string[]; result?: unknown }) => (
    <svg
      role="img"
      aria-label={p.ariaLabel}
      data-highlight={(p.highlight ?? []).join(',')}
      data-live={p.result ? 'yes' : 'no'}
    />
  ),
}))
vi.mock('../sim/solver', () => ({ solveDC: () => ({ ok: true }) }))
vi.mock('../viz/BreadboardView', () => ({
  BreadboardView: ({ ariaLabel, highlight }: { ariaLabel: string; highlight?: string[] }) => (
    <svg role="img" aria-label={ariaLabel} data-highlight={(highlight ?? []).join(',')} />
  ),
}))
vi.mock('../features/quiz/Quiz', () => ({ Quiz: () => <section aria-label="Quiz" /> }))

const renderStep = (step?: string) =>
  render(
    <SettingsProvider>
      <LessonPage id="first-led" step={step} />
    </SettingsProvider>,
  )

describe('LessonPage', () => {
  it('shows the completion checklist in the header', () => {
    renderStep()
    const list = screen.getByRole('group', { name: 'To complete this lesson' })
    expect(list).toHaveTextContent('Quiz ≥ 80 % best 50 %, not done yet')
    expect(list).toHaveTextContent('Lab challenges 1 / 3, not done yet')
    expect(within(list).getByRole('button', { name: 'Go to challenges' })).toBeInTheDocument()
  })

  it('puts the step text before the lab, and the stage can be hidden and shown', () => {
    renderStep()
    const heading = screen.getByRole('heading', { level: 2, name: 'Intro' })
    const lab = screen.getByRole('region', { name: 'Circuit lab' })
    expect(heading.compareDocumentPosition(lab) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const toggle = screen.getByRole('button', { name: 'Hide circuit' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Show circuit' })).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Go to challenges' }))
    expect(screen.getByRole('button', { name: 'Hide circuit' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('says which part of mastery is missing, and the quiz offers "Skip quiz" instead of a second Next', () => {
    renderStep('quiz')
    expect(screen.getByText('steps read 0 / 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip quiz' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
  })

  it('build step: safety, a tick-off parts list, numbered steps and the checklist again', () => {
    renderStep('build')
    expect(screen.getByRole('note')).toHaveTextContent('Never skip the resistor.')
    const parts = screen.getByRole('group', { name: /Parts/ })
    expect(parts).toHaveTextContent('0 / 2 ready')
    fireEvent.click(within(parts).getByRole('checkbox', { name: 'Red LED' }))
    expect(parts).toHaveTextContent('1 / 2 ready')
    expect(screen.getByText('Push the LED in.')).toBeInTheDocument()
    expect(screen.getAllByRole('group', { name: 'To complete this lesson' })).toHaveLength(2)
  })

  it('build step: the stage shows the wiring, lit by stepParts, with the simulator a toggle away', () => {
    renderStep('build')
    // One board, on the stage (not repeated above the steps), and the lab is hidden behind it.
    const board = screen.getByRole('img', { name: 'Breadboard wiring for First LED' })
    expect(board.closest('.lesson-stage')).not.toBeNull()
    expect(screen.getAllByRole('img', { name: /Breadboard wiring/ })).toHaveLength(1)
    expect(screen.queryByRole('region', { name: 'Circuit lab' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Full screen' })).toBeInTheDocument()
    expect(board).toHaveAttribute('data-live', 'yes')

    fireEvent.click(screen.getByRole('button', { name: /Add R1 next to D1/ }))
    expect(board).toHaveAttribute('data-highlight', 'R1')
    fireEvent.click(screen.getByRole('button', { name: /Push the LED in/ }))
    expect(board).toHaveAttribute('data-highlight', 'D1,W1')

    const views = screen.getByRole('group', { name: 'Stage view' })
    const wiring = within(views).getByRole('button', { name: 'Wiring' })
    const simulator = within(views).getByRole('button', { name: 'Simulator' })
    expect(wiring).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(simulator)
    expect(simulator).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('region', { name: 'Circuit lab' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Breadboard wiring/ })).not.toBeInTheDocument()
    fireEvent.click(wiring)
    expect(screen.getByRole('img', { name: 'Breadboard wiring for First LED' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Circuit lab' })).not.toBeInTheDocument()

    // "Go to challenges" needs the lab, so it switches the stage back to the simulator.
    fireEvent.click(screen.getAllByRole('button', { name: 'Go to challenges' })[0])
    expect(simulator).toHaveAttribute('aria-pressed', 'true')
  })

  it('other steps keep the lab title in the stage bar and no view toggle', () => {
    renderStep()
    expect(screen.queryByRole('group', { name: 'Stage view' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Breadboard wiring/ })).not.toBeInTheDocument()
  })
})
