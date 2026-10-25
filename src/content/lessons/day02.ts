import type { Lesson } from '../types'
import { between, mA } from './checks'
import { BREADBOARD, LED_WAY, NO_METER, UNO_POWER, UNO_POWER_STEP } from './primer'

const lesson: Lesson = {
  id: 'ohms-law',
  day: 2,
  phase: 1,
  title: 'Ohm’s law in practice: picking resistors and reading colour codes',
  tagline: 'Work out the right resistor for any LED on any supply, then find it in your kit by its stripes.',
  minutes: 40,
  objectives: [
    'Use Ohm’s law in all three forms: V = I × R, I = V ÷ R, R = V ÷ I',
    'Calculate the resistor an LED needs for a target current on 5 V and 9 V supplies',
    'Round a calculated value to a real kit value, in the safe direction',
    'Read 4-band and 5-band resistor colour codes',
  ],
  sections: [
    {
      id: 'three-forms',
      title: 'One law, three questions',
      blocks: [
        {
          type: 'text',
          text: 'Yesterday you met **Ohm’s law**. It answers three different questions, depending on which two numbers you already know.',
        },
        {
          type: 'table',
          head: ['You know', 'You want', 'Use'],
          rows: [
            ['Current and resistance', 'Voltage', '`V = I × R`'],
            ['Voltage and resistance', 'Current', '`I = V ÷ R`'],
            ['Voltage and current', 'Resistance', '`R = V ÷ I`'],
          ],
        },
        {
          type: 'text',
          text: 'Always put numbers in **base units** (volts, amps, ohms) before you divide. 10 mA is 0.010 A; 2 kΩ is 2000 Ω. Mixing them is the most common slip.',
        },
        {
          type: 'callout',
          tone: 'info',
          title: 'Ohm’s law is for resistors',
          text: 'V = I × R describes a resistor exactly. An LED doesn’t obey it: its voltage stays near Vf whatever the current. That’s why you apply Ohm’s law to the **resistor**, using the voltage the LED leaves over.',
        },
        {
          type: 'predict',
          id: 'd2-low-supply',
          prompt: 'Set the supply to 5 V and R1 to 1 kΩ (where the lab starts). You slide the supply down to **1.5 V**. Ohm’s law on the resistor alone would say 1.5 V ÷ 1 kΩ = 1.5 mA. What does the meter show?',
          options: [
            { text: 'About 1.5 mA, exactly as Ohm’s law says.', why: 'That treats the LED as if it weren’t there. The LED needs about its forward voltage before it conducts, and 1.5 V is not enough.' },
            { text: 'About 0.45 mA, because the current scales with the supply: 1.5 ÷ 5 of 1.5 mA.', why: 'That would be true for resistors alone. The LED isn’t a resistor: below its forward voltage it is essentially off.' },
            { text: 'More than at 5 V, because the resistor has less to do.', why: 'Less push never means more current. Lowering the supply can only reduce it.' },
            { text: 'Practically nothing. 1.5 V is below the red LED’s forward voltage, so it barely conducts.', correct: true, why: 'A red LED needs roughly 1.7–2 V before real current flows. Below that the meter reads almost zero, even though the supply is on. Ohm’s law applies to the resistor, not to the LED.' },
          ],
          tryIt: 'Slide **Supply voltage** down to **1.5 V** and read **Current through R1** and **Voltage across the LED**.',
        },
      ],
    },
    {
      id: 'pick-resistor',
      title: 'Picking a resistor for an LED',
      blocks: [
        { type: 'text', text: 'Here is the recipe. It works for any LED on any supply.' },
        {
          type: 'formula',
          expr: 'R = (V supply − Vf) ÷ I target',
          caption: 'Supply voltage minus the LED’s forward voltage, divided by the current you want (in amps).',
        },
        {
          type: 'walkthrough',
          title: 'A red LED at 10 mA from the Uno’s 5 V',
          steps: [
            { text: 'The supply is 5 V.', highlight: ['V1'] },
            { text: 'A red LED takes about 2 V.', highlight: ['D1'] },
            { text: 'That leaves 3 V for the resistor.', math: '5 V − 2 V = 3 V', highlight: ['R1'] },
            { text: 'Divide by the current you want, in amps.', math: 'R = 3 V ÷ 0.010 A = 300 Ω', highlight: ['R1'] },
            { text: 'Your kit has 220 Ω and 330 Ω, not 300 Ω. Round **up** to 330 Ω: slightly less current is always safe.', math: 'I = 3 V ÷ 330 Ω ≈ 9.1 mA', highlight: ['R1', 'D1'] },
            { text: 'In the lab, the realistic LED model shows about **9.3 mA**. Close to the hand calculation, as it should be.', highlight: ['D1'] },
          ],
        },
        {
          type: 'predict',
          id: 'd2-nine-volt',
          prompt: '330 Ω gives the red LED about 9 mA on 5 V. You keep **330 Ω** and switch to a **9 V** battery. What happens?',
          options: [
            { text: 'Still about 9 mA: the resistor hasn’t changed.', why: 'The resistor is the same, but the voltage across it isn’t. It now takes 9 − 2 = 7 V instead of 3 V, so more current flows.' },
            { text: 'About 16 mA: 9 V is 1.8 times 5 V, so the current goes up 1.8 times.', why: 'Close in spirit, but the LED keeps its 2 V either way. The resistor’s share grows from 3 V to 7 V, which is 2.3 times, not 1.8.' },
            { text: 'About 21 mA: the resistor now takes 7 V, and 7 V ÷ 330 Ω is over the LED’s 20 mA rating.', correct: true, why: 'The LED still takes about 2 V, so the resistor’s share jumps from 3 V to 7 V. 7 V ÷ 330 Ω ≈ 21 mA, just past the 20 mA the simulator allows before it warns.' },
            { text: 'The LED goes out, because 9 V is too much for it.', why: 'Too much voltage on the *loop* doesn’t switch the LED off; it pushes more current through it.' },
          ],
          tryIt: 'Set **Resistor R1** to **330 Ω**, slide **Supply voltage** to **9 V**, and read **Current through R1**. The LED gets a warning tag over 20 mA.',
        },
        {
          type: 'walkthrough',
          title: 'The same LED on a 9 V battery',
          steps: [
            { text: 'Now the supply is 9 V.', highlight: ['V1'] },
            { text: 'The resistor has to take 9 − 2 = 7 V.', math: 'R = 7 V ÷ 0.010 A = 700 Ω', highlight: ['R1'] },
            { text: 'Round up to the next kit value, **1 kΩ**.', math: 'I = 7 V ÷ 1000 Ω = 7 mA', highlight: ['R1', 'D1'] },
            { text: 'Keep 330 Ω on 9 V and you get 7 V ÷ 330 Ω ≈ 21 mA: over the 20 mA comfort limit. A bigger supply needs a bigger resistor.', highlight: ['R1'] },
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: 'Why round up?',
          text: 'More resistance means less current. A little dimmer is fine; a little too much current shortens the LED’s life. When in doubt, round up.',
        },
      ],
    },
    {
      id: 'colour-code',
      title: 'Reading the colour code',
      blocks: [
        {
          type: 'text',
          text: 'Resistors are too small to print numbers on, so their value is painted on as coloured **bands**. Each colour is a digit.',
        },
        {
          type: 'table',
          head: ['Colour', 'Digit', 'As a multiplier'],
          rows: [
            ['Black', '0', '× 1'],
            ['Brown', '1', '× 10'],
            ['Red', '2', '× 100'],
            ['Orange', '3', '× 1 000'],
            ['Yellow', '4', '× 10 000'],
            ['Green', '5', '× 100 000'],
            ['Blue', '6', '× 1 000 000'],
            ['Violet', '7', ''],
            ['Grey', '8', ''],
            ['White', '9', ''],
          ],
        },
        {
          type: 'text',
          text: 'On a **4-band** resistor: the first two bands are digits, the third is the multiplier (how many zeros to add), and the last band, usually gold, is the **tolerance** (how far the real value may be from the label: gold means ±5 %). Hold it with the gold band on the right and read from the left.',
        },
        {
          type: 'text',
          text: 'Example: **red, red, brown, gold** = 2, 2, × 10 = **220 Ω**, ±5 %.',
        },
        {
          type: 'text',
          text: 'The resistors in the Elegoo kit are **5-band**: three digits, then the multiplier, then a brown tolerance band (±1 %).',
        },
        {
          type: 'table',
          head: ['Value', '4-band', '5-band (Elegoo kit)'],
          rows: [
            ['220 Ω', 'red red brown', 'red red black black'],
            ['330 Ω', 'orange orange brown', 'orange orange black black'],
            ['1 kΩ', 'brown black red', 'brown black black brown'],
            ['10 kΩ', 'brown black orange', 'brown black black red'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: 'Not sure? Use the bag or a meter',
          text: 'Colours are hard to tell apart under yellow light. Keep resistors in their labelled bags, and if you have a multimeter, set it to Ω and measure them with the power off.',
        },
      ],
    },
  ],
  lab: {
    title: 'Pick the resistor',
    intro: 'Change the supply voltage and the resistor and watch the meters. Predict each reading first. The voltage across R1 divided by its resistance always equals the current: Ohm’s law, live.',
    circuit: {
      ground: 'gnd',
      components: [
        { kind: 'vsource', id: 'V1', pos: 'vcc', neg: 'gnd', volts: 5 },
        { kind: 'resistor', id: 'R1', a: 'vcc', b: 'a', ohms: 1000 },
        { kind: 'led', id: 'D1', anode: 'a', cathode: 'gnd', color: 'red' },
      ],
    },
    layout: {
      width: 14,
      height: 9,
      parts: [
        { id: 'V1', from: { x: 2, y: 3 }, to: { x: 2, y: 6 }, label: 'V1', labelSide: 'left' },
        { id: 'R1', from: { x: 5, y: 1 }, to: { x: 8, y: 1 }, label: 'R1', labelSide: 'above' },
        { id: 'D1', from: { x: 11, y: 3 }, to: { x: 11, y: 6 }, label: 'D1 (LED)', labelSide: 'right' },
      ],
      wires: [
        { id: 'w-v1-r1', points: [{ x: 2, y: 3 }, { x: 2, y: 1 }, { x: 5, y: 1 }], carries: { componentId: 'R1', sign: 1 } },
        { id: 'w-r1-d1', points: [{ x: 8, y: 1 }, { x: 11, y: 1 }, { x: 11, y: 3 }], carries: { componentId: 'R1', sign: 1 } },
        { id: 'w-d1-gnd', points: [{ x: 11, y: 6 }, { x: 11, y: 8 }, { x: 2, y: 8 }, { x: 2, y: 6 }], carries: { componentId: 'R1', sign: 1 } },
      ],
      probes: [{ node: 'a', at: { x: 11, y: 2 }, label: 'LED +' }],
    },
    controls: [
      { type: 'slider', id: 'supply', label: 'Supply voltage', componentId: 'V1', prop: 'volts', min: 0, max: 9, step: 0.5, unit: 'V' },
      {
        type: 'choice',
        id: 'resistor',
        label: 'Resistor R1',
        componentId: 'R1',
        prop: 'ohms',
        options: [
          { label: '220 Ω', value: 220 },
          { label: '330 Ω', value: 330 },
          { label: '1 kΩ', value: 1000 },
          { label: '2 kΩ', value: 2000 },
          { label: '5.1 kΩ', value: 5100 },
          { label: '10 kΩ', value: 10000 },
        ],
      },
    ],
    clickControls: { R1: 'resistor' },
    readouts: [
      { componentId: 'V1', quantity: 'voltage', label: 'Supply' },
      { componentId: 'R1', quantity: 'voltage', label: 'Voltage across R1' },
      { componentId: 'R1', quantity: 'current', label: 'Current through R1' },
      { componentId: 'D1', quantity: 'voltage', label: 'Voltage across the LED' },
    ],
    challenges: [
      {
        id: 'ten-ma',
        prompt: 'On the Uno’s **5 V**, pick the kit resistor that gives the LED **close to 10 mA** (8.5–11 mA).',
        hint: 'You calculated 300 Ω. Which kit value is nearest, rounding up?',
        success: '330 Ω gives about 9.3 mA. Your calculation said 9.1 mA: close, because the real LED takes a little less than 2 V at this current.',
        check: (r) => between(r.components.V1?.voltage, 4.99, 5.01) && between(r.components.D1?.current, 8.5 * mA, 11 * mA),
      },
      {
        id: 'nine-volt',
        prompt: 'Swap to a **9 V** battery. Keep the LED in the safe zone: **5–20 mA**.',
        hint: 'Slide the supply to 9 V. The resistor now has to take about 7 V. What does 330 Ω give? Then go one size up.',
        success: '1 kΩ gives about 7 mA. With 330 Ω the LED would get about 21 mA, just over its 20 mA rating, and the simulator warns. Same LED, bigger supply, bigger resistor.',
        check: (r) => between(r.components.V1?.voltage, 8.99, 9.01) && r.components.D1?.status === 'ok' && between(r.components.D1.current, 5 * mA, 20 * mA),
      },
      {
        id: 'below-vf',
        prompt: 'Turn the supply **down** until the LED goes dark, while the supply still gives at least 1 V.',
        hint: 'Watch the current as you slide the supply below about 2 V.',
        success: 'Below about 1.7 V the LED barely conducts at all, so the current drops to almost nothing even though the supply is still on. An LED needs its forward voltage before it lights. Ohm’s law alone would have predicted some current; the LED is not a resistor.',
        check: (r) => (r.components.V1?.voltage ?? 0) >= 1 && r.components.D1?.status === 'off',
      },
    ],
  },
  quiz: [
    {
      id: 'r-for-15ma',
      type: 'numeric',
      prompt: 'What resistor gives a red LED (Vf = 2 V) a current of 15 mA from a 5 V supply? Answer in ohms.',
      answer: 200,
      tolerance: 0.05,
      unit: 'Ω',
      hint: 'R = (V supply − Vf) ÷ I, with I in amps (15 mA = 0.015 A).',
      explanation: 'The resistor takes 5 − 2 = 3 V. R = 3 V ÷ 0.015 A = **200 Ω**. The nearest kit value rounding up is 220 Ω.',
    },
    {
      id: 'current-9v-1k',
      type: 'numeric',
      prompt: 'A red LED (Vf = 2 V) runs from a 9 V battery through a 1 kΩ resistor. What current flows, in mA?',
      answer: 7,
      tolerance: 0.05,
      unit: 'mA',
      hint: 'Find the voltage left for the resistor, then I = V ÷ R.',
      explanation: 'The resistor takes 9 − 2 = 7 V. I = 7 V ÷ 1000 Ω = 0.007 A = **7 mA**.',
    },
    {
      id: 'round-direction',
      type: 'choice',
      prompt: 'Your calculation says 300 Ω. Your kit has 220 Ω and 330 Ω. Which should you use?',
      options: [
        { text: '220 Ω, because it’s the most common LED resistor.', why: 'It would give about 14 mA, which happens to be fine here. But rounding down means *more* current than you planned. Make rounding up your habit; it matters when the margin is small.' },
        { text: '330 Ω, because rounding up gives slightly less current, which is always safe.', correct: true, why: '330 Ω gives about 9 mA instead of 10 mA. The LED is a touch dimmer and perfectly happy.' },
        { text: 'Either; the LED doesn’t care about current.', why: 'It cares a lot. An LED’s life and brightness depend directly on its current.' },
        { text: 'Neither. You must buy a 300 Ω resistor.', why: 'Resistors only come in standard values. Engineers always pick the nearest safe standard value.' },
      ],
    },
    {
      id: 'code-220',
      type: 'choice',
      prompt: 'A 4-band resistor reads **red, red, brown, gold**. What is its value?',
      options: [
        { text: '22 Ω', why: 'Brown as a multiplier means × 10 (add one zero), not × 1. 22 Ω would be red, red, black.' },
        { text: '2.2 kΩ', why: 'That would need a red multiplier (× 100): red, red, red.' },
        { text: '220 Ω', correct: true, why: 'Red = 2, red = 2, brown = × 10. So 22 × 10 = 220 Ω, ±5 % (gold).' },
        { text: '221 Ω', why: 'On a 4-band resistor only the first two bands are digits. The third is the multiplier.' },
      ],
    },
    {
      id: 'code-10k',
      type: 'choice',
      prompt: 'A 4-band resistor reads **brown, black, orange, gold**. What is its value?',
      options: [
        { text: '10 kΩ', correct: true, why: 'Brown = 1, black = 0, orange = × 1000. 10 × 1000 = 10 000 Ω = 10 kΩ.' },
        { text: '1 kΩ', why: '1 kΩ is brown, black, red (× 100). Orange adds three zeros.' },
        { text: '103 Ω', why: 'The third band is a multiplier, not a digit. Orange means × 1000.' },
        { text: '100 kΩ', why: '100 kΩ would be brown, black, yellow (× 10 000).' },
      ],
    },
    {
      id: 'r-from-vi',
      type: 'numeric',
      prompt: 'A resistor has 4.5 V across it and 2 mA flowing through it. What is its resistance, in kΩ?',
      answer: 2.25,
      tolerance: 0.03,
      unit: 'kΩ',
      hint: 'R = V ÷ I. Convert 2 mA to 0.002 A first, or use the shortcut volts ÷ milliamps = kilohms.',
      explanation: 'R = 4.5 V ÷ 0.002 A = 2250 Ω = **2.25 kΩ**.',
    },
    {
      id: 'low-supply',
      type: 'choice',
      prompt: 'You turn the supply down from 5 V to 1.5 V, keeping the red LED and a 220 Ω resistor. What happens?',
      options: [
        { text: 'It glows at about 30 % brightness, because 1.5 is 30 % of 5.', why: 'An LED isn’t a resistor, so current isn’t proportional to voltage. Below Vf it is essentially off.' },
        { text: 'It burns out, because the resistor no longer limits anything.', why: 'Less voltage means less current, never more. Nothing is at risk.' },
        { text: 'Current flows, (1.5 V ÷ 220 Ω) ≈ 6.8 mA.', why: 'That would be true for a resistor on its own. The LED takes its share first, and at 1.5 V it won’t open up.' },
        { text: 'The LED goes dark, because 1.5 V is below its forward voltage, so almost no current flows.', correct: true, why: 'An LED needs about its forward voltage before current really flows. Below that it is practically off.' },
      ],
    },
  ],
  realBuild: {
    parts: [
      'Elegoo Uno and USB cable',
      'Breadboard and jumper wires',
      '1 red LED',
      'Resistors: 220 Ω, 330 Ω and 1 kΩ',
      '9 V battery and snap connector',
    ],
    steps: [
      BREADBOARD,
      LED_WAY,
      NO_METER,
      'Tip the resistors out of their bags and read each colour code before checking the label. Write down what you read.',
      'Build yesterday’s circuit as drawn, with the **330 Ω** resistor. ' + UNO_POWER_STEP,
      'R1 (330 Ω) from **c8** to **c12**; the LED’s long leg in **e12** and short leg in **e13**; a red jumper from the top **+** rail to **a8** and a black one from **a13** to the top **−** rail. Plug in and compare the brightness with Day 1’s 220 Ω.',
      'Unplug the Uno. Swap R1 for **1 kΩ**, in the same holes (c8 to c12).',
      'Pull the Uno’s two jumpers out of the rails. Push the 9 V battery snap’s **red** lead into the top **+** rail and its **black** lead into the top **−** rail. Everything else stays where it is. Never connect the Uno at the same time.',
      'The LED lights at about 7 mA. Disconnect the battery when you’re done, because the snap clips can short against other metal.',
    ],
    safety: [
      'Never use the 220 Ω or 330 Ω resistor with an LED on 9 V: the current goes over 20 mA. Calculate first.',
      'Don’t let the two 9 V snap terminals touch each other or any loose wire; a shorted 9 V battery gets hot fast.',
      'Use either the Uno or the battery as the supply, not both at once.',
    ],
    // The drawing is the 5 V build with 330 Ω (the lab's "close to 10 mA" challenge). The 9 V step swaps the supply wires only.
    breadboard: {
      supply: 'uno',
      parts: [
        ...UNO_POWER,
        { kind: 'wire', id: 'w-plus', from: 'T+8', to: 'a8', color: 'red' },
        { kind: 'resistor', id: 'R1', from: 'c8', to: 'c12', ohms: 330 },
        { kind: 'led', id: 'D1', anode: 'e12', cathode: 'e13', color: 'red' },
        { kind: 'wire', id: 'w-minus', from: 'a13', to: 'T-13', color: 'black' },
      ],
    },
  },
}

export default lesson
