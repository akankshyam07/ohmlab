import { describe, expect, it } from 'vitest'
import day01 from '../../content/lessons/day01'
import day08 from '../../content/lessons/day08'
import { solveDC } from '../../sim/solver'
import { BOARD, ESP32_ROWS, ESP32_SILK, esp32PinX, holePoint, wireCurrents } from './model'

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

describe('ESP32 DevKit V1 (30-pin) pinout', () => {
  // Silkscreen names, each row read from the USB end.
  const fromUsb = (row: number) =>
    ESP32_ROWS[row].pins
      .map((pin, i) => ({ pin, x: esp32PinX(i) }))
      .sort((a, b) => a.x - b.x)
      .map(({ pin }) => ESP32_SILK[pin] ?? (pin.startsWith('GPIO') ? `D${pin.slice(4)}` : pin))

  it('matches the board, 15 pins a side', () => {
    expect(fromUsb(0)).toEqual(['3V3', 'GND', 'D15', 'D2', 'D4', 'RX2', 'TX2', 'D5', 'D18', 'D19', 'D21', 'RX0', 'TX0', 'D22', 'D23'])
    expect(fromUsb(1)).toEqual(['VIN', 'GND', 'D13', 'D12', 'D14', 'D27', 'D26', 'D25', 'D33', 'D32', 'D35', 'D34', 'VN', 'VP', 'EN'])
  })

  it('resolves every esp32:* hole the grammar allows to a distinct point', () => {
    const holes = ['esp32:3V3', 'esp32:VIN', 'esp32:GND', 'esp32:EN', ...[1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39].map((n) => `esp32:GPIO${n}`)]
    const keys = new Set(holes.map((h) => JSON.stringify(holePoint(h))))
    expect(keys.size).toBe(holes.length)
    expect(() => holePoint('esp32:GPIO6')).toThrow()
  })
})
