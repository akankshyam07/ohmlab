import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Circuit, ComponentResult, SolveResult } from '../sim/types'
import { chevronLook, CircuitView, flowSpeed, MIN_HIT_PX, MIN_TEXT_PX, partLabel, placeLabels, textScale } from './CircuitView'
import type { CircuitLayout } from './types'

const circuit: Circuit = {
  ground: 'gnd',
  components: [
    { kind: 'vsource', id: 'B1', pos: 'vcc', neg: 'gnd', volts: 5 },
    { kind: 'switch', id: 'S1', a: 'vcc', b: 'top', closed: false },
    { kind: 'resistor', id: 'R1', a: 'top', b: 'mid', ohms: 220 },
    { kind: 'led', id: 'D1', anode: 'mid', cathode: 'k', color: 'red' },
    { kind: 'diode', id: 'D2', anode: 'k', cathode: 'gnd' },
  ],
}

const layout: CircuitLayout = {
  width: 10,
  height: 6,
  parts: [
    { id: 'B1', from: { x: 0, y: 1 }, to: { x: 0, y: 4 } },
    { id: 'S1', from: { x: 1, y: 0 }, to: { x: 4, y: 0 } },
    { id: 'R1', from: { x: 5, y: 0 }, to: { x: 8, y: 0 } },
    { id: 'D1', from: { x: 9, y: 1 }, to: { x: 9, y: 4 } },
    { id: 'D2', from: { x: 6, y: 6 }, to: { x: 3, y: 6 } },
  ],
  wires: [
    { id: 'w1', points: [{ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }], carries: { componentId: 'B1', sign: 1 } },
    { id: 'w2', points: [{ x: 8, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 1 }], carries: { componentId: 'R1', sign: 1 } },
  ],
  probes: [{ node: 'mid', at: { x: 9, y: 0 }, label: 'A' }],
}

const comp = (current: number, extra: Partial<ComponentResult> = {}): ComponentResult => ({
  current,
  voltage: 0,
  power: 0,
  status: 'ok',
  ...extra,
})

function result(i: number, ledExtra: Partial<ComponentResult> = { brightness: 0.8 }): SolveResult {
  return {
    ok: true,
    nodeVoltages: { vcc: 5, top: 5, mid: 3.333, k: 0.7, gnd: 0 },
    components: { B1: comp(i), S1: comp(i), R1: comp(i), D1: comp(i, ledExtra), D2: comp(i) },
  }
}

afterEach(cleanup)

const view = (props: Partial<Parameters<typeof CircuitView>[0]> = {}) =>
  render(<CircuitView circuit={circuit} layout={layout} result={result(0.0133)} ariaLabel="Test circuit" {...props} />)

describe('CircuitView', () => {
  it('names every part kind', () => {
    view({ onPartClick: () => {} })
    for (const name of ['Battery B1, 5 V', 'Switch S1, open', 'Resistor R1, 220 Ω', 'LED D1 (red), lit, 13.3 mA', 'Diode D2, conducting, 13.3 mA']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('figure', { name: 'Test circuit' })).toBeInTheDocument()
  })

  it('fires onPartClick on click and on Enter/Space', () => {
    const onPartClick = vi.fn()
    view({ onPartClick })
    const r1 = screen.getByRole('button', { name: 'Resistor R1, 220 Ω' })
    fireEvent.click(r1)
    fireEvent.keyDown(r1, { key: 'Enter' })
    fireEvent.keyDown(screen.getByRole('button', { name: 'Switch S1, open' }), { key: ' ' })
    expect(onPartClick.mock.calls).toEqual([['R1'], ['R1'], ['S1']])
  })

  it('has no clickable parts without onPartClick', () => {
    view()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('animates faster for larger current', () => {
    const duration = (i: number) => {
      const { container, unmount } = view({ result: result(i) })
      const d = Number(container.querySelector('[data-wire="w1"] .cv-flow')?.getAttribute('data-flow-duration'))
      unmount()
      return d
    }
    const slow = duration(1e-4)
    const brisk = duration(0.02)
    const fast = duration(0.3)
    expect(slow).toBeGreaterThan(brisk)
    expect(brisk).toBeGreaterThan(fast)
    expect(flowSpeed(5e-6)).toBe(0)
    expect(flowSpeed(-0.02)).toBe(flowSpeed(0.02))
  })

  it('reverses flow for negative current', () => {
    const { container } = view({ result: result(-0.02) })
    expect((container.querySelector('.cv-flow') as SVGElement).style.animationDirection).toBe('reverse')
  })

  it('draws static chevrons instead of flow when showFlow is false', () => {
    const { container } = view({ showFlow: false })
    expect(container.querySelectorAll('.cv-flow')).toHaveLength(0)
    expect(container.querySelectorAll('.cv-chevron').length).toBeGreaterThan(0)
  })

  it('draws no flow below 10 µA', () => {
    const { container } = view({ result: result(1e-6) })
    expect(container.querySelectorAll('.cv-flow, .cv-chevron')).toHaveLength(0)
  })

  it('shows a burnt LED dark with a BURNT tag, ignoring brightness', () => {
    const { container } = view({ result: result(0.4, { status: 'burnt', brightness: 1 }), onPartClick: () => {} })
    expect(screen.getByText('BURNT')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'LED D1 (red), burnt out' })).toBeInTheDocument()
    expect(container.querySelector('.cv-led-glow')).toBeNull()
  })

  it('tags an overheating resistor HOT', () => {
    const r = result(0.1)
    r.components.R1.status = 'overpower'
    view({ result: r })
    expect(screen.getByText('HOT')).toBeInTheDocument()
  })

  it('warns about a reverse-overstressed LED with a REVERSE V tag', () => {
    const { container } = view({ result: result(0, { status: 'overvoltage', brightness: 0, voltage: -8.06 }), onPartClick: () => {} })
    expect(screen.getByText('REVERSE V').closest('.cv-tag--warn')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'LED D1 (red), reverse voltage too high' })).toBeInTheDocument()
    expect(container.querySelector('[data-part="D1"] .cv-led.is-warn')).not.toBeNull()
    expect(container.querySelector('[data-part="D1"] .cv-warn-glow')).not.toBeNull()
  })

  it('does not print a value the label already says', () => {
    const named = { ...layout, parts: layout.parts.map((p) => (p.id === 'D1' ? { ...p, label: 'Red LED' } : p)) }
    const { container } = view({ layout: named })
    expect(container.querySelector('[data-part="D1"] .cv-label')?.textContent).toBe('Red LED')
  })

  it('counter-scales labels and hit areas on a narrow screen', () => {
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
      const { container } = view({ onPartClick: () => {} })
      const svg = container.querySelector('svg')!
      const measure = (w: number) => {
        act(() => fire(w))
        const vbW = Number(svg.getAttribute('viewBox')!.split(' ')[2])
        const scale = w / vbW
        const value = container.querySelector('[data-part="R1"] .cv-label-value') as SVGElement
        const hit = container.querySelector('[data-part="R1"] .cv-hit')!
        return {
          valuePx: parseFloat(value.style.fontSize) * scale,
          hitPx: Math.min(Number(hit.getAttribute('width')), Number(hit.getAttribute('height'))) * scale,
        }
      }
      const phone = measure(330)
      expect(phone.valuePx).toBeGreaterThanOrEqual(MIN_TEXT_PX - 0.05)
      expect(phone.hitPx).toBeGreaterThanOrEqual(MIN_HIT_PX - 0.05)
      // Wide desktop: base sizes, no enlargement.
      measure(1600)
      expect((container.querySelector('[data-part="R1"] .cv-label-value') as SVGElement).style.fontSize).toBe('14px')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('shows the probe voltage on focus', () => {
    view()
    expect(screen.queryByText('A: 3.33 V')).toBeNull()
    fireEvent.focus(screen.getByRole('img', { name: 'Probe A: 3.33 V' }))
    expect(screen.getByText('A: 3.33 V')).toBeInTheDocument()
  })

  it('survives a failed solve with empty node voltages', () => {
    const failed: SolveResult = { ok: false, error: 'Short circuit across B1', nodeVoltages: {}, components: {} }
    view({ result: failed })
    expect(screen.getByText('SHORT CIRCUIT ACROSS B1')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Probe A: —' })).toBeInTheDocument()
  })

  it('marks a 0 Ω resistor as no resistor and halos highlighted parts', () => {
    const zero: Circuit = { ...circuit, components: circuit.components.map((c) => (c.id === 'R1' ? { ...c, ohms: 0 } : c)) }
    const { container } = view({ circuit: zero, highlight: ['S1'] })
    expect(screen.getByText('no resistor')).toBeInTheDocument()
    expect(container.querySelectorAll('.cv-halo')).toHaveLength(1)
  })
})

describe('textScale', () => {
  it('enlarges text only when it would render below the minimum', () => {
    expect(textScale(14, 1)).toBe(1)
    expect(textScale(11, 1)).toBe(1)
    expect(textScale(11, 0.5)).toBe(2)
    expect(textScale(14, 0.5) * 14 * 0.5).toBeCloseTo(MIN_TEXT_PX)
    expect(textScale(11, 0.1)).toBe(3) // capped
    expect(textScale(14, 2)).toBe(1) // never shrinks
    expect(textScale(14, 0)).toBe(1) // unmeasured
    expect(textScale(14, NaN)).toBe(1)
  })
})

describe('partLabel', () => {
  it('describes LED states', () => {
    const led = circuit.components[3]
    expect(partLabel(led, comp(0, { status: 'off', brightness: 0 }))).toBe('LED D1 (red), off, no current')
    expect(partLabel(led, comp(0, { status: 'off', brightness: 0, voltage: -5 }))).toBe('LED D1 (red), off, blocking')
    // N5: a diode bypassed by a closed switch has ~0 V across it: no current, but not "blocking".
    expect(partLabel(circuit.components[4], comp(0, { status: 'off', voltage: 0 }))).toBe('Diode D2, no current')
    expect(partLabel(circuit.components[4], comp(0, { status: 'off', voltage: 0.3 }))).toBe('Diode D2, no current')
    expect(partLabel(circuit.components[4], comp(0, { status: 'off', voltage: -4.3 }))).toBe('Diode D2, blocking')
    expect(partLabel(led, comp(0.05, { status: 'overcurrent', brightness: 1 }))).toBe('LED D1 (red), too much current, 50 mA')
    expect(partLabel(led, comp(0, { status: 'overvoltage', brightness: 0 }))).toBe('LED D1 (red), reverse voltage too high')
    expect(partLabel(circuit.components[4], comp(0, { status: 'overvoltage' }))).toBe('Diode D2, reverse voltage too high')
    expect(partLabel(circuit.components[0], comp(10, { status: 'burnt' }))).toBe('Battery B1, 5 V, shorted')
  })
})

const stubResizeObserver = () => {
  let fire: (w: number, h?: number) => void = () => {}
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: ResizeObserverCallback) {
        fire = (w, h) => cb([{ contentRect: { width: w, height: h ?? 0 } } as ResizeObserverEntry], this as unknown as ResizeObserver)
      }
      observe() {}
      disconnect() {}
    },
  )
  return (w: number, h?: number) => act(() => fire(w, h))
}

describe('placeLabels', () => {
  const box = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 })

  it('keeps the first free candidate and moves a later label that would collide', () => {
    const first = [box(0, 0, 50, 10), box(0, 20, 50, 30)]
    const second = [box(40, 5, 90, 15), box(40, 40, 90, 50), box(60, 0, 110, 10)]
    expect(placeLabels([first, second])).toEqual([0, 1])
    expect(placeLabels([second, first])).toEqual([0, 1])
  })

  it('avoids obstacles and falls back to the least overlap', () => {
    const obstacle = box(0, 0, 100, 100)
    expect(placeLabels([[box(10, 10, 20, 20), box(110, 0, 130, 10)]], [obstacle])).toEqual([1])
    // Every candidate collides: take the one overlapping least (only 5 × 10 of the third).
    expect(placeLabels([[box(10, 10, 60, 20), box(50, 50, 90, 90), box(95, 0, 145, 10)]], [obstacle])).toEqual([2])
    expect(placeLabels([[]])).toEqual([0])
  })
})

describe('CircuitView label collisions', () => {
  const stacked: Circuit = {
    ground: 'gnd',
    components: [
      { kind: 'resistor', id: 'R1', a: 'a', b: 'b', ohms: 220 },
      { kind: 'resistor', id: 'R2', a: 'c', b: 'd', ohms: 1000 },
    ],
  }
  const stackedLayout: CircuitLayout = {
    width: 3,
    height: 1,
    parts: [
      { id: 'R1', from: { x: 0, y: 0 }, to: { x: 3, y: 0 } },
      { id: 'R2', from: { x: 0, y: 1 }, to: { x: 3, y: 1 } },
    ],
    wires: [],
  }
  const res: SolveResult = { ok: true, nodeVoltages: {}, components: { R1: comp(0), R2: comp(0) } }

  it('moves a label that would sit on another part to the opposite side', () => {
    const { container } = render(<CircuitView circuit={stacked} layout={stackedLayout} result={res} ariaLabel="x" />)
    const y = (id: string) => Number(container.querySelector(`[data-part="${id}"] .cv-label`)!.getAttribute('y'))
    expect(y('R1')).toBeLessThan(0) // above R1, as asked
    expect(y('R2')).toBeGreaterThan(40) // "above R2" would cover R1, so it goes below
  })
})

describe('CircuitView after a failure', () => {
  it('stops all flow, dims static chevrons and explains the open circuit', () => {
    const { container } = view({ result: result(0.4, { status: 'burnt', brightness: 1 }) })
    expect(container.querySelectorAll('.cv-flow')).toHaveLength(0)
    const chevrons = container.querySelectorAll('.cv-chevron')
    expect(chevrons.length).toBeGreaterThan(0)
    for (const c of chevrons) expect(c).toHaveClass('is-dimmed')
    expect(screen.getByText('circuit open after failure').closest('[data-part="D1"]')).not.toBeNull()
  })

  it('shows no failure note while everything is intact', () => {
    view()
    expect(screen.queryByText('circuit open after failure')).toBeNull()
  })
})

describe('static chevrons encode current', () => {
  it('pack closer and glow brighter as current grows', () => {
    const looks = [1e-4, 2e-3, 0.02, 0.3].map((i) => chevronLook(flowSpeed(i)))
    for (let i = 1; i < looks.length; i++) {
      expect(looks[i].spacing).toBeLessThan(looks[i - 1].spacing)
      expect(looks[i].opacity).toBeGreaterThan(looks[i - 1].opacity)
    }
    expect(looks[0].opacity).toBeGreaterThanOrEqual(0.3)
    expect(looks[3].opacity).toBeLessThanOrEqual(1)
  })

  it('draws more, brighter chevrons for a bigger current without motion', () => {
    const longWire: CircuitLayout = { ...layout, wires: [{ id: 'w1', points: [{ x: 0, y: 8 }, { x: 20, y: 8 }], carries: { componentId: 'B1', sign: 1 } }] }
    const marks = (i: number) => {
      const { container, unmount } = view({ layout: longWire, result: result(i), showFlow: false })
      const list = [...container.querySelectorAll<SVGElement>('[data-wire="w1"] .cv-chevron')]
      const out = { n: list.length, opacity: Number(list[0].style.opacity) }
      unmount()
      return out
    }
    const small = marks(1e-4)
    const big = marks(0.3)
    expect(big.n).toBeGreaterThan(small.n)
    expect(big.opacity).toBeGreaterThan(small.opacity)
  })
})

describe('CircuitView in a short container', () => {
  it('fits by height and still keeps labels ≥ the minimum size', () => {
    const resize = stubResizeObserver()
    try {
      const { container } = view({ onPartClick: () => {} })
      const svg = container.querySelector('svg')!
      resize(900, 160)
      const [, , vbW, vbH] = svg.getAttribute('viewBox')!.split(' ').map(Number)
      const scale = Math.min(900 / vbW, 160 / vbH)
      expect(scale).toBeCloseTo(160 / vbH) // height is the binding limit
      const value = container.querySelector('[data-part="R1"] .cv-label-value') as SVGElement
      expect(parseFloat(value.style.fontSize) * scale).toBeGreaterThanOrEqual(MIN_TEXT_PX - 0.05)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
