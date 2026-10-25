import type { Achievement, Progress } from './types'

/** Local calendar date as YYYY-MM-DD (not UTC, so late-evening study counts for today). */
export function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Consecutive active days ending today, or ending yesterday if there's no activity yet today. */
export function computeStreak(activeDays: string[], today: Date): number {
  const days = new Set(activeDays)
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (!days.has(localDate(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(localDate(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

const lessonsTouched = (p: Progress) => Object.values(p.lessons)

export const achievements: Achievement[] = [
  {
    id: 'first-light',
    title: 'First Light',
    description: 'Solve your first lab challenge.',
    icon: '💡',
    unlocked: (p) => lessonsTouched(p).some((l) => l.challengesDone.length > 0),
  },
  {
    id: 'ohms-apprentice',
    title: "Ohm's Apprentice",
    description: 'Complete your first lesson.',
    icon: 'Ω',
    unlocked: (p) => lessonsTouched(p).some((l) => l.completedAt !== undefined),
  },
  {
    id: 'perfect-circuit',
    title: 'Perfect Circuit',
    description: 'Score 100 % on a quiz.',
    icon: '🎯',
    unlocked: (p) => lessonsTouched(p).some((l) => l.quizBest >= 1),
  },
  {
    id: 'magic-smoke',
    title: 'Magic Smoke',
    description: 'Burn out a part in the lab. Better a virtual one than the one in your kit!',
    icon: '💨',
    unlocked: () => false, // event-based: unlock('magic-smoke')
  },
  {
    id: 'short-circuit',
    title: 'Short Story',
    description: 'Cause a short circuit in the lab, and live to tell the tale.',
    icon: '⚡',
    unlocked: () => false, // event-based: unlock('short-circuit')
  },
  {
    id: 'on-a-roll',
    title: 'On a Roll',
    description: 'Learn something three days in a row.',
    icon: '🔥',
    unlocked: (p) => computeStreak(p.activeDays, new Date()) >= 3,
  },
  {
    id: 'fundamentals-fluent',
    title: 'Fundamentals Fluent',
    description: 'Complete every lesson available so far.',
    icon: '🎓',
    unlocked: (p, lessons) =>
      lessons.length > 0 && lessons.every((l) => p.lessons[l.id]?.completedAt !== undefined),
  },
]
