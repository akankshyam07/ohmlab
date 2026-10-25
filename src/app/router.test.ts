import { describe, expect, it } from 'vitest'
import { href, navKind, parseHash } from './router'

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

describe('navKind', () => {
  it('is a step change only within one lesson', () => {
    expect(navKind({ name: 'lesson', id: 'a' }, { name: 'lesson', id: 'a', step: 'quiz' })).toBe('step')
    expect(navKind({ name: 'lesson', id: 'a' }, { name: 'lesson', id: 'b' })).toBe('page')
    expect(navKind({ name: 'home' }, { name: 'lesson', id: 'a' })).toBe('page')
  })
})
