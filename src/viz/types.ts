import type { Circuit, NodeId, SolveResult } from '../sim/types'

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
