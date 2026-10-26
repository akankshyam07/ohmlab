// Camera behaviour shared by IsoBench and PartViewer: preset morphs, and pan / zoom on one transformed group.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { type Affine, type Pt, type Zoom, invertAffine, zoomAt } from './geom'

export const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
const MORPH_MS = 540
const CAMERA_MS = 460

export const zoomCss = (z: Zoom) => `matrix(${z.s}, 0, 0, ${z.s}, ${z.tx}, ${z.ty})`
const affineCss = (m: Affine) => `matrix(${m.map((v) => +v.toFixed(5)).join(', ')})`
export const sameZoom = (a: Zoom, b: Zoom) => Math.abs(a.s - b.s) < 1e-4 && Math.abs(a.tx - b.tx) < 0.5 && Math.abs(a.ty - b.ty) < 0.5

export function useReducedMotion() {
  const query = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  const [reduced, setReduced] = useState(() => query?.matches ?? false)
  useEffect(() => {
    if (!query) return
    const on = () => setReduced(query.matches)
    query.addEventListener('change', on)
    return () => query.removeEventListener('change', on)
  }, [query])
  return reduced
}

export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const set = (w: number, h: number) => setSize((s) => (s.w === Math.round(w) && s.h === Math.round(h) ? s : { w: Math.round(w), h: Math.round(h) }))
    set(el.clientWidth, el.clientHeight)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => set(e.contentRect.width, e.contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

/**
 * Camera presets: when `view` changes, the old drawing and the new one cross-fade while one transform per
 * drawing maps the old ground plane onto the new (`planeMap(from, to)`, precomputed). Only the first
 * 160 ms show both; then the old one is dropped, so the rest of the tween moves a single layer.
 */
export function useViewMorph<V extends string>(view: V, animate: boolean, planeMap: (from: V, to: V) => Affine) {
  const [shown, setShown] = useState<V>(view)
  const [leaving, setLeaving] = useState<{ view: V; to: string; from: string } | null>(null)
  useEffect(() => {
    if (view === shown) return
    if (!animate) {
      setShown(view)
      setLeaving(null)
      return
    }
    const a = planeMap(shown, view)
    setLeaving({ view: shown, to: affineCss(a), from: affineCss(invertAffine(a)) })
    setShown(view)
  }, [view, shown, animate, planeMap])

  const leaveRef = useRef<HTMLDivElement>(null)
  const enterRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!leaving) return
    const timing = { duration: MORPH_MS, easing: EASE }
    const fade = { duration: 160, easing: 'linear' }
    const leave = leaveRef.current
    const anims = [
      leave?.animate([{ transform: 'matrix(1, 0, 0, 1, 0, 0)' }, { transform: leaving.to }], { ...timing, fill: 'forwards' }),
      enterRef.current?.animate([{ transform: leaving.from }, { transform: 'matrix(1, 0, 0, 1, 0, 0)' }], timing),
      enterRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], fade),
    ].filter((a): a is Animation => !!a)
    const drop = window.setTimeout(() => leave && (leave.style.display = 'none'), fade.duration + 10)
    let done = false
    Promise.all(anims.map((a) => a.finished)).then(
      () => !done && setLeaving(null),
      () => {},
    )
    return () => {
      done = true
      clearTimeout(drop)
      anims.forEach((a) => a.cancel())
    }
  }, [leaving])
  return { shown, leaving, leaveRef, enterRef }
}

interface PanZoomOptions {
  stageRef: RefObject<HTMLElement | null>
  /** Where the camera should be when the user hasn't moved it. */
  target: Zoom
  /** Clamp a zoom the user asks for (scale limits, keep the content in view). */
  limit: (z: Zoom) => Zoom
  size: { w: number; h: number }
  /** Tween changes of `target` (off under reduced motion, before an intro…). */
  animate: boolean
  /** Changing any of these drops the user's own pan / zoom. */
  resetKeys: unknown[]
  /** 'modifier': only ctrl/⌘ + wheel (and trackpad pinch) zooms, plain wheel scrolls the page. 'always': wheel zooms, except zooming out past the fit. */
  wheel: 'modifier' | 'always'
}

/**
 * Pan and zoom by one transform on one group (`camRef`): drag to pan, pinch or wheel to zoom, and tweens
 * (Web Animations on transform, so the compositor runs them) whenever the target changes.
 */
export function usePanZoom({ stageRef, target, limit, size, animate, resetKeys, wheel }: PanZoomOptions) {
  const [userZoom, setUserZoom] = useState<Zoom | null>(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setUserZoom(null), [...resetKeys, size.w, size.h])
  const zoom = userZoom ?? target

  const camRef = useRef<HTMLDivElement>(null)
  const shownZoom = useRef<Zoom | null>(null)
  const lastSize = useRef(size)
  const noTween = useRef(false)
  const [moving, setMoving] = useState(false)
  useLayoutEffect(() => {
    const el = camRef.current
    if (!el || !size.w) return
    const prev = shownZoom.current
    shownZoom.current = zoom
    el.style.transform = zoomCss(zoom)
    const resized = lastSize.current !== size
    lastSize.current = size
    const skip = noTween.current
    noTween.current = false
    if (!prev || resized || skip || !animate || sameZoom(prev, zoom)) return
    // Start from wherever a running tween has got to.
    const from = el.getAnimations().length ? getComputedStyle(el).transform : zoomCss(prev)
    el.getAnimations().forEach((a) => a.cancel())
    const a = el.animate([{ transform: from }, { transform: zoomCss(zoom) }], { duration: CAMERA_MS, easing: EASE })
    setMoving(true)
    a.finished.then(
      () => setMoving(false),
      () => {},
    )
  }, [zoom, size, animate])

  const pointers = useRef(new Map<number, Pt>())
  const gesture = useRef<{ start: Zoom; pts: Pt[]; dragged: boolean; now: Zoom } | null>(null)
  const suppressClick = useRef(false)
  const local = (e: { clientX: number; clientY: number }): Pt => {
    const r = stageRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const writeZoom = (z: Zoom) => {
    const el = camRef.current
    if (!el) return
    el.getAnimations().forEach((a) => a.cancel())
    el.style.transform = zoomCss(z)
  }
  const beginGesture = () => {
    const now = gesture.current?.now ?? shownZoom.current ?? zoom
    gesture.current = { start: now, pts: [...pointers.current.values()], dragged: gesture.current?.dragged ?? false, now }
  }
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    pointers.current.set(e.pointerId, local(e))
    if (pointers.current.size === 1) gesture.current = null
    beginGesture()
    suppressClick.current = false
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return
    pointers.current.set(e.pointerId, local(e))
    const g = gesture.current
    const pts = [...pointers.current.values()]
    let next: Zoom
    if (pts.length === 1 && g.pts.length === 1) {
      const dx = pts[0].x - g.pts[0].x
      const dy = pts[0].y - g.pts[0].y
      if (!g.dragged && Math.hypot(dx, dy) < 5) return
      next = { ...g.start, tx: g.start.tx + dx, ty: g.start.ty + dy }
    } else if (pts.length >= 2 && g.pts.length >= 2) {
      const d0 = Math.hypot(g.pts[1].x - g.pts[0].x, g.pts[1].y - g.pts[0].y) || 1
      const d1 = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
      const m0 = { x: (g.pts[0].x + g.pts[1].x) / 2, y: (g.pts[0].y + g.pts[1].y) / 2 }
      const m1 = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
      const z = zoomAt(g.start, d1 / d0, m0.x, m0.y)
      next = { ...z, tx: z.tx + m1.x - m0.x, ty: z.ty + m1.y - m0.y }
    } else return
    if (!g.dragged) {
      g.dragged = true
      stageRef.current?.setPointerCapture?.(e.pointerId)
      setMoving(true)
    }
    g.now = limit(next)
    writeZoom(g.now)
  }
  const onPointerEnd = (e: ReactPointerEvent) => {
    if (!pointers.current.delete(e.pointerId)) return
    const g = gesture.current
    if (pointers.current.size > 0) {
      beginGesture()
      return
    }
    gesture.current = null
    if (g?.dragged) {
      suppressClick.current = true
      noTween.current = true
      setUserZoom(g.now)
      setMoving(false)
    }
  }
  const onClickCapture = (e: { stopPropagation(): void }) => {
    if (suppressClick.current) {
      e.stopPropagation()
      suppressClick.current = false
    }
  }

  // Wheel zoom about the pointer, committed once the wheel rests.
  const commit = useRef(0)
  const wheelTo = useCallback((next: Zoom) => {
    gesture.current = { start: next, pts: [], dragged: true, now: next }
    shownZoom.current = next
    const el = camRef.current
    if (el) {
      el.getAnimations().forEach((a) => a.cancel())
      el.style.transform = zoomCss(next)
    }
    setMoving(true)
    clearTimeout(commit.current)
    commit.current = window.setTimeout(() => {
      gesture.current = null
      noTween.current = true
      setUserZoom(next)
      setMoving(false)
    }, 160)
  }, [])
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (wheel === 'modifier' && !e.ctrlKey && !e.metaKey) return
      const cur = gesture.current?.now ?? shownZoom.current
      if (!cur) return
      const r = el.getBoundingClientRect()
      const next = limit(zoomAt(cur, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025)), e.clientX - r.left, e.clientY - r.top))
      // At the fit, zooming further out hands the wheel back to the page.
      if (wheel === 'always' && sameZoom(next, cur) && e.deltaY > 0) return
      e.preventDefault()
      wheelTo(next)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      clearTimeout(commit.current)
    }
  }, [stageRef, limit, wheel, wheelTo])

  /** Zoom by a factor about the stage centre (the + / − buttons), tweened. */
  const zoomBy = (factor: number) => {
    const cur = shownZoom.current ?? zoom
    setUserZoom(limit(zoomAt(cur, factor, size.w / 2, size.h / 2)))
  }

  return {
    camRef,
    zoom,
    userZoom,
    setUserZoom,
    moving,
    zoomBy,
    suppressClick,
    handlers: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onClickCapture },
    /** The zoom on screen right now (mid-gesture included). */
    current: () => shownZoom.current ?? zoom,
  }
}
