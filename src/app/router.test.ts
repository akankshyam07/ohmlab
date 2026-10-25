import { describe, expect, it } from 'vitest'
import { href, parseHash } from './router'

describe('parseHash', () => {
  it.each([
    ['', { name: 'home' }],
    ['#', { name: 'home' }],
    ['#/', { name: 'home' }],
    ['#/lesson/first-led', { name: 'lesson', id: 'first-led' }],
    ['#/lesson/first-led/', { name: 'lesson', id: 'first-led' }],
    ['#/lesson/first-led/quiz', { name: 'lesson', id: 'first-led', step: 'quiz' }],
    ['#/achievements', { name: 'achievements' }],
    ['#/settings', { name: 'settings' }],
    ['#/lesson', { name: 'notFound' }],
    ['#/lesson/a/b/c', { name: 'notFound' }],
    ['#/settings/extra', { name: 'notFound' }],
    ['#/nope', { name: 'notFound' }],
    ['#main', { name: 'notFound' }],
  ])('%s', (hash, route) => {
    expect(parseHash(hash)).toEqual(route)
  })

  it('round-trips href with encoded ids', () => {
    expect(href()).toBe('#/')
    expect(href('lesson', 'a b', 'quiz')).toBe('#/lesson/a%20b/quiz')
    expect(parseHash(href('lesson', 'a b', 'quiz'))).toEqual({ name: 'lesson', id: 'a b', step: 'quiz' })
  })
})
