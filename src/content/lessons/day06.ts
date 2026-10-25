import type { Lesson } from '../types'
import { between, part } from './checks'
import { BREADBOARD, METER_NEEDED, METER_VOLTS, UNO_POWER, UNO_POWER_STEP } from './primer'

const kitValues = [
  { label: '220 Ω', value: 220 },
  { label: '330 Ω', value: 330 },
  { label: '1 kΩ', value: 1000 },
  { label: '2 kΩ', value: 2000 },
  { label: '5.1 kΩ', value: 5100 },
  { label: '10 kΩ', value: 10000 },
]

const lesson: Lesson = {
  id: 'voltage-divider',
  day: 6,
  phase: 1,
  title: 'Voltage dividers',
  tagline: 'Two resistors turn one voltage into any smaller voltage you need. It’s the most-used circuit in electronics.',
  minutes: 40,
  objectives: [
    'Explain how two resistors in series split a voltage in proportion to their values',
    'Calculate a divider’s output with Vout = Vin × R2 ÷ (R1 + R2)',
    'Choose kit resistors to make a target voltage, such as 3.3 V from 5 V',
    'Explain why connecting a load drags the output down, and how to keep a divider “stiff”',
  ],
  sections: [
    {
      id: 'split',
      title: 'Two resistors split a voltage',
      blocks: [
        {
          type: 'text',
          text: 'On Day 5 you saw that two resistors in series share the supply voltage, and the bigger one takes the bigger share. A **voltage divider** uses that on purpose. Take the voltage from the point between them, and you get a fraction of the supply.',
        },
        {
          type: 'formula',
          expr: 'Vout = Vin × R2 ÷ (R1 + R2)',
          caption: '**R1** is the top resistor (to the supply), **R2** the bottom one (to GND). **Vout** is measured from the middle point to GND.',
        },
        {
          type: 'predict',
          id: 'd6-start',
          prompt: 'Set **R1 = 10 kΩ** on top and **R2 = 1 kΩ** on the bottom (where the lab starts), on 5 V. What does Vout read?',
          options: [
            { text: 'About 4.5 V, because the bigger resistor wins.', why: 'The bigger resistor takes the bigger share, and it is on *top*. Vout is the share across the *bottom* resistor, which is the small one.' },
            { text: 'About 0.45 V: R2 is only 1 kΩ of the 11 kΩ total, so it gets 1/11 of 5 V.', correct: true, why: 'Vout = 5 V × 1 kΩ ÷ 11 kΩ ≈ 0.45 V. The output is the bottom resistor’s fraction of the total.' },
            { text: '2.5 V, because a divider always gives half.', why: 'Only equal resistors give half. Here the ratio is 1 to 10.' },
            { text: 'About 0.5 V: 1 kΩ ÷ 10 kΩ × 5 V.', why: 'Close, but the fraction is R2 ÷ (R1 + R2) = 1 ÷ 11, not R2 ÷ R1 = 1 ÷ 10.' },
          ],
          tryIt: 'Read **Vout (across R2)** in the lab. Then set **R1 (top)** to **1 kΩ** and watch Vout jump to 2.5 V.',
        },
        {
          type: 'text',
          text: 'Why it works: the same current flows through both, I = Vin ÷ (R1 + R2). The voltage across R2 is I × R2. Put those together and you get the formula.',
        },
        {
          type: 'walkthrough',
          title: 'Equal resistors give half',
          steps: [
            { text: 'Say R1 and R2 are both 1 kΩ, on 5 V.', highlight: ['V1'] },
            { text: 'The current through both is the same.', math: 'I = 5 V ÷ 2 kΩ = 2.5 mA', highlight: ['R1', 'R2'] },
            { text: 'The bottom resistor’s voltage is the output.', math: 'Vout = 2.5 mA × 1 kΩ = 2.5 V', highlight: ['R2'] },
            { text: 'Equal resistors split the supply in half. The probe at the midpoint shows the output.', highlight: ['R1', 'R2'] },
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          title: 'Where you’ll meet dividers',
          text: 'Reading a light sensor (Day 21), reading a knob (a potentiometer is a divider with a slider, Day 20), and turning 5 V signals into 3.3 V for an ESP32 (Day 72). They are everywhere.',
        },
      ],
    },
    {
      id: 'design',
      title: 'Designing for a target voltage',
      blocks: [
        {
          type: 'text',
          text: 'Only the **ratio** of R1 to R2 matters for the output, not their size. 1 kΩ / 1 kΩ and 10 kΩ / 10 kΩ both give half. That means you can hunt for a pair in your kit with the right ratio.',
        },
        {
          type: 'walkthrough',
          title: 'Make 3.3 V from the Uno’s 5 V',
          steps: [
            { text: 'You want Vout ÷ Vin = 3.3 ÷ 5 = 0.66. So R2 must be about two-thirds of the total.', math: 'R2 ÷ (R1 + R2) = 0.66', highlight: ['R1', 'R2'] },
            { text: 'That means R2 is roughly **twice** R1. Try R1 = 1 kΩ and R2 = 2 kΩ.', highlight: ['R1', 'R2'] },
            { text: 'Check with the formula.', math: 'Vout = 5 V × 2 kΩ ÷ 3 kΩ ≈ 3.33 V', highlight: ['R2'] },
            { text: 'That is about 1 % above 3.3 V, close enough for most uses. Another kit pair works too: R1 = 5.1 kΩ, R2 = 10 kΩ.', math: 'Vout = 5 V × 10 ÷ 15.1 ≈ 3.31 V', highlight: ['R1', 'R2'] },
          ],
        },
      ],
    },
    {
      id: 'loading',
      title: 'The catch: loading',
      blocks: [
        {
          type: 'text',
          text: 'Whatever you connect to the output (a sensor, a chip, a meter) is called the **load**. The load connects from the midpoint to GND, which puts it **in parallel with R2**. Parallel resistors combine to something smaller, so the output drops.',
        },
        {
          type: 'predict',
          id: 'd6-load',
          prompt: 'A **1 kΩ / 1 kΩ** divider gives 2.5 V. You connect the **10 kΩ load**, ten times bigger than R2. What does Vout do?',
          options: [
            { text: 'Nothing: 10 kΩ is so big that it makes no difference at all.', why: 'Any load takes some current, so there is always some sag. Ten times bigger keeps it small, not zero.' },
            { text: 'It rises, because the load adds resistance.', why: 'The load sits in parallel with R2, and parallel resistors combine to something *smaller*. Smaller bottom, smaller share.' },
            { text: 'It drops a little, to about 2.38 V: about 5 % low.', correct: true, why: 'R2 ∥ load = 1 kΩ ∥ 10 kΩ ≈ 909 Ω, so Vout = 5 V × 909 ÷ 1909 ≈ 2.38 V. That 5 % sag is what the 10× rule buys you.' },
            { text: 'It collapses to about 1.67 V, a third lower.', why: 'That happens when the load equals R2 (10 kΩ on a 10 kΩ / 10 kΩ divider). Here the load is ten times bigger, so the sag is much smaller.' },
          ],
          tryIt: 'Set **R1 (top)** and **R2 (bottom)** to **1 kΩ**, then set **Load (10 kΩ)** to **Connected** and read **Vout (across R2)**.',
        },
        {
          type: 'walkthrough',
          title: 'A 10 kΩ load on a 10 kΩ / 10 kΩ divider',
          steps: [
            { text: 'Unloaded, 10 kΩ over 10 kΩ gives 2.5 V.', highlight: ['R1', 'R2'] },
            { text: 'Close the load switch. The 10 kΩ load is now in parallel with R2.', math: '10 kΩ ∥ 10 kΩ = 5 kΩ', highlight: ['S1', 'RL', 'R2'] },
            { text: 'The divider is now 10 kΩ over 5 kΩ.', math: 'Vout = 5 V × 5 kΩ ÷ 15 kΩ ≈ 1.67 V', highlight: ['R1'] },
            { text: 'The output sagged from 2.5 V to 1.67 V, a third lower. The load “stole” current from the bottom half.', highlight: ['RL'] },
          ],
        },
        {
          type: 'table',
          head: ['R1 / R2', 'Load ÷ R2', 'Vout with 10 kΩ load', 'Divider current'],
          rows: [
            ['10 kΩ / 10 kΩ', '1×', '1.67 V (33 % low)', '0.25 mA'],
            ['1 kΩ / 1 kΩ', '10×', '2.38 V (about 5 % low)', '2.5 mA'],
            ['220 Ω / 220 Ω', '45×', '2.47 V (about 1 % low)', '11.4 mA'],
          ],
        },
        {
          type: 'text',
          text: 'Smaller resistors make a **stiff** divider that barely sags, but they waste more current all the time. A common rule of thumb: make the load at least **10 times** bigger than R2. At exactly 10× the output sags by about **5 %** (the 1 kΩ row); a bigger ratio sags less.',
        },
        {
          type: 'callout',
          tone: 'warn',
          title: 'Dividers are for signals, not power',
          text: 'Never power an LED, motor or board from a divider. The load drags the voltage down, and most of the energy is wasted as heat in R1. To power things at a lower voltage you need a **regulator** (Day 38).',
        },
      ],
    },
  ],
  lab: {
    title: 'Divide and probe',
    intro: 'R1 on top, R2 on the bottom. The probe **Vout** reads the midpoint. Predict the output before every change, then connect the load **RL** with switch **S1** and watch it sag.',
    circuit: {
      ground: 'gnd',
      components: [
        { kind: 'vsource', id: 'V1', pos: 'top', neg: 'gnd', volts: 5 },
        { kind: 'resistor', id: 'R1', a: 'top', b: 'mid', ohms: 10000 },
        { kind: 'resistor', id: 'R2', a: 'mid', b: 'gnd', ohms: 1000 },
        { kind: 'switch', id: 'S1', a: 'mid', b: 'load', closed: false },
        { kind: 'resistor', id: 'RL', a: 'load', b: 'gnd', ohms: 10000 },
      ],
    },
    layout: {
      // Room for the phone mini-stage (review N2, T7), where every label is about 6 × 3 units: R1 on the top
      // wire with its label inside the loop, R2's label inside the loop below it, S1's above the top wire,
      // V1's and RL's outside the edges. Vout sits on the drop to R2, clear of the top-wire labels.
      width: 20,
      height: 9,
      parts: [
        { id: 'V1', from: { x: 1, y: 3 }, to: { x: 1, y: 6 }, label: 'V1', labelSide: 'left' },
        { id: 'R1', from: { x: 3, y: 1 }, to: { x: 6, y: 1 }, label: 'R1', labelSide: 'below' },
        { id: 'R2', from: { x: 9, y: 4 }, to: { x: 9, y: 7 }, label: 'R2', labelSide: 'left' },
        { id: 'S1', from: { x: 12, y: 1 }, to: { x: 15, y: 1 }, label: 'S1 (load)', labelSide: 'above' },
        { id: 'RL', from: { x: 18, y: 3 }, to: { x: 18, y: 6 }, label: 'RL (load)', labelSide: 'right' },
      ],
      wires: [
        { id: 'w-v1-r1', points: [{ x: 1, y: 3 }, { x: 1, y: 1 }, { x: 3, y: 1 }], carries: { componentId: 'R1', sign: 1 } },
        { id: 'w-r1-mid', points: [{ x: 6, y: 1 }, { x: 9, y: 1 }], carries: { componentId: 'R1', sign: 1 } },
        { id: 'w-mid-r2', points: [{ x: 9, y: 1 }, { x: 9, y: 4 }], carries: { componentId: 'R2', sign: 1 } },
        { id: 'w-mid-s1', points: [{ x: 9, y: 1 }, { x: 12, y: 1 }], carries: { componentId: 'S1', sign: 1 } },
        { id: 'w-s1-rl', points: [{ x: 15, y: 1 }, { x: 18, y: 1 }, { x: 18, y: 3 }], carries: { componentId: 'RL', sign: 1 } },
        { id: 'w-rl-gnd', points: [{ x: 18, y: 6 }, { x: 18, y: 9 }, { x: 9, y: 9 }], carries: { componentId: 'RL', sign: 1 } },
        { id: 'w-r2-gnd', points: [{ x: 9, y: 7 }, { x: 9, y: 9 }], carries: { componentId: 'R2', sign: 1 } },
        { id: 'w-gnd-v1', points: [{ x: 9, y: 9 }, { x: 1, y: 9 }, { x: 1, y: 6 }], carries: { componentId: 'R1', sign: 1 } },
      ],
      probes: [
        { node: 'mid', at: { x: 9, y: 3 }, label: 'Vout' },
        { node: 'top', at: { x: 2, y: 1 }, label: 'Vin' },
      ],
    },
    controls: [
      { type: 'choice', id: 'r1', label: 'R1 (top)', componentId: 'R1', prop: 'ohms', options: kitValues },
      { type: 'choice', id: 'r2', label: 'R2 (bottom)', componentId: 'R2', prop: 'ohms', options: kitValues },
      { type: 'toggle', id: 'load', label: 'Load (10 kΩ)', componentId: 'S1', prop: 'closed', onLabel: 'Connected', offLabel: 'Disconnected' },
    ],
    clickControls: { R1: 'r1', R2: 'r2', S1: 'load' },
    readouts: [
      { componentId: 'R2', quantity: 'voltage', label: 'Vout (across R2)' },
      { componentId: 'R1', quantity: 'voltage', label: 'Voltage across R1' },
      { componentId: 'R1', quantity: 'current', label: 'Current from the supply (through R1)' },
      { componentId: 'RL', quantity: 'current', label: 'Load current' },
    ],
    challenges: [
      {
        id: 'half',
        prompt: 'With the load disconnected, make Vout exactly **half** the supply: 2.5 V.',
        hint: 'When do two resistors in series share the voltage equally?',
        success: 'Equal resistors, equal shares. Any equal pair works, because only the ratio matters.',
        check: (r) => r.components.S1?.status === 'off' && between(r.nodeVoltages.mid, 2.475, 2.525),
      },
      {
        id: 'three-v-three',
        prompt: 'Make **3.3 V (±3 %)** from 5 V using kit resistors, with the load disconnected.',
        hint: 'You need R2 to be about twice R1. Look for a pair in the list with that ratio.',
        success: '1 kΩ over 2 kΩ gives 3.33 V; 5.1 kΩ over 10 kΩ gives 3.31 V. This is how you safely feed a 5 V signal into a 3.3 V chip.',
        check: (r) => r.components.S1?.status === 'off' && between(r.nodeVoltages.mid, 3.3 * 0.97, 3.3 * 1.03),
      },
      {
        id: 'stiff',
        prompt: 'Connect the load and build a **stiff** divider: follow the 10× rule (the 10 kΩ load at least 10 × R2) and keep Vout within about 5 % of 2.5 V, between **2.35 and 2.65 V**.',
        hint: 'The load is 10 kΩ, so the 10× rule means R2 is 1 kΩ or less. Keep R1 equal to R2 for 2.5 V. At exactly 10× the output sags about 5 %, to 2.38 V, and that still counts.',
        success: '1 kΩ / 1 kΩ gives 2.38 V (about 5 % low, the rule’s worst case); 330 Ω / 330 Ω gives 2.46 V and 220 Ω / 220 Ω 2.47 V. Smaller resistors make a stiffer divider. The price: check **Current from the supply**, which flows all the time.',
        check: (r, c) => {
          const r2 = part(c, 'R2')
          const load = part(c, 'RL')
          return (
            r.components.S1?.status === 'ok' &&
            r2?.kind === 'resistor' &&
            load?.kind === 'resistor' &&
            r2.ohms * 10 <= load.ohms &&
            between(r.nodeVoltages.mid, 2.35, 2.65)
          )
        },
      },
    ],
  },
  quiz: [
    {
      id: 'vout-2k-1k',
      type: 'numeric',
      prompt: 'A divider on 5 V has R1 (top) = 2 kΩ and R2 (bottom) = 1 kΩ. What is Vout, in volts?',
      answer: 1.667,
      tolerance: 0.03,
      unit: 'V',
      hint: 'Vout = Vin × R2 ÷ (R1 + R2). R2 is the bottom resistor.',
      explanation: 'Vout = 5 V × 1 kΩ ÷ 3 kΩ ≈ **1.67 V**. The smaller resistor is on the bottom, so the output is the smaller share.',
    },
    {
      id: 'vout-9v-equal',
      type: 'numeric',
      prompt: 'A divider on a 9 V battery uses two 10 kΩ resistors. What is Vout, in volts?',
      answer: 4.5,
      tolerance: 0.02,
      unit: 'V',
      hint: 'Equal resistors split the supply equally.',
      explanation: '9 V × 10 kΩ ÷ 20 kΩ = **4.5 V**, half of the supply.',
    },
    {
      id: 'pick-3v3',
      type: 'choice',
      prompt: 'Your target voltage is about 3.3 V from 5 V. Which pair has the right ratio?',
      options: [
        { text: 'R1 (top) = 2 kΩ, R2 (bottom) = 1 kΩ', why: 'Upside down: 5 × 1 ÷ 3 ≈ 1.67 V. The output is the share across the **bottom** resistor.' },
        { text: 'R1 = 1 kΩ, R2 = 1 kΩ', why: 'Equal resistors give half: 2.5 V.' },
        { text: 'R1 (top) = 10 kΩ, R2 (bottom) = 1 kΩ', why: '5 × 1 ÷ 11 ≈ 0.45 V. Far too low.' },
        { text: 'R1 (top) = 1 kΩ, R2 (bottom) = 2 kΩ', correct: true, why: '5 × 2 ÷ 3 ≈ 3.33 V. R2 is twice R1, and that ratio puts two-thirds of the supply across the bottom resistor.' },
      ],
    },
    {
      id: 'why-sag',
      type: 'choice',
      prompt: 'You connect a load to a divider’s output and the voltage drops. Why?',
      options: [
        { text: 'The supply gets weaker when more current is drawn.', why: 'In the lab the supply is ideal and stays at exactly 5 V, yet the output still sags. The cause is the divider itself.' },
        { text: 'The load is in parallel with R2, which lowers the bottom resistance, so the bottom gets a smaller share.', correct: true, why: 'The divider ratio changes because the bottom half is now R2 ∥ load.' },
        { text: 'The load adds resistance in series with R1.', why: 'The load connects from the midpoint to GND, which is alongside R2 (parallel), not in line with R1.' },
        { text: 'Current is used up by the load before it reaches R2.', why: 'Current isn’t used up. Some current that used to go through R2 now goes through the load instead.' },
      ],
    },
    {
      id: 'loaded-10k',
      type: 'numeric',
      prompt: 'A 10 kΩ / 10 kΩ divider on 5 V has a 10 kΩ load connected to its output. What is Vout, in volts?',
      answer: 1.667,
      tolerance: 0.03,
      unit: 'V',
      hint: 'First combine R2 and the load in parallel, then use the divider formula.',
      explanation: 'R2 ∥ load = 10 kΩ ∥ 10 kΩ = 5 kΩ. Vout = 5 V × 5 kΩ ÷ (10 kΩ + 5 kΩ) ≈ **1.67 V**, down from 2.5 V.',
    },
    {
      id: 'divider-power-led',
      type: 'choice',
      prompt: 'Can a red LED at 15 mA be the load on the midpoint of a 10 kΩ / 10 kΩ divider on 5 V?',
      options: [
        { text: 'No. At most 5 V ÷ 10 kΩ = 0.5 mA can come through R1, far below 15 mA.', correct: true, why: 'Every bit of load current has to pass through R1, which limits it. Dividers are for signals; use a resistor in series with the LED instead.' },
        { text: 'Yes, because the midpoint is at 2.5 V, more than the LED’s 2 V.', why: 'The voltage is there only until you draw current. The LED pulls the midpoint down, and R1 lets at most 0.5 mA through.' },
        { text: 'Yes, if you add a second divider in parallel.', why: 'Two 10 kΩ tops in parallel make 5 kΩ: still only 1 mA at most. The divider resistors are far too large.' },
        { text: 'Only on a 9 V battery.', why: 'On 9 V, R1 still allows at most 9 V ÷ 10 kΩ = 0.9 mA. Still nowhere near 15 mA.' },
      ],
    },
  ],
  realBuild: {
    parts: [
      'Elegoo Uno and USB cable',
      'Breadboard and jumper wires',
      'Resistors: 1 kΩ, 2 kΩ, 5.1 kΩ and two 10 kΩ, plus a third 10 kΩ as the load',
      'Digital multimeter (needed today)',
    ],
    steps: [
      BREADBOARD,
      METER_NEEDED,
      METER_VOLTS,
      '**About the diagram:** it shows the finished circuit after step 10: 10 kΩ / 10 kΩ with the load RL and the yellow S1 jumper in place. Start with the 1 kΩ / 2 kΩ pair and leave RL and S1 out until step 10.',
      'Unplugged. ' + UNO_POWER_STEP,
      'R1 = 1 kΩ from **b4** to **b8**, and R2 = 2 kΩ from **c8** to **c12**. Column 4 is **TOP** and column 8 is **MID**. A red jumper from the top **+** rail to **a4**, and a black jumper from **a12** to the top **−** rail. Plug in USB.',
      'Meter on DC volts: black probe on the **−** rail, red on a leg in column 8 (MID). Expect about 3.33 V.',
      'Unplug, swap to R1 = 5.1 kΩ and R2 = 10 kΩ in the same holes, and plug in again: expect about 3.31 V.',
      'Unplug, make it 10 kΩ / 10 kΩ and plug in again: expect 2.5 V.',
      'Unplug and add the load: RL = 10 kΩ from **c16** to **c20**, a black jumper from **a20** to the **−** rail, and the yellow jumper **S1** (the lab’s load switch) from **e8** to **e16**. Plug in: expect about 1.67 V. Pull S1 out and MID goes back to 2.5 V.',
      'Your meter is a load too, but a very large one (about 10 MΩ), so it barely changes the reading.',
    ],
    // One entry per step: the breadboard parts that step places or talks about.
    stepParts: [
      [],
      [],
      [],
      ['RL', 'w-rl-gnd', 'S1'],
      ['w-5v', 'w-gnd'],
      ['R1', 'R2', 'w-plus', 'w-r2-gnd'],
      ['R1', 'R2'],
      ['R1', 'R2'],
      ['R1', 'R2'],
      ['RL', 'w-rl-gnd', 'S1'],
      [],
    ],
    safety: [
      'Unplug the Uno before moving resistors.',
      'Keep the red meter lead in the **V** socket, not the **A** socket. In the A socket the meter is nearly a short circuit.',
    ],
    // The drawing is the last step: 10 kΩ / 10 kΩ with the 10 kΩ load connected (S1 closed). The yellow jumper is S1.
    breadboard: {
      supply: 'uno',
      parts: [
        ...UNO_POWER,
        { kind: 'wire', id: 'w-plus', from: 'T+4', to: 'a4', color: 'red' },
        { kind: 'resistor', id: 'R1', from: 'b4', to: 'b8', ohms: 10000 },
        { kind: 'resistor', id: 'R2', from: 'c8', to: 'c12', ohms: 10000 },
        { kind: 'wire', id: 'w-r2-gnd', from: 'a12', to: 'T-12', color: 'black' },
        { kind: 'wire', id: 'S1', from: 'e8', to: 'e16', color: 'yellow' },
        { kind: 'resistor', id: 'RL', from: 'c16', to: 'c20', ohms: 10000 },
        { kind: 'wire', id: 'w-rl-gnd', from: 'a20', to: 'T-20', color: 'black' },
      ],
    },
  },
}

export default lesson
