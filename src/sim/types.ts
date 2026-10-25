// Shared contract between the solver (src/sim), the circuit view (src/viz),
// the lab (src/features/lab) and lesson content (src/content).
// Units are SI everywhere: volts, amps, ohms, watts.

export type NodeId = string

export type LedColor = 'red' | 'yellow' | 'green' | 'blue' | 'white'

export type Component =
  | { kind: 'vsource'; id: string; pos: NodeId; neg: NodeId; volts: number }
  | { kind: 'resistor'; id: string; a: NodeId; b: NodeId; ohms: number; ratedWatts?: number }
  | { kind: 'led'; id: string; anode: NodeId; cathode: NodeId; color: LedColor }
  | { kind: 'diode'; id: string; anode: NodeId; cathode: NodeId }
  | { kind: 'switch'; id: string; a: NodeId; b: NodeId; closed: boolean }

export type ComponentKind = Component['kind']

export interface Circuit {
  components: Component[]
  /** Node held at 0 V. Every other node's voltage is relative to it. */
  ground: NodeId
}

/**
 * - ok: operating normally
 * - off: no meaningful current (open switch, reverse-biased or unlit diode/LED)
 * - overcurrent: above the part's safe continuous current but not yet destroyed
 * - burnt: far beyond its limit; a real part would be destroyed
 * - overpower: resistor dissipating more than ratedWatts
 * - overvoltage: LED/diode reverse-biased beyond its rated reverse voltage (LED 5 V); may be damaged
 */
export type ComponentStatus = 'ok' | 'off' | 'overcurrent' | 'burnt' | 'overpower' | 'overvoltage'

export interface ComponentResult {
  /**
   * Current through the part in amps (conventional current).
   * - resistor, switch: positive = flowing a→b
   * - led, diode: positive = flowing anode→cathode
   * - vsource: positive = delivering power (current leaves `pos` into the circuit)
   */
  current: number
  /** Voltage across the part: V(a)−V(b), V(anode)−V(cathode), or V(pos)−V(neg). */
  voltage: number
  /** Power dissipated in the part (W). Negative for a source delivering power. */
  power: number
  status: ComponentStatus
  /** LEDs only: perceived brightness 0..1 (0 when off, saturates near rated current). */
  brightness?: number
}

export interface SolveResult {
  ok: boolean
  /** Human-readable reason when ok is false (e.g. "Short circuit across B1"). */
  error?: string
  nodeVoltages: Record<NodeId, number>
  components: Record<string, ComponentResult>
}

/** Solve the DC operating point. Must never throw; report problems via ok/error. */
export type SolveDC = (circuit: Circuit) => SolveResult
