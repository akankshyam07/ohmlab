import { useId, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react'
import type { Component, ComponentResult, LedColor } from '../sim/types'
import { formatSI } from '../ui/format'
import { flowSpeed, partLabel, partValue } from './describe'
import type { CircuitViewProps, PartLayout, Point, ProbePoint, WireLayout } from './types'
import './CircuitView.css'

export { flowSpeed, partLabel } from './describe'

/** The only raw colours in the view: LED tints. */
const LED_COLORS: Record<LedColor, string> = {
  red: '#ff4d5e',
  yellow: '#ffd23f',
  green: '#3dff8a',
  blue: '#4d8bff',
  white: '#f2f5ff',
}

const G = 40 // px per grid unit
const PAD = 60 // room for labels around the layout
const BODY = 64 // 1.6 units
const DASH = 18 // dash period of the flow overlay; must match .cv-flow stroke-dasharray

const toPx = (p: Point) => ({ x: PAD + p.x * G, y: PAD + p.y * G })

const REDUCED = '(prefers-reduced-motion: reduce)'
function subscribeMotion(cb: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const m = window.matchMedia(REDUCED)
  m.addEventListener?.('change', cb)
  return () => m.removeEventListener?.('change', cb)
}
const getReduced = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(REDUCED).matches
function useReducedMotion() {
  return useSyncExternalStore(subscribeMotion, getReduced, () => false)
}

type Side = 'left' | 'right' | 'above' | 'below'
const NORMALS: Record<Side, Point> = { above: { x: 0, y: -1 }, below: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }

/** A part's local frame: x runs from `from` (0) to `to` (len) along the part, y is perpendicular. */
interface Frame {
  ax: number
  ay: number
  len: number
  cos: number
  sin: number
  angle: number
  mid: Point
  side: Side
  /** Local y sign that points away from the label (emission arrows, open lever, polarity marks). */
  away: 1 | -1
}

function frameOf(pl: PartLayout): Frame {
  const a = toPx(pl.from)
  const b = toPx(pl.to)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const cos = dx / len
  const sin = dy / len
  const side: Side = pl.labelSide ?? (Math.abs(dx) >= Math.abs(dy) ? 'above' : 'right')
  const n = NORMALS[side]
  // local +y in world coordinates is (-sin, cos)
  const away = -sin * n.x + cos * n.y > 0 ? -1 : 1
  return { ax: a.x, ay: a.y, len, cos, sin, angle: (Math.atan2(dy, dx) * 180) / Math.PI, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, side, away }
}

const world = (f: Frame, lx: number, ly: number): Point => ({ x: f.ax + lx * f.cos - ly * f.sin, y: f.ay + lx * f.sin + ly * f.cos })

const pts = (list: [number, number][]) => list.map(([x, y]) => `${x},${y}`).join(' ')

function arrow(x0: number, y0: number, x1: number, y1: number) {
  const a = Math.atan2(y1 - y0, x1 - x0)
  const h = 5
  const p1 = [x1 - h * Math.cos(a - 0.5), y1 - h * Math.sin(a - 0.5)]
  const p2 = [x1 - h * Math.cos(a + 0.5), y1 - h * Math.sin(a + 0.5)]
  return `M${x0} ${y0}L${x1} ${y1}M${p1[0]} ${p1[1]}L${x1} ${y1}L${p2[0]} ${p2[1]}`
}

type Tone = 'danger' | 'warn' | 'power'
interface Tag {
  text: string
  tone: Tone
}

function labelAnchor(f: Frame) {
  const off = 36
  switch (f.side) {
    case 'above':
      return { x: f.mid.x, y: f.mid.y - off, anchor: 'middle' as const, step: -22 }
    case 'below':
      return { x: f.mid.x, y: f.mid.y + off + 12, anchor: 'middle' as const, step: 22 }
    case 'left':
      return { x: f.mid.x - off, y: f.mid.y + 5, anchor: 'end' as const, step: 22 }
    case 'right':
      return { x: f.mid.x + off, y: f.mid.y + 5, anchor: 'start' as const, step: 22 }
  }
}

function TagPill({ x, y, anchor, tag }: { x: number; y: number; anchor: 'start' | 'middle' | 'end'; tag: Tag }) {
  const w = tag.text.length * 7.4 + 14
  const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2
  return (
    <g className={`cv-tag cv-tag--${tag.tone}`}>
      <rect x={left} y={y - 12} width={w} height={17} rx={8.5} />
      <text x={left + w / 2} y={y + 0.5} textAnchor="middle">
        {tag.text}
      </text>
    </g>
  )
}

const CHAR_W = 8.6 // rough label glyph width at 15px

/** Horizontal/vertical extent of a part's label and tags, so the viewBox can grow to fit them. */
function labelBox(pl: PartLayout, comp: Component) {
  const f = frameOf(pl)
  const la = labelAnchor(f)
  // Size for the widest tag the part could show, so the frame doesn't jump when it burns.
  const tagW = comp.kind === 'led' || comp.kind === 'diode' ? 132 : comp.kind === 'resistor' ? 60 : 0
  const w = Math.max(`${pl.label ?? comp.id} · ${partValue(comp)}`.length * CHAR_W, tagW)
  const x0 = la.anchor === 'start' ? la.x : la.anchor === 'end' ? la.x - w : la.x - w / 2
  const y0 = Math.min(la.y - 16, la.y + la.step * 2 - 14)
  const y1 = Math.max(la.y + 6, la.y + la.step * 2 + 6)
  return { x0, x1: x0 + w, y0, y1 }
}

interface PartProps {
  comp: Component
  pl: PartLayout
  res?: ComponentResult
  uid: string
  highlighted: boolean
  onPartClick?: (id: string) => void
}

function Part({ comp, pl, res, uid, highlighted, onPartClick }: PartProps) {
  const f = frameOf(pl)
  const L = f.len
  const c = L / 2
  const h = Math.min(BODY, L) / 2
  const s = f.away
  const status = res?.status
  const burnt = status === 'burnt'
  // [start, end] of the drawn body along the part; leads fill the rest.
  let span: [number, number] = [c - h, c + h]
  let under: ReactNode = null
  let body: ReactNode = null
  let extras: ReactNode = null
  const tags: Tag[] = []

  switch (comp.kind) {
    case 'resistor': {
      if (comp.ohms === 0) {
        span = [c, c]
        break
      }
      const step = (2 * h) / 12
      const zig: [number, number][] = [[c - h, 0]]
      for (let k = 0; k < 6; k++) zig.push([c - h + step * (2 * k + 1), k % 2 ? 9 : -9])
      zig.push([c + h, 0])
      const hot = status === 'overpower'
      if (hot) under = <polyline className="cv-hot-glow" points={pts(zig)} />
      if (burnt) under = <rect className="cv-char" x={c - h - 4} y={-14} width={2 * h + 8} height={28} rx={10} />
      body = <polyline className={`cv-sym cv-res${hot ? ' is-hot' : ''}${burnt ? ' is-burnt' : ''}`} points={pts(zig)} />
      if (hot) tags.push({ text: 'HOT', tone: 'power' })
      if (burnt) tags.push({ text: 'BURNT', tone: 'danger' })
      break
    }
    case 'vsource': {
      span = [c - 15, c + 15]
      body = (
        <g className="cv-battery">
          <line className="cv-sym" x1={c - 5} y1={0} x2={c + 5} y2={0} />
          <line className="cv-plate-pos" x1={c - 15} y1={-16} x2={c - 15} y2={16} />
          <line className="cv-plate-neg" x1={c - 5} y1={-8} x2={c - 5} y2={8} />
          <line className="cv-plate-pos" x1={c + 5} y1={-16} x2={c + 5} y2={16} />
          <line className="cv-plate-neg" x1={c + 15} y1={-8} x2={c + 15} y2={8} />
        </g>
      )
      if (burnt) tags.push({ text: 'SHORTED', tone: 'danger' })
      const plus = world(f, c - 24, s * 20)
      const minus = world(f, c + 24, s * 20)
      extras = (
        <>
          <text className="cv-pol cv-pol--pos" x={plus.x} y={plus.y + 5} textAnchor="middle">
            +
          </text>
          <text className="cv-pol cv-pol--neg" x={minus.x} y={minus.y + 5} textAnchor="middle">
            −
          </text>
        </>
      )
      break
    }
    case 'led':
    case 'diode': {
      span = [c - 12, c + 12]
      const tri = pts([
        [c - 12, -13],
        [c - 12, 13],
        [c + 12, 0],
      ])
      const crack = burnt ? <path className="cv-crack" d={`M${c - 7} ${-15}L${c - 1} ${-4}L${c - 8} ${3}L${c + 1} ${15}`} /> : null
      if (comp.kind === 'diode') {
        body = (
          <>
            <polygon className={`cv-sym cv-diode${burnt ? ' is-burnt' : ''}`} points={tri} />
            <line className={`cv-sym${burnt ? ' is-burnt' : ''}`} x1={c + 12} y1={-13} x2={c + 12} y2={13} />
            {crack}
          </>
        )
      } else {
        const color = LED_COLORS[comp.color]
        const b = burnt ? 0 : Math.max(0, Math.min(1, res?.brightness ?? 0))
        const tint = burnt ? undefined : { fill: color, fillOpacity: 0.16 + 0.7 * b, stroke: color, color }
        under = b > 0 ? <circle className="cv-led-glow" cx={c} cy={0} r={58} fill={`url(#${uid}-led-${comp.color})`} opacity={b} /> : null
        body = (
          <>
            <polygon className={`cv-sym cv-led${burnt ? ' is-burnt' : ''}${b > 0.05 ? ' is-lit' : ''}`} points={tri} style={tint} />
            <line className={`cv-sym${burnt ? ' is-burnt' : ''}`} x1={c + 12} y1={-13} x2={c + 12} y2={13} style={burnt ? undefined : { stroke: color }} />
            <path
              className={`cv-emit${burnt ? ' is-burnt' : ''}`}
              d={arrow(c - 4, s * 17, c + 4, s * 27) + arrow(c + 4, s * 15, c + 12, s * 25)}
              style={burnt ? undefined : { stroke: color, opacity: 0.35 + 0.65 * b }}
            />
            {crack}
          </>
        )
        if (burnt) {
          const puff = world(f, c, 0)
          extras = (
            <g className="cv-smoke-group" aria-hidden="true">
              <circle className="cv-smoke" cx={puff.x - 6} cy={puff.y - 20} r={5} />
              <circle className="cv-smoke cv-smoke--2" cx={puff.x + 4} cy={puff.y - 26} r={6.5} />
              <circle className="cv-smoke cv-smoke--3" cx={puff.x - 2} cy={puff.y - 34} r={4} />
            </g>
          )
        }
      }
      if (burnt) tags.push({ text: 'BURNT', tone: 'danger' })
      if (status === 'overcurrent') tags.push({ text: 'TOO MUCH CURRENT', tone: 'warn' })
      break
    }
    case 'switch': {
      span = [c - 22, c + 22]
      const tip: [number, number] = comp.closed ? [c + 22, 0] : [c - 22 + 44 * Math.cos(0.55), s * 44 * Math.sin(0.55)]
      body = (
        <>
          <line className={`cv-sym cv-lever${comp.closed ? ' is-closed' : ' is-open'}`} x1={c - 22} y1={0} x2={tip[0]} y2={tip[1]} />
          <circle className="cv-contact" cx={c - 22} cy={0} r={4} />
          <circle className="cv-contact" cx={c + 22} cy={0} r={4} />
        </>
      )
      break
    }
  }

  const la = labelAnchor(f)
  const name = pl.label ?? comp.id
  const value = partValue(comp)
  const box = { x: c - h - 12, y: -28, w: 2 * h + 24, h: 56 }
  const interactive = !!onPartClick

  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onPartClick?.(comp.id)
    }
  }

  const a11y = interactive
    ? { role: 'button', tabIndex: 0, 'aria-label': partLabel(comp, res), onClick: () => onPartClick(comp.id), onKeyDown }
    : {}

  return (
    <g className={`cv-part cv-part--${comp.kind}${interactive ? ' is-interactive' : ''}`} data-part={comp.id} {...a11y}>
      <g transform={`translate(${f.ax} ${f.ay}) rotate(${f.angle})`}>
        {highlighted && <rect className="cv-halo" x={box.x} y={box.y} width={box.w} height={box.h} rx={14} />}
        {interactive && <rect className="cv-hit" x={box.x} y={box.y} width={box.w} height={box.h} rx={14} />}
        {under}
        <line className="cv-lead" x1={0} y1={0} x2={span[0]} y2={0} />
        <line className="cv-lead" x1={span[1]} y1={0} x2={L} y2={0} />
        {span[0] === span[1] && <line className="cv-lead" x1={0} y1={0} x2={L} y2={0} />}
        {body}
        {interactive && <rect className="cv-ring" x={box.x} y={box.y} width={box.w} height={box.h} rx={14} />}
      </g>
      {extras}
      <text className="cv-label" x={la.x} y={la.y} textAnchor={la.anchor}>
        <tspan className="cv-label-id">{name}</tspan>
        <tspan className="cv-label-sep"> · </tspan>
        <tspan className="cv-label-value">{value}</tspan>
      </text>
      {tags.map((t, i) => (
        <TagPill key={t.text} x={la.x} y={la.y + la.step * (i + 1)} anchor={la.anchor} tag={t} />
      ))}
    </g>
  )
}

interface FlowInfo {
  current: number
  speed: number
}

function wireFlow(w: WireLayout, results: Record<string, ComponentResult>): FlowInfo | null {
  if (!w.carries) return null
  const r = results[w.carries.componentId]
  if (!r) return null
  const current = r.current * w.carries.sign
  const speed = flowSpeed(current)
  return speed > 0 ? { current, speed } : null
}

function Chevrons({ points, forward }: { points: Point[]; forward: boolean }) {
  const marks: ReactNode[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (len < 30) continue
    const deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + (forward ? 0 : 180)
    const n = Math.max(1, Math.floor(len / 120))
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1)
      marks.push(
        <path
          key={`${i}-${k}`}
          className="cv-chevron"
          d="M-4 -5L2 0L-4 5"
          transform={`translate(${a.x + (b.x - a.x) * t} ${a.y + (b.y - a.y) * t}) rotate(${deg})`}
        />,
      )
    }
  }
  return <>{marks}</>
}

const key = (p: Point) => `${Math.round(p.x * 100)},${Math.round(p.y * 100)}`

function onSegmentInterior(p: Point, a: Point, b: Point) {
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
  if (Math.abs(cross) > 1e-6) return false
  const dot = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)
  const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
  return dot > 1e-9 && dot < len2 - 1e-9
}

/** Grid points where 3+ wire ends / terminals meet (a wire passing through counts as 2). */
function junctions(wires: WireLayout[], parts: PartLayout[]): Point[] {
  const ends = new Map<string, { p: Point; n: number }>()
  const add = (p: Point) => {
    const k = key(p)
    const e = ends.get(k)
    if (e) e.n++
    else ends.set(k, { p, n: 1 })
  }
  for (const w of wires) {
    if (w.points.length < 2) continue
    add(w.points[0])
    add(w.points[w.points.length - 1])
  }
  for (const pl of parts) {
    add(pl.from)
    add(pl.to)
  }
  const dots: Point[] = []
  for (const { p, n } of ends.values()) {
    let count = n
    for (const w of wires) {
      for (let i = 0; i < w.points.length - 1; i++) {
        const a = w.points[i]
        const b = w.points[i + 1]
        if (onSegmentInterior(p, a, b)) count += 2
        else if (i > 0 && key(a) === key(p)) count += 2 // interior vertex
      }
    }
    if (count >= 3) dots.push(p)
  }
  return dots
}

function Probe({
  probe,
  volts,
  active,
  onActive,
  bounds,
}: {
  probe: ProbePoint
  volts?: number
  active: boolean
  onActive: (on: boolean) => void
  bounds: { x: number; y: number; w: number; h: number }
}) {
  const p = toPx(probe.at)
  const name = probe.label ?? probe.node
  const reading = volts === undefined || !Number.isFinite(volts) ? '—' : formatSI(volts, 'V')
  const text = `${name}: ${reading}`
  const tw = text.length * 8 + 20
  const tx = Math.min(Math.max(p.x - tw / 2, bounds.x + 6), bounds.x + bounds.w - tw - 6)
  const ty = p.y - 48 < bounds.y + 4 ? p.y + 20 : p.y - 48
  return (
    <g
      className={`cv-probe${active ? ' is-active' : ''}`}
      tabIndex={0}
      role="img"
      aria-label={`Probe ${text}`}
      onMouseEnter={() => onActive(true)}
      onMouseLeave={() => onActive(false)}
      onFocus={() => onActive(true)}
      onBlur={() => onActive(false)}
    >
      <circle className="cv-probe-hit" cx={p.x} cy={p.y} r={16} />
      <circle className="cv-probe-ring" cx={p.x} cy={p.y} r={7.5} />
      <circle className="cv-probe-core" cx={p.x} cy={p.y} r={2.5} />
      <text className="cv-probe-name" x={p.x + 12} y={p.y - 10}>
        {name}
      </text>
      {active && (
        <g className="cv-tip">
          <rect x={tx} y={ty} width={tw} height={26} rx={8} />
          <text x={tx + tw / 2} y={ty + 17.5} textAnchor="middle">
            {text}
          </text>
        </g>
      )}
    </g>
  )
}

export function CircuitView({ circuit, layout, result, ariaLabel, onPartClick, highlight, showFlow = true }: CircuitViewProps) {
  const uid = 'cv' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const reduced = useReducedMotion()
  const animate = showFlow && !reduced
  const [activeProbe, setActiveProbe] = useState<number | null>(null)

  const W = layout.width * G + 2 * PAD
  const H = layout.height * G + 2 * PAD
  let [x0, y0, x1, y1] = [0, 0, W, H]
  for (const pl of layout.parts) {
    const comp = circuit.components.find((c) => c.id === pl.id)
    if (!comp) continue
    const b = labelBox(pl, comp)
    x0 = Math.min(x0, b.x0 - 16)
    x1 = Math.max(x1, b.x1 + 16)
    y0 = Math.min(y0, b.y0 - 12)
    y1 = Math.max(y1, b.y1 + 12)
  }
  const box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  const comps = new Map(circuit.components.map((c) => [c.id, c]))
  const results = result.components ?? {}
  const hl = new Set(highlight ?? [])
  const toPoints = (list: Point[]) => list.map(toPx)
  const svgPoints = (list: Point[]) => toPoints(list).map((p) => `${p.x},${p.y}`).join(' ')

  const summary = [
    result.ok ? '' : `Problem: ${result.error ?? 'the circuit could not be solved'}.`,
    ...circuit.components.map((c) => partLabel(c, results[c.id]) + '.'),
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <figure className={`cv${reduced ? '' : ' cv--motion'}`} aria-label={ariaLabel}>
      <svg className="cv-svg" viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id={`${uid}-minor`} width={G} height={G} x={PAD} y={PAD} patternUnits="userSpaceOnUse">
            <path className="cv-grid-minor" d={`M${G} 0H0V${G}`} />
          </pattern>
          <pattern id={`${uid}-major`} width={G * 5} height={G * 5} x={PAD} y={PAD} patternUnits="userSpaceOnUse">
            <path className="cv-grid-major" d={`M${G * 5} 0H0V${G * 5}`} />
          </pattern>
          <radialGradient id={`${uid}-vignette`} cx="50%" cy="45%" r="75%">
            <stop offset="55%" style={{ stopColor: 'var(--bg)', stopOpacity: 0 }} />
            <stop offset="100%" style={{ stopColor: 'var(--bg)', stopOpacity: 0.7 }} />
          </radialGradient>
          {(Object.keys(LED_COLORS) as LedColor[]).map((color) => (
            <radialGradient key={color} id={`${uid}-led-${color}`}>
              <stop offset="0%" stopColor={LED_COLORS[color]} stopOpacity={0.75} />
              <stop offset="35%" stopColor={LED_COLORS[color]} stopOpacity={0.28} />
              <stop offset="100%" stopColor={LED_COLORS[color]} stopOpacity={0} />
            </radialGradient>
          ))}
        </defs>

        <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={`url(#${uid}-minor)`} />
        <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={`url(#${uid}-major)`} />
        <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={`url(#${uid}-vignette)`} />

        <g className="cv-wires">
          {layout.wires.map((w) => {
            const flow = wireFlow(w, results)
            const p = svgPoints(w.points)
            return (
              <g key={w.id} data-wire={w.id}>
                <polyline className="cv-wire" points={p} />
                {flow && <polyline className="cv-live" points={p} />}
                {flow && animate && (
                  <polyline
                    className="cv-flow"
                    points={p}
                    data-flow-duration={(DASH / flow.speed).toFixed(4)}
                    style={{
                      animationDuration: `${(DASH / flow.speed).toFixed(4)}s`,
                      animationDirection: flow.current > 0 ? 'normal' : 'reverse',
                    }}
                  />
                )}
                {flow && !animate && <Chevrons points={toPoints(w.points)} forward={flow.current > 0} />}
              </g>
            )
          })}
        </g>

        <g className="cv-parts">
          {layout.parts.map((pl) => {
            const comp = comps.get(pl.id)
            if (!comp) return null
            return <Part key={pl.id} comp={comp} pl={pl} res={results[pl.id]} uid={uid} highlighted={hl.has(pl.id)} onPartClick={onPartClick} />
          })}
        </g>

        <g className="cv-dots">
          {junctions(layout.wires, layout.parts).map((p) => {
            const q = toPx(p)
            return <circle key={key(p)} className="cv-dot" cx={q.x} cy={q.y} r={4.5} />
          })}
        </g>

        {!result.ok && (
          <TagPill x={box.x + 14} y={box.y + 26} anchor="start" tag={{ text: (result.error ?? 'Cannot solve this circuit').toUpperCase(), tone: 'danger' }} />
        )}

        <g className="cv-probes">
          {(layout.probes ?? []).map((pr, i) => (
            <Probe
              key={`${pr.node}-${i}`}
              probe={pr}
              volts={result.nodeVoltages?.[pr.node]}
              active={activeProbe === i}
              onActive={(on) => setActiveProbe((cur) => (on ? i : cur === i ? null : cur))}
              bounds={box}
            />
          ))}
        </g>
      </svg>
      <p className="cv-sr">{summary}</p>
    </figure>
  )
}

