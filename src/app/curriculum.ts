import type { Lesson } from '../content/types'
import type { LessonProgress, Progress } from '../progress/types'

export type StepId = string

export interface LessonStep {
  id: StepId
  title: string
}

/** Lesson flow: every section, then the quiz, then the real build when there is one. */
export function lessonSteps(lesson: Lesson): LessonStep[] {
  return [
    ...lesson.sections.map((s) => ({ id: s.id, title: s.title })),
    { id: 'quiz', title: 'Quiz' },
    ...(lesson.realBuild ? [{ id: 'build', title: 'Build it for real' }] : []),
  ]
}

export function byDay(lessons: Lesson[]): Lesson[] {
  return [...lessons].sort((a, b) => a.day - b.day)
}

export function nextLesson(lessons: Lesson[], current: Lesson): Lesson | undefined {
  return byDay(lessons).find((l) => l.day > current.day)
}

export type LessonState = 'not-started' | 'in-progress' | 'complete'

export function lessonState(lp: LessonProgress | undefined, complete: boolean): LessonState {
  if (complete) return 'complete'
  if (!lp || (lp.stepsSeen.length === 0 && lp.challengesDone.length === 0 && lp.quizAttempts === 0))
    return 'not-started'
  return 'in-progress'
}

/** The lesson the home page's main call to action points at. */
export function continueTarget(
  lessons: Lesson[],
  progress: Progress,
  isComplete: (lesson: Lesson) => boolean,
): { verb: 'Start' | 'Continue'; lesson: Lesson } | undefined {
  const sorted = byDay(lessons)
  if (sorted.length === 0) return undefined
  const last = sorted.find((l) => l.id === progress.lastLessonId)
  if (!last) return { verb: 'Start', lesson: sorted[0] }
  if (!isComplete(last)) return { verb: 'Continue', lesson: last }
  const next =
    sorted.find((l) => l.day > last.day && !isComplete(l)) ?? sorted.find((l) => !isComplete(l)) ?? last
  return { verb: 'Continue', lesson: next }
}
