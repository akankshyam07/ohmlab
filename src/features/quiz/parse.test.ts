import { describe, expect, it } from 'vitest'
import { parseAnswer, parseSI, unitScale } from './parse'

describe('parseSI', () => {
  it.each([
    ['330', 330],
    ['0.33k', 330],
    ['0.33 kΩ', 330],
    ['330 Ω', 330],
    ['330Ω', 330],
    ['330 ohms', 330],
    ['13.6 mA', 0.0136],
    ['13,6', 13.6],
    ['  2.2 V ', 2.2],
    ['4.7K', 4700],
    ['1 MΩ', 1e6],
    ['10 µA', 1e-5],
    ['10 μA', 1e-5],
    ['10uA', 1e-5],
    ['100 nF', 1e-7],
    ['22 pF', 2.2e-11],
    ['.5', 0.5],
    ['-3 V', -3],
    ['1e3', 1000],
    ['50 %', 50],
  ])('%s → %d', (text, expected) => {
    expect(parseSI(text)).toBeCloseTo(expected, 15)
  })

  it.each(['', 'abc', 'k330', '3 3', '1.2.3', '5 V2', 'NaN'])('rejects %j', (text) => {
    expect(parseSI(text)).toBeNull()
  })
})

describe('parseAnswer', () => {
  it('reads bare numbers in the question unit and converts prefixed ones', () => {
    expect(unitScale('mA')).toBe(1e-3)
    expect(unitScale('V')).toBe(1)
    expect(parseAnswer('13.6', 'mA')).toBeCloseTo(13.6)
    expect(parseAnswer('13.6 mA', 'mA')).toBeCloseTo(13.6)
    expect(parseAnswer('0.0136 A', 'mA')).toBeCloseTo(13.6)
    expect(parseAnswer('13.6 mA', 'A')).toBeCloseTo(0.0136)
    expect(parseAnswer('1k', 'Ω')).toBe(1000)
    expect(parseAnswer('300 microamps', 'A')).toBeCloseTo(300e-6)
    expect(parseAnswer('2 Megaohms', 'Ω')).toBe(2e6)
    expect(parseAnswer('5 milliamps', 'mA')).toBeCloseTo(5)
    expect(parseAnswer('what', 'Ω')).toBeNull()
  })
})
