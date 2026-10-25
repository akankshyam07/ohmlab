import type { Lesson } from './types'
import { phases } from './curriculum'
import day01 from './lessons/day01'
import day02 from './lessons/day02'
import day05 from './lessons/day05'
import day06 from './lessons/day06'
import day07 from './lessons/day07'
import day08 from './lessons/day08'

export const lessons: Lesson[] = [day01, day02, day05, day06, day07, day08].sort((a, b) => a.day - b.day)

export function getLesson(id: string): Lesson | undefined {
  return lessons.find((l) => l.id === id)
}

export { phases }
