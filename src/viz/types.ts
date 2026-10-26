import type { Circuit, LedColor, NodeId, SolveResult } from '../sim/types'

/** Grid units: 1 unit = 40 px at 100 % zoom. Parts span 3 units; wires use integer coordinates. */
export interface Point {
  x: number
  y: number
}

/**
 * Where a component is drawn. The symbol spans from `from` to `to`.
 * Terminal order: vsource pos→neg, resistor a→b, led/diode anode→cathode, switch a→b.
 * Flipping an LED is done by swapping its terminals in the circuit AND swapping from/to here,
 * so the view can always draw the anode at `from`.
 */
export interface PartLayout {
  id: string
  from: Point
  to: Point
  label?: string
  labelSide?: 'left' | 'right' | 'above' | 'below'
}

/**
 * A wire drawn as a polyline. `carries` says whose current runs along it: with sign 1, a
 * positive current in that component flows points[0] → points[last]; sign -1 reverses it.
 * Wires without `carries` are drawn but never animated.
 */
export interface WireLayout {
  id: string
  points: Point[]
  carries?: { componentId: string; sign: 1 | -1 }
}

/** A spot the learner can probe to read the node voltage. */
export interface ProbePoint {
  node: NodeId
  at: Point
  label?: string
}

export interface CircuitLayout {
  width: number
  height: number
  parts: PartLayout[]
  wires: WireLayout[]
  probes?: ProbePoint[]
}

/**
 * A hole on a half-size breadboard (30 columns), or a pin off the board. Grammar:
 * - 'a1'…'j30': terminal strip. In each column, a–e are connected, and f–j are connected (the centre gap splits them).
 * - 'T+1'…'T+30', 'T-1'…'T-30': top power rails (+ and −). Each rail is one long connected strip.
 * - 'B+1'…'B+30', 'B-1'…'B-30': bottom power rails.
 * - 'uno:5V', 'uno:3V3', 'uno:GND', 'uno:VIN', 'uno:D2'…'uno:D13', 'uno:A0'…'uno:A5': Arduino Uno header pins.
 * - 'bat:+', 'bat:-': a 9 V battery snap.
 * - 'esp32:3V3', 'esp32:VIN', 'esp32:GND', 'esp32:EN', 'esp32:GPIO<n>' (n in 0–39): ESP32 DevKit V1 (30-pin) header pins.
 */
export type Hole = string

export type BreadboardPart =
  | { kind: 'resistor'; id: string; from: Hole; to: Hole; ohms: number }
  | { kind: 'led'; id: string; anode: Hole; cathode: Hole; color: LedColor }
  | { kind: 'diode'; id: string; anode: Hole; cathode: Hole }
  | { kind: 'wire'; id: string; from: Hole; to: Hole; color: 'red' | 'black' | 'yellow' | 'blue' | 'green' | 'orange' | 'white' }

export interface BreadboardLayout {
  /** Which off-board supply is drawn beside the breadboard. */
  supply: 'uno' | 'battery9v' | 'esp32'
  /** Part ids match the lab circuit's component ids where the part is the same component (R1, D1…). */
  parts: BreadboardPart[]
}

export interface BreadboardViewProps {
  layout: BreadboardLayout
  ariaLabel: string
  /** Part ids to emphasise (e.g. the build step being read). */
  highlight?: string[]
}

export interface CircuitViewProps {
  circuit: Circuit
  layout: CircuitLayout
  result: SolveResult
  /** Accessible description of the whole diagram. */
  ariaLabel: string
  onPartClick?: (componentId: string) => void
  /** Component ids to emphasise (e.g. during a walkthrough step). */
  highlight?: string[]
  /** Animate current flow; speed must scale with the solved current. Respect prefers-reduced-motion. */
  showFlow?: boolean
}
