import { describe, expect, it } from 'vitest'
import { formatSI } from './format'

describe('formatSI', () => {
  it.each([
    [0.013636, 'A', '13.6 mA'],
    [1000, 'Ω', '1 kΩ'],
    [220, 'Ω', '220 Ω'],
    [2.0123, 'V', '2.01 V'],
    [0.0000003, 'A', '300 nA'],
    [0, 'A', '0 A'],
    [-0.5, 'W', '-500 mW'],
    [Infinity, 'Ω', '∞ Ω'],
  ])('%f %s → %s', (value, unit, expected) => {
    expect(formatSI(value, unit)).toBe(expected)
  })
})
