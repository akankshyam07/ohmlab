import { describe, expect, it } from 'vitest'
import day01 from '../../content/lessons/day01'
import day08 from '../../content/lessons/day08'
import { solveDC } from '../../sim/solver'
import { BOARD, holePoint, wireCurrents } from './model'

describe('holePoint', () => {
  it('puts strip holes on the board top, a pitch apart', () => {
    const a = holePoint('a1')
    const b = holePoint('a2')
    expect(b.x - a.x).toBeCloseTo(2.54)
    expect(a.z).toBe(BOARD.z1)
    expect(a.x).toBeGreaterThan(BOARD.x0)
    expect(holePoint('j30').x).toBeLessThan(BOARD.x1)
  })

  it('puts Uno sockets on top of the headers, behind the board', () => {
    const p = holePoint('uno:5V')
    expect(p.y).toBeLessThan(BOARD.y0)
    expect(p.z).toBeGreaterThan(BOARD.z1)
    expect(holePoint('uno:GND').x - p.x).toBeCloseTo(2.54)
  })
})

describe('wireCurrents', () => {
  it('Day 1: every jumper carries the loop current, in the right direction', () => {
    const board = day01.realBuild!.breadboard!
    const circuit = day01.lab!.circuit
    const r = solveDC(circuit)
    const i = r.components.R1.current
    expect(i).toBeGreaterThan(0)
    const w = wireCurrents(board, circuit, r)
    expect(w['w-5v']).toBeCloseTo(i) // uno:5V → T+1
    expect(w['w-plus']).toBeCloseTo(i) // T+8 → a8
    expect(w['w-minus']).toBeCloseTo(i) // a13 → T-13
    expect(w['w-gnd']).toBeCloseTo(-i) // uno:GND → T-1, so current runs against it
  })

  it('Day 8: closed switch-jumpers report the solver, bypassed parts carry nothing', () => {
    const board = day08.realBuild!.breadboard!
    const circuit = day08.lab!.circuit
    const r = solveDC(circuit)
    const w = wireCurrents(board, circuit, r)
    const i = r.components.R1.current
    expect(w.S1).toBeCloseTo(r.components.S1.current)
    expect(w.S1).toBeCloseTo(i, 4)
    expect(Math.abs(r.components.D2.current)).toBeLessThan(1e-6)
    expect(w['w-plus']).toBeCloseTo(i)
    expect(w['w-minus']).toBeCloseTo(i)
  })
})
