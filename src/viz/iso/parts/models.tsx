// One isometric model per PartId, at true scale, each with exactly the hotspot anchors PART_ANCHORS lists.
// Models live in model millimetres (z up); the viewer fits a camera to `bounds`.
import type { CSSProperties, ReactNode } from 'react'
import { PART_ANCHORS, type PartId } from '../../../content/types'
import { resistorBands } from '../../BreadboardView'
import {
  type Defs,
  type Piece,
  axialBody,
  box,
  contactShadow,
  cyl,
  depthSortPieces,
  downNormal,
  drawBoard,
  drawUno,
  lead,
  ledHead,
  matrix,
  pathOf,
  print,
  solid,
  ur,
} from '../draw'
import { type Box3, type Camera, type Pt, type Vec3, circlePoly, convexHull, cubicAt, cylinder, f, groundMatrix, project, shade, unitScale, viewer } from '../geom'
import { BAND_HEX, BOARD, CHANNEL, type IsoPalette, P, UZ, WIRE_HEX, Z0, holePoint, uno } from '../model'
import { drawEsp32, esp32Anchors, esp32Bounds, type Place } from './esp32'

export interface PartModel {
  id: PartId
  /** Bounds of the part in model mm, for fitting the camera. */
  bounds: Box3
  /** One model point per anchor, on the feature it names: exactly PART_ANCHORS[id]. */
  anchors: Record<string, Vec3>
  draw(cam: Camera, pal: IsoPalette, defs: Defs): ReactNode
  /** How far the viewer zooms in on a hotspot, as a multiple of the whole-part fit (default 2.2). */
  focusZoom?: number
}

const a3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z })

/* ------------------------------------------------------------------ shared bits */

/** A round cable along a cubic Bézier in model space: inked, coloured, with a highlight. */
function cable(cam: Camera, p: [Vec3, Vec3, Vec3, Vec3], color: string, mm: number, key?: string): ReactNode {
  const [s0, s1, s2, s3] = p.map((q) => project(cam, q.x, q.y, q.z))
  const d = `M${f(s0.x)} ${f(s0.y)}C${f(s1.x)} ${f(s1.y)} ${f(s2.x)} ${f(s2.y)} ${f(s3.x)} ${f(s3.y)}`
  const w = Math.max(1.6, mm * unitScale(cam))
  const n = downNormal(s0, s3)
  return (
    <g key={key}>
      <path d={d} className="iso-under" style={{ '--w': `${f(w)}px` } as CSSProperties} />
      <path d={d} stroke={color} strokeWidth={f(w)} fill="none" strokeLinecap="round" />
      <path d={d} transform={`translate(${f(-n.x * w * 0.22)} ${f(-n.y * w * 0.22)})`} stroke="#fff" strokeOpacity={0.4} strokeWidth={f(Math.max(0.6, w * 0.16))} fill="none" strokeLinecap="round" />
    </g>
  )
}

/** A horizontal axial body (resistor, diode) with straight leads, lying on the bench along x. */
function axialPart(cam: Camera, pal: IsoPalette, defs: Defs, key: string, len: number, r: number, leadLen: number, base: string, bands: { t: number; color: string; w?: number }[], bulbs: boolean): ReactNode {
  const z = r
  const e1 = a3(-len / 2, 0, z)
  const e2 = a3(len / 2, 0, z)
  const [a, b] = [e1, e2].map((p) => project(cam, p.x, p.y, p.z))
  return (
    <g>
      {contactShadow(cam, defs, { x0: -len / 2 - 2, x1: len / 2 + 2, y0: -r - 1, y1: r + 1 }, 0, 1.1)}
      {lead(cam, defs, `${key}-l`, [a3(-len / 2 - leadLen, 0, 0.35), e1], pal)}
      {lead(cam, defs, `${key}-r`, [e2, a3(len / 2 + leadLen, 0, 0.35)], pal)}
      {axialBody(a, b, Math.max(4, 2 * r * unitScale(cam)), base, bands, bulbs)}
    </g>
  )
}

/** A dark square socket opening on the +x end face of a box (seen only when that face is towards the camera). */
function endSocket(cam: Camera, b: Box3, pal: IsoPalette, s = 0.6): ReactNode {
  if (viewer(cam).x <= 0) return null
  const x = b.x1 + 0.01
  const cy = (b.y0 + b.y1) / 2
  const cz = (b.z0 + b.z1) / 2
  const pts = [project(cam, x, cy - s, cz - s), project(cam, x, cy + s, cz - s), project(cam, x, cy + s, cz + s), project(cam, x, cy - s, cz + s)]
  return <path d={'M' + pts.map((p) => `${f(p.x)} ${f(p.y)}`).join('L') + 'Z'} fill={pal.ink} />
}

/* ------------------------------------------------------------------ boards */

const UNO_HEIGHT = UZ + 10.9
const unoModel: PartModel = {
  id: 'arduino-uno',
  focusZoom: 3.2,
  bounds: ur(-6.35, 0, 68.6, 53.3, 0, UNO_HEIGHT),
  anchors: (() => {
    const p = (xr: number, yr: number, z: number) => ({ ...uno(xr, yr), z })
    return {
      usb: p(1.8, 37.8, UZ + 10.9),
      'barrel-jack': p(5.1, 7.8, UZ + 10.9),
      regulator: p(18.3, 15.2, UZ + 1.7),
      atmega328p: p(45.5, 18.8, UZ + 5.2),
      crystal: p(26.6, 34.3, UZ + 3.5),
      'reset-button': p(6, 48.5, UZ + 4.8),
      'usb-chip': p(15.9, 37.5, UZ + 1),
      'power-led': p(57.2, 33.6, UZ + 0.6),
      'l-led': p(29.6, 44.6, UZ + 0.6),
      'tx-rx-leds': p(29.6, 41.3, UZ + 0.6),
      'digital-header': p(41.2, 50.8, UZ + 8.5),
      'power-header': p(36.8, 2.54, UZ + 8.5),
      'analog-header': p(57.15, 2.54, UZ + 8.5),
      icsp: p(64.74, 29.41, UZ + 8.5),
    }
  })(),
  draw: (cam, pal, defs) => drawUno(cam, pal, defs).node,
}

const ESP_PLACE: Place = (xr, yr) => ({ x: xr, y: 28.3 - yr })
const esp32Model: PartModel = {
  id: 'esp32-devkit',
  focusZoom: 3.2,
  bounds: esp32Bounds(ESP_PLACE),
  anchors: esp32Anchors(ESP_PLACE),
  draw: (cam, pal, defs) => drawEsp32(cam, pal, defs, ESP_PLACE),
}

const breadboardModel: PartModel = {
  id: 'breadboard',
  focusZoom: 3.2,
  bounds: BOARD,
  anchors: {
    'terminal-strip': holePoint('c12'),
    'centre-gap': a3(holePoint('e12').x, (CHANNEL.y0 + CHANNEL.y1) / 2, Z0),
    'power-rail-plus': holePoint('T+15'),
    'power-rail-minus': holePoint('T-15'),
    'column-numbers': a3(holePoint('a10').x, 4.0 * P, Z0),
    'row-letters': a3(BOARD.x0 + 0.95 * P, holePoint('c1').y, Z0),
  },
  draw: (cam, pal, defs) => drawBoard(cam, pal, defs),
}

/* ------------------------------------------------------------------ small parts */

const RES_LEN = 6.3
const resistorModel: PartModel = (() => {
  const codes = resistorBands(220)
  const ts = [0.17, 0.31, 0.45, 0.59, 0.84]
  const xAt = (t: number) => -RES_LEN / 2 + RES_LEN * t
  return {
    id: 'resistor',
    bounds: { x0: -RES_LEN / 2 - 12, x1: RES_LEN / 2 + 12, y0: -3, y1: 3, z0: 0, z1: 2.6 },
    anchors: { body: a3(0, 0, 2.4), bands: a3(xAt(ts[1]), 0, 2.4), 'tolerance-band': a3(xAt(ts[4]), 0, 2.6), lead: a3(RES_LEN / 2 + 8, 0, 0.4) },
    draw: (cam, pal, defs) =>
      axialPart(
        cam,
        pal,
        defs,
        'res',
        RES_LEN,
        1.2,
        12,
        pal.resistor,
        codes.map((c, i) => ({ t: ts[i], color: BAND_HEX[c], w: 0.045 })),
        true,
      ),
  }
})()

const diodeModel: PartModel = {
  id: 'diode-1n4007',
  bounds: { x0: -2.6 - 12, x1: 2.6 + 12, y0: -3, y1: 3, z0: 0, z1: 2.8 },
  anchors: { body: a3(-0.6, 0, 2.7), 'cathode-band': a3(1.8, 0, 2.7), 'anode-lead': a3(-9, 0, 0.4), 'cathode-lead': a3(9, 0, 0.4) },
  draw: (cam, pal, defs) => axialPart(cam, pal, defs, 'dio', 5.2, 1.35, 12, '#2a2c33', [{ t: 0.84, color: BAND_HEX.silver, w: 0.07 }], false),
}

/** An LED as it comes out of the bag: standing on its legs, the anode 3 mm longer. */
const LED_ZB = 14
const ledModel: PartModel = {
  id: 'led',
  bounds: { x0: -3, x1: 3, y0: -3, y1: 3, z0: 0, z1: LED_ZB + 8.6 },
  anchors: {
    lens: a3(0, 0, LED_ZB + 8.6),
    'anode-leg': a3(-1.27, 0, LED_ZB * 0.45),
    'cathode-leg': a3(1.27, 0, LED_ZB * 0.55),
    'flat-edge': a3(2.25, 0, LED_ZB + 0.5),
    die: a3(0, 0, LED_ZB + 3.2),
  },
  draw: (cam, pal, defs) => {
    const d = { x: 1, y: 0 }
    const { node } = ledHead(cam, pal, defs, { x: 0, y: 0 }, LED_ZB, d, 'red', 0, false)
    return (
      <g>
        {contactShadow(cam, defs, { x0: -3, x1: 3, y0: -2, y1: 2 }, 0, 1.2)}
        {lead(cam, defs, 'led-c', [a3(1.27, 0, LED_ZB), a3(1.27, 0, 3)], pal)}
        {lead(cam, defs, 'led-a', [a3(-1.27, 0, LED_ZB), a3(-1.27, 0, 0)], pal)}
        {node}
      </g>
    )
  },
}

/** 6 × 6 mm tactile switch: legs leave two opposite sides; each leg is joined to the one straight across. */
const BTN = { z0: 3.2, z1: 6.6, plate: 0.3, leg: 2.25 }
const buttonModel: PartModel = {
  id: 'push-button',
  bounds: { x0: -3.5, x1: 3.5, y0: -4.6, y1: 4.6, z0: 0, z1: BTN.z1 + 1.8 },
  anchors: {
    plunger: a3(0, 0, BTN.z1 + BTN.plate + 1.5),
    'legs-connected': a3(-BTN.leg, 4.1, 1.6),
    'legs-switched': a3(BTN.leg, 4.1, 1.6),
  },
  draw: (cam, pal, defs) => {
    const legs: Piece[] = []
    for (const x of [-BTN.leg, BTN.leg])
      for (const s of [-1, 1]) {
        const pts = [a3(x, s * 3, BTN.z0 + 0.6), a3(x, s * 3.9, BTN.z0 + 0.6), a3(x, s * 4.1, BTN.z0 - 0.4), a3(x, s * 4.1, 0)]
        legs.push({ box: { x0: x - 0.4, x1: x + 0.4, y0: Math.min(s * 3, s * 4.2), y1: Math.max(s * 3, s * 4.2), z0: 0, z1: BTN.z0 + 0.6 }, node: <g key={`${x}${s}`}>{lead(cam, defs, `btn${x}${s}`, pts, pal)}</g> })
      }
    const body: Piece = {
      box: { x0: -3, x1: 3, y0: -3, y1: 3, z0: BTN.z0, z1: BTN.z1 + 1.8 },
      node: (
        <g key="body">
          {box(cam, { x0: -3, x1: 3, y0: -3, y1: 3, z0: BTN.z0, z1: BTN.z1 }, pal.plastic)}
          {box(cam, { x0: -3, x1: 3, y0: -3, y1: 3, z0: BTN.z1, z1: BTN.z1 + BTN.plate }, pal.metal, { metal: defs })}
          {[-2.3, 2.3].flatMap((x) => [-2.3, 2.3].map((y) => <circle key={`${x}${y}`} transform={matrix(groundMatrix(cam, BTN.z1 + BTN.plate))} cx={x} cy={y} r={0.45} fill={shade(pal.metal, 0.35)} />))}
          {cyl(cam, defs, { x: 0, y: 0 }, BTN.z1 + BTN.plate, BTN.z1 + BTN.plate + 1.5, 1.75, '#3a3f4a')}
        </g>
      ),
    }
    return (
      <g>
        {contactShadow(cam, defs, { x0: -3.5, x1: 3.5, y0: -4.4, y1: 4.4 }, 0, 1.1)}
        {depthSortPieces(cam, [...legs, body])}
      </g>
    )
  },
}

/** A panel potentiometer (10 kΩ): body, threaded bushing, knurled knob with a pointer, three lugs in a row. */
const POT = { z0: 4, z1: 10, knob: 18 }
const potModel: PartModel = {
  id: 'potentiometer',
  bounds: { x0: -6, x1: 6, y0: -6, y1: 9.5, z0: 0, z1: POT.knob },
  anchors: { knob: a3(0, 0, POT.knob), 'pin-end-a': a3(-2.54, 8.2, 2.2), 'pin-wiper': a3(0, 8.2, 2.2), 'pin-end-b': a3(2.54, 8.2, 2.2) },
  draw: (cam, pal, defs) => {
    const lugs: Piece[] = [-2.54, 0, 2.54].map((x) => ({
      box: { x0: x - 0.5, x1: x + 0.5, y0: 4.5, y1: 8.6, z0: 0, z1: POT.z0 + 1 },
      node: (
        <g key={x}>
          {box(cam, { x0: x - 0.55, x1: x + 0.55, y0: 4.6, y1: 7.6, z0: POT.z0, z1: POT.z0 + 0.4 }, pal.metal, { metal: defs })}
          {box(cam, { x0: x - 0.4, x1: x + 0.4, y0: 7.6, y1: 8.4, z0: 0, z1: POT.z0 + 0.4 }, pal.metal, { metal: defs })}
        </g>
      ),
    }))
    const knurl = (() => {
      const g = cylinder(cam, 0, 0, POT.z1 + 2.5, POT.knob, 4.5)
      const lines: ReactNode[] = []
      for (let k = -6; k <= 6; k++) {
        const t = k / 7.5
        const x = g.top.x + g.rx * t
        lines.push(<path key={k} d={`M${f(x)} ${f(g.top.y + g.ry * Math.sqrt(1 - t * t))}L${f(x)} ${f(g.bottom.y + g.ry * Math.sqrt(1 - t * t))}`} stroke="#000" strokeOpacity={0.22} strokeWidth={0.8} />)
      }
      return lines
    })()
    const pointer = [project(cam, 0, 0.6, POT.knob), project(cam, 0, 3.8, POT.knob)]
    const body: Piece = {
      box: { x0: -6, x1: 6, y0: -6, y1: 4.6, z0: POT.z0, z1: POT.knob },
      node: (
        <g key="body">
          {box(cam, { x0: -6, x1: 6, y0: -6, y1: 4.6, z0: POT.z0, z1: POT.z1 }, '#2f63c4')}
          {cyl(cam, defs, { x: 0, y: -0.7 }, POT.z1, POT.z1 + 2.5, 3.6, pal.metal, { metal: true })}
          {cyl(cam, defs, { x: 0, y: 0 }, POT.z1 + 2.5, POT.knob, 4.5, '#2b2e36')}
          {knurl}
          <path d={pathOf(pointer)} stroke="#f1f2f4" strokeWidth={f(0.7 * unitScale(cam))} strokeLinecap="round" />
        </g>
      ),
    }
    return (
      <g>
        {contactShadow(cam, defs, { x0: -6, x1: 6, y0: -6, y1: 9 }, 0, 1.1)}
        {depthSortPieces(cam, [...lugs, body])}
      </g>
    )
  },
}

/** Radial electrolytic: sleeved can with a − stripe, scored vent on top, the + leg longer. */
const CAP = { r: 3.15, z0: 10, z1: 21, stripe: Math.PI * 0.75 }
const capModel: PartModel = {
  id: 'electrolytic-capacitor',
  bounds: { x0: -3.4, x1: 3.4, y0: -3.4, y1: 3.4, z0: 0, z1: CAP.z1 },
  anchors: {
    can: a3(CAP.r * Math.cos(-Math.PI / 4), CAP.r * Math.sin(-Math.PI / 4), (CAP.z0 + CAP.z1) / 2),
    'negative-stripe': a3(CAP.r * Math.cos(CAP.stripe), CAP.r * Math.sin(CAP.stripe), (CAP.z0 + CAP.z1) / 2 + 2),
    'long-leg': a3(-1.25, 0, CAP.z0 * 0.4),
    vent: a3(0, 0, CAP.z1),
  },
  draw: (cam, pal, defs) => {
    const sleeve = '#26355e'
    const v = viewer(cam)
    const nx = Math.cos(CAP.stripe)
    const ny = Math.sin(CAP.stripe)
    const facing = nx * v.x + ny * v.y > 0.05
    const band = (z0: number, z1: number) => {
      const pts: Pt[] = []
      for (let k = 0; k <= 8; k++) {
        const a = CAP.stripe - 0.42 + (0.84 * k) / 8
        pts.push(project(cam, CAP.r * Math.cos(a), CAP.r * Math.sin(a), z1))
      }
      for (let k = 8; k >= 0; k--) {
        const a = CAP.stripe - 0.42 + (0.84 * k) / 8
        pts.push(project(cam, CAP.r * Math.cos(a), CAP.r * Math.sin(a), z0))
      }
      return pts
    }
    const g = cylinder(cam, 0, 0, CAP.z0, CAP.z1, CAP.r)
    const top = matrix(groundMatrix(cam, CAP.z1))
    return (
      <g>
        {contactShadow(cam, defs, { x0: -3, x1: 3, y0: -2, y1: 2 }, 0, 1.2)}
        {lead(cam, defs, 'cap-n', [a3(1.25, 0, CAP.z0), a3(1.25, 0, 3)], pal)}
        {lead(cam, defs, 'cap-p', [a3(-1.25, 0, CAP.z0), a3(-1.25, 0, 0)], pal)}
        {cyl(cam, defs, { x: 0, y: 0 }, CAP.z0, CAP.z1, CAP.r, sleeve, { top: shade(pal.metal, 0.05) })}
        {facing && <path d={'M' + band(CAP.z0 + 0.4, CAP.z1 - 0.4).map((p) => `${f(p.x)} ${f(p.y)}`).join('L') + 'Z'} fill="#c7cfdc" />}
        {facing &&
          [0.2, 0.4, 0.6, 0.8].map((t) => {
            const z = CAP.z0 + (CAP.z1 - CAP.z0) * t
            const a = project(cam, CAP.r * Math.cos(CAP.stripe - 0.16), CAP.r * Math.sin(CAP.stripe - 0.16), z)
            const b = project(cam, CAP.r * Math.cos(CAP.stripe + 0.16), CAP.r * Math.sin(CAP.stripe + 0.16), z)
            return <path key={t} d={pathOf([a, b])} stroke={sleeve} strokeWidth={f(0.5 * unitScale(cam))} />
          })}
        <path d={`M${f(g.top.x - g.rx)} ${f(g.top.y)}A${f(g.rx)} ${f(g.ry)} 0 0 1 ${f(g.top.x + g.rx)} ${f(g.top.y)}`} fill="none" stroke={sleeve} strokeWidth={f(0.5 * unitScale(cam))} />
        <path transform={top} d="M-1.9 -1.1L0 0L1.9 -1.1M0 0V2.2" stroke={shade(pal.metal, 0.4)} strokeWidth={0.32} fill="none" strokeLinecap="round" />
      </g>
    )
  },
}

/** SG90 micro servo: case with mounting tabs, output shaft with a single-arm horn, and its three-wire lead. */
const SERVO = { l: 22.8, w: 12.2, h: 22.7, tabZ: 15.9, shaftX: 5.6 }
const servoModel: PartModel = (() => {
  const wires = [
    ['ground', '#7a4a2a', -1.1],
    ['power', '#d8343a', 0],
    ['signal', '#f08a24', 1.1],
  ] as const
  const wirePath = (dy: number): [Vec3, Vec3, Vec3, Vec3] => [a3(-SERVO.l / 2, dy, 4), a3(-SERVO.l / 2 - 12, dy, 4), a3(-SERVO.l / 2 - 16, dy * 1.4 + 6, 0.8), a3(-SERVO.l / 2 - 30, dy * 1.2 + 12, 0.8)]
  const hornTop = SERVO.h + 4 + 1.6
  return {
    id: 'servo-sg90',
    bounds: { x0: -SERVO.l / 2 - 36, x1: SERVO.l / 2 + 12, y0: -SERVO.w / 2 - 1, y1: 18, z0: 0, z1: hornTop },
    anchors: {
      horn: a3(SERVO.shaftX + 13, 0, hornTop),
      case: a3(0, SERVO.w / 2, 8),
      'wire-signal': (() => cubicAt(...wirePath(1.1), 0.45))(),
      'wire-power': (() => cubicAt(...wirePath(0), 0.6))(),
      'wire-ground': (() => cubicAt(...wirePath(-1.1), 0.75))(),
    },
    draw: (cam, pal, defs) => {
      const blue = '#3266c8'
      const caseB: Box3 = { x0: -SERVO.l / 2, x1: SERVO.l / 2, y0: -SERVO.w / 2, y1: SERVO.w / 2, z0: 0, z1: SERVO.h }
      const tabs: Box3 = { x0: -16.25, x1: 16.25, y0: -SERVO.w / 2, y1: SERVO.w / 2, z0: SERVO.tabZ, z1: SERVO.tabZ + 2.5 }
      const hornPts = convexHull([...circlePoly(SERVO.shaftX, 0, 3.6, 18), ...circlePoly(SERVO.shaftX + 15, 0, 2, 12)])
      const end = a3(-SERVO.l / 2 - 30, 12, 0)
      return (
        <g>
          {contactShadow(cam, defs, caseB, 0, 1.15)}
          {wires.map(([k, c, dy]) => cable(cam, wirePath(dy), c, 1.1, k))}
          {box(cam, { x0: end.x - 4, x1: end.x + 3.5, y0: end.y - 2.5, y1: end.y + 5, z0: 0, z1: 2.6 }, pal.plastic)}
          {box(cam, { ...caseB, z1: SERVO.tabZ }, blue)}
          {box(cam, tabs, blue)}
          {[-14, 14].map((x) => (
            <circle key={x} transform={matrix(groundMatrix(cam, tabs.z1))} cx={x} cy={0} r={1} fill={pal.ink} />
          ))}
          {box(cam, { ...caseB, z0: tabs.z1, z1: SERVO.h }, blue)}
          {cyl(cam, defs, { x: SERVO.shaftX, y: 0 }, SERVO.h, SERVO.h + 3, 5.9, blue)}
          {cyl(cam, defs, { x: -1, y: 0 }, SERVO.h, SERVO.h + 1.6, 3, blue)}
          {cyl(cam, defs, { x: SERVO.shaftX, y: 0 }, SERVO.h + 3, SERVO.h + 4, 2.4, '#e9ecf2')}
          {solid(cam, hornPts, SERVO.h + 4, hornTop, '#f1f3f7', { smooth: true })}
          {[4, 7, 10, 13].map((dx) => (
            <circle key={dx} transform={matrix(groundMatrix(cam, hornTop))} cx={SERVO.shaftX + dx + 2} cy={0} r={0.45} fill={shade('#f1f3f7', 0.45)} />
          ))}
          <circle transform={matrix(groundMatrix(cam, hornTop))} cx={SERVO.shaftX} cy={0} r={1} fill={shade(pal.metal, 0.3)} />
        </g>
      )
    },
  }
})()

/** HC-SR04 ultrasonic sensor, lying face up: two transducers, the crystal between them, four pins on the edge. */
const SR = { l: 45, w: 20, pcb: 1.6, can: 12, r: 8, pitch: 2.54 }
const srModel: PartModel = (() => {
  const pins = ['vcc', 'trig', 'echo', 'gnd'].map((name, i) => ({ name, x: (i - 1.5) * SR.pitch }))
  return {
    id: 'hc-sr04',
    bounds: { x0: -SR.l / 2, x1: SR.l / 2, y0: -SR.w / 2, y1: SR.w / 2 + 9, z0: 0, z1: SR.pcb + SR.can },
    anchors: {
      transmitter: a3(-13, -1, SR.pcb + SR.can),
      receiver: a3(13, -1, SR.pcb + SR.can),
      ...Object.fromEntries(pins.map((p) => [`pin-${p.name}`, a3(p.x, SR.w / 2 + 6, SR.pcb / 2)])),
      crystal: a3(0, -SR.w / 2 + 3.5, SR.pcb + 3.5),
    },
    draw: (cam, pal, defs) => {
      const pcb: Box3 = { x0: -SR.l / 2, x1: SR.l / 2, y0: -SR.w / 2, y1: SR.w / 2, z0: 0, z1: SR.pcb }
      const xtal = convexHull([...circlePoly(-3.2, -SR.w / 2 + 3.5, 2.2, 14), ...circlePoly(3.2, -SR.w / 2 + 3.5, 2.2, 14)])
      const pieces: Piece[] = []
      for (const [k, x] of [
        ['t', -13],
        ['r', 13],
      ] as const) {
        const c = { x, y: -1 }
        const g = cylinder(cam, c.x, c.y, SR.pcb + SR.can, SR.pcb + SR.can, SR.r - 1.2)
        pieces.push({
          box: { x0: x - SR.r, x1: x + SR.r, y0: -1 - SR.r, y1: -1 + SR.r, z0: SR.pcb, z1: SR.pcb + SR.can },
          node: (
            <g key={k}>
              {cyl(cam, defs, c, SR.pcb, SR.pcb + SR.can, SR.r, pal.metal, { metal: true, top: shade(pal.metal, 0.1) })}
              <ellipse cx={f(g.top.x)} cy={f(g.top.y)} rx={f(g.rx)} ry={f(g.ry)} fill="#2b2f38" className="iso-ln" />
              <ellipse cx={f(g.top.x)} cy={f(g.top.y)} rx={f(g.rx * 0.82)} ry={f(g.ry * 0.82)} fill="none" stroke="#454b57" strokeDasharray="1.2 1.6" strokeWidth={f(0.5 * unitScale(cam))} />
            </g>
          ),
        })
      }
      pieces.push({ box: { x0: -5.4, x1: 5.4, y0: -SR.w / 2 + 1.3, y1: -SR.w / 2 + 5.7, z0: SR.pcb, z1: SR.pcb + 3.5 }, node: <g key="x">{solid(cam, xtal, SR.pcb, SR.pcb + 3.5, pal.metal, { smooth: true, metal: defs })}</g> })
      const header: Box3 = { x0: -5.1, x1: 5.1, y0: SR.w / 2, y1: SR.w / 2 + 2.5, z0: 0, z1: SR.pcb + 0.3 }
      pieces.push({
        box: { ...header, y1: header.y1 + 6 },
        node: (
          <g key="pins">
            {pins.map((p) => (
              <g key={p.name}>{box(cam, { x0: p.x - 0.32, x1: p.x + 0.32, y0: SR.w / 2, y1: SR.w / 2 + 8.5, z0: SR.pcb / 2 - 0.32, z1: SR.pcb / 2 + 0.32 }, pal.metal, { metal: defs })}</g>
            ))}
            {box(cam, header, pal.plastic)}
          </g>
        ),
      })
      return (
        <g>
          {contactShadow(cam, defs, pcb, 0, 1.08)}
          {box(cam, pcb, pal.pcb)}
          {[
            ['VCC', pins[0].x],
            ['TRIG', pins[1].x],
            ['ECHO', pins[2].x],
            ['GND', pins[3].x],
          ].map(([t, x]) => print(cam, { x: x as number, y: SR.w / 2 - 3.2 }, SR.pcb, t as string, 0.95, pal.silk, { key: t as string, turn: true }))}
          {print(cam, { x: -13, y: SR.w / 2 - 1.3 }, SR.pcb, 'T', 1.6, pal.silk, { key: 'T', weight: 700 })}
          {print(cam, { x: 13, y: SR.w / 2 - 1.3 }, SR.pcb, 'R', 1.6, pal.silk, { key: 'R', weight: 700 })}
          {depthSortPieces(cam, pieces)}
        </g>
      )
    },
  }
})()

/** A male-to-female jumper lying on the bench: pin and socket housings joined by a curved wire. */
const JW = { hl: 14, hw: 2.5, pin: 6 }
const jumperModel: PartModel = (() => {
  const mh: Box3 = { x0: -40, x1: -40 + JW.hl, y0: -JW.hw / 2, y1: JW.hw / 2, z0: 0, z1: JW.hw }
  const fh: Box3 = { x0: 26, x1: 26 + JW.hl, y0: 8 - JW.hw / 2, y1: 8 + JW.hw / 2, z0: 0, z1: JW.hw }
  return {
    id: 'jumper-wire',
    bounds: { x0: mh.x0 - JW.pin, x1: fh.x1, y0: -6, y1: 14, z0: 0, z1: JW.hw },
    anchors: {
      'male-pin': a3(mh.x0 - JW.pin + 1, 0, JW.hw / 2),
      'female-socket': a3(fh.x1, 8, JW.hw / 2),
      housing: a3((mh.x0 + mh.x1) / 2, 0, JW.hw),
    },
    draw: (cam, pal, defs) => (
      <g>
        {contactShadow(cam, defs, { x0: mh.x0, x1: fh.x1, y0: -3, y1: 10 }, 0, 1.05)}
        {cable(cam, [a3(mh.x1, 0, 0.9), a3(mh.x1 + 22, 0, 0.9), a3(fh.x0 - 22, 8, 0.9), a3(fh.x0, 8, 0.9)], WIRE_HEX.blue, 1.5, 'w')}
        {box(cam, { x0: mh.x0 - JW.pin, x1: mh.x0, y0: -0.32, y1: 0.32, z0: JW.hw / 2 - 0.32, z1: JW.hw / 2 + 0.32 }, pal.metal, { metal: defs })}
        {box(cam, mh, pal.plastic)}
        {box(cam, fh, pal.plastic)}
        {endSocket(cam, fh, pal)}
      </g>
    ),
  }
})()

/** 9 V battery standing up, its snap clip on the terminals and two leads curling down to the bench. */
const BAT = { x: 26.5, y: 17.5, z: 48.5 }
const batteryModel: PartModel = (() => {
  const red: [Vec3, Vec3, Vec3, Vec3] = [a3(8, -2, BAT.z + 3), a3(22, -3, BAT.z + 6), a3(30, -8, 10), a3(36, -16, 0.8)]
  const black: [Vec3, Vec3, Vec3, Vec3] = [a3(8, 2, BAT.z + 3), a3(24, 4, BAT.z + 4), a3(34, 2, 8), a3(42, -6, 0.8)]
  return {
    id: 'battery-9v',
    bounds: { x0: -BAT.x / 2, x1: 44, y0: -18, y1: BAT.y / 2, z0: 0, z1: BAT.z + 6 },
    anchors: { battery: a3(0, BAT.y / 2, BAT.z * 0.45), snap: a3(0, 0, BAT.z + 6), 'lead-red': cubicAt(...red, 0.55), 'lead-black': cubicAt(...black, 0.65) },
    draw: (cam, pal, defs) => {
      const body: Box3 = { x0: -BAT.x / 2, x1: BAT.x / 2, y0: -BAT.y / 2, y1: BAT.y / 2, z0: 0, z1: BAT.z }
      return (
        <g>
          {contactShadow(cam, defs, body, 0, 1.15)}
          {box(cam, { ...body, z1: BAT.z - 9 }, '#2a3242')}
          {box(cam, { ...body, z0: BAT.z - 9, z1: BAT.z - 2 }, '#c98f2a')}
          {box(cam, { ...body, z0: BAT.z - 2 }, pal.metal, { metal: defs })}
          {box(cam, { x0: -10.5, x1: 10.5, y0: -4.6, y1: 4.6, z0: BAT.z, z1: BAT.z + 6 }, pal.plastic)}
          {cable(cam, black, WIRE_HEX.black, 1.4, 'b')}
          {cable(cam, red, WIRE_HEX.red, 1.4, 'r')}
          {[red[3], black[3]].map((e, i) => (
            <g key={i}>{box(cam, { x0: e.x - 0.4, x1: e.x + 3, y0: e.y - 0.4, y1: e.y + 0.4, z0: 0.4, z1: 1.2 }, pal.metal, { metal: defs })}</g>
          ))}
        </g>
      )
    },
  }
})()

/* ------------------------------------------------------------------ registry */

export const PART_MODELS: Record<PartId, PartModel> = {
  'arduino-uno': unoModel,
  'esp32-devkit': esp32Model,
  breadboard: breadboardModel,
  resistor: resistorModel,
  led: ledModel,
  'push-button': buttonModel,
  potentiometer: potModel,
  'electrolytic-capacitor': capModel,
  'diode-1n4007': diodeModel,
  'servo-sg90': servoModel,
  'hc-sr04': srModel,
  'jumper-wire': jumperModel,
  'battery-9v': batteryModel,
}

/** The hotspot anchors a part's model provides, in PART_ANCHORS order. */
export function listModelAnchors(partId: PartId): string[] {
  const m = PART_MODELS[partId]
  return PART_ANCHORS[partId].filter((a) => a in m.anchors)
}

