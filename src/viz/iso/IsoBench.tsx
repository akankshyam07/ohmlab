import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import type { Circuit, ComponentResult, SolveResult } from '../../sim/types'
import { FLOW_THRESHOLD, flowSpeed, partLabel } from '../describe'
import { placeLabels, type Box } from '../place'
import type { BreadboardLayout, BreadboardPart } from '../types'
import { Defs, benchPoints, drawBattery, drawBench, drawBoard, drawPart, drawUno, type DrawnPart, type PartState, type UnoDrawing } from './draw'
import {
  type Affine,
  type Camera,
  type IsoViewName,
  type Pt,
  VIEWS,
  convexHull,
  depthSort,
  f,
  fitCamera,
  groundMatrix,
  hullBands,
  invertAffine,
  multiplyAffine,
  pointAt,
  poly,
  project,
  unitScale,
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
  onPartClick?(id: string): void
  callouts?: IsoCallout[]
  /** Short caption for the figure (also its accessible name). */
  caption?: ReactNode
  /** The app's "Animate current flow" setting. Motion is also off under prefers-reduced-motion. */
  animate?: boolean
  /** Frame width ÷ height. */
  aspect?: number
  /** Margin round the bench, as a fraction of the frame (room for callouts). */
  padding?: number
}

const VBW = 1000
/** Below this stage width, callouts collapse to numbered pins with a legend under the figure. */
const PIN_MODE_WIDTH = 560
const MORPH_MS = 560
const INTRO_BUDGET = 1300 // --dur-intro + 400 ms

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

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
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
}

interface PartsScene {
  parts: DrawnPart[]
  wires: DrawnPart[]
  /** Parts and jumpers in one painter's order: a jumper's housings stand on the board like any part, and
   *  its arc sorts after the parts it crosses (they share its footprint, and its centre sits higher). */
  painted: DrawnPart[]
  defs: ReactNode
}

export function IsoBench({ layout, result, circuit, view = 'front', highlight = [], onPartClick, callouts = [], caption, animate = true, aspect = 1.5, padding = 0.07 }: IsoBenchProps) {
  const uid = 'iso' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const VBH = Math.round(VBW / aspect)
  const reduced = useReducedMotion()
  const motion = animate && !reduced
  const [stageRef, width] = useWidth<HTMLDivElement>()
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

  /* ---------------- camera views, tweened by morphing one transform */
  const [shown, setShown] = useState<IsoViewName>(view)
  const [leaving, setLeaving] = useState<{ view: IsoViewName; to: string; from: string } | null>(null)

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

  useEffect(() => {
    if (view === shown) return
    if (!motion || !width || phase !== 'live') {
      setShown(view)
      setLeaving(null)
      return
    }
    const a = multiplyAffine(groundMatrix(camFor(view), Z0), invertAffine(groundMatrix(camFor(shown), Z0)))
    const s = width / VBW
    const css = (m: Affine) => `matrix(${m[0]}, ${m[1]}, ${m[2]}, ${m[3]}, ${m[4] * s}, ${m[5] * s})`
    setLeaving({ view: shown, to: css(a), from: css(invertAffine(a)) })
    setShown(view)
    const t = setTimeout(() => setLeaving(null), MORPH_MS + 40)
    return () => clearTimeout(t)
  }, [view, shown, motion, width, phase, camFor])

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
        defs: defs.list(),
      }
      cache.set(v, scene)
      return scene
    }
    // statesKey stands for states' content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camFor, layout, statesKey, pal, uid])

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

  const highlightSet = new Set(highlight)
  const renderPart = (p: DrawnPart) => {
    const ch = changeOf(p.id)
    const c = comps.get(p.id)
    const label = c ? partLabel(c, result?.components[p.id]) : undefined
    const clickable = !!(label && onPartClick)
    const t = timing[p.id] ?? { d: 0, dw: 0 }
    const cls = ['iso-part', `iso-${p.kind}`, highlightSet.has(p.id) && 'is-hl', ch?.kind && `iso-${ch.kind}`].filter(Boolean).join(' ')
    return (
      <g
        key={`${p.id}-${ch?.n ?? 0}`}
        className={cls}
        data-part={p.id}
        style={{ '--d': `${t.d}ms`, '--dw': `${t.dw}ms` } as CSSProperties}
        role={label ? (clickable ? 'button' : 'img') : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? () => onPartClick!(p.id) : undefined}
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
        {p.shadow}
        <g className="iso-lift">{p.body}</g>
        <path className="iso-ring" d={poly(convexHull(p.outline))} />
      </g>
    )
  }

  const sceneSvg = (v: IsoViewName, role: 'leave' | 'enter' | 'still') => {
    const base = baseFor(v)
    const parts = partsFor(v)
    const style = {
      '--drop': `${f(-12 * base.cam.ct * unitScale(base.cam))}px`,
      ...(role === 'leave' && leaving ? { '--to': leaving.to } : {}),
      ...(role === 'enter' && leaving ? { '--from': leaving.from } : {}),
    } as CSSProperties
    // Two layers: the bench, Uno and board never change after the intro, so part changes only
    // repaint the small parts layer above them (parts always sit in front of the board).
    return (
      <div key={v} className={`iso-scene iso-${role}`} style={style} aria-hidden={role === 'leave' ? true : undefined} role={role === 'leave' ? undefined : 'group'} aria-label={role === 'leave' ? undefined : 'Bench'}>
        <svg className="iso-layer" viewBox={`0 0 ${VBW} ${VBH}`} aria-hidden>
          {base.node}
        </svg>
        <svg className="iso-layer iso-layer-parts" viewBox={`0 0 ${VBW} ${VBH}`}>
          {parts.defs}
          <g className="iso-parts">{parts.painted.map(renderPart)}</g>
        </svg>
      </div>
    )
  }

  // Warm the other camera views while the page is idle, so a preset switch only has to mount DOM.
  useEffect(() => {
    if (phase !== 'live') return
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200))
    const cancel = window.cancelIdleCallback ?? window.clearTimeout
    const id = idle(() => (Object.keys(VIEWS) as IsoViewName[]).forEach((v) => (baseFor(v), partsFor(v))))
    return () => cancel(id)
  }, [phase, baseFor, partsFor])

  /* ---------------- live overlay: glow, current pulses, burnout */
  const cur = partsFor(shown)
  const cam = baseFor(shown).cam
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
    if (!live || !flows.length || !width) return
    const px = width / VBW
    const size = 3.2 * us * px
    const anims: Animation[] = []
    let k = 0
    for (const fl of flows) {
      const samples = Math.max(8, Math.round(fl.track.length / 6))
      const frames = Array.from({ length: samples + 1 }, (_, i) => {
        const p = pointAt(fl.track, (fl.track.length * i) / samples)
        return { transform: `translate(${(p.x * px - size / 2).toFixed(1)}px, ${(p.y * px - size / 2).toFixed(1)}px)` }
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
  }, [live, flowKey, width])

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
        const p = cur.parts.find((d) => d.id === id)
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

  /* ---------------- callouts and status tags (HTML, so text stays crisp and readable) */
  const s = width / VBW
  const pinMode = width > 0 && width < PIN_MODE_WIDTH
  const resolve = (at: string): Pt | null => {
    const base = baseFor(shown)
    if (at === 'uno:usb' || at === 'uno:chip') return base.uno?.anchors[at.slice(4)] ?? null
    const [id, term] = at.split('.')
    const part = [...cur.parts, ...cur.wires].find((p) => p.id === id)
    if (part) return part.anchors[term ?? 'top'] ?? part.anchors.top
    try {
      const h = holePoint(at)
      return project(cam, h.x, h.y, h.z + 0.3)
    } catch {
      return null
    }
  }
  const placed = useMemo(() => {
    if (!width) return []
    const H = width / aspect
    const pad = 4
    const toBands = (pts: Pt[]): Box[] =>
      hullBands(convexHull(pts.map((p) => ({ x: p.x * s, y: p.y * s }))), 10).map((b) => ({ x0: b.x0 - pad, y0: b.y0 - pad, x1: b.x1 + pad, y1: b.y1 + pad }))
    const solids = [...baseFor(shown).obstacles, ...[...cur.parts, ...cur.wires].map((p) => p.outline)]
    const obstacles: Box[] = solids.flatMap(toBands)
    // Labels go outward from the middle of the bench, so leaders fan out instead of crossing.
    const all = solids.flat()
    const cx = ((Math.min(...all.map((p) => p.x)) + Math.max(...all.map((p) => p.x))) / 2) * s
    const cy = ((Math.min(...all.map((p) => p.y)) + Math.max(...all.map((p) => p.y))) / 2) * s
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
        const ax = a.x * s
        const ay = a.y * s
        const textW = c.text ? Math.min(c.text.length * 6.5, 190) : 0
        const w = pinMode ? 20 : Math.min(214, Math.max(c.title.length * 7.7 + 24, textW + 24))
        const lines = pinMode || !c.text ? 0 : Math.min(2, Math.ceil((c.text.length * 6.5) / (w - 24)))
        const h = pinMode ? 20 : 30 + lines * 17
        const out = { x: ax - cx, y: ay - cy }
        const order = [...dirs].sort((p, q) => q[0] * out.x + q[1] * out.y * 1.6 - (p[0] * out.x + p[1] * out.y * 1.6))
        const boxes: Box[] = []
        for (const dist of pinMode ? [0, 18, 30] : [36, 70, 110, 160, 220])
          for (const [dx, dy] of order) {
            const px = ax + dx * dist
            const py = ay + dy * dist * 0.75
            // Kept inside the frame (6 px margin) so placement sees where the label really lands.
            const x0 = Math.min(width - 6 - w, Math.max(6, pinMode || dx === 0 ? px - w / 2 : dx < 0 ? px - w : px))
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
    // resolve() reads the same scene the deps describe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, pinMode, callouts, shown, cur, aspect, s])

  const tags = [...cur.parts, ...cur.wires]
    .map((p) => {
      const part = layout.parts.find((q) => q.id === p.id)
      const tag = part && statusTag(part, result?.components[p.id])
      return tag ? { id: p.id, tag, at: p.anchors.top } : null
    })
    .filter((x) => x !== null)

  const nearestEdge = (b: Box, x: number, y: number) => ({ x: Math.min(b.x1, Math.max(b.x0, x)), y: Math.min(b.y1, Math.max(b.y0, y)) })

  const stageClass = ['iso-stage', phase === 'pre' && 'iso-pre', phase === 'intro' && 'iso-intro', leaving && 'is-morphing', !motion && 'iso-still', highlight.length > 0 && 'has-hl'].filter(Boolean).join(' ')
  return (
    <figure className="iso-bench" style={{ '--iso-px': `${width ? (VBW / width).toFixed(4) : 1}px` } as CSSProperties}>
      <div ref={stageRef} className={stageClass} style={{ aspectRatio: `${VBW} / ${VBH}` }} data-view={shown}>
        {leaving && sceneSvg(leaving.view, 'leave')}
        {sceneSvg(shown, leaving ? 'enter' : 'still')}
        {liveSvg}
        <div className="iso-pulses" aria-hidden>
          {pulses}
        </div>
        <div className="iso-overlay">
          <svg className="iso-leaders" width={width} height={width / aspect} aria-hidden>
            {!pinMode && placed.map(({ c, ax, ay, box }) => {
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
          {!pinMode && placed.map(({ c, box }) => (
            <div key={c.at + c.title} className="iso-callout" style={{ left: box.x0, top: box.y0, width: box.x1 - box.x0 }}>
              <strong>{c.title}</strong>
              {c.text && <span>{c.text}</span>}
            </div>
          ))}
          {tags.map(({ id, tag, at }) => (
            <span key={id} className={`iso-tag is-${tag.tone}`} style={{ left: at.x * s, top: at.y * s }}>
              {id} · {tag.text}
            </span>
          ))}
        </div>
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
      {caption && <figcaption className="iso-caption">{caption}</figcaption>}
    </figure>
  )
}
