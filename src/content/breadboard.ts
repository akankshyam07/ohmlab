import type { BreadboardLayout, BreadboardPart, Hole } from '../viz/types'

const NUM = '([1-9]|[12][0-9]|30)'
const STRIP = new RegExp(`^([a-j])${NUM}$`)
const RAIL = new RegExp(`^([TB][+-])${NUM}$`)
const PIN = /^(uno:(5V|3V3|GND|VIN|D([2-9]|1[0-3])|A[0-5])|bat:[+-])$/

/**
 * The strip a hole belongs to, or null if the hole doesn't exist. Holes in one strip are joined by
 * metal: a–e of a column, f–j of a column, a whole rail, or a single off-board pin.
 */
export function parseHole(hole: Hole): string | null {
  const strip = STRIP.exec(hole)
  if (strip) return `${strip[1] <= 'e' ? 'a-e' : 'f-j'}:${strip[2]}`
  const rail = RAIL.exec(hole)
  if (rail) return rail[1]
  return PIN.test(hole) ? hole : null
}

/** The holes a part's legs (or a wire's ends) sit in, in terminal order. */
export function legsOf(part: BreadboardPart): [Hole, Hole] {
  return part.kind === 'led' || part.kind === 'diode' ? [part.anode, part.cathode] : [part.from, part.to]
}

/**
 * Electrical nets of a breadboard: each net lists every used hole (part legs and wire ends) that is
 * joined by a strip or a chain of wires. Components are terminals, never connections.
 * Throws on a hole that doesn't exist.
 */
export function breadboardNets(layout: BreadboardLayout): Hole[][] {
  const parent = new Map<string, string>()
  const find = (s: string): string => {
    while (parent.has(s)) s = parent.get(s)!
    return s
  }
  const strip = (hole: Hole) => {
    const s = parseHole(hole)
    if (s === null) throw new Error(`no such hole: ${hole}`)
    return s
  }
  for (const part of layout.parts) {
    if (part.kind !== 'wire') continue
    const [a, b] = [find(strip(part.from)), find(strip(part.to))]
    if (a !== b) parent.set(a, b)
  }
  const nets = new Map<string, Hole[]>()
  for (const part of layout.parts)
    for (const hole of legsOf(part)) {
      const root = find(strip(hole))
      nets.set(root, [...(nets.get(root) ?? []), hole])
    }
  return [...nets.values()]
}
