import type { Lesson } from '../types'
import { between } from './checks'
import { BREADBOARD, NO_METER, UNO_POWER, UNO_POWER_STEP } from './primer'

const lesson: Lesson = {
  id: 'power',
  day: 7,
  phase: 1,
  title: 'Power: watts, why resistors get hot, ratings',
  tagline: 'Every resistor turns electrical energy into heat. Learn how much, and how much it can take.',
  minutes: 35,
  objectives: [
    'Explain power as energy per second, measured in watts',
    'Calculate power with P = V × I, P = I² × R and P = V² ÷ R',
    'Check a resistor against its power rating, and apply the half-rating rule',
    'Recognise the signs of an overheating part and how to prevent it',
  ],
  sections: [
    {
      id: 'what-power',
      title: 'Power is energy per second',
      blocks: [
        {
          type: 'text',
          text: '**Power** is how fast energy is used, measured in **watts (W)**. One watt is one joule of energy every second. A phone charger delivers about 10 W; a tiny LED uses about 0.03 W, which is 30 **mW** (milliwatts).',
        },
        { type: 'formula', expr: 'P = V × I', caption: 'Power = voltage across the part × current through it.' },
        {
          type: 'text',
          text: 'In a resistor, all of that power becomes **heat**. In an LED most of it is heat too, and some becomes light.',
        },
        {
          type: 'callout',
          tone: 'info',
          title: 'Analogy: a water wheel',
          text: 'Pressure (voltage) times flow (current) gives the work the water does on the wheel each second. Where it breaks: a resistor doesn’t do useful work like a wheel. It just gets warm, like a pipe with lots of friction.',
        },
        {
          type: 'predict',
          id: 'd7-smaller-r',
          prompt: 'Start with a 1 kΩ resistor on the 9 V battery (where the lab starts): 9 mA, so 9 V × 9 mA = 81 mW of heat. You swap it for **220 Ω**. Roughly how much heat now?',
          options: [
            { text: 'Less, about 18 mW: less resistance means less friction.', why: 'Less resistance on the same voltage lets *more* current through, and power is V × I. More current, more heat.' },
            { text: 'The same 81 mW, because the voltage hasn’t changed.', why: 'The voltage is the same, but the current isn’t: 9 V ÷ 220 Ω ≈ 41 mA instead of 9 mA.' },
            { text: 'About 0.12 W, a little under the 0.25 W rating.', why: 'Work it through: 9 V ÷ 220 Ω ≈ 41 mA, and 9 V × 41 mA ≈ 0.37 W. That is well over the rating.' },
            { text: 'About 0.37 W, almost 4.5 times more and well over the 0.25 W rating.', correct: true, why: 'I = 9 V ÷ 220 Ω ≈ 41 mA, so P = 9 V × 41 mA ≈ 0.37 W. Same voltage, about 4.5 times the current, so about 4.5 times the heat.' },
          ],
          tryIt: 'With **Supply** on **9 V battery**, set **Resistor R1 (0.25 W)** to **220 Ω** and read **Heat in R1**.',
        },
      ],
    },
    {
      id: 'three-forms',
      title: 'Three ways to calculate it',
      blocks: [
        {
          type: 'text',
          text: 'Combine P = V × I with Ohm’s law (V = I × R) and you get two more forms. Use whichever matches the numbers you have.',
        },
        {
          type: 'table',
          head: ['You know', 'Use', 'Example'],
          rows: [
            ['Voltage and current', '`P = V × I`', '3 V × 0.0136 A ≈ 0.041 W'],
            ['Current and resistance', '`P = I² × R`', '0.020 A × 0.020 A × 220 Ω = 0.088 W'],
            ['Voltage and resistance', '`P = V² ÷ R`', '9 V × 9 V ÷ 220 Ω ≈ 0.37 W'],
          ],
        },
        {
          type: 'predict',
          id: 'd7-lower-volts',
          prompt: '220 Ω on the 9 V battery makes about 0.37 W. You keep **220 Ω** and switch to the Uno’s **5 V**, a bit over half the voltage. What happens to the heat?',
          options: [
            { text: 'It roughly halves, to about 0.2 W.', why: 'Halving the voltage also halves the current, and power is voltage × current. Both halve, so the power falls to a quarter, not a half.' },
            { text: 'It falls to under a third, about 0.11 W, because power goes with the voltage squared.', correct: true, why: 'P = V² ÷ R = 25 ÷ 220 ≈ 0.114 W. The voltage fell to 5/9 of before, so the power fell to (5/9)² ≈ 0.31 of before.' },
            { text: 'It stays the same, because the resistor hasn’t changed.', why: 'The resistance is the same, but less voltage pushes less current. Both factors of V × I go down.' },
            { text: 'It goes up, because the Uno can supply more current.', why: 'The resistor decides the current, not the supply’s ability. Less voltage means less current here.' },
          ],
          tryIt: 'Keep **Resistor R1 (0.25 W)** on **220 Ω** and switch **Supply** from **9 V battery** to **Uno 5 V**. Watch **Heat in R1**.',
        },
        {
          type: 'text',
          text: 'Notice the squares. Double the voltage across a resistor and its power goes up **four times**: twice the voltage pushes twice the current.',
        },
        {
          type: 'walkthrough',
          title: 'A 220 Ω resistor on a 9 V battery',
          steps: [
            { text: 'The battery puts all 9 V across R1.', highlight: ['V1', 'R1'] },
            { text: 'Use the voltage-and-resistance form.', math: 'P = 9 V × 9 V ÷ 220 Ω ≈ 0.368 W', highlight: ['R1'] },
            { text: 'The kit’s resistors are rated for **0.25 W** (a quarter watt). 0.368 W is almost 1.5 times too much.', highlight: ['R1'] },
            { text: 'Try 330 Ω: 81 ÷ 330 ≈ 0.245 W. Just inside the rating, but running right at the limit, so it gets hot.', math: 'P = 81 ÷ 330 ≈ 0.245 W', highlight: ['R1'] },
            { text: 'With 1 kΩ: 81 ÷ 1000 = 0.081 W. Comfortably cool.', math: 'P = 81 ÷ 1000 = 0.081 W', highlight: ['R1'] },
          ],
        },
      ],
    },
    {
      id: 'ratings',
      title: 'Ratings and the half rule',
      blocks: [
        {
          type: 'text',
          text: 'Every part has a **power rating**: the most heat it can get rid of without damage. The through-hole resistors in your kit are **¼ W (0.25 W)**. Go over it and the resistor gets very hot, discolours, may smell or smoke, and can change value or break open.',
        },
        {
          type: 'callout',
          tone: 'tip',
          title: 'The half rule',
          text: 'Designers keep parts at **half their rating or less**. For a ¼ W resistor, that means 0.125 W (125 mW). It leaves a margin for warm rooms, tolerances and surprises, and the part lasts longer.',
        },
        {
          type: 'table',
          head: ['Resistor', 'Power on 5 V', 'Power on 9 V'],
          rows: [
            ['10 Ω', '2.5 W: burns', '8.1 W: burns'],
            ['100 Ω', '0.25 W: at the limit', '0.81 W: burns'],
            ['220 Ω', '0.114 W: fine', '0.368 W: too hot'],
            ['330 Ω', '0.076 W: fine', '0.245 W: at the limit'],
            ['1 kΩ', '0.025 W: cool', '0.081 W: fine'],
          ],
        },
        {
          type: 'text',
          text: 'Your Day 1 LED resistor (220 Ω with 3 V across it) dissipates 3 × 3 ÷ 220 ≈ 0.041 W. That is why it never felt warm.',
        },
        {
          type: 'callout',
          tone: 'warn',
          title: 'A short circuit is the extreme case',
          text: 'A wire straight across a battery has almost no resistance, so the current and power are huge. A 9 V battery shorted by a coin or a paperclip gets hot enough to burn you. Store batteries with their terminals covered.',
        },
      ],
    },
  ],
  lab: {
    title: 'Feel the heat',
    intro: 'One resistor **R1**, rated **0.25 W**, across a supply **V1**. Choose the Uno’s 5 V or a 9 V battery, then pick resistors. Predict the power before each change. Find the safe limit first; then you can cook as many resistors as you like.',
    circuit: {
      ground: 'gnd',
      components: [
        { kind: 'vsource', id: 'V1', pos: 'vcc', neg: 'gnd', volts: 9 },
        { kind: 'resistor', id: 'R1', a: 'vcc', b: 'gnd', ohms: 1000, ratedWatts: 0.25 },
      ],
    },
    layout: {
      width: 14,
      height: 9,
      parts: [
        { id: 'V1', from: { x: 3, y: 3 }, to: { x: 3, y: 6 }, label: 'V1', labelSide: 'left' },
        { id: 'R1', from: { x: 10, y: 3 }, to: { x: 10, y: 6 }, label: 'R1 (¼ W)', labelSide: 'right' },
      ],
      wires: [
        { id: 'w-top', points: [{ x: 3, y: 3 }, { x: 3, y: 1 }, { x: 10, y: 1 }, { x: 10, y: 3 }], carries: { componentId: 'R1', sign: 1 } },
        { id: 'w-bottom', points: [{ x: 10, y: 6 }, { x: 10, y: 8 }, { x: 3, y: 8 }, { x: 3, y: 6 }], carries: { componentId: 'R1', sign: 1 } },
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
        label: 'Resistor R1 (0.25 W)',
        componentId: 'R1',
        prop: 'ohms',
        options: [
          { label: '10 Ω', value: 10, skipOnClick: true },
          { label: '100 Ω', value: 100, skipOnClick: true },
          { label: '220 Ω', value: 220 },
          { label: '330 Ω', value: 330 },
          { label: '1 kΩ', value: 1000 },
        ],
      },
    ],
    clickControls: { R1: 'resistor', V1: 'supply' },
    readouts: [
      { componentId: 'R1', quantity: 'power', label: 'Heat in R1' },
      { componentId: 'R1', quantity: 'current', label: 'Current' },
      { componentId: 'R1', quantity: 'voltage', label: 'Voltage across R1' },
    ],
    challenges: [
      {
        id: 'smallest-safe-9v',
        prompt: 'On the **9 V** battery, find the **smallest** kit resistor that stays within its rating.',
        hint: 'Work down from 1 kΩ and stop just before it overheats.',
        success: '330 Ω dissipates about 0.245 W, just under 0.25 W. Inside the rating, but with no margin at all. It would be too hot to touch. That’s why designers use the half rule.',
        check: (r) => between(r.components.V1?.voltage, 8.99, 9.01) && r.components.R1?.status === 'ok' && (r.components.R1.power ?? 0) > 0.2,
      },
      {
        id: 'overheat',
        prompt: 'Now you know where the limit is: **overheat** R1, pushing it past its **0.25 W** rating.',
        hint: 'Power is V² ÷ R. Go one size smaller than the safe value you just found.',
        success: 'Too hot! On 9 V, 220 Ω dissipates about 0.37 W; 100 Ω about 0.81 W, which would burn. A real ¼ W resistor would discolour and could fail.',
        check: (r) => r.components.R1?.status === 'overpower' || r.components.R1?.status === 'burnt',
      },
      {
        id: 'half-rule',
        prompt: 'On the Uno’s **5 V**, make R1 work hard (over 50 mW) while staying under **half** its rating (125 mW).',
        hint: 'On 5 V, P = 25 ÷ R. Which resistor gives between 0.05 W and 0.125 W?',
        success: '220 Ω gives about 0.114 W and 330 Ω about 0.076 W. Both pass the half rule: a ¼ W resistor will be warm but well within its limit.',
        check: (r) => between(r.components.V1?.voltage, 4.99, 5.01) && between(r.components.R1?.power, 0.05, 0.125),
      },
    ],
  },
  quiz: [
    {
      id: 'p-5v-100',
      type: 'numeric',
      prompt: 'A 100 Ω resistor is connected across 5 V. How much power does it dissipate, in watts?',
      answer: 0.25,
      tolerance: 0.03,
      unit: 'W',
      hint: 'You know V and R, so use P = V² ÷ R.',
      explanation: 'P = 5 × 5 ÷ 100 = **0.25 W**. Exactly the rating of a kit resistor, so it would run hot. The half rule says use something bigger.',
    },
    {
      id: 'p-20ma-220',
      type: 'numeric',
      prompt: '20 mA flows through a 220 Ω resistor. How much power is that, in milliwatts?',
      answer: 88,
      tolerance: 0.03,
      unit: 'mW',
      hint: 'You know I and R, so use P = I² × R with I = 0.020 A.',
      explanation: 'P = 0.020 × 0.020 × 220 = 0.088 W = **88 mW**. Under the half rule (125 mW) for a ¼ W resistor.',
    },
    {
      id: 'p-day1',
      type: 'numeric',
      prompt: 'In your Day 1 circuit, the 220 Ω resistor has 3 V across it. How much power does it dissipate, in milliwatts?',
      answer: 40.9,
      tolerance: 0.05,
      unit: 'mW',
      hint: 'P = V² ÷ R.',
      explanation: 'P = 3 × 3 ÷ 220 ≈ 0.041 W = **about 41 mW**. A sixth of the rating, which is why it stays cool.',
    },
    {
      id: 'nine-volt-220',
      type: 'choice',
      prompt: 'You connect a ¼ W 220 Ω resistor straight across a 9 V battery. What happens?',
      options: [
        { text: 'Nothing: resistors don’t mind voltage.', why: 'Voltage drives current, and V × I is heat. Here that heat is more than the resistor can shed.' },
        { text: 'The battery is shorted, because 220 Ω is almost zero.', why: '220 Ω is a real resistance; the current is about 41 mA, not a short circuit. But it is still too much power for this resistor.' },
        { text: 'It overheats: 81 ÷ 220 ≈ 0.37 W, well over its 0.25 W rating.', correct: true, why: 'It will get very hot, may discolour or smoke, and could fail. Use 1 kΩ or more on 9 V.' },
        { text: 'It runs at exactly half its rating.', why: 'Work it out: 9 × 9 ÷ 220 ≈ 0.37 W, which is about 1.5 times the rating, not half.' },
      ],
    },
    {
      id: 'half-rule-why',
      type: 'choice',
      prompt: 'Why do designers keep a part at half its power rating or less?',
      options: [
        { text: 'To leave a safety margin for heat, tolerances and warm surroundings, so the part runs cooler and lasts longer.', correct: true, why: 'A part run at its limit runs very hot and wears out faster. Margin is cheap; failures aren’t.' },
        { text: 'Because the rating printed on the part is usually twice the real value.', why: 'Ratings are honest. The margin is for real-world conditions, not because the label lies.' },
        { text: 'To save energy from the battery.', why: 'The rule is about the part surviving. To save energy you’d choose a larger resistance, which is a different decision.' },
        { text: 'It’s only needed for resistors, not other parts.', why: 'Engineers derate almost everything: resistors, transistors, regulators, even wires.' },
      ],
    },
    {
      id: 'which-hotter',
      type: 'choice',
      prompt: 'On the Uno’s 5 V, which gets hotter: a 220 Ω resistor or a 1 kΩ resistor?',
      options: [
        { text: '1 kΩ, because more resistance means more friction.', why: 'More resistance means *less current* on the same voltage, and so less heat overall.' },
        { text: 'Both the same, because the voltage is the same.', why: 'Same voltage, different currents. Power depends on both.' },
        { text: 'Neither gets warm on 5 V.', why: '220 Ω on 5 V makes about 0.11 W. You can feel it get warm.' },
        { text: '220 Ω, because P = V² ÷ R: with the same voltage, less resistance means more power.', correct: true, why: '25 ÷ 220 ≈ 0.114 W versus 25 ÷ 1000 = 0.025 W.' },
      ],
    },
  ],
  realBuild: {
    parts: [
      'Elegoo Uno and USB cable',
      'Breadboard and jumper wires',
      'Resistors: 220 Ω and 1 kΩ',
    ],
    steps: [
      BREADBOARD,
      NO_METER,
      'Unplugged. ' + UNO_POWER_STEP,
      'Put the 1 kΩ resistor R1 from **c5** to **c9**. A red jumper from the top **+** rail to **a5**, and a black jumper from **a9** to the top **−** rail. R1 now sits straight across 5 V.',
      'Plug in for one minute (25 mW). Unplug, then touch the resistor lightly: it is barely warm, if at all.',
      'Swap in the 220 Ω resistor, in the same holes (about 0.114 W). Plug in for one minute, unplug, and touch it briefly and carefully: noticeably warm.',
      'Calculate what a 220 Ω would make on 9 V (0.37 W). Don’t build it: the lab already showed you.',
    ],
    safety: [
      'Touch resistors only after unplugging, and only briefly. A resistor near its rating can be hot enough to burn.',
      '**Do not** connect resistors under 1 kΩ directly across the 9 V battery. They overheat.',
      'Never short the Uno’s 5V to GND or the 9 V battery’s terminals together.',
    ],
    // The drawing is the first step: 1 kΩ on the Uno's 5 V.
    breadboard: {
      supply: 'uno',
      parts: [
        ...UNO_POWER,
        { kind: 'wire', id: 'w-plus', from: 'T+5', to: 'a5', color: 'red' },
        { kind: 'resistor', id: 'R1', from: 'c5', to: 'c9', ohms: 1000 },
        { kind: 'wire', id: 'w-minus', from: 'a9', to: 'T-9', color: 'black' },
      ],
    },
  },
}

export default lesson
