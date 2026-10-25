import type { Component, ComponentResult, LedColor } from '../sim/types'
import { formatSI } from '../ui/format'

/** The only raw colours in the schematic: LED tints (the breadboard view uses them for lenses too). */
export const LED_COLORS: Record<LedColor, string> = {
  red: '#ff4d5e',
  yellow: '#ffd23f',
  green: '#3dff8a',
  blue: '#4d8bff',
  white: '#f2f5ff',
}

/** Below this the view treats a part as carrying no current (no flow, LED "off"). */
export const FLOW_THRESHOLD = 1e-5

/** Display values used in on-diagram labels: "220 Ω", "5 V". */
export function partValue(c: Component): string {
  switch (c.kind) {
    case 'vsource':
      return formatSI(c.volts, 'V')
    case 'resistor':
      return c.ohms === 0 ? 'no resistor' : formatSI(c.ohms, 'Ω')
    case 'led':
      return c.color
    case 'diode':
      return 'diode'
    case 'switch':
      return c.closed ? 'closed' : 'open'
  }
}

/**
 * Accessible name for a part, e.g. "Resistor R1, 220 Ω", "LED D1 (red), lit, 13.3 mA".
 * The Lab and E2E tests rely on the "Resistor R1, 220 Ω" prefix shape.
 */
export function partLabel(c: Component, r?: ComponentResult): string {
  const amps = r ? formatSI(Math.abs(r.current), 'A') : ''
  switch (c.kind) {
    case 'vsource':
      return `Battery ${c.id}, ${formatSI(c.volts, 'V')}${r?.status === 'burnt' ? ', shorted' : ''}`
    case 'resistor': {
      const base = c.ohms === 0 ? `Resistor ${c.id}, no resistor (0 Ω)` : `Resistor ${c.id}, ${formatSI(c.ohms, 'Ω')}`
      if (r?.status === 'burnt') return `${base}, burnt out`
      if (r?.status === 'overpower') return `${base}, overheating`
      return base
    }
    case 'led': {
      const base = `LED ${c.id} (${c.color})`
      if (!r) return base
      if (r.status === 'burnt') return `${base}, burnt out`
      if (r.status === 'overcurrent') return `${base}, too much current, ${amps}`
      if (r.status === 'overvoltage') return `${base}, reverse voltage too high`
      if ((r.brightness ?? 0) > 0.01 && r.status !== 'off') return `${base}, lit, ${amps}`
      return `${base}, off, ${idleReason(r)}`
    }
    case 'diode': {
      const base = `Diode ${c.id}`
      if (!r) return base
      if (r.status === 'burnt') return `${base}, burnt out`
      if (r.status === 'overcurrent') return `${base}, too much current, ${amps}`
      if (r.status === 'overvoltage') return `${base}, reverse voltage too high`
      return Math.abs(r.current) >= FLOW_THRESHOLD && r.status !== 'off' ? `${base}, conducting, ${amps}` : `${base}, ${idleReason(r)}`
    }
    case 'switch':
      return `Switch ${c.id}, ${c.closed ? 'closed' : 'open'}`
  }
}

/**
 * Why an LED or diode carries no current, from its actual bias: reverse-biased parts are blocking;
 * forward-biased below threshold or with ~0 V across (e.g. bypassed by a closed switch) just have no current.
 */
const idleReason = (r: ComponentResult) => (r.voltage < -0.1 ? 'blocking' : 'no current')

// Anchors (|I| in amps → speed in px/s), interpolated in log10(|I|).
const SPEED_ANCHORS: [number, number][] = [
  [1e-5, 8],
  [1e-4, 18], // ~0.1 mA: a slow crawl
  [2e-2, 90], // 20 mA (a lit LED): brisk
  [3e-1, 240], // 300 mA: fast
  [3, 340],
]

/** Flow speed in px/s for a current, monotonic in |I|; 0 below FLOW_THRESHOLD (no animation). */
export function flowSpeed(current: number): number {
  const i = Math.abs(current)
  if (!(i >= FLOW_THRESHOLD)) return 0
  const x = Math.log10(i)
  for (let k = 1; k < SPEED_ANCHORS.length; k++) {
    const [i1, s1] = SPEED_ANCHORS[k]
    const x1 = Math.log10(i1)
    if (x <= x1) {
      const [i0, s0] = SPEED_ANCHORS[k - 1]
      const x0 = Math.log10(i0)
      return s0 + ((x - x0) / (x1 - x0)) * (s1 - s0)
    }
  }
  return SPEED_ANCHORS[SPEED_ANCHORS.length - 1][1]
}
