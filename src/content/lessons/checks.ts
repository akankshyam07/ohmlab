import type { Circuit, Component } from '../../sim/types'

/** True when x is a number inside [lo, hi]. */
export function between(x: number | undefined, lo: number, hi: number): boolean {
  return x !== undefined && x >= lo && x <= hi
}

/** The live component with this id, as the learner has configured it. */
export function part(circuit: Circuit, id: string): Component | undefined {
  return circuit.components.find((c) => c.id === id)
}

export const mA = 1e-3
