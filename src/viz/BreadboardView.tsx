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

/*
 * ESP32 DevKit V1 (30-pin) headers, as printed on the board, each listed from the USB end to the antenna end.
 * With the USB on the left, the 'EN' side runs along the top edge and the '3V3' side along the bottom edge.
 */
const ESP32_TOP_SILK = ['VIN', 'GND', 'D13', 'D12', 'D14', 'D27', 'D26', 'D25', 'D33', 'D32', 'D35', 'D34', 'VN', 'VP', 'EN']
const ESP32_BOTTOM_SILK = ['3V3', 'GND', 'D15', 'D2', 'D4', 'RX2', 'TX2', 'D5', 'D18', 'D19', 'D21', 'RX0', 'TX0', 'D22', 'D23']
const ESP32_SILK_GPIO: Record<string, number> = { RX2: 16, TX2: 17, RX0: 3, TX0: 1, VP: 36, VN: 39 }
/** The hole-grammar name of a silkscreen label: 'D2' → 'GPIO2', 'RX0' → 'GPIO3', '3V3' → '3V3'. */
const esp32PinOf = (silk: string) => (silk in ESP32_SILK_GPIO ? `GPIO${ESP32_SILK_GPIO[silk]}` : /^D\d+$/.test(silk) ? `GPIO${silk.slice(1)}` : silk)
/** Pins the 30-pin board breaks out (the grammar allows GPIO0–39; the rest aren't on its headers). */
export const ESP32_PINS: readonly string[] = [...new Set([...ESP32_BOTTOM_SILK, ...ESP32_TOP_SILK].map(esp32PinOf))]

export type ParsedHole =
  | { kind: 'strip'; row: StripRow; col: number }
  | { kind: 'rail'; rail: Rail; col: number }
  | { kind: 'uno'; pin: UnoPin }
  | { kind: 'esp32'; pin: string }
  | { kind: 'battery'; terminal: '+' | '-' }

const COL = '([1-9]|[12][0-9]|30)'
const STRIP_RE = new RegExp(`^([a-j])${COL}$`)
const RAIL_RE = new RegExp(`^([TB][+-])${COL}$`)
const ESP32_RE = /^esp32:(3V3|VIN|GND|EN|GPIO([0-9]|[1-3][0-9]))$/

/** Parses a Hole ('a1'…'j30', 'T+1', 'B-30', 'uno:5V', 'esp32:GPIO2', 'bat:+'). Throws on anything else. */
export function parseHole(h: Hole): ParsedHole {
  let m = STRIP_RE.exec(h)
  if (m) return { kind: 'strip', row: m[1] as StripRow, col: Number(m[2]) }
  m = RAIL_RE.exec(h)
  if (m) return { kind: 'rail', rail: m[1] as Rail, col: Number(m[2]) }
  if (h.startsWith('uno:') && (UNO_PINS as readonly string[]).includes(h.slice(4))) return { kind: 'uno', pin: h.slice(4) as UnoPin }
  m = ESP32_RE.exec(h)
  if (m) return { kind: 'esp32', pin: m[1] }
  if (h === 'bat:+' || h === 'bat:-') return { kind: 'battery', terminal: h === 'bat:+' ? '+' : '-' }
  throw new Error(`Invalid breadboard hole "${h}"`)
}

/* ------------------------------------------------------------------ geometry */

/** ViewBox units per 0.1" hole pitch. */
export const PITCH = 20
const P = PITCH

/** Board left edge; the 9 V battery sits in the 11.2-pitch strip to its left, the Uno above it. */
const BX = 11.2 * P
const BOARD_W = 33 * P
const BOARD_H = 20.8 * P
const THICK = 0.35 * P
const colX = (c: number) => BX + 2 * P + (c - 1) * P
const ROW_Y = Object.fromEntries(STRIP_ROWS.map((r, i) => [r, (i < 5 ? 4.9 + i : 6.9 + i) * P])) as Record<StripRow, number>
const RAIL_Y: Record<Rail, number> = { 'T+': 1.4 * P, 'T-': 2.4 * P, 'B-': 18.4 * P, 'B+': 19.4 * P }
/** Rows the column numbers are printed on, between the rails and the strips. */
const NUMBER_Y = [4.0 * P, 16.85 * P]

/*
 * The Uno sits above the board, laid out as the real board is: USB and DC jacks on the left edge,
 * the digital header along the top edge, and the power and analog headers along the bottom edge,
 * facing the board's top rails.
 */
const UNO = { x: BX + 0.6 * P, y: -15.4 * P, w: 26 * P, h: 12.8 * P }
const UNO_TOP = UNO.y + 1.1 * P
const UNO_BOTTOM = UNO.y + UNO.h - 1.1 * P

interface HeaderPin {
  name: string
  x: number
  y: number
}

/** Header blocks along one edge, left to right, one pitch apart; '' starts the next block. */
function headerBlocks(names: string[], x0: number, y: number): HeaderPin[][] {
  const blocks: HeaderPin[][] = [[]]
  let x = x0
  for (const name of names) {
    if (name === '') {
      blocks.push([])
      x += 0.6 * P
      continue
    }
    blocks[blocks.length - 1].push({ name, x, y })
    x += P
  }
  return blocks
}

const DIGITAL_BLOCKS = headerBlocks(['AREF', 'GND', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8', '', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0'], UNO.x + 9 * P, UNO_TOP)
const POWER_BLOCKS = headerBlocks(['IOREF', 'RESET', '3V3', '5V', 'GND', 'GND', 'VIN', '', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'], UNO.x + 11 * P, UNO_BOTTOM)
const UNO_HEADER_PINS = [...POWER_BLOCKS, ...DIGITAL_BLOCKS].flat()
// 'uno:GND' is the GND beside 5V on the power header (the first one listed).
const UNO_SOCKETS = Object.fromEntries(
  UNO_PINS.map((pin) => {
    const { x, y } = UNO_HEADER_PINS.find((h) => h.name === pin)!
    return [pin, { x, y }]
  }),
) as Record<UnoPin, Point>
/** Silkscreen spelling, where it differs from the pin's name in the hole grammar. */
const UNO_SILK: Partial<Record<string, string>> = { '3V3': '3.3V' }

/*
 * The ESP32 DevKit also sits above the board, turned so the USB end is on the left and the antenna on the
 * right: the '3V3' header runs along the bottom edge, facing the rails, and the 'EN' header along the top.
 */
const ESP = { x: BX + 0.6 * P, y: -14.6 * P, w: 21 * P, h: 12 * P }
const espHeader = (silk: string[], y: number): HeaderPin[] => silk.map((name, i) => ({ name, x: ESP.x + 3.5 * P + i * P, y }))
const ESP32_TOP = espHeader(ESP32_TOP_SILK, ESP.y + 1 * P)
const ESP32_BOTTOM = espHeader(ESP32_BOTTOM_SILK, ESP.y + ESP.h - 1 * P)
// 'esp32:GND' is the GND beside 3V3 (the bottom header is searched first).
const ESP32_SOCKETS = Object.fromEntries(
  ESP32_PINS.map((pin) => {
    const { x, y } = [...ESP32_BOTTOM, ...ESP32_TOP].find((h) => esp32PinOf(h.name) === pin)!
    return [pin, { x, y }]
  }),
) as Record<string, Point>

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
    case 'esp32': {
      const at = ESP32_SOCKETS[p.pin]
      if (!at) throw new Error(`${h} is not on the ESP32 DevKit V1 (30-pin) headers`)
      return at
    }
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

/**
 * Where a leg goes, as the build steps say it: "c8", "top + rail", "Uno 5V", "ESP32 pin GPIO2", "battery +".
 * A rail is one connected strip, so its column doesn't matter and isn't named.
 */
export function holeLabel(h: Hole): string {
  const p = parseHole(h)
  switch (p.kind) {
    case 'strip':
      return h
    case 'rail':
      return `${p.rail[0] === 'T' ? 'top' : 'bottom'} ${p.rail[1] === '+' ? '+' : '−'} rail`
    case 'uno':
      return `Uno ${UNO_SILK[p.pin] ?? p.pin}`
    case 'esp32':
      return `ESP32 pin ${p.pin}`
    case 'battery':
      return `battery ${p.terminal === '+' ? '+' : '−'}`
  }
}

/** holeLabel in a sentence: "the top + rail", "the battery’s + lead". */
function holePhrase(h: Hole): string {
  const p = parseHole(h)
  if (p.kind === 'rail') return `the ${holeLabel(h)}`
  if (p.kind === 'battery') return `the battery’s ${p.terminal === '+' ? '+' : '−'} lead`
  return holeLabel(h)
}

/* ------------------------------------------------------------------ resistor colour code */

export type BandColor = 'black' | 'brown' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet' | 'grey' | 'white' | 'gold' | 'silver'
const DIGITS: BandColor[] = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white']

/**
 * Resistor colour code. 5 bands (the default, as on the kit's 1 % metal-film parts): three digits,
 * multiplier, brown ±1 % tolerance. 4 bands: two digits, multiplier, gold ±5 %. The value is rounded
 * to that many significant figures. A 0 Ω link is a single black band.
 */
export function resistorBands(ohms: number, bands: 4 | 5 = 5): BandColor[] {
  if (ohms === 0) return ['black']
  const figures = bands - 2
  const lowest = 10 ** (figures - 3) // the smallest value a silver (×0.01) multiplier can show
  if (!Number.isFinite(ohms) || ohms < lowest || ohms >= 10 ** (figures + 9)) throw new RangeError(`No ${bands}-band colour code for ${ohms} Ω`)
  let exp = Math.floor(Math.log10(ohms)) - (figures - 1)
  let digits = Math.round(ohms / 10 ** exp)
  // log10 can land a hair off at powers of ten; renormalise to exactly `figures` digits.
  if (digits >= 10 ** figures) {
    digits = Math.round(digits / 10)
    exp++
  }
  if (exp > 9) throw new RangeError(`No ${bands}-band colour code for ${ohms} Ω`)
  const multiplier: BandColor = exp === -2 ? 'silver' : exp === -1 ? 'gold' : DIGITS[exp]
  const digitBands = String(digits).padStart(figures, '0').split('').map((d) => DIGITS[Number(d)])
  return [...digitBands, multiplier, bands === 5 ? 'brown' : 'gold']
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
      if (p.kind === 'esp32' && layout.supply !== 'esp32') problems.push(`${part.id}: ${h} needs the ESP32 supply`)
      if (p.kind === 'esp32' && !ESP32_PINS.includes(p.pin)) problems.push(`${part.id}: ${h} is not on the ESP32 DevKit V1 (30-pin) headers`)
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
/** Largest text size (viewBox units) counter-scaling may reach; below the scale that needs more, the drawing scrolls. */
const MAX_FS = 16.5
/** Smallest rendered scale (CSS px per viewBox unit) before the drawing scrolls instead of shrinking. */
const MIN_SCALE = MIN_TEXT_PX / MAX_FS

/** Text size in viewBox units: `base`, enlarged so it renders at ≥ MIN_TEXT_PX at `scale` (rendered px per unit). */
type TextSize = (base: number) => number
const textSizer = (scale: number): TextSize => (base) => (scale > 0 ? Math.max(base, MIN_TEXT_PX / scale) : base)

/** Content-box size of an element, kept current with a ResizeObserver (0 where unsupported). */
function useSize<T extends Element>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const set = (w: number, h = 0) =>
      setSize((s) => (s.width === Math.round(w) && s.height === Math.round(h) ? s : { width: Math.round(w), height: Math.round(h) }))
    set(el.clientWidth, el.clientHeight)
    const ro = new ResizeObserver(([entry]) => set(entry.contentRect.width, entry.contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
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
  /** Shows an id badge: every component, and jumpers that stand for one (a switch S1). */
  badge: boolean
}

const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const boxOf = (pts: Point[], pad = 0): Box => ({
  x0: Math.min(...pts.map((p) => p.x)) - pad,
  y0: Math.min(...pts.map((p) => p.y)) - pad,
  x1: Math.max(...pts.map((p) => p.x)) + pad,
  y1: Math.max(...pts.map((p) => p.y)) + pad,
})

/** Ids like R1, D3 or S2 name a lab component; ids like 'w-5v' exist only for the code and are never shown. */
const COMPONENT_ID = /^[A-Z]{1,3}\d+$/
const capital = (s: string) => s[0].toUpperCase() + s.slice(1)

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

/** A wire's arc as a chain of small boxes, so badges can keep off it. */
function wireBoxes(a: Point, b: Point): Box[] {
  const c = wireControl(a, b)
  const n = Math.max(4, Math.ceil(dist(a, b) / P))
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const u = 1 - t
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y }
  })
  return pts.slice(1).map((p, i) => boxOf([pts[i], p], 4))
}

/** The LED leans toward its shorter (cathode) leg, as a real one does, so the straight anode leg shows clearly longer. */
const LED_TILT = 18

/** LED geometry: it stands up out of the board, lens above its two legs, leaning toward the cathode. */
function ledGeometry(anode: Point, cathode: Point) {
  const cx = (anode.x + cathode.x) / 2
  const base = Math.min(anode.y, cathode.y) - 1.6 * P
  const sC = cathode.x >= anode.x ? 1 : -1
  const tilt = LED_TILT * sC
  const t = (tilt * Math.PI) / 180
  /** A point in the upright LED's frame (origin at the rim centre) → viewBox, after the lean. */
  const at = (lx: number, ly: number): Point => ({ x: cx + lx * Math.cos(t) - ly * Math.sin(t), y: base + lx * Math.sin(t) + ly * Math.cos(t) })
  const h = 2.1 * P
  const footA = at(-sC * 0.55 * P, 0.3 * P)
  const footC = at(sC * 0.55 * P, 0.3 * P)
  // "+" and "−" sit just outside each leg, beside its midpoint.
  const beside = (foot: Point, hole: Point, out: number): Point => {
    const len = dist(foot, hole) || 1
    // The leg's normal on the `out` side (out = -1 left, 1 right).
    let nx = -(hole.y - foot.y) / len
    let ny = (hole.x - foot.x) / len
    if (Math.sign(nx) !== out) [nx, ny] = [-nx, -ny]
    return { x: (foot.x + hole.x) / 2 + nx * 0.55 * P, y: (foot.y + hole.y) / 2 + ny * 0.55 * P }
  }
  const plus = beside(footA, anode, -sC)
  const minus = beside(footC, cathode, sC)
  const outline = [at(-1.05 * P, -h), at(1.05 * P, -h), at(-1.05 * P, 0.35 * P), at(1.05 * P, 0.35 * P)]
  return { cx, base, sC, tilt, r: 0.9 * P, h, footA, footC, plus, minus, outline }
}

function describePart(part: BreadboardPart): Drawn {
  const holes = holesOf(part)
  const ends = holes.map(holePosition)
  const [a, b] = ends
  const groups = holes.map((h) => connectedBox(parseHole(h))).filter((g): g is Box => g !== null)
  const [ha, hb] = holes.map(holeLabel)
  const [pa, pb] = holes.map(holePhrase)
  switch (part.kind) {
    case 'resistor': {
      const value = formatSI(part.ohms, 'Ω')
      const box = boxOf(ends, 0.6 * P)
      return { part, ends, box, tip: { x: (box.x0 + box.x1) / 2, y: box.y0 }, groups, badge: true, aria: `Resistor ${part.id}, ${value}, from ${pa} to ${pb}`, title: `${part.id} · ${value}`, detail: `${ha} → ${hb}` }
    }
    case 'diode': {
      const box = boxOf(ends, 0.6 * P)
      return { part, ends, box, tip: { x: (box.x0 + box.x1) / 2, y: box.y0 }, groups, badge: true, aria: `Diode ${part.id}, anode in ${pa}, cathode (banded end) in ${pb}`, title: `${part.id} · diode`, detail: `anode ${ha} · band ${hb}` }
    }
    case 'led': {
      const g = ledGeometry(a, b)
      const box = boxOf([...ends, ...g.outline], 0.2 * P)
      return { part, ends, box, tip: g.outline.reduce((t, p) => (p.y < t.y ? p : t)), groups, badge: true, aria: `LED ${part.id} (${part.color}), anode (long leg) in ${pa}, cathode (short leg, flat side) in ${pb}`, title: `${part.id} · ${part.color} LED`, detail: `+ ${ha} · − ${hb}` }
    }
    case 'wire': {
      const c = wireControl(a, b)
      const apex = { x: 0.25 * a.x + 0.5 * c.x + 0.25 * b.x, y: 0.25 * a.y + 0.5 * c.y + 0.25 * b.y }
      const named = COMPONENT_ID.test(part.id)
      return {
        part,
        ends,
        box: boxOf([a, b, apex], 0.4 * P),
        tip: apex,
        groups,
        badge: named,
        aria: `${capital(part.color)} jumper wire${named ? ` ${part.id}` : ''} from ${pa} to ${pb}`,
        title: named ? `${part.id} · ${part.color} jumper` : `${capital(part.color)} jumper wire`,
        detail: `${ha} → ${hb}`,
      }
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

/** Band centres along the body (0–1): the tolerance band stands apart at the far end, so the code reads from the other end. */
const BAND_X: Record<number, number[]> = { 1: [0.5], 4: [0.2, 0.34, 0.48, 0.81], 5: [0.17, 0.29, 0.41, 0.53, 0.83] }

function Axial({ a, b, kind, bands, uid }: { a: Point; b: Point; kind: 'resistor' | 'diode'; bands: BandColor[]; uid: string }) {
  const d = dist(a, b)
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
  const len = kind === 'resistor' ? clamp(d - 0.9 * P, 1.2 * P, 2.7 * P) : clamp(d - 0.9 * P, 1.2 * P, 2.2 * P)
  const x0 = (d - len) / 2
  const x1 = x0 + len
  let shapes: ReactNode
  if (kind === 'resistor') {
    // Dog-bone body: two bulged caps joined by a slimmer middle.
    const r = 0.46 * P
    const n = 0.36 * P
    const cap = len * 0.25
    const body = (cls: string, fill?: string) => (
      <g className={cls} fill={fill}>
        <rect x={x0} y={-r} width={cap} height={2 * r} rx={r * 0.75} />
        <rect x={x1 - cap} y={-r} width={cap} height={2 * r} rx={r * 0.75} />
        <rect x={x0 + cap * 0.6} y={-n} width={len - cap * 1.2} height={2 * n} />
      </g>
    )
    const bandX = BAND_X[bands.length] ?? BAND_X[5]
    const bw = len * (bands.length === 5 ? 0.075 : 0.09)
    shapes = (
      <>
        <rect className="bb-shadow" x={x0 + 2} y={-r + 4} width={len} height={2 * r} rx={r} filter={`url(#${uid}-blur)`} />
        {body('bb-res-body')}
        {bands.map((band, i) => {
          const cx = x0 + bandX[i] * len
          const onCap = cx - bw / 2 < x0 + cap || cx + bw / 2 > x1 - cap
          const hh = (onCap ? r : n) - 0.4
          return <rect key={i} className={`bb-band bb-band--${band}`} x={cx - bw / 2} y={-hh} width={bw} height={2 * hh} fill={BAND_HEX[band]} />
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
        {/* The cathode band: wide, bright silver, at the cathode end. */}
        <rect className="bb-diode-band" x={x1 - len * 0.27} y={-r} width={len * 0.17} height={2 * r} fill={`url(#${uid}-silver)`} />
        <rect x={x0} y={-r} width={len} height={2 * r} rx={r * 0.55} fill={`url(#${uid}-shade)`} />
      </>
    )
  }
  return (
    <g transform={`translate(${a.x} ${a.y}) rotate(${angle})`}>
      <Lead d={`M0 0H${x0 + 2}M${x1 - 2} 0H${d}`} />
      {shapes}
    </g>
  )
}

function Led({ anode, cathode, color, uid }: { anode: Point; cathode: Point; color: LedColor; uid: string }) {
  const { cx, base, sC, tilt, r, h, footA, footC } = ledGeometry(anode, cathode)
  const sA = -sC
  const top = base - h
  const dome = `M${cx - r} ${base}V${top + r}A${r} ${r} 0 0 1 ${cx + r} ${top + r}V${base}Z`
  // The rim is wider than the dome, except on the cathode side, where it is cut flat.
  const rimY0 = base - 0.1 * P
  const rimY1 = base + 0.28 * P
  const rr = (rimY1 - rimY0) / 2
  const outer = cx + sA * (r + 0.3 * P)
  const flat = cx + sC * r
  const rim =
    sA < 0
      ? `M${flat} ${rimY0}H${outer + rr}A${rr} ${rr} 0 0 0 ${outer + rr} ${rimY1}H${flat}Z`
      : `M${flat} ${rimY0}H${outer - rr}A${rr} ${rr} 0 0 1 ${outer - rr} ${rimY1}H${flat}Z`
  return (
    <>
      <ellipse className="bb-shadow" cx={cx + 0.5 * P * sC} cy={base + 1.2 * P} rx={1.15 * P} ry={0.38 * P} filter={`url(#${uid}-blur)`} />
      <Lead d={`M${footC.x} ${footC.y}L${cathode.x} ${cathode.y}`} />
      <Lead d={`M${footA.x} ${footA.y}L${anode.x} ${anode.y}`} />
      <g className="bb-lens" style={{ color: LED_COLORS[color] }} transform={`rotate(${tilt} ${cx} ${base})`}>
        <path d={dome} fill={`url(#${uid}-lens-${color})`} className="bb-lens-body" />
        {/* The lead frame seen through the lens: a small post (anode) and the larger anvil (cathode). */}
        <rect className="bb-frame" x={cx + sA * 0.34 * P - 0.08 * P} y={base - 0.95 * P} width={0.16 * P} height={0.9 * P} />
        <path className="bb-frame" d={`M${cx + sC * 0.06 * P} ${base - 0.05 * P}V${base - 0.85 * P}L${cx + sC * 0.48 * P} ${base - 1.05 * P}V${base - 0.05 * P}Z`} />
        <path className="bb-bond" d={`M${cx + sA * 0.34 * P} ${base - 0.95 * P}Q${cx} ${base - 1.6 * P} ${cx + sC * 0.22 * P} ${base - 1.0 * P}`} />
        <ellipse className="bb-glare" cx={cx - 0.42 * P} cy={top + r * 0.95} rx={0.17 * P} ry={0.62 * P} />
        <ellipse className="bb-glare bb-glare--soft" cx={cx + 0.45 * P} cy={top + r * 1.2} rx={0.08 * P} ry={0.35 * P} />
        <path className="bb-flange" d={rim} fill={`url(#${uid}-lens-${color})`} />
        <line className="bb-flat" x1={flat} x2={flat} y1={rimY0 - 0.02 * P} y2={rimY1} />
      </g>
    </>
  )
}

/** "+" by every LED's anode leg and "−" by its cathode leg, above all parts so a neighbour never hides them. */
function Polarity({ drawn, ts }: { drawn: Drawn[]; ts: TextSize }) {
  return (
    <g aria-hidden="true" style={{ fontSize: ts(FS * 1.25) }}>
      {drawn.map((d) => {
        if (d.part.kind !== 'led') return null
        const { plus, minus } = ledGeometry(d.ends[0], d.ends[1])
        return (
          <g key={d.part.id}>
            <text className="bb-pol bb-pol--pos" x={plus.x} y={plus.y}>
              +
            </text>
            <text className="bb-pol bb-pol--neg" x={minus.x} y={minus.y}>
              −
            </text>
          </g>
        )
      })}
    </g>
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

/** Columns that get a printed number: 1, every fifth, and every column in use. */
const numberedColumns = (usedCols: Set<number>) => Array.from({ length: BOARD_COLUMNS }, (_, i) => i + 1).filter((c) => c === 1 || c % 5 === 0 || usedCols.has(c))

/** A printed column number's extent, for keeping badges off it. */
const numberBox = (c: number, y: number, fs: number): Box => {
  const hw = String(c).length * 0.32 * fs + 2
  return { x0: colX(c) - hw, x1: colX(c) + hw, y0: y - 0.55 * fs, y1: y + 0.55 * fs }
}

function Board({ ts, usedCols }: { ts: TextSize; usedCols: Set<number> }) {
  const cols = Array.from({ length: BOARD_COLUMNS }, (_, i) => i + 1)
  const holes: Point[] = []
  for (const c of cols) {
    for (const r of STRIP_ROWS) holes.push({ x: colX(c), y: ROW_Y[r] })
    for (const rail of Object.keys(RAIL_Y) as Rail[]) holes.push({ x: colX(c), y: RAIL_Y[rail] })
  }
  const fs = ts(FS)
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
        {/* Numbers of columns in use are printed over the parts instead (see ColumnNumbers). */}
        {numberedColumns(usedCols)
          .filter((c) => !usedCols.has(c))
          .map((c) =>
            NUMBER_Y.map((y) => (
              <text key={`${c}-${y}`} x={colX(c)} y={y} className="bb-colnum">
                {c}
              </text>
            )),
          )}
      </g>
    </g>
  )
}

/** Numbers of the columns in use, on top of everything else, so no wire or LED hides where a leg goes. */
function ColumnNumbers({ ts, usedCols }: { ts: TextSize; usedCols: Set<number> }) {
  return (
    <g className="bb-print bb-colnums" aria-hidden="true" style={{ fontSize: ts(FS) }}>
      {[...usedCols].map((c) =>
        NUMBER_Y.map((y) => (
          <text key={`${c}-${y}`} x={colX(c)} y={y} className="bb-colnum is-used">
            {c}
          </text>
        )),
      )}
    </g>
  )
}

function Uno({ ts, uid, used }: { ts: TextSize; uid: string; used: Set<string> }) {
  const { x, y, w, h } = UNO
  const fs = ts(FS * 0.8)
  const groupFs = ts(FS * 0.72)
  const silk = (pin: HeaderPin) => UNO_SILK[pin.name] ?? pin.name
  const longest = (pins: HeaderPin[]) => Math.max(...pins.map((p) => silk(p).length)) * 0.62 * fs
  const topPins = DIGITAL_BLOCKS.flat()
  const bottomPins = POWER_BLOCKS.flat()
  // Pin names run inward from each header, rotated, as printed on the board.
  const topLabelY = UNO_TOP + 0.75 * P
  const bottomLabelY = UNO_BOTTOM - 0.75 * P
  const digitalY = topLabelY + longest(topPins) + 0.9 * groupFs
  const powerY = bottomLabelY - longest(bottomPins) - 0.9 * groupFs
  const centre = (pins: HeaderPin[]) => (pins[0].x + pins[pins.length - 1].x) / 2
  const chipH = 1.3 * P
  const chip = { x: x + 12.5 * P, y: (digitalY + powerY) / 2 - chipH / 2, w: 9 * P, h: chipH }
  const ch = 1.2 * P // the chamfered corner beside D0
  const rc = 8
  const outline = `M${x + rc} ${y}H${x + w - ch}L${x + w} ${y + ch}V${y + h - rc}Q${x + w} ${y + h} ${x + w - rc} ${y + h}H${x + rc}Q${x} ${y + h} ${x} ${y + h - rc}V${y + rc}Q${x} ${y} ${x + rc} ${y}Z`
  const isUsed = (pin: HeaderPin) => used.has(pin.name) && UNO_SOCKETS[pin.name as UnoPin]?.x === pin.x && UNO_SOCKETS[pin.name as UnoPin]?.y === pin.y
  return (
    <g className="bb-uno" aria-hidden="true">
      <rect className="bb-board-shadow" x={x + 4} y={y + 10} width={w} height={h} rx={10} />
      <path className="bb-pcb" d={outline} />
      <rect className="bb-pcb-gloss" x={x + 1.5} y={y + 1.5} width={w - ch - 3} height={h * 0.4} rx={7} />
      {/* USB-B and DC barrel jacks overhang the left edge. */}
      <rect className="bb-usb" x={x - 1.3 * P} y={y + 1.5 * P} width={4.6 * P} height={3.4 * P} rx={2} fill={`url(#${uid}-metal)`} />
      <rect className="bb-usb-slot" x={x - 1.3 * P} y={y + 2.3 * P} width={1.1 * P} height={1.8 * P} rx={1} />
      <rect className="bb-dcjack" x={x - 0.7 * P} y={y + h - 4.7 * P} width={4.8 * P} height={3 * P} rx={3} />
      <circle className="bb-dcjack-pin" cx={x - 0.1 * P} cy={y + h - 3.2 * P} r={0.45 * P} />
      <rect className="bb-reset" x={x + 5.4 * P} y={y + 0.9 * P} width={1.3 * P} height={1.3 * P} rx={2} />
      <circle className="bb-reset-cap" cx={x + 6.05 * P} cy={y + 1.55 * P} r={0.4 * P} />
      {[y + 3.4 * P, y + h - 2.8 * P].map((cy) => (
        <circle key={cy} className="bb-mount" cx={x + w - 1.0 * P} cy={cy} r={0.42 * P} />
      ))}
      {/* The microcontroller, as a plain 28-pin DIP outline. */}
      <g className="bb-chip">
        <path className="bb-chip-pins" d={Array.from({ length: 14 }, (_, i) => `M${chip.x + (i + 0.5) * (chip.w / 14)} ${chip.y - 3}v${chip.h + 6}`).join('')} />
        <rect x={chip.x} y={chip.y} width={chip.w} height={chip.h} rx={2} />
        <circle className="bb-chip-notch" cx={chip.x + 0.1 * P} cy={chip.y + chip.h / 2} r={0.28 * P} />
      </g>
      {[...DIGITAL_BLOCKS, ...POWER_BLOCKS].map((block) => (
        <rect key={`${block[0].x}-${block[0].y}`} className="bb-header" x={block[0].x - 0.5 * P} y={block[0].y - 0.5 * P} width={block.length * P} height={P} rx={2} />
      ))}
      <path className="bb-socket" d={holeSquares(UNO_HEADER_PINS, 0.42 * P)} />
      <g className="bb-silk" style={{ fontSize: fs }}>
        {topPins.map((p) => (
          <text key={`t${p.x}`} className={isUsed(p) ? 'is-used' : undefined} x={p.x} y={topLabelY} transform={`rotate(-90 ${p.x} ${topLabelY})`} textAnchor="end">
            {silk(p)}
          </text>
        ))}
        {bottomPins.map((p) => (
          <text key={`b${p.x}`} className={isUsed(p) ? 'is-used' : undefined} x={p.x} y={bottomLabelY} transform={`rotate(-90 ${p.x} ${bottomLabelY})`} textAnchor="start">
            {silk(p)}
          </text>
        ))}
        <g className="bb-silk-group" style={{ fontSize: groupFs }}>
          <text x={centre(topPins)} y={digitalY} textAnchor="middle">
            DIGITAL (PWM~)
          </text>
          <text x={centre(POWER_BLOCKS[0])} y={powerY} textAnchor="middle">
            POWER
          </text>
          <text x={centre(POWER_BLOCKS[1])} y={powerY} textAnchor="middle">
            ANALOG IN
          </text>
        </g>
      </g>
    </g>
  )
}

function Esp32({ ts, uid, used }: { ts: TextSize; uid: string; used: Set<string> }) {
  const { x, y, w, h } = ESP
  const fs = ts(FS * 0.8)
  const small = ts(FS * 0.65)
  const mid = y + h / 2
  const topLabelY = ESP32_TOP[0].y + 0.75 * P
  const bottomLabelY = ESP32_BOTTOM[0].y - 0.75 * P
  // The WROOM module: a metal can, then the PCB antenna overhanging the board's right end.
  const can = { x: x + 8.6 * P, y: mid - 2.1 * P, w: 8.4 * P, h: 4.2 * P }
  const antenna = { x: can.x + can.w, y: can.y, w: 4.4 * P, h: can.h }
  const zig = Array.from({ length: 6 }, (_, i) => `${i ? 'L' : 'M'}${antenna.x + (0.6 + i * 0.6) * P} ${i % 2 ? antenna.y + antenna.h - 0.6 * P : antenna.y + 0.6 * P}`).join('')
  // A socket is "used" only if it is the one the grammar's name lands on (two pins are printed GND).
  const isUsed = (pin: HeaderPin) => {
    const name = esp32PinOf(pin.name)
    return used.has(name) && ESP32_SOCKETS[name].x === pin.x && ESP32_SOCKETS[name].y === pin.y
  }
  const button = (cy: number, label: string, ly: number) => (
    <g key={label}>
      <rect className="bb-reset" x={x + 1.0 * P} y={cy - 0.6 * P} width={1.2 * P} height={1.2 * P} rx={2} />
      <circle className="bb-esp-button" cx={x + 1.6 * P} cy={cy} r={0.36 * P} />
      <text x={x + 1.6 * P} y={ly} textAnchor="middle" style={{ fontSize: small }}>
        {label}
      </text>
    </g>
  )
  return (
    <g className="bb-uno bb-esp32" aria-hidden="true">
      <rect className="bb-board-shadow" x={x + 4} y={y + 10} width={w} height={h} rx={8} />
      <rect className="bb-esp-pcb" x={x} y={y} width={w} height={h} rx={7} />
      <rect className="bb-pcb-gloss" x={x + 1.5} y={y + 1.5} width={w - 3} height={h * 0.4} rx={6} />
      {/* Micro-USB on the left end. */}
      <rect className="bb-usb" x={x - 0.9 * P} y={mid - 1.1 * P} width={2.6 * P} height={2.2 * P} rx={2} fill={`url(#${uid}-metal)`} />
      <rect className="bb-usb-slot" x={x - 0.9 * P} y={mid - 0.45 * P} width={0.7 * P} height={0.9 * P} rx={1} />
      <g className="bb-silk">
        {button(mid - 2.9 * P, 'EN', mid - 1.75 * P)}
        {button(mid + 2.9 * P, 'BOOT', mid + 1.75 * P)}
      </g>
      <rect className="bb-esp-antenna" x={antenna.x} y={antenna.y} width={antenna.w} height={antenna.h} rx={3} />
      <path className="bb-esp-trace" d={zig} />
      <rect className="bb-esp-can" x={can.x} y={can.y} width={can.w} height={can.h} rx={3} fill={`url(#${uid}-metal)`} />
      {[ESP32_TOP, ESP32_BOTTOM].map((pins) => (
        <rect key={pins[0].y} className="bb-header" x={pins[0].x - 0.5 * P} y={pins[0].y - 0.5 * P} width={pins.length * P} height={P} rx={2} />
      ))}
      <path className="bb-socket" d={holeSquares([...ESP32_TOP, ...ESP32_BOTTOM], 0.42 * P)} />
      <g className="bb-silk" style={{ fontSize: fs }}>
        {ESP32_TOP.map((p) => (
          <text key={`t${p.x}`} className={isUsed(p) ? 'is-used' : undefined} x={p.x} y={topLabelY} transform={`rotate(-90 ${p.x} ${topLabelY})`} textAnchor="end">
            {p.name}
          </text>
        ))}
        {ESP32_BOTTOM.map((p) => (
          <text key={`b${p.x}`} className={isUsed(p) ? 'is-used' : undefined} x={p.x} y={bottomLabelY} transform={`rotate(-90 ${p.x} ${bottomLabelY})`} textAnchor="start">
            {p.name}
          </text>
        ))}
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

const BOARD_BOX: Box = { x0: BX - 0.8 * P, y0: -0.8 * P, x1: BX + BOARD_W + 0.8 * P, y1: BOARD_H + THICK + 0.9 * P }
const SUPPLY_BOX: Record<BreadboardLayout['supply'], Box> = {
  battery9v: { ...BOARD_BOX, x0: -0.8 * P },
  uno: { ...BOARD_BOX, x0: Math.min(BOARD_BOX.x0, UNO.x - 1.3 * P - 0.6 * P), y0: UNO.y - 0.8 * P },
  esp32: { ...BOARD_BOX, x0: Math.min(BOARD_BOX.x0, ESP.x - 0.9 * P - 0.6 * P), y0: ESP.y - 0.8 * P },
}
// Wires go over parts (as on a real bench, and so a tall LED never hides where a jumper lands).
const DRAW_ORDER: Record<BreadboardPart['kind'], number> = { resistor: 0, diode: 0, led: 1, wire: 2 }

export function BreadboardView({ layout, ariaLabel, highlight }: BreadboardViewProps) {
  const uid = 'bb' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const [scrollRef, avail] = useSize<HTMLDivElement>()
  const [active, setActive] = useState<string | null>(null)
  const hl = new Set(highlight ?? [])

  const { drawn, problems, usedCols, usedPins } = useMemo(() => {
    const problems = layoutProblems(layout)
    const broken = new Set(problems.map((p) => p.slice(0, p.indexOf(':'))))
    const drawn = layout.parts.filter((p) => !broken.has(p.id)).map(describePart)
    const usedCols = new Set<number>()
    const usedPins = new Set<string>()
    for (const d of drawn)
      for (const h of holesOf(d.part)) {
        const p = parseHole(h)
        if (p.kind === 'strip') usedCols.add(p.col)
        if (p.kind === 'uno' || p.kind === 'esp32') usedPins.add(p.pin)
      }
    return { drawn, problems, usedCols, usedPins }
  }, [layout])

  useEffect(() => {
    if (problems.length) console.error(`BreadboardView: skipped parts with wiring problems:\n${problems.join('\n')}`)
  }, [problems])

  const vb = useMemo(() => {
    const b = { ...SUPPLY_BOX[layout.supply] }
    for (const d of drawn) {
      b.x0 = Math.min(b.x0, d.box.x0 - 0.4 * P)
      b.y0 = Math.min(b.y0, d.box.y0 - 1.6 * P)
      b.x1 = Math.max(b.x1, d.box.x1 + 0.4 * P)
      b.y1 = Math.max(b.y1, d.box.y1 + 0.4 * P)
    }
    return { x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 }
  }, [drawn, layout.supply])

  // The svg fills the width (and the height, when the container gives the figure one) at `meet`, but never
  // below MIN_SCALE: past that it keeps its size and the box scrolls, so text stays ≥ MIN_TEXT_PX.
  const minWidth = Math.ceil(vb.w * MIN_SCALE)
  const minHeight = Math.ceil(vb.h * MIN_SCALE)
  const scale =
    avail.width > 0 ? Math.min(Math.max(avail.width, minWidth) / vb.w, avail.height > 0 ? Math.max(avail.height, minHeight) / vb.h : Infinity) : 0
  const ts = textSizer(scale)
  const scrollsX = avail.width > 0 && avail.width < minWidth
  const scrollsY = avail.height > 0 && avail.height < minHeight - 1

  // Id badges sit beside their part, clear of every part, wire, used column number and other badge.
  const badges = useMemo(() => {
    const fs = ts(FS)
    const tagged = drawn.filter((d) => d.badge)
    const obstacles: Box[] = [
      ...drawn.flatMap((d) => (d.part.kind === 'wire' ? wireBoxes(d.ends[0], d.ends[1]) : [d.box])),
      ...[...usedCols].flatMap((c) => NUMBER_Y.map((y) => numberBox(c, y, fs))),
    ]
    const view: Box = { x0: vb.x, y0: vb.y, x1: vb.x + vb.w, y1: vb.y + vb.h }
    const inside = (b: Box) => b.x0 >= view.x0 && b.x1 <= view.x1 && b.y0 >= view.y0 && b.y1 <= view.y1
    const candidates = tagged.map((d) => {
      const hw = (d.part.id.length * fs * 0.62 + fs * 0.9) / 2
      const hh = fs * 0.8
      const { x0, y0, x1, y1 } = d.box
      const mx = (x0 + x1) / 2
      const my = (y0 + y1) / 2
      const at = (cx: number, cy: number): Box => ({ x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh })
      const ring = (g: number) => [
        at(mx, y0 - g - hh),
        at(mx, y1 + g + hh),
        at(x1 + g + hw, my),
        at(x0 - g - hw, my),
        at(x1 + hw, y0 - g - hh),
        at(x0 - hw, y0 - g - hh),
        at(x1 + hw, y1 + g + hh),
        at(x0 - hw, y1 + g + hh),
      ]
      const all = [...ring(3), ...ring(3 + 2 * hh), ...ring(3 + 4 * hh)]
      const fit = all.filter(inside)
      return fit.length ? fit : all
    })
    const chosen = placeLabels(candidates, obstacles)
    return tagged.map((d, i) => {
      const box = candidates[i][chosen[i]]
      // A badge pushed away from its part gets a thin leader to it.
      const from = { x: clamp(d.tip.x, box.x0, box.x1), y: clamp(d.tip.y, box.y0, box.y1) }
      const to = { x: clamp(from.x, d.box.x0, d.box.x1), y: clamp(from.y, d.box.y0, d.box.y1) }
      return { id: d.part.id, box, leader: dist(from, to) > fs ? { from, to } : null }
    })
  }, [drawn, usedCols, vb, scale])

  const ordered = [...drawn].sort((x, y) => DRAW_ORDER[x.part.kind] - DRAW_ORDER[y.part.kind])
  const activeDrawn = drawn.find((d) => d.part.id === active)

  return (
    <figure className="bb" aria-label={ariaLabel}>
      <div className="bb-scroll" ref={scrollRef}>
        <svg className="bb-svg" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} style={{ minWidth, minHeight }} preserveAspectRatio="xMidYMid meet">
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
            <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8d949c" />
              <stop offset="0.35" stopColor="#e3e7ec" />
              <stop offset="1" stopColor="#7d838b" />
            </linearGradient>
            <linearGradient id={`${uid}-silver`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.45" stopColor="#d9dee5" />
              <stop offset="1" stopColor="#9aa2ad" />
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

          {layout.supply === 'uno' ? <Uno ts={ts} uid={uid} used={usedPins} /> : layout.supply === 'esp32' ? <Esp32 ts={ts} uid={uid} used={usedPins} /> : <Battery ts={ts} uid={uid} />}
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
            const c = part.kind === 'wire' ? wireControl(d.ends[0], d.ends[1]) : null
            const halo = c ? (
              <path className="bb-halo bb-halo--wire" d={`M${d.ends[0].x} ${d.ends[0].y}Q${c.x} ${c.y} ${d.ends[1].x} ${d.ends[1].y}`} />
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

          <Polarity drawn={drawn} ts={ts} />
          <ColumnNumbers ts={ts} usedCols={usedCols} />

          <g className="bb-ids" aria-hidden="true" style={{ fontSize: ts(FS) }}>
            {badges.map(({ id, box, leader }) => (
              <g key={id} className={hl.has(id) ? 'is-highlighted' : undefined}>
                {leader && <line className="bb-leader" x1={leader.from.x} y1={leader.from.y} x2={leader.to.x} y2={leader.to.y} />}
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
      {(scrollsX || scrollsY) && (
        <p className="bb-hint" aria-hidden="true">
          {scrollsX ? 'Scroll sideways to see the whole board' : 'Scroll to see the whole board'} <span>{scrollsX ? '→' : '↓'}</span>
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
