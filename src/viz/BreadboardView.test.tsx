import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BreadboardView, holePosition, layoutProblems, MIN_TEXT_PX, parseHole, PITCH, resistorBands } from './BreadboardView'
import type { BreadboardLayout } from './types'

const uno: BreadboardLayout = {
  supply: 'uno',
  parts: [
    { kind: 'wire', id: 'W1', from: 'uno:5V', to: 'T+1', color: 'red' },
    { kind: 'wire', id: 'W2', from: 'uno:GND', to: 'T-2', color: 'black' },
    { kind: 'wire', id: 'W3', from: 'T+5', to: 'b5', color: 'red' },
    { kind: 'resistor', id: 'R1', from: 'a5', to: 'a9', ohms: 220 },
    { kind: 'led', id: 'D1', anode: 'e9', cathode: 'e10', color: 'red' },
    { kind: 'wire', id: 'W4', from: 'a10', to: 'T-10', color: 'black' },
  ],
}

const battery: BreadboardLayout = {
  supply: 'battery9v',
  parts: [
    { kind: 'wire', id: 'W1', from: 'bat:+', to: 'T+1', color: 'red' },
    { kind: 'wire', id: 'W2', from: 'bat:-', to: 'T-1', color: 'black' },
    { kind: 'diode', id: 'D2', anode: 'c3', cathode: 'c7' },
  ],
}

describe('resistorBands', () => {
  it('gives the 4-band code', () => {
    expect(resistorBands(220)).toEqual(['red', 'red', 'brown', 'gold'])
    expect(resistorBands(1000)).toEqual(['brown', 'black', 'red', 'gold'])
    expect(resistorBands(10)).toEqual(['brown', 'black', 'black', 'gold'])
    expect(resistorBands(4700)).toEqual(['yellow', 'violet', 'red', 'gold'])
    expect(resistorBands(470)).toEqual(['yellow', 'violet', 'brown', 'gold'])
    expect(resistorBands(10_000)).toEqual(['brown', 'black', 'orange', 'gold'])
    expect(resistorBands(1)).toEqual(['brown', 'black', 'gold', 'gold'])
    expect(resistorBands(0.47)).toEqual(['yellow', 'violet', 'silver', 'gold'])
  })

  it('rounds to two significant figures, codes 0 Ω as one black band, and rejects the rest', () => {
    expect(resistorBands(999)).toEqual(['brown', 'black', 'red', 'gold'])
    expect(resistorBands(0)).toEqual(['black'])
    for (const bad of [-1, NaN, Infinity, 0.05]) expect(() => resistorBands(bad)).toThrow(RangeError)
  })
})

describe('parseHole', () => {
  it('parses every hole kind', () => {
    expect(parseHole('a1')).toEqual({ kind: 'strip', row: 'a', col: 1 })
    expect(parseHole('j30')).toEqual({ kind: 'strip', row: 'j', col: 30 })
    expect(parseHole('T+12')).toEqual({ kind: 'rail', rail: 'T+', col: 12 })
    expect(parseHole('B-30')).toEqual({ kind: 'rail', rail: 'B-', col: 30 })
    expect(parseHole('uno:5V')).toEqual({ kind: 'uno', pin: '5V' })
    expect(parseHole('uno:D13')).toEqual({ kind: 'uno', pin: 'D13' })
    expect(parseHole('uno:A5')).toEqual({ kind: 'uno', pin: 'A5' })
    expect(parseHole('bat:-')).toEqual({ kind: 'battery', terminal: '-' })
  })

  it('throws on anything else', () => {
    for (const bad of ['', 'a0', 'a31', 'a01', 'k1', 'A1', ' a1', 'T+0', 'T*1', 'M+1', 'uno:D1', 'uno:D14', 'uno:A6', 'uno:5v', 'bat:x', 'bat+']) {
      expect(() => parseHole(bad), bad).toThrow(/Invalid breadboard hole/)
    }
  })
})

describe('holePosition', () => {
  it('lays holes out on the 0.1" pitch with the centre gap and rails', () => {
    const a1 = holePosition('a1')
    expect(holePosition('a2').x - a1.x).toBeCloseTo(PITCH)
    expect(holePosition('b1').y - a1.y).toBeCloseTo(PITCH)
    expect(holePosition('a30').x - a1.x).toBeCloseTo(29 * PITCH)
    expect(holePosition('f1').y - holePosition('e1').y).toBeCloseTo(3 * PITCH)
    expect(holePosition('T+7').x).toBeCloseTo(holePosition('a7').x)
    expect(holePosition('T-1').y).toBeLessThan(a1.y)
    expect(holePosition('T+1').y).toBeLessThan(holePosition('T-1').y)
    expect(holePosition('B+1').y).toBeGreaterThan(holePosition('B-1').y)
    expect(holePosition('B-1').y).toBeGreaterThan(holePosition('j1').y)
    // Off-board pins sit to the left of the board.
    for (const h of ['uno:5V', 'uno:GND', 'uno:D13', 'uno:A0', 'bat:+', 'bat:-']) expect(holePosition(h).x).toBeLessThan(a1.x - 2 * PITCH)
    expect(() => holePosition('z9')).toThrow()
  })
})

describe('layoutProblems', () => {
  it('passes buildable layouts', () => {
    expect(layoutProblems(uno)).toEqual([])
    expect(layoutProblems(battery)).toEqual([])
  })

  it('reports bad holes, a missing supply pin and shared holes', () => {
    const bad: BreadboardLayout = {
      supply: 'battery9v',
      parts: [
        { kind: 'resistor', id: 'R1', from: 'a5', to: 'a35', ohms: 220 },
        { kind: 'wire', id: 'W1', from: 'uno:5V', to: 'a5', color: 'red' },
        { kind: 'resistor', id: 'R2', from: 'c1', to: 'c4', ohms: -5 },
      ],
    }
    expect(layoutProblems(bad)).toEqual([
      'R1: Invalid breadboard hole "a35"',
      'W1: uno:5V needs the Uno supply',
      'W1: a5 is already used by R1',
      'R2: No 4-band colour code for -5 Ω',
    ])
  })
})

describe('BreadboardView', () => {
  it('names every part with its holes', () => {
    render(<BreadboardView layout={uno} ariaLabel="Day 1 build" />)
    expect(screen.getByRole('figure', { name: 'Day 1 build' })).toBeInTheDocument()
    for (const name of [
      'Resistor R1, 220 Ω, from a5 to a9',
      'LED D1 (red), anode (long leg) in e9, cathode (flat side) in e10',
      'Red wire W1, from Uno 5V to top + rail 1',
      'Black wire W4, from a10 to top − rail 10',
    ]) {
      const part = screen.getByRole('img', { name })
      expect(part).toHaveAttribute('tabindex', '0')
    }
    render(<BreadboardView layout={battery} ariaLabel="9 V build" />)
    expect(screen.getByRole('img', { name: 'Diode D2, anode in c3, cathode (banded end) in c7' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Red wire W1, from battery + to top + rail 1' })).toBeInTheDocument()
  })

  it('paints the resistor colour code', () => {
    const { container } = render(<BreadboardView layout={uno} ariaLabel="b" />)
    const bands = [...container.querySelectorAll('[data-part="R1"] .bb-band')].map((b) => b.getAttribute('class'))
    expect(bands).toEqual(['bb-band bb-band--red', 'bb-band bb-band--red', 'bb-band bb-band--brown', 'bb-band bb-band--gold'])
  })

  it('shows id and value on focus or hover, and lights the connected strips', () => {
    const { container } = render(<BreadboardView layout={uno} ariaLabel="b" />)
    expect(screen.queryByText('R1 · 220 Ω')).toBeNull()
    const r1 = screen.getByRole('img', { name: /^Resistor R1/ })
    fireEvent.focus(r1)
    expect(screen.getByText('R1 · 220 Ω')).toBeInTheDocument()
    expect(screen.getByText('a5 → a9')).toBeInTheDocument()
    expect(container.querySelectorAll('.bb-groups rect')).toHaveLength(2)
    fireEvent.blur(r1)
    expect(screen.queryByText('R1 · 220 Ω')).toBeNull()
    fireEvent.mouseEnter(screen.getByRole('img', { name: /^LED D1/ }))
    expect(screen.getByText('D1 · red LED')).toBeInTheDocument()
  })

  it('haloes highlighted parts', () => {
    const { container } = render(<BreadboardView layout={uno} ariaLabel="b" highlight={['R1', 'W3']} />)
    expect(container.querySelectorAll('[data-part="R1"] .bb-halo')).toHaveLength(1)
    expect(container.querySelectorAll('[data-part="W3"] .bb-halo--wire')).toHaveLength(1)
    expect(container.querySelectorAll('.bb-halo')).toHaveLength(2)
  })

  it('skips parts with wiring problems instead of crashing', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const layout: BreadboardLayout = { ...uno, parts: [...uno.parts, { kind: 'wire', id: 'W9', from: 'q1', to: 'a1', color: 'green' }] }
    const { container } = render(<BreadboardView layout={layout} ariaLabel="b" />)
    expect(container.querySelector('[data-part="W9"]')).toBeNull()
    expect(container.querySelector('[data-part="R1"]')).not.toBeNull()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('W9: Invalid breadboard hole "q1"'))
    error.mockRestore()
  })

  it('keeps text ≥ 10 px: counter-scales, then scrolls with a hint on a phone', () => {
    let fire: (w: number) => void = () => {}
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: ResizeObserverCallback) {
          fire = (w) => cb([{ contentRect: { width: w } } as ResizeObserverEntry], this as unknown as ResizeObserver)
        }
        observe() {}
        disconnect() {}
      },
    )
    try {
      const { container } = render(<BreadboardView layout={uno} ariaLabel="b" />)
      const svg = container.querySelector('svg')!
      const minWidth = parseFloat(svg.style.minWidth)
      const smallestPx = (w: number) => {
        act(() => fire(w))
        const scale = Math.max(w, minWidth) / Number(svg.getAttribute('viewBox')!.split(' ')[2])
        const sizes = [...container.querySelectorAll<SVGElement>('[style*="font-size"]')].map((el) => parseFloat(el.style.fontSize))
        return Math.min(...sizes) * scale
      }
      expect(smallestPx(700)).toBeGreaterThanOrEqual(MIN_TEXT_PX - 0.01)
      expect(container.querySelector('.bb-hint')).toBeNull()
      expect(smallestPx(343)).toBeGreaterThanOrEqual(MIN_TEXT_PX - 0.01)
      expect(minWidth).toBeGreaterThan(343)
      expect(screen.getByText(/Scroll sideways/)).toBeInTheDocument()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
