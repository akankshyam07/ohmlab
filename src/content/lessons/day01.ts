import type { Lesson } from '../types'
import { between, mA, part } from './checks'
import { BREADBOARD, LED_WAY, NO_METER, UNO_POWER, UNO_POWER_STEP } from './primer'

const lesson: Lesson = {
  id: 'first-led',
  day: 1,
  phase: 1,
  title: 'Voltage, current, resistance; your first LED',
  tagline: 'Three numbers describe every circuit. Use them to light an LED without killing it.',
  minutes: 40,
  objectives: [
    'Explain voltage, current and resistance in your own words, with their units',
    'Trace a circuit as a closed loop from the + side of a supply back to ground',
    'Use Ohm’s law to work out the current through an LED and its resistor',
    'Explain why an LED needs a resistor, and what happens when it is put in backwards',
  ],
  sections: [
    {
      id: 'three-numbers',
      title: 'Three numbers describe every circuit',
      blocks: [
        {
          type: 'text',
          text: 'Electricity is tiny particles called **charge** moving through a material, like copper wire. You can’t see it, but you can describe it completely with three numbers.',
        },
        {
          type: 'table',
          head: ['Quantity', 'Water-pipe picture', 'What it really is'],
          rows: [
            ['**Voltage** (symbol V), in volts (V)', 'The pressure difference between two points', 'How hard charge is pushed. Always measured *between two points*.'],
            ['**Current** (symbol I), in amps (A)', 'How much water flows past per second', 'How much charge passes a point each second. 1 mA (milliamp) = 0.001 A.'],
            ['**Resistance** (symbol R), in ohms (Ω)', 'How narrow the pipe is', 'How strongly a part opposes current. 1 kΩ (kilohm) = 1000 Ω.'],
          ],
        },
        {
          type: 'text',
          text: 'Current uses the letter *I* (from the French *intensité*), not C. You will see V, I and R everywhere.',
        },
        {
          type: 'callout',
          tone: 'info',
          title: 'Where the water picture breaks',
          text: 'Pipes leak when you cut them; a cut wire doesn’t spill electricity, current just stops. The picture works well for today’s circuits. It breaks down for capacitors and AC (later phases), and we’ll replace it when it does.',
        },
      ],
    },
    {
      id: 'closed-loop',
      title: 'A circuit is a closed loop',
      blocks: [
        {
          type: 'text',
          text: 'A **circuit** is a closed loop. Current leaves the **+** side of a source (a battery, or the Uno’s **5V** pin), flows through the parts, and returns to the **−** side. The − side is called **GND**, short for *ground*. We call it 0 V and measure every other voltage from it.',
        },
        {
          type: 'text',
          text: 'Break the loop anywhere and current stops *everywhere* in it. That is all a switch does.',
        },
        {
          type: 'walkthrough',
          title: 'Trace the loop in the lab',
          steps: [
            { text: 'Start at the **+** side of the 5 V supply, **V1**. This is the push.', highlight: ['V1'] },
            { text: 'Current flows along the wire into the resistor **R1**, which limits how much can flow.', highlight: ['R1'] },
            { text: 'Next it enters the LED **D1** through its **anode** (the + leg) and leaves through its **cathode** (the − leg).', highlight: ['D1'] },
            { text: 'Finally it returns to the **−** side of V1 (GND). One loop, one path, so the same current flows through every part.', highlight: ['V1', 'R1', 'D1'] },
          ],
        },
      ],
    },
    {
      id: 'ohms-law',
      title: 'Ohm’s law',
      blocks: [
        {
          type: 'text',
          text: 'The one formula you’ll use every day links the three numbers:',
        },
        { type: 'formula', expr: 'V = I × R', caption: 'Rearranged: **I = V ÷ R** and **R = V ÷ I**.' },
        {
          type: 'text',
          text: 'Push harder (more V) and more current flows. Make the pipe narrower (more R) and less current flows. Example: 3 V across a 1000 Ω resistor gives 3 ÷ 1000 = 0.003 A, which is **3 mA**.',
        },
        {
          type: 'callout',
          tone: 'tip',
          title: 'Unit shortcut',
          text: 'Volts ÷ kilohms gives milliamps. 3 V ÷ 1 kΩ = 3 mA. It saves counting zeros.',
        },
        {
          type: 'predict',
          id: 'd1-ten-k',
          prompt: 'With **R1 = 1 kΩ** (where the lab starts), about 3 mA flows. What happens to the LED if you swap 1 kΩ for **10 kΩ**?',
          options: [
            { text: 'It gets brighter, because a bigger resistor is stronger.', why: 'A bigger resistance opposes current *more*, so less flows. Less current means less light.' },
            { text: 'It glows much more faintly: about a tenth of the current, roughly 0.3 mA.', correct: true, why: 'The resistor still gets about 3 V, and 3 V ÷ 10 kΩ = 0.3 mA. Ten times the resistance, a tenth of the current. The simulator shows about 0.33 mA: a faint glow.' },
            { text: 'Nothing changes, because the LED always takes 2 V.', why: 'The LED’s voltage hardly changes, true. But the *resistor* sets the current, and with ten times the resistance only a tenth as much flows.' },
            { text: 'It goes out completely, because 10 kΩ blocks the current.', why: 'A resistor never blocks completely; it only limits. About 0.3 mA still flows, enough for a faint glow.' },
          ],
          tryIt: 'Set **Resistor R1** to **10 kΩ** and read **Current through the loop**. Then try **220 Ω**.',
        },
      ],
    },
    {
      id: 'why-resistor',
      title: 'Why an LED needs a resistor',
      blocks: [
        {
          type: 'text',
          text: 'An **LED** (light-emitting diode) is not like a resistor. It lets current through only **one way**: in at the **anode** (the long leg) and out at the **cathode** (the short leg, on the flat side of the rim).',
        },
        {
          type: 'text',
          text: 'An LED also takes a roughly fixed slice of the voltage, called its **forward voltage** (*Vf*). For a red LED it is about **2 V**. Give it a little more than that and its current shoots up, with almost nothing inside to stop it. A small LED is happy at **5–20 mA**: 20 mA is its comfortable continuous rating, and about 30 mA is a typical absolute maximum. With no limit it can pass hundreds of mA and die in a flash.',
        },
        {
          type: 'callout',
          tone: 'info',
          title: 'One number to remember: 20 mA',
          text: 'The simulator warns you as soon as an LED goes over **20 mA**, and marks it burnt far beyond its maximum (over 60 mA). The burnt line is a rule of thumb for the simulator, not a measured fact: real LEDs vary.',
        },
        {
          type: 'text',
          text: 'So you put a **resistor** in the loop. It takes whatever voltage the LED doesn’t, and Ohm’s law then sets the current.',
        },
        {
          type: 'walkthrough',
          title: 'How much current flows with a 220 Ω resistor?',
          steps: [
            { text: 'The supply gives 5 V across the whole loop.', highlight: ['V1'] },
            { text: 'The red LED takes about 2 V of that.', highlight: ['D1'] },
            { text: 'The resistor gets what is left.', math: 'V(R1) = 5 V − 2 V = 3 V', highlight: ['R1'] },
            { text: 'Ohm’s law gives the current through the resistor, and so through the whole loop.', math: 'I = 3 V ÷ 220 Ω = 0.0136 A ≈ 13.6 mA', highlight: ['R1', 'D1'] },
            { text: 'That is safe and bright. The simulator uses a more realistic LED model, so its meter shows about **14 mA**. Set R1 to 220 Ω in the lab and check.', highlight: ['D1'] },
          ],
        },
        {
          type: 'predict',
          id: 'd1-backwards',
          prompt: 'With 220 Ω in place, you put the LED in **backwards**. What does the current meter show?',
          options: [
            { text: 'About 14 mA, flowing the other way round the loop.', why: 'That would be true for a resistor, which works both ways. An LED is a one-way part: backwards, it blocks.' },
            { text: 'Hundreds of mA: the LED burns out.', why: 'Backwards, almost no current flows, so nothing heats up. 5 V is also within what a typical LED can block in reverse (about 5 V).' },
            { text: 'About 0 mA. The LED blocks, and nearly all 5 V sits across it the wrong way round.', correct: true, why: 'An LED only conducts from anode to cathode. Backwards it acts like an open switch, so the whole loop carries nothing, and the supply’s full 5 V appears across the LED.' },
            { text: 'About 3 mA, the same as with 1 kΩ.', why: 'The resistor value doesn’t matter here. Backwards, the LED stops the current whatever resistor you use.' },
          ],
          tryIt: 'Press **Flip the LED** (or click the LED) and watch **Current through the loop** and **Voltage across the LED**. Flip it back afterwards.',
        },
        {
          type: 'callout',
          tone: 'warn',
          title: 'Only in the simulator',
          text: 'The lab has a **No resistor** option so you can see an LED burn out. Never do this with a real LED: it really does die, and it can crack or get hot.',
        },
      ],
    },
  ],
  lab: {
    title: 'Your first LED circuit',
    intro: 'A 5 V supply **V1**, a resistor **R1** and a red LED **D1** in one loop. Predict what each change will do *before* you make it. Click the resistor to step through the safe values, and click the LED to flip it around. The challenges unlock one at a time.',
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
      {
        type: 'choice',
        id: 'resistor',
        label: 'Resistor R1',
        componentId: 'R1',
        prop: 'ohms',
        options: [
          { label: '220 Ω', value: 220 },
          { label: '1 kΩ', value: 1000 },
          { label: '10 kΩ', value: 10000 },
          { label: 'No resistor (0 Ω, sim only)', value: 0, skipOnClick: true },
        ],
      },
      { type: 'flip', id: 'flip', label: 'Flip the LED', componentId: 'D1' },
      {
        type: 'choice',
        id: 'colour',
        label: 'LED colour',
        componentId: 'D1',
        prop: 'color',
        options: [
          { label: 'Red', value: 'red' },
          { label: 'Yellow', value: 'yellow' },
          { label: 'Green', value: 'green' },
          { label: 'Blue', value: 'blue' },
          { label: 'White', value: 'white' },
        ],
      },
    ],
    clickControls: { R1: 'resistor', D1: 'flip' },
    readouts: [
      { componentId: 'D1', quantity: 'current', label: 'Current through the loop' },
      { componentId: 'D1', quantity: 'voltage', label: 'Voltage across the LED' },
      { componentId: 'R1', quantity: 'voltage', label: 'Voltage across R1' },
    ],
    challenges: [
      {
        id: 'light-safely',
        prompt: 'Light the LED **brightly but safely**: between 5 and 20 mA.',
        hint: 'Right now 1 kΩ lets about 3 mA through. Less resistance means more current. Which kit value gets you into the 5–20 mA zone?',
        success: 'With 220 Ω the resistor takes about 3 V and lets about 14 mA through. That is the classic Arduino LED resistor, and now you know why.',
        check: (r) => r.components.D1?.status === 'ok' && between(r.components.D1.current, 5 * mA, 20 * mA),
      },
      {
        id: 'flip-it',
        prompt: 'Put the LED in **backwards**. What happens to the current?',
        hint: 'Click the LED (or use **Flip the LED**). Watch the current meter.',
        success: 'Dark, and the meter reads 0. An LED only conducts from anode to cathode. All 5 V now sits across the LED, pushing the wrong way, and nothing flows. On a real breadboard this is harmless, so it is the first thing to check when an LED won’t light.',
        check: (r) => r.components.D1 !== undefined && r.components.D1.voltage < -1 && Math.abs(r.components.D1.current) < 0.001 * mA,
      },
      {
        id: 'burn-it',
        prompt: 'You’ve seen the safe circuit. It’s a simulator, so now **break it!** Burn the LED out.',
        hint: 'Put the LED the right way round, then choose **No resistor** in the Resistor R1 list. (Clicking R1 skips it on purpose.)',
        success: 'Pop. With no resistor, nothing limits the current: the simulator shows hundreds of mA, far beyond the LED’s 20 mA rating and its roughly 30 mA maximum. A real LED would be dead in a moment. This is exactly why every LED gets a resistor.',
        check: (r) => r.components.D1?.status === 'burnt',
      },
      {
        id: 'blue-led',
        prompt: 'Switch to a **blue** LED and get it glowing between 5 and 20 mA.',
        hint: 'A blue LED takes about 3 V instead of 2 V, which leaves less for the resistor. Try the smallest real resistor.',
        success: 'With 220 Ω a blue LED gets about 9 mA, less than the red one. The blue LED takes about 3 V, so only 2 V is left for the resistor: 2 V ÷ 220 Ω ≈ 9 mA. Different colours, different forward voltages. More on Day 8.',
        check: (r, c) => {
          const led = part(c, 'D1')
          return led?.kind === 'led' && led.color === 'blue' && r.components.D1?.status === 'ok' && between(r.components.D1.current, 5 * mA, 20 * mA)
        },
      },
    ],
  },
  quiz: [
    {
      id: 'v-vs-i',
      type: 'choice',
      prompt: 'What is the difference between voltage and current?',
      options: [
        { text: 'They are the same thing measured in different units.', why: 'No. You can have voltage with no current at all: a battery sitting on a table has 9 V between its terminals but nothing flows until you close a loop.' },
        { text: 'Current is the push; voltage is the flow.', why: 'This is backwards. Voltage is the push (like water pressure) and current is the flow (litres per second).' },
        { text: 'Voltage is the push between two points; current is how much charge flows past a point each second.', correct: true, why: 'Voltage is the cause (pressure), current is the effect (flow). Voltage is always *between* two points; current is measured *at* a point in the loop.' },
        { text: 'Voltage flows through the wires; current stays inside the battery.', why: 'Voltage doesn’t flow anywhere. It is a difference between two points. Current is what flows, all the way round the loop.' },
      ],
    },
    {
      id: 'current-1k',
      type: 'numeric',
      prompt: 'A 5 V supply drives a red LED (Vf = 2 V) through a 1 kΩ resistor. How much current flows, in mA?',
      answer: 3,
      tolerance: 0.05,
      unit: 'mA',
      hint: 'First find the voltage left for the resistor, then use I = V ÷ R.',
      explanation: 'The resistor gets 5 − 2 = 3 V. I = 3 V ÷ 1000 Ω = 0.003 A = **3 mA**. Dimmer than with 220 Ω, but still visible.',
    },
    {
      id: 'resistor-for-10ma',
      type: 'numeric',
      prompt: 'You want 10 mA through a red LED (Vf = 2 V) from a 5 V supply. What resistance do you need, in ohms?',
      answer: 300,
      tolerance: 0.05,
      unit: 'Ω',
      hint: 'R = V ÷ I, where V is the voltage left for the resistor and I is 0.010 A.',
      explanation: 'The resistor gets 5 − 2 = 3 V. R = 3 V ÷ 0.010 A = **300 Ω**. Your kit doesn’t have 300 Ω; tomorrow you’ll learn to pick the nearest safe value (330 Ω).',
    },
    {
      id: 'backwards',
      type: 'choice',
      prompt: 'You put the LED in backwards (long leg to GND). What happens?',
      options: [
        { text: 'It lights the same; LEDs work both ways.', why: 'No. The D in LED stands for *diode*, a one-way part. That one-way behaviour is the whole point of a diode.' },
        { text: 'It stays dark, because an LED only lets current through from anode to cathode.', correct: true, why: 'Backwards, the LED blocks current, so the whole loop carries nothing. Turn it round and it lights.' },
        { text: 'It burns out instantly.', why: 'Not on a 5 V supply. Backwards, almost no current flows, so nothing heats up. (LEDs can be damaged by large reverse voltages, but 5 V is within what a typical LED can block.)' },
        { text: 'It lights a different colour.', why: 'The colour is fixed by the material inside the LED. Reversing it only decides whether current flows.' },
      ],
    },
    {
      id: 'why-resistor',
      type: 'choice',
      prompt: 'Why does an LED need a resistor in series with it?',
      options: [
        { text: 'The resistor makes the LED brighter.', why: 'The opposite: a resistor reduces current, so the LED is dimmer than it would be without it. Without it, though, the LED is brightly dead.' },
        { text: 'The resistor stores energy so the LED doesn’t flicker.', why: 'Resistors don’t store energy; they turn it into heat. (Capacitors store energy; that’s Day 10.)' },
        { text: 'It doesn’t really; the resistor is only there to make the circuit look complete.', why: 'Try the **No resistor** option in the lab. The current jumps to hundreds of mA and the LED burns out.' },
        { text: 'Above its forward voltage an LED’s current rises steeply with almost nothing to stop it, so the resistor sets a safe current.', correct: true, why: 'The LED takes about 2 V; the resistor takes the rest, and Ohm’s law on the resistor fixes the current.' },
      ],
    },
    {
      id: 'resistor-side',
      type: 'choice',
      prompt: 'You move the resistor to the other side of the LED, between the cathode and GND. What changes?',
      options: [
        { text: 'Nothing. In a single loop the same current flows through every part, so the order doesn’t matter.', correct: true, why: 'The current is the same everywhere in one loop. The resistor limits it wherever it sits.' },
        { text: 'The LED burns out, because current reaches it before the resistor can slow it.', why: 'Current doesn’t “arrive” and then get slowed down. The whole loop settles to one current almost instantly, and the resistor sets it wherever it is.' },
        { text: 'The LED gets dimmer, because current is used up by the LED first.', why: 'Current isn’t used up. The same current that goes into the LED comes out of it. What gets “used” is voltage (energy), shared between the parts.' },
        { text: 'The LED won’t light at all.', why: 'It still lights. The loop is still closed and still has the resistor in it.' },
      ],
    },
  ],
  realBuild: {
    parts: [
      'Elegoo Uno and USB cable',
      'Breadboard',
      '1 red LED',
      'Resistors: 220 Ω, 1 kΩ and 10 kΩ',
      '2 jumper wires',
    ],
    steps: [
      BREADBOARD,
      LED_WAY,
      NO_METER,
      'Unplug the Uno from USB while you wire. Make it a habit.',
      UNO_POWER_STEP,
      'Push the LED’s **long leg** (anode) into **e12** and its **short leg** into **e13**: two different columns.',
      'Put the **220 Ω** resistor R1 from **c8** to **c12**. Its right leg shares column 12 with the LED’s long leg.',
      'A **red** jumper from the top **+** rail to **a8**, and a **black** jumper from **a13** to the top **−** rail.',
      'Trace the loop with your finger: + rail → a8 → R1 → column 12 → LED → column 13 → − rail. Plug in USB. The LED lights. No code is needed: the Uno is just acting as a 5 V supply.',
      'Experiments (unplug before each change): flip the LED (long leg in **e13**, short leg in **e12**); swap 220 Ω for 1 kΩ, then 10 kΩ, in the same holes (work out the current first). Compare with what the lab showed you.',
      'Not lighting? Check the LED isn’t backwards, that its legs aren’t in the same column (that shorts it out), and that the Uno’s jumpers are in 5V and GND.',
    ],
    // One entry per step: the breadboard parts that step places or talks about.
    stepParts: [
      [],
      ['D1'],
      [],
      [],
      ['w-5v', 'w-gnd'],
      ['D1'],
      ['R1'],
      ['w-plus', 'w-minus'],
      ['w-plus', 'R1', 'D1', 'w-minus'],
      ['D1', 'R1'],
      ['D1', 'w-5v', 'w-gnd'],
    ],
    safety: [
      'Never connect an LED to 5V and GND **without a resistor**. The burn-out in the lab is real.',
      'Never connect 5V straight to GND with a wire. That is a short circuit; the Uno’s USB fuse will cut out, and you can damage the board or your computer’s port.',
      'Wire with the power unplugged, and check before you plug in.',
    ],
    breadboard: {
      supply: 'uno',
      parts: [
        ...UNO_POWER,
        { kind: 'wire', id: 'w-plus', from: 'T+8', to: 'a8', color: 'red' },
        { kind: 'resistor', id: 'R1', from: 'c8', to: 'c12', ohms: 220 },
        { kind: 'led', id: 'D1', anode: 'e12', cathode: 'e13', color: 'red' },
        { kind: 'wire', id: 'w-minus', from: 'a13', to: 'T-13', color: 'black' },
      ],
    },
  },
}

export default lesson
