import type { Lesson } from '../types'
import { between, mA } from './checks'
import { BREADBOARD, LED_WAY, METER_OPTIONAL, METER_VOLTS } from './primer'

const colours = [
  { label: 'Red', value: 'red' },
  { label: 'Yellow', value: 'yellow' },
  { label: 'Green', value: 'green' },
  { label: 'Blue', value: 'blue' },
  { label: 'White', value: 'white' },
]

const lesson: Lesson = {
  id: 'diodes-leds',
  day: 8,
  phase: 1,
  title: 'Diodes and LEDs: forward voltage, polarity, multiple LEDs',
  tagline: 'One-way valves for current. Learn why colour changes the voltage, and how to run several LEDs at once.',
  minutes: 45,
  objectives: [
    'Explain what a diode does and identify the anode and cathode of a diode and an LED',
    'Describe how forward voltage depends on LED colour, and calculate a resistor for each colour',
    'Calculate the current for LEDs in series, and spot when the supply is too low to light them',
    'Explain why LEDs in parallel each need their own resistor',
    'Read an LED’s three key ratings: 20 mA continuous, about 30 mA maximum, about 5 V in reverse',
  ],
  sections: [
    {
      id: 'diodes',
      title: 'Diodes: one-way valves',
      blocks: [
        {
          type: 'text',
          text: 'A **diode** lets current flow one way only: from its **anode** to its **cathode**. Backwards, it blocks. On a plain diode like the **1N4007**, a silver **band** marks the cathode end.',
        },
        {
          type: 'text',
          text: 'A diode needs a minimum voltage before it really conducts, its **forward voltage** (Vf). For an ordinary silicon diode that is about **0.7 V**. Above that, its current climbs steeply, just like the LED on Day 1.',
        },
        {
          type: 'callout',
          tone: 'info',
          title: 'Analogy: a valve with a spring',
          text: 'A diode is like a one-way valve held shut by a spring: water must push hard enough to open it. Where it breaks: a real diode doesn’t snap open at an exact voltage. Its current grows smoothly but very fast, roughly ten times more for every extra 0.1 V or so. So “0.7 V” is a handy approximation, not a hard line.',
        },
        {
          type: 'text',
          text: 'What are plain diodes for? Blocking current that tries to go the wrong way: protecting a circuit from a battery put in backwards, or (Day 32) protecting a transistor from a motor’s voltage spike.',
        },
        {
          type: 'predict',
          id: 'd8-protect',
          prompt: 'In the lab, a red LED on 5 V with 220 Ω gets about 14 mA. You add the protection diode **D3** to the loop, the right way round. What happens to the LED current?',
          options: [
            { text: 'Nothing: a diode pointing the right way is just a wire.', why: 'A diode conducting forwards still takes its forward voltage, about 0.7 V. That voltage is no longer available to the resistor.' },
            { text: 'It drops to about 11 mA, because the diode takes about 0.7 V and leaves less for the resistor.', correct: true, why: 'The resistor now gets about 5 − 0.7 − 2 = 2.3 V, and 2.3 V ÷ 220 Ω ≈ 10.5 mA by hand. The simulator shows about 10.7 mA. Protection costs a little brightness.' },
            { text: 'It drops to zero, because diodes block current.', why: 'Diodes block only *backwards*. Pointing from + towards −, D3 conducts.' },
            { text: 'It rises, because the diode pushes the current along.', why: 'A diode never adds push; it only takes voltage. The current can only go down.' },
          ],
          tryIt: 'Set **Protection diode D3** to **Open (D3 in the loop)** and read **Current through D1** and **Voltage across D3**.',
        },
      ],
    },
    {
      id: 'led-colours',
      title: 'LED colours have different forward voltages',
      blocks: [
        {
          type: 'text',
          text: 'An **LED** is a diode made from materials that give off light. The colour depends on the material, and so does the forward voltage. Bluer light carries more energy, so it needs a higher voltage.',
        },
        {
          type: 'table',
          head: ['Colour', 'Typical Vf', 'With 220 Ω on 5 V (hand calc)'],
          rows: [
            ['Red', '≈ 2.0 V', '(5 − 2.0) ÷ 220 ≈ 13.6 mA'],
            ['Yellow', '≈ 2.1 V', '(5 − 2.1) ÷ 220 ≈ 13.2 mA'],
            ['Green', '≈ 2.2 V', '(5 − 2.2) ÷ 220 ≈ 12.7 mA'],
            ['Blue', '≈ 3.1 V', '(5 − 3.1) ÷ 220 ≈ 8.6 mA'],
            ['White', '≈ 3.1 V', '(5 − 3.1) ÷ 220 ≈ 8.6 mA'],
          ],
        },
        {
          type: 'text',
          text: 'These are values at about 20 mA. At lower currents the LED takes a little less, so the simulator’s meters read slightly higher currents than the hand calculation (for example about 9 mA for blue). Always check a real LED’s datasheet.',
        },
        {
          type: 'table',
          head: ['A typical 5 mm LED datasheet says', 'Value', 'In the simulator'],
          rows: [
            ['Continuous forward current (the comfortable rating)', '20 mA', 'Warning tag above 20 mA'],
            ['Absolute maximum forward current', 'about 30 mA', 'Marked burnt far beyond it (over 60 mA), as a rule of thumb'],
            ['Maximum reverse voltage', 'about 5 V', '**REVERSE V** warning beyond 5 V backwards'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: 'Polarity, once more',
          text: 'LED: the **long leg** is the anode (+); the cathode (−) is the short leg, on the **flat side** of the rim. Diode: the **band** is the cathode. In the symbol, the bar is the cathode too.',
        },
      ],
    },
    {
      id: 'series-leds',
      title: 'LEDs in series',
      blocks: [
        {
          type: 'text',
          text: 'Put LEDs in series and their forward voltages **add up**. The resistor gets whatever is left. If nothing is left, nothing lights.',
        },
        { type: 'formula', expr: 'I = (V supply − Vf1 − Vf2) ÷ R', caption: 'One loop, so one current through both LEDs and the resistor.' },
        {
          type: 'predict',
          id: 'd8-two-blue',
          prompt: 'You open jumper S1 so that **two blue LEDs** (about 3.1 V each) are in series with 220 Ω on the Uno’s **5 V**. What happens?',
          options: [
            { text: 'Both glow, but dimmer than one alone.', why: 'That is what happens with two *red* LEDs, which need about 4 V together. Two blue ones need about 6 V, more than the supply.' },
            { text: 'D1 lights and D2 stays dark.', why: 'In series there is only one current. If one LED is dark, they all are.' },
            { text: 'Neither lights: together they need about 6 V, and the supply is only 5 V.', correct: true, why: '5 V − 3.1 V − 3.1 V is less than zero, so nothing is left to push current through the resistor. Essentially no current flows.' },
            { text: 'Both burn out, because 5 V is too much for them.', why: 'Burning needs too much current, and here almost none flows.' },
          ],
          tryIt: 'Set **D1 colour** and **D2 colour** to **Blue**, set **Jumper S1 across D2** to **Open (D2 in series)**, and read **Current through D1**. Then set **Supply** to **9 V battery**.',
        },
        {
          type: 'walkthrough',
          title: 'Two LEDs in series, three ways',
          steps: [
            { text: 'Open the jumper **S1** so that both LEDs are in the loop.', highlight: ['S1', 'D1', 'D2'] },
            { text: 'Two red LEDs on 5 V with 220 Ω: the LEDs take about 4 V together.', math: 'I = (5 − 2 − 2) ÷ 220 ≈ 4.5 mA', highlight: ['D1', 'D2', 'R1'] },
            { text: 'Dimmer, but lit. The simulator shows about 5.6 mA, because at low current each red LED takes a bit less than 2 V.', highlight: ['D1', 'D2'] },
            { text: 'Two blue LEDs on 5 V: they need about 6 V together, and the supply is only 5 V. Neither lights at all.', math: '5 V − 3.1 V − 3.1 V < 0', highlight: ['D1', 'D2'] },
            { text: 'Switch to the 9 V battery. Now there is room for both blue LEDs and the resistor.', math: 'I = (9 − 3.1 − 3.1) ÷ 220 ≈ 12.7 mA', highlight: ['V1', 'R1'] },
            { text: 'The simulator shows about 13 mA. Both LEDs glow evenly, because the same current flows through both.', highlight: ['D1', 'D2'] },
          ],
        },
      ],
    },
    {
      id: 'parallel-leds',
      title: 'LEDs in parallel need their own resistors',
      blocks: [
        {
          type: 'text',
          text: 'Why not put several LEDs side by side, in parallel, sharing one resistor? Because no two LEDs are identical. The one with the slightly lower forward voltage starts conducting first and **hogs** the current, so it is brighter and runs hotter, while the others stay dim.',
        },
        {
          type: 'callout',
          tone: 'warn',
          title: 'One LED, one resistor',
          text: 'For LEDs in parallel, give each LED its own resistor. Mixing colours in parallel is even worse: a red LED (about 2 V) holds the voltage too low for a blue one (about 3 V) to light at all.',
        },
        {
          type: 'callout',
          tone: 'info',
          title: 'Reverse voltage',
          text: 'A backwards LED blocks current, but only up to a point. Most LEDs are rated for about **5 V** in reverse. Beyond that a real LED can break down and be damaged, even though no current flowed a moment before. The Uno’s 5 V is fine; don’t reverse an LED across bigger supplies. The simulator tags an LED **REVERSE V** when it has more than 5 V across it backwards.',
        },
        {
          type: 'predict',
          id: 'd8-reverse-9v',
          prompt: 'D1 is flipped **backwards** on the **9 V battery**. What should you expect?',
          options: [
            { text: 'Nothing to worry about: it blocks, and no current means no harm.', why: 'No current, yes. But the danger is the *voltage*: about 9 V backwards across an LED rated for about 5 V.' },
            { text: 'It lights dimly, because 9 V is enough to push through backwards.', why: 'An LED never lights backwards. Pushed far enough, it breaks down instead, which damages it.' },
            { text: 'About 30 mA flows backwards and burns it out at once.', why: 'Below breakdown almost nothing flows backwards. The problem is the voltage stress, not current. (The simulator doesn’t model breakdown itself; it warns before you get there.)' },
            { text: 'It blocks the current, but about 9 V sits across it backwards, beyond its 5 V rating, so the simulator warns REVERSE V.', correct: true, why: 'The LED is an open switch, so the whole supply appears across it the wrong way. 9 V is well past the typical 5 V reverse rating. On 5 V it would be fine.' },
          ],
          tryIt: 'Set **Supply** to **9 V battery**, press **Flip D1**, and look at D1’s tag and **Voltage across D1**. Then switch **Supply** back to **Uno 5 V**.',
        },
      ],
    },
  ],
  lab: {
    title: 'Colours, polarity and LEDs in series',
    intro: 'Two LEDs in series. Jumper **S1** starts closed, which skips D2; open it to put D2 in the loop. Switch **S2** starts closed, which bypasses the protection diode **D3**; open it to put D3 in the loop. Predict each change, then make it.',
    circuit: {
      ground: 'gnd',
      components: [
        { kind: 'vsource', id: 'V1', pos: 'vcc', neg: 'gnd', volts: 5 },
        { kind: 'resistor', id: 'R1', a: 'vcc', b: 'a', ohms: 220 },
        { kind: 'led', id: 'D1', anode: 'a', cathode: 'b', color: 'red' },
        { kind: 'led', id: 'D2', anode: 'b', cathode: 'ret', color: 'red' },
        { kind: 'switch', id: 'S1', a: 'b', b: 'ret', closed: true },
        { kind: 'diode', id: 'D3', anode: 'ret', cathode: 'gnd' },
        { kind: 'switch', id: 'S2', a: 'ret', b: 'gnd', closed: true },
      ],
    },
    layout: {
      width: 14,
      height: 9,
      parts: [
        { id: 'V1', from: { x: 1, y: 3 }, to: { x: 1, y: 6 }, label: 'V1', labelSide: 'left' },
        { id: 'R1', from: { x: 2, y: 1 }, to: { x: 5, y: 1 }, label: 'R1', labelSide: 'above' },
        { id: 'D1', from: { x: 7, y: 1 }, to: { x: 10, y: 1 }, label: 'D1', labelSide: 'above' },
        { id: 'D2', from: { x: 11, y: 3 }, to: { x: 11, y: 6 }, label: 'D2', labelSide: 'left' },
        { id: 'S1', from: { x: 13, y: 3 }, to: { x: 13, y: 6 }, label: 'Jumper S1', labelSide: 'right' },
        { id: 'D3', from: { x: 8, y: 8 }, to: { x: 5, y: 8 }, label: 'D3 (1N4007)', labelSide: 'below' },
        { id: 'S2', from: { x: 8, y: 6 }, to: { x: 5, y: 6 }, label: 'S2', labelSide: 'above' },
      ],
      wires: [
        { id: 'w-v1-r1', points: [{ x: 1, y: 3 }, { x: 1, y: 1 }, { x: 2, y: 1 }], carries: { componentId: 'R1', sign: 1 } },
        { id: 'w-r1-d1', points: [{ x: 5, y: 1 }, { x: 7, y: 1 }], carries: { componentId: 'R1', sign: 1 } },
        { id: 'w-d1-b', points: [{ x: 10, y: 1 }, { x: 11, y: 1 }], carries: { componentId: 'R1', sign: 1 } },
        { id: 'w-b-d2', points: [{ x: 11, y: 1 }, { x: 11, y: 3 }], carries: { componentId: 'D2', sign: 1 } },
        { id: 'w-b-s1', points: [{ x: 11, y: 1 }, { x: 13, y: 1 }, { x: 13, y: 3 }], carries: { componentId: 'S1', sign: 1 } },
        { id: 'w-s1-ret', points: [{ x: 13, y: 6 }, { x: 13, y: 8 }, { x: 11, y: 8 }], carries: { componentId: 'S1', sign: 1 } },
        { id: 'w-d2-ret', points: [{ x: 11, y: 6 }, { x: 11, y: 8 }], carries: { componentId: 'D2', sign: 1 } },
        { id: 'w-ret-d3', points: [{ x: 11, y: 8 }, { x: 8, y: 8 }], carries: { componentId: 'R1', sign: 1 } },
        { id: 'w-ret-s2', points: [{ x: 8, y: 8 }, { x: 8, y: 6 }], carries: { componentId: 'S2', sign: 1 } },
        { id: 'w-s2-gnd', points: [{ x: 5, y: 6 }, { x: 5, y: 8 }], carries: { componentId: 'S2', sign: 1 } },
        { id: 'w-gnd-v1', points: [{ x: 5, y: 8 }, { x: 1, y: 8 }, { x: 1, y: 6 }], carries: { componentId: 'R1', sign: 1 } },
      ],
      probes: [
        { node: 'a', at: { x: 6, y: 1 }, label: 'D1 +' },
        { node: 'b', at: { x: 11, y: 2 }, label: 'D2 +' },
      ],
    },
    controls: [
      {
        type: 'choice',
        id: 'supply',
        label: 'Supply',
        componentId: 'V1',
        prop: 'volts',
        options: [
          { label: 'Uno 5 V', value: 5 },
          { label: '9 V battery', value: 9 },
        ],
      },
      {
        type: 'choice',
        id: 'resistor',
        label: 'Resistor R1',
        componentId: 'R1',
        prop: 'ohms',
        options: [
          { label: '100 Ω', value: 100, skipOnClick: true },
          { label: '220 Ω', value: 220 },
          { label: '330 Ω', value: 330 },
          { label: '1 kΩ', value: 1000 },
        ],
      },
      { type: 'choice', id: 'd1-colour', label: 'D1 colour', componentId: 'D1', prop: 'color', options: colours },
      { type: 'choice', id: 'd2-colour', label: 'D2 colour', componentId: 'D2', prop: 'color', options: colours },
      { type: 'flip', id: 'flip-d1', label: 'Flip D1', componentId: 'D1' },
      { type: 'toggle', id: 'jumper', label: 'Jumper S1 across D2', componentId: 'S1', prop: 'closed', onLabel: 'Closed (D2 skipped)', offLabel: 'Open (D2 in series)' },
      { type: 'toggle', id: 'protect', label: 'Protection diode D3', componentId: 'S2', prop: 'closed', onLabel: 'Closed (D3 bypassed)', offLabel: 'Open (D3 in the loop)' },
    ],
    clickControls: { R1: 'resistor', D1: 'flip-d1', D2: 'd2-colour', S1: 'jumper', S2: 'protect', V1: 'supply' },
    readouts: [
      { componentId: 'D1', quantity: 'current', label: 'Current through D1' },
      { componentId: 'D1', quantity: 'voltage', label: 'Voltage across D1' },
      { componentId: 'D2', quantity: 'voltage', label: 'Voltage across D2' },
      { componentId: 'D3', quantity: 'voltage', label: 'Voltage across D3' },
      { componentId: 'R1', quantity: 'voltage', label: 'Voltage across R1' },
    ],
    challenges: [
      {
        id: 'high-vf',
        prompt: 'Find an LED colour for D1 that takes **more than 2.7 V** while it’s lit.',
        hint: 'Try each colour and watch the voltage across D1. Bluer light needs more voltage.',
        success: 'Blue and white LEDs take about 3 V, about 1 V more than red. That leaves less for the resistor, so the same resistor gives less current.',
        check: (r) => r.components.D1?.status === 'ok' && (r.components.D1.voltage ?? 0) > 2.7 && r.components.D1.current > 1 * mA,
      },
      {
        id: 'two-red',
        prompt: 'Open **jumper S1** so **both LEDs** are in series, and light both safely with at least 2 mA.',
        hint: 'Set the jumper to Open. Two red LEDs take about 4 V, so on 5 V only about 1 V is left for the resistor.',
        success: 'Both glow, with exactly the same current, because they are in one loop. On 5 V with 220 Ω that’s only about 5–6 mA: the LEDs ate most of the voltage.',
        check: (r) =>
          r.components.S1?.status === 'off' &&
          r.components.D1?.status === 'ok' &&
          r.components.D2?.status === 'ok' &&
          r.components.D1.current >= 2 * mA &&
          r.components.D2.current >= 2 * mA,
      },
      {
        id: 'two-blue',
        prompt: 'Light **two blue (or white) LEDs in series**, each between 5 and 20 mA.',
        hint: 'Try it on 5 V first: why does nothing happen? Then pick a supply with enough voltage for two 3 V LEDs plus a resistor.',
        success: 'On 5 V two blue LEDs can’t light: they need about 6 V together. On 9 V there are about 3 V left for the resistor, so 220 Ω gives about 13 mA.',
        check: (r) =>
          r.components.S1?.status === 'off' &&
          (r.components.D1?.voltage ?? 0) > 2.7 &&
          (r.components.D2?.voltage ?? 0) > 2.7 &&
          r.components.D1?.status === 'ok' &&
          between(r.components.D1.current, 5 * mA, 20 * mA),
      },
      {
        id: 'reverse-block',
        prompt: 'Flip D1 **backwards** and confirm that it blocks the current completely, **without** going past its 5 V reverse rating.',
        hint: 'Click D1 to flip it, and watch the current and the voltage across D1. If D1 shows **REVERSE V**, the supply is too big for a backwards LED: use the Uno’s 5 V.',
        success: 'Zero current, and D1 has nearly the whole supply across it the wrong way round (a negative reading). A diode backwards is an open switch. On 5 V that is within the LED’s rating; on the 9 V battery it would not be.',
        check: (r) =>
          between(r.components.V1?.voltage, 4.99, 5.01) &&
          r.components.D1?.status === 'off' &&
          (r.components.D1.voltage ?? 0) < -1 &&
          Math.abs(r.components.D1.current) < 0.001 * mA,
      },
    ],
  },
  quiz: [
    {
      id: 'anode-leg',
      type: 'choice',
      prompt: 'Which leg of an LED is the anode (+)?',
      options: [
        { text: 'The short leg.', why: 'The short leg is the cathode (−). It goes towards GND.' },
        { text: 'The leg on the flat side of the rim.', why: 'The flat side marks the **cathode**, the opposite of the anode.' },
        { text: 'The long leg.', correct: true, why: 'The long leg is the anode and goes towards + (through the resistor if it’s on that side).' },
        { text: 'Either; LEDs work both ways.', why: 'An LED is a diode, so it only conducts one way. Backwards it stays dark.' },
      ],
    },
    {
      id: 'diode-band',
      type: 'choice',
      prompt: 'A 1N4007 diode has a silver band near one end. What does the band mark?',
      options: [
        { text: 'The anode, the end current flows into.', why: 'The other way round. The band is the cathode.' },
        { text: 'The cathode, the end current flows out of.', correct: true, why: 'The band matches the bar in the diode symbol: current flows from anode to cathode, towards the band.' },
        { text: 'The positive terminal of a battery.', why: 'It marks the diode’s cathode. On a working diode the cathode usually points toward the lower voltage.' },
        { text: 'Nothing; it’s only the brand’s colour.', why: 'The band is important: put a diode in backwards and it blocks the current you wanted.' },
      ],
    },
    {
      id: 'blue-10ma',
      type: 'numeric',
      prompt: 'A blue LED (Vf = 3 V) should run at 10 mA from 5 V. What resistor do you need, in ohms?',
      answer: 200,
      tolerance: 0.05,
      unit: 'Ω',
      hint: 'R = (V supply − Vf) ÷ I, with I = 0.010 A.',
      explanation: 'The resistor takes 5 − 3 = 2 V. R = 2 V ÷ 0.010 A = **200 Ω**. The nearest kit value rounding up is 220 Ω.',
    },
    {
      id: 'two-red-9v',
      type: 'numeric',
      prompt: 'Two red LEDs (Vf = 2 V each) and a 220 Ω resistor are in series on a 9 V battery. What current flows, in mA?',
      answer: 22.7,
      tolerance: 0.05,
      unit: 'mA',
      hint: 'Subtract both forward voltages from the supply, then divide by the resistance.',
      explanation: 'The resistor takes 9 − 2 − 2 = 5 V. I = 5 V ÷ 220 Ω ≈ **22.7 mA**: over the 20 mA rating, so use 330 Ω here instead (about 15 mA).',
    },
    {
      id: 'two-blue-5v',
      type: 'choice',
      prompt: 'You connect two blue LEDs (about 3 V each) in series with a 100 Ω resistor to the Uno’s 5 V. What happens?',
      options: [
        { text: 'Both light dimly.', why: 'They would need about 6 V before real current flows. 5 V isn’t enough for both, so they stay dark.' },
        { text: 'The first lights, the second doesn’t.', why: 'In series there is one current. If one LED is dark, they all are.' },
        { text: 'They burn out because 100 Ω is too small.', why: 'Burning needs too much current, and here almost none flows. The supply can’t overcome both forward voltages.' },
        { text: 'Neither lights: together they need about 6 V, more than the 5 V supply.', correct: true, why: 'With the supply below the sum of the forward voltages, essentially no current flows, whatever resistor you choose.' },
      ],
    },
    {
      id: 'parallel-share',
      type: 'choice',
      prompt: 'Why shouldn’t two LEDs in parallel share one resistor?',
      options: [
        { text: 'The LED with the slightly lower forward voltage hogs most of the current, so they glow unevenly and one may be overloaded.', correct: true, why: 'Small differences in Vf make big differences in current. Give each LED its own resistor.' },
        { text: 'Parallel LEDs always cancel each other out.', why: 'Nothing cancels; they both conduct. The problem is that they don’t share the current fairly.' },
        { text: 'The resistor would have to be in parallel too.', why: 'The resistor would be in series with the pair. That’s exactly the arrangement that lets one LED hog the current.' },
        { text: 'It works perfectly as long as both LEDs are the same colour.', why: 'Even two LEDs from the same bag differ slightly in Vf, so one still takes more current. Separate resistors fix it.' },
      ],
    },
    {
      id: 'diode-plus-led',
      type: 'numeric',
      prompt: 'For reverse-polarity protection you put a silicon diode (0.7 V) in series with a red LED (2 V) and a 220 Ω resistor on 5 V. What current flows, in mA?',
      answer: 10.45,
      tolerance: 0.05,
      unit: 'mA',
      hint: 'Both the diode and the LED take their forward voltage. The resistor gets the rest.',
      explanation: 'The resistor takes 5 − 0.7 − 2 = 2.3 V. I = 2.3 V ÷ 220 Ω ≈ **10.5 mA**. The protection costs you 0.7 V, and a little brightness.',
    },
  ],
  realBuild: {
    parts: [
      'Elegoo Uno and USB cable',
      'Breadboard and jumper wires',
      'LEDs: 2 red and 2 blue (or white)',
      'Resistors: 220 Ω and 330 Ω',
      '1 × 1N4007 diode',
      'Digital multimeter (optional)',
      '9 V battery and snap connector',
    ],
    steps: [
      BREADBOARD,
      LED_WAY,
      '**Which way the diode goes.** Current flows *towards* the silver band (the cathode), just as it flows towards an LED’s short leg.',
      METER_OPTIONAL,
      METER_VOLTS,
      'Colours: build the Day 1 circuit (5V → 220 Ω → LED → GND) with a red LED, then a blue one. Blue is dimmer for the same resistor; if you have a multimeter, measure the voltage across each LED.',
      'Two in series on 5 V: unplug, then wire 5V → 220 Ω → red LED → second red LED → GND (long leg of the second LED to the short leg of the first). Plug in: both glow, a little dimmer than one alone.',
      'Two blue LEDs in series on 5 V: they stay dark. Unplug the Uno.',
      'Now power the same two blue LEDs from the **9 V battery** (red wire to the resistor, black to the last LED’s short leg). Both light at about 13 mA.',
      'Diode: back on the Uno, wire 5V → 1N4007 (band away from 5V) → 220 Ω → red LED → GND. The LED lights. Turn the diode around: the LED goes dark. The diode is blocking.',
    ],
    safety: [
      'Use the 9 V battery only with **two blue (or white) LEDs in series** and at least 220 Ω. Two red LEDs on 9 V need 330 Ω (220 Ω gives about 23 mA, over the 20 mA rating), and one LED on 9 V needs 1 kΩ (Day 2).',
      'Don’t connect the Uno and the 9 V battery to the same circuit.',
      'Never put an LED backwards across more than about 5 V.',
    ],
  },
}

export default lesson
