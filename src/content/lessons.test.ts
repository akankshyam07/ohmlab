import { describe, expect, it } from 'vitest'
import { solveDC } from '../sim/solver'
import type { Circuit, Component, SolveResult } from '../sim/types'
import type { CircuitLayout, Point } from '../viz/types'
import { getLesson, lessons, phases } from './index'
import { BREADBOARD, LED_WAY, METER_NEEDED, METER_OPTIONAL, METER_VOLTS, NO_METER } from './lessons/primer'
import type { Block, ControlValue, Lab, LabControl } from './types'

const NODE_FIELDS: Record<Component['kind'], string[]> = {
  vsource: ['pos', 'neg'],
  resistor: ['a', 'b'],
  led: ['anode', 'cathode'],
  diode: ['anode', 'cathode'],
  switch: ['a', 'b'],
}

const terminals = (c: Component) => NODE_FIELDS[c.kind].map((f) => (c as unknown as Record<string, string>)[f])
const nodesOf = (circuit: Circuit) => new Set(circuit.components.flatMap(terminals))
const key = (p: Point) => `${p.x},${p.y}`
const labs = lessons.filter((l) => l.lab).map((l) => [l.id, l.lab!] as const)

// ---------------------------------------------------------------------------
// Applying controls the way the Lab does

type Setting = { control: LabControl; value: ControlValue }

function valuesFor(control: LabControl): ControlValue[] {
  switch (control.type) {
    case 'choice':
      return control.options.map((o) => o.value)
    case 'toggle':
    case 'flip':
      return [false, true]
    case 'slider': {
      const count = Math.round((control.max - control.min) / control.step) + 1
      const all = Array.from({ length: count }, (_, i) => control.min + i * control.step)
      if (count <= 30) return all
      // ponytail: ~15 evenly spaced samples snapped to the step grid; enough for Phase 1 sliders.
      return [...new Set(Array.from({ length: 15 }, (_, i) => all[Math.round((i * (count - 1)) / 14)]))]
    }
  }
}

function apply(lab: Lab, settings: Setting[]): { circuit: Circuit; layout: CircuitLayout } {
  const circuit = structuredClone(lab.circuit)
  const layout = structuredClone(lab.layout)
  for (const { control, value } of settings) {
    const comp = circuit.components.find((c) => c.id === control.componentId)!
    if (control.type === 'flip') {
      if (value === true && (comp.kind === 'led' || comp.kind === 'diode')) {
        ;[comp.anode, comp.cathode] = [comp.cathode, comp.anode]
        const part = layout.parts.find((p) => p.id === comp.id)!
        ;[part.from, part.to] = [part.to, part.from]
      }
    } else {
      ;(comp as unknown as Record<string, ControlValue>)[control.prop] = value
    }
  }
  return { circuit, layout }
}

/** The lab with some controls set by id, e.g. { r1: 1000, load: true }. */
function withControls(lab: Lab, values: Record<string, ControlValue>) {
  const settings = Object.entries(values).map(([id, value]) => {
    const control = lab.controls.find((c) => c.id === id)
    if (!control) throw new Error(`no control ${id}`)
    return { control, value }
  })
  const { circuit } = apply(lab, settings)
  return { circuit, result: solveDC(circuit) }
}

type Predict = Extract<Block, { type: 'predict' }>
const predictsOf = (lesson: (typeof lessons)[number]) =>
  lesson.sections.flatMap((s) => s.blocks.filter((b): b is Predict => b.type === 'predict'))
const LEADING_VERDICT = /^(right|correct|exactly|yes)\b/i

function* configurations(lab: Lab): Generator<Setting[]> {
  const axes = lab.controls.map((control) => valuesFor(control).map((value) => ({ control, value })))
  const total = axes.reduce((n, a) => n * a.length, 1)
  if (total > 20_000) throw new Error(`control space too large to brute-force: ${total}`)
  const idx = axes.map(() => 0)
  for (let n = 0; n < total; n++) {
    yield axes.map((a, i) => a[idx[i]])
    for (let i = 0; i < idx.length; i++) {
      if (++idx[i] < axes[i].length) break
      idx[i] = 0
    }
  }
}

/** Net current into every drawn point must be zero, which proves each wire's `carries` is right. */
function kirchhoffErrors(circuit: Circuit, layout: CircuitLayout, result: SolveResult): string[] {
  const net = new Map<string, number>()
  const add = (p: Point, i: number) => net.set(key(p), (net.get(key(p)) ?? 0) + i)
  let scale = 1e-9
  for (const part of layout.parts) {
    const comp = circuit.components.find((c) => c.id === part.id)!
    const i = result.components[part.id].current
    scale = Math.max(scale, Math.abs(i))
    // Positive current leaves the first terminal's node into the part and returns at the second,
    // except a source, whose positive current leaves its + terminal into the circuit.
    const sign = comp.kind === 'vsource' ? 1 : -1
    add(part.from, sign * i)
    add(part.to, -sign * i)
  }
  for (const w of layout.wires) {
    const i = w.carries ? w.carries.sign * result.components[w.carries.componentId].current : 0
    add(w.points[0], -i)
    add(w.points[w.points.length - 1], i)
  }
  return [...net].filter(([, i]) => Math.abs(i) > 1e-6 * scale + 1e-9).map(([p, i]) => `${p}: ${i}`)
}

// ---------------------------------------------------------------------------

describe('curriculum', () => {
  it('has 7 phases covering days 1–100 in order, each with a summary', () => {
    expect(phases.map((p) => p.n)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(phases.flatMap((p) => p.days.map((d) => d.day))).toEqual(Array.from({ length: 100 }, (_, i) => i + 1))
    for (const p of phases) {
      expect(p.summary.length).toBeGreaterThan(20)
      for (const d of p.days) expect(d.title.length).toBeGreaterThan(3)
    }
    expect(phases[6].days.filter((d) => d.title.startsWith('Capstone')).map((d) => d.day)).toEqual([93, 94, 95, 96, 97, 98, 99, 100])
  })

  it('links exactly the six MVP days to lessons, consistently', () => {
    const linked = phases.flatMap((p) => p.days.filter((d) => d.lessonId).map((d) => ({ ...d, phase: p.n })))
    expect(linked.map((d) => d.day)).toEqual([1, 2, 5, 6, 7, 8])
    for (const d of linked) {
      const lesson = getLesson(d.lessonId!)
      expect(lesson, d.lessonId).toBeDefined()
      expect(lesson!.day).toBe(d.day)
      expect(lesson!.phase).toBe(d.phase)
    }
    expect(lessons.map((l) => l.id).sort()).toEqual(linked.map((d) => d.lessonId).sort())
  })
})

describe('lesson schema', () => {
  it('has unique ids, sorted by day', () => {
    expect(new Set(lessons.map((l) => l.id)).size).toBe(lessons.length)
    expect(lessons.map((l) => l.day)).toEqual([...lessons.map((l) => l.day)].sort((a, b) => a - b))
    expect(getLesson('nope')).toBeUndefined()
  })

  for (const lesson of lessons) {
    describe(lesson.id, () => {
      it('has 3–5 sections, objectives, a walkthrough and 5–7 quiz questions', () => {
        expect(lesson.sections.length).toBeGreaterThanOrEqual(3)
        expect(lesson.sections.length).toBeLessThanOrEqual(5)
        expect(new Set(lesson.sections.map((s) => s.id)).size).toBe(lesson.sections.length)
        expect(lesson.objectives.length).toBeGreaterThan(0)
        expect(lesson.sections.some((s) => s.blocks.some((b) => b.type === 'walkthrough'))).toBe(true)
        expect(lesson.quiz.length).toBeGreaterThanOrEqual(5)
        expect(lesson.quiz.length).toBeLessThanOrEqual(7)
        expect(lesson.realBuild?.steps.length).toBeGreaterThan(0)
        expect(lesson.realBuild?.safety?.length).toBeGreaterThan(0)
      })

      it('quiz: unique ids, exactly one correct option, every option explains why', () => {
        expect(new Set(lesson.quiz.map((q) => q.id)).size).toBe(lesson.quiz.length)
        expect(lesson.quiz.some((q) => q.type === 'choice')).toBe(true)
        expect(lesson.quiz.some((q) => q.type === 'numeric')).toBe(true)
        for (const q of lesson.quiz) {
          if (q.type === 'choice') {
            expect(q.options.filter((o) => o.correct).length, q.id).toBe(1)
            for (const o of q.options) expect(o.why.trim().length, `${q.id}: ${o.text}`).toBeGreaterThan(10)
          } else {
            expect(q.tolerance).toBeGreaterThan(0)
            expect(q.tolerance).toBeLessThanOrEqual(0.1)
            expect(q.unit && q.hint && q.explanation).toBeTruthy()
          }
        }
      })

      it('quiz: correct answers are not mostly first, and never start with a verdict', () => {
        const choices = lesson.quiz.filter((q) => q.type === 'choice')
        const first = choices.filter((q) => q.options[0].correct).length
        expect(first, 'choice questions with the correct option first').toBeLessThanOrEqual(choices.length / 2)
        // The quiz says "Correct"/"Not quite" itself and quotes the right option's why as a correction.
        for (const q of choices) for (const o of q.options) if (o.correct) expect(o.why, q.id).not.toMatch(LEADING_VERDICT)
      })

      it('has at least 2 predict blocks: one correct option, a why for each, and a tryIt that names a lab control', () => {
        const predicts = predictsOf(lesson)
        expect(predicts.length).toBeGreaterThanOrEqual(2)
        const controlLabels = lesson.lab!.controls.map((c) => c.label)
        for (const p of predicts) {
          expect(p.options.length, p.id).toBeGreaterThanOrEqual(3)
          expect(p.options.filter((o) => o.correct).length, p.id).toBe(1)
          for (const o of p.options) expect(o.why.trim().length, `${p.id}: ${o.text}`).toBeGreaterThan(10)
          for (const o of p.options) if (o.correct) expect(o.why, p.id).not.toMatch(LEADING_VERDICT)
          expect(controlLabels.some((label) => p.tryIt.includes(`**${label}**`)), `${p.id} tryIt names a control`).toBe(true)
        }
      })

      it('build steps open with the breadboard primer and say whether a multimeter is needed', () => {
        const build = lesson.realBuild!
        expect(build.steps[0]).toBe(BREADBOARD)
        const meter = [NO_METER, METER_NEEDED, METER_OPTIONAL].filter((m) => build.steps.includes(m))
        expect(meter.length, 'exactly one multimeter statement').toBe(1)
        const later = build.steps.slice(build.steps.indexOf(meter[0]) + 1).join(' ')
        if (meter[0] !== NO_METER) expect(build.steps, 'meter primer').toContain(METER_VOLTS)
        else expect(later, 'no meter steps on a no-meter day').not.toMatch(/DC volts|multimeter/i)
        if (build.parts.some((p) => /LED/.test(p))) expect(build.steps).toContain(LED_WAY)
      })

      const lab = lesson.lab!
      it('skipOnClick sits only on choice options, and never on anything a click must reach', () => {
        for (const c of lab.controls) {
          if (c.type !== 'choice') {
            expect(JSON.stringify(c), c.id).not.toContain('skipOnClick')
            continue
          }
          const initial = (lab.circuit.components.find((x) => x.id === c.componentId) as unknown as Record<string, ControlValue>)[c.prop]
          expect(c.options.find((o) => o.value === initial)?.skipOnClick, `${c.id}: the starting value is skipped`).toBeFalsy()
          expect(c.options.filter((o) => !o.skipOnClick).length, c.id).toBeGreaterThanOrEqual(2)
          // Anything that burns a part straight from the starting circuit must be a deliberate choice, not a click.
          for (const o of c.options) {
            const { result } = withControls(lab, { [c.id]: o.value })
            const burns = Object.values(result.components).some((r) => r.status === 'burnt')
            if (burns) expect(o.skipOnClick, `${c.id}: ${o.label} burns a part`).toBe(true)
          }
        }
      })

      it('lab ids all resolve', () => {
        const ids = new Set(lab.circuit.components.map((c) => c.id))
        const controlIds = new Set(lab.controls.map((c) => c.id))
        expect(new Set(lab.layout.parts.map((p) => p.id))).toEqual(ids)
        expect(lab.layout.parts.length).toBe(ids.size)
        expect(controlIds.size).toBe(lab.controls.length)
        for (const c of lab.controls) {
          const comp = lab.circuit.components.find((x) => x.id === c.componentId)
          expect(comp, c.id).toBeDefined()
          if (c.type === 'flip') expect(['led', 'diode']).toContain(comp!.kind)
          else expect(Object.hasOwn(comp!, c.prop), `${c.id}.${c.prop}`).toBe(true)
          const initial = c.type === 'flip' ? undefined : (comp as unknown as Record<string, ControlValue>)[c.prop]
          if (c.type === 'choice') expect(c.options.map((o) => o.value), c.id).toContain(initial)
          if (c.type === 'slider') expect(valuesFor(c), c.id).toContain(initial)
        }
        for (const r of lab.readouts) expect(ids, r.label).toContain(r.componentId)
        for (const [part, control] of Object.entries(lab.clickControls ?? {})) {
          expect(ids).toContain(part)
          expect(controlIds).toContain(control)
        }
        for (const s of lesson.sections)
          for (const b of s.blocks)
            if (b.type === 'walkthrough') for (const step of b.steps) for (const h of step.highlight ?? []) expect(ids, step.text).toContain(h)
        const nodes = nodesOf(lab.circuit)
        expect(nodes).toContain(lab.circuit.ground)
        for (const p of lab.layout.probes ?? []) expect(nodes, p.label).toContain(p.node)
        expect(new Set(lab.challenges.map((c) => c.id)).size).toBe(lab.challenges.length)
        expect(lab.challenges.length).toBeGreaterThanOrEqual(2)
        expect(lab.challenges.length).toBeLessThanOrEqual(4)
      })

      it('layout sits on the grid and its wires join the right nodes', () => {
        const { layout, circuit } = lab
        const inside = (p: Point) =>
          Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x <= layout.width && p.y <= layout.height
        // Union-find over drawn points: part terminals and wire endpoints.
        const parent = new Map<string, string>()
        const find = (k: string): string => (parent.has(k) ? find(parent.get(k)!) : k)
        const union = (a: string, b: string) => {
          const [ra, rb] = [find(a), find(b)]
          if (ra !== rb) parent.set(ra, rb)
        }
        const nodeAt = new Map<string, string>()
        for (const part of layout.parts) {
          expect(inside(part.from) && inside(part.to), part.id).toBe(true)
          const dx = Math.abs(part.to.x - part.from.x)
          const dy = Math.abs(part.to.y - part.from.y)
          expect(dx === 0 || dy === 0, `${part.id} axis-aligned`).toBe(true)
          expect(dx + dy, `${part.id} spans 3 units`).toBe(3)
          const comp = circuit.components.find((c) => c.id === part.id)!
          const [first, second] = terminals(comp)
          nodeAt.set(key(part.from), first)
          nodeAt.set(key(part.to), second)
        }
        for (const w of layout.wires) {
          expect(w.points.every(inside), w.id).toBe(true)
          for (let i = 1; i < w.points.length; i++) {
            const [p, q] = [w.points[i - 1], w.points[i]]
            expect(p.x === q.x || p.y === q.y, `${w.id} segment ${i} is straight`).toBe(true)
          }
          union(key(w.points[0]), key(w.points[w.points.length - 1]))
          if (w.carries) expect(circuit.components.map((c) => c.id)).toContain(w.carries.componentId)
        }
        // Every group of connected terminals is a single circuit node, and every node is drawn as one group.
        const groupNode = new Map<string, string>()
        for (const [pt, node] of nodeAt) {
          const g = find(pt)
          expect(groupNode.get(g) ?? node, `point ${pt}`).toBe(node)
          groupNode.set(g, node)
        }
        expect(new Set(groupNode.values()).size).toBe(groupNode.size)
        for (const w of layout.wires) expect(groupNode.has(find(key(w.points[0]))), `${w.id} touches a terminal`).toBe(true)
      })
    })
  }
})

describe('predict blocks', () => {
  it('have ids unique across all lessons, and vary where the correct option sits', () => {
    const predicts = lessons.flatMap(predictsOf)
    expect(new Set(predicts.map((p) => p.id)).size).toBe(predicts.length)
    const positions = predicts.map((p) => p.options.findIndex((o) => o.correct))
    expect(positions.filter((i) => i === 0).length).toBeLessThanOrEqual(predicts.length / 2)
    expect(new Set(positions).size).toBeGreaterThanOrEqual(3)
  })
})

describe('lab reachability (brute force with solveDC)', () => {
  for (const [id, lab] of labs) {
    it(`${id}: every challenge is reachable but not already solved, and wire currents balance`, () => {
      const initial = solveDC(lab.circuit)
      expect(initial.ok, initial.error).toBe(true)
      for (const ch of lab.challenges) expect(ch.check(initial, lab.circuit), `${ch.id} passes at the start`).toBe(false)

      const reached = new Set<string>()
      let checked = 0
      for (const settings of configurations(lab)) {
        const { circuit, layout } = apply(lab, settings)
        const result = solveDC(circuit)
        if (result.ok) expect(kirchhoffErrors(circuit, layout, result), JSON.stringify(settings.map((s) => s.value))).toEqual([])
        for (const ch of lab.challenges) if (!reached.has(ch.id) && ch.check(result, circuit)) reached.add(ch.id)
        checked++
      }
      expect(checked).toBeGreaterThan(1)
      expect([...reached].sort()).toEqual(lab.challenges.map((c) => c.id).sort())
    })
  }
})

// ---------------------------------------------------------------------------
// Numbers in quiz answers, checked by hand arithmetic.

const parallel = (a: number, b: number) => (a * b) / (a + b)
const expectedAnswers: Record<string, Record<string, number>> = {
  'first-led': {
    'current-1k': ((5 - 2) / 1000) * 1000,
    'resistor-for-10ma': (5 - 2) / 0.01,
  },
  'ohms-law': {
    'r-for-15ma': (5 - 2) / 0.015,
    'current-9v-1k': ((9 - 2) / 1000) * 1000,
    'r-from-vi': 4.5 / 0.002 / 1000,
  },
  'series-parallel': {
    'series-sum': 220 + 330,
    'parallel-equal': parallel(1000, 1000),
    'parallel-unequal': parallel(1000, 2000),
    'lab-r2-current': (5 / (1000 + parallel(1000, 1000)) / 2) * 1000,
  },
  'voltage-divider': {
    'vout-2k-1k': (5 * 1000) / (2000 + 1000),
    'vout-9v-equal': (9 * 10000) / 20000,
    'loaded-10k': (5 * parallel(10000, 10000)) / (10000 + parallel(10000, 10000)),
  },
  power: {
    'p-5v-100': (5 * 5) / 100,
    'p-20ma-220': 0.02 * 0.02 * 220 * 1000,
    'p-day1': ((3 * 3) / 220) * 1000,
  },
  'diodes-leds': {
    'blue-10ma': (5 - 3) / 0.01,
    'two-red-9v': ((9 - 2 - 2) / 220) * 1000,
    'diode-plus-led': ((5 - 0.7 - 2) / 220) * 1000,
  },
}

describe('numeric quiz answers match hand calculations', () => {
  for (const lesson of lessons) {
    it(lesson.id, () => {
      const expected = expectedAnswers[lesson.id] ?? {}
      for (const q of lesson.quiz) {
        if (q.type !== 'numeric') continue
        expect(expected[q.id], `${q.id} has a hand calculation in this test`).toBeDefined()
        expect(Math.abs(q.answer - expected[q.id]) / expected[q.id], q.id).toBeLessThan(0.005)
      }
    })
  }
})

describe('simulator values quoted in lesson text', () => {
  const loop = (volts: number, ohms: number, parts: ('red' | 'blue' | 'diode')[]) => {
    const components: Component[] = [
      { kind: 'vsource', id: 'V1', pos: 'v', neg: 'g', volts },
      { kind: 'resistor', id: 'R1', a: 'v', b: 'n0', ohms },
    ]
    parts.forEach((p, i) => {
      const ends = { id: `D${i + 1}`, anode: `n${i}`, cathode: i === parts.length - 1 ? 'g' : `n${i + 1}` }
      components.push(p === 'diode' ? { kind: 'diode', ...ends } : { kind: 'led', color: p, ...ends })
    })
    return solveDC({ ground: 'g', components }).components.R1.current * 1000
  }
  it.each([
    ['Day 1: red, 220 Ω, about 14 mA', 5, 220, ['red'], 14],
    ['Day 1: blue, 220 Ω, about 9 mA', 5, 220, ['blue'], 9],
    ['Day 1: red, 10 kΩ, about 0.33 mA', 5, 10000, ['red'], 0.33],
    ['Day 8: 1N4007 + red, 220 Ω, about 10.7 mA', 5, 220, ['diode', 'red'], 10.7],
    ['Day 2: red, 330 Ω, about 9.3 mA', 5, 330, ['red'], 9.3],
    ['Day 2: red on 9 V, 330 Ω, about 21 mA', 9, 330, ['red'], 21],
    ['Day 2: red on 9 V, 1 kΩ, about 7 mA', 9, 1000, ['red'], 7],
    ['Day 8: two red, 220 Ω, about 5.6 mA', 5, 220, ['red', 'red'], 5.6],
    ['Day 8: two blue on 9 V, 220 Ω, about 13 mA', 9, 220, ['blue', 'blue'], 13],
  ] as const)('%s', (_label, volts, ohms, parts, quoted) => {
    expect(Math.abs(loop(volts, ohms, [...parts]) - quoted) / quoted).toBeLessThan(0.05)
  })
})

describe('challenges agree with what the lesson teaches', () => {
  const challenge = (lessonId: string, id: string) => {
    const lab = getLesson(lessonId)!.lab!
    return { lab, ch: lab.challenges.find((c) => c.id === id)! }
  }

  it('Day 6: the 10× rule (1 kΩ / 1 kΩ with a 10 kΩ load) passes the stiff challenge; weaker dividers do not', () => {
    const { lab, ch } = challenge('voltage-divider', 'stiff')
    const run = (ohms: number, r1 = ohms) => {
      const { circuit, result } = withControls(lab, { r1, r2: ohms, load: true })
      return { vout: result.nodeVoltages.mid, pass: ch.check(result, circuit) }
    }
    // The loading table: 10 kΩ / 10 kΩ → 1.67 V, 1 kΩ / 1 kΩ → 2.38 V (about 5 % sag), 220 Ω / 220 Ω → 2.47 V.
    expect(run(10000).vout).toBeCloseTo(1.667, 2)
    expect(run(1000).vout).toBeCloseTo(2.381, 2)
    expect(run(220).vout).toBeCloseTo(2.473, 2)
    expect(Math.abs(1 - run(1000).vout / 2.5)).toBeCloseTo(0.05, 2)
    expect(run(1000).pass).toBe(true)
    expect(run(330).pass).toBe(true)
    expect(run(220).pass).toBe(true)
    expect(run(2000).pass).toBe(false)
    // 5.1 kΩ over 10 kΩ happens to land near 2.5 V when loaded, but it isn't stiff.
    expect(run(10000, 5100).vout).toBeGreaterThan(2.35)
    expect(run(10000, 5100).pass).toBe(false)
  })

  it('Day 8: reverse blocking passes on 5 V but not when D1 is over-stressed on 9 V', () => {
    const { lab, ch } = challenge('diodes-leds', 'reverse-block')
    const five = withControls(lab, { 'flip-d1': true, supply: 5 })
    const nine = withControls(lab, { 'flip-d1': true, supply: 9 })
    expect(ch.check(five.result, five.circuit)).toBe(true)
    expect(nine.result.components.D1.status).toBe('overvoltage')
    expect(ch.check(nine.result, nine.circuit)).toBe(false)
  })

  it('LED challenges never accept a current the simulator warns about', () => {
    for (const [id, lab] of labs) {
      for (const settings of configurations(lab)) {
        const { circuit } = apply(lab, settings)
        const result = solveDC(circuit)
        for (const ch of lab.challenges) {
          if (!ch.check(result, circuit)) continue
          if (id === 'first-led' && ch.id === 'burn-it') continue
          for (const [part, r] of Object.entries(result.components))
            if (circuit.components.find((c) => c.id === part)?.kind === 'led')
              expect(['ok', 'off'], `${id}/${ch.id}: ${part} at ${(r.current * 1000).toFixed(1)} mA`).toContain(r.status)
        }
      }
    }
  })
})
