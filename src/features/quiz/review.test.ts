import { describe, expect, it } from 'vitest'
import { getLesson, lessons } from '../../content'
import { teachingSection } from './review'

const sectionFor = (lessonId: string, questionId: string) => {
  const lesson = getLesson(lessonId)!
  return teachingSection(lesson, lesson.quiz.find((q) => q.id === questionId)!)?.id
}

describe('teachingSection on the real lessons', () => {
  it('sends "move the resistor to the other side" to the closed-loop section, not the LED one', () => {
    expect(sectionFor('first-led', 'resistor-side')).toBe('closed-loop')
  })

  it('maps the other Day 1 questions to the section that teaches them', () => {
    expect(sectionFor('first-led', 'v-vs-i')).toBe('three-numbers')
    expect(sectionFor('first-led', 'backwards')).toBe('why-resistor')
    expect(sectionFor('first-led', 'why-resistor')).toBe('why-resistor')
  })

  it('finds a section for every question in every lesson', () => {
    for (const lesson of lessons)
      for (const q of lesson.quiz) expect(teachingSection(lesson, q), `${lesson.id}/${q.id}`).toBeDefined()
  })
})
