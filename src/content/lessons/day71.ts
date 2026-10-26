import type { Circuit } from '../../sim/types'
import type { Lesson } from '../types'
import { between, mA, part } from './checks'
import { BREADBOARD, ESP32_GND_STEP, ESP32_LED_BOARD, LED_WAY, METER_OPTIONAL, METER_VOLTS } from './primer'

const pinVolts = (c: Circuit) => (part(c, 'V1') as { volts: number }).volts
const ledColor = (c: Circuit) => (part(c, 'D1') as { color: string }).color

const lesson: Lesson = {
  id: 'esp32-intro',
  day: 71,
  phase: 6,
  title: 'Meet the ESP32',
  tagline: 'Same Arduino code, WiFi on board, and a 3.3 V world with a few pins you must not touch.',
  minutes: 40,
  objectives: [
    'Identify the ESP32 DevKit V1’s parts and its two headers, and say what each is for',
    'Power the board safely from USB, VIN or 3V3, and say what never goes into each',
    'Choose an LED resistor for a 3.3 V pin and keep the pin under 20 mA',
    'Pick safe GPIOs, and avoid input-only, strapping and ADC2 pins where they bite',
  ],
  sections: [
    {
      id: 'board-tour',
      title: 'Board tour',
      blocks: [
        {
          type: 'text',
          text: 'The **DevKit V1** is a carrier for the ESP32-WROOM-32 module: USB, a regulator, two buttons and two 15-pin headers. You program it from the Arduino IDE like the Uno.',
        },
        {
          type: 'table',
          head: ['Part', 'What it does', 'What to remember'],
          rows: [
            ['Metal-can module', 'The ESP32 chip (2 cores, 240 MHz), 4 MB flash, WiFi and Bluetooth', 'GPIO6–11 run the flash, so the 30-pin board doesn’t expose them'],
            ['PCB antenna', 'The zig-zag trace at the module’s end', 'Keep it clear of metal and your fingers; let it overhang the breadboard'],
            ['USB socket + CP2102/CH340 chip', 'Power and uploads', 'No port appears? Wrong cable (charge-only) or a missing driver'],
            ['AMS1117 regulator', 'USB or VIN 5 V → 3.3 V', 'WiFi bursts draw about 250 mA: weak USB means brownout resets'],
            ['**EN** button', 'Reset', 'Restarts your sketch'],
            ['**BOOT** button', 'Holds GPIO0 low', 'Hold it during `Connecting....` if an upload won’t start'],
            ['Red LED / blue LED', 'Power / GPIO2', 'Blink uses pin **2**'],
          ],
        },
        {
          type: 'table',
          head: ['Header (from the USB end)', 'Pins'],
          rows: [
            ['3V3 side', '**3V3, GND, D15, D2, D4, RX2, TX2, D5, D18, D19, D21, RX0, TX0, D22, D23**'],
            ['VIN side', '**VIN, GND, D13, D12, D14, D27, D26, D25, D33, D32, D35, D34, VN, VP, EN**'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: 'It doesn’t fit one breadboard',
          text: 'On a half-size board the DevKit covers all but one row on each side. Use two breadboards side by side with the gap under the module, or leave the board off and use male-to-female jumpers (what today’s build does).',
        },
      ],
    },
    {
      id: 'three-volt-logic',
      title: '3.3 V logic',
      blocks: [
        {
          type: 'text',
          text: 'A HIGH pin is **3.3 V**, not 5 V. Inputs read HIGH above about 2.5 V and LOW below about 0.8 V, and nothing may go above **3.6 V**. Each pin should source **20 mA** or less (about 40 mA absolute maximum).',
        },
        { type: 'formula', expr: 'R = (3.3 V − Vf) ÷ I', caption: 'The LED resistor rule, with 3.3 V in place of 5 V.' },
        {
          type: 'walkthrough',
          title: 'A red LED on GPIO23 at 10 mA',
          steps: [
            { text: 'GPIO23 HIGH is a 3.3 V source.', highlight: ['V1'] },
            { text: 'The red LED keeps about 2 V.', highlight: ['D1'] },
            { text: 'R1 gets the rest.', math: '3.3 V − 2 V = 1.3 V', highlight: ['R1'] },
            { text: 'Size R1 for 10 mA. 100 Ω (13 mA) and 220 Ω (6 mA) bracket it; both are fine for a pin.', math: 'R = 1.3 V ÷ 0.010 A = 130 Ω', highlight: ['R1'] },
          ],
        },
        {
          type: 'predict',
          id: 'esp32-headroom',
          prompt: 'On the Uno’s 5 V, a red LED with 1 kΩ gets about 3 mA. The lab starts with the same LED and 1 kΩ on an ESP32 pin. What does the meter show?',
          options: [
            { text: 'About 2 mA: 3.3 V is two-thirds of 5 V, so two-thirds of the current.', why: 'That would be true for a resistor alone. The LED still takes its 2 V, so R1 loses far more than a third of its voltage.' },
            { text: 'About 1.5 mA: less than half.', correct: true, why: 'R1 sees 1.3 V instead of 3 V, so the current drops to under half. Uno resistor values make dim LEDs on an ESP32.' },
            { text: 'About 3 mA: the resistor sets the current, not the supply.', why: 'The resistor sets the current *from the voltage left across it*, and that voltage fell from 3 V to 1.3 V.' },
          ],
          tryIt: 'Read **Current from the pin**, then set **Pin voltage** to **Uno HIGH (5 V)** and back to compare. (The simulator says about 1.5 mA and 3.2 mA.)',
        },
        {
          type: 'predict',
          id: 'esp32-blue',
          prompt: 'Swap to a blue LED (Vf about 3 V) with R1 = 100 Ω on the 3.3 V pin. What happens?',
          options: [
            { text: 'Nothing: a blue LED needs 5 V.', why: '3.3 V is above its 3 V forward voltage, so it does conduct, just not much.' },
            { text: 'About 13 mA, the same as the red one.', why: 'Only 0.3 V is left for R1 instead of 1.3 V, so the current is about a quarter.' },
            { text: 'It glows dimly, about 3 mA.', correct: true, why: '0.3 V ÷ 100 Ω = 3 mA. A real blue LED with Vf = 3.2 V would get only 1 mA, so blue and white LEDs on 3.3 V are dim and vary a lot.' },
          ],
          tryIt: 'Set **Resistor R1** to **100 Ω** and **LED colour** to **Blue** (the simulator says about 3.6 mA).',
        },
      ],
    },
    {
      id: 'powering',
      title: 'Powering it: USB, VIN or 3V3',
      blocks: [
        {
          type: 'table',
          head: ['Input', 'Give it', 'Notes'],
          rows: [
            ['Micro-USB', '5 V from a computer, charger or power bank', 'The easy default. VIN then *outputs* about 4.5–5 V for 5 V modules.'],
            ['**VIN** pin', 'A regulated **5 V**', 'Goes through the onboard regulator. Higher voltages make it overheat (WiFi draws 250 mA peaks).'],
            ['**3V3** pin', 'A clean, regulated **3.3 V** only, with USB unplugged', 'Bypasses the regulator. Mostly you use 3V3 as an *output* for 3.3 V sensors.'],
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: 'Never 5 V into 3V3 or a GPIO',
          text: '5 V on the 3V3 pin or any GPIO damages the chip, sometimes slowly. 5 V signals go through a divider or level shifter first (tomorrow’s lesson). Use one power source at a time, and always join grounds with any module that has its own supply.',
        },
      ],
    },
    {
      id: 'pins',
      title: 'Pins to use, pins to avoid',
      blocks: [
        {
          type: 'table',
          head: ['Pins', 'Use them for', 'Watch out'],
          rows: [
            ['**D18, D19, D21, D22, D23**', 'Your first choice for outputs and inputs', 'D21/D22 are the default I2C pins'],
            ['D4, D5, D13, D14, D25–D27, D32, D33, RX2, TX2', 'General I/O', 'D4, D13, D14, D25–D27 are ADC2: no analog reads while WiFi is on'],
            ['**D34, D35, VP (36), VN (39)**', 'Inputs only, good for analog (ADC1)', 'No output, no internal pull-ups'],
            ['**D0 (BOOT), D2, D12, D15**', 'Last resort', 'Strapping pins: read at power-up. D12 pulled high = won’t boot; D2 pulled high = won’t enter upload mode'],
            ['TX0, RX0 (GPIO1, 3)', 'Nothing', 'The USB serial line for uploads and the Serial Monitor'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: 'Analog on an ESP32',
          text: 'Read sensors on **D32–D35, VP or VN** (ADC1). The ADC is 12-bit (0–4095) and noticeably non-linear near 0 V and 3.3 V, so don’t expect the Uno’s straight line.',
        },
      ],
    },
  ],
  lab: {
    title: 'A GPIO drives an LED',
    intro: 'V1 is **GPIO23**: 3.3 V when HIGH. Pick R1 so the red LED is bright but the pin stays inside its 20 mA guideline, then see why blue LEDs struggle at 3.3 V and why Uno values don’t carry over.',
    circuit: {
      ground: 'gnd',
      components: [
        { kind: 'vsource', id: 'V1', pos: 'pin', neg: 'gnd', volts: 3.3 },
        { kind: 'resistor', id: 'R1', a: 'pin', b: 'a', ohms: 1000 },
        { kind: 'led', id: 'D1', anode: 'a', cathode: 'gnd', color: 'red' },
      ],
    },
    layout: {
      width: 14,
      height: 9,
      parts: [
        { id: 'V1', from: { x: 2, y: 3 }, to: { x: 2, y: 6 }, label: 'V1 (GPIO23)', labelSide: 'left' },
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
        id: 'pin',
        label: 'Pin voltage',
        componentId: 'V1',
        prop: 'volts',
        options: [
          { label: 'ESP32 HIGH (3.3 V)', value: 3.3 },
          { label: 'Uno HIGH (5 V)', value: 5 },
          { label: 'LOW (0 V)', value: 0 },
        ],
      },
      {
        type: 'choice',
        id: 'r1',
        label: 'Resistor R1',
        componentId: 'R1',
        prop: 'ohms',
        options: [
          { label: '10 Ω (too small, sim only)', value: 10, skipOnClick: true },
          { label: '100 Ω', value: 100 },
          { label: '220 Ω', value: 220 },
          { label: '330 Ω', value: 330 },
          { label: '1 kΩ', value: 1000 },
        ],
      },
      {
        type: 'choice',
        id: 'colour',
        label: 'LED colour',
        componentId: 'D1',
        prop: 'color',
        options: [
          { label: 'Red', value: 'red' },
          { label: 'Green', value: 'green' },
          { label: 'Blue', value: 'blue' },
        ],
      },
    ],
    clickControls: { V1: 'pin', R1: 'r1' },
    readouts: [
      { componentId: 'D1', quantity: 'current', label: 'Current from the pin' },
      { componentId: 'D1', quantity: 'voltage', label: 'Voltage across the LED' },
      { componentId: 'R1', quantity: 'voltage', label: 'Voltage across R1' },
    ],
    challenges: [
      {
        id: 'gpio-red',
        prompt: 'On the ESP32 pin (3.3 V), light the **red** LED at **5–15 mA**: bright, and well inside the 20 mA pin guideline.',
        hint: '1 kΩ gives only about 1.5 mA. You need roughly 100–220 Ω: R = 1.3 V ÷ I.',
        success: '100 Ω gives about 13 mA, 220 Ω about 6 mA. For an ESP32 LED, think 100–150 Ω, not the Uno’s 220 Ω.',
        check: (r, c) => pinVolts(c) === 3.3 && ledColor(c) === 'red' && r.components.D1?.status === 'ok' && between(r.components.D1.current, 5 * mA, 15 * mA),
      },
      {
        id: 'blue-3v3',
        prompt: 'Still on 3.3 V: get a **blue** LED to at least **3 mA** without going over 15 mA.',
        hint: 'Only about 0.3 V is left for R1. It has to be small.',
        success: '100 Ω gives about 3.6 mA here. On the bench, blue LEDs with a slightly higher Vf will be dimmer still; for a bright blue indicator on an ESP32, switch it with a transistor from 5 V.',
        check: (r, c) => pinVolts(c) === 3.3 && ledColor(c) === 'blue' && r.components.D1?.status === 'ok' && between(r.components.D1.current, 3 * mA, 15 * mA),
      },
      {
        id: 'uno-red',
        prompt: 'Move the **red** LED to the Uno’s 5 V and pick the **smallest** kit resistor that keeps it under 15 mA.',
        hint: '100 Ω was fine on 3.3 V. Check it on 5 V first.',
        success: '220 Ω, about 14 mA. 100 Ω would give about 29 mA: the 3.3 V value is too small on 5 V. Resistor values don’t carry over between boards.',
        check: (r, c) => pinVolts(c) === 5 && ledColor(c) === 'red' && (part(c, 'R1') as { ohms: number }).ohms === 220 && r.components.D1?.status === 'ok',
      },
    ],
  },
  quiz: [
    {
      id: 'r-red-3v3',
      type: 'numeric',
      prompt: 'What resistor gives a red LED (Vf = 2 V) 10 mA from a 3.3 V ESP32 pin? Answer in ohms.',
      answer: 130,
      tolerance: 0.03,
      unit: 'Ω',
      hint: 'R = (3.3 V − Vf) ÷ I, with I = 0.010 A.',
      explanation: 'R = 1.3 V ÷ 0.010 A = **130 Ω**. With kit values, 100 Ω (13 mA) or 220 Ω (6 mA).',
    },
    {
      id: 'blue-3v3-100',
      type: 'numeric',
      prompt: 'A blue LED (Vf = 3 V) on a 3.3 V pin with 100 Ω. How much current flows, in mA?',
      answer: 3,
      tolerance: 0.05,
      unit: 'mA',
      hint: 'The resistor gets 3.3 V − 3 V.',
      explanation: 'I = 0.3 V ÷ 100 Ω = 0.003 A = **3 mA**. Dim, and very sensitive to the LED’s exact Vf.',
    },
    {
      id: 'input-only',
      type: 'choice',
      prompt: 'You wire an LED and resistor to **D34** and call `digitalWrite(34, HIGH)`. What happens?',
      options: [
        { text: 'It lights, but dimly.', why: 'D34 can’t drive anything: it has no output driver at all.' },
        { text: 'Nothing: GPIO34–39 are input-only.', correct: true, why: 'D34, D35, VP and VN have no output stage (and no internal pull-ups). Move the LED to an output such as D23.' },
        { text: 'The board resets.', why: 'Nothing is shorted, so there’s no reset; the pin simply never drives.' },
      ],
    },
    {
      id: 'strap-12',
      type: 'choice',
      prompt: 'You add a 10 kΩ pull-up from 3V3 to **D12**, and now the board won’t start. Why?',
      options: [
        { text: 'D12 is input-only.', why: 'D12 is a normal I/O pin; input-only are 34–39.' },
        { text: '10 kΩ draws too much current.', why: '3.3 V ÷ 10 kΩ = 0.33 mA, which is nothing.' },
        { text: 'D12 is a strapping pin: HIGH at power-up selects 1.8 V flash, and the chip can’t read its program.', correct: true, why: 'GPIO12 sets the flash voltage at boot. Move the pull-up to a non-strapping pin, such as D19.' },
      ],
    },
    {
      id: 'adc2-wifi',
      type: 'choice',
      prompt: 'A potentiometer on **D4** reads fine until your sketch connects to WiFi, then `analogRead` stops working. What’s the fix?',
      options: [
        { text: 'Move the wiper to an ADC1 pin such as D32.', correct: true, why: 'D4 is on ADC2, which the WiFi radio takes over. ADC1 (GPIO32–39) always works.' },
        { text: 'Feed the potentiometer from 5 V for a stronger signal.', why: '5 V on an ESP32 pin is over its 3.6 V limit, and it wouldn’t fix the ADC2 conflict.' },
        { text: 'Add a delay before each `analogRead`.', why: 'Timing doesn’t help: ADC2 is unavailable whenever WiFi is on.' },
      ],
    },
    {
      id: 'power-bank',
      type: 'choice',
      prompt: 'You want to run the board from a 5 V USB power bank with bare wires instead of a cable. Where do the wires go?',
      options: [
        { text: '+ to **3V3**, − to GND.', why: '5 V on the 3V3 pin bypasses the regulator and over-volts the chip.' },
        { text: '+ to **VIN**, − to GND.', correct: true, why: 'VIN feeds the onboard 3.3 V regulator, which expects about 5 V. (Plugging the power bank into the USB socket does the same.)' },
        { text: '+ to any GPIO, − to GND.', why: 'A GPIO is a signal pin with a 3.6 V limit, not a power input.' },
      ],
    },
  ],
  realBuild: {
    parts: [
      'ESP32 DevKit V1 (30-pin): not in the Elegoo Uno kit, buy (~$6–10)',
      'Micro-USB data cable',
      'Breadboard, male-to-male and male-to-female jumper wires',
      '1 red LED (and a blue one to compare)',
      'Resistors: 100 Ω and 220 Ω',
      'Digital multimeter (optional)',
    ],
    steps: [
      BREADBOARD,
      LED_WAY,
      METER_OPTIONAL,
      METER_VOLTS,
      'Set up the IDE once: add Espressif’s boards URL in **Preferences**, install **esp32 by Espressif Systems** in the Boards Manager, and pick **ESP32 Dev Module** and the port that appears when you plug in. No port? Try another cable, then install the **CP210x** or **CH340** driver.',
      'Check the bare board: upload **Blink** with `LED_BUILTIN` changed to `2`. The blue on-board LED blinks. Stuck at `Connecting....`? Hold **BOOT** until the upload percentage starts.',
      'Unplug USB. ' + ESP32_GND_STEP,
      'R1 (220 Ω) from **c8** to **c12**; the LED’s long leg in **e12** and short leg in **e13**; a black jumper from **a13** to the top **−** rail.',
      'A **yellow** jumper from **D23** to **a8**. GPIO23 now drives the loop.',
      'Upload a sketch with `pinMode(23, OUTPUT);` and `digitalWrite(23, HIGH);` in `setup()` and an empty `loop()`. The LED lights, dimmer than on the Uno with the same resistor: about 6 mA by hand (1.3 V ÷ 220 Ω).',
      'Meter on DC volts, black probe on the **−** rail. Red on **a8**: a little under 3.3 V (a loaded pin sags slightly). Red on **c12**’s leg: about 1.9 V, the LED’s share.',
      'Unplug, swap R1 for **100 Ω** in the same holes, and plug in: brighter, about 13 mA, still under the 20 mA guideline. Then try the blue LED with 100 Ω: dim, and it varies from one LED to the next.',
    ],
    stepParts: [
      [],
      ['D1'],
      [],
      [],
      [],
      [],
      ['w-gnd'],
      ['R1', 'D1', 'w-minus'],
      ['w-gpio'],
      ['w-gpio', 'R1', 'D1'],
      ['w-gpio', 'D1'],
      ['R1', 'D1'],
    ],
    safety: [
      'Never connect 5 V (the Uno’s 5V, the ESP32’s VIN, a 5 V module output) to a GPIO or the 3V3 pin.',
      'Keep each pin under 20 mA: an LED always gets a resistor, and motors, relays and servos never go straight on a pin.',
      'Wire with USB unplugged, and check every jumper before plugging in.',
    ],
    breadboard: ESP32_LED_BOARD,
  },
}

export default lesson
