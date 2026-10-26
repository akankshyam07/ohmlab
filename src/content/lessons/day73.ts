import type { Circuit } from '../../sim/types'
import type { Lesson } from '../types'
import { between, mA, part } from './checks'
import { BREADBOARD, ESP32_GND_STEP, ESP32_LED_BOARD, LED_WAY, NO_METER } from './primer'

const isHigh = (c: Circuit) => (part(c, 'V1') as { volts: number }).volts > 0
const ledColor = (c: Circuit) => (part(c, 'D1') as { color: string }).color

const SKETCH = [
  '#include <WiFi.h>',
  '#include <WebServer.h>',
  '',
  'const char SSID[] = "your-wifi";',
  'const char PASS[] = "your-password";',
  'const int LED_PIN = 23;',
  'bool ledOn = false;',
  '',
  'WebServer server(80);',
  '',
  'void sendPage() {',
  '  String page = "<h1>LED is ";',
  '  page += ledOn ? "ON" : "OFF";',
  "  page += \"</h1><a href='/on'>ON</a> <a href='/off'>OFF</a>\";",
  '  server.send(200, "text/html", page);',
  '}',
  '',
  'void setup() {',
  '  pinMode(LED_PIN, OUTPUT);',
  '  Serial.begin(115200);',
  '  WiFi.begin(SSID, PASS);',
  '  while (WiFi.status() != WL_CONNECTED) {',
  '    delay(250);',
  '    Serial.print(".");',
  '  }',
  '  Serial.println();',
  '  Serial.println(WiFi.localIP());',
  '',
  '  server.on("/", sendPage);',
  '  server.on("/on", [] { ledOn = true; digitalWrite(LED_PIN, HIGH); sendPage(); });',
  '  server.on("/off", [] { ledOn = false; digitalWrite(LED_PIN, LOW); sendPage(); });',
  '  server.begin();',
  '}',
  '',
  'void loop() {',
  '  server.handleClient();',
  '}',
].join('\n')

const lesson: Lesson = {
  id: 'esp32-wifi-led',
  day: 73,
  phase: 6,
  title: 'WiFi: a web page that controls an LED',
  tagline: 'Your phone’s browser taps ON, the ESP32 sets a pin HIGH, and Day 71’s LED lights.',
  minutes: 45,
  objectives: [
    'Trace a tap on a phone to a pin going HIGH: request, handler, digitalWrite',
    'Read and adapt a WebServer sketch for the ESP32 Arduino core',
    'Upload it, find the board’s IP address and open the page from a phone',
    'Debug the usual failures: 5 GHz WiFi, wrong network, slow loop(), brownouts',
  ],
  sections: [
    {
      id: 'how-it-works',
      title: 'How a tap reaches the LED',
      blocks: [
        {
          type: 'text',
          text: 'The ESP32 joins your WiFi and runs a tiny **web server**. Your phone asks it for a page; tapping a link asks for another address, and the code behind that address sets a pin.',
        },
        {
          type: 'walkthrough',
          title: 'From tap to light',
          steps: [
            { text: 'You tap **ON**. The browser requests `http://192.168.1.42/on` (your board’s address).' },
            { text: '`server.handleClient()` in `loop()` sees the request and runs the `/on` handler.' },
            { text: 'The handler calls `digitalWrite(23, HIGH)`: GPIO23 becomes a 3.3 V source.', highlight: ['V1'] },
            { text: 'Current flows through R1 and the LED, exactly as on Day 71.', math: 'I = (3.3 V − 2 V) ÷ 220 Ω ≈ 5.9 mA', highlight: ['R1', 'D1'] },
            { text: 'The handler sends the page back, now saying “LED is ON”.' },
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          title: 'What the simulator can’t do',
          text: 'The lab simulates the circuit only. It doesn’t run your sketch or WiFi: the **GPIO23** control stands in for your taps. The code runs on the real board.',
        },
      ],
    },
    {
      id: 'the-sketch',
      title: 'The sketch, piece by piece',
      blocks: [
        {
          type: 'code',
          language: 'cpp',
          caption: 'The whole sketch. The libraries come with the **esp32 by Espressif** board package; nothing to install.',
          code: SKETCH,
          notes: [
            { line: 1, text: '`WiFi.h` joins your network; `WebServer.h` answers browser requests.' },
            { line: 4, text: 'Your network name and password. It must be a **2.4 GHz** network.' },
            { line: 6, text: 'The pin from Day 71. `ledOn` is the state the page reports.' },
            { line: 9, text: 'A server on port 80, the default for `http://`.' },
            { line: 12, text: 'The page is just text: HTML built up in a String.' },
            { line: 14, text: 'Two links. Tapping one asks for `/on` or `/off`.' },
            { line: 15, text: 'Sends the page with status 200 (OK).' },
            { line: 20, text: 'The Serial Monitor (at 115200) will show the board’s address.' },
            { line: 22, text: 'Waits for the network, printing dots. Dots forever means a wrong name or password, or a 5 GHz network.' },
            { line: 27, text: 'Prints the address to type into your phone, such as 192.168.1.42.' },
            { line: 29, text: 'The home page.' },
            { line: 30, text: 'The `/on` handler: pin HIGH, then the updated page. `/off` below is the mirror image.' },
            { line: 32, text: 'Starts listening.' },
            { line: 36, text: 'Checks for a request on every pass. A long `delay()` in `loop()` makes the page hang.' },
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: 'Your password is in the sketch',
          text: 'Don’t post or commit the sketch with your real WiFi password in it. Replace it with `your-password` first.',
        },
      ],
    },
    {
      id: 'upload-and-test',
      title: 'Upload, find the address, open it',
      blocks: [
        {
          type: 'text',
          text: 'Upload as on Day 71, open the **Serial Monitor at 115200** and press **EN**. After a few dots it prints the address. On a phone on the **same WiFi**, type `http://` and that address.',
        },
        {
          type: 'predict',
          id: 'wifi-swap-resistor',
          prompt: 'You swap R1 from 220 Ω to 1 kΩ. What must change in the sketch?',
          options: [
            { text: 'The `/on` handler must write a smaller value.', why: '`digitalWrite` only sets HIGH or LOW. It knows nothing about the resistor.' },
            { text: 'The page must be re-uploaded so the ESP32 learns the new value.', why: 'The code never knew the resistor value in the first place.' },
            { text: 'Nothing: the code sets the pin; the resistor sets the current.', correct: true, why: 'HIGH is still 3.3 V. With 1 kΩ the LED just gets about 1.5 mA instead of about 6 mA: dimmer, same code.' },
          ],
          tryIt: 'Set **GPIO23 (set by the web page)** to **HIGH (ON tapped)**, then set **Resistor R1** to **1 kΩ** and compare the current.',
        },
        {
          type: 'predict',
          id: 'wifi-off',
          prompt: 'You tap OFF. What does the LED’s loop see?',
          options: [
            { text: '3.3 V, but the code blocks the current.', why: 'Code can’t block current in a wire. It changes the pin’s voltage.' },
            { text: '0 V at GPIO23, so no current: the LED is dark.', correct: true, why: 'LOW makes the pin a 0 V source. With no voltage across R1 and the LED, nothing flows.' },
            { text: 'A small current keeps it glowing faintly.', why: 'At 0 V the LED is far below its 2 V forward voltage: no meaningful current.' },
          ],
          tryIt: 'Set **GPIO23 (set by the web page)** to **LOW (OFF tapped)**.',
        },
      ],
    },
    {
      id: 'troubleshooting',
      title: 'When it doesn’t work',
      blocks: [
        {
          type: 'table',
          head: ['Symptom', 'Likely cause', 'Fix'],
          rows: [
            ['Dots forever in the Serial Monitor', 'Wrong name or password, or a 5 GHz-only network', 'Check spelling; use a 2.4 GHz network or a phone hotspot set to 2.4 GHz'],
            ['Garbage characters', 'Baud rate mismatch', 'Set the Serial Monitor to **115200**'],
            ['The phone can’t open the page', 'Phone on mobile data, or a guest network that isolates devices', 'Same WiFi as the board; type `http://` plus the address'],
            ['The page works, the LED doesn’t', 'Jumper on the wrong pin, or LED backwards', 'Yellow jumper on **D23**; long leg towards R1'],
            ['Resets when WiFi starts (“Brownout detector”)', 'Weak USB cable or port', 'Short, good cable; a powered hub or a 5 V 1 A supply'],
          ],
        },
      ],
    },
  ],
  lab: {
    title: 'The web page’s LED',
    intro: 'The same circuit as Day 71. **V1** is GPIO23, which your sketch sets when you tap ON or OFF. The simulator doesn’t run the sketch: use the **GPIO23** control as your tap.',
    circuit: {
      ground: 'gnd',
      components: [
        { kind: 'vsource', id: 'V1', pos: 'pin', neg: 'gnd', volts: 0 },
        { kind: 'resistor', id: 'R1', a: 'pin', b: 'a', ohms: 220 },
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
      probes: [{ node: 'pin', at: { x: 3, y: 1 }, label: 'GPIO23' }],
    },
    controls: [
      {
        type: 'choice',
        id: 'gpio',
        label: 'GPIO23 (set by the web page)',
        componentId: 'V1',
        prop: 'volts',
        options: [
          { label: 'LOW (OFF tapped)', value: 0 },
          { label: 'HIGH (ON tapped)', value: 3.3 },
        ],
      },
      {
        type: 'choice',
        id: 'r1',
        label: 'Resistor R1',
        componentId: 'R1',
        prop: 'ohms',
        options: [
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
    clickControls: { V1: 'gpio', R1: 'r1' },
    readouts: [
      { componentId: 'D1', quantity: 'current', label: 'Current from GPIO23' },
      { componentId: 'V1', quantity: 'voltage', label: 'GPIO23 voltage' },
    ],
    challenges: [
      {
        id: 'tap-on',
        prompt: '“Tap ON”: light the red LED from GPIO23.',
        hint: 'Set GPIO23 to HIGH, as your `/on` handler does.',
        success: 'About 6 mA with 220 Ω: the same loop as Day 71, now switched from your phone.',
        check: (r, c) => isHigh(c) && ledColor(c) === 'red' && r.components.D1?.status === 'ok' && (r.components.D1.current ?? 0) >= 3 * mA,
      },
      {
        id: 'brighter-safe',
        prompt: 'Make the ON state brighter, **10–15 mA**, without changing a line of code.',
        hint: 'Brightness is the resistor’s job. R = 1.3 V ÷ I.',
        success: '100 Ω gives about 13 mA, still inside the 20 mA pin guideline. The sketch never changed: hardware sets the current, software only sets HIGH or LOW.',
        check: (r, c) => isHigh(c) && ledColor(c) === 'red' && r.components.D1?.status === 'ok' && between(r.components.D1.current, 10 * mA, 15 * mA),
      },
    ],
  },
  quiz: [
    {
      id: 'web-led-current',
      type: 'numeric',
      prompt: 'Tapping ON sets GPIO23 to 3.3 V. With a red LED (Vf = 2 V) and 220 Ω, how much current flows, in mA?',
      answer: 5.91,
      tolerance: 0.03,
      unit: 'mA',
      hint: 'I = (3.3 V − Vf) ÷ R.',
      explanation: 'I = 1.3 V ÷ 220 Ω ≈ **5.9 mA**.',
    },
    {
      id: 'green-r',
      type: 'numeric',
      prompt: 'You switch to a green LED (Vf = 2.2 V) and want 10 mA from the 3.3 V pin. What resistor, in ohms?',
      answer: 110,
      tolerance: 0.03,
      unit: 'Ω',
      hint: 'R = (3.3 V − 2.2 V) ÷ 0.010 A.',
      explanation: 'R = 1.1 V ÷ 0.010 A = **110 Ω**. A 100 Ω kit resistor gives about 11 mA.',
    },
    {
      id: 'find-ip',
      type: 'choice',
      prompt: 'Where do you find the address to type into your phone?',
      options: [
        { text: 'It’s always 192.168.1.1.', why: 'That’s usually your router. The router hands the ESP32 its own address.' },
        { text: 'In the Serial Monitor at 115200, printed by `WiFi.localIP()`.', correct: true, why: 'Press EN after opening the monitor to see it from the start. Your router’s device list shows it too.' },
        { text: 'Printed on the ESP32 board.', why: 'The board has a fixed MAC address, but the IP address comes from your network.' },
      ],
    },
    {
      id: 'five-ghz',
      type: 'choice',
      prompt: 'The Serial Monitor prints dots forever. Your router only broadcasts a 5 GHz network. Why?',
      options: [
        { text: 'The ESP32’s radio only supports 2.4 GHz WiFi.', correct: true, why: 'Use a 2.4 GHz network or a phone hotspot set to 2.4 GHz.' },
        { text: 'The sketch needs `WiFi.mode(5GHZ)`.', why: 'There’s no such mode: the hardware is 2.4 GHz only.' },
        { text: 'The baud rate is wrong.', why: 'A wrong baud rate gives garbage characters, not neat dots.' },
      ],
    },
    {
      id: 'loop-delay',
      type: 'choice',
      prompt: 'You add `delay(5000);` to `loop()` after `server.handleClient();`. What happens when you tap ON?',
      options: [
        { text: 'Nothing changes: WiFi runs in the background.', why: 'WiFi does, but your handlers only run when `handleClient()` is called.' },
        { text: 'The LED lights at once but the page reloads slowly.', why: 'The LED only changes when the handler runs, and that waits for `handleClient()`.' },
        { text: 'The tap takes up to 5 s to work, and the browser may time out.', correct: true, why: '`handleClient()` now runs once every 5 s. Keep `loop()` fast; use `millis()` for timing (Day 25).' },
      ],
    },
    {
      id: 'which-line',
      type: 'choice',
      prompt: 'Which line makes the LED respond when the browser asks for `/on`?',
      options: [
        { text: '`server.begin();`', why: 'That starts the server; it doesn’t say what any address does.' },
        { text: '`server.on("/on", [] { ledOn = true; digitalWrite(LED_PIN, HIGH); sendPage(); });`', correct: true, why: 'It connects the address `/on` to code that sets the pin HIGH.' },
        { text: '`WiFi.begin(SSID, PASS);`', why: 'That joins the network; it has nothing to do with pages.' },
      ],
    },
  ],
  realBuild: {
    parts: [
      'ESP32 DevKit V1 (30-pin): not in the Elegoo Uno kit, buy (~$6–10)',
      'Micro-USB data cable',
      'Breadboard, male-to-male and male-to-female jumper wires',
      '1 red LED and a 220 Ω resistor (Day 71’s circuit)',
      'A phone or laptop on a 2.4 GHz WiFi network',
    ],
    steps: [
      BREADBOARD,
      LED_WAY,
      NO_METER,
      'This is Day 71’s circuit. If it’s still on your bench, skip to step 7. Otherwise, unplugged: ' + ESP32_GND_STEP,
      'R1 (220 Ω) from **c8** to **c12**; the LED’s long leg in **e12** and short leg in **e13**; a black jumper from **a13** to the top **−** rail.',
      'A **yellow** jumper from **D23** to **a8**.',
      'Copy the sketch from the lesson and put in your network’s name and password. Upload it (hold **BOOT** if it sticks at `Connecting....`).',
      'Open the Serial Monitor at **115200** and press **EN**. After a few dots it prints an address such as `192.168.1.42`.',
      'On a phone on the **same** WiFi, open `http://` plus that address. Tap **ON**: the LED lights. Tap **OFF**: dark.',
      'Not working? Use the troubleshooting table: most problems are a 5 GHz network, the phone on mobile data, or a charge-only cable.',
    ],
    stepParts: [[], ['D1'], [], ['w-gnd'], ['R1', 'D1', 'w-minus'], ['w-gpio'], [], [], ['w-gpio', 'D1'], []],
    safety: [
      'Never connect 5 V to a GPIO or the 3V3 pin.',
      'Keep the LED’s resistor in: the pin should stay under 20 mA.',
      'Don’t share the sketch with your real WiFi password in it.',
    ],
    breadboard: ESP32_LED_BOARD,
  },
}

export default lesson
