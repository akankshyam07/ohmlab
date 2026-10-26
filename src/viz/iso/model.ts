// The bench in model millimetres: where every hole and header pin is, and the current in every jumper.
import { legsOf, parseHole as stripOf } from '../../content/breadboard'
import type { Circuit, Component, SolveResult } from '../../sim/types'
import { PITCH, holePosition, parseHole } from '../BreadboardView'
import type { BreadboardLayout, BreadboardPart, Hole } from '../types'
import type { Vec3 } from './geom'

/** 0.1" hole pitch in mm. */
export const P = 2.54
/** BreadboardView's plan (viewBox units) to bench millimetres. */
const MM = P / PITCH

/* ------------------------------------------------------------------ breadboard (half size) */

/** Board footprint and height: the plan's proportions (33 × 20.8 pitches, about 84 × 53 mm), 8.5 mm tall. */
export const BOARD = { x0: 11.2 * P, x1: 44.2 * P, y0: 0, y1: 20.8 * P, z0: 0, z1: 8.5 }
/** Board top surface: legs and jumper pins enter here. */
export const Z0 = BOARD.z1
/** The centre channel between rows e and f. */
export const CHANNEL = { y0: 9.95 * P, y1: 10.85 * P }

/* ------------------------------------------------------------------ Arduino Uno R3 */

/**
 * The Uno is drawn at its real size (68.6 × 53.3 mm) and real pin positions, measured from its
 * lower-left corner (USB edge on the left, power header along the bottom). It is placed so its 5V
 * socket lands where BreadboardView's plan puts it, with the power header facing the breadboard.
 */
export const UNO_SIZE = { w: 68.6, h: 53.3, pcb: 1.6, lift: 2 }
const anchor5V = (() => {
  const p = holePosition('uno:5V')
  return { x: p.x * MM, y: p.y * MM }
})()
const UNO_X0 = anchor5V.x - 38.1
const UNO_Y0 = anchor5V.y - (UNO_SIZE.h - 2.54)
/** Uno PCB top surface height. */
export const UZ = UNO_SIZE.lift + UNO_SIZE.pcb
export const HEADER_H = 8.5

/** Uno real coordinates (mm from the lower-left corner) to bench mm. */
export const uno = (xr: number, yr: number) => ({ x: UNO_X0 + xr, y: UNO_Y0 + UNO_SIZE.h - yr })

export interface HeaderSpec {
  /** Real x of the first pin; pins are one pitch apart. */
  x: number
  /** Real y of the pin row. */
  y: number
  pins: string[]
}

export const UNO_HEADERS: HeaderSpec[] = [
  { x: 27.94, y: 2.54, pins: ['NC', 'IOREF', 'RESET', '3V3', '5V', 'GND', 'GND', 'VIN'] },
  { x: 50.8, y: 2.54, pins: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'] },
  { x: 18.8, y: 50.8, pins: ['SCL', 'SDA', 'AREF', 'GND', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8'] },
  { x: 45.72, y: 50.8, pins: ['D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0'] },
]

/** Silkscreen spelling of a header pin. */
export const silk = (pin: string) => (pin === '3V3' ? '3.3V' : pin.startsWith('D') && pin.length <= 3 ? pin.slice(1) : pin)

function unoSocket(pin: string): Vec3 {
  for (const h of UNO_HEADERS) {
    const i = h.pins.indexOf(pin)
    if (i >= 0) return { ...uno(h.x + i * P, h.y), z: UZ + HEADER_H }
  }
  throw new Error(`No Uno pin ${pin}`)
}

/* ------------------------------------------------------------------ ESP32 DevKit V1 (30-pin) */

/**
 * The DevKit at real size (51.5 × 28.3 mm), measured from its corner at the USB end on the 3V3 side:
 * x along the board (USB at 0, antenna at the far end), y across. Pins point down through a plastic
 * spacer, so the board stands on them; the header rows are 25.4 mm apart.
 */
export const ESP32_SIZE = { w: 51.5, h: 28.3, pcb: 1.6, pins: 6, spacer: 2.5 }
/** Top of the DevKit's PCB when it stands on its pins. */
export const EZ = ESP32_SIZE.pins + ESP32_SIZE.spacer + ESP32_SIZE.pcb
/** Pin rows: the right row (3V3 side) runs along y = 1.45, the left row (EN, VIN) along y = 26.85; pin 0 is at the antenna end. */
export const ESP32_ROWS = [
  { y: 1.45, pins: ['GPIO23', 'GPIO22', 'GPIO1', 'GPIO3', 'GPIO21', 'GPIO19', 'GPIO18', 'GPIO5', 'GPIO17', 'GPIO16', 'GPIO4', 'GPIO2', 'GPIO15', 'GND', '3V3'] },
  { y: 26.85, pins: ['EN', 'GPIO36', 'GPIO39', 'GPIO34', 'GPIO35', 'GPIO32', 'GPIO33', 'GPIO25', 'GPIO26', 'GPIO27', 'GPIO14', 'GPIO12', 'GPIO13', 'GND2', 'VIN'] },
] as const
/** x of the i-th pin from the antenna end. */
export const esp32PinX = (i: number) => 43.6 - i * P
/** Silkscreen names (as printed on the DevKit). */
export const ESP32_SILK: Record<string, string> = { GPIO1: 'TX0', GPIO3: 'RX0', GPIO36: 'VP', GPIO39: 'VN', GPIO17: 'TX2', GPIO16: 'RX2', GND2: 'GND' }

/** Where the DevKit sits on the bench when it's the supply: behind the board, its 3V3 side facing it. */
const ESP_X0 = BOARD.x0 + 8
const ESP_YF = -7
/** DevKit coordinates (mm from its corner) to bench mm. */
export const esp = (xr: number, yr: number) => ({ x: ESP_X0 + xr, y: ESP_YF - yr })

/** Parses 'esp32:GPIO2', 'esp32:3V3', 'esp32:VIN', 'esp32:GND', 'esp32:EN'; null for anything else. */
export function esp32Pin(h: Hole): { row: number; index: number } | null {
  if (!h.startsWith('esp32:')) return null
  const name = h.slice(6)
  for (const [row, r] of ESP32_ROWS.entries()) {
    const index = (r.pins as readonly string[]).indexOf(name)
    if (index >= 0) return { row, index }
  }
  return null
}

function esp32Socket(h: Hole): Vec3 {
  const pin = esp32Pin(h)
  if (!pin) throw new Error(`No ESP32 DevKit pin ${h}`)
  // Jumpers are drawn onto the pin's solder joint on top of the board.
  return { ...esp(esp32PinX(pin.index), ESP32_ROWS[pin.row].y), z: EZ + 1.1 }
}

/* ------------------------------------------------------------------ 9 V battery */

/** A 9 V battery lying on its broad side left of the board, snap terminals at the back end. */
export const BATTERY = (() => {
  const c = { x: 4 * P, y: 11.9 * P }
  return { x0: c.x - 13.25, x1: c.x + 13.25, y0: c.y - 24.25, y1: c.y + 24.25, z0: 0, z1: 17.5 }
})()
const batteryTerminal = (t: '+' | '-'): Vec3 => ({ x: (BATTERY.x0 + BATTERY.x1) / 2 + (t === '+' ? -6.35 : 6.35), y: BATTERY.y0 + 6, z: BATTERY.z1 + 3 })

/* ------------------------------------------------------------------ holes */

/** Where a leg or jumper pin enters a hole (or header socket), in bench mm, on the surface. */
export function holePoint(h: Hole): Vec3 {
  if (h.startsWith('esp32:')) return esp32Socket(h)
  const p = parseHole(h)
  if (p.kind === 'uno') return unoSocket(p.pin)
  if (p.kind === 'battery') return batteryTerminal(p.terminal)
  const q = holePosition(h)
  return { x: q.x * MM, y: q.y * MM, z: Z0 }
}

/** Every hole on the board, as bench mm (for drawing them all in one path). */
export function boardHoles(): Vec3[] {
  const out: Vec3[] = []
  const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'T+', 'T-', 'B+', 'B-']
  for (let c = 1; c <= 30; c++) for (const r of rows) out.push(holePoint(`${r}${c}`))
  return out
}

/* ------------------------------------------------------------------ physical colours */

// These depict real parts, so they are data, not theme tokens (as in BreadboardView).
export const BAND_HEX: Record<string, string> = {
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
export const WIRE_HEX: Record<WireColor, string> = {
  red: '#e5383b',
  black: '#3a3d45',
  yellow: '#f5c533',
  blue: '#3474e8',
  green: '#2fae55',
  orange: '#f58b25',
  white: '#eef0f4',
}

/* ------------------------------------------------------------------ tokens */

export interface IsoPalette {
  ink: string
  bench: string
  benchGrid: string
  pcb: string
  trace: string
  silk: string
  board: string
  hole: string
  print: string
  railPos: string
  railNeg: string
  metal: string
  plastic: string
  chip: string
  resistor: string
  current: string
  brand: string
  ok: string
}

const TOKEN: Record<keyof IsoPalette, string> = {
  ink: '--iso-ink',
  bench: '--iso-bench',
  benchGrid: '--iso-bench-grid',
  pcb: '--iso-pcb',
  trace: '--iso-pcb-trace',
  silk: '--iso-silk',
  board: '--iso-board',
  hole: '--iso-board-hole',
  print: '--iso-board-print',
  railPos: '--iso-rail-pos',
  railNeg: '--iso-rail-neg',
  metal: '--iso-metal',
  plastic: '--iso-plastic',
  chip: '--iso-chip',
  resistor: '--iso-resistor',
  current: '--sig-current',
  brand: '--brand',
  ok: '--ok',
}

let palette: IsoPalette | null = null
/** Token values from tokens.css, read once (shades are computed from them in code). */
export function readPalette(): IsoPalette {
  if (palette) return palette
  const css = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null
  const out = {} as IsoPalette
  let complete = true
  for (const key of Object.keys(TOKEN) as (keyof IsoPalette)[]) {
    const v = css?.getPropertyValue(TOKEN[key]).trim()
    if (!v) complete = false
    // ponytail: grey stands in when tokens.css isn't loaded (unit tests); the app always loads it.
    out[key] = v || '#808080'
  }
  if (complete) palette = out
  return out
}

/* ------------------------------------------------------------------ currents in jumpers */

const terminals = (c: Component): [string, string] =>
  c.kind === 'vsource' ? [c.pos, c.neg] : c.kind === 'led' || c.kind === 'diode' ? [c.anode, c.cathode] : [c.a, c.b]

const SUPPLY_PINS: Record<BreadboardLayout['supply'], (layout: BreadboardLayout) => [Hole, Hole]> = {
  uno: () => ['uno:5V', 'uno:GND'],
  battery9v: () => ['bat:+', 'bat:-'],
  // The ESP32's lab source is its 3V3 pin, or VIN, or else the GPIO that drives the circuit.
  esp32: (layout) => {
    const used = layout.parts.flatMap(legsOf).filter((h) => h.startsWith('esp32:'))
    return [used.find((h) => h === 'esp32:3V3') ?? used.find((h) => h === 'esp32:VIN') ?? used.find((h) => h.startsWith('esp32:GPIO')) ?? 'esp32:3V3', 'esp32:GND']
  },
}

/**
 * Current in each plain jumper (amps, positive from `from` to `to`). Ideal wires carry whatever
 * Kirchhoff's current law needs: every strip gains or loses current through the component legs in
 * it (and the supply pins), and the jumpers between strips form a forest, so each jumper carries
 * the net current of the strips on its far side. A jumper that closes a loop of jumpers gets 0
 * (its share isn't defined). Jumpers that are lab components (a closed switch S1) report the solver's current.
 */
export function wireCurrents(layout: BreadboardLayout, circuit: Circuit, result: SolveResult): Record<string, number> {
  const comps = new Map(circuit.components.map((c) => [c.id, c]))
  const out: Record<string, number> = {}
  const strip = (h: Hole) => stripOf(h) ?? h

  // Strips joined by plain jumpers, so a switch-jumper's orientation can be read from the nodes.
  const parent = new Map<string, string>()
  const find = (s: string): string => (parent.has(s) ? find(parent.get(s)!) : s)
  const plain = layout.parts.filter((p) => p.kind === 'wire' && !comps.has(p.id)) as Extract<BreadboardPart, { kind: 'wire' }>[]
  for (const w of plain) {
    const [a, b] = [find(strip(w.from)), find(strip(w.to))]
    if (a !== b) parent.set(a, b)
  }
  const nodeOfNet = new Map<string, string>()
  for (const p of layout.parts) {
    const c = comps.get(p.id)
    if (!c || c.kind === 'switch' || c.kind === 'vsource') continue
    legsOf(p).forEach((h, i) => nodeOfNet.set(find(strip(h)), terminals(c)[i]))
  }

  const inject = new Map<string, number>()
  const add = (s: string, i: number) => inject.set(s, (inject.get(s) ?? 0) + i)
  for (const p of layout.parts) {
    const c = comps.get(p.id)
    const r = result.components[p.id]
    if (!c || !r) continue
    let sign = 1
    const [h1, h2] = legsOf(p)
    if (c.kind === 'switch') {
      const n1 = nodeOfNet.get(find(strip(h1)))
      sign = n1 === undefined || n1 === c.a ? 1 : -1
      out[p.id] = r.current * sign
    }
    add(strip(h1), -r.current * sign)
    add(strip(h2), r.current * sign)
  }
  const source = circuit.components.find((c) => c.kind === 'vsource')
  const src = source && result.components[source.id]
  if (src) {
    const [plus, minus] = SUPPLY_PINS[layout.supply](layout)
    add(strip(plus), src.current)
    add(strip(minus), -src.current)
  }

  // Spanning forest over the plain jumpers; post-order sums give each tree edge's current.
  const adj = new Map<string, { to: string; wire: (typeof plain)[number]; forward: boolean }[]>()
  for (const w of plain) {
    const [a, b] = [strip(w.from), strip(w.to)]
    out[w.id] = 0
    if (a === b) continue
    adj.set(a, [...(adj.get(a) ?? []), { to: b, wire: w, forward: true }])
    adj.set(b, [...(adj.get(b) ?? []), { to: a, wire: w, forward: false }])
  }
  const seen = new Set<string>()
  const usedWire = new Set<string>()
  const subtree = (s: string): number => {
    seen.add(s)
    let sum = inject.get(s) ?? 0
    for (const e of adj.get(s) ?? []) {
      if (usedWire.has(e.wire.id) || seen.has(e.to)) continue
      usedWire.add(e.wire.id)
      const below = subtree(e.to)
      // `below` flows out of the child towards s; forward means the wire runs s → child.
      out[e.wire.id] = e.forward ? -below : below
      sum += below
    }
    return sum
  }
  for (const s of adj.keys()) if (!seen.has(s)) subtree(s)
  return out
}

/** Wire's drawn height above its ends: longer runs arc higher. */
export const arcHeight = (span: number) => Math.min(20, Math.max(6, 0.3 * span))
/** Dupont housing height above the hole. */
export const HOUSING_H = 7.5
