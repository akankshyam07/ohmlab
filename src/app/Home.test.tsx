import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Lesson, Phase } from '../content/types'
import type { Progress } from '../progress/types'
import { Home } from './Home'
import { SettingsProvider } from './settings'

const state = vi.hoisted(() => ({
  progress: {
    version: 1,
    lessons: { 'ohms-law': { stepsSeen: ['intro'], challengesDone: [], quizBest: 0, quizAttempts: 0 } },
    achievements: {},
    activeDays: [],
  } as Progress,
}))

vi.mock('../content', () => {
  const lesson = (id: string, day: number, title: string) =>
    ({ id, day, phase: 1, title, tagline: '', minutes: 10, objectives: [], sections: [], quiz: [] }) as Lesson
  const lessons = [lesson('first-led', 1, 'First LED'), lesson('ohms-law', 2, 'Ohm’s law')]
  const phases: Phase[] = [
    {
      n: 1,
      title: 'Electricity',
      summary: 'Basics',
      days: [
        { day: 1, title: 'First LED', lessonId: 'first-led' },
        { day: 2, title: 'Ohm’s law', lessonId: 'ohms-law' },
        { day: 3, title: 'Multimeter' },
        { day: 4, title: 'Ghost lesson', lessonId: 'not-written-yet' },
      ],
    },
    { n: 2, title: 'Arduino', summary: 'Code', days: [{ day: 5, title: 'Blink' }] },
  ]
  return { lessons, phases, getLesson: (id: string) => lessons.find((l) => l.id === id) }
})

vi.mock('../progress/store', () => ({
  useProgress: () => ({
    progress: state.progress,
    mastery: (l: Lesson) => (l.id === 'ohms-law' ? 0.4 : 0),
    isComplete: () => false,
    streak: () => 2,
  }),
}))

vi.mock('../progress/achievements', () => ({
  achievements: [{ id: 'first-light', title: 'First light', description: 'Light an LED', icon: '💡' }],
}))

vi.mock('../sim/solver', () => ({
  solveDC: () => ({
    ok: true,
    nodeVoltages: {},
    components: {
      D1: { current: 0.0136, voltage: 2, power: 0.027, status: 'ok', brightness: 0.6 },
      R1: { current: 0.0136, voltage: 3, power: 0.041, status: 'ok' },
    },
  }),
}))

const renderHome = () =>
  render(
    <SettingsProvider>
      <Home />
    </SettingsProvider>,
  )

describe('Home', () => {
  it('has the Ohmlab heading and a start link for Day 1', () => {
    renderHome()
    expect(screen.getByRole('heading', { name: 'Ohmlab' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start: Day 1 — First LED' })).toHaveAttribute(
      'href',
      '#/lesson/first-led',
    )
  })

  it('says Continue for the last lesson the learner opened', () => {
    state.progress = { ...state.progress, lastLessonId: 'ohms-law' }
    renderHome()
    expect(screen.getByRole('link', { name: 'Continue: Day 2 — Ohm’s law' })).toBeInTheDocument()
    state.progress = { ...state.progress, lastLessonId: undefined }
  })

  it('links only days that have a lesson; the rest say Coming soon', () => {
    renderHome()
    const map = screen.getByRole('region', { name: 'The 100-day map' })
    const links = within(map).getAllByRole('link')
    expect(links.map((a) => a.getAttribute('aria-label'))).toEqual(['Day 1: First LED', 'Day 2: Ohm’s law'])
    expect(within(map).getByRole('link', { name: 'Day 2: Ohm’s law' })).toHaveAccessibleDescription(
      'In progress · 40%',
    )
    for (const title of ['Multimeter', 'Ghost lesson', 'Blink']) {
      const item = within(map).getByText(title).closest('li')!
      expect(within(item).queryByRole('link')).toBeNull()
      expect(item).toHaveTextContent('Coming soon')
    }
  })

  it('shows stats from the progress store', () => {
    renderHome()
    const stats = screen.getByRole('region', { name: 'Your progress' })
    expect(stats).toHaveTextContent('Lessons completed0/ 2')
    expect(stats).toHaveTextContent('Average mastery20%')
    expect(stats).toHaveTextContent('Streak2days')
  })
})
