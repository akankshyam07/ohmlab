import type { SolveResult } from '../../sim/types'
import type { Lesson } from '../types'
import { between, mA } from './checks'
import { BREADBOARD, METER_NEEDED, METER_OHMS, METER_VOLTS } from './primer'

const closed = (r: SolveResult) => r.components.S1?.status === 'ok'

const lesson: Lesson = {
  id: 'series-parallel',
  day: 5,
  phase: 1,
  title: 'Series and parallel resistors',
  tagline: 'One path or many: how resistors combine, and where the current goes.',
  minutes: 40,
  objectives: [
    'Recognise series and parallel connections in a circuit diagram',
    'Calculate the total resistance of resistors in series and in parallel',
    'Predict how current splits between parallel branches and how voltage shares between series parts',
    'State the two rules behind it: currents into a junction equal currents out, and voltages around a loop add up to the supply',
  ],
  sections: [
    {
      id: 'series',
      title: 'Series: one path, one current',
      blocks: [
        {
          type: 'text',
          text: 'Parts are in **series** when they sit one after another on a single path, with nothing branching off between them. Every bit of current must pass through all of them.',
        },
        {
          type: 'text',
          text: 'So in series the **current is the same** through every part, and the **voltages add up**. The total resistance is simply the sum.',
        },
        { type: 'formula', expr: 'R total = R1 + R2 + …', caption: 'Series: resistances add. The total is always bigger than the biggest one.' },
        {
          type: 'predict',
          id: 'd5-share',
          prompt: 'In the lab, R1 and R2 are both 1 kΩ in series on 5 V, so each takes 2.5 V. You change **R2 to 2 kΩ**. Which resistor now takes the bigger share of the 5 V?',
          options: [
            { text: 'R1, because the current reaches it first.', why: 'Current doesn’t get used up along the way. The same current flows through both, so position doesn’t matter.' },
            { text: 'Neither: the current is the same, so the voltages stay equal.', why: 'Same current, yes. But V = I × R, so the resistor with more resistance gets more voltage.' },
            { text: 'R1, because the smaller resistor lets more through.', why: 'In series there is only one current. What differs is the voltage, and V = I × R gives the bigger resistor the bigger share.' },
            { text: 'R2, about 3.33 V, because the bigger resistor takes the bigger share.', correct: true, why: 'Total 3 kΩ, so I = 5 V ÷ 3 kΩ ≈ 1.67 mA. R2 takes 1.67 mA × 2 kΩ ≈ 3.33 V and R1 the remaining 1.67 V.' },
          ],
          tryIt: 'Set **Resistor R2** to **2 kΩ** and compare **Voltage across R1** with **Voltage across R2**.',
        },
        {
          type: 'walkthrough',
          title: 'R1 = 1 kΩ and R2 = 2 kΩ in series (switch S1 open)',
          steps: [
            { text: 'With **S1** open, R3 is cut off. Only R1 and R2 are in the loop, one after the other.', highlight: ['S1', 'R1', 'R2'] },
            { text: 'Add the resistances.', math: 'R total = 1 kΩ + 2 kΩ = 3 kΩ', highlight: ['R1', 'R2'] },
            { text: 'Ohm’s law on the whole loop gives the current.', math: 'I = 5 V ÷ 3 kΩ ≈ 1.67 mA', highlight: ['V1'] },
            { text: 'Each resistor takes its own share of the voltage: V = I × R.', math: 'V(R1) = 1.67 mA × 1 kΩ ≈ 1.67 V,  V(R2) = 1.67 mA × 2 kΩ ≈ 3.33 V', highlight: ['R1', 'R2'] },
            { text: 'Check: 1.67 V + 3.33 V = 5 V. The bigger resistor takes the bigger share. Tomorrow you’ll use exactly this to make any voltage you like.', highlight: ['R1', 'R2'] },
          ],
        },
      ],
    },
    {
      id: 'parallel',
      title: 'Parallel: many paths, one voltage',
      blocks: [
        {
          type: 'text',
          text: 'Parts are in **parallel** when both their ends connect to the same two points. Current arriving at the first point **splits**, takes every path, and joins up again.',
        },
        {
          type: 'text',
          text: 'So in parallel the **voltage is the same** across every branch, and the **currents add up**. More paths means less total resistance.',
        },
        { type: 'formula', expr: '1 ÷ R total = 1 ÷ R2 + 1 ÷ R3', caption: 'For exactly two resistors there is a shortcut: **R total = (R2 × R3) ÷ (R2 + R3)**, “product over sum”.' },
        {
          type: 'table',
          head: ['In parallel', 'Total', 'Why'],
          rows: [
            ['1 kΩ and 1 kΩ', '500 Ω', 'Two equal paths: half the resistance'],
            ['1 kΩ and 2 kΩ', '667 Ω', '(1000 × 2000) ÷ 3000'],
            ['1 kΩ and 10 kΩ', '909 Ω', 'Mostly set by the smaller one'],
          ],
        },
        {
          type: 'text',
          text: 'The total is always **smaller than the smallest** branch. Each extra path lets more current through, never less.',
        },
        {
          type: 'predict',
          id: 'd5-close-s1',
          prompt: 'All three resistors are 1 kΩ and S1 is open: 5 V ÷ 2 kΩ = 2.5 mA flows. You **close S1**, putting R3 alongside R2. What does the total current do?',
          options: [
            { text: 'It drops, because there is now an extra resistor in the circuit.', why: 'An extra resistor in *parallel* adds a path, which lowers the total resistance. Only a resistor in series would reduce the current.' },
            { text: 'It rises to about 3.3 mA: R2 and R3 together act like 500 Ω, so the total is 1.5 kΩ.', correct: true, why: 'R2 ∥ R3 = 500 Ω, in series with R1’s 1 kΩ makes 1.5 kΩ. 5 V ÷ 1.5 kΩ ≈ 3.33 mA.' },
            { text: 'It doubles to 5 mA, because there are now two paths.', why: 'Only the bottom half got a second path. All the current still has to pass through R1, so the total resistance falls from 2 kΩ to 1.5 kΩ, not to half.' },
            { text: 'It stays at 2.5 mA, because the supply is still 5 V.', why: 'Same voltage, but less total resistance, so more current flows.' },
          ],
          tryIt: 'Set **Switch S1** to **Closed** and read **Total current**, then **Current through R2** and **Current through R3**.',
        },
        {
          type: 'callout',
          tone: 'info',
          title: 'Analogy: lanes on a road',
          text: 'Opening a second lane lets more cars through. Where it breaks: cars choose lanes, but current doesn’t choose. It splits by the numbers, with more current down the lower-resistance path.',
        },
      ],
    },
    {
      id: 'combined',
      title: 'Series and parallel together',
      blocks: [
        {
          type: 'text',
          text: 'Real circuits mix both. The trick is to shrink the circuit one piece at a time: replace a parallel pair by its total, then add the series parts.',
        },
        {
          type: 'walkthrough',
          title: 'All three resistors at 1 kΩ, switch S1 closed',
          steps: [
            { text: 'Closing **S1** connects R3 alongside R2. Both run from point **M** to GND, so they are in parallel.', highlight: ['S1', 'R2', 'R3'] },
            { text: 'Combine the parallel pair.', math: 'R2 ∥ R3 = (1 kΩ × 1 kΩ) ÷ 2 kΩ = 500 Ω', highlight: ['R2', 'R3'] },
            { text: 'That 500 Ω is in series with R1.', math: 'R total = 1 kΩ + 500 Ω = 1.5 kΩ', highlight: ['R1'] },
            { text: 'Total current from the supply.', math: 'I = 5 V ÷ 1.5 kΩ ≈ 3.33 mA', highlight: ['V1'] },
            { text: 'All of it passes through R1, so R1 takes 3.33 mA × 1 kΩ ≈ 3.33 V. Point M sits at 5 − 3.33 ≈ 1.67 V.', math: 'V(M) ≈ 1.67 V', highlight: ['R1'] },
            { text: 'R2 and R3 each have 1.67 V across them, so each carries 1.67 V ÷ 1 kΩ ≈ 1.67 mA. Together: 3.33 mA, exactly what went in.', math: '1.67 mA + 1.67 mA = 3.33 mA', highlight: ['R2', 'R3'] },
          ],
        },
      ],
    },
    {
      id: 'two-rules',
      title: 'The two rules you just used',
      blocks: [
        {
          type: 'text',
          text: '**Rule 1 (current):** the current flowing into a junction equals the current flowing out. Charge doesn’t pile up or vanish. Engineers call this *Kirchhoff’s current law*.',
        },
        {
          type: 'text',
          text: '**Rule 2 (voltage):** going once around any loop, the voltages across the parts add up to the supply voltage. Engineers call this *Kirchhoff’s voltage law*.',
        },
        {
          type: 'callout',
          tone: 'tip',
          title: 'Check your answers with them',
          text: 'After any calculation, check that the branch currents add up to the total and that the voltages around the loop add up to the supply. If they don’t, a step is wrong.',
        },
      ],
    },
  ],
  lab: {
    title: 'Series and parallel',
    intro: 'R1 and R2 are in series. Close switch **S1** to add R3 in parallel with R2. Predict the total current before every change, then check the meters.',
    circuit: {
      ground: 'gnd',
      components: [
        { kind: 'vsource', id: 'V1', pos: 'top', neg: 'gnd', volts: 5 },
        { kind: 'resistor', id: 'R1', a: 'top', b: 'm', ohms: 1000 },
        { kind: 'resistor', id: 'R2', a: 'm', b: 'gnd', ohms: 1000 },
        { kind: 'switch', id: 'S1', a: 'm', b: 'n', closed: false },
        { kind: 'resistor', id: 'R3', a: 'n', b: 'gnd', ohms: 1000 },
      ],
    },
    layout: {
      width: 14,
      height: 9,
      parts: [
        { id: 'V1', from: { x: 1, y: 3 }, to: { x: 1, y: 6 }, label: 'V1', labelSide: 'left' },
        { id: 'R1', from: { x: 3, y: 1 }, to: { x: 6, y: 1 }, label: 'R1', labelSide: 'above' },
        { id: 'R2', from: { x: 8, y: 3 }, to: { x: 8, y: 6 }, label: 'R2', labelSide: 'left' },
        { id: 'S1', from: { x: 10, y: 1 }, to: { x: 13, y: 1 }, label: 'S1', labelSide: 'above' },
        { id: 'R3', from: { x: 13, y: 3 }, to: { x: 13, y: 6 }, label: 'R3', labelSide: 'left' },
      ],
      wires: [
        { id: 'w-v1-r1', points: [{ x: 1, y: 3 }, { x: 1, y: 1 }, { x: 3, y: 1 }], carries: { componentId: 'R1', sign: 1 } },
        { id: 'w-r1-m', points: [{ x: 6, y: 1 }, { x: 8, y: 1 }], carries: { componentId: 'R1', sign: 1 } },
        { id: 'w-m-r2', points: [{ x: 8, y: 1 }, { x: 8, y: 3 }], carries: { componentId: 'R2', sign: 1 } },
        { id: 'w-m-s1', points: [{ x: 8, y: 1 }, { x: 10, y: 1 }], carries: { componentId: 'S1', sign: 1 } },
        { id: 'w-s1-r3', points: [{ x: 13, y: 1 }, { x: 13, y: 3 }], carries: { componentId: 'R3', sign: 1 } },
        { id: 'w-r3-gnd', points: [{ x: 13, y: 6 }, { x: 13, y: 8 }, { x: 8, y: 8 }], carries: { componentId: 'R3', sign: 1 } },
        { id: 'w-r2-gnd', points: [{ x: 8, y: 6 }, { x: 8, y: 8 }], carries: { componentId: 'R2', sign: 1 } },
        { id: 'w-gnd-v1', points: [{ x: 8, y: 8 }, { x: 1, y: 8 }, { x: 1, y: 6 }], carries: { componentId: 'R1', sign: 1 } },
      ],
      probes: [{ node: 'm', at: { x: 8, y: 2 }, label: 'M' }],
    },
    controls: [
      ...(['R1', 'R2', 'R3'] as const).map((id) => ({
        type: 'choice' as const,
        id: id.toLowerCase(),
        label: `Resistor ${id}`,
        componentId: id,
        prop: 'ohms',
        options: [
          { label: '220 Ω', value: 220 },
          { label: '330 Ω', value: 330 },
          { label: '1 kΩ', value: 1000 },
          { label: '2 kΩ', value: 2000 },
          { label: '5.1 kΩ', value: 5100 },
          { label: '10 kΩ', value: 10000 },
        ],
      })),
      { type: 'toggle', id: 's1', label: 'Switch S1', componentId: 'S1', prop: 'closed', onLabel: 'Closed (R3 in parallel)', offLabel: 'Open (R3 cut off)' },
    ],
    clickControls: { R1: 'r1', R2: 'r2', R3: 'r3', S1: 's1' },
    readouts: [
      { componentId: 'V1', quantity: 'current', label: 'Total current' },
      { componentId: 'R1', quantity: 'voltage', label: 'Voltage across R1' },
      { componentId: 'R2', quantity: 'voltage', label: 'Voltage across R2' },
      { componentId: 'R2', quantity: 'current', label: 'Current through R2' },
      { componentId: 'R3', quantity: 'current', label: 'Current through R3' },
    ],
    challenges: [
      {
        id: 'series-3k',
        prompt: 'With S1 **open**, make the total resistance **3 kΩ**. The total current should read about 1.67 mA.',
        hint: 'In series, resistances add. Which two kit values add up to 3 kΩ?',
        success: '1 kΩ + 2 kΩ = 3 kΩ, and 5 V ÷ 3 kΩ ≈ 1.67 mA. Notice the 2 kΩ resistor takes twice the voltage of the 1 kΩ: the bigger resistor gets the bigger share.',
        check: (r) => !closed(r) && between(r.components.V1?.current, 1.6 * mA, 1.75 * mA),
      },
      {
        id: 'equal-split',
        prompt: 'Close **S1** and make the current split **equally** between R2 and R3.',
        hint: 'R2 and R3 have the same voltage across them. When do they carry the same current?',
        success: 'Equal resistors in parallel share the current equally. Change one of them and watch the lower resistance take the bigger share.',
        check: (r) => {
          const i2 = r.components.R2?.current ?? 0
          const i3 = r.components.R3?.current ?? 0
          return closed(r) && i2 > 0.1 * mA && Math.abs(i2 - i3) < 0.02 * i2
        },
      },
      {
        id: 'parallel-500',
        prompt: 'Close **S1** and make R2 and R3 together act like a single **500 Ω** resistor.',
        hint: 'Two equal resistors in parallel give half of one. The combined value is the voltage at M divided by the current through R1.',
        success: '1 kΩ ∥ 1 kΩ = 500 Ω. Two equal paths, half the resistance. The total current went up even though you *added* a resistor.',
        check: (r) => {
          const iTotal = (r.components.R2?.current ?? 0) + (r.components.R3?.current ?? 0)
          return closed(r) && iTotal > 0 && between((r.nodeVoltages.m ?? 0) / iTotal, 490, 510)
        },
      },
    ],
  },
  quiz: [
    {
      id: 'series-sum',
      type: 'numeric',
      prompt: 'A 220 Ω and a 330 Ω resistor are in series. What is the total resistance, in ohms?',
      answer: 550,
      tolerance: 0.02,
      unit: 'Ω',
      hint: 'In series, resistances simply add.',
      explanation: '220 Ω + 330 Ω = **550 Ω**.',
    },
    {
      id: 'parallel-equal',
      type: 'numeric',
      prompt: 'Two 1 kΩ resistors are in parallel. What is the total resistance, in ohms?',
      answer: 500,
      tolerance: 0.02,
      unit: 'Ω',
      hint: 'Product over sum: (R1 × R2) ÷ (R1 + R2).',
      explanation: '(1000 × 1000) ÷ (1000 + 1000) = **500 Ω**. Two equal resistors in parallel always give half of one.',
    },
    {
      id: 'parallel-unequal',
      type: 'numeric',
      prompt: 'A 1 kΩ and a 2 kΩ resistor are in parallel. What is the total resistance, in ohms?',
      answer: 666.7,
      tolerance: 0.02,
      unit: 'Ω',
      hint: 'Product over sum. The answer must be smaller than 1 kΩ.',
      explanation: '(1000 × 2000) ÷ (1000 + 2000) = 2 000 000 ÷ 3000 ≈ **667 Ω**. Smaller than the smallest branch, as it must be.',
    },
    {
      id: 'series-same',
      type: 'choice',
      prompt: 'Two different resistors are in series. What is the same for both of them?',
      options: [
        { text: 'The voltage across them.', why: 'Only if they are equal. In series the voltage is shared in proportion to resistance: the bigger resistor takes more.' },
        { text: 'The power they turn into heat.', why: 'Power is current × voltage. The current is the same, but the voltages differ, so the powers differ.' },
        { text: 'The current through them.', correct: true, why: 'There is only one path, so every bit of charge goes through both.' },
        { text: 'Nothing; everything is different.', why: 'The current is the same: a single path means a single current.' },
      ],
    },
    {
      id: 'add-branch',
      type: 'choice',
      prompt: 'A 1 kΩ resistor is connected to 5 V. You add a second 1 kΩ in parallel with it. What happens to the current from the supply?',
      options: [
        { text: 'It halves, because there is more resistance in the circuit.', why: 'Adding a resistor in *parallel* adds a path, which lowers the total resistance. (Adding one in *series* would halve the current.)' },
        { text: 'It doubles, because the new path carries as much current again.', correct: true, why: 'Each 1 kΩ carries 5 mA, so the supply now gives 10 mA. Total resistance halved to 500 Ω.' },
        { text: 'It stays the same, because the supply is still 5 V.', why: 'The supply voltage is the same, but now there are two paths for current, so more flows in total.' },
        { text: 'Nothing flows, because the current can’t decide which path to take.', why: 'Current takes every available path at once, split by resistance.' },
      ],
    },
    {
      id: 'lab-r2-current',
      type: 'numeric',
      prompt: 'In the lab, all three resistors are 1 kΩ and S1 is closed, on 5 V. How much current flows through R2, in mA?',
      answer: 1.667,
      tolerance: 0.03,
      unit: 'mA',
      hint: 'R2 ∥ R3 = 500 Ω. Add R1 to get the total, find the total current, then split it between R2 and R3.',
      explanation: 'Total resistance = 1 kΩ + 500 Ω = 1.5 kΩ. Total current = 5 V ÷ 1.5 kΩ ≈ 3.33 mA. R2 and R3 are equal, so each gets half: **≈ 1.67 mA**.',
    },
  ],
  realBuild: {
    parts: [
      'Elegoo Uno and USB cable',
      'Breadboard and jumper wires',
      'Resistors: two 1 kΩ and one 2 kΩ',
      'Digital multimeter (needed today)',
    ],
    steps: [
      BREADBOARD,
      METER_NEEDED,
      METER_OHMS,
      METER_VOLTS,
      'With nothing powered, put a 1 kΩ and a 2 kΩ resistor in series on the breadboard (end to end, sharing one row).',
      'Set the multimeter to resistance (Ω) and measure across both: expect about 3 kΩ.',
      'Now put the two 1 kΩ resistors in parallel (both ends sharing the same two rows). Measure across them: expect about 500 Ω.',
      'Build the lab circuit: Uno 5V → 1 kΩ (R1) → a row we’ll call M → 1 kΩ (R2) → GND. Plug in USB.',
      'Set the meter to DC volts. Black probe on GND, red probe on M: expect about 2.5 V.',
      'Add the second 1 kΩ (R3) from M to GND. Measure M again: it drops to about 1.67 V, just like the lab.',
    ],
    safety: [
      'Measure resistance only with the power off; the meter’s ohms mode can give nonsense or be damaged on a live circuit.',
      'Don’t connect 5V straight to GND with a jumper while rearranging parts.',
    ],
  },
}

export default lesson
