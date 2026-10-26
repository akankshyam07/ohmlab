import type { Circuit } from '../../sim/types'
import type { Lesson } from '../types'
import { between, mA, part } from './checks'
import { BREADBOARD, ESP32_GND, ESP32_GND_STEP, METER_NEEDED, METER_VOLTS } from './primer'

const ohms = (c: Circuit, id: string) => (part(c, id) as { ohms: number }).ohms
/** The pin reads a safe, solid HIGH: under the 3.3 V supply and well clear of the 2.5 V threshold. */
const safeHigh = (v: number | undefined) => between(v, 2.8, 3.3)

const kOhm = (k: number) => ({ label: `${k} kΩ`, value: k * 1000 })

const lesson: Lesson = {
  id: 'level-shifting',
  day: 72,
  phase: 6,
  title: '3.3 V ↔ 5 V: level shifting',
  tagline: 'A 5 V sensor’s HIGH can quietly kill an ESP32 pin. Two or three resistors fix it.',
  minutes: 40,
  objectives: [
    'Explain why a 5 V signal damages a 3.3 V input, and when 3.3 V → 5 V works without help',
    'Design a resistor divider that brings a 5 V signal to a safe, readable HIGH',
    'Wire an HC-SR04 to an ESP32 safely, measuring the divider before connecting the pin',
    'Choose between a divider, a buffer chip and a bidirectional shifter for a given signal',
  ],
  sections: [
    {
      id: 'why-shift',
      title: 'Why 5 V hurts a 3.3 V pin',
      blocks: [
        {
          type: 'text',
          text: 'Every ESP32 pin has a protection diode to its 3.3 V rail. Above about 3.6 V that diode conducts, and current pours from your 5 V signal into the chip’s supply. It often “works” for a while; then the pin, or the chip, dies.',
        },
        {
          type: 'table',
          head: ['Board', 'Output HIGH', 'Reads HIGH above', 'Reads LOW below', 'Never more than'],
          rows: [
            ['ESP32 (3.3 V)', '3.3 V', 'about 2.5 V', 'about 0.8 V', '**3.6 V**'],
            ['Uno (5 V)', '5 V', 'about 3.0 V', 'about 1.5 V', '5.5 V'],
          ],
        },
        {
          type: 'text',
          text: 'So **5 V → ESP32** always needs shifting down. **ESP32 → Uno** usually works as it is: 3.3 V is above the Uno’s 3.0 V threshold, though with only 0.3 V to spare.',
        },
      ],
    },
    {
      id: 'divider-down',
      title: '5 V → 3.3 V with a divider',
      blocks: [
        {
          type: 'formula',
          expr: 'Vpin = 5 V × R2 ÷ (R1 + R3 + R2)',
          caption: 'The Day 6 divider. R1 and R3 are both on top; R3 is an optional small “trim” resistor.',
        },
        {
          type: 'walkthrough',
          title: 'HC-SR04 ECHO into D18',
          steps: [
            { text: 'ECHO is HIGH: a 5 V source.', highlight: ['V1'] },
            { text: 'The textbook pair: R1 = 1 kΩ on top, R2 = 2 kΩ on the bottom, no trim.', math: '5 V × 2 ÷ 3 ≈ 3.33 V', highlight: ['R1', 'R2'] },
            { text: '3.33 V is inside the 3.6 V limit, so many tutorials stop here. But it is above the 3.3 V supply. A 220 Ω trim on top pulls it under.', math: '5 V × 2 ÷ 3.22 ≈ 3.11 V', highlight: ['R3'] },
            { text: 'The divider also loads ECHO. Scale everything up about 5× and the current falls 5×, with the same ratio.', math: '5.1 kΩ + 220 Ω over 10 kΩ → 3.26 V, 0.33 mA', highlight: ['R1', 'R3', 'R2'] },
          ],
        },
        {
          type: 'predict',
          id: 'shift-textbook',
          prompt: 'The lab starts with ECHO wired straight to D18. You put R1 = 1 kΩ on top and keep R2 = 2 kΩ on the bottom. What does the pin see?',
          options: [
            { text: 'About 2.5 V.', why: 'That’s equal resistors. Here R2 is twice R1, so the pin gets two-thirds of 5 V.' },
            { text: 'About 1.67 V.', why: 'That’s the divider upside down (the 2 kΩ on top). The output is across the **bottom** resistor.' },
            { text: 'About 3.33 V.', correct: true, why: '5 V × 2 kΩ ÷ 3 kΩ. Safe for the chip (under 3.6 V) but a hair above its 3.3 V supply.' },
          ],
          tryIt: 'Set **R1 (top)** to **1 kΩ** (leave **R3 (trim, top)** at None) and read **Voltage at D18**.',
        },
        {
          type: 'predict',
          id: 'shift-scale-up',
          prompt: 'You replace the divider with 5.1 kΩ + 220 Ω over 10 kΩ, about 5× bigger. What changes most?',
          options: [
            { text: 'The pin voltage drops by about 5×.', why: 'Only the ratio sets the voltage, and the ratio barely changed (3.26 V vs 3.11 V).' },
            { text: 'The current from ECHO drops by about 5×; the pin voltage hardly moves.', correct: true, why: 'Same ratio, five times the resistance: 0.33 mA instead of 1.55 mA. The sensor’s output works less hard.' },
            { text: 'Nothing: resistor size never matters.', why: 'Size sets the current. Too small loads the sensor; very large values (100 kΩ+) pick up noise and slow the edges.' },
          ],
          tryIt: 'Set **R1 (top)** to **5.1 kΩ**, **R3 (trim, top)** to **220 Ω** and **R2 (bottom)** to **10 kΩ**, and watch **Current from ECHO**.',
        },
        {
          type: 'callout',
          tone: 'tip',
          title: 'Measure before you connect',
          text: 'Build the divider, feed its top from a steady 5 V (the ESP32’s VIN on USB), and measure the output. Only connect the GPIO once the meter says 3.3 V or less.',
        },
      ],
    },
    {
      id: 'other-directions',
      title: '3.3 V → 5 V, and both ways',
      blocks: [
        {
          type: 'table',
          head: ['Signal', 'Use', 'Why'],
          rows: [
            ['5 V output → ESP32 input, slow (ECHO, a 5 V button)', 'Resistor divider', 'Cheap, one direction, fine up to tens of kHz'],
            ['ESP32 output → Uno or 5 V module input', 'Usually a direct wire', '3.3 V is above most 5 V inputs’ 3.0 V threshold'],
            ['ESP32 → 5 V input that needs about 3.5 V (WS2812 LED strips)', '**74AHCT125** buffer on 5 V', 'Reads 3.3 V as HIGH and outputs a full 5 V, fast'],
            ['I2C between 3.3 V and 5 V devices', '**Bidirectional MOSFET shifter** (BSS138 module)', 'Both sides drive the same wire, so a divider can’t work'],
          ],
        },
      ],
    },
  ],
  lab: {
    title: 'ECHO into an ESP32 pin',
    intro: 'V1 is the HC-SR04’s **ECHO** at its 5 V HIGH. R1 and an optional trim **R3** sit on top, R2 on the bottom, and the probe **D18** is the ESP32 pin. It starts wired straight through: 5 V on a 3.3 V pin.',
    circuit: {
      ground: 'gnd',
      components: [
        { kind: 'vsource', id: 'V1', pos: 'echo', neg: 'gnd', volts: 5 },
        { kind: 'resistor', id: 'R1', a: 'echo', b: 'top', ohms: 0 },
        { kind: 'resistor', id: 'R3', a: 'top', b: 'pin', ohms: 0 },
        { kind: 'resistor', id: 'R2', a: 'pin', b: 'gnd', ohms: 2000 },
      ],
    },
    layout: {
      width: 16,
      height: 9,
      parts: [
        { id: 'V1', from: { x: 2, y: 3 }, to: { x: 2, y: 6 }, label: 'V1 (ECHO)', labelSide: 'left' },
        { id: 'R1', from: { x: 4, y: 1 }, to: { x: 7, y: 1 }, label: 'R1', labelSide: 'above' },
        { id: 'R3', from: { x: 9, y: 1 }, to: { x: 12, y: 1 }, label: 'R3', labelSide: 'below' },
        { id: 'R2', from: { x: 14, y: 3 }, to: { x: 14, y: 6 }, label: 'R2', labelSide: 'right' },
      ],
      wires: [
        { id: 'w-v1-r1', points: [{ x: 2, y: 3 }, { x: 2, y: 1 }, { x: 4, y: 1 }], carries: { componentId: 'R1', sign: 1 } },
        { id: 'w-r1-r3', points: [{ x: 7, y: 1 }, { x: 9, y: 1 }], carries: { componentId: 'R1', sign: 1 } },
        { id: 'w-r3-r2', points: [{ x: 12, y: 1 }, { x: 14, y: 1 }, { x: 14, y: 3 }], carries: { componentId: 'R2', sign: 1 } },
        { id: 'w-r2-gnd', points: [{ x: 14, y: 6 }, { x: 14, y: 8 }, { x: 2, y: 8 }, { x: 2, y: 6 }], carries: { componentId: 'R2', sign: 1 } },
      ],
      probes: [{ node: 'pin', at: { x: 14, y: 2 }, label: 'D18' }],
    },
    controls: [
      {
        type: 'choice',
        id: 'r1',
        label: 'R1 (top)',
        componentId: 'R1',
        prop: 'ohms',
        options: [{ label: 'None (wired straight)', value: 0 }, kOhm(1), kOhm(2), kOhm(5.1), kOhm(10)],
      },
      {
        type: 'choice',
        id: 'r3',
        label: 'R3 (trim, top)',
        componentId: 'R3',
        prop: 'ohms',
        options: [
          { label: 'None (jumper)', value: 0 },
          { label: '220 Ω', value: 220 },
          { label: '330 Ω', value: 330 },
          kOhm(1),
        ],
      },
      { type: 'choice', id: 'r2', label: 'R2 (bottom)', componentId: 'R2', prop: 'ohms', options: [kOhm(1), kOhm(2), kOhm(5.1), kOhm(10)] },
    ],
    clickControls: { R1: 'r1', R3: 'r3', R2: 'r2' },
    readouts: [
      { componentId: 'R2', quantity: 'voltage', label: 'Voltage at D18' },
      { componentId: 'R1', quantity: 'current', label: 'Current from ECHO' },
    ],
    challenges: [
      {
        id: 'textbook-pair',
        prompt: 'Build the textbook divider: **R1 = 1 kΩ** on top, **R2 = 2 kΩ** on the bottom, no trim. Read the pin.',
        hint: 'Set R1 (top) to 1 kΩ; R3 stays at None and R2 at 2 kΩ.',
        success: '3.33 V: under the chip’s 3.6 V limit, so this pair is everywhere online. It is still a hair above 3.3 V. Next, pull it under.',
        check: (_r, c) => ohms(c, 'R1') === 1000 && ohms(c, 'R3') === 0 && ohms(c, 'R2') === 2000,
      },
      {
        id: 'under-3v3',
        prompt: 'Get the pin to **2.8–3.3 V**: under the supply, and well above the 2.5 V HIGH threshold.',
        hint: 'Keep 1 kΩ over 2 kΩ and add a small trim resistor on top.',
        success: 'A 220 Ω trim gives about 3.11 V, 330 Ω about 3.01 V. Real projects use 1.8 kΩ over 3.3 kΩ or 10 kΩ over 20 kΩ; the trim is how you get there from kit values.',
        check: (r) => safeHigh(r.nodeVoltages.pin),
      },
      {
        id: 'light-load',
        prompt: 'Same 2.8–3.3 V window, but draw **no more than 0.5 mA** from ECHO.',
        hint: 'Same ratio, bigger resistors. Try 10 kΩ on the bottom.',
        success: '5.1 kΩ + 220 Ω over 10 kΩ: about 3.26 V for 0.33 mA. The sensor barely notices the divider, and the edges are still fast enough for distance timing.',
        check: (r) => safeHigh(r.nodeVoltages.pin) && r.components.R1 !== undefined && r.components.R1.current <= 0.5 * mA,
      },
    ],
  },
  quiz: [
    {
      id: 'textbook-v',
      type: 'numeric',
      prompt: 'A 5 V ECHO signal goes through a 1 kΩ (top) / 2 kΩ (bottom) divider. What voltage reaches the ESP32 pin, in volts?',
      answer: 3.33,
      tolerance: 0.02,
      unit: 'V',
      hint: 'Vpin = 5 V × R2 ÷ (R1 + R2).',
      explanation: '5 V × 2 kΩ ÷ 3 kΩ = **3.33 V**. Inside the 3.6 V limit, a hair above 3.3 V.',
    },
    {
      id: 'echo-current',
      type: 'numeric',
      prompt: 'The divider is 5.1 kΩ + 220 Ω on top and 10 kΩ on the bottom, with ECHO at 5 V. How much current does ECHO supply, in mA?',
      answer: 0.326,
      tolerance: 0.03,
      unit: 'mA',
      hint: 'All three resistors are in series: I = 5 V ÷ total.',
      explanation: 'Total = 15.32 kΩ. I = 5 V ÷ 15.32 kΩ ≈ **0.33 mA**.',
    },
    {
      id: 'why-not-direct',
      type: 'choice',
      prompt: 'ECHO wired straight to D18 reads distances fine for a week. Why is it still wrong?',
      options: [
        { text: 'It isn’t: if it reads, it’s safe.', why: 'The pin reads because the protection diode clamps it, and that clamping is what wears the pin out.' },
        { text: 'Above about 3.6 V the pin’s protection diode conducts and pushes current into the 3.3 V rail; pins fail after a while.', correct: true, why: 'The damage is cumulative and silent. A divider costs two resistors.' },
        { text: 'It slows the WiFi down.', why: 'The radio isn’t involved; the risk is to the pin and the chip.' },
      ],
    },
    {
      id: 'uno-reads-3v3',
      type: 'choice',
      prompt: 'An ESP32 output (3.3 V HIGH) goes straight to an Uno input. Does the Uno read HIGH?',
      options: [
        { text: 'Usually yes: 3.3 V is above the Uno’s 3.0 V threshold, with a small margin.', correct: true, why: 'Going up is safe (3.3 V can’t over-volt a 5 V input). Only fussy 5 V inputs, such as WS2812 LED strips, need a buffer.' },
        { text: 'No, it needs a divider.', why: 'A divider only makes the voltage smaller; that would make the 3.3 V signal worse.' },
        { text: 'No, it damages the Uno.', why: '3.3 V is well inside the Uno’s 0–5 V input range.' },
      ],
    },
    {
      id: 'divider-i2c',
      type: 'choice',
      prompt: 'Can you shift an I2C bus between a 5 V and a 3.3 V device with a resistor divider?',
      options: [
        { text: 'Yes, one divider per wire.', why: 'A divider works in one direction only. On I2C both devices pull the same wires low.' },
        { text: 'Yes, but only on SDA.', why: 'Both SDA and SCL can be driven from either side (clock stretching), and neither works through a divider.' },
        { text: 'No: I2C is two-way, so use a bidirectional MOSFET shifter.', correct: true, why: 'A BSS138-style module passes lows in both directions and gives each side its own pull-up voltage.' },
      ],
    },
    {
      id: 'measure-first',
      type: 'choice',
      prompt: 'You’ve built the divider. What do you do before connecting its output to the ESP32?',
      options: [
        { text: 'Feed its top from a steady 5 V and measure the output: 3.3 V or less.', correct: true, why: 'A misread colour code (5.1 kΩ vs 510 Ω) is easy. The meter catches it before the pin does.' },
        { text: 'Nothing; the formula guarantees it.', why: 'The formula is only as good as the resistors you actually pushed in.' },
        { text: 'Add a 5 V pull-up to the pin.', why: 'That would put 5 V on the pin, which is the thing you’re avoiding.' },
      ],
    },
  ],
  realBuild: {
    parts: [
      'ESP32 DevKit V1 (30-pin): not in the Elegoo Uno kit, buy (~$6–10)',
      'HC-SR04 ultrasonic sensor (in the kit)',
      'Resistors: 5.1 kΩ, 10 kΩ and 220 Ω (and 1 kΩ, 2 kΩ for the textbook pair)',
      'Breadboard, male-to-male and male-to-female jumper wires',
      'Digital multimeter (needed today)',
    ],
    steps: [
      BREADBOARD,
      METER_NEEDED,
      METER_VOLTS,
      '**About the diagram:** it shows the board after step 9, with a red jumper from **VIN** standing in for ECHO. You measure at step 8, before D18 is connected, and step 10 swaps in the real sensor.',
      'Unplug USB. ' + ESP32_GND_STEP,
      'R1 (5.1 kΩ) from **c4** to **c8**, R3 (220 Ω) from **d8** to **d12**, and R2 (10 kΩ) from **c12** to **c16**, with a black jumper from **a16** to the top **−** rail. Column 12 is the output for D18.',
      'The stand-in for ECHO: a **red** jumper from the ESP32’s **VIN** pin to **a4**. On USB, VIN carries about 4.5–5 V, like ECHO when it’s HIGH.',
      'Plug in USB. Meter on DC volts, black on the **−** rail, red on a leg in column 12: about 3.0–3.3 V. More than 3.3 V? Unplug and check the colour codes before going on.',
      'Unplug. A **yellow** jumper from **a12** to **D18**.',
      'Swap in the sensor, still unplugged: pull the VIN jumper out of **a4**, then wire the HC-SR04’s **VCC** to **VIN**, **GND** to the − rail, **TRIG** to **D19**, and **ECHO** to **a4**.',
      'Upload a test: `pinMode(19, OUTPUT)` and `Serial.begin(115200)` in `setup()`; in `loop()`, `digitalWrite(19, HIGH); delayMicroseconds(10); digitalWrite(19, LOW);` then `long us = pulseIn(18, HIGH, 30000);`, `Serial.println(us / 58.0);` (cm) and `delay(100);`. Open the Serial Monitor at 115200 and move your hand.',
      'Always 0? No echo arrived in 30 ms: check that VCC is on VIN (5 V, not 3V3), TRIG is on D19 and the sensor faces something hard within 2 m.',
    ],
    stepParts: [
      [],
      [],
      [],
      ['w-echo', 'w-pin'],
      ['w-gnd'],
      ['R1', 'R3', 'R2', 'w-r2-gnd'],
      ['w-echo'],
      ['R3', 'R2'],
      ['w-pin'],
      ['w-echo'],
      ['w-pin'],
      [],
    ],
    safety: [
      'ECHO and VIN are 5 V: neither may touch a GPIO or the 3V3 pin. Only column 12, after the divider, goes to D18.',
      'Measure the divider’s output before you connect it to the ESP32.',
      'Wire with USB unplugged.',
    ],
    // The drawing is the divider test: VIN standing in for ECHO, 5.1 kΩ + 220 Ω over 10 kΩ, output to D18.
    breadboard: {
      supply: 'esp32',
      parts: [
        ESP32_GND,
        { kind: 'wire', id: 'w-echo', from: 'esp32:VIN', to: 'a4', color: 'red' },
        { kind: 'resistor', id: 'R1', from: 'c4', to: 'c8', ohms: 5100 },
        { kind: 'resistor', id: 'R3', from: 'd8', to: 'd12', ohms: 220 },
        { kind: 'resistor', id: 'R2', from: 'c12', to: 'c16', ohms: 10000 },
        { kind: 'wire', id: 'w-r2-gnd', from: 'a16', to: 'T-16', color: 'black' },
        { kind: 'wire', id: 'w-pin', from: 'a12', to: 'esp32:GPIO18', color: 'yellow' },
      ],
    },
  },
}

export default lesson
