import { act, cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { achievements, computeStreak, localDate } from './achievements'
import {
  completeChallengeIn,
  computeIsComplete,
  computeMastery,
  emptyProgress,
  loadProgress,
  markStepIn,
  parseProgress,
  ProgressProvider,
  recordQuizIn,
  saveProgress,
  settle,
  useProgress,
} from './store'
import { STORAGE_KEY, type LessonProgress, type Progress } from './types'

const { lesson } = vi.hoisted(() => {
  const lesson = {
    id: 'day01',
    day: 1,
    phase: 1,
    title: 'Test lesson',
    tagline: '',
    minutes: 10,
    objectives: [],
    sections: [
      { id: 's1', title: 'One', blocks: [] },
      { id: 's2', title: 'Two', blocks: [] },
    ],
    lab: {
      title: 'Lab',
      intro: '',
      circuit: { components: [], ground: 'gnd' },
      layout: { width: 1, height: 1, parts: [], wires: [] },
      controls: [],
      readouts: [],
      challenges: [
        { id: 'c1', prompt: '', hint: '', success: '', check: () => false },
        { id: 'c2', prompt: '', hint: '', success: '', check: () => false },
      ],
    },
    quiz: [],
  }
  return { lesson: lesson as unknown as import('../content/types').Lesson }
})

vi.mock('../content', () => ({
  lessons: [lesson],
  getLesson: (id: string) => (id === lesson.id ? lesson : undefined),
  phases: [],
}))

const lp = (over: Partial<LessonProgress> = {}): LessonProgress => ({
  stepsSeen: [],
  challengesDone: [],
  quizBest: 0,
  quizAttempts: 0,
  ...over,
})

const daysAgo = (n: number, from = new Date()) => {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  d.setDate(d.getDate() - n)
  return localDate(d)
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('storage', () => {
  it('round-trips through localStorage', () => {
    const p: Progress = {
      ...emptyProgress(),
      lessons: { day01: lp({ stepsSeen: ['s1'], quizBest: 0.5, quizAttempts: 1 }) },
      achievements: { 'first-light': '2026-10-25T10:00:00.000Z' },
      lastLessonId: 'day01',
      activeDays: ['2026-10-25'],
    }
    saveProgress(p)
    expect(loadProgress()).toEqual(p)
  })

  it.each([
    ['missing', null],
    ['not JSON', '{oops'],
    ['wrong version', JSON.stringify({ ...emptyProgress(), version: 2 })],
    ['bad lesson shape', JSON.stringify({ ...emptyProgress(), lessons: { day01: { stepsSeen: 'nope' } } })],
    ['bad activeDays', JSON.stringify({ ...emptyProgress(), activeDays: [1, 2] })],
    ['array', '[]'],
  ])('falls back to empty progress when storage is %s', (_, raw) => {
    expect(parseProgress(raw)).toEqual(emptyProgress())
  })

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(loadProgress()).toEqual(emptyProgress())
    expect(() => saveProgress(emptyProgress())).not.toThrow()
  })
})

describe('pure progress logic', () => {
  it('mutations are idempotent', () => {
    const once = markStepIn(emptyProgress(), 'day01', 's1')
    expect(markStepIn(once, 'day01', 's1')).toEqual(once)
    const c = completeChallengeIn(once, 'day01', 'c1')
    expect(completeChallengeIn(c, 'day01', 'c1')).toEqual(c)
    const now = new Date()
    const settled = settle(c, now).progress
    expect(settle(settled, now).progress).toEqual(settled)
  })

  it('recordQuiz keeps the best score and counts attempts', () => {
    let p = recordQuizIn(emptyProgress(), 'day01', 0.6)
    p = recordQuizIn(p, 'day01', 0.4)
    expect(p.lessons.day01).toMatchObject({ quizBest: 0.6, quizAttempts: 2 })
  })

  it('weights mastery 30 % steps, 30 % challenges, 40 % quiz', () => {
    expect(computeMastery(undefined, lesson)).toBe(0)
    // steps: s1, s2, lab, quiz
    expect(computeMastery(lp({ stepsSeen: ['s1', 's2', 'lab', 'quiz'] }), lesson)).toBeCloseTo(0.3)
    expect(computeMastery(lp({ challengesDone: ['c1', 'c2'] }), lesson)).toBeCloseTo(0.3)
    expect(computeMastery(lp({ quizBest: 1 }), lesson)).toBeCloseTo(0.4)
    expect(
      computeMastery(lp({ stepsSeen: ['s1', 'lab', 'unknown'], challengesDone: ['c1'], quizBest: 0.5 }), lesson),
    ).toBeCloseTo(0.15 + 0.15 + 0.2)
  })

  it('isComplete needs quiz ≥ 80 % and every challenge', () => {
    expect(computeIsComplete(lp({ quizBest: 0.8, challengesDone: ['c1', 'c2'] }), lesson)).toBe(true)
    expect(computeIsComplete(lp({ quizBest: 0.79, challengesDone: ['c1', 'c2'] }), lesson)).toBe(false)
    expect(computeIsComplete(lp({ quizBest: 1, challengesDone: ['c1'] }), lesson)).toBe(false)
    expect(computeIsComplete(undefined, lesson)).toBe(false)
  })

  it('counts streaks ending today or yesterday', () => {
    const today = new Date(2026, 10, 1) // 1 Nov, to cross a month boundary
    expect(computeStreak([], today)).toBe(0)
    expect(computeStreak(['2026-11-01'], today)).toBe(1)
    expect(computeStreak(['2026-10-30', '2026-10-31', '2026-11-01'], today)).toBe(3)
    expect(computeStreak(['2026-10-30', '2026-10-31'], today)).toBe(2) // not active yet today
    expect(computeStreak(['2026-10-29', '2026-10-30'], today)).toBe(0) // last active 2 days ago
    expect(computeStreak(['2026-10-29', '2026-10-31', '2026-11-01'], today)).toBe(2) // gap
  })

  it('settle records the active day, completion and achievements', () => {
    const now = new Date(2026, 9, 25, 12)
    let p = completeChallengeIn(emptyProgress(), 'day01', 'c1')
    let r = settle(p, now)
    expect(r.progress.activeDays).toEqual(['2026-10-25'])
    expect(r.unlocked.map((a) => a.id)).toEqual(['first-light'])

    p = recordQuizIn(completeChallengeIn(r.progress, 'day01', 'c2'), 'day01', 1)
    r = settle(p, now)
    expect(r.progress.lessons.day01.completedAt).toBe(now.toISOString())
    expect(r.unlocked.map((a) => a.id).sort()).toEqual(['fundamentals-fluent', 'ohms-apprentice', 'perfect-circuit'])
    expect(settle(r.progress, now).unlocked).toEqual([])
  })

  it('defines at least 7 achievements with unique ids', () => {
    expect(achievements.length).toBeGreaterThanOrEqual(7)
    expect(new Set(achievements.map((a) => a.id)).size).toBe(achievements.length)
  })
})

describe('ProgressProvider', () => {
  const wrapper = ({ children }: { children: ReactNode }) => <ProgressProvider>{children}</ProgressProvider>

  it('persists changes and reloads them', () => {
    const { result, unmount } = renderHook(useProgress, { wrapper })
    act(() => result.current.markStep('day01', 's1'))
    expect(result.current.progress.lastLessonId).toBe('day01')
    expect(result.current.progress.activeDays).toEqual([localDate(new Date())])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).lessons.day01.stepsSeen).toEqual(['s1'])
    unmount()

    const again = renderHook(useProgress, { wrapper })
    expect(again.result.current.progress.lessons.day01.stepsSeen).toEqual(['s1'])
    expect(again.result.current.streak()).toBe(1)
  })

  it('reports newly unlocked achievements until dismissed', () => {
    const { result } = renderHook(useProgress, { wrapper })
    act(() => result.current.completeChallenge('day01', 'c1'))
    expect(result.current.recentlyUnlocked.map((a) => a.id)).toEqual(['first-light'])
    act(() => result.current.completeChallenge('day01', 'c1'))
    expect(result.current.recentlyUnlocked).toHaveLength(1)
    act(() => result.current.dismissUnlocked())
    expect(result.current.recentlyUnlocked).toEqual([])
    expect(result.current.progress.achievements['first-light']).toBeTruthy()
  })

  it('completes a lesson and computes mastery/isComplete', () => {
    const { result } = renderHook(useProgress, { wrapper })
    act(() => {
      result.current.completeChallenge('day01', 'c1')
      result.current.completeChallenge('day01', 'c2')
      result.current.recordQuiz('day01', 0.8)
    })
    expect(result.current.isComplete(lesson)).toBe(true)
    expect(result.current.mastery(lesson)).toBeCloseTo(0.3 + 0.32)
    expect(result.current.progress.lessons.day01.completedAt).toBeTruthy()
    expect(result.current.progress.achievements['ohms-apprentice']).toBeTruthy()
  })

  it('unlock() handles event achievements once', () => {
    const { result } = renderHook(useProgress, { wrapper })
    act(() => result.current.unlock('magic-smoke'))
    act(() => result.current.unlock('magic-smoke'))
    act(() => result.current.unlock('no-such-achievement'))
    expect(result.current.recentlyUnlocked.map((a) => a.id)).toEqual(['magic-smoke'])
    expect(Object.keys(result.current.progress.achievements)).toEqual(['magic-smoke'])
  })

  it('unlocks On a Roll on the third day in a row', () => {
    saveProgress({ ...emptyProgress(), activeDays: [daysAgo(2), daysAgo(1)] })
    const { result } = renderHook(useProgress, { wrapper })
    expect(result.current.streak()).toBe(2)
    act(() => result.current.markStep('day01', 's1'))
    expect(result.current.streak()).toBe(3)
    expect(result.current.recentlyUnlocked.map((a) => a.id)).toContain('on-a-roll')
  })

  it('reset() clears everything', () => {
    const { result } = renderHook(useProgress, { wrapper })
    act(() => result.current.completeChallenge('day01', 'c1'))
    act(() => result.current.reset())
    expect(result.current.progress).toEqual(emptyProgress())
    expect(result.current.recentlyUnlocked).toEqual([])
    expect(loadProgress()).toEqual(emptyProgress())
  })

  it('throws a clear error outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(useProgress)).toThrow(/ProgressProvider/)
  })
})
