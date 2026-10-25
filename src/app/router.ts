import { useMemo, useSyncExternalStore } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'lesson'; id: string; step?: string }
  | { name: 'achievements' }
  | { name: 'settings' }
  | { name: 'notFound' }

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  const [page, id, step, ...rest] = parts
  if (rest.length) return { name: 'notFound' }
  if (!page) return { name: 'home' }
  if (page === 'lesson' && id) return step ? { name: 'lesson', id, step } : { name: 'lesson', id }
  if ((page === 'achievements' || page === 'settings') && !id) return { name: page }
  return { name: 'notFound' }
}

/** href('lesson', 'first-led', 'quiz') → "#/lesson/first-led/quiz"; href() → "#/". */
export function href(...parts: string[]): string {
  return '#/' + parts.map(encodeURIComponent).join('/')
}

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return useMemo(() => parseHash(hash), [hash])
}
