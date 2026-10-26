import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { getLesson, lessons } from '../content'
import type { Lesson } from '../content/types'
import { achievements, computeStreak, localDate } from './achievements'
import {
  STORAGE_KEY,
  type Achievement,
  type LessonProgress,
  type Progress,
  type ProgressApi,
} from './types'

// ---------- pure logic (unit-tested without React) ----------

export function emptyProgress(): Progress {
  return { version: 1, lessons: {}, achievements: {}, activeDays: [] }
}

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x)
const isStringArray = (x: unknown): x is string[] =>
  Array.isArray(x) && x.every((s) => typeof s === 'string')
const isOptionalString = (x: unknown) => x === undefined || typeof x === 'string'

function isLessonProgress(x: unknown): x is LessonProgress {
  return (
    isRecord(x) &&
    isStringArray(x.stepsSeen) &&
    isStringArray(x.challengesDone) &&
    typeof x.quizBest === 'number' &&
    Number.isFinite(x.quizBest) &&
    typeof x.quizAttempts === 'number' &&
    Number.isFinite(x.quizAttempts) &&
    isOptionalString(x.completedAt)
  )
}

/** Untrusted value (stored or downloaded) → Progress, or null when it isn't valid version-1 progress. */
export function validateProgress(x: unknown): Progress | null {
  return isRecord(x) &&
    x.version === 1 &&
    isRecord(x.lessons) &&
    Object.values(x.lessons).every(isLessonProgress) &&
    isRecord(x.achievements) &&
    Object.values(x.achievements).every((v) => typeof v === 'string') &&
    isStringArray(x.activeDays) &&
    isOptionalString(x.lastLessonId)
    ? (x as unknown as Progress)
    : null
}

/** Stored JSON → Progress. Anything missing, corrupted or from another version gives empty progress. */
export function parseProgress(raw: string | null): Progress {
  if (!raw) return emptyProgress()
  try {
    return validateProgress(JSON.parse(raw)) ?? emptyProgress()
  } catch {
    return emptyProgress() // invalid JSON
  }
}

export function loadProgress(): Progress {
  try {
    return parseProgress(localStorage.getItem(STORAGE_KEY))
  } catch {
    return emptyProgress() // storage blocked (privacy mode, sandboxed iframe)
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // quota or blocked storage: progress lives in memory for this session
  }
}

const addUnique = (list: string[], item: string) => (list.includes(item) ? list : [...list, item])

function lessonEntry(p: Progress, lessonId: string): LessonProgress {
  return p.lessons[lessonId] ?? { stepsSeen: [], challengesDone: [], quizBest: 0, quizAttempts: 0 }
}

function updateLesson(p: Progress, lessonId: string, change: (lp: LessonProgress) => LessonProgress): Progress {
  return { ...p, lastLessonId: lessonId, lessons: { ...p.lessons, [lessonId]: change(lessonEntry(p, lessonId)) } }
}

export const markStepIn = (p: Progress, lessonId: string, stepId: string) =>
  updateLesson(p, lessonId, (lp) => ({ ...lp, stepsSeen: addUnique(lp.stepsSeen, stepId) }))

export const completeChallengeIn = (p: Progress, lessonId: string, challengeId: string) =>
  updateLesson(p, lessonId, (lp) => ({ ...lp, challengesDone: addUnique(lp.challengesDone, challengeId) }))

export const recordQuizIn = (p: Progress, lessonId: string, score: number) =>
  updateLesson(p, lessonId, (lp) => ({
    ...lp,
    quizBest: Math.max(lp.quizBest, Number.isFinite(score) ? Math.min(1, Math.max(0, score)) : 0),
    quizAttempts: lp.quizAttempts + 1,
  }))

/** Step ids a lesson offers: its sections, then 'lab', 'quiz' and 'build' when present. */
function lessonSteps(lesson: Lesson): string[] {
  return [
    ...lesson.sections.map((s) => s.id),
    ...(lesson.lab ? ['lab'] : []),
    'quiz',
    ...(lesson.realBuild ? ['build'] : []),
  ]
}

/** Steps 30 %, challenges 30 %, quiz 40 %. A lesson without challenges is scored on steps and quiz only. */
export function computeMastery(lp: LessonProgress | undefined, lesson: Lesson): number {
  if (!lp) return 0
  const steps = lessonSteps(lesson)
  const challenges = lesson.lab?.challenges ?? []
  const parts: [weight: number, fraction: number][] = [
    [0.3, steps.filter((s) => lp.stepsSeen.includes(s)).length / steps.length],
    [0.4, lp.quizBest],
  ]
  if (challenges.length > 0)
    parts.push([0.3, challenges.filter((c) => lp.challengesDone.includes(c.id)).length / challenges.length])
  const totalWeight = parts.reduce((sum, [w]) => sum + w, 0)
  return parts.reduce((sum, [w, f]) => sum + w * f, 0) / totalWeight
}

export function computeIsComplete(lp: LessonProgress | undefined, lesson: Lesson): boolean {
  if (!lp || lp.quizBest < 0.8) return false
  return (lesson.lab?.challenges ?? []).every((c) => lp.challengesDone.includes(c.id))
}

/**
 * Runs after every learner action: records today as active, stamps completedAt on newly
 * completed lessons, and unlocks any achievements whose condition now holds.
 */
export function settle(
  p: Progress,
  now: Date,
  allLessons: Lesson[] = lessons,
  findLesson: (id: string) => Lesson | undefined = getLesson,
): { progress: Progress; unlocked: Achievement[] } {
  const iso = now.toISOString()
  let next: Progress = { ...p, activeDays: addUnique(p.activeDays, localDate(now)) }

  for (const [id, lp] of Object.entries(next.lessons)) {
    const lesson = findLesson(id)
    if (!lp.completedAt && lesson && computeIsComplete(lp, lesson))
      next = { ...next, lessons: { ...next.lessons, [id]: { ...lp, completedAt: iso } } }
  }

  const unlocked = achievements.filter((a) => !next.achievements[a.id] && a.unlocked(next, allLessons))
  if (unlocked.length > 0)
    next = {
      ...next,
      achievements: { ...next.achievements, ...Object.fromEntries(unlocked.map((a) => [a.id, iso])) },
    }
  return { progress: next, unlocked }
}

// ---------- React binding ----------

const ProgressContext = createContext<ProgressApi | null>(null)

/** For cloud sync (src/auth) only: read the latest progress and swap in a merged copy, outside ProgressApi. */
export interface ProgressSync {
  current: () => Progress
  /** Saves and shows `next` as is: no settle, so no new active day, completion stamps or toasts. */
  replace: (next: Progress) => void
}
const ProgressSyncContext = createContext<ProgressSync | null>(null)

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState(loadProgress)
  const [recentlyUnlocked, setRecentlyUnlocked] = useState<Achievement[]>([])
  // The ref lets several actions in one event see each other's results, and keeps action identities stable.
  const current = useRef(progress)

  const commit = useCallback((next: Progress, unlocked: Achievement[]) => {
    if (JSON.stringify(next) === JSON.stringify(current.current)) return // idempotent: no re-render, no write
    current.current = next
    setProgress(next)
    saveProgress(next)
    if (unlocked.length > 0) setRecentlyUnlocked((r) => [...r, ...unlocked])
  }, [])

  const actions = useMemo(() => {
    // One learner action = one settle and one commit, so every achievement it earns lands in a single update.
    const act = (change: (p: Progress) => Progress, alsoUnlocked: Achievement[] = []) => {
      const { progress: next, unlocked } = settle(change(current.current), new Date())
      commit(next, [...alsoUnlocked, ...unlocked])
    }
    return {
      markStep: (lessonId: string, stepId: string) => act((p) => markStepIn(p, lessonId, stepId)),
      completeChallenge: (lessonId: string, challengeId: string) =>
        act((p) => completeChallengeIn(p, lessonId, challengeId)),
      recordQuiz: (lessonId: string, score: number) => act((p) => recordQuizIn(p, lessonId, score)),
      unlock: (achievementId: string) => {
        const achievement = achievements.find((a) => a.id === achievementId)
        if (!achievement || current.current.achievements[achievementId]) return
        act((p) => ({ ...p, achievements: { ...p.achievements, [achievementId]: new Date().toISOString() } }), [
          achievement,
        ])
      },
      dismissUnlocked: () => setRecentlyUnlocked([]),
      reset: () => {
        const empty = emptyProgress()
        current.current = empty
        setProgress(empty)
        saveProgress(empty)
        setRecentlyUnlocked([])
      },
    }
  }, [commit])

  const api = useMemo<ProgressApi>(
    () => ({
      ...actions,
      progress,
      recentlyUnlocked,
      mastery: (lesson) => computeMastery(progress.lessons[lesson.id], lesson),
      isComplete: (lesson) => computeIsComplete(progress.lessons[lesson.id], lesson),
      streak: () => computeStreak(progress.activeDays, new Date()),
    }),
    [actions, progress, recentlyUnlocked],
  )

  const sync = useMemo<ProgressSync>(
    () => ({ current: () => current.current, replace: (next) => commit(next, []) }),
    [commit],
  )

  return (
    <ProgressContext.Provider value={api}>
      <ProgressSyncContext.Provider value={sync}>{children}</ProgressSyncContext.Provider>
    </ProgressContext.Provider>
  )
}

export function useProgressSync(): ProgressSync {
  const sync = useContext(ProgressSyncContext)
  if (!sync) throw new Error('useProgressSync() must be used inside <ProgressProvider>')
  return sync
}

export function useProgress(): ProgressApi {
  const api = useContext(ProgressContext)
  if (!api) throw new Error('useProgress() must be used inside <ProgressProvider>')
  return api
}
