import type { PartInfo } from '../types'

export const breadboard: PartInfo = {
  id: 'breadboard',
  name: 'Solderless breadboard (half-size, 400 holes)',
  category: 'tool',
  summary: 'Push-in prototyping board. Metal clips under the holes join them in fixed groups, so parts in the same group are connected without solder.',
  availability: { source: 'kit' },
  features: [
    { anchor: 'terminal-strip', title: 'Terminal strips', detail: 'Each numbered column is two strips of 5 holes: **a–e** and **f–j**. Everything in one strip is one node.' },
    { anchor: 'centre-gap', title: 'Centre gap', detail: 'Nothing crosses it. Chips (DIP ICs) and buttons straddle it so each leg gets its own strip.' },
    { anchor: 'power-rail-plus', title: '+ rail (red line)', detail: 'Runs the length of the board. On some boards it is split in the middle: if the red line has a gap, bridge it with a jumper.' },
    { anchor: 'power-rail-minus', title: '− rail (blue line)', detail: 'Ground rail. Join the top and bottom − rails with a jumper if you use both.' },
    { anchor: 'column-numbers', title: 'Column numbers', detail: '1–30. Together with the row letter they name a hole: **c12** is row c, column 12.' },
    { anchor: 'row-letters', title: 'Row letters', detail: 'a–j. Rows don’t matter electrically inside a strip; they just give you room for five legs.' },
  ],
  howToConnect: [
    'Check the rails with a meter on continuity (or from the diagram on the back) before trusting a split rail.',
    'Supply + to the + rail, GND to the − rail. Short jumpers from the rails to the strips where parts need them.',
    'One leg per hole, pushed straight in until it stops. Trim very long legs so neighbours can’t touch.',
    'Give each part’s legs different strips; two legs in one strip are shorted.',
  ],
  mistakes: [
    'Both legs of a part in the same strip (shorted, so it does nothing).',
    'Assuming a rail runs the full length when it’s split in the middle.',
    'Thick legs (power jacks, some pots) that spread the clips; thin legs pushed in afterwards don’t touch.',
    'Long loops of jumper wire that make faults impossible to trace. Keep jumpers flat and short.',
  ],
  topicIds: ['basics', 'permanent'],
  related: ['jumper-wire', 'resistor', 'led'],
  lessonIds: ['first-led'],
}

export const resistor: PartInfo = {
  id: 'resistor',
  name: 'Resistor (¼ W metal film)',
  category: 'passive',
  summary: 'Sets current and divides voltage. The kit’s parts are ¼ W, ±1 %, with a 5-band colour code.',
  availability: { source: 'kit' },
  features: [
    { anchor: 'body', title: 'Body', detail: 'Blue-ish body = metal film (±1 %), beige = carbon film (±5 %). The body must stay under **¼ W**; ideally half that.' },
    { anchor: 'bands', title: 'Value bands', detail: '5-band: three digits, then the multiplier. **Red-red-black-black** = 2, 2, 0 × 1 = **220 Ω**. Read from the end with the bands bunched together.' },
    { anchor: 'tolerance-band', title: 'Tolerance band', detail: 'The last band, set a little apart: **brown** ±1 %, gold ±5 %. On a 5-band part it tells you which end to read from.' },
    { anchor: 'lead', title: 'Leads', detail: 'Either way round: resistors have no polarity. Bend them 0.4" apart (4 holes) to sit flat on the breadboard.' },
  ],
  howToConnect: [
    'Not sure of the colours? Measure it with the meter on Ω before it goes in the circuit.',
    'In series with an LED it can go on either side (anode or cathode); the current is the same.',
    'Keep its legs in two different strips, in the two nodes it should join.',
  ],
  mistakes: [
    'Reading the code from the wrong end (brown and red are easy to confuse as first or last band).',
    'A small resistor straight across a supply: 100 Ω across 5 V is already 0.25 W, the full rating.',
    'Using the Uno’s 220 Ω on a 3.3 V ESP32 pin and wondering why the LED is dim.',
  ],
  topicIds: ['basics', 'analog-logic', 'esp32-wireless', 'arduino', 'permanent'],
  related: ['led', 'potentiometer', 'breadboard'],
  lessonIds: ['first-led', 'ohms-law', 'series-parallel', 'voltage-divider', 'power', 'level-shifting'],
}

export const led: PartInfo = {
  id: 'led',
  name: 'LED (5 mm)',
  category: 'output',
  summary: 'A diode that emits light. One-way, with a forward voltage of about 2 V (red, yellow, green) or about 3 V (blue, white), and it always needs a current-limiting resistor.',
  availability: { source: 'kit' },
  features: [
    { anchor: 'lens', title: 'Lens', detail: 'Coloured or clear epoxy. Clear (“water-clear”) LEDs look the same colour off; check the bag.' },
    { anchor: 'anode-leg', title: 'Anode (long leg, +)', detail: 'Towards the supply’s +, through the resistor if it sits on that side.' },
    { anchor: 'cathode-leg', title: 'Cathode (short leg, −)', detail: 'Towards GND. Once the legs are trimmed, use the flat edge instead.' },
    { anchor: 'flat-edge', title: 'Flat edge of the rim', detail: 'Marks the cathode. It survives trimming; leg length doesn’t.' },
    { anchor: 'die', title: 'Die and anvil', detail: 'The tiny chip that glows sits in a cup on one post. The bigger post is usually the cathode, but not on every LED: trust the flat edge or a meter’s diode test.' },
  ],
  howToConnect: [
    'Work out the resistor: R = (supply − Vf) ÷ I. 5 V, red, 10–15 mA → 220 Ω. 3.3 V, red → 100–150 Ω.',
    'Long leg into the strip that leads to +; short leg into a different strip that leads to GND.',
    'Resistor in series on either side, then power up. Dark? Turn the LED round (a backwards LED is harmless at 5 V).',
  ],
  mistakes: [
    'No resistor: the LED takes as much current as the supply gives and dies, sometimes with a crack.',
    'Both legs in one strip (shorted).',
    'Parallel LEDs sharing one resistor: the one with the lowest Vf hogs the current.',
    'Blue or white on 3.3 V: only about 0.3 V is left for the resistor, so they are dim and vary a lot from LED to LED.',
  ],
  topicIds: ['basics', 'arduino', 'esp32-wireless', 'permanent'],
  related: ['resistor', 'diode-1n4007', 'breadboard'],
  lessonIds: ['first-led', 'ohms-law', 'diodes-leds', 'esp32-intro', 'esp32-wifi-led'],
}

export const pushButton: PartInfo = {
  id: 'push-button',
  name: 'Tactile push button (6 × 6 mm, 4 legs)',
  category: 'input',
  summary: 'A momentary switch: closed only while pressed. Four legs, but only two connections, joined in pairs inside.',
  availability: { source: 'kit' },
  features: [
    { anchor: 'plunger', title: 'Plunger', detail: 'Press to close. Contacts bounce for a few milliseconds, so code sees several presses unless you debounce (Day 18).' },
    { anchor: 'legs-connected', title: 'Always-connected pairs', detail: 'Legs straight across from each other (on opposite sides of the body) are joined inside, pressed or not.' },
    { anchor: 'legs-switched', title: 'Switched pairs', detail: 'Legs on the same side are joined only while pressed. Diagonally opposite legs are always a switched pair too.' },
  ],
  howToConnect: [
    'Straddle the centre gap, so each of the four legs gets its own strip.',
    'Use two legs on the **same side** (or diagonal corners) as the switch. Not sure? Meter on continuity: it should beep only while you press.',
    'For a microcontroller input: one side to the pin, the other to GND, and `pinMode(pin, INPUT_PULLUP)`. Pressed reads LOW.',
  ],
  mistakes: [
    'Using two legs that are always connected: the “button” is permanently on.',
    'A floating input (no pull-up or pull-down): the pin reads random values.',
    'Wiring the button straight between 5V and GND: pressing it shorts the supply.',
  ],
  topicIds: ['basics', 'arduino'],
  related: ['resistor', 'arduino-uno'],
}

export const potentiometer: PartInfo = {
  id: 'potentiometer',
  name: 'Potentiometer (10 kΩ rotary)',
  category: 'input',
  summary: 'A resistor with a sliding contact: a voltage divider you turn by hand. Outer pins are the two ends; the middle pin (wiper) is the output.',
  availability: { source: 'kit' },
  features: [
    { anchor: 'knob', title: 'Shaft / knob', detail: 'About 300° of travel. “B10K” on the body means 10 kΩ, linear taper.' },
    { anchor: 'pin-end-a', title: 'End A', detail: 'One end of the track. Usually to GND.' },
    { anchor: 'pin-wiper', title: 'Wiper (middle)', detail: 'Slides along the track: its voltage goes smoothly from one end’s voltage to the other’s.' },
    { anchor: 'pin-end-b', title: 'End B', detail: 'Other end of the track. Usually to 5 V (Uno) or 3.3 V (ESP32).' },
  ],
  howToConnect: [
    'Outer pins to the supply (5V on the Uno, **3V3** on the ESP32) and GND; wiper to an analog pin (A0 on the Uno, an ADC1 pin such as **D32** on the ESP32).',
    'Read it with `analogRead()`: 0–1023 on the Uno, 0–4095 on the ESP32.',
    'Turning the “wrong” way? Swap the two outer pins.',
  ],
  mistakes: [
    'Supply on the wiper and GND on an end: turned fully to that end it shorts the supply.',
    'ESP32: wiper on an ADC2 pin, which stops working once WiFi is on. Or the pot fed from 5 V, which puts 5 V on the pin.',
    'Its legs are short and wide: push firmly, or use a breakout, or it makes intermittent contact.',
  ],
  topicIds: ['arduino', 'sensors-displays', 'analog-logic'],
  related: ['resistor', 'arduino-uno', 'esp32-devkit'],
}

export const electrolyticCapacitor: PartInfo = {
  id: 'electrolytic-capacitor',
  name: 'Electrolytic capacitor (10 µF / 100 µF, 50 V)',
  category: 'passive',
  summary: 'Stores charge: smooths supply dips, sets RC timing and decouples noisy loads such as servos. Large values in a small can, but **polarised**.',
  availability: { source: 'kit' },
  features: [
    { anchor: 'can', title: 'Aluminium can', detail: 'Printed with capacitance (µF) and the maximum voltage. Use one rated at least 1.5× your supply.' },
    { anchor: 'negative-stripe', title: 'Negative stripe', detail: 'The light stripe with “−” signs marks the negative lead. It goes to the lower voltage (GND).' },
    { anchor: 'long-leg', title: 'Long leg (+)', detail: 'The positive lead, towards the higher voltage.' },
    { anchor: 'vent', title: 'Vent (scored top)', detail: 'Splits open if the capacitor is reversed or over-voltaged, instead of the can bursting. A domed top means it’s damaged: replace it.' },
  ],
  howToConnect: [
    'Stripe to GND, long leg to the + side, as close as possible to the part it supports.',
    'Across a servo or motor supply: 100–470 µF between that supply’s + and GND.',
    'For timing: in series with a resistor; τ = R × C (10 kΩ × 100 µF = 1 s).',
  ],
  mistakes: [
    'Backwards: it leaks, heats and can vent. Check the stripe every time.',
    'A 16 V capacitor on a 24 V supply.',
    'Expecting exact timing: electrolytics are often −20 % / +80 %.',
  ],
  topicIds: ['basics', 'analog-logic', 'power-motors'],
  related: ['resistor', 'servo-sg90'],
}

export const diode1n4007: PartInfo = {
  id: 'diode-1n4007',
  name: '1N4007 rectifier diode',
  category: 'semiconductor',
  summary: 'A one-way valve for current: 1 A, 1000 V. Drops about 0.7 V (up to about 1 V at full current) when it conducts.',
  availability: { source: 'kit' },
  features: [
    { anchor: 'body', title: 'Black body', detail: 'Printed **4007** or **1N4007**. It handles 1 A continuously.' },
    { anchor: 'cathode-band', title: 'Silver band', detail: 'Marks the cathode. Conventional current flows towards the band.' },
    { anchor: 'anode-lead', title: 'Anode lead', detail: 'The unbanded end: towards the higher voltage when it should conduct.' },
    { anchor: 'cathode-lead', title: 'Cathode lead', detail: 'The banded end.' },
  ],
  howToConnect: [
    'Reverse-polarity protection: in series with the supply’s +, band towards the circuit. A backwards battery then does nothing.',
    'Flyback diode across a motor or relay coil: band to the **+** side of the coil, so it is reverse-biased normally and catches the spike at switch-off.',
  ],
  mistakes: [
    'Band the wrong way round: as protection it blocks everything; as a flyback diode it shorts the supply when the transistor turns on.',
    'Forgetting it costs 0.7 V: a 5 V rail through a diode is about 4.3 V.',
  ],
  topicIds: ['basics', 'power-motors'],
  related: ['led', 'servo-sg90', 'battery-9v'],
  lessonIds: ['diodes-leds'],
}

export const jumperWire: PartInfo = {
  id: 'jumper-wire',
  name: 'Jumper wires (Dupont)',
  category: 'tool',
  summary: 'Pre-crimped wires with pins or sockets on the ends: male-male for breadboards, male-female for module pins and the ESP32 header off the board.',
  availability: { source: 'kit' },
  features: [
    { anchor: 'male-pin', title: 'Male pin', detail: 'Goes into breadboard holes and the Uno’s header sockets.' },
    { anchor: 'female-socket', title: 'Female socket', detail: 'Slides onto header pins: sensor modules, an ESP32 that isn’t on a breadboard.' },
    { anchor: 'housing', title: 'Plastic housing', detail: 'Holds the crimp. A loose housing or a wire that moves inside it is the classic intermittent fault.' },
  ],
  howToConnect: [
    'Colour by job: **red** for +, **black** for GND, other colours for signals. It makes checking a build ten times faster.',
    'Use the shortest wire that reaches without strain.',
    'Suspect a wire? Meter on continuity from pin to pin while you wiggle it.',
  ],
  mistakes: [
    'Trusting a cheap jumper: broken strands inside the insulation are common. Test it.',
    'Rats’ nests of long wires that hide a mis-plugged one.',
  ],
  topicIds: ['basics', 'permanent'],
  related: ['breadboard'],
}

export const battery9v: PartInfo = {
  id: 'battery-9v',
  name: '9 V battery and snap',
  category: 'power',
  summary: 'A portable supply for low-current circuits: about 9 V new, a few hundred mAh, and a high internal resistance that sags under load.',
  availability: { source: 'kit' },
  features: [
    { anchor: 'battery', title: 'Battery', detail: 'Alkaline, about 500 mAh at small currents, much less at 100 mA+. Fine for LEDs; poor for motors, servos and WiFi boards.' },
    { anchor: 'snap', title: 'Snap connector', detail: 'Clips onto both terminals; it only fits one way.' },
    { anchor: 'lead-red', title: 'Red lead (+)', detail: 'To the + rail, or the barrel plug’s centre on the kit’s snap-to-barrel lead.' },
    { anchor: 'lead-black', title: 'Black lead (−)', detail: 'To the − rail / GND.' },
  ],
  howToConnect: [
    'For the Uno: the snap-to-barrel lead into the barrel jack. The Uno’s regulator makes 5 V.',
    'For a breadboard circuit: red to the + rail, black to the − rail, with resistors sized for 9 V.',
  ],
  mistakes: [
    'Letting both terminals touch metal (keys, coins, the other snap): it shorts and gets hot fast.',
    'Running servos or motors from it: the voltage collapses under load.',
    'Connecting it and USB power to the same breadboard rails at once.',
  ],
  topicIds: ['basics', 'power-motors'],
  related: ['arduino-uno', 'diode-1n4007'],
  lessonIds: ['ohms-law', 'power', 'diodes-leds'],
}
