import { describe, expect, it } from 'vitest'
import { emptyProgress, validateProgress } from '../progress/store'
import type { LessonProgress, Progress } from '../progress/types'
import { mergeProgress } from './merge'

const lesson = (over: Partial<LessonProgress> = {}): LessonProgress => ({
  stepsSeen: [],
  challengesDone: [],
  quizBest: 0,
  quizAttempts: 0,
  ...over,
})

const progress = (over: Partial<Progress> = {}): Progress => ({ ...emptyProgress(), ...over })

/** Order-insensitive view, for "commutative as sets". */
function normalized(p: Progress) {
  const sort = (xs: string[]) => [...xs].sort()
  return {
    ...p,
    activeDays: sort(p.activeDays),
    lessons: Object.fromEntries(
      Object.entries(p.lessons)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, lp]) => [id, { ...lp, stepsSeen: sort(lp.stepsSeen), challengesDone: sort(lp.challengesDone) }]),
    ),
    achievements: Object.fromEntries(Object.entries(p.achievements).sort(([a], [b]) => a.localeCompare(b))),
  }
}

// Small deterministic PRNG so the property checks are reproducible.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 32
  }
}

function randomProgress(rand: () => number): Progress {
  const pick = <T,>(xs: T[]) => xs.filter(() => rand() < 0.5)
  const time = () => new Date(Date.UTC(2026, 9, 1 + Math.floor(rand() * 20), Math.floor(rand() * 24))).toISOString()
  const lessons: Record<string, LessonProgress> = {}
  for (const id of pick(['day1', 'day2', 'day5', 'day6'])) {
    lessons[id] = lesson({
      stepsSeen: pick(['intro', 'law', 'lab', 'quiz', 'build']),
      challengesDone: pick(['c1', 'c2', 'c3']),
      quizBest: Math.round(rand() * 10) / 10,
      quizAttempts: Math.floor(rand() * 5),
      ...(rand() < 0.5 && { completedAt: time() }),
    })
  }
  const achievements = Object.fromEntries(pick(['first-light', 'magic-smoke', 'on-a-roll']).map((id) => [id, time()]))
  const activeDays = pick(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
  const last = pick(Object.keys(lessons))[0]
  return progress({ lessons, achievements, activeDays, ...(last && { lastLessonId: last }) })
}

/** Everything in `part` is still in `whole`: no step, challenge, day, achievement or score is lost. */
function keepsAll(whole: Progress, part: Progress) {
  for (const [id, lp] of Object.entries(part.lessons)) {
    const w = whole.lessons[id]
    expect(w).toBeDefined()
    expect(w.stepsSeen).toEqual(expect.arrayContaining(lp.stepsSeen))
    expect(w.challengesDone).toEqual(expect.arrayContaining(lp.challengesDone))
    expect(w.quizBest).toBeGreaterThanOrEqual(lp.quizBest)
    expect(w.quizAttempts).toBeGreaterThanOrEqual(lp.quizAttempts)
    if (lp.completedAt) expect(Date.parse(w.completedAt!)).toBeLessThanOrEqual(Date.parse(lp.completedAt))
  }
  for (const [id, at] of Object.entries(part.achievements))
    expect(Date.parse(whole.achievements[id])).toBeLessThanOrEqual(Date.parse(at))
  expect(whole.activeDays).toEqual(expect.arrayContaining(part.activeDays))
}

describe('mergeProgress', () => {
  it('unions steps, challenges and active days; keeps the best quiz and most attempts', () => {
    const local = progress({
      lessons: { day1: lesson({ stepsSeen: ['intro', 'lab'], challengesDone: ['c1'], quizBest: 0.6, quizAttempts: 3 }) },
      activeDays: ['2026-10-01', '2026-10-02'],
    })
    const cloud = progress({
      lessons: {
        day1: lesson({ stepsSeen: ['lab', 'quiz'], challengesDone: ['c2'], quizBest: 0.9, quizAttempts: 1 }),
        day2: lesson({ stepsSeen: ['intro'] }),
      },
      activeDays: ['2026-10-02', '2026-10-05'],
    })
    const merged = mergeProgress(local, cloud)
    expect(merged.lessons.day1).toEqual(
      lesson({ stepsSeen: ['intro', 'lab', 'quiz'], challengesDone: ['c1', 'c2'], quizBest: 0.9, quizAttempts: 3 }),
    )
    expect(merged.lessons.day2).toEqual(lesson({ stepsSeen: ['intro'] }))
    expect(merged.activeDays).toEqual(['2026-10-01', '2026-10-02', '2026-10-05'])
    expect(validateProgress(merged)).not.toBeNull()
  })

  it('keeps the earliest completion and achievement times', () => {
    const a = progress({
      lessons: { day1: lesson({ completedAt: '2026-10-03T10:00:00.000Z' }) },
      achievements: { 'first-light': '2026-10-02T09:00:00.000Z', 'magic-smoke': '2026-10-04T00:00:00.000Z' },
    })
    const b = progress({
      lessons: { day1: lesson({ completedAt: '2026-10-01T10:00:00.000Z' }), day2: lesson() },
      achievements: { 'first-light': '2026-10-05T09:00:00.000Z', 'on-a-roll': '2026-10-06T00:00:00.000Z' },
    })
    const merged = mergeProgress(a, b)
    expect(merged.lessons.day1.completedAt).toBe('2026-10-01T10:00:00.000Z')
    expect(merged.lessons.day2).not.toHaveProperty('completedAt')
    expect(merged.achievements).toEqual({
      'first-light': '2026-10-02T09:00:00.000Z',
      'magic-smoke': '2026-10-04T00:00:00.000Z',
      'on-a-roll': '2026-10-06T00:00:00.000Z',
    })
  })

  it('takes lastLessonId from the newer copy, falling back to the other', () => {
    const a = progress({ lastLessonId: 'day1' })
    const b = progress({ lastLessonId: 'day5' })
    expect(mergeProgress(a, b, 'a').lastLessonId).toBe('day1')
    expect(mergeProgress(a, b, 'b').lastLessonId).toBe('day5')
    expect(mergeProgress(progress(), b, 'a').lastLessonId).toBe('day5')
    expect(mergeProgress(progress(), progress())).not.toHaveProperty('lastLessonId')
  })

  it('merging with empty progress changes nothing', () => {
    const p = randomProgress(rng(7))
    expect(mergeProgress(p, emptyProgress())).toEqual(p)
    expect(mergeProgress(emptyProgress(), p, 'b')).toEqual(p)
  })

  it('a valid but odd time never beats a real one, and unparseable times stay deterministic', () => {
    const a = progress({ achievements: { x: 'not a date' } })
    const b = progress({ achievements: { x: '2026-10-02T00:00:00.000Z' } })
    expect(mergeProgress(a, b).achievements.x).toBe('2026-10-02T00:00:00.000Z')
    expect(mergeProgress(b, a).achievements.x).toBe('2026-10-02T00:00:00.000Z')
    const c = progress({ achievements: { x: 'zzz' } })
    expect(mergeProgress(a, c).achievements.x).toBe(mergeProgress(c, a).achievements.x)
  })

  it('clamps out-of-range numbers from an untrusted copy', () => {
    const merged = mergeProgress(
      progress({ lessons: { day1: lesson({ quizBest: 7, quizAttempts: -3 }) } }),
      progress({ lessons: { day1: lesson({ quizBest: 0.5, quizAttempts: -1 }) } }),
    )
    expect(merged.lessons.day1.quizBest).toBe(1)
    expect(merged.lessons.day1.quizAttempts).toBe(0)
  })

  it('treats a "__proto__" lesson id as plain data', () => {
    const evil = validateProgress(
      JSON.parse('{"version":1,"lessons":{"__proto__":{"stepsSeen":["x"],"challengesDone":[],"quizBest":0,"quizAttempts":0}},"achievements":{},"activeDays":[]}'),
    )!
    const merged = mergeProgress(progress(), evil)
    expect(Object.getPrototypeOf(merged.lessons)).toBe(Object.prototype)
    expect(Object.hasOwn(merged.lessons, '__proto__')).toBe(true)
    expect(({} as Record<string, unknown>).stepsSeen).toBeUndefined()
  })

  describe('properties over 300 random pairs', () => {
    const rand = rng(42)
    const pairs = Array.from({ length: 300 }, () => [randomProgress(rand), randomProgress(rand)] as const)

    it('never loses progress from either side', () => {
      for (const [a, b] of pairs) {
        const merged = mergeProgress(a, b)
        keepsAll(merged, a)
        keepsAll(merged, b)
      }
    })

    it('is idempotent: merging again, or with itself, changes nothing', () => {
      for (const [a, b] of pairs) {
        const merged = mergeProgress(a, b)
        expect(mergeProgress(merged, b)).toEqual(merged)
        expect(mergeProgress(merged, a)).toEqual(merged)
        expect(mergeProgress(merged, merged)).toEqual(merged)
        expect(mergeProgress(a, a)).toEqual(a)
      }
    })

    it('is commutative as sets when the same copy counts as newer', () => {
      for (const [a, b] of pairs) {
        expect(normalized(mergeProgress(a, b, 'a'))).toEqual(normalized(mergeProgress(b, a, 'b')))
        expect(normalized(mergeProgress(a, b, 'b'))).toEqual(normalized(mergeProgress(b, a, 'a')))
      }
    })

    it('is associative as sets, so three devices converge in any order', () => {
      for (let i = 0; i + 2 < pairs.length; i += 3) {
        const [a, b, c] = [pairs[i][0], pairs[i + 1][0], pairs[i + 2][0]]
        const left = mergeProgress(mergeProgress(a, b), c)
        const right = mergeProgress(a, mergeProgress(b, c))
        expect(normalized({ ...left, lastLessonId: undefined })).toEqual(normalized({ ...right, lastLessonId: undefined }))
      }
    })

    it('always produces progress the store accepts', () => {
      for (const [a, b] of pairs) expect(validateProgress(JSON.parse(JSON.stringify(mergeProgress(a, b))))).not.toBeNull()
    })
  })
})
