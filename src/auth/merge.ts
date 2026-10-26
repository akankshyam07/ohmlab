import type { LessonProgress, Progress } from '../progress/types'

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])]

/** The earlier of two ISO times. Unparseable times lose to parseable ones; ties pick the smaller string. */
function earliest(a: string | undefined, b: string | undefined): string | undefined {
  if (a === undefined || b === undefined) return a ?? b
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  if (Number.isNaN(ta) !== Number.isNaN(tb)) return Number.isNaN(ta) ? b : a
  if (ta !== tb && !Number.isNaN(ta)) return ta < tb ? a : b
  return a < b ? a : b
}

function mergeLesson(a: LessonProgress | undefined, b: LessonProgress | undefined): LessonProgress {
  const x = a ?? b!
  const y = b ?? a!
  const completedAt = earliest(x.completedAt, y.completedAt)
  return {
    stepsSeen: union(x.stepsSeen, y.stepsSeen),
    challengesDone: union(x.challengesDone, y.challengesDone),
    quizBest: Math.min(1, Math.max(0, x.quizBest, y.quizBest)),
    quizAttempts: Math.max(0, x.quizAttempts, y.quizAttempts),
    ...(completedAt !== undefined && { completedAt }),
  }
}

// Object.fromEntries defines own properties, so a "__proto__" key from untrusted data stays a plain key.
function mergeRecords<T>(a: Record<string, T>, b: Record<string, T>, merge: (x?: T, y?: T) => T): Record<string, T> {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  const own = (r: Record<string, T>, k: string) => (Object.hasOwn(r, k) ? r[k] : undefined)
  return Object.fromEntries([...keys].map((k) => [k, merge(own(a, k), own(b, k))]))
}

/**
 * Two copies of one learner's progress → one that keeps everything either copy has: steps, challenges and active
 * days are unioned, quiz best and attempts take the max, completion and achievement times the earliest. Only
 * `lastLessonId` can't be combined; it comes from `newer` (the copy changed most recently), else the other.
 * Idempotent, and commutative as sets: mergeProgress(a, b, 'a') matches mergeProgress(b, a, 'b').
 */
export function mergeProgress(a: Progress, b: Progress, newer: 'a' | 'b' = 'a'): Progress {
  const [first, second] = newer === 'a' ? [a, b] : [b, a]
  const lastLessonId = first.lastLessonId ?? second.lastLessonId
  return {
    version: 1,
    lessons: mergeRecords(a.lessons, b.lessons, mergeLesson),
    achievements: mergeRecords(a.achievements, b.achievements, (x, y) => earliest(x, y)!),
    activeDays: union(a.activeDays, b.activeDays),
    ...(lastLessonId !== undefined && { lastLessonId }),
  }
}
