import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { Circuit, ComponentResult, SolveResult } from '../../sim/types'
import { formatSI } from '../../ui/format'
import { holeLabel, parseHole } from '../BreadboardView'
import { FLOW_THRESHOLD, flowSpeed, partLabel } from '../describe'
import { placeLabels, type Box } from '../place'
import type { BreadboardLayout, BreadboardPart, Hole } from '../types'
import { Defs, benchPoints, drawBattery, drawBench, drawBoard, drawPart, drawUno, type DrawnPart, type PartState, type UnoDrawing } from './draw'
import {
  type Affine,
  type Camera,
  type IsoViewName,
  type Pt,
  type Rect,
  type Zoom,
  VIEWS,
  clampZoom,
  convexHull,
  depthSort,
  f,
  fitCamera,
  frameRect,
  groundMatrix,
  hullBands,
  invertAffine,
  multiplyAffine,
  pointAt,
  poly,
  project,
  unitScale,
  zoomAt,
} from './geom'
import { BATTERY, BOARD, UNO_SIZE, UZ, Z0, holePoint, readPalette, uno, wireCurrents } from './model'
import './IsoBench.css'

export type { IsoViewName } from './geom'

/** A labelled pointer to something on the bench. `at` is a part id ('R1'), a part terminal ('D1.anode'), a hole ('T+5', 'uno:5V') or 'uno:usb' / 'uno:chip'. */
export interface IsoCallout {
  at: string
  title: string
  text?: string
}

export interface IsoBenchProps {
  layout: BreadboardLayout
  result?: SolveResult
  circuit?: Circuit
  view?: IsoViewName
  highlight?: string[]
  /** Parts to frame: the camera eases to them and haloes them. Empty or undefined shows the whole bench. */
  focus?: string[]
  onPartClick?(id: string): void
  callouts?: IsoCallout[]
  /** Visible caption under the bench. */
  caption?: ReactNode
  /** Accessible name of the figure. */
  ariaLabel?: string
  /** The app's "Animate current flow" setting. Motion is also off under prefers-reduced-motion. */
  animate?: boolean
  /** Width ÷ height of the drawing, and of the stage when the parent doesn't set a height. */
  aspect?: number
  /** Margin round the bench, as a fraction of the drawing (room for callouts). */
  padding?: number
}

const VBW = 1000
/** Below this stage width, callouts collapse to numbered pins with a legend under the figure. */
const PIN_MODE_WIDTH = 560
/** When the whole bench would be narrower than this on screen, start framed on the parts being built. */
const SMALL_BENCH_PX = 380
const MORPH_MS = 540
const CAMERA_MS = 460
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
const INTRO_BUDGET = 1300 // --dur-intro + 400 ms
const MAX_ZOOM = 4

function useReducedMotion() {
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

function useSize<T extends HTMLElement>() {
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
 * The vertical slice of `ref` that's on screen, in 10 % steps. A stage can be taller than what's visible (a sticky
 * column before it sticks), and framing the bench in the whole box would leave it half below the fold.
 */
function useVisibleBand(ref: React.RefObject<HTMLElement | null>, h: number) {
  const [band, setBand] = useState<{ top: number; height: number } | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !h || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([e]) => {
        const visible = e.intersectionRect.height
        const next =
          !e.isIntersecting || visible >= h * 0.95 ? null : { top: Math.round(e.intersectionRect.top - e.boundingClientRect.top), height: Math.round(visible) }
        setBand((b) => (b?.top === next?.top && b?.height === next?.height ? b : next))
      },
      { threshold: Array.from({ length: 11 }, (_, i) => i / 10) },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, h])
  return band
}

const stateOf = (r?: ComponentResult): PartState => (r ? { status: r.status, brightness: r.status === 'burnt' ? 0 : (r.brightness ?? 0) } : {})

/** Short text tag for a state colour alone can't carry. */
function statusTag(part: BreadboardPart, r?: ComponentResult): { text: string; tone: 'danger' | 'warn' | 'info' } | null {
  if (!r || part.kind === 'wire') return null
  if (r.status === 'burnt') return { text: 'BURNT', tone: 'danger' }
  if (r.status === 'overvoltage') return { text: 'REVERSE V', tone: 'danger' }
  if (r.status === 'overcurrent') return { text: 'OVER 20 mA', tone: 'warn' }
  if (r.status === 'overpower') return { text: 'HOT', tone: 'warn' }
  if ((part.kind === 'led' || part.kind === 'diode') && r.voltage < -0.1) return { text: 'BLOCKING', tone: 'info' }
  return null
}

/* ------------------------------------------------------------------ accessible names (as BreadboardView words them) */

const holePhrase = (h: Hole) => {
  const p = parseHole(h)
  if (p.kind === 'rail') return `the ${holeLabel(h)}`
  if (p.kind === 'battery') return `the battery’s ${p.terminal === '+' ? '+' : '−'} lead`
  return holeLabel(h)
}
const COMPONENT_ID = /^[A-Z]{1,3}\d+$/

/** "Resistor R1, 220 Ω, from c8 to c12", "LED D1 (red), anode (long leg) in e12, …", "Red jumper wire from …". */
export function plainName(part: BreadboardPart): string {
  switch (part.kind) {
    case 'resistor':
      return `Resistor ${part.id}, ${formatSI(part.ohms, 'Ω')}, from ${holePhrase(part.from)} to ${holePhrase(part.to)}`
    case 'diode':
      return `Diode ${part.id}, anode in ${holePhrase(part.anode)}, cathode (banded end) in ${holePhrase(part.cathode)}`
    case 'led':
      return `LED ${part.id} (${part.color}), anode (long leg) in ${holePhrase(part.anode)}, cathode (short leg, flat side) in ${holePhrase(part.cathode)}`
    case 'wire':
      return `${part.color[0].toUpperCase()}${part.color.slice(1)} jumper wire${COMPONENT_ID.test(part.id) ? ` ${part.id}` : ''} from ${holePhrase(part.from)} to ${holePhrase(part.to)}`
  }
}

const onBoard = (h: Hole) => !h.includes(':')
const holesOf = (p: BreadboardPart) => (p.kind === 'led' || p.kind === 'diode' ? [p.anode, p.cathode] : [p.from, p.to])

/* ------------------------------------------------------------------ scene types */

interface Change {
  sig: string
  n: number
  kind: 'pop' | 'flip' | null
  part: BreadboardPart
}

interface BaseScene {
  cam: Camera
  node: ReactNode
  uno: UnoDrawing | null
  obstacles: Pt[][]
  /** The whole bench's bounds in drawing units. */
  content: Rect
}

interface PartsScene {
  parts: DrawnPart[]
  wires: DrawnPart[]
  /** Parts and jumpers in one painter's order: a jumper's housings stand on the board like any part, and
   *  its arc sorts after the parts it crosses (they share its footprint, and its centre sits higher). */
  painted: DrawnPart[]
  byId: Map<string, DrawnPart>
  defs: ReactNode
}

const zoomCss = (z: Zoom) => `matrix(${z.s}, 0, 0, ${z.s}, ${z.tx}, ${z.ty})`
const affineCss = (m: Affine) => `matrix(${m.map((v) => +v.toFixed(5)).join(', ')})`
const sameZoom = (a: Zoom, b: Zoom) => Math.abs(a.s - b.s) < 1e-4 && Math.abs(a.tx - b.tx) < 0.5 && Math.abs(a.ty - b.ty) < 0.5
const rectOf = (pts: Pt[]): Rect => ({
  x0: Math.min(...pts.map((p) => p.x)),
  y0: Math.min(...pts.map((p) => p.y)),
  x1: Math.max(...pts.map((p) => p.x)),
  y1: Math.max(...pts.map((p) => p.y)),
})
/** Grow a rect to at least `min` drawing units each way, about its centre. */
const atLeast = (r: Rect, min: number): Rect => {
  const cx = (r.x0 + r.x1) / 2
  const cy = (r.y0 + r.y1) / 2
  const w = Math.max(min, r.x1 - r.x0) / 2
  const h = Math.max(min * 0.7, r.y1 - r.y0) / 2
  return { x0: cx - w, x1: cx + w, y0: cy - h, y1: cy + h }
}

export function IsoBench({
  layout,
  result,
  circuit,
  view = 'front',
  highlight = [],
  focus,
  onPartClick,
  callouts = [],
  caption,
  ariaLabel,
  animate = true,
  aspect = 1.5,
  padding = 0.07,
}: IsoBenchProps) {
  const uid = 'iso' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const VBH = Math.round(VBW / aspect)
  const reduced = useReducedMotion()
  const motion = animate && !reduced
  const [stageRef, size] = useSize<HTMLDivElement>()
  const { w: W, h: H } = size
  const band = useVisibleBand(stageRef, H)
  // Frame within the visible band (at least 280 px tall, so a sliver of stage doesn't shrink the bench to nothing).
  const bandH = band ? Math.max(band.height, Math.min(H, 280)) : H
  const bandTop = band ? Math.min(band.top, H - bandH) : 0
  const frameInBand = (r: Rect, margin: number): Zoom => {
    const z = frameRect(r, W, bandH, margin)
    return { ...z, ty: z.ty + bandTop }
  }
  const pal = readPalette()

  /* ---------------- intro: once, when the bench first scrolls into view */
  const [phase, setPhase] = useState<'pre' | 'intro' | 'live'>(motion ? 'pre' : 'live')
  useEffect(() => {
    if (phase !== 'pre') return
    if (!motion) return setPhase('live')
    const el = stageRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return setPhase('intro')
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setPhase('intro'), { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [phase, motion, stageRef])
  useEffect(() => {
    if (phase !== 'intro') return
    const t = setTimeout(() => setPhase('live'), INTRO_BUDGET + 100)
    return () => clearTimeout(t)
  }, [phase])

  /* ---------------- projection per camera preset (cached) */
  const fitPoints = useMemo(() => benchPoints(layout.parts, layout.supply), [layout])
  const fitKey = JSON.stringify(fitPoints.map((p) => [Math.round(p.x), Math.round(p.y), Math.round(p.z)]))
  const camFor = useMemo(() => {
    const cache = new Map<IsoViewName, Camera>()
    return (v: IsoViewName) => {
      if (!cache.has(v)) cache.set(v, fitCamera(VIEWS[v], fitPoints, VBW, VBH, padding))
      return cache.get(v)!
    }
    // fitKey stands for fitPoints' content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, VBH, padding])

  /* ---------------- static drawing per view: bench, Uno, board (independent of parts and results) */
  const baseFor = useMemo(() => {
    const cache = new Map<IsoViewName, BaseScene>()
    return (v: IsoViewName): BaseScene => {
      const hit = cache.get(v)
      if (hit) return hit
      const cam = camFor(v)
      const defs = new Defs(`${uid}-${v}-b`)
      const unoDrawing = layout.supply === 'uno' ? drawUno(cam, pal, defs) : null
      const boardNode = drawBoard(cam, pal, defs)
      const solids = depthSort(
        cam,
        [
          { box: BOARD, node: boardNode },
          unoDrawing
            ? { box: { x0: uno(0, 0).x, x1: uno(68.6, 0).x, y0: uno(0, UNO_SIZE.h).y, y1: uno(0, 0).y, z0: 0, z1: UZ }, node: unoDrawing.node }
            : { box: BATTERY, node: drawBattery(cam, pal, defs) },
        ],
        (s) => s.box,
      )
      const boardCorners: Pt[] = []
      for (const x of [BOARD.x0, BOARD.x1]) for (const y of [BOARD.y0, BOARD.y1]) for (const z of [0, Z0]) boardCorners.push(project(cam, x, y, z))
      const scene: BaseScene = {
        cam,
        uno: unoDrawing,
        obstacles: [boardCorners, ...(unoDrawing ? [unoDrawing.outline] : [])],
        content: rectOf(fitPoints.map((p) => project(cam, p.x, p.y, p.z))),
        node: (
          <>
            {drawBench(cam, pal, `${uid}-${v}`)}
            {defs.list()}
            {solids.map((s, i) => (
              <g key={i}>{s.node}</g>
            ))}
          </>
        ),
      }
      cache.set(v, scene)
      return scene
    }
    // fitKey stands for fitPoints' content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camFor, layout.supply, pal, uid])

  /* ---------------- parts and jumpers, with the solver's state */
  const comps = useMemo(() => new Map((circuit?.components ?? []).map((c) => [c.id, c])), [circuit])
  const states = useMemo(() => Object.fromEntries(layout.parts.map((p) => [p.id, stateOf(result?.components[p.id])])), [layout, result])
  const statesKey = JSON.stringify(states)
  const partsFor = useMemo(() => {
    const cache = new Map<IsoViewName, PartsScene>()
    return (v: IsoViewName): PartsScene => {
      const hit = cache.get(v)
      if (hit) return hit
      const cam = camFor(v)
      const defs = new Defs(`${uid}-${v}-p`)
      const drawn = layout.parts.map((p) => drawPart(cam, pal, defs, p, states[p.id] ?? {}))
      const scene = {
        parts: depthSort(cam, drawn.filter((d) => d.kind !== 'wire'), (d) => d.box),
        wires: drawn.filter((d) => d.kind === 'wire'),
        painted: depthSort(cam, drawn, (d) => d.box),
        byId: new Map(drawn.map((d) => [d.id, d])),
        defs: defs.list(),
      }
      cache.set(v, scene)
      return scene
    }
    // statesKey stands for states' content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camFor, layout, statesKey, pal, uid])

  /* ---------------- camera presets: crossfade two drawings while one transform maps the old bench plane onto the new */
  const [shown, setShown] = useState<IsoViewName>(view)
  const [leaving, setLeaving] = useState<{ view: IsoViewName; to: string; from: string } | null>(null)
  useEffect(() => {
    if (view === shown) return
    if (!motion || phase !== 'live') {
      setShown(view)
      setLeaving(null)
      return
    }
    // Precomputed endpoints: the bench plane's affine map from the old projection to the new one.
    const a = multiplyAffine(groundMatrix(camFor(view), Z0), invertAffine(groundMatrix(camFor(shown), Z0)))
    setLeaving({ view: shown, to: affineCss(a), from: affineCss(invertAffine(a)) })
    setShown(view)
  }, [view, shown, motion, phase, camFor])

  const leaveRef = useRef<HTMLDivElement>(null)
  const enterRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!leaving) return
    const timing = { duration: MORPH_MS, easing: EASE }
    // Only the first few frames show both drawings: the new one fades in over the old (both following the
    // same bench-plane map), then the old one is dropped so the rest of the tween moves a single layer.
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

  /* ---------------- which parts just changed (pop or flip) */
  const changes = useRef(new Map<string, Change>())
  const changeOf = useMemo(() => {
    const m = changes.current
    for (const p of layout.parts) {
      const sig = JSON.stringify(p)
      const prev = m.get(p.id)
      if (!prev) m.set(p.id, { sig, n: 0, kind: null, part: p })
      else if (prev.sig !== sig) {
        const flipped = p.kind === 'led' && prev.part.kind === 'led' && prev.part.anode === p.cathode && prev.part.cathode === p.anode
        m.set(p.id, { sig, n: prev.n + 1, kind: flipped ? 'flip' : 'pop', part: p })
      }
    }
    return (id: string) => m.get(id)
  }, [layout])

  /* ---------------- burnout bursts */
  const prevStatus = useRef<Record<string, string | undefined>>({})
  const [bursts, setBursts] = useState<Record<string, number>>({})
  useEffect(() => {
    const prev = prevStatus.current
    const fresh: string[] = []
    for (const p of layout.parts) {
      const s = result?.components[p.id]?.status
      if (s === 'burnt' && prev[p.id] !== undefined && prev[p.id] !== 'burnt') fresh.push(p.id)
      prev[p.id] = s
    }
    if (!fresh.length || !motion) return
    setBursts((b) => ({ ...b, ...Object.fromEntries(fresh.map((id) => [id, (b[id] ?? 0) + 1])) }))
    const t = setTimeout(() => setBursts((b) => Object.fromEntries(Object.entries(b).filter(([id]) => !fresh.includes(id)))), 1700)
    return () => clearTimeout(t)
  }, [layout, result, motion])

  /* ---------------- intro timing: board, then parts drop (70 ms apart), then wires draw */
  const timing = useMemo(() => {
    const comp = layout.parts.filter((p) => p.kind !== 'wire')
    const wires = layout.parts.filter((p) => p.kind === 'wire')
    const ps = comp.length > 1 ? Math.min(70, 400 / (comp.length - 1)) : 70
    const out: Record<string, { d: number; dw: number }> = {}
    comp.forEach((p, i) => (out[p.id] = { d: 220 + i * ps, dw: 0 }))
    const partsEnd = 220 + Math.max(0, comp.length - 1) * ps + 480
    const start = Math.min(INTRO_BUDGET - 380, Math.max(300, partsEnd - 200))
    const ws = wires.length > 1 ? Math.min(70, Math.max(0, (INTRO_BUDGET - 380 - start) / (wires.length - 1))) : 0
    wires.forEach((p, i) => (out[p.id] = { d: start - 140 + i * ws, dw: start + i * ws }))
    return out
  }, [layout])

  /* ---------------- 2D camera: fit, focus framing, pan and zoom (one transform on one group) */
  const base = baseFor(shown)
  const cur = partsFor(shown)
  const focusKey = (focus ?? []).join(' ')
  // The whole bench, as large as the stage allows (the drawing's own padding is the margin).
  const fitZoom = W && H ? frameInBand(base.content, Math.min(padding, 0.06)) : { s: 1, tx: 0, ty: 0 }
  const target = useMemo((): Zoom => {
    if (!W || !H) return fitZoom
    const frame = (ids: string[]) => {
      const pts = ids.flatMap((id) => cur.byId.get(id)?.outline ?? [])
      if (!pts.length) return null
      const z = frameInBand(atLeast(rectOf(pts), 230), 0.14)
      return clampZoom(z, base.content, W, H, fitZoom.s, fitZoom.s * MAX_ZOOM)
    }
    if (focus?.length) {
      const z = frame(focus)
      if (z) return z
    }
    // A phone-sized stage: start on the parts being built (everything plugged into the board).
    const benchPx = (base.content.x1 - base.content.x0) * fitZoom.s
    if (benchPx < SMALL_BENCH_PX) {
      const z = frame(layout.parts.filter((p) => holesOf(p).every(onBoard)).map((p) => p.id))
      if (z) return z
    }
    return fitZoom
    // fitZoom derives from W, H, VBH.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H, VBH, bandH, bandTop, focusKey, shown, cur, base, layout])

  const [userZoom, setUserZoom] = useState<Zoom | null>(null)
  useEffect(() => setUserZoom(null), [focusKey, shown, W, H])
  const zoom = userZoom ?? target
  const limit = useCallback((z: Zoom) => clampZoom(z, base.content, W, H, fitZoom.s, fitZoom.s * MAX_ZOOM), [base, W, H, fitZoom.s])

  const camRef = useRef<HTMLDivElement>(null)
  const shownZoom = useRef<Zoom | null>(null)
  const lastSize = useRef(size)
  const noTween = useRef(false)
  const [moving, setMoving] = useState(false)
  useLayoutEffect(() => {
    const el = camRef.current
    if (!el || !W) return
    const prev = shownZoom.current
    shownZoom.current = zoom
    el.style.transform = zoomCss(zoom)
    const resized = lastSize.current !== size
    lastSize.current = size
    const skip = noTween.current
    noTween.current = false
    if (!prev || resized || skip || !motion || phase === 'pre' || sameZoom(prev, zoom)) return
    // Start from wherever a running tween has got to; the compositor runs it (transform only).
    const from = el.getAnimations().length ? getComputedStyle(el).transform : zoomCss(prev)
    el.getAnimations().forEach((a) => a.cancel())
    const a = el.animate([{ transform: from }, { transform: zoomCss(zoom) }], { duration: CAMERA_MS, easing: EASE })
    setMoving(true)
    a.finished.then(
      () => setMoving(false),
      () => {},
    )
  }, [zoom, W, size, motion, phase])

  /* drag to pan, pinch or ctrl/⌘-wheel to zoom */
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
    gesture.current = { start: gesture.current?.now ?? shownZoom.current ?? zoom, pts: [...pointers.current.values()], dragged: gesture.current?.dragged ?? false, now: gesture.current?.now ?? shownZoom.current ?? zoom }
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
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    let commit = 0
    const onWheel = (e: WheelEvent) => {
      // Plain wheel scrolls the page; ctrl/⌘ + wheel (and trackpad pinch, which arrives as ctrl + wheel) zooms.
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const cur = gesture.current?.now ?? shownZoom.current
      if (!cur) return
      const next = limit(zoomAt(cur, Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top))
      gesture.current = { start: next, pts: [], dragged: true, now: next }
      shownZoom.current = next
      writeZoom(next)
      setMoving(true)
      clearTimeout(commit)
      commit = window.setTimeout(() => {
        gesture.current = null
        noTween.current = true
        setUserZoom(next)
        setMoving(false)
      }, 160)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      clearTimeout(commit)
    }
  }, [stageRef, limit])

  /* ---------------- warm-up: every preset's geometry, and one hidden mount of each, while idle */
  // A preset switch then only re-mounts DOM along already-warm code paths (no cold first switch).
  const [warm, setWarm] = useState<IsoViewName[]>([])
  const warmedFor = useRef<unknown>(null)
  useEffect(() => {
    // Once per bench drawing, not on every part change.
    if (phase !== 'live' || warmedFor.current === baseFor) return
    warmedFor.current = baseFor
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200))
    const cancel = window.cancelIdleCallback ?? window.clearTimeout
    const id = idle(() => {
      const views = Object.keys(VIEWS) as IsoViewName[]
      views.forEach((v) => (baseFor(v), partsFor(v)))
      setWarm(views)
    })
    return () => cancel(id)
  }, [phase, baseFor, partsFor])
  useEffect(() => {
    if (!warm.length) return
    const t = window.setTimeout(() => {
      setWarm([])
      // One invisible no-op tween promotes the camera layer once, so the first real tween starts warm.
      const el = camRef.current
      if (el && motion && !el.getAnimations().length) el.animate([{ transform: el.style.transform }, { transform: el.style.transform }], { duration: 60 })
    }, 120)
    return () => clearTimeout(t)
    // camRef is stable; motion only gates the no-op tween.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warm])

  /* ---------------- parts */
  const halo = new Set([...highlight, ...(focus ?? [])])
  const renderPart = (p: DrawnPart) => {
    const ch = changeOf(p.id)
    const c = comps.get(p.id)
    const part = layout.parts.find((q) => q.id === p.id)!
    // The flat board's wording, then the solver's state ("…, lit, 13.8 mA").
    const live = c && result ? partLabel(c, result.components[p.id]).slice(partLabel(c).length) : ''
    const label = plainName(part) + live
    const clickable = !!(c && onPartClick)
    const t = timing[p.id] ?? { d: 0, dw: 0 }
    const lit = halo.has(p.id)
    const ring = poly(convexHull(p.outline))
    const cls = ['iso-part', `iso-${p.kind}`, lit && 'is-hl is-highlighted', ch?.kind && `iso-${ch.kind}`].filter(Boolean).join(' ')
    return (
      <g
        key={`${p.id}-${ch?.n ?? 0}`}
        className={cls}
        data-part={p.id}
        style={{ '--d': `${t.d}ms`, '--dw': `${t.dw}ms` } as CSSProperties}
        role={clickable ? 'button' : 'img'}
        aria-label={label}
        tabIndex={0}
        onClick={clickable ? () => !suppressClick.current && onPartClick!(p.id) : undefined}
        onKeyDown={
          clickable
            ? (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onPartClick!(p.id)
                }
              }
            : undefined
        }
      >
        {lit && <path className="iso-halo" d={ring} />}
        {p.shadow}
        <g className="iso-lift">{p.body}</g>
        <path className="iso-ring" d={ring} />
      </g>
    )
  }

  const scene = (v: IsoViewName, role: 'leave' | 'enter' | 'still' | 'warm') => {
    const b = baseFor(v)
    const parts = partsFor(v)
    return (
      <div
        key={v}
        ref={role === 'leave' ? leaveRef : role === 'enter' ? enterRef : undefined}
        className={`iso-scene iso-${role}`}
        style={{ '--drop': `${f(-12 * b.cam.ct * unitScale(b.cam))}px` } as CSSProperties}
        aria-hidden={role === 'leave' || role === 'warm' ? true : undefined}
      >
        {/* Two layers: the bench, Uno and board never change, so part changes only repaint the parts layer. */}
        <svg className="iso-layer" viewBox={`0 0 ${VBW} ${VBH}`} aria-hidden>
          {b.node}
        </svg>
        <svg className="iso-layer" viewBox={`0 0 ${VBW} ${VBH}`} role="group" aria-label="Parts on the bench">
          {parts.defs}
          <g className="iso-parts">{parts.painted.map(renderPart)}</g>
        </svg>
      </div>
    )
  }

  /* ---------------- live overlay: glow, current pulses, burnout (drawing units, inside the camera) */
  const cam = base.cam
  const anyBurnt = Object.values(result?.components ?? {}).some((r) => r.status === 'burnt')
  const currents = useMemo(() => (result && circuit ? wireCurrents(layout, circuit, result) : {}), [layout, circuit, result])
  const us = unitScale(cam)
  const flows = cur.wires
    .map((w) => ({ w, i: currents[w.id] ?? 0 }))
    .filter(({ w, i }) => w.track && Math.abs(i) >= FLOW_THRESHOLD && !anyBurnt)
    .map(({ w, i }) => {
      const spacing = 10 * us
      const n = Math.max(1, Math.floor(w.track!.length / spacing))
      // flowSpeed is in px/s for the flat breadboard drawing (≈7.9 px per mm); keep the same mm/s here.
      return { id: w.id, track: w.track!, n, spacing: w.track!.length / n, speed: (flowSpeed(i) / 7.87) * us, dir: Math.sign(i) }
    })
  const flowKey = flows.map((fl) => `${fl.id}:${fl.n}:${fl.speed.toFixed(2)}:${fl.dir}`).join('|') + shown
  const pulseRefs = useRef<(HTMLSpanElement | null)[]>([])
  const live = motion && phase === 'live' && !leaving
  // Pulses are HTML spans moved by Web Animations on transform, so they run on the compositor:
  // the path is sampled evenly by length (like getPointAtLength) into linear keyframes.
  useEffect(() => {
    if (!live || !flows.length) return
    const size = 2.8 * us
    const anims: Animation[] = []
    let k = 0
    for (const fl of flows) {
      const samples = Math.max(8, Math.round(fl.track.length / 6))
      const frames = Array.from({ length: samples + 1 }, (_, i) => {
        const p = pointAt(fl.track, (fl.track.length * i) / samples)
        return { transform: `translate(${(p.x - size / 2).toFixed(1)}px, ${(p.y - size / 2).toFixed(1)}px)` }
      })
      const duration = (fl.track.length / fl.speed) * 1000
      for (let j = 0; j < fl.n; j++) {
        const el = pulseRefs.current[k++]
        if (!el) continue
        el.style.width = el.style.height = `${size.toFixed(1)}px`
        anims.push(el.animate(frames, { duration, iterations: Infinity, delay: -(j * fl.spacing * 1000) / fl.speed, direction: fl.dir > 0 ? 'normal' : 'reverse' }))
      }
    }
    return () => anims.forEach((a) => a.cancel())
    // flowKey stands for flows' content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, flowKey])

  const ld = new Defs(`${uid}-${shown}-l`)
  const smokeFill = ld.radial('smoke', [
    [0, '#9aa3b5', 0.55],
    [1, '#9aa3b5', 0],
  ])
  const flashFill = ld.radial('flash', [
    [0, '#ffffff', 1],
    [0.35, '#fff3c4', 0.8],
    [1, '#ffb347', 0],
  ])
  const gm = groundMatrix(cam, Z0)
  let pulseIndex = 0
  const pulses = live
    ? flows.flatMap((fl) =>
        Array.from({ length: fl.n }, (_, j) => {
          const k = pulseIndex++
          return <span key={`${fl.id}-${j}`} className="iso-pulse" ref={(el) => void (pulseRefs.current[k] = el)} />
        }),
      )
    : null
  const liveSvg = (
    <svg className="iso-live" viewBox={`0 0 ${VBW} ${VBH}`} aria-hidden>
      {cur.parts
        .filter((p) => p.light)
        .map((p) => {
          const b = states[p.id]?.brightness ?? 0
          const fill = ld.radial(`glow-${p.light!.color}`, [
            [0, p.light!.color, 0.9],
            [0.18, p.light!.color, 0.55],
            [0.5, p.light!.color, 0.14],
            [1, p.light!.color, 0],
          ])
          const s = 0.35 + 0.65 * Math.sqrt(b)
          return (
            <g key={p.id}>
              <ellipse className="iso-spill" transform={`matrix(${gm.map(f).join(' ')})`} cx={f(p.light!.floor.x)} cy={f(p.light!.floor.y)} rx={16} ry={16} fill={fill} style={{ opacity: Math.min(0.75, b * 0.9) }} />
              <circle className="iso-glow" cx={f(p.light!.at.x)} cy={f(p.light!.at.y)} r={f(p.light!.r * 7)} fill={fill} style={{ opacity: Math.min(1, b * 1.1), transform: `scale(${s.toFixed(3)})` }} />
            </g>
          )
        })}
      {Object.entries(bursts).map(([id, n]) => {
        const p = cur.byId.get(id)
        if (!p) return null
        const c = p.light?.at ?? p.anchors.top
        const r = (p.light?.r ?? 2 * us) * 5
        return (
          <g key={`${id}-${n}`} className="iso-burst">
            <circle className="iso-flash" cx={f(c.x)} cy={f(c.y)} r={f(r)} fill={flashFill} />
            {[0, 1, 2].map((i) => (
              <circle key={i} className="iso-smoke" style={{ animationDelay: `${180 + i * 140}ms` }} cx={f(c.x + (i - 1) * r * 0.25)} cy={f(c.y - r * 0.2)} r={f(r * 0.55)} fill={smokeFill} />
            ))}
          </g>
        )
      })}
      {ld.list()}
    </svg>
  )

  /* ---------------- callouts and status tags (HTML outside the camera, so text stays crisp) */
  const toPx = (p: Pt): Pt => ({ x: p.x * zoom.s + zoom.tx, y: p.y * zoom.s + zoom.ty })
  const pinMode = W > 0 && W < PIN_MODE_WIDTH
  const resolve = (at: string): Pt | null => {
    if (at === 'uno:usb' || at === 'uno:chip') return base.uno?.anchors[at.slice(4)] ?? null
    const [id, term] = at.split('.')
    const part = cur.byId.get(id)
    if (part) return part.anchors[term ?? 'top'] ?? part.anchors.top
    try {
      const h = holePoint(at)
      return project(cam, h.x, h.y, h.z + 0.3)
    } catch {
      return null
    }
  }
  const zoomKey = `${zoom.s.toFixed(4)},${zoom.tx.toFixed(1)},${zoom.ty.toFixed(1)}`
  const placed = useMemo(() => {
    if (!W || !H || !callouts.length) return []
    const pad = 4
    const toBands = (pts: Pt[]): Box[] => hullBands(convexHull(pts.map(toPx)), 10).map((b) => ({ x0: b.x0 - pad, y0: b.y0 - pad, x1: b.x1 + pad, y1: b.y1 + pad }))
    const solids = [...base.obstacles, ...[...cur.parts, ...cur.wires].map((p) => p.outline)]
    const obstacles: Box[] = solids.flatMap(toBands)
    // Labels go outward from the middle of the bench, so leaders fan out instead of crossing.
    const mid = toPx({ x: (base.content.x0 + base.content.x1) / 2, y: (base.content.y0 + base.content.y1) / 2 })
    const dirs = [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]
    const items = callouts
      .map((c) => ({ c, a: resolve(c.at) }))
      .filter((x): x is { c: IsoCallout; a: Pt } => !!x.a)
      .map(({ c, a }, index) => {
        const { x: ax, y: ay } = toPx(a)
        const textW = c.text ? Math.min(c.text.length * 6.5, 190) : 0
        const w = pinMode ? 20 : Math.min(214, Math.max(c.title.length * 7.7 + 24, textW + 24))
        const lines = pinMode || !c.text ? 0 : Math.min(2, Math.ceil((c.text.length * 6.5) / (w - 24)))
        const h = pinMode ? 20 : 30 + lines * 17
        const out = { x: ax - mid.x, y: ay - mid.y }
        const order = [...dirs].sort((p, q) => q[0] * out.x + q[1] * out.y * 1.6 - (p[0] * out.x + p[1] * out.y * 1.6))
        const boxes: Box[] = []
        for (const dist of pinMode ? [0, 18, 30] : [36, 70, 110, 160, 220])
          for (const [dx, dy] of order) {
            const px = ax + dx * dist
            const py = ay + dy * dist * 0.75
            // Kept inside the frame (6 px margin) so placement sees where the label really lands.
            const x0 = Math.min(W - 6 - w, Math.max(6, pinMode || dx === 0 ? px - w / 2 : dx < 0 ? px - w : px))
            const y0 = Math.min(H - 6 - h, Math.max(6, pinMode || dy === 0 ? py - h / 2 : dy < 0 ? py - h : py))
            boxes.push({ x0, y0, x1: x0 + w, y1: y0 + h })
          }
        return { c, ax, ay, index, boxes }
      })
    const anchors = pinMode ? [] : items.map((i) => ({ x0: i.ax - 7, y0: i.ay - 7, x1: i.ax + 7, y1: i.ay + 7 }))
    const choice = placeLabels(
      items.map((i) => i.boxes),
      [...(pinMode ? [] : obstacles), ...anchors],
    )
    return items.map((it, i) => ({ ...it, box: it.boxes[choice[i]] }))
    // toPx and resolve read the zoom and scene named by the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H, pinMode, callouts, shown, cur, base, zoomKey])

  const tags = cur.painted
    .map((p) => {
      const part = layout.parts.find((q) => q.id === p.id)
      const tag = part && statusTag(part, result?.components[p.id])
      return tag ? { id: p.id, tag, at: toPx(p.anchors.top) } : null
    })
    .filter((x) => x !== null)

  const nearestEdge = (b: Box, x: number, y: number) => ({ x: Math.min(b.x1, Math.max(b.x0, x)), y: Math.min(b.y1, Math.max(b.y0, y)) })
  const zoomedIn = zoom.s > fitZoom.s * 1.02

  const stageClass = [
    'iso-stage',
    phase === 'pre' && 'iso-pre',
    phase === 'intro' && 'iso-intro',
    leaving && 'is-morphing',
    moving && 'is-moving',
    !motion && 'iso-still',
    halo.size > 0 && 'has-hl',
    zoomedIn && 'is-zoomed',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <figure className="iso-bench" aria-label={ariaLabel} style={{ '--iso-px': `${(1 / zoom.s).toFixed(4)}px`, '--iso-aspect': `${VBW} / ${VBH}` } as CSSProperties}>
      <div
        ref={stageRef}
        className={stageClass}
        data-view={shown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.stopPropagation()
            suppressClick.current = false
          }
        }}
      >
        <div ref={camRef} className="iso-cam" style={{ width: VBW, height: VBH }}>
          {leaving && scene(leaving.view, 'leave')}
          {scene(shown, leaving ? 'enter' : 'still')}
          {warm.length > 0 && (
            <div className="iso-warm" aria-hidden>
              {warm.filter((v) => v !== shown && v !== leaving?.view).map((v) => scene(v, 'warm'))}
            </div>
          )}
          {liveSvg}
          <div className="iso-pulses" aria-hidden>
            {pulses}
          </div>
        </div>
        <div className="iso-overlay">
          <svg className="iso-leaders" width={W} height={H} aria-hidden>
            {!pinMode &&
              placed.map(({ c, ax, ay, box }) => {
                const e = nearestEdge(box, ax, ay)
                return (
                  <g key={c.at + c.title}>
                    <line x1={ax} y1={ay} x2={e.x} y2={e.y} />
                    <circle className="iso-node" cx={ax} cy={ay} r={3.5} />
                  </g>
                )
              })}
            {pinMode &&
              placed.map(({ c, ax, ay, box, index }) => {
                const px = (box.x0 + box.x1) / 2
                const py = (box.y0 + box.y1) / 2
                return (
                  <g key={c.at + c.title} className="iso-pin">
                    {Math.hypot(px - ax, py - ay) > 4 && <line x1={ax} y1={ay} x2={px} y2={py} />}
                    <circle cx={px} cy={py} r={9} />
                    <text x={px} y={py} dominantBaseline="central" textAnchor="middle">
                      {index + 1}
                    </text>
                  </g>
                )
              })}
          </svg>
          {!pinMode &&
            placed.map(({ c, box }) => (
              <div key={c.at + c.title} className="iso-callout" style={{ left: box.x0, top: box.y0, width: box.x1 - box.x0 }}>
                <strong>{c.title}</strong>
                {c.text && <span>{c.text}</span>}
              </div>
            ))}
          {tags.map(({ id, tag, at }) => (
            <span key={id} className={`iso-tag is-${tag.tone}`} style={{ left: at.x, top: at.y }}>
              {id} · {tag.text}
            </span>
          ))}
        </div>
        {userZoom && (
          <button type="button" className="iso-reset" onClick={() => setUserZoom(null)}>
            Reset view
          </button>
        )}
      </div>
      {pinMode && placed.length > 0 && (
        <ol className="iso-legend">
          {placed.map(({ c }) => (
            <li key={c.at + c.title}>
              <strong>{c.title}</strong>
              {c.text && <span> {c.text}</span>}
            </li>
          ))}
        </ol>
      )}
      <figcaption className={caption ? 'iso-caption' : 'iso-sr'}>{caption ?? ariaLabel ?? 'Breadboard bench'}</figcaption>
    </figure>
  )
}
