// ESP32 DevKit V1 (30-pin): WROOM module with its can and PCB antenna, micro-USB, USB-UART chip,
// regulator, EN and BOOT buttons, power and GPIO2 LEDs, two 15-pin headers. No brand marks.
import type { ReactNode } from 'react'
import { type Defs, box, contactShadow, cyl, depthSortPieces, matrix, print, solid, wallOpening, type Piece } from '../draw'
import { type Box3, type Camera, type Pt, type Vec3, f, groundMatrix, mix, project, rect, shade } from '../geom'
import { ESP32_ROWS, ESP32_SILK, ESP32_SIZE, EZ, type IsoPalette, esp32PinX } from '../model'

/** DevKit coordinates (mm from its USB-end corner on the 3V3 side) to model mm. */
export type Place = (xr: number, yr: number) => Pt

const { w: W, h: H, pins: PIN_LEN, spacer: SPACER } = ESP32_SIZE
const ZB = PIN_LEN + SPACER // underside of the PCB

/** A rect in DevKit coordinates as a Box3 in model mm (the placement may mirror y). */
function rb(place: Place, xr0: number, yr0: number, xr1: number, yr1: number, z0: number, z1: number): Box3 {
  const a = place(xr0, yr0)
  const b = place(xr1, yr1)
  return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y), z0, z1 }
}

const MODULE = { x0: 25.9, x1: 51.4, y0: 5.15, y1: 23.15 }
const CAN = { x0: 26.5, x1: 44.1, y0: 5.65, y1: 22.65 }

/** One model point per PART_ANCHORS['esp32-devkit'] feature. */
export function esp32Anchors(place: Place): Record<string, Vec3> {
  const at = (xr: number, yr: number, z: number): Vec3 => ({ ...place(xr, yr), z })
  const pin = (name: string) => {
    for (const r of ESP32_ROWS) {
      const i = (r.pins as readonly string[]).indexOf(name)
      if (i >= 0) return at(esp32PinX(i), r.y, EZ + 1.1)
    }
    throw new Error(name)
  }
  return {
    'esp32-module': at((CAN.x0 + CAN.x1) / 2, (CAN.y0 + CAN.y1) / 2, EZ + 3.2),
    antenna: at(47.8, 14.15, EZ + 0.8),
    usb: at(1.9, 14.15, EZ + 2.9),
    'usb-uart': at(11, 14.15, EZ + 0.9),
    regulator: at(19.2, 5.15, EZ + 1.7),
    'en-button': at(3.6, 24.4, EZ + 2),
    'boot-button': at(3.6, 3.9, EZ + 2),
    'power-led': at(17.3, 21, EZ + 0.6),
    'gpio2-led': at(17.3, 18, EZ + 0.6),
    'left-header': at(esp32PinX(7), 26.85, EZ + 1.1),
    'right-header': at(esp32PinX(7), 1.45, EZ + 1.1),
    'pin-3v3': pin('3V3'),
    'pin-vin': pin('VIN'),
    'pin-gnd': pin('GND'),
  }
}

export function esp32Bounds(place: Place): Box3 {
  return rb(place, -1, 0, W, H, 0, EZ + 3.2)
}

export function drawEsp32(cam: Camera, pal: IsoPalette, defs: Defs, place: Place): ReactNode {
  const pcbColor = mix(pal.pcb, pal.ink, 0.55)
  const pieces: Piece[] = []
  const add = (b: Box3, node: ReactNode) => pieces.push({ box: b, node })
  const g = (z: number) => matrix(groundMatrix(cam, z))

  // Headers: black spacers under the board, pins down to the bench, joints and pin tips on top.
  const under: Piece[] = []
  const joints: ReactNode[] = []
  for (const r of ESP32_ROWS) {
    const sp = rb(place, esp32PinX(14) - 1.27, r.y - 1.27, esp32PinX(0) + 1.27, r.y + 1.27, PIN_LEN, ZB)
    under.push({ box: sp, node: <g key={`sp${r.y}`}>{box(cam, sp, pal.plastic)}</g> })
    r.pins.forEach((_, i) => {
      const c = place(esp32PinX(i), r.y)
      const pb = { x0: c.x - 0.32, x1: c.x + 0.32, y0: c.y - 0.32, y1: c.y + 0.32, z0: 0, z1: PIN_LEN }
      under.push({ box: pb, node: <g key={`p${r.y}-${i}`}>{box(cam, pb, pal.metal, { metal: defs })}</g> })
      joints.push(
        <g key={`j${r.y}-${i}`}>
          <ellipse transform={g(EZ)} cx={f(c.x)} cy={f(c.y)} rx={0.95} ry={0.95} fill={shade(pal.metal, 0.05)} />
          {box(cam, { x0: c.x - 0.3, x1: c.x + 0.3, y0: c.y - 0.3, y1: c.y + 0.3, z0: EZ, z1: EZ + 1.1 }, pal.metal)}
        </g>,
      )
    })
  }

  // The WROOM module: its own PCB, the shielding can, and the meandered antenna trace.
  const mod = rb(place, MODULE.x0, MODULE.y0, MODULE.x1, MODULE.y1, EZ, EZ + 0.8)
  const can = rb(place, CAN.x0, CAN.y0, CAN.x1, CAN.y1, EZ + 0.8, EZ + 3.2)
  const meander: Pt[] = []
  for (let k = 0; k <= 6; k++) {
    const yr = 7 + k * 2.3
    meander.push(place(45.2, yr), place(50.6, yr))
    if (k < 6) meander.push(place(50.6, yr), place(50.6, yr + 1.15), place(45.2, yr + 1.15), place(45.2, yr + 2.3))
  }
  add(
    { ...mod, z1: can.z1 },
    <g key="module">
      {box(cam, mod, mix(pcbColor, pal.pcb, 0.5))}
      <path transform={g(mod.z1)} d={'M' + meander.map((p) => `${f(p.x)} ${f(p.y)}`).join('L')} fill="none" stroke="#c9a13b" strokeWidth={0.45} strokeLinejoin="round" />
      {box(cam, can, pal.metal, { metal: defs })}
      <path transform={g(can.z1)} d={(() => {
        const a = place(CAN.x0 + 1.2, CAN.y0 + 1.2)
        const b = place(CAN.x1 - 1.2, CAN.y1 - 1.2)
        return `M${f(a.x)} ${f(a.y)}H${f(b.x)}V${f(b.y)}H${f(a.x)}Z`
      })()} fill="none" stroke={shade(pal.metal, 0.22)} strokeWidth={0.25} />
    </g>,
  )

  // Micro-USB at the near end, its opening facing out.
  const usb = rb(place, -1, 10.35, 4.8, 17.95, EZ, EZ + 2.9)
  add(
    usb,
    <g key="usb">
      {box(cam, usb, pal.metal, { metal: defs })}
      {wallOpening(cam, usb, 'x0', { y: (usb.y0 + usb.y1) / 2, z: EZ + 1.45, w: 6.4, h: 2.1 }, pal)}
    </g>,
  )
  // USB-UART bridge (QFN) and the 3.3 V regulator (SOT-223 with its tab).
  const uart = rb(place, 8.5, 11.65, 13.5, 16.65, EZ, EZ + 0.9)
  add(uart, <g key="uart">{box(cam, uart, pal.chip)}<circle transform={g(uart.z1)} cx={f(place(9.2, 12.4).x)} cy={f(place(9.2, 12.4).y)} r={0.35} fill={shade(pal.chip, -0.4)} /></g>)
  const reg = rb(place, 15.9, 3.4, 22.5, 6.9, EZ, EZ + 1.7)
  const tab = rb(place, 17.2, 6.9, 21.2, 8.6, EZ, EZ + 0.4)
  add(tab, <g key="tab">{box(cam, tab, pal.metal, { metal: defs })}</g>)
  add(reg, <g key="reg">{box(cam, reg, pal.chip)}</g>)
  // EN and BOOT: tactile buttons either side of the USB.
  for (const [key, yr] of [
    ['en', 24.4],
    ['boot', 3.9],
  ] as const) {
    const base = rb(place, 1.6, yr - 1.7, 5.6, yr + 1.7, EZ, EZ + 1.2)
    const cap = place(3.6, yr)
    add(
      { ...base, z1: EZ + 2 },
      <g key={key}>
        {box(cam, base, pal.metal, { metal: defs })}
        {cyl(cam, defs, cap, EZ + 1.2, EZ + 2, 0.9, pal.plastic)}
      </g>,
    )
  }
  // Power LED (lit) and the GPIO2 LED (off), with a small halo on the lit one.
  const glow = defs.radial('esp-pwr', [
    [0, '#ff4d5e', 0.8],
    [0.4, '#ff4d5e', 0.25],
    [1, '#ff4d5e', 0],
  ])
  for (const [key, yr, color, lit] of [
    ['pwr', 21, '#ff6b77', true],
    ['io2', 18, '#9ec4ff', false],
  ] as const) {
    const b = rb(place, 16.5, yr - 0.4, 18.1, yr + 0.4, EZ, EZ + 0.6)
    const c = place(17.3, yr)
    add(
      b,
      <g key={key}>
        {box(cam, b, color)}
        {lit && <ellipse transform={g(EZ + 0.6)} cx={f(c.x)} cy={f(c.y)} rx={2.8} ry={2.8} fill={glow} />}
      </g>,
    )
  }
  // Passives.
  const smd: [number, number, string][] = [
    [15, 11, '#c9b48a'],
    [15, 13, pal.chip],
    [15, 15.2, '#c9b48a'],
    [21, 11.5, '#c9b48a'],
    [21, 13.6, pal.chip],
    [21, 16, '#c9b48a'],
    [7, 8, pal.chip],
    [7, 20.5, '#c9b48a'],
  ]
  smd.forEach(([xr, yr, c], i) => {
    const b = rb(place, xr - 0.8, yr - 0.4, xr + 0.8, yr + 0.4, EZ, EZ + 0.5)
    add(b, <g key={`smd${i}`}>{box(cam, b, c)}</g>)
  })

  // Silkscreen: pin names inside each row, button names.
  const silk: ReactNode[] = []
  for (const r of ESP32_ROWS) {
    const inner = r.y < 10 ? r.y + 2.6 : r.y - 2.6
    r.pins.forEach((pin, i) => {
      const name = ESP32_SILK[pin] ?? (pin.startsWith('GPIO') ? `D${pin.slice(4)}` : pin)
      if (esp32PinX(i) > MODULE.x0 - 0.6) return // under the module
      silk.push(print(cam, place(esp32PinX(i), inner), EZ, name, 0.95, pal.silk, { key: `s${pin}`, turn: true }))
    })
  }
  silk.push(print(cam, place(3.6, 21.6), EZ, 'EN', 1, pal.silk, { key: 'sen', weight: 600 }))
  silk.push(print(cam, place(3.6, 6.7), EZ, 'BOOT', 1, pal.silk, { key: 'sboot', weight: 600 }))

  const pcbPts = rect(0, 0, W, H).map((p) => place(p.x, p.y))
  const corners = [place(1.6, 1.6), place(W - 1.6, 1.6), place(W - 1.6, H - 1.6), place(1.6, H - 1.6)]
  return (
    <g className="iso-esp32">
      {contactShadow(cam, defs, rb(place, 0, 0, W, H, 0, 0), 0, 1.08)}
      {depthSortPieces(cam, under)}
      {solid(cam, pcbPts, ZB, EZ, pcbColor)}
      <g transform={g(EZ)}>
        {corners.map((c, i) => (
          <circle key={i} cx={f(c.x)} cy={f(c.y)} r={1.05} fill={shade(pal.metal, 0.15)} />
        ))}
        {corners.map((c, i) => (
          <circle key={`h${i}`} cx={f(c.x)} cy={f(c.y)} r={0.6} fill={pal.ink} />
        ))}
      </g>
      {silk}
      {joints}
      {depthSortPieces(cam, pieces)}
    </g>
  )
}

/** Screen outline of the DevKit (for label placement and framing). */
export function esp32Outline(cam: Camera, place: Place): Pt[] {
  const b = esp32Bounds(place)
  const out: Pt[] = []
  for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) out.push(project(cam, x, y, z))
  return out
}
