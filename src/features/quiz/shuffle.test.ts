import { describe, expect, it } from 'vitest'
import { lessons } from '../../content'
import { optionOrder, shuffledOrder } from './shuffle'

const choiceQuestions = lessons.flatMap((lesson) =>
  lesson.quiz.flatMap((q) => (q.type === 'choice' ? [{ lessonId: lesson.id, q }] : [])),
)

describe('shuffledOrder', () => {
  it('is a deterministic permutation', () => {
    const order = shuffledOrder('day01|q1|0', 5)
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4])
    expect(shuffledOrder('day01|q1|0', 5)).toEqual(order)
    expect(shuffledOrder('x', 0)).toEqual([])
    expect(shuffledOrder('x', 1)).toEqual([0])
  })
})

describe('quiz option order over the real lessons', () => {
  it('has choice questions to check', () => {
    expect(choiceQuestions.length).toBeGreaterThan(10)
  })

  it.each([0, 1, 2])('spreads correct answers across positions (attempt %i)', (attempt) => {
    const positions = choiceQuestions.map(({ lessonId, q }) => {
      const order = optionOrder(lessonId, q.id, attempt, q.options.length)
      return order.findIndex((i) => q.options[i].correct)
    })
    const counts = new Map<number, number>()
    for (const p of positions) counts.set(p, (counts.get(p) ?? 0) + 1)
    expect(counts.size).toBeGreaterThanOrEqual(3)
    for (const n of counts.values()) expect(n).toBeLessThanOrEqual(choiceQuestions.length / 2)
  })

  it('reshuffles each question across retries', () => {
    for (const { lessonId, q } of choiceQuestions) {
      const orders = new Set([0, 1, 2, 3, 4, 5].map((a) => optionOrder(lessonId, q.id, a, q.options.length).join()))
      expect(orders.size, `${lessonId}/${q.id}`).toBeGreaterThan(1)
    }
  })
})
