// Inked isometric drawings of the bench's solids. Every function returns plain SVG for one camera.
import type { CSSProperties, ReactNode } from 'react'
import type { ComponentStatus } from '../../sim/types'
import { LED_COLORS } from '../describe'
import { resistorBands } from '../BreadboardView'
import type { BreadboardPart } from '../types'
import {
  type Box3,
  type Camera,
  type Pt,
  type Track,
  type Vec3,
  circlePoly,
  convexHull,
  cubicAt,
  cylinder,
  depthSort,
  f,
  groundMatrix,
  mix,
  poly,
  prism,
  project,
  rect,
  shade,
  track,
  unitScale,
  viewer,
} from './geom'
import {
  BAND_HEX,
  BATTERY,
  BOARD,
  CHANNEL,
  HEADER_H,
  HOUSING_H,
  type IsoPalette,
  P,
  UNO_HEADERS,
  UNO_SIZE,
  UZ,
  WIRE_HEX,
  Z0,
  arcHeight,
  boardHoles,
  holePoint,
  silk,
  uno,
} from './model'

/* ------------------------------------------------------------------ gradients */

/** Collects gradient definitions while a drawing is built; ids are unique per scene. */
export class Defs {
  private items = new Map<string, ReactNode>()
  private prefix: string
  constructor(prefix: string) {
    this.prefix = prefix
  }
  private id(key: string) {
    return `${this.prefix}-${key}`.replace(/[^a-zA-Z0-9_-]/g, '_')
  }
  /** Linear gradient: across the shape's box (x2, y2 direction), or in user space between two points. */
  linear(key: string, stops: [number, string, number?][], dir: { x2: number; y2: number } | { a: Pt; b: Pt } = { x2: 1, y2: 0 }): string {
    const id = this.id(key)
    if (!this.items.has(id)) {
      const geo =
        'a' in dir
          ? { gradientUnits: 'userSpaceOnUse' as const, x1: f(dir.a.x), y1: f(dir.a.y), x2: f(dir.b.x), y2: f(dir.b.y) }
          : { x1: 0, y1: 0, x2: dir.x2, y2: dir.y2 }
      this.items.set(
        id,
        <linearGradient key={id} id={id} {...geo}>
          {stops.map(([o, c, a], i) => (
            <stop key={i} offset={o} stopColor={c} stopOpacity={a ?? 1} />
          ))}
        </linearGradient>,
      )
    }
    return `url(#${id})`
  }
  radial(key: string, stops: [number, string, number?][]): string {
    const id = this.id(key)
    if (!this.items.has(id))
      this.items.set(
        id,
        <radialGradient key={id} id={id}>
          {stops.map(([o, c, a], i) => (
            <stop key={i} offset={o} stopColor={c} stopOpacity={a ?? 1} />
          ))}
        </radialGradient>,
      )
    return `url(#${id})`
  }
  list(): ReactNode {
    return <defs>{[...this.items.values()]}</defs>
  }
}

/* ------------------------------------------------------------------ primitives */

const matrix = (m: number[]) => `matrix(${m.map(f).join(' ')})`

interface SolidOpts {
  /** Fill for the top face (defaults to the base colour). */
  top?: string
  /** Round solid: side facets drawn seamlessly, ink only on the silhouette. */
  smooth?: boolean
  /** Metal: faces get a two-stop gradient. */
  metal?: Defs
  key?: string
}

/** An extruded ground polygon, inked: shaded sides, top, and a light line on the top's front edges. */
export function solid(cam: Camera, pts: Pt[], z0: number, z1: number, base: string, o: SolidOpts = {}): ReactNode {
  const faces = prism(cam, pts, z0, z1)
  const fill = (amount: number) =>
    o.metal ? o.metal.linear(`metal-${base}-${amount.toFixed(2)}`, [[0, shade(base, amount - 0.12)], [1, shade(base, amount + 0.1)]]) : shade(base, amount)
  const topFill = o.top ?? (o.metal ? fill(-0.05) : base)
  const hl = shade(base, -0.55)
  if (o.smooth) {
    const hull = convexHull([...faces.top, ...pts.map((p) => project(cam, p.x, p.y, z0))])
    return (
      <g key={o.key}>
        {faces.sides.map((s, i) => (
          <path key={i} d={poly(s.pts)} fill={fill(s.shade)} stroke={fill(s.shade)} strokeWidth={0.4} />
        ))}
        <path d={poly(hull)} fill="none" className="iso-ln" />
        <path d={poly(faces.top)} fill={topFill} className="iso-ln" />
      </g>
    )
  }
  return (
    <g key={o.key}>
      {faces.sides.map((s, i) => (
        <path key={i} d={poly(s.pts)} fill={fill(s.shade)} className="iso-ln" />
      ))}
      <path d={poly(faces.top)} fill={topFill} className="iso-ln" />
      {faces.frontEdges.length > 0 && (
        <path d={faces.frontEdges.map(([a, b]) => `M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}`).join('')} stroke={hl} className="iso-hl" fill="none" />
      )}
    </g>
  )
}

const box = (cam: Camera, b: Box3, base: string, o: SolidOpts = {}) => solid(cam, rect(b.x0, b.y0, b.x1, b.y1), b.z0, b.z1, base, o)

/** Horizontal gradient that shades a round surface like faces turning from left to right. */
function roundFill(defs: Defs, base: string, metal = false): string {
  const s = metal ? 0.12 : 0
  return defs.linear(`round-${base}-${metal}`, [
    [0, shade(base, 0.12 - s)],
    [0.3, shade(base, 0.04 - s)],
    [0.62, shade(base, 0.22)],
    [1, shade(base, 0.38)],
  ])
}

/** Vertical cylinder, inked. */
export function cyl(cam: Camera, defs: Defs, c: Pt, z0: number, z1: number, r: number, base: string, o: { top?: string; metal?: boolean; key?: string } = {}): ReactNode {
  const g = cylinder(cam, c.x, c.y, z0, z1, r)
  return (
    <g key={o.key}>
      <path d={g.side} fill={roundFill(defs, base, o.metal)} className="iso-ln" />
      <ellipse cx={f(g.top.x)} cy={f(g.top.y)} rx={f(g.rx)} ry={f(g.ry)} fill={o.top ?? (o.metal ? shade(base, -0.15) : base)} className="iso-ln" />
    </g>
  )
}

/** Contact shadow: one soft ellipse under a footprint, multiplied at 25 %. */
export function contactShadow(cam: Camera, defs: Defs, b: { x0: number; x1: number; y0: number; y1: number }, z: number, grow = 1.25): ReactNode {
  const fill = defs.radial('shadow', [
    [0, '#000000', 1],
    [0.55, '#000000', 0.7],
    [1, '#000000', 0],
  ])
  return (
    <ellipse
      className="iso-shadow"
      transform={matrix(groundMatrix(cam, z))}
      cx={f((b.x0 + b.x1) / 2)}
      cy={f((b.y0 + b.y1) / 2)}
      rx={f(((b.x1 - b.x0) / 2) * grow)}
      ry={f(((b.y1 - b.y0) / 2) * grow)}
      fill={fill}
    />
  )
}

/** Text printed flat on a surface at height z (model mm), reading along +x (or +y when `turn`). */
function print(cam: Camera, at: Pt, z: number, text: string, size: number, fill: string, o: { anchor?: 'start' | 'middle' | 'end'; turn?: boolean; key?: string; weight?: number } = {}): ReactNode {
  return (
    <text
      key={o.key ?? text + at.x + at.y}
      className="iso-print"
      transform={`${matrix(groundMatrix(cam, z))} translate(${f(at.x)} ${f(at.y)})${o.turn ? ' rotate(-90)' : ''}`}
      fontSize={size}
      fill={fill}
      textAnchor={o.anchor ?? 'middle'}
      dominantBaseline="central"
      fontWeight={o.weight}
    >
      {text}
    </text>
  )
}

/* ------------------------------------------------------------------ bench */

export function drawBench(cam: Camera, pal: IsoPalette, id: string): ReactNode {
  const m = matrix(groundMatrix(cam, 0))
  // A pool of grid round the bench that fades into the bench colour. Bounded on purpose: an
  // unbounded floor makes every camera layer huge to raster and composite.
  const c = { x: (BOARD.x0 + BOARD.x1) / 2, y: -4 }
  const r = { x: 150, y: 125 }
  return (
    <g className="iso-bench-floor" transform={m}>
      <defs>
        <pattern id={`${id}-grid`} width={10} height={10} patternUnits="userSpaceOnUse">
          <path d="M10 0H0V10" fill="none" stroke={pal.benchGrid} strokeWidth={0.22} />
        </pattern>
        <radialGradient id={`${id}-fade`}>
          <stop offset={0.45} stopColor={pal.bench} stopOpacity={0} />
          <stop offset={1} stopColor={pal.bench} stopOpacity={1} />
        </radialGradient>
      </defs>
      <ellipse cx={c.x} cy={c.y} rx={r.x} ry={r.y} fill={`url(#${id}-grid)`} />
      <ellipse cx={c.x} cy={c.y} rx={r.x + 0.5} ry={r.y + 0.5} fill={`url(#${id}-fade)`} />
    </g>
  )
}

/* ------------------------------------------------------------------ breadboard */

const colX = (c: number) => BOARD.x0 + 2 * P + (c - 1) * P

export function drawBoard(cam: Camera, pal: IsoPalette, defs: Defs): ReactNode {
  const hs = 0.6
  const holes = boardHoles()
    .map((h) => poly([project(cam, h.x - hs, h.y - hs, Z0), project(cam, h.x + hs, h.y - hs, Z0), project(cam, h.x + hs, h.y + hs, Z0), project(cam, h.x - hs, h.y + hs, Z0)]))
    .join('')
  const top = matrix(groundMatrix(cam, Z0))
  const stripe = (y: number, color: string) => <rect key={y} x={colX(1) - 0.6 * P} y={y - 0.11} width={29 * P + 1.2 * P} height={0.22} fill={color} />
  const prints: ReactNode[] = []
  for (const [y, flip] of [
    [4.0 * P, false],
    [16.85 * P, false],
  ] as const) {
    for (const c of [1, 5, 10, 15, 20, 25, 30]) prints.push(print(cam, { x: colX(c), y }, Z0, String(c), 1.45, pal.print, { key: `n${c}-${y}`, turn: flip }))
  }
  'abcdefghij'.split('').forEach((r, i) => {
    const y = (i < 5 ? 4.9 + i : 6.9 + i) * P
    prints.push(print(cam, { x: BOARD.x0 + 0.95 * P, y }, Z0, r, 1.45, pal.print, { key: `l${r}` }))
    prints.push(print(cam, { x: BOARD.x1 - 0.95 * P, y }, Z0, r, 1.45, pal.print, { key: `r${r}` }))
  })
  for (const [y, sign, color] of [
    [1.4 * P, '+', pal.railPos],
    [2.4 * P, '−', pal.railNeg],
    [18.4 * P, '−', pal.railNeg],
    [19.4 * P, '+', pal.railPos],
  ] as const) {
    prints.push(print(cam, { x: BOARD.x0 + 0.95 * P, y }, Z0, sign, 2, color, { key: `s${y}l`, weight: 700 }))
    prints.push(print(cam, { x: BOARD.x1 - 0.95 * P, y }, Z0, sign, 2, color, { key: `s${y}r`, weight: 700 }))
  }
  return (
    <g className="iso-board">
      {contactShadow(cam, defs, BOARD, 0, 1.12)}
      {box(cam, BOARD, pal.board)}
      {sideGroove(cam, BOARD, 4.6, shade(pal.board, 0.5))}
      <g transform={top}>
        <rect x={BOARD.x0 + 0.5} y={CHANNEL.y0} width={BOARD.x1 - BOARD.x0 - 1} height={CHANNEL.y1 - CHANNEL.y0} fill={shade(pal.board, 0.24)} />
        <rect x={BOARD.x0 + 0.5} y={CHANNEL.y0} width={BOARD.x1 - BOARD.x0 - 1} height={0.35} fill={shade(pal.board, 0.45)} />
        {stripe(0.75 * P, pal.railPos)}
        {stripe(3.05 * P, pal.railNeg)}
        {stripe(17.75 * P, pal.railNeg)}
        {stripe(20.05 * P, pal.railPos)}
      </g>
      <path d={holes} fill={pal.hole} />
      {prints}
    </g>
  )
}

/** A moulded groove round the visible sides of a box, at height z. */
function sideGroove(cam: Camera, b: Box3, z: number, color: string): ReactNode {
  const faces = prism(cam, rect(b.x0, b.y0, b.x1, b.y1), b.z0, z)
  const d = faces.frontEdges.map(([p, q]) => `M${f(p.x)} ${f(p.y)}L${f(q.x)} ${f(q.y)}`).join('')
  return <path d={d} stroke={color} strokeOpacity={0.55} fill="none" className="iso-groove" />
}

/* ------------------------------------------------------------------ Arduino Uno */

/** Real Uno rectangle (mm from its lower-left corner) as a bench Box3. */
function ur(xr0: number, yr0: number, xr1: number, yr1: number, z0: number, z1: number): Box3 {
  const a = uno(xr0, yr0)
  const b = uno(xr1, yr1)
  return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y), z0, z1 }
}

interface Piece {
  box: Box3
  node: ReactNode
}

export interface UnoDrawing {
  node: ReactNode
  /** Screen anchors for callouts: 'usb', 'power', 'chip'. */
  anchors: Record<string, Pt>
  outline: Pt[]
}

export function drawUno(cam: Camera, pal: IsoPalette, defs: Defs): UnoDrawing {
  const z1 = UZ
  const z0 = UNO_SIZE.lift
  const outlineReal: [number, number][] = [
    [0, 0],
    [66.04, 0],
    [68.6, 2.54],
    [68.6, 37.1],
    [66.04, 39.6],
    [66.04, 51.0],
    [63.8, 53.3],
    [0, 53.3],
  ]
  const pcbPoly = outlineReal.map(([x, y]) => uno(x, y))
  const g = matrix(groundMatrix(cam, z1))
  const pieces: Piece[] = []
  const add = (b: Box3, node: ReactNode) => pieces.push({ box: b, node })

  // USB-B jack: metal shell with the plug opening on the left edge.
  const usb = ur(-6.35, 31.75, 9.9, 43.8, z1, z1 + 10.9)
  add(
    usb,
    <g key="usb">
      {box(cam, usb, pal.metal, { metal: defs })}
      {wallOpening(cam, usb, 'x0', { y: (usb.y0 + usb.y1) / 2, z: z1 + 5.6, w: 8, h: 7.2 }, pal)}
    </g>,
  )
  // DC barrel jack.
  const dc = ur(-1.9, 3.3, 12.1, 12.3, z1, z1 + 10.9)
  add(
    dc,
    <g key="dc">
      {box(cam, dc, pal.plastic)}
      {wallCircle(cam, dc, 'x0', { y: (dc.y0 + dc.y1) / 2, z: z1 + 5.8, r: 3.2 }, pal)}
    </g>,
  )
  // Electrolytic capacitors beside the jack.
  for (const [i, xr] of [16.4, 23.2].entries()) {
    const c = uno(xr, 7.6)
    const b = { x0: c.x - 3.15, x1: c.x + 3.15, y0: c.y - 3.15, y1: c.y + 3.15, z0: z1, z1: z1 + 7.7 }
    add(
      b,
      <g key={`cap${i}`}>
        {box(cam, { x0: c.x - 3.3, x1: c.x + 3.3, y0: c.y - 3.3, y1: c.y + 3.3, z0: z1, z1: z1 + 0.9 }, pal.plastic)}
        {cyl(cam, defs, c, z1 + 0.9, z1 + 7.7, 3.0, pal.metal, { metal: true })}
        {capMark(cam, c, z1 + 7.7, pal)}
      </g>,
    )
  }
  // Voltage regulator (SOT-223) with its heat tab.
  const reg = ur(15, 13.4, 21.6, 17, z1, z1 + 1.7)
  const tab = ur(15.6, 17, 21, 19, z1, z1 + 0.5)
  add(tab, <g key="tab">{box(cam, tab, pal.metal, { metal: defs })}</g>)
  add(reg, <g key="reg">{box(cam, reg, pal.chip)}</g>)
  // ATmega328P in its socket.
  const socket = ur(28, 14.2, 63, 23.4, z1, z1 + 1.8)
  const chip = ur(28.7, 15.1, 62.3, 22.5, z1 + 1.8, z1 + 5.2)
  const legs: ReactNode[] = []
  for (let i = 0; i < 14; i++) {
    const xr = 30.3 + i * 2.54
    for (const [y0, y1] of [
      [14.5, 15.1],
      [22.5, 23.1],
    ])
      legs.push(<g key={`${i}-${y0}`}>{box(cam, ur(xr - 0.3, y0, xr + 0.3, y1, z1 + 1.8, z1 + 3.6), pal.metal)}</g>)
  }
  const notch = uno(29.6, 18.8)
  add(
    { ...socket, z1: chip.z1 },
    <g key="mcu">
      {box(cam, socket, shade(pal.plastic, -0.12))}
      {legs}
      {box(cam, chip, pal.chip)}
      <ellipse transform={matrix(groundMatrix(cam, chip.z1))} cx={f(notch.x)} cy={f(notch.y)} rx={0.9} ry={0.9} fill={shade(pal.chip, -0.25)} />
      <circle transform={matrix(groundMatrix(cam, chip.z1))} cx={f(uno(31.4, 16.4).x)} cy={f(uno(31.4, 16.4).y)} r={0.45} fill={shade(pal.chip, -0.3)} />
    </g>,
  )
  // Crystal can.
  const xc = uno(26.6, 34.3)
  const stadium = [...circlePoly(xc.x - 3.2, xc.y, 2.3, 16).filter((p) => p.x <= xc.x - 3.2), ...circlePoly(xc.x + 3.2, xc.y, 2.3, 16).filter((p) => p.x >= xc.x + 3.2)]
  const stadiumHull = convexHull(stadium)
  add({ x0: xc.x - 5.5, x1: xc.x + 5.5, y0: xc.y - 2.3, y1: xc.y + 2.3, z0: z1, z1: z1 + 3.5 }, <g key="xtal">{solid(cam, stadiumHull, z1, z1 + 3.5, pal.metal, { smooth: true, metal: defs })}</g>)
  // USB interface chip.
  const u2 = ur(13.4, 35, 18.4, 40, z1, z1 + 1)
  add(u2, <g key="u2">{box(cam, u2, pal.chip)}</g>)
  // Reset button.
  const rb = ur(3, 45.5, 9, 51.5, z1, z1 + 2)
  const rc = uno(6, 48.5)
  add(
    { ...rb, z1: z1 + 4.8 },
    <g key="reset">
      {box(cam, rb, pal.plastic)}
      {box(cam, ur(3.4, 45.9, 8.6, 51.1, z1 + 2, z1 + 2.6), pal.metal, { metal: defs })}
      {cyl(cam, defs, rc, z1 + 2.6, z1 + 4.8, 1.7, '#c8473f')}
    </g>,
  )
  // Programming headers (2 × 3 pins).
  const icsp = (key: string, xr: number, yr: number, alongX: boolean) => {
    const [cols, rows] = alongX ? [3, 2] : [2, 3]
    const b = ur(xr, yr, xr + cols * P, yr + rows * P, z1, z1 + 2.5)
    const pins: ReactNode[] = []
    for (let c = 0; c < cols; c++)
      for (let r = rows - 1; r >= 0; r--) {
        const p = uno(xr + (c + 0.5) * P, yr + (r + 0.5) * P)
        pins.push(<g key={`${c}${r}`}>{box(cam, { x0: p.x - 0.32, x1: p.x + 0.32, y0: p.y - 0.32, y1: p.y + 0.32, z0: z1 + 2.5, z1: z1 + 8.5 }, pal.metal, { metal: defs })}</g>)
      }
    add({ ...b, z1: z1 + 8.5 }, <g key={key}>{box(cam, b, pal.plastic)}{pins}</g>)
  }
  icsp('icsp1', 62.2, 25.6, false)
  icsp('icsp2', 19.6, 41.2, true)
  // Small SMD parts.
  const smd: [number, number, string][] = [
    [23.6, 26.4, '#c9b48a'],
    [23.6, 28.9, pal.chip],
    [44.5, 27.2, '#c9b48a'],
    [47.6, 27.2, pal.chip],
    [52.4, 27.2, '#c9b48a'],
    [11.6, 22.4, pal.chip],
    [11.6, 25.0, '#c9b48a'],
  ]
  smd.forEach(([xr, yr, c], i) => {
    const b = ur(xr - 0.8, yr - 0.4, xr + 0.8, yr + 0.4, z1, z1 + 0.55)
    add(b, <g key={`smd${i}`}>{box(cam, b, c)}</g>)
  })
  // Status LEDs: ON is lit while the board is powered.
  const leds: [string, number, number, boolean][] = [
    ['L', 29.6, 44.6, false],
    ['TX', 29.6, 42.4, false],
    ['RX', 29.6, 40.2, false],
    ['ON', 57.2, 33.6, true],
  ]
  const onGlow = defs.radial('on-glow', [
    [0, pal.ok, 0.85],
    [0.4, pal.ok, 0.3],
    [1, pal.ok, 0],
  ])
  for (const [name, xr, yr, lit] of leds) {
    const b = ur(xr - 0.8, yr - 0.4, xr + 0.8, yr + 0.4, z1, z1 + 0.6)
    const c = uno(xr, yr)
    add(
      b,
      <g key={`led${name}`}>
        {box(cam, b, lit ? mix(pal.ok, '#ffffff', 0.35) : '#e2cf8e')}
        {lit && <ellipse transform={matrix(groundMatrix(cam, z1 + 0.6))} cx={f(c.x)} cy={f(c.y)} rx={3.2} ry={3.2} fill={onGlow} className="iso-on-glow" />}
      </g>,
    )
  }
  // Female headers with their socket holes.
  for (const h of UNO_HEADERS) {
    const b = ur(h.x - 1.27, h.y - 1.27, h.x + (h.pins.length - 0.5) * P, h.y + 1.27, z1, z1 + HEADER_H)
    const holes = h.pins
      .map((_, i) => {
        const c = uno(h.x + i * P, h.y)
        const s = 0.5
        return poly([project(cam, c.x - s, c.y - s, b.z1), project(cam, c.x + s, c.y - s, b.z1), project(cam, c.x + s, c.y + s, b.z1), project(cam, c.x - s, c.y + s, b.z1)])
      })
      .join('')
    add(
      b,
      <g key={`hdr${h.x}${h.y}`}>
        {box(cam, b, pal.plastic)}
        <path d={holes} fill={pal.ink} />
      </g>,
    )
  }

  // Board-level art: traces (with the idle shimmer), mounting holes, silkscreen.
  const traces: [number, number][][] = [
    [[38.1, 4], [38.1, 9], [34.5, 12.4], [22.5, 12.4], [20, 13.4]],
    [[40.64, 4], [40.64, 10.5], [44, 13.6]],
    [[50.8, 4], [50.8, 10.6], [53.6, 13.6]],
    [[53.34, 4], [53.34, 9.4], [56.6, 12.6], [56.6, 13.8]],
    [[55.88, 4], [55.88, 8.6], [60.2, 12.8]],
    [[58.42, 4], [58.42, 8], [65, 13], [65, 24.5]],
    [[28.96, 49.2], [28.96, 45.2], [33, 41.2], [33, 24]],
    [[31.5, 49.2], [31.5, 46], [36.4, 41.1], [36.4, 24]],
    [[34.04, 49.2], [34.04, 46.8], [39.6, 41.2], [39.6, 24]],
    [[45.72, 49.2], [45.72, 44], [42.8, 41], [42.8, 24]],
    [[48.26, 49.2], [48.26, 43], [46, 40.6], [46, 24]],
    [[50.8, 49.2], [50.8, 42.2], [49.2, 40.6], [49.2, 24]],
    [[9.9, 36.2], [13.4, 36.2]],
    [[9.9, 38.8], [13.4, 38.8]],
    [[18.4, 37.5], [21.2, 37.5], [21.2, 34.3]],
    [[12.1, 7.6], [13.2, 7.6]],
    [[2.4, 15], [2.4, 29.6], [8, 29.6]],
  ]
  const traceD = traces.map((t) => 'M' + t.map(([x, y]) => {
    const p = uno(x, y)
    return `${f(p.x)} ${f(p.y)}`
  }).join('L')).join('')
  const mounts = [
    [14, 2.54],
    [15.24, 50.8],
    [66.04, 7.62],
    [66.04, 35.56],
  ].map(([x, y]) => uno(x, y))
  const silkPrints: ReactNode[] = []
  for (const h of UNO_HEADERS) {
    const front = h.y < 10
    h.pins.forEach((pin, i) => {
      if (pin === 'NC') return
      const c = uno(h.x + i * P, h.y + (front ? 4.4 : -4.4))
      silkPrints.push(print(cam, c, z1, silk(pin), 1.05, pal.silk, { key: `${h.x}${pin}${i}`, turn: true, anchor: 'middle' }))
    })
  }
  silkPrints.push(print(cam, uno(36.8, 10.4), z1, 'POWER', 1.4, pal.silk, { key: 'pw', weight: 600 }))
  silkPrints.push(print(cam, uno(57.2, 10.4), z1, 'ANALOG IN', 1.4, pal.silk, { key: 'an', weight: 600 }))
  silkPrints.push(print(cam, uno(43.5, 40.8), z1, 'DIGITAL', 1.4, pal.silk, { key: 'dg', weight: 600 }))
  for (const [name, xr, yr] of leds) silkPrints.push(print(cam, uno(xr + (name === 'ON' ? -2.4 : 2.2), yr), z1, name, 0.95, pal.silk, { key: `s${name}` }))

  const sorted = depthSortPieces(cam, pieces)
  const pcbBox = ur(0, 0, 68.6, 53.3, z0, z1)
  const bounds = ur(-6.35, 0, 68.6, 53.3, 0, z1 + 10.9)
  return {
    node: (
      <g className="iso-uno">
        {contactShadow(cam, defs, pcbBox, 0, 1.12)}
        {solid(cam, pcbPoly, z0, z1, pal.pcb)}
        <g transform={g}>
          <path className="iso-traces" d={traceD} fill="none" stroke={pal.trace} strokeWidth={0.42} strokeLinecap="round" strokeLinejoin="round" />
          {mounts.map((m, i) => (
            <g key={i}>
              <circle cx={f(m.x)} cy={f(m.y)} r={1.7} fill={shade(pal.metal, 0.1)} />
              <circle cx={f(m.x)} cy={f(m.y)} r={1.05} fill={pal.ink} />
            </g>
          ))}
        </g>
        {silkPrints}
        {sorted}
      </g>
    ),
    anchors: {
      usb: project(cam, (usb.x0 + usb.x1) / 2, (usb.y0 + usb.y1) / 2, usb.z1),
      chip: project(cam, (chip.x0 + chip.x1) / 2, (chip.y0 + chip.y1) / 2, chip.z1),
    },
    outline: corners(cam, bounds),
  }
}

const depthSortPieces = (cam: Camera, pieces: Piece[]): ReactNode[] => depthSort(cam, pieces, (p) => p.box).map((p) => p.node)

/** The 8 projected corners of a box (for outlines and obstacle boxes). */
export function corners(cam: Camera, b: Box3): Pt[] {
  const out: Pt[] = []
  for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) out.push(project(cam, x, y, z))
  return out
}

/** A dark rectangular opening on a vertical wall of a box (only drawn when that wall faces the camera). */
function wallOpening(cam: Camera, b: Box3, wall: 'x0', o: { y: number; z: number; w: number; h: number }, pal: IsoPalette): ReactNode {
  if (wall === 'x0' && viewer(cam).x >= 0) return null
  const x = b.x0 - 0.01
  const pts = [
    project(cam, x, o.y - o.w / 2, o.z - o.h / 2),
    project(cam, x, o.y + o.w / 2, o.z - o.h / 2),
    project(cam, x, o.y + o.w / 2, o.z + o.h / 2 - 1.6),
    project(cam, x, o.y + o.w / 2 - 1.6, o.z + o.h / 2),
    project(cam, x, o.y - o.w / 2 + 1.6, o.z + o.h / 2),
    project(cam, x, o.y - o.w / 2, o.z + o.h / 2 - 1.6),
  ]
  const tongue = [project(cam, x, o.y - 2.2, o.z - 1.2), project(cam, x, o.y + 2.2, o.z - 1.2), project(cam, x, o.y + 2.2, o.z + 1.4), project(cam, x, o.y - 2.2, o.z + 1.4)]
  return (
    <g>
      <path d={poly(pts)} fill={pal.ink} className="iso-ln" />
      <path d={poly(tongue)} fill={shade(pal.metal, 0.5)} />
    </g>
  )
}

/** A round opening on the x0 wall (the barrel jack's socket). */
function wallCircle(cam: Camera, b: Box3, wall: 'x0', o: { y: number; z: number; r: number }, pal: IsoPalette): ReactNode {
  if (wall === 'x0' && viewer(cam).x >= 0) return null
  const x = b.x0 - 0.01
  const ring = (r: number) => Array.from({ length: 24 }, (_, i) => project(cam, x, o.y + Math.cos((i / 24) * Math.PI * 2) * r, o.z + Math.sin((i / 24) * Math.PI * 2) * r))
  const pin = project(cam, x, o.y, o.z)
  return (
    <g>
      <path d={poly(ring(o.r))} fill={pal.ink} className="iso-ln" />
      <circle cx={f(pin.x)} cy={f(pin.y)} r={f(0.9 * unitScale(cam))} fill={pal.metal} />
    </g>
  )
}

/** The polarity mark on top of an SMD electrolytic: a dark segment on the − side. */
function capMark(cam: Camera, c: Pt, z: number, pal: IsoPalette): ReactNode {
  return (
    <g transform={matrix(groundMatrix(cam, z))}>
      <path d={`M${f(c.x - 2.9)} ${f(c.y + 0.6)}A3 3 0 0 0 ${f(c.x + 2.9)} ${f(c.y + 0.6)}Z`} fill={pal.plastic} opacity={0.85} />
      <path d={`M${f(c.x - 1.4)} ${f(c.y - 0.6)}H${f(c.x + 1.4)}M${f(c.x)} ${f(c.y - 2)}V${f(c.y + 0.6)}`} stroke={shade(pal.metal, 0.35)} strokeWidth={0.3} />
    </g>
  )
}

/* ------------------------------------------------------------------ 9 V battery */

export function drawBattery(cam: Camera, pal: IsoPalette, defs: Defs): ReactNode {
  const b = BATTERY
  const label = { ...b, z0: b.z0, z1: b.z1 }
  const snapC = { x: (b.x0 + b.x1) / 2, y: b.y0 + 6 }
  return (
    <g className="iso-battery">
      {contactShadow(cam, defs, b, 0, 1.12)}
      {box(cam, label, '#2a3242')}
      {box(cam, { x0: b.x0 + 1, x1: b.x1 - 1, y0: b.y0 + 14, y1: b.y1 - 4, z0: b.z1, z1: b.z1 + 0.05 }, '#e8b23a')}
      {box(cam, { x0: snapC.x - 10, x1: snapC.x + 10, y0: snapC.y - 3.5, y1: snapC.y + 3.5, z0: b.z1, z1: b.z1 + 3 }, pal.plastic)}
    </g>
  )
}

/* ------------------------------------------------------------------ parts on the board */

export interface PartState {
  status?: ComponentStatus
  brightness?: number
}

export interface DrawnPart {
  id: string
  kind: BreadboardPart['kind']
  box: Box3
  shadow: ReactNode
  body: ReactNode
  /** Screen points whose hull is the part's silhouette (focus ring, callout obstacle). */
  outline: Pt[]
  anchors: Record<string, Pt>
  /** LEDs: where the light comes from (screen), lens radius (screen), colour, and the board point under it. */
  light?: { at: Pt; r: number; color: string; floor: Vec3 }
  /** Jumpers: the path current pulses follow, from `from` to `to`. */
  track?: Track
}

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t })
const at = (p: Pt | Vec3, z: number): Vec3 => ({ x: p.x, y: p.y, z })
const pathOf = (pts: Pt[]) => 'M' + pts.map((p) => `${f(p.x)} ${f(p.y)}`).join('L')

/** A metal lead (polyline in model space): inked, with a two-stop gradient along it. */
function lead(cam: Camera, defs: Defs, key: string, pts: Vec3[], pal: IsoPalette): ReactNode {
  const s = pts.map((p) => project(cam, p.x, p.y, p.z))
  const w = Math.max(1.3, 0.55 * unitScale(cam))
  const grad = defs.linear(`lead-${key}`, [[0, shade(pal.metal, -0.25)], [1, shade(pal.metal, 0.3)]], { a: s[0], b: s[s.length - 1] })
  const d = pathOf(s)
  return (
    <g key={key}>
      <path d={d} className="iso-under" style={{ '--w': `${f(w)}px` } as CSSProperties} />
      <path d={d} stroke={grad} strokeWidth={f(w)} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

/** Unit vector perpendicular to a screen segment, pointing down the screen. */
function downNormal(a: Pt, b: Pt): Pt {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
  let n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len }
  if (n.y < 0 || (Math.abs(n.y) < 1e-6 && n.x < 0)) n = { x: -n.x, y: -n.y }
  return n
}

/**
 * An axial body (resistor, diode) from screen point a to b: inked capsule with end bulbs, colour
 * bands, then one shade stripe and one highlight over everything so bands shade like the body.
 */
function axialBody(a: Pt, b: Pt, width: number, base: string, bands: { t: number; color: string; w?: number }[], bulbs: boolean): ReactNode {
  const n = downNormal(a, b)
  const L = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const u = { x: (b.x - a.x) / L, y: (b.y - a.y) / L }
  const pt = (t: number, off = 0) => ({ x: a.x + u.x * L * t + n.x * off, y: a.y + u.y * L * t + n.y * off })
  const seg = (t0: number, t1: number, off = 0) => pathOf([pt(t0, off), pt(t1, off)])
  const bulbW = bulbs ? width * 1.2 : width
  const ends = bulbs ? [seg(0, 0.2), seg(0.8, 1)] : []
  return (
    <g>
      <path d={seg(0, 1)} className="iso-under" style={{ '--w': `${f(width)}px` } as CSSProperties} />
      {ends.map((d, i) => (
        <path key={i} d={d} className="iso-under" style={{ '--w': `${f(bulbW)}px` } as CSSProperties} />
      ))}
      <path d={seg(0, 1)} stroke={base} strokeWidth={f(width)} strokeLinecap="round" fill="none" />
      {ends.map((d, i) => (
        <path key={i} d={d} stroke={base} strokeWidth={f(bulbW)} strokeLinecap="round" fill="none" />
      ))}
      {bands.map((band, i) => (
        <path key={i} d={seg(band.t - (band.w ?? 0.05), band.t + (band.w ?? 0.05))} stroke={band.color} strokeWidth={f(band.t < 0.2 || band.t > 0.8 ? bulbW : width)} fill="none" />
      ))}
      <path d={seg(0.06, 0.94, width * 0.3)} stroke="#000" strokeOpacity={0.26} strokeWidth={f(width * 0.36)} fill="none" strokeLinecap="round" />
      <path d={seg(0.1, 0.9, -width * 0.24)} stroke="#fff" strokeOpacity={0.5} strokeWidth={f(Math.max(0.75, width * 0.12))} fill="none" strokeLinecap="round" />
    </g>
  )
}

function axial(cam: Camera, pal: IsoPalette, defs: Defs, part: Extract<BreadboardPart, { kind: 'resistor' | 'diode' }>, state: PartState): DrawnPart {
  const isR = part.kind === 'resistor'
  const [h1, h2] = isR ? [holePoint(part.from), holePoint(part.to)] : [holePoint(part.anode), holePoint(part.cathode)]
  const r = isR ? 1.2 : 1.35
  const len = isR ? 6.3 : 5.2
  const span = Math.hypot(h2.x - h1.x, h2.y - h1.y)
  const us = unitScale(cam)
  let e1: Vec3
  let e2: Vec3
  let leads: Vec3[][]
  if (span >= len + 1.4) {
    // Lying flat, leads bent down into the holes.
    const zc = Z0 + r + 1.1
    const d = { x: (h2.x - h1.x) / span, y: (h2.y - h1.y) / span }
    const m = lerp3(h1, h2, 0.5)
    e1 = { x: m.x - (d.x * len) / 2, y: m.y - (d.y * len) / 2, z: zc }
    e2 = { x: m.x + (d.x * len) / 2, y: m.y + (d.y * len) / 2, z: zc }
    leads = [
      [h1, at(h1, zc - 0.5), lerp3(at(h1, zc), e1, 0.35), e1],
      [e2, lerp3(e2, at(h2, zc), 0.65), at(h2, zc - 0.5), h2],
    ]
  } else {
    // Too close to lie flat: stood on end over the first hole, the top lead looped over to the second.
    e1 = at(h1, Z0 + 1.6)
    e2 = at(h1, Z0 + 1.6 + len)
    const top = Z0 + len + 3.4
    leads = [
      [h1, e1],
      [e2, at(h1, top), at(lerp3(h1, h2, 0.5), top + 0.6), at(h2, top), h2],
    ]
  }
  const a = project(cam, e1.x, e1.y, e1.z)
  const b = project(cam, e2.x, e2.y, e2.z)
  const burnt = state.status === 'burnt'
  const hot = state.status === 'overpower'
  let bands: { t: number; color: string; w?: number }[]
  let base: string
  if (isR) {
    base = pal.resistor
    const codes = resistorBands(part.ohms)
    const ts = codes.length === 1 ? [0.5] : codes.length === 5 ? [0.17, 0.31, 0.45, 0.59, 0.84] : [0.2, 0.36, 0.52, 0.82]
    bands = codes.map((c, i) => ({ t: ts[i], color: BAND_HEX[c], w: codes.length === 1 ? 0.07 : 0.045 }))
  } else {
    base = '#2a2c33'
    bands = [{ t: 0.84, color: BAND_HEX.silver, w: 0.06 }]
  }
  const body = (
    <g className="iso-body">
      {leads.map((l, i) => lead(cam, defs, `${part.id}-${i}`, l, pal))}
      {axialBody(a, b, Math.max(4, 2 * r * us), base, bands, isR)}
      {burnt && <path d={pathOf([a, b])} stroke="#1b1311" strokeOpacity={0.85} strokeWidth={f(2 * r * us * 1.1)} strokeLinecap="round" />}
      {hot && <path d={pathOf([a, b])} className="iso-hot" stroke="#ff7a3c" strokeOpacity={0.35} strokeWidth={f(2 * r * us)} strokeLinecap="round" />}
    </g>
  )
  const all = [...leads.flat()]
  const bx = boxOf3(all, r)
  return {
    id: part.id,
    kind: part.kind,
    box: { ...bx, z0: Z0 },
    shadow: contactShadow(cam, defs, padBox(bx, 0.8), Z0, 1.15),
    body,
    outline: all.flatMap((p) => [project(cam, p.x, p.y, p.z - r), project(cam, p.x, p.y, p.z + r)]),
    anchors: {
      top: project(cam, (e1.x + e2.x) / 2, (e1.y + e2.y) / 2, Math.max(e1.z, e2.z) + r),
      from: project(cam, h1.x, h1.y, Z0 + 0.6),
      to: project(cam, h2.x, h2.y, Z0 + 0.6),
    },
  }
}

const boxOf3 = (pts: Vec3[], pad = 0): Box3 => ({
  x0: Math.min(...pts.map((p) => p.x)) - pad,
  x1: Math.max(...pts.map((p) => p.x)) + pad,
  y0: Math.min(...pts.map((p) => p.y)) - pad,
  y1: Math.max(...pts.map((p) => p.y)) + pad,
  z0: Math.min(...pts.map((p) => p.z)) - pad,
  z1: Math.max(...pts.map((p) => p.z)) + pad,
})
const padBox = (b: Box3, p: number) => ({ x0: b.x0 - p, x1: b.x1 + p, y0: b.y0 - p, y1: b.y1 + p })

function led(cam: Camera, pal: IsoPalette, defs: Defs, part: Extract<BreadboardPart, { kind: 'led' }>, state: PartState): DrawnPart {
  const ha = holePoint(part.anode)
  const hc = holePoint(part.cathode)
  const span = Math.hypot(hc.x - ha.x, hc.y - ha.y) || 1
  const d = { x: (hc.x - ha.x) / span, y: (hc.y - ha.y) / span }
  const perp = { x: -d.y, y: d.x }
  const m = lerp3(ha, hc, 0.5)
  const zb = Z0 + 5.6
  const us = unitScale(cam)
  const hex = LED_COLORS[part.color]
  // Legs: the anode is 3 mm longer, so it carries a visible kink.
  const a0 = { x: m.x - d.x * 1.27, y: m.y - d.y * 1.27, z: zb }
  const c0 = { x: m.x + d.x * 1.27, y: m.y + d.y * 1.27, z: zb }
  const a1 = at(a0, zb - 1)
  const kink = lerp3(a1, ha, 0.42)
  const kinked = { x: kink.x + perp.x * 1.5 - d.x * 0.7, y: kink.y + perp.y * 1.5 - d.y * 0.7, z: kink.z }
  const legs = [lead(cam, defs, `${part.id}-k`, [c0, at(c0, zb - 1), hc], pal), lead(cam, defs, `${part.id}-a`, [a0, a1, kinked, lerp3(a1, ha, 0.7), ha], pal)]
  // Flange with the flat on the cathode side, then the lens: cylinder and dome.
  const lensOff = mix(shade(hex, 0.28), pal.bench, 0.25)
  const rim = solid(cam, circlePoly(m.x, m.y, 3.0, 36, { dir: d, at: 2.2 }), zb, zb + 1, lensOff, { smooth: true })
  const g = cylinder(cam, m.x, m.y, zb + 1, zb + 6.1, 2.5)
  const R = g.rx
  const lensPath =
    `M${f(g.bottom.x - R)} ${f(g.bottom.y)}A${f(R)} ${f(g.ry)} 0 0 0 ${f(g.bottom.x + R)} ${f(g.bottom.y)}` +
    `L${f(g.top.x + R)} ${f(g.top.y)}A${f(R)} ${f(R)} 0 0 0 ${f(g.top.x - R)} ${f(g.top.y)}Z`
  const lensFill = defs.linear(`lens-${part.color}`, [
    [0, mix(lensOff, '#ffffff', 0.2)],
    [0.45, lensOff],
    [1, shade(lensOff, 0.35)],
  ])
  const litFill = defs.linear(`lit-${part.color}`, [
    [0, mix(hex, '#ffffff', 0.75)],
    [0.5, mix(hex, '#ffffff', 0.35)],
    [1, hex],
  ])
  const b = Math.max(0, Math.min(1, state.brightness ?? 0))
  const burnt = state.status === 'burnt'
  // The die inside: anvil (cathode side, wider) and post, seen through the epoxy.
  const die = (dx: number, w: number, h: number) => {
    const p0 = project(cam, m.x + d.x * dx, m.y + d.y * dx, zb + 0.6)
    const p1 = project(cam, m.x + d.x * dx, m.y + d.y * dx, zb + h)
    return <path d={pathOf([p0, p1])} stroke={shade(hex, 0.62)} strokeOpacity={0.5} strokeWidth={f(w * us)} strokeLinecap="round" />
  }
  const top = { x: g.top.x, y: g.top.y - R }
  const body = (
    <g className="iso-body">
      {legs}
      {rim}
      <g className="iso-lens">
        <path d={lensPath} fill={lensFill} />
        {die(-0.7, 0.45, 3.6)}
        {die(0.65, 1.0, 3.2)}
        <path d={lensPath} fill={litFill} className="iso-lit" style={{ opacity: burnt ? 0 : b }} />
        <path d={lensPath} fill="#17100e" className="iso-dead" style={{ opacity: burnt ? 0.88 : 0 }} />
        <path d={lensPath} fill="none" className="iso-ln" />
        <path
          d={`M${f(g.top.x - R * 0.62)} ${f(g.bottom.y - R * 0.2)}L${f(g.top.x - R * 0.62)} ${f(g.top.y)}A${f(R * 0.62)} ${f(R * 0.62)} 0 0 1 ${f(g.top.x - R * 0.05)} ${f(g.top.y - R * 0.6)}`}
          fill="none"
          stroke="#fff"
          strokeOpacity={0.55}
          strokeWidth={f(Math.max(0.8, R * 0.16))}
          strokeLinecap="round"
        />
      </g>
    </g>
  )
  const legPts = [ha, hc, a0, c0, kinked]
  const bx = boxOf3([...legPts, { x: m.x - 2.9, y: m.y - 2.9, z: zb }, { x: m.x + 2.9, y: m.y + 2.9, z: zb + 8.6 }])
  return {
    id: part.id,
    kind: 'led',
    box: { ...bx, z0: Z0 },
    shadow: contactShadow(cam, defs, padBox({ ...bx, z0: 0, z1: 0 }, 0.5), Z0, 1.1),
    body,
    outline: [...legPts.map((p) => project(cam, p.x, p.y, p.z)), { x: g.top.x - R, y: g.top.y - R }, { x: g.top.x + R, y: g.top.y - R }, { x: g.bottom.x - R, y: g.bottom.y + g.ry }, { x: g.bottom.x + R, y: g.bottom.y + g.ry }],
    anchors: {
      top,
      anode: project(cam, kinked.x, kinked.y, kinked.z),
      cathode: project(cam, (c0.x + hc.x) / 2, (c0.y + hc.y) / 2, (zb - 1 + Z0) / 2),
    },
    light: { at: project(cam, m.x, m.y, zb + 5.2), r: R, color: hex, floor: { x: m.x, y: m.y, z: Z0 } },
  }
}

function wire(cam: Camera, pal: IsoPalette, part: Extract<BreadboardPart, { kind: 'wire' }>): DrawnPart {
  const ea = holePoint(part.from)
  const eb = holePoint(part.to)
  const us = unitScale(cam)
  const span = Math.hypot(eb.x - ea.x, eb.y - ea.y)
  const p0 = at(ea, ea.z + HOUSING_H)
  const p3 = at(eb, eb.z + HOUSING_H)
  const h = arcHeight(span)
  const p1 = at(p0, p0.z + h)
  const p2 = at(p3, p3.z + h)
  const [s0, s1, s2, s3] = [p0, p1, p2, p3].map((p) => project(cam, p.x, p.y, p.z))
  const d = `M${f(s0.x)} ${f(s0.y)}C${f(s1.x)} ${f(s1.y)} ${f(s2.x)} ${f(s2.y)} ${f(s3.x)} ${f(s3.y)}`
  const w = Math.max(2.2, 1.45 * us)
  const hex = WIRE_HEX[part.color]
  const housing = (e: Vec3, key: string) => (
    <g key={key}>
      {box(cam, { x0: e.x - 0.32, x1: e.x + 0.32, y0: e.y - 0.32, y1: e.y + 0.32, z0: e.z - 0.2, z1: e.z + 1.2 }, pal.metal)}
      {box(cam, { x0: e.x - 1.25, x1: e.x + 1.25, y0: e.y - 1.25, y1: e.y + 1.25, z0: e.z + 1.2, z1: e.z + HOUSING_H }, pal.plastic)}
      {box(cam, { x0: e.x - 1.25, x1: e.x + 1.25, y0: e.y - 1.25, y1: e.y + 1.25, z0: e.z + HOUSING_H - 0.01, z1: e.z + HOUSING_H }, pal.plastic, { top: shade(hex, 0.15) })}
    </g>
  )
  const housings = depthSortPieces(cam, [
    { box: { x0: ea.x - 1.25, x1: ea.x + 1.25, y0: ea.y - 1.25, y1: ea.y + 1.25, z0: ea.z, z1: ea.z + HOUSING_H }, node: housing(ea, 'a') },
    { box: { x0: eb.x - 1.25, x1: eb.x + 1.25, y0: eb.y - 1.25, y1: eb.y + 1.25, z0: eb.z, z1: eb.z + HOUSING_H }, node: housing(eb, 'b') },
  ])
  const n = downNormal(s0, s3)
  const body = (
    <g className="iso-body">
      {housings}
      <g className="iso-cable">
        <path d={d} className="iso-under iso-draw" pathLength={1} style={{ '--w': `${f(w)}px` } as CSSProperties} />
        <path d={d} className="iso-draw" pathLength={1} stroke={hex} strokeWidth={f(w)} fill="none" strokeLinecap="round" />
        <path d={d} className="iso-draw" pathLength={1} transform={`translate(${f(n.x * w * 0.26)} ${f(n.y * w * 0.26)})`} stroke="#000" strokeOpacity={0.22} strokeWidth={f(w * 0.4)} fill="none" strokeLinecap="round" />
        <path d={d} className="iso-draw" pathLength={1} transform={`translate(${f(-n.x * w * 0.22 - 0.3)} ${f(-n.y * w * 0.22)})`} stroke="#fff" strokeOpacity={0.45} strokeWidth={f(Math.max(0.7, w * 0.16))} fill="none" strokeLinecap="round" />
      </g>
    </g>
  )
  const curve = Array.from({ length: 33 }, (_, i) => cubicAt(p0, p1, p2, p3, i / 32))
  const trackPts = curve.map((p) => project(cam, p.x, p.y, p.z))
  const mid = cubicAt(p0, p1, p2, p3, 0.5)
  const bx = boxOf3([ea, eb, ...curve], 1.3)
  return {
    id: part.id,
    kind: 'wire',
    box: bx,
    shadow: null,
    body,
    outline: [...trackPts, ...corners(cam, { x0: ea.x - 1.25, x1: ea.x + 1.25, y0: ea.y - 1.25, y1: ea.y + 1.25, z0: ea.z, z1: ea.z + HOUSING_H }), ...corners(cam, { x0: eb.x - 1.25, x1: eb.x + 1.25, y0: eb.y - 1.25, y1: eb.y + 1.25, z0: eb.z, z1: eb.z + HOUSING_H })],
    anchors: { top: project(cam, mid.x, mid.y, mid.z + 0.8), from: project(cam, ea.x, ea.y, ea.z + HOUSING_H * 0.5), to: project(cam, eb.x, eb.y, eb.z + HOUSING_H * 0.5) },
    track: track(trackPts),
  }
}

export function drawPart(cam: Camera, pal: IsoPalette, defs: Defs, part: BreadboardPart, state: PartState): DrawnPart {
  switch (part.kind) {
    case 'resistor':
    case 'diode':
      return axial(cam, pal, defs, part, state)
    case 'led':
      return led(cam, pal, defs, part, state)
    case 'wire':
      return wire(cam, pal, part)
  }
}

/** Model points that bound the whole bench (for fitting the camera). */
export function benchPoints(parts: BreadboardPart[], supply: 'uno' | 'battery9v'): Vec3[] {
  const pts: Vec3[] = []
  const add = (b: Box3) => {
    for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) pts.push({ x, y, z })
  }
  add(BOARD)
  if (supply === 'uno') add(ur(-6.35, 0, 68.6, 53.3, 0, UZ + 10.9))
  else add(BATTERY)
  for (const p of parts) {
    if (p.kind !== 'wire') continue
    const a = holePoint(p.from)
    const b = holePoint(p.to)
    const h = arcHeight(Math.hypot(b.x - a.x, b.y - a.y))
    pts.push(at(a, a.z + HOUSING_H + h * 0.75), at(b, b.z + HOUSING_H + h * 0.75))
  }
  return pts
}

