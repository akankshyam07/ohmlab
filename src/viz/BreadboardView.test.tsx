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
  it('gives the 5-band code of the kit’s 1 % parts: three digits, multiplier, brown tolerance', () => {
    expect(resistorBands(220)).toEqual(['red', 'red', 'black', 'black', 'brown'])
    expect(resistorBands(1000)).toEqual(['brown', 'black', 'black', 'brown', 'brown'])
    expect(resistorBands(10)).toEqual(['brown', 'black', 'black', 'gold', 'brown'])
    expect(resistorBands(4700)).toEqual(['yellow', 'violet', 'black', 'brown', 'brown'])
    expect(resistorBands(330)).toEqual(['orange', 'orange', 'black', 'black', 'brown'])
    expect(resistorBands(10_000)).toEqual(['brown', 'black', 'black', 'red', 'brown'])
    expect(resistorBands(1_000_000)).toEqual(['brown', 'black', 'black', 'yellow', 'brown'])
    expect(resistorBands(1)).toEqual(['brown', 'black', 'black', 'silver', 'brown'])
    expect(resistorBands(4.7)).toEqual(['yellow', 'violet', 'black', 'silver', 'brown'])
  })

  it('still gives the 4-band code on request', () => {
    expect(resistorBands(220, 4)).toEqual(['red', 'red', 'brown', 'gold'])
    expect(resistorBands(1000, 4)).toEqual(['brown', 'black', 'red', 'gold'])
    expect(resistorBands(0.47, 4)).toEqual(['yellow', 'violet', 'silver', 'gold'])
    expect(resistorBands(999, 4)).toEqual(['brown', 'black', 'red', 'gold'])
  })

  it('rounds to three significant figures, codes 0 Ω as one black band, and rejects the rest', () => {
    expect(resistorBands(9999)).toEqual(['brown', 'black', 'black', 'red', 'brown'])
    expect(resistorBands(0)).toEqual(['black'])
    for (const bad of [-1, NaN, Infinity, 0.5, 1e12, 9.9996e11]) expect(() => resistorBands(bad), String(bad)).toThrow(RangeError)
    expect(() => resistorBands(0.05, 4)).toThrow(RangeError)
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
    // The battery sits left of the board; the Uno above it, laid out as the real board.
    for (const h of ['bat:+', 'bat:-']) expect(holePosition(h).x).toBeLessThan(a1.x - 2 * PITCH)
    const pin = (p: string) => holePosition(`uno:${p}`)
    for (const p of ['5V', 'GND', 'D13', 'A0']) expect(pin(p).y).toBeLessThan(holePosition('T+1').y - 2 * PITCH)
    // Digital header along the top edge (D13 left of D2); power then analog along the bottom edge.
    expect(pin('D13').y).toBeLessThan(pin('5V').y - 5 * PITCH)
    expect(pin('D13').x).toBeLessThan(pin('D2').x)
    expect(pin('A0').y).toBe(pin('5V').y)
    expect(pin('3V3').x).toBeLessThan(pin('5V').x)
    expect(pin('5V').x + PITCH).toBeCloseTo(pin('GND').x)
    expect(pin('VIN').x).toBeLessThan(pin('A0').x)
    expect(pin('A0').x).toBeLessThan(pin('A5').x)
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
      'R2: No 5-band colour code for -5 Ω',
    ])
  })
})

describe('BreadboardView', () => {
  it('names every part in plain words, never by an internal id', () => {
    const layout: BreadboardLayout = {
      ...uno,
      parts: [...uno.parts, { kind: 'wire', id: 'w-x', from: 'B+3', to: 'j3', color: 'green' }, { kind: 'wire', id: 'S1', from: 'c20', to: 'c24', color: 'yellow' }],
    }
    render(<BreadboardView layout={layout} ariaLabel="Day 1 build" />)
    expect(screen.getByRole('figure', { name: 'Day 1 build' })).toBeInTheDocument()
    for (const name of [
      'Resistor R1, 220 Ω, from a5 to a9',
      'LED D1 (red), anode (long leg) in e9, cathode (short leg, flat side) in e10',
      'Red jumper wire W1 from Uno 5V to the top + rail',
      'Black jumper wire W4 from a10 to the top − rail',
      'Green jumper wire from the bottom + rail to j3',
      'Yellow jumper wire S1 from c20 to c24',
    ]) {
      const part = screen.getByRole('img', { name })
      expect(part).toHaveAttribute('tabindex', '0')
    }
    expect(screen.queryByRole('img', { name: /w-x/ })).toBeNull()
    render(<BreadboardView layout={battery} ariaLabel="9 V build" />)
    expect(screen.getByRole('img', { name: 'Diode D2, anode in c3, cathode (banded end) in c7' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Red jumper wire W1 from the battery’s + lead to the top + rail' })).toBeInTheDocument()
  })

  it('marks LED polarity with + and −, and labels the Uno pins it uses', () => {
    const { container } = render(<BreadboardView layout={uno} ariaLabel="b" />)
    expect([...container.querySelectorAll('.bb-pol')].map((t) => t.textContent)).toEqual(['+', '−'])
    expect(container.querySelectorAll('.bb-flat')).toHaveLength(1)
    const silk = [...container.querySelectorAll('.bb-silk text')].map((t) => t.textContent)
    for (const pin of ['D13', 'D0', 'AREF', 'IOREF', 'RESET', '3.3V', '5V', 'VIN', 'A0', 'A5']) expect(silk).toContain(pin)
    expect(silk.filter((t) => t === 'GND')).toHaveLength(3)
    expect([...container.querySelectorAll('.bb-silk text.is-used')].map((t) => t.textContent)).toEqual(['5V', 'GND'])
  })

  it('paints the resistor colour code', () => {
    const { container } = render(<BreadboardView layout={uno} ariaLabel="b" />)
    const bands = [...container.querySelectorAll('[data-part="R1"] .bb-band')].map((b) => b.getAttribute('class'))
    expect(bands).toEqual(['red', 'red', 'black', 'black', 'brown'].map((c) => `bb-band bb-band--${c}`))
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

  it('keeps text ≥ 10 px: fits the width (or a given height), then scrolls with a hint', () => {
    let fire: (w: number, h?: number) => void = () => {}
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: ResizeObserverCallback) {
          fire = (w, h = 0) => cb([{ contentRect: { width: w, height: h } } as ResizeObserverEntry], this as unknown as ResizeObserver)
        }
        observe() {}
        disconnect() {}
      },
    )
    try {
      const { container } = render(<BreadboardView layout={uno} ariaLabel="b" />)
      const svg = container.querySelector('svg')!
      const [, , vbW, vbH] = svg.getAttribute('viewBox')!.split(' ').map(Number)
      const minWidth = parseFloat(svg.style.minWidth)
      const minHeight = parseFloat(svg.style.minHeight)
      expect(minWidth / vbW).toBeCloseTo(minHeight / vbH, 2)
      /** Smallest text in CSS px, with the box `w` wide and `h` tall (0: height follows the width). */
      const smallestPx = (w: number, h = 0) => {
        act(() => fire(w, h))
        const scale = Math.min(Math.max(w, minWidth) / vbW, h ? Math.max(h, minHeight) / vbH : Infinity)
        const sizes = [...container.querySelectorAll<SVGElement>('[style*="font-size"]')].map((el) => parseFloat(el.style.fontSize))
        return Math.min(...sizes) * scale
      }
      expect(smallestPx(900)).toBeGreaterThanOrEqual(MIN_TEXT_PX - 0.01)
      expect(container.querySelector('.bb-hint')).toBeNull()
      // A short box: the drawing scales to the height, still ≥ 10 px.
      expect(smallestPx(900, minHeight + 40)).toBeGreaterThanOrEqual(MIN_TEXT_PX - 0.01)
      expect(smallestPx(900, minHeight + 40)).toBeLessThan(smallestPx(900) + 0.01)
      expect(container.querySelector('.bb-hint')).toBeNull()
      expect(smallestPx(900, minHeight - 60)).toBeGreaterThanOrEqual(MIN_TEXT_PX - 0.01)
      expect(screen.getByText(/Scroll to see the whole board/)).toBeInTheDocument()
      // A phone: scroll sideways.
      expect(smallestPx(343)).toBeGreaterThanOrEqual(MIN_TEXT_PX - 0.01)
      expect(minWidth).toBeGreaterThan(343)
      expect(screen.getByText(/Scroll sideways/)).toBeInTheDocument()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('keeps id badges off parts, wires and each other', () => {
    const layout: BreadboardLayout = {
      supply: 'uno',
      parts: [
        { kind: 'resistor', id: 'R1', from: 'b3', to: 'b7', ohms: 220 },
        { kind: 'led', id: 'D1', anode: 'd7', cathode: 'd10', color: 'red' },
        { kind: 'led', id: 'D2', anode: 'e10', cathode: 'e14', color: 'red' },
        { kind: 'wire', id: 'S1', from: 'a10', to: 'a14', color: 'yellow' },
        { kind: 'diode', id: 'D3', anode: 'b14', cathode: 'b18' },
        { kind: 'wire', id: 'S2', from: 'd14', to: 'd18', color: 'green' },
      ],
    }
    const { container } = render(<BreadboardView layout={layout} ariaLabel="b" />)
    const boxes = [...container.querySelectorAll('.bb-ids rect')].map((r) => {
      const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((a) => Number(r.getAttribute(a)))
      return { x0: x, y0: y, x1: x + w, y1: y + h }
    })
    expect(boxes).toHaveLength(6)
    const hit = (a: (typeof boxes)[0], b: (typeof boxes)[0]) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(hit(boxes[i], boxes[j]), `${i}/${j}`).toBe(false)
    // No badge sits on a used hole.
    for (const h of ['b3', 'b7', 'd7', 'd10', 'e10', 'e14', 'a10', 'a14', 'b14', 'b18', 'd14', 'd18']) {
      const p = holePosition(h)
      for (const b of boxes) expect(p.x > b.x0 && p.x < b.x1 && p.y > b.y0 && p.y < b.y1, h).toBe(false)
    }
  })
})
