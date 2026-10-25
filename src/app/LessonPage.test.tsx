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
    realBuild: { parts: ['Red LED', '220 Ω resistor'], steps: ['Push the LED in.'], safety: ['Never skip the resistor.'] },
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
vi.mock('../viz/BreadboardView', () => ({ BreadboardView: () => null }))
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
})
