import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { LedColor } from '../sim/types'
import { formatSI } from '../ui/format'
import { LED_COLORS } from './describe'
import { placeLabels, type Box } from './place'
import type { BreadboardLayout, BreadboardPart, BreadboardViewProps, Hole, Point } from './types'
import './BreadboardView.css'

/* ------------------------------------------------------------------ hole grammar */

export const BOARD_COLUMNS = 30
export const STRIP_ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as const
export type StripRow = (typeof STRIP_ROWS)[number]
export type Rail = 'T+' | 'T-' | 'B+' | 'B-'
export const UNO_PINS = ['5V', '3V3', 'GND', 'VIN', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'] as const
export type UnoPin = (typeof UNO_PINS)[number]

export type ParsedHole =
  | { kind: 'strip'; row: StripRow; col: number }
  | { kind: 'rail'; rail: Rail; col: number }
  | { kind: 'uno'; pin: UnoPin }
  | { kind: 'battery'; terminal: '+' | '-' }

const COL = '([1-9]|[12][0-9]|30)'
const STRIP_RE = new RegExp(`^([a-j])${COL}$`)
const RAIL_RE = new RegExp(`^([TB][+-])${COL}$`)

/** Parses a Hole ('a1'…'j30', 'T+1', 'B-30', 'uno:5V', 'bat:+'). Throws on anything else. */
export function parseHole(h: Hole): ParsedHole {
  let m = STRIP_RE.exec(h)
  if (m) return { kind: 'strip', row: m[1] as StripRow, col: Number(m[2]) }
  m = RAIL_RE.exec(h)
  if (m) return { kind: 'rail', rail: m[1] as Rail, col: Number(m[2]) }
  if (h.startsWith('uno:') && (UNO_PINS as readonly string[]).includes(h.slice(4))) return { kind: 'uno', pin: h.slice(4) as UnoPin }
  if (h === 'bat:+' || h === 'bat:-') return { kind: 'battery', terminal: h === 'bat:+' ? '+' : '-' }
  throw new Error(`Invalid breadboard hole "${h}"`)
}

/* ------------------------------------------------------------------ geometry */

/** ViewBox units per 0.1" hole pitch. */
export const PITCH = 20
const P = PITCH

/** Board left edge; the supply sits in the 11.2-pitch strip to its left. */
const BX = 11.2 * P
const BOARD_W = 33 * P
const BOARD_H = 20.8 * P
const THICK = 0.35 * P
const colX = (c: number) => BX + 2 * P + (c - 1) * P
const ROW_Y = Object.fromEntries(STRIP_ROWS.map((r, i) => [r, (i < 5 ? 4.9 + i : 6.9 + i) * P])) as Record<StripRow, number>
const RAIL_Y: Record<Rail, number> = { 'T+': 1.4 * P, 'T-': 2.4 * P, 'B-': 18.4 * P, 'B+': 19.4 * P }

// Uno header strip: two socket columns, digital on the left, power and analog nearest the board.
const UNO = { x: 0, y: 2.8 * P, w: 8.8 * P, h: 15.2 * P }
const UNO_COL1 = UNO.x + 3 * P
const UNO_COL2 = UNO.x + 7.6 * P
const unoRowY = (i: number) => UNO.y + 3 * P + i * P
const UNO_SOCKETS = Object.fromEntries([
  ...Array.from({ length: 12 }, (_, i) => [`D${13 - i}`, { x: UNO_COL1, y: unoRowY(i) }]),
  ...['3V3', '5V', 'GND', 'VIN'].map((pin, i) => [pin, { x: UNO_COL2, y: unoRowY(i) }]),
  ...Array.from({ length: 6 }, (_, i) => [`A${i}`, { x: UNO_COL2, y: unoRowY(i + 5) }]),
]) as Record<UnoPin, Point>

const BAT = { x: 1.2 * P, y: 6.6 * P, w: 5.6 * P, h: 10.6 * P }
const BAT_TERMINALS: Record<'+' | '-', Point> = { '+': { x: 9.2 * P, y: 4.4 * P }, '-': { x: 9.2 * P, y: 5.6 * P } }

/** Centre of a hole (or off-board pin) in viewBox units. Throws on an invalid hole. */
export function holePosition(h: Hole): Point {
  const p = parseHole(h)
  switch (p.kind) {
    case 'strip':
      return { x: colX(p.col), y: ROW_Y[p.row] }
    case 'rail':
      return { x: colX(p.col), y: RAIL_Y[p.rail] }
    case 'uno':
      return UNO_SOCKETS[p.pin]
    case 'battery':
      return BAT_TERMINALS[p.terminal]
  }
}

/** The holes joined to this one inside the board, as one box: its 5-hole strip or its whole rail. */
function connectedBox(p: ParsedHole): Box | null {
  const r = 0.46 * P
  if (p.kind === 'strip') {
    const [top, bottom] = STRIP_ROWS.indexOf(p.row) < 5 ? ['a', 'e'] : ['f', 'j']
    return { x0: colX(p.col) - r, x1: colX(p.col) + r, y0: ROW_Y[top as StripRow] - r, y1: ROW_Y[bottom as StripRow] + r }
  }
  if (p.kind === 'rail') return { x0: colX(1) - r, x1: colX(BOARD_COLUMNS) + r, y0: RAIL_Y[p.rail] - r, y1: RAIL_Y[p.rail] + r }
  return null
}

/** "a5", "top + rail 3", "Uno 5V", "battery +". */
export function holeLabel(h: Hole): string {
  const p = parseHole(h)
  switch (p.kind) {
    case 'strip':
      return h
    case 'rail':
      return `${p.rail[0] === 'T' ? 'top' : 'bottom'} ${p.rail[1] === '+' ? '+' : '−'} rail ${p.col}`
    case 'uno':
      return `Uno ${p.pin}`
    case 'battery':
      return `battery ${p.terminal === '+' ? '+' : '−'}`
  }
}

/* ------------------------------------------------------------------ resistor colour code */

export type BandColor = 'black' | 'brown' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet' | 'grey' | 'white' | 'gold' | 'silver'
const DIGITS: BandColor[] = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white']

/**
 * 4-band colour code: two digits, multiplier, ±5 % gold tolerance (rounded to two significant
 * figures, as 4-band parts are). A 0 Ω link is a single black band.
 */
export function resistorBands(ohms: number): BandColor[] {
  if (ohms === 0) return ['black']
  if (!Number.isFinite(ohms) || ohms < 0.1 || ohms >= 1e11) throw new RangeError(`No 4-band colour code for ${ohms} Ω`)
  let exp = Math.floor(Math.log10(ohms)) - 1
  let digits = Math.round(ohms / 10 ** exp)
  if (digits >= 100) {
    digits = Math.round(digits / 10)
    exp++
  }
  const multiplier: BandColor = exp === -2 ? 'silver' : exp === -1 ? 'gold' : DIGITS[exp]
  return [DIGITS[Math.floor(digits / 10)], DIGITS[digits % 10], multiplier, 'gold']
}

// Physical colours: these depict real parts, so they don't come from the theme tokens.
const BAND_HEX: Record<BandColor, string> = {
  black: '#1d1d1f',
  brown: '#7a4321',
  red: '#d22b2b',
  orange: '#ee7a1f',
  yellow: '#f2cf1d',
  green: '#2e9d4a',
  blue: '#2a62d1',
  violet: '#8a4fd0',
  grey: '#8b8b8b',
  white: '#f5f5f5',
  gold: '#c9a13b',
  silver: '#c3c8ce',
}

type WireColor = Extract<BreadboardPart, { kind: 'wire' }>['color']
const WIRE_HEX: Record<WireColor, [core: string, casing: string]> = {
  red: ['#e5383b', '#9c1c22'],
  black: ['#34363b', '#0d0e10'],
  yellow: ['#f5c533', '#a87e0c'],
  blue: ['#3474e8', '#173f91'],
  green: ['#2fae55', '#17672f'],
  orange: ['#f58b25', '#a8520b'],
  white: ['#f1f2f4', '#9aa0a8'],
}

/* ------------------------------------------------------------------ validation */

const holesOf = (p: BreadboardPart): Hole[] => (p.kind === 'led' || p.kind === 'diode' ? [p.anode, p.cathode] : [p.from, p.to])

/**
 * Wiring mistakes in a layout: unknown holes, an off-board pin the chosen supply doesn't have,
 * two legs in one hole, or a resistance with no colour code. Empty when the layout is buildable.
 */
export function layoutProblems(layout: BreadboardLayout): string[] {
  const problems: string[] = []
  const used = new Map<Hole, string>()
  for (const part of layout.parts) {
    for (const h of holesOf(part)) {
      let p: ParsedHole
      try {
        p = parseHole(h)
      } catch (e) {
        problems.push(`${part.id}: ${(e as Error).message}`)
        continue
      }
      if (p.kind === 'uno' && layout.supply !== 'uno') problems.push(`${part.id}: ${h} needs the Uno supply`)
      if (p.kind === 'battery' && layout.supply !== 'battery9v') problems.push(`${part.id}: ${h} needs the 9 V battery supply`)
      const other = used.get(h)
      if (other) problems.push(`${part.id}: ${h} is already used by ${other}`)
      else used.set(h, part.id)
    }
    if (part.kind === 'resistor') {
      try {
        resistorBands(part.ohms)
      } catch (e) {
        problems.push(`${part.id}: ${(e as Error).message}`)
      }
    }
  }
  return problems
}

/* ------------------------------------------------------------------ text sizing */

const FS = 11 // base text size, viewBox units
export const MIN_TEXT_PX = 10
/** Largest text size (viewBox units) counter-scaling may reach; below the width that needs more, the drawing scrolls. */
const MAX_FS = 16.5
/** Narrowest the drawing may render before it scrolls sideways (text would drop below 10 px). */
const minWidthFor = (vbW: number) => Math.ceil((vbW * MIN_TEXT_PX) / MAX_FS)

/** Text size in viewBox units: `base`, enlarged so it renders at ≥ MIN_TEXT_PX at `scale` (rendered px per unit). */
type TextSize = (base: number) => number
const textSizer = (scale: number): TextSize => (base) => (scale > 0 ? Math.max(base, MIN_TEXT_PX / scale) : base)

function useWidth<T extends Element>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    setWidth(Math.round(el.getBoundingClientRect().width))
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/* ------------------------------------------------------------------ parts */

interface Drawn {
  part: BreadboardPart
  ends: Point[]
  box: Box
  /** Where the tooltip points (top-centre of the part, or the wire's apex). */
  tip: Point
  aria: string
  title: string
  detail: string
  groups: Box[]
}

const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const boxOf = (pts: Point[], pad = 0): Box => ({
  x0: Math.min(...pts.map((p) => p.x)) - pad,
  y0: Math.min(...pts.map((p) => p.y)) - pad,
  x1: Math.max(...pts.map((p) => p.x)) + pad,
  y1: Math.max(...pts.map((p) => p.y)) + pad,
})

/** Control point of a wire's arc: it bows up (or left, when vertical), more for longer runs. */
function wireControl(a: Point, b: Point): Point {
  const d = dist(a, b) || 1
  let nx = (b.y - a.y) / d
  let ny = -(b.x - a.x) / d
  if (ny > 0 || (ny === 0 && nx > 0)) {
    nx = -nx
    ny = -ny
  }
  const bow = clamp(0.22 * d, 0.5 * P, 3.2 * P)
  return { x: (a.x + b.x) / 2 + nx * bow, y: (a.y + b.y) / 2 + ny * bow }
}

/** LED geometry: it stands up out of the board, lens above its two legs. */
function ledGeometry(anode: Point, cathode: Point) {
  const cx = (anode.x + cathode.x) / 2
  const base = Math.min(anode.y, cathode.y) - 0.8 * P
  const cathodeRight = cathode.x >= anode.x
  return { cx, base, sA: cathodeRight ? -1 : 1, sC: cathodeRight ? 1 : -1, r: 0.9 * P, h: 2.1 * P }
}

function describePart(part: BreadboardPart): Drawn {
  const holes = holesOf(part)
  const ends = holes.map(holePosition)
  const [a, b] = ends
  const groups = holes.map((h) => connectedBox(parseHole(h))).filter((g): g is Box => g !== null)
  const [ha, hb] = holes.map(holeLabel)
  switch (part.kind) {
    case 'resistor': {
      const value = formatSI(part.ohms, 'Ω')
      const box = boxOf(ends, 0.6 * P)
      return { part, ends, box, tip: { x: (box.x0 + box.x1) / 2, y: box.y0 }, groups, aria: `Resistor ${part.id}, ${value}, from ${ha} to ${hb}`, title: `${part.id} · ${value}`, detail: `${ha} → ${hb}` }
    }
    case 'diode': {
      const box = boxOf(ends, 0.6 * P)
      return { part, ends, box, tip: { x: (box.x0 + box.x1) / 2, y: box.y0 }, groups, aria: `Diode ${part.id}, anode in ${ha}, cathode (banded end) in ${hb}`, title: `${part.id} · diode`, detail: `anode ${ha} · band ${hb}` }
    }
    case 'led': {
      const g = ledGeometry(a, b)
      const box = boxOf([...ends, { x: g.cx - 1.2 * P, y: g.base - g.h }, { x: g.cx + 1.2 * P, y: g.base }], 0.3 * P)
      return { part, ends, box, tip: { x: g.cx, y: box.y0 }, groups, aria: `LED ${part.id} (${part.color}), anode (long leg) in ${ha}, cathode (flat side) in ${hb}`, title: `${part.id} · ${part.color} LED`, detail: `+ ${ha} · − ${hb}` }
    }
    case 'wire': {
      const c = wireControl(a, b)
      const apex = { x: 0.25 * a.x + 0.5 * c.x + 0.25 * b.x, y: 0.25 * a.y + 0.5 * c.y + 0.25 * b.y }
      return { part, ends, box: boxOf([a, b, apex], 0.4 * P), tip: apex, groups, aria: `${part.color[0].toUpperCase()}${part.color.slice(1)} wire ${part.id}, from ${ha} to ${hb}`, title: `${part.id} · ${part.color} wire`, detail: `${ha} → ${hb}` }
    }
  }
}

/** Where a leg goes into its hole: a tinned lead end with a dark socket ring. */
const LegEnd = ({ p }: { p: Point }) => (
  <g className="bb-legend">
    <circle cx={p.x} cy={p.y} r={3.4} className="bb-legend-ring" />
    <circle cx={p.x} cy={p.y} r={2.2} className="bb-legend-tip" />
  </g>
)

/** Lead from `from` to `to` in the part's local frame: a metal wire with a dark edge. */
const Lead = ({ d }: { d: string }) => (
  <>
    <path className="bb-lead-edge" d={d} />
    <path className="bb-lead" d={d} />
  </>
)

function Axial({ a, b, kind, bands, uid }: { a: Point; b: Point; kind: 'resistor' | 'diode'; bands: BandColor[]; uid: string }) {
  const d = dist(a, b)
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
  const len = kind === 'resistor' ? clamp(d - 0.9 * P, 1.2 * P, 2.6 * P) : clamp(d - 0.9 * P, 1.2 * P, 2.2 * P)
  const x0 = (d - len) / 2
  const x1 = x0 + len
  let shapes: ReactNode
  if (kind === 'resistor') {
    // Dog-bone body: two bulged caps joined by a slimmer middle.
    const r = 0.46 * P
    const n = 0.36 * P
    const cap = len * 0.27
    const body = (cls: string, fill?: string) => (
      <g className={cls} fill={fill}>
        <rect x={x0} y={-r} width={cap} height={2 * r} rx={r * 0.75} />
        <rect x={x1 - cap} y={-r} width={cap} height={2 * r} rx={r * 0.75} />
        <rect x={x0 + cap * 0.6} y={-n} width={len - cap * 1.2} height={2 * n} />
      </g>
    )
    const bandX = bands.length === 1 ? [0.5] : [0.2, 0.36, 0.5, 0.8]
    shapes = (
      <>
        <rect className="bb-shadow" x={x0 + 2} y={-r + 4} width={len} height={2 * r} rx={r} filter={`url(#${uid}-blur)`} />
        {body('bb-res-body')}
        {bands.map((band, i) => {
          const cx = x0 + bandX[i] * len
          const onCap = cx < x0 + cap || cx > x1 - cap
          const hh = (onCap ? r : n) - 0.4
          return <rect key={i} className={`bb-band bb-band--${band}`} x={cx - len * 0.045} y={-hh} width={len * 0.09} height={2 * hh} fill={BAND_HEX[band]} />
        })}
        {body('bb-shade', `url(#${uid}-shade)`)}
      </>
    )
  } else {
    const r = 0.38 * P
    shapes = (
      <>
        <rect className="bb-shadow" x={x0 + 2} y={-r + 4} width={len} height={2 * r} rx={r} filter={`url(#${uid}-blur)`} />
        <rect className="bb-diode-body" x={x0} y={-r} width={len} height={2 * r} rx={r * 0.55} />
        <rect className="bb-diode-band" x={x1 - len * 0.26} y={-r} width={len * 0.12} height={2 * r} />
        <rect x={x0} y={-r} width={len} height={2 * r} rx={r * 0.55} fill={`url(#${uid}-shade)`} />
      </>
    )
  }
  return (
    <>
      <g transform={`translate(${a.x} ${a.y}) rotate(${angle})`}>
        <Lead d={`M0 0H${x0 + 2}M${x1 - 2} 0H${d}`} />
        {shapes}
      </g>
    </>
  )
}

function Led({ anode, cathode, color, uid }: { anode: Point; cathode: Point; color: LedColor; uid: string }) {
  const { cx, base, sA, sC, r, h } = ledGeometry(anode, cathode)
  const top = base - h
  const foot = base + 0.3 * P
  const fa = { x: cx + sA * 0.42 * P, y: foot }
  const fc = { x: cx + sC * 0.42 * P, y: foot }
  // The anode leg is the long one: drawn with a joggle, as on a real 5 mm LED.
  const kneeY = Math.min(fa.y + 0.45 * P, anode.y - 0.2 * P)
  const anodeLeg = `M${fa.x} ${fa.y}V${kneeY}L${fa.x + sA * 0.32 * P} ${kneeY + 0.28 * P}L${anode.x} ${anode.y}`
  const cathodeLeg = `M${fc.x} ${fc.y}L${cathode.x} ${cathode.y}`
  const dome = `M${cx - r} ${base}V${top + r}A${r} ${r} 0 0 1 ${cx + r} ${top + r}V${base}Z`
  // The flange is flat on the cathode side.
  const flangeL = cx + (sC < 0 ? -r : -1.18 * P)
  const flangeR = cx + (sC > 0 ? r : 1.18 * P)
  return (
    <>
      <ellipse className="bb-shadow" cx={cx + 0.55 * P} cy={base + 0.35 * P} rx={1.15 * P} ry={0.38 * P} filter={`url(#${uid}-blur)`} />
      <Lead d={cathodeLeg} />
      <Lead d={anodeLeg} />
      <g className="bb-lens" style={{ color: LED_COLORS[color] }}>
        <path d={dome} fill={`url(#${uid}-lens-${color})`} className="bb-lens-body" />
        {/* The lead frame seen through the lens: a small post (anode) and the larger anvil (cathode). */}
        <rect className="bb-frame" x={cx + sA * 0.34 * P - 0.08 * P} y={base - 0.95 * P} width={0.16 * P} height={0.9 * P} />
        <path className="bb-frame" d={`M${cx + sC * 0.06 * P} ${base - 0.05 * P}V${base - 0.85 * P}L${cx + sC * 0.48 * P} ${base - 1.05 * P}V${base - 0.05 * P}Z`} />
        <path className="bb-bond" d={`M${cx + sA * 0.34 * P} ${base - 0.95 * P}Q${cx} ${base - 1.6 * P} ${cx + sC * 0.22 * P} ${base - 1.0 * P}`} />
        <ellipse className="bb-glare" cx={cx - 0.42 * P} cy={top + r * 0.95} rx={0.17 * P} ry={0.62 * P} />
        <ellipse className="bb-glare bb-glare--soft" cx={cx + 0.45 * P} cy={top + r * 1.2} rx={0.08 * P} ry={0.35 * P} />
        <rect className="bb-flange" x={flangeL} y={base - 0.08 * P} width={flangeR - flangeL} height={0.34 * P} rx={2} fill={`url(#${uid}-lens-${color})`} />
      </g>
    </>
  )
}

function Wire({ a, b, color, uid }: { a: Point; b: Point; color: WireColor; uid: string }) {
  const c = wireControl(a, b)
  const d = `M${a.x} ${a.y}Q${c.x} ${c.y} ${b.x} ${b.y}`
  const [core, casing] = WIRE_HEX[color]
  return (
    <>
      <path className="bb-wire-shadow" d={d} transform="translate(2 4)" filter={`url(#${uid}-blur)`} />
      <path className="bb-wire" d={d} stroke={casing} strokeWidth={6.4} />
      <path className="bb-wire" d={d} stroke={core} strokeWidth={4.6} />
      <path className="bb-wire-shine" d={d} transform="translate(-0.7 -1)" />
    </>
  )
}

/* ------------------------------------------------------------------ board and supplies */

function holeSquares(points: Point[], s: number, dy = 0) {
  return points.map((p) => `M${p.x - s / 2} ${p.y - s / 2 + dy}h${s}v${s}h${-s}Z`).join('')
}

function Board({ ts, usedCols }: { ts: TextSize; usedCols: Set<number> }) {
  const cols = Array.from({ length: BOARD_COLUMNS }, (_, i) => i + 1)
  const holes: Point[] = []
  for (const c of cols) {
    for (const r of STRIP_ROWS) holes.push({ x: colX(c), y: ROW_Y[r] })
    for (const rail of Object.keys(RAIL_Y) as Rail[]) holes.push({ x: colX(c), y: RAIL_Y[rail] })
  }
  const fs = ts(FS)
  const numbered = cols.filter((c) => c === 1 || c % 5 === 0 || usedCols.has(c))
  const lineX0 = colX(1) - 0.6 * P
  const lineX1 = colX(BOARD_COLUMNS) + 0.6 * P
  const railLines: [number, 'pos' | 'neg'][] = [
    [0.7 * P, 'pos'],
    [3.1 * P, 'neg'],
    [17.7 * P, 'neg'],
    [20.1 * P, 'pos'],
  ]
  const leftX = BX + 0.95 * P
  const rightX = BX + BOARD_W - 0.95 * P
  return (
    <g className="bb-board" aria-hidden="true">
      <rect className="bb-board-shadow" x={BX + 4} y={10} width={BOARD_W} height={BOARD_H + THICK} rx={12} />
      <rect className="bb-board-edge" x={BX} y={0} width={BOARD_W} height={BOARD_H + THICK} rx={11} />
      <rect className="bb-board-face" x={BX} y={0} width={BOARD_W} height={BOARD_H} rx={11} />
      <rect className="bb-board-gloss" x={BX + 2} y={1.5} width={BOARD_W - 4} height={BOARD_H * 0.5} rx={10} />
      {/* The centre channel that splits a–e from f–j. */}
      <rect className="bb-channel" x={BX + 1.4 * P} y={10.4 * P - 0.42 * P} width={BOARD_W - 2.8 * P} height={0.84 * P} rx={0.42 * P} />
      {railLines.map(([y, pol]) => (
        <line key={y} className={`bb-rail-line bb-rail-line--${pol}`} x1={lineX0} x2={lineX1} y1={y} y2={y} />
      ))}
      <path className="bb-hole-lip" d={holeSquares(holes, 0.44 * P, 0.9)} />
      <path className="bb-hole" d={holeSquares(holes, 0.44 * P)} />
      <g className="bb-print" style={{ fontSize: fs }}>
        {(Object.entries(RAIL_Y) as [Rail, number][]).map(([rail, y]) =>
          [leftX, rightX].map((x) => (
            <text key={rail + x} x={x} y={y} className={`bb-rail-sign bb-rail-sign--${rail[1] === '+' ? 'pos' : 'neg'}`} style={{ fontSize: ts(FS * 1.35) }}>
              {rail[1] === '+' ? '+' : '−'}
            </text>
          )),
        )}
        {STRIP_ROWS.map((r) =>
          [leftX, rightX].map((x) => (
            <text key={r + x} x={x} y={ROW_Y[r]}>
              {r}
            </text>
          )),
        )}
        {numbered.map((c) =>
          [4.0 * P, 16.85 * P].map((y) => (
            <text key={`${c}-${y}`} x={colX(c)} y={y} className={`bb-colnum${usedCols.has(c) ? ' is-used' : ''}`}>
              {c}
            </text>
          )),
        )}
      </g>
    </g>
  )
}

function UnoStrip({ ts, uid }: { ts: TextSize; uid: string }) {
  const fs = ts(FS)
  const pins = Object.entries(UNO_SOCKETS) as [UnoPin, Point][]
  const header = (x: number, from: number, to: number) => (
    <rect className="bb-header" x={x - 0.5 * P} y={unoRowY(from) - 0.5 * P} width={P} height={(to - from + 1) * P} rx={2} />
  )
  return (
    <g className="bb-uno" aria-hidden="true">
      <rect className="bb-board-shadow" x={UNO.x + 4} y={UNO.y + 10} width={UNO.w} height={UNO.h} rx={10} />
      {/* USB and DC jacks peeking over the top edge. */}
      <rect className="bb-usb" x={UNO.x + 0.7 * P} y={UNO.y - 0.9 * P} width={2.6 * P} height={2.4 * P} rx={3} fill={`url(#${uid}-metal)`} />
      <rect className="bb-dcjack" x={UNO.x + 5.2 * P} y={UNO.y - 0.6 * P} width={2.6 * P} height={2.1 * P} rx={3} />
      <rect className="bb-pcb" x={UNO.x} y={UNO.y} width={UNO.w} height={UNO.h} rx={9} />
      <rect className="bb-pcb-gloss" x={UNO.x + 1.5} y={UNO.y + 1.5} width={UNO.w - 3} height={UNO.h * 0.4} rx={8} />
      <rect className="bb-usb" x={UNO.x + 0.7 * P} y={UNO.y - 0.9 * P} width={2.6 * P} height={1.2 * P} rx={3} fill={`url(#${uid}-metal)`} />
      <circle className="bb-mount" cx={UNO_COL2} cy={unoRowY(11) + 0.1 * P} r={0.42 * P} />
      {header(UNO_COL1, 0, 11)}
      {header(UNO_COL2, 0, 3)}
      {header(UNO_COL2, 5, 10)}
      <path className="bb-socket" d={holeSquares(pins.map(([, p]) => p), 0.42 * P)} />
      <g className="bb-silk" style={{ fontSize: fs }}>
        {pins.map(([pin, p]) => (
          <text key={pin} x={p.x - 0.72 * P} y={p.y} textAnchor="end">
            {pin}
          </text>
        ))}
        <g className="bb-silk-group" style={{ fontSize: ts(FS * 0.82) }}>
          <text x={UNO.x + 0.35 * P} y={UNO.y + 1.95 * P} textAnchor="start">
            DIGITAL
          </text>
          <text x={UNO_COL2 + 0.5 * P} y={UNO.y + 1.95 * P} textAnchor="end">
            POWER
          </text>
          <text x={UNO_COL2 + 0.5 * P} y={unoRowY(4)} textAnchor="end">
            ANALOG
          </text>
        </g>
      </g>
    </g>
  )
}

function Battery({ ts, uid }: { ts: TextSize; uid: string }) {
  const { x, y, w, h } = BAT
  const capTop = y - 1.3 * P
  const plusX = x + 2 * P
  const minusX = x + 4 * P
  const leadPos = `M${plusX} ${capTop + 4}C${plusX} ${BAT_TERMINALS['+'].y} ${plusX + 1.4 * P} ${BAT_TERMINALS['+'].y} ${BAT_TERMINALS['+'].x} ${BAT_TERMINALS['+'].y}`
  const leadNeg = `M${minusX} ${capTop + 4}C${minusX} ${BAT_TERMINALS['-'].y} ${minusX + 1.4 * P} ${BAT_TERMINALS['-'].y} ${BAT_TERMINALS['-'].x} ${BAT_TERMINALS['-'].y}`
  return (
    <g className="bb-battery" aria-hidden="true">
      <rect className="bb-board-shadow" x={x + 5} y={y + 10} width={w} height={h} rx={8} />
      <rect className="bb-bat-body" x={x} y={y} width={w} height={h} rx={7} fill={`url(#${uid}-bat)`} />
      <rect className="bb-bat-band" x={x} y={y + 0.9 * P} width={w} height={h * 0.36} />
      <rect x={x} y={y} width={w} height={h} rx={7} fill={`url(#${uid}-cyl)`} />
      <text className="bb-bat-volts" x={x + w / 2} y={y + 0.9 * P + h * 0.18} style={{ fontSize: FS * 2.4 }}>
        9V
      </text>
      <text className="bb-bat-sign" x={x + 1.05 * P} y={y + 0.55 * P} style={{ fontSize: ts(FS) }}>
        +
      </text>
      <text className="bb-bat-sign" x={x + w - 1.05 * P} y={y + 0.55 * P} style={{ fontSize: ts(FS) }}>
        −
      </text>
      <text className="bb-bat-type" x={x + w / 2} y={y + h - 1.2 * P} style={{ fontSize: ts(FS * 0.85) }}>
        ALKALINE
      </text>
      {/* Snap clip with its two leads. */}
      <path className="bb-bat-lead-edge" d={leadNeg} />
      <path className="bb-bat-lead bb-bat-lead--neg" d={leadNeg} />
      <path className="bb-bat-lead-edge" d={leadPos} />
      <path className="bb-bat-lead bb-bat-lead--pos" d={leadPos} />
      <rect className="bb-snap" x={x + 0.5 * P} y={capTop} width={w - 1 * P} height={1.8 * P} rx={6} />
      <rect className="bb-snap-gloss" x={x + 0.8 * P} y={capTop + 2} width={w - 1.6 * P} height={0.5 * P} rx={3} />
    </g>
  )
}

/* ------------------------------------------------------------------ view */

const STATIC_BOX: Box = { x0: -0.8 * P, y0: -0.8 * P, x1: BX + BOARD_W + 0.8 * P, y1: BOARD_H + THICK + 0.9 * P }
// Wires go over parts (as on a real bench, and so a tall LED never hides where a jumper lands).
const DRAW_ORDER: Record<BreadboardPart['kind'], number> = { resistor: 0, diode: 0, led: 1, wire: 2 }

export function BreadboardView({ layout, ariaLabel, highlight }: BreadboardViewProps) {
  const uid = 'bb' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const [wrapRef, widthPx] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<string | null>(null)
  const hl = new Set(highlight ?? [])

  const { drawn, problems } = useMemo(() => {
    const problems = layoutProblems(layout)
    const broken = new Set(problems.map((p) => p.slice(0, p.indexOf(':'))))
    const drawn = layout.parts.filter((p) => !broken.has(p.id)).map(describePart)
    return { drawn, problems }
  }, [layout])

  useEffect(() => {
    if (problems.length) console.error(`BreadboardView: skipped parts with wiring problems:\n${problems.join('\n')}`)
  }, [problems])

  const vb = useMemo(() => {
    const b = { ...STATIC_BOX }
    for (const d of drawn) {
      b.x0 = Math.min(b.x0, d.box.x0 - 0.4 * P)
      b.y0 = Math.min(b.y0, d.box.y0 - 1.6 * P)
      b.x1 = Math.max(b.x1, d.box.x1 + 0.4 * P)
      b.y1 = Math.max(b.y1, d.box.y1 + 0.4 * P)
    }
    return { x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 }
  }, [drawn])

  const minWidth = minWidthFor(vb.w)
  const scale = widthPx > 0 ? Math.max(widthPx, minWidth) / vb.w : 0
  const ts = textSizer(scale)
  const narrow = widthPx > 0 && widthPx < minWidth

  const usedCols = new Set<number>()
  for (const d of drawn)
    for (const h of holesOf(d.part)) {
      const p = parseHole(h)
      if (p.kind === 'strip') usedCols.add(p.col)
    }

  // Part ids sit beside components (not wires), clear of every other part.
  const idTags = useMemo(() => {
    const comps = drawn.filter((d) => d.part.kind !== 'wire')
    const fs = ts(FS)
    const tagBox = (cx: number, cy: number, id: string): Box => {
      const w = id.length * fs * 0.62 + fs * 0.9
      return { x0: cx - w / 2, x1: cx + w / 2, y0: cy - fs * 0.8, y1: cy + fs * 0.8 }
    }
    const candidates = comps.map((d) => {
      const { x0, y0, x1, y1 } = d.box
      const mx = (x0 + x1) / 2
      const my = (y0 + y1) / 2
      const id = d.part.id
      const gap = fs
      const w = id.length * fs * 0.62 + fs * 0.9
      const above = y0 - gap * 0.4
      const below = y1 + gap * 0.4
      return [
        tagBox(mx, above, id),
        tagBox(mx, below, id),
        ...[-w, w].flatMap((dx) => [tagBox(mx + dx, above, id), tagBox(mx + dx, below, id)]),
        tagBox(x1 + w / 2 + 3, my, id),
        tagBox(x0 - w / 2 - 3, my, id),
      ]
    })
    const chosen = placeLabels(candidates, comps.map((d) => d.box))
    return comps.map((d, i) => ({ id: d.part.id, box: candidates[i][chosen[i]] }))
  }, [drawn, scale])

  const ordered = [...drawn].sort((x, y) => DRAW_ORDER[x.part.kind] - DRAW_ORDER[y.part.kind])
  const activeDrawn = drawn.find((d) => d.part.id === active)

  return (
    <figure className="bb" aria-label={ariaLabel}>
      <div className="bb-scroll" ref={wrapRef}>
        <svg className="bb-svg" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} style={{ minWidth }} preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id={`${uid}-blur`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation={1.8} />
            </filter>
            <linearGradient id={`${uid}-shade`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity={0.55} />
              <stop offset="0.3" stopColor="#fff" stopOpacity={0.08} />
              <stop offset="0.6" stopColor="#000" stopOpacity={0} />
              <stop offset="1" stopColor="#000" stopOpacity={0.38} />
            </linearGradient>
            <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#8d949c" />
              <stop offset="0.35" stopColor="#e3e7ec" />
              <stop offset="1" stopColor="#7d838b" />
            </linearGradient>
            <linearGradient id={`${uid}-bat`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2a2c31" />
              <stop offset="1" stopColor="#17181b" />
            </linearGradient>
            <linearGradient id={`${uid}-cyl`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#000" stopOpacity={0.35} />
              <stop offset="0.25" stopColor="#fff" stopOpacity={0.14} />
              <stop offset="0.5" stopColor="#fff" stopOpacity={0} />
              <stop offset="1" stopColor="#000" stopOpacity={0.4} />
            </linearGradient>
            {(Object.keys(LED_COLORS) as LedColor[]).map((c) => (
              <linearGradient key={c} id={`${uid}-lens-${c}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" style={{ stopColor: `color-mix(in srgb, ${LED_COLORS[c]} 55%, white)` }} />
                <stop offset="0.45" stopColor={LED_COLORS[c]} />
                <stop offset="1" style={{ stopColor: `color-mix(in srgb, ${LED_COLORS[c]} 55%, black)` }} />
              </linearGradient>
            ))}
          </defs>

          {layout.supply === 'uno' ? <UnoStrip ts={ts} uid={uid} /> : <Battery ts={ts} uid={uid} />}
          <Board ts={ts} usedCols={usedCols} />

          {activeDrawn && (
            <g className="bb-groups" aria-hidden="true">
              {activeDrawn.groups.map((g, i) => (
                <rect key={i} x={g.x0} y={g.y0} width={g.x1 - g.x0} height={g.y1 - g.y0} rx={0.3 * P} />
              ))}
            </g>
          )}

          {ordered.map((d) => {
            const { part } = d
            const lit = hl.has(part.id)
            const halo =
              part.kind === 'wire' ? (
                <path className="bb-halo bb-halo--wire" d={`M${d.ends[0].x} ${d.ends[0].y}Q${wireControl(d.ends[0], d.ends[1]).x} ${wireControl(d.ends[0], d.ends[1]).y} ${d.ends[1].x} ${d.ends[1].y}`} />
              ) : (
                <rect className="bb-halo" x={d.box.x0} y={d.box.y0} width={d.box.x1 - d.box.x0} height={d.box.y1 - d.box.y0} rx={0.5 * P} />
              )
            return (
              <g
                key={part.id}
                className={`bb-part bb-part--${part.kind}${lit ? ' is-highlighted' : ''}${active === part.id ? ' is-active' : ''}`}
                data-part={part.id}
                role="img"
                tabIndex={0}
                aria-label={d.aria}
                onMouseEnter={() => setActive(part.id)}
                onMouseLeave={() => setActive((cur) => (cur === part.id ? null : cur))}
                onFocus={() => setActive(part.id)}
                onBlur={() => setActive((cur) => (cur === part.id ? null : cur))}
                onClick={() => setActive(part.id)}
              >
                {lit && halo}
                <rect className="bb-hit" x={d.box.x0} y={d.box.y0} width={d.box.x1 - d.box.x0} height={d.box.y1 - d.box.y0} />
                {part.kind === 'resistor' && <Axial a={d.ends[0]} b={d.ends[1]} kind="resistor" bands={resistorBands(part.ohms)} uid={uid} />}
                {part.kind === 'diode' && <Axial a={d.ends[0]} b={d.ends[1]} kind="diode" bands={[]} uid={uid} />}
                {part.kind === 'led' && <Led anode={d.ends[0]} cathode={d.ends[1]} color={part.color} uid={uid} />}
                {part.kind === 'wire' && <Wire a={d.ends[0]} b={d.ends[1]} color={part.color} uid={uid} />}
                <rect className="bb-focus" x={d.box.x0 - 3} y={d.box.y0 - 3} width={d.box.x1 - d.box.x0 + 6} height={d.box.y1 - d.box.y0 + 6} rx={0.5 * P} />
              </g>
            )
          })}

          {/* Every occupied hole shows its lead end on top, even under a neighbouring LED's lens. */}
          <g aria-hidden="true">
            {drawn.flatMap((d) =>
              holesOf(d.part).map((h, i) => (parseHole(h).kind === 'battery' ? null : <LegEnd key={h} p={d.ends[i]} />)),
            )}
          </g>

          <g className="bb-ids" aria-hidden="true" style={{ fontSize: ts(FS) }}>
            {idTags.map(({ id, box }) => (
              <g key={id} className={hl.has(id) ? 'is-highlighted' : undefined}>
                <rect x={box.x0} y={box.y0} width={box.x1 - box.x0} height={box.y1 - box.y0} rx={(box.y1 - box.y0) / 2} />
                <text x={(box.x0 + box.x1) / 2} y={(box.y0 + box.y1) / 2}>
                  {id}
                </text>
              </g>
            ))}
          </g>

          {activeDrawn && <Tooltip d={activeDrawn} ts={ts} vb={vb} />}
        </svg>
      </div>
      {narrow && (
        <p className="bb-hint" aria-hidden="true">
          Scroll sideways to see the whole board <span>→</span>
        </p>
      )}
    </figure>
  )
}

function Tooltip({ d, ts, vb }: { d: Drawn; ts: TextSize; vb: { x: number; y: number; w: number; h: number } }) {
  const fs = ts(13)
  const small = ts(12)
  const w = Math.max(d.title.length * 0.62 * fs, d.detail.length * 0.62 * small) + 1.4 * fs
  const h = 2.9 * fs
  const x = clamp(d.tip.x - w / 2, vb.x + 4, vb.x + vb.w - w - 4)
  const above = d.tip.y - h - 10
  const y = above >= vb.y + 2 ? above : Math.min(d.box.y1 + 10, vb.y + vb.h - h - 2)
  return (
    <g className="bb-tip" aria-hidden="true" pointerEvents="none">
      <rect x={x} y={y} width={w} height={h} rx={0.55 * fs} />
      <text x={x + w / 2} y={y + 1.15 * fs} className="bb-tip-title" style={{ fontSize: fs }}>
        {d.title}
      </text>
      <text x={x + w / 2} y={y + 2.25 * fs} className="bb-tip-detail" style={{ fontSize: small }}>
        {d.detail}
      </text>
    </g>
  )
}
