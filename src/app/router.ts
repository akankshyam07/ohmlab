import { useMemo, useSyncExternalStore } from 'react'
import { withViewTransition, type NavKind } from './transitions'

export type Route =
  | { name: 'home' }
  | { name: 'lesson'; id: string; step?: string }
  | { name: 'topics' }
  | { name: 'topic'; id: string }
  | { name: 'parts' }
  | { name: 'part'; id: string; anchor?: string }
  | { name: 'achievements' }
  | { name: 'settings' }
  | { name: 'notFound' }

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  const [page, id, step, ...rest] = parts
  if (rest.length) return { name: 'notFound' }
  if (!page) return { name: 'home' }
  if (page === 'lesson' && id) return step ? { name: 'lesson', id, step } : { name: 'lesson', id }
  if (page === 'parts' && id) return step ? { name: 'part', id, anchor: step } : { name: 'part', id }
  if (page === 'topics' && id && !step) return { name: 'topic', id }
  if ((page === 'achievements' || page === 'settings' || page === 'topics' || page === 'parts') && !id)
    return { name: page }
  return { name: 'notFound' }
}

/** href('lesson', 'first-led', 'quiz') → "#/lesson/first-led/quiz"; href() → "#/". */
export function href(...parts: string[]): string {
  return '#/' + parts.map(encodeURIComponent).join('/')
}

/** A step change stays inside one lesson, an anchor change inside one part page; anything else is a page change. */
export function navKind(from: Route, to: Route): NavKind {
  if (from.name === 'lesson' && to.name === 'lesson' && from.id === to.id) return 'step'
  if (from.name === 'part' && to.name === 'part' && from.id === to.id) return 'anchor'
  return 'page'
}

// A page change renders inside a view transition (a fade-through). A lesson step change does not: the lesson animates
// its own step card with CSS, which costs no snapshot frame (a view transition's capture dropped one frame each time).
const routeOf = (url = '') => parseHash(url.includes('#') ? url.slice(url.indexOf('#')) : '')
const subscribe = (onChange: () => void) => {
  const onHashChange = (e: HashChangeEvent) => {
    if (navKind(routeOf(e.oldURL), routeOf(e.newURL)) === 'page') withViewTransition(onChange, 'page')
    else onChange()
  }
  window.addEventListener('hashchange', onHashChange)
  return () => window.removeEventListener('hashchange', onHashChange)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return useMemo(() => parseHash(hash), [hash])
}
