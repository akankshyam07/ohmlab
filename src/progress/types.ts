import type { Lesson } from '../content/types'

export interface LessonProgress {
  /** Section ids (plus 'lab', 'quiz', 'build') the learner has opened. */
  stepsSeen: string[]
  challengesDone: string[]
  /** Best quiz score, 0..1. */
  quizBest: number
  quizAttempts: number
  completedAt?: string
}

export interface Progress {
  version: 1
  lessons: Record<string, LessonProgress>
  /** Achievement id → ISO time unlocked. */
  achievements: Record<string, string>
  lastLessonId?: string
  /** Local dates (YYYY-MM-DD) with any learning activity, for streaks. */
  activeDays: string[]
}

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  unlocked: (progress: Progress, lessons: Lesson[]) => boolean
}

/** Returned by useProgress(); provided by <ProgressProvider> in src/progress/store.tsx. */
export interface ProgressApi {
  progress: Progress
  markStep: (lessonId: string, stepId: string) => void
  completeChallenge: (lessonId: string, challengeId: string) => void
  recordQuiz: (lessonId: string, score: number) => void
  /** 0..1: steps seen 30 %, challenges done 30 %, best quiz score 40 %. */
  mastery: (lesson: Lesson) => number
  /** Quiz best ≥ 0.8 and every lab challenge done. */
  isComplete: (lesson: Lesson) => boolean
  streak: () => number
  /** Event-based achievements the store can't infer (e.g. 'magic-smoke' when a part burns out in a lab). No-op if already unlocked. */
  unlock: (achievementId: string) => void
  /** Achievements unlocked since the last call to dismissUnlocked(); the shell shows these as toasts. */
  recentlyUnlocked: Achievement[]
  dismissUnlocked: () => void
  reset: () => void
}

export const STORAGE_KEY = 'ohmlab.progress.v1'
