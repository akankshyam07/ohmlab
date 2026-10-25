import { describe, expect, it } from 'vitest'
import { solveDC } from './solver'
import type { Circuit, Component, LedColor, SolveResult } from './types'

const V = (id: string, pos: string, neg: string, volts: number): Component => ({ kind: 'vsource', id, pos, neg, volts })
const R = (id: string, a: string, b: string, ohms: number, ratedWatts?: number): Component => ({
  kind: 'resistor',
  id,
  a,
  b,
  ohms,
  ...(ratedWatts === undefined ? {} : { ratedWatts }),
})
const LED = (id: string, anode: string, cathode: string, color: LedColor = 'red'): Component => ({
  kind: 'led',
  id,
  anode,
  cathode,
  color,
})
const D = (id: string, anode: string, cathode: string): Component => ({ kind: 'diode', id, anode, cathode })
const S = (id: string, a: string, b: string, closed: boolean): Component => ({ kind: 'switch', id, a, b, closed })
const circuit = (...components: Component[]): Circuit => ({ components, ground: 'gnd' })

function solveOk(c: Circuit): SolveResult {
  const r = solveDC(c)
  expect(r.error).toBeUndefined()
  expect(r.ok).toBe(true)
  return r
}

/** Relative closeness, e.g. within 0.1 %. */
function expectNear(actual: number, expected: number, rel = 1e-3) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.abs(expected) * rel)
}

/** Sum of currents leaving each node through the parts (gmin leakage aside). */
function kclResiduals(c: Circuit, r: SolveResult): Record<string, number> {
  const sums: Record<string, number> = {}
  const leave = (node: string, amps: number) => (sums[node] = (sums[node] ?? 0) + amps)
  for (const p of c.components) {
    const i = r.components[p.id].current
    if (p.kind === 'vsource') {
      leave(p.pos, -i)
      leave(p.neg, i)
    } else if (p.kind === 'led' || p.kind === 'diode') {
      leave(p.anode, i)
      leave(p.cathode, -i)
    } else {
      leave(p.a, i)
      leave(p.b, -i)
    }
  }
  return sums
}

/** Drive one LED at a target current from a 50 V source, so the resistor sets the current. */
function ledAt(color: LedColor, amps: number, vfGuess: number) {
  const r = solveOk(circuit(V('B1', 'vcc', 'gnd', 50), R('R1', 'vcc', 'a', (50 - vfGuess) / amps), LED('D1', 'a', 'gnd', color)))
  return r.components.D1
}

describe('linear circuits match hand calculations', () => {
  it('single resistor: 5 V across 1 kΩ is 5 mA', () => {
    const r = solveOk(circuit(V('B1', 'vcc', 'gnd', 5), R('R1', 'vcc', 'gnd', 1000)))
    expectNear(r.components.R1.current, 0.005)
    expectNear(r.components.R1.voltage, 5)
    expectNear(r.components.R1.power, 0.025)
    expect(r.components.R1.status).toBe('ok')
    // Source delivers power: positive current, negative power.
    expectNear(r.components.B1.current, 0.005)
    expectNear(r.components.B1.power, -0.025)
    expect(r.components.B1.voltage).toBe(5)
  })

  it('series 1 k + 2 k + 3 k on 12 V carries 2 mA with the right node voltages', () => {
    const r = solveOk(circuit(V('B1', 'vcc', 'gnd', 12), R('R1', 'vcc', 'n1', 1000), R('R2', 'n1', 'n2', 2000), R('R3', 'n2', 'gnd', 3000)))
    for (const id of ['R1', 'R2', 'R3']) expectNear(r.components[id].current, 0.002)
    expectNear(r.nodeVoltages.n1, 10)
    expectNear(r.nodeVoltages.n2, 6)
  })

  it('parallel 1 k ‖ 1 k ‖ 2 k on 5 V draws 12.5 mA', () => {
    const r = solveOk(circuit(V('B1', 'vcc', 'gnd', 5), R('R1', 'vcc', 'gnd', 1000), R('R2', 'vcc', 'gnd', 1000), R('R3', 'vcc', 'gnd', 2000)))
    expectNear(r.components.B1.current, 0.0125)
    expectNear(r.components.R3.current, 0.0025)
  })

  it('voltage divider 5 V with 1 k over 2 k gives 3.333 V', () => {
    const r = solveOk(circuit(V('B1', 'vcc', 'gnd', 5), R('R1', 'vcc', 'out', 1000), R('R2', 'out', 'gnd', 2000)))
    expectNear(r.nodeVoltages.out, 10 / 3)
  })

  it('two sources: superposition answer, and the weaker source is charged (negative current)', () => {
    // (10 − m)/1k + (5 − m)/1k = m/2k  →  m = 6 V
    const r = solveOk(
      circuit(V('B1', 'a', 'gnd', 10), V('B2', 'b', 'gnd', 5), R('R1', 'a', 'm', 1000), R('R2', 'b', 'm', 1000), R('R3', 'm', 'gnd', 2000)),
    )
    expectNear(r.nodeVoltages.m, 6)
    expectNear(r.components.B1.current, 0.004)
    expectNear(r.components.B2.current, -0.001)
    expect(r.components.B2.power).toBeGreaterThan(0)
  })

  it('a 0 Ω resistor is treated as 1 mΩ, not an error', () => {
    const r = solveOk(circuit(V('B1', 'vcc', 'gnd', 5), R('R0', 'vcc', 'n', 0), R('R1', 'n', 'gnd', 1000)))
    expectNear(r.components.R1.current, 0.005)
    expect(Math.abs(r.components.R0.voltage)).toBeLessThan(1e-5)
  })

  it('resistor power statuses: ok at rating, overpower above, burnt above 2×', () => {
    const at = (ohms: number, rated?: number) =>
      solveOk(circuit(V('B1', 'vcc', 'gnd', 5), R('R1', 'vcc', 'gnd', ohms, rated))).components.R1.status
    expect(at(100)).toBe('ok') // 0.25 W exactly
    expect(at(68)).toBe('overpower') // 0.37 W
    expect(at(10)).toBe('burnt') // 2.5 W
    expect(at(10, 5)).toBe('ok')
    expect(solveOk(circuit(V('B1', 'vcc', 'gnd', 0), R('R1', 'vcc', 'gnd', 1000))).components.R1.status).toBe('off')
  })
})

describe('LEDs and diodes', () => {
  it('red LED + 220 Ω on 5 V: about 13.5 mA, Vf 1.9–2.05 V', () => {
    const r = solveOk(circuit(V('B1', 'vcc', 'gnd', 5), R('R1', 'vcc', 'a', 220), LED('D1', 'a', 'gnd')))
    const led = r.components.D1
    expect(led.current).toBeGreaterThan(0.013)
    expect(led.current).toBeLessThan(0.0142)
    expect(led.voltage).toBeGreaterThan(1.9)
    expect(led.voltage).toBeLessThan(2.05)
    expect(led.status).toBe('ok')
    expectNear(led.brightness!, Math.sqrt(led.current / 0.02), 1e-9)
    expectNear(r.components.R1.current, led.current, 1e-9)
  })

  const targets: [LedColor, number][] = [
    ['red', 2.0],
    ['yellow', 2.1],
    ['green', 2.2],
    ['blue', 3.1],
    ['white', 3.1],
  ]
  it.each(targets)('%s LED: Vf ≈ %s V at 20 mA, 0.05–0.15 V lower at 5 mA', (color, vf20) => {
    const hi = ledAt(color, 0.02, vf20)
    const lo = ledAt(color, 0.005, vf20 - 0.1)
    expectNear(hi.current, 0.02, 2e-3)
    expectNear(lo.current, 0.005, 2e-3)
    expect(Math.abs(hi.voltage - vf20)).toBeLessThan(0.01)
    expect(hi.voltage - lo.voltage).toBeGreaterThan(0.05)
    expect(hi.voltage - lo.voltage).toBeLessThan(0.15)
    expect(hi.brightness).toBeCloseTo(1, 2)
  })

  it('red LED stays inside 1.8–2.2 V across 5–20 mA', () => {
    for (const ma of [5, 10, 15, 20]) {
      const vf = ledAt('red', ma / 1000, 1.95).voltage
      expect(vf).toBeGreaterThan(1.8)
      expect(vf).toBeLessThan(2.2)
    }
  })

  it('reversed LED is off and leaks under 1 µA', () => {
    const r = solveOk(circuit(V('B1', 'vcc', 'gnd', 5), R('R1', 'vcc', 'a', 220), LED('D1', 'gnd', 'a')))
    expect(r.components.D1.status).toBe('off')
    expect(r.components.D1.brightness).toBe(0)
    expect(Math.abs(r.components.D1.current)).toBeLessThan(1e-6)
    expectNear(r.components.D1.voltage, -5, 1e-6)
  })

  it('LED with 0 Ω on 5 V is burnt, LED with 82 Ω is overcurrent', () => {
    const burnt = solveOk(circuit(V('B1', 'vcc', 'gnd', 5), R('R1', 'vcc', 'a', 0), LED('D1', 'a', 'gnd')))
    expect(burnt.components.D1.status).toBe('burnt')
    expect(burnt.components.D1.current).toBeGreaterThan(0.06)
    const hot = solveOk(circuit(V('B1', 'vcc', 'gnd', 5), R('R1', 'vcc', 'a', 82), LED('D1', 'a', 'gnd')))
    expect(hot.components.D1.status).toBe('overcurrent')
  })

  it('LED current thresholds: ok up to 20 mA, overcurrent up to 60 mA, burnt above', () => {
    const check = (amps: number, vfGuess: number, status: string) => {
      const led = ledAt('red', amps, vfGuess)
      expectNear(led.current, amps, 1e-3) // within 0.06 mA, so on the intended side of the threshold
      expect(led.status).toBe(status)
      return led
    }
    check(0.0199, 2, 'ok')
    check(0.0201, 2, 'overcurrent')
    check(0.0599, 2.21, 'overcurrent')
    // A burnt LED still reports the current at the moment of connection.
    expect(check(0.0601, 2.21, 'burnt').current).toBeGreaterThan(0.06)
  })

  it('reversed LED: off within its 5 V rating, overvoltage beyond it (still blocking)', () => {
    const rev = (volts: number) => solveOk(circuit(V('B1', 'vcc', 'gnd', volts), R('R1', 'vcc', 'a', 220), LED('D1', 'gnd', 'a'))).components.D1
    expect(rev(4.9).status).toBe('off')
    const over = rev(5.1)
    expect(over.status).toBe('overvoltage')
    expect(over.brightness).toBe(0)
    expect(Math.abs(over.current)).toBeLessThan(1e-6)
    expect(rev(9).status).toBe('overvoltage')
  })

  it('reversed silicon diode: off within its 75 V rating, overvoltage beyond it', () => {
    const rev = (volts: number) => solveOk(circuit(V('B1', 'vcc', 'gnd', volts), R('R1', 'vcc', 'a', 1000), D('D1', 'gnd', 'a'))).components.D1
    expect(rev(74).status).toBe('off')
    expect(rev(76).status).toBe('overvoltage')
  })

  it('LED below 50 µA counts as off', () => {
    const r = solveOk(circuit(V('B1', 'vcc', 'gnd', 5), R('R1', 'vcc', 'a', 1e6), LED('D1', 'a', 'gnd')))
    expect(r.components.D1.current).toBeLessThan(50e-6)
    expect(r.components.D1.status).toBe('off')
    expect(r.components.D1.brightness).toBe(0)
  })

  it('silicon diode: 0.65–0.72 V at 10 mA; off when reversed', () => {
    const fwd = solveOk(circuit(V('B1', 'vcc', 'gnd', 50), R('R1', 'vcc', 'a', (50 - 0.69) / 0.01), D('D1', 'a', 'gnd')))
    expectNear(fwd.components.D1.current, 0.01, 2e-3)
    expect(fwd.components.D1.voltage).toBeGreaterThan(0.65)
    expect(fwd.components.D1.voltage).toBeLessThan(0.72)
    expect(fwd.components.D1.status).toBe('ok')
    const rev = solveOk(circuit(V('B1', 'vcc', 'gnd', 5), R('R1', 'vcc', 'a', 1000), D('D1', 'gnd', 'a')))
    expect(rev.components.D1.status).toBe('off')
  })

  it('diode current statuses: overcurrent above 200 mA, burnt above 1 A', () => {
    const at = (ohms: number) => solveOk(circuit(V('B1', 'vcc', 'gnd', 5), R('R1', 'vcc', 'a', ohms, 100), D('D1', 'a', 'gnd'))).components.D1
    expect(at(10).status).toBe('overcurrent') // ~0.43 A
    expect(at(0).status).toBe('burnt') // only Rs limits it
  })

  it('converges with source stepping when plain Newton is not allowed enough iterations', () => {
    const c = circuit(V('B1', 'vcc', 'gnd', 9), R('R1', 'vcc', 'a', 330), LED('D1', 'a', 'b', 'blue'), LED('D2', 'b', 'gnd', 'green'))
    const full = solveOk(c)
    const stepped = solveDC(c, { maxIterations: 8 }) // plain Newton needs ~9 here
    expect(stepped.ok).toBe(true)
    expect(stepped.components.D1.current).toBeCloseTo(full.components.D1.current, 9)
  })
})

describe('switches and shorts', () => {
  it('open switch: no current anywhere, LED off', () => {
    const r = solveOk(circuit(V('B1', 'vcc', 'gnd', 5), S('S1', 'vcc', 's', false), R('R1', 's', 'a', 220), LED('D1', 'a', 'gnd')))
    expect(r.components.S1.current).toBe(0)
    expect(r.components.S1.status).toBe('off')
    expectNear(r.components.S1.voltage, 5, 1e-6)
    expect(Math.abs(r.components.R1.current)).toBeLessThan(1e-9)
    expect(r.components.D1.status).toBe('off')
    expect(Number.isFinite(r.nodeVoltages.s)).toBe(true)
  })

  it('closed switch behaves like a wire', () => {
    const r = solveOk(circuit(V('B1', 'vcc', 'gnd', 5), S('S1', 'vcc', 's', true), R('R1', 's', 'gnd', 1000)))
    expectNear(r.components.S1.current, 0.005)
    expect(r.components.S1.status).toBe('ok')
    expect(Math.abs(r.components.S1.voltage)).toBeLessThan(1e-5)
  })

  it('switch straight across the source is a short: ok false, source burnt, results still filled', () => {
    const c = circuit(V('B1', 'vcc', 'gnd', 5), R('R1', 'vcc', 'gnd', 1000), S('S1', 'vcc', 'gnd', true))
    const r = solveDC(c)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/^Short circuit: B1/)
    expect(r.components.B1.status).toBe('burnt')
    expect(r.components.S1.current).toBeGreaterThan(5)
    expect(Object.keys(r.components).sort()).toEqual(['B1', 'R1', 'S1'])
    expect(r.nodeVoltages.gnd).toBe(0)
  })

  it('a node cut off by an open switch has no voltage; connected nodes keep theirs', () => {
    const r = solveOk(circuit(V('B1', 'vcc', 'gnd', 5), R('R1', 'vcc', 'gnd', 1000), S('S1', 'vcc', 'probe', false), R('R2', 'probe', 'p2', 1000)))
    expect(r.nodeVoltages).not.toHaveProperty('probe')
    expect(r.nodeVoltages).not.toHaveProperty('p2')
    expect(r.nodeVoltages.vcc).toBeCloseTo(5, 9)
    expect(r.components.R2.current).toBeCloseTo(0, 12)
    const closed = solveOk(circuit(V('B1', 'vcc', 'gnd', 5), R('R1', 'vcc', 'gnd', 1000), S('S1', 'vcc', 'probe', true), R('R2', 'probe', 'p2', 1000)))
    expect(closed.nodeVoltages.probe).toBeCloseTo(5, 6)
    expect(closed.nodeVoltages.p2).toBeCloseTo(5, 6)
  })

  it('two batteries directly in parallel are rejected, not solved', () => {
    const r = solveDC(circuit(V('B1', 'vcc', 'gnd', 5), V('B2', 'vcc', 'gnd', 3), R('R1', 'vcc', 'gnd', 100)))
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/B2/)
  })
})

describe('conservation laws', () => {
  const mixed = circuit(
    V('B1', 'vcc', 'gnd', 9),
    V('B2', 'v2', 'gnd', 3),
    R('R1', 'vcc', 'a', 330),
    LED('D1', 'a', 'b', 'green'),
    R('R2', 'b', 'gnd', 100),
    R('R3', 'vcc', 'c', 1000),
    D('D2', 'c', 'v2'),
    S('S1', 'c', 'd', true),
    LED('D3', 'd', 'gnd', 'blue'),
    R('R4', 'v2', 'b', 470),
    S('S2', 'b', 'e', false),
    R('R5', 'e', 'gnd', 1000),
  )

  it('KCL holds at every node to 1 nA', () => {
    const r = solveOk(mixed)
    for (const [node, sum] of Object.entries(kclResiduals(mixed, r))) {
      expect(Math.abs(sum), node).toBeLessThan(1e-9)
    }
  })

  it('power delivered equals power dissipated', () => {
    const r = solveOk(mixed)
    const powers = Object.values(r.components).map((p) => p.power)
    const total = powers.reduce((a, b) => a + b, 0)
    const delivered = -powers.filter((p) => p < 0).reduce((a, b) => a + b, 0)
    expect(Math.abs(total)).toBeLessThan(delivered * 1e-9)
  })

  it('reports every component and exactly the user nodes, with ground at 0 V', () => {
    const r = solveOk(mixed)
    expect(Object.keys(r.components).sort()).toEqual(mixed.components.map((c) => c.id).sort())
    expect(Object.keys(r.nodeVoltages).sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'gnd', 'v2', 'vcc'])
    expect(r.nodeVoltages.gnd).toBe(0)
  })

  it('is deterministic', () => {
    expect(solveDC(mixed)).toEqual(solveDC(mixed))
  })
})

describe('validation never throws', () => {
  const bad: [string, unknown, RegExp][] = [
    ['null circuit', null, /couldn't be read/],
    ['no components', { components: [], ground: 'gnd' }, /no parts/],
    ['missing ground', { components: [V('B1', 'a', 'b', 5), R('R1', 'a', 'b', 10)], ground: 'gnd' }, /ground \(gnd\)/],
    ['no ground field', { components: [V('B1', 'a', 'gnd', 5)] }, /no ground/],
    ['NaN volts', circuit(V('B1', 'a', 'gnd', NaN), R('R1', 'a', 'gnd', 10)), /B1's voltage/],
    ['negative ohms', circuit(V('B1', 'a', 'gnd', 5), R('R1', 'a', 'gnd', -5)), /R1's resistance/],
    ['infinite ohms', circuit(V('B1', 'a', 'gnd', 5), R('R1', 'a', 'gnd', Infinity)), /R1's resistance/],
    ['bad rating', circuit(V('B1', 'a', 'gnd', 5), R('R1', 'a', 'gnd', 10, 0)), /power rating/],
    ['unknown kind', circuit(V('B1', 'a', 'gnd', 5), { kind: 'capacitor', id: 'C1', a: 'a', b: 'gnd' } as unknown as Component), /C1 .*capacitor/],
    ['unknown colour', circuit(V('B1', 'a', 'gnd', 5), LED('D1', 'a', 'gnd', 'purple' as LedColor)), /colour/],
    ['duplicate id', circuit(V('B1', 'a', 'gnd', 5), R('B1', 'a', 'gnd', 10)), /both called B1/],
    ['dangling leg', circuit(V('B1', 'a', 'gnd', 5), { kind: 'resistor', id: 'R1', a: 'a', ohms: 10 } as unknown as Component), /R1 has a leg/],
    ['source shorted to itself', circuit(V('B1', 'gnd', 'gnd', 5)), /same point/],
    ['garbage entry', { components: [42, 'x'], ground: 'gnd' }, /couldn't be read/],
  ]
  it.each(bad)('%s → ok:false with a readable error', (_name, input, message) => {
    let r: SolveResult | undefined
    expect(() => (r = solveDC(input as Circuit))).not.toThrow()
    expect(r!.ok).toBe(false)
    expect(r!.error).toMatch(message)
  })
})

describe('performance', () => {
  it('solves a 20-node resistor ladder with an LED in under 2 ms', () => {
    const parts: Component[] = [V('B1', 'n0', 'gnd', 12)]
    for (let i = 0; i < 19; i++) {
      parts.push(R(`Rs${i}`, `n${i}`, `n${i + 1}`, 100))
      parts.push(R(`Rp${i}`, `n${i + 1}`, 'gnd', 2200))
    }
    parts.push(LED('D1', 'n19', 'gnd'))
    const c = circuit(...parts)
    solveOk(c)
    const runs = 50
    const start = performance.now()
    for (let i = 0; i < runs; i++) solveDC(c)
    expect((performance.now() - start) / runs).toBeLessThan(2)
  })
})
