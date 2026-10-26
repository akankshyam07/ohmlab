import type { PartInfo } from '../types'

export const servoSg90: PartInfo = {
  id: 'servo-sg90',
  name: 'SG90 micro servo',
  category: 'output',
  summary: 'A small motor with gears and a position sensor: you send it a pulse width, it turns to an angle (about 0–180°) and holds it.',
  availability: { source: 'kit' },
  features: [
    { anchor: 'horn', title: 'Horn', detail: 'The plastic arm on the output shaft. Press it on after centring the servo, so 90° points where you want.' },
    { anchor: 'case', title: 'Case', detail: 'Motor, nylon gears and a potentiometer for position feedback. Forcing the horn by hand strips the gears.' },
    { anchor: 'wire-signal', title: 'Orange wire: signal', detail: 'A pulse every 20 ms (50 Hz): about 0.5 ms = 0°, 1.5 ms = 90°, 2.4 ms = 180°. The `Servo` library makes it. 3.3 V pulses from an ESP32 usually work.' },
    { anchor: 'wire-power', title: 'Red wire: power', detail: '**4.8–6 V**. It draws 100–250 mA moving and up to about **650 mA** stalled.' },
    { anchor: 'wire-ground', title: 'Brown wire: ground', detail: 'Must share ground with the board that sends the signal.' },
  ],
  howToConnect: [
    'Power from a separate 5–6 V supply (4 × AA, or a 5 V 1–2 A USB adapter on a breadboard rail), **not** from a microcontroller pin.',
    'Join that supply’s − to the Uno or ESP32 GND (common ground).',
    'Orange to a PWM-capable pin (Uno D9; ESP32 D18).',
    'Add 100–470 µF across the servo supply, + to the red-wire rail, stripe to GND.',
    'Test with **File → Examples → Servo → Sweep** (on the ESP32, install the **ESP32Servo** library).',
  ],
  mistakes: [
    'Powering it from an I/O pin: a pin gives 20 mA, the servo needs hundreds.',
    'Powering it from the Uno’s 5V pin on USB: one unloaded servo may run, but a stall resets the board or trips the fuse.',
    'Forgetting the common ground: the servo twitches or ignores you.',
    'Commanding angles past its end stops: it buzzes, gets hot and strips gears.',
  ],
  topicIds: ['power-motors'],
  related: ['electrolytic-capacitor', 'arduino-uno', 'esp32-devkit'],
}

export const hcSr04: PartInfo = {
  id: 'hc-sr04',
  name: 'HC-SR04 ultrasonic distance sensor',
  category: 'sensor',
  summary: 'Measures distance (about 2–400 cm) by timing a 40 kHz chirp’s echo. A **5 V** module: its ECHO output is 5 V.',
  availability: { source: 'kit' },
  features: [
    { anchor: 'transmitter', title: 'Transmitter (T)', detail: 'Sends 8 pulses at 40 kHz when triggered.' },
    { anchor: 'receiver', title: 'Receiver (R)', detail: 'Listens for the echo. Soft, angled or tiny targets reflect badly and give missing readings.' },
    { anchor: 'pin-vcc', title: 'VCC', detail: '**5 V**, about 15 mA. Many boards don’t work reliably on 3.3 V (the HC-SR04P / RCWL-1601 variants do).' },
    { anchor: 'pin-trig', title: 'TRIG', detail: 'A 10 µs HIGH pulse starts a measurement. A 3.3 V pulse from an ESP32 usually triggers it.' },
    { anchor: 'pin-echo', title: 'ECHO', detail: 'Goes HIGH (**5 V**) for as long as the sound took out and back. Distance in cm ≈ microseconds ÷ 58. On an ESP32 it **must** go through a divider (Day 72).' },
    { anchor: 'pin-gnd', title: 'GND', detail: 'To the board’s GND.' },
    { anchor: 'crystal', title: 'Crystal', detail: 'Sets the 40 kHz timing. Nothing to adjust.' },
  ],
  pins: [
    { name: 'VCC', detail: '5 V (Uno 5V, or ESP32 VIN on USB).' },
    { name: 'TRIG', detail: 'Any digital output.' },
    { name: 'ECHO', detail: 'Uno: straight to a digital pin. ESP32: through a divider to ≤ 3.3 V (for example 5.1 kΩ + 220 Ω over 10 kΩ, about 3.26 V).' },
    { name: 'GND', detail: 'Common ground.' },
  ],
  howToConnect: [
    'Uno: VCC → 5V, GND → GND, TRIG → D9, ECHO → D10.',
    'ESP32: VCC → **VIN** (5 V on USB), GND → GND, TRIG → **D19**, ECHO → divider → **D18**.',
    'Code: TRIG HIGH for 10 µs, then `pulseIn(echoPin, HIGH, 30000)` gives microseconds; ÷ 58 for cm. A 0 means no echo within 30 ms.',
    'Wait at least 60 ms between measurements so old echoes die away.',
  ],
  mistakes: [
    'ECHO straight into an ESP32 pin: 5 V on a 3.3 V input.',
    'Powering it from 3.3 V and getting random or zero readings.',
    'Measuring closer than 2 cm, or at a soft or steeply angled surface.',
    'Triggering faster than every 60 ms.',
  ],
  topicIds: ['sensors-displays', 'esp32-wireless'],
  related: ['esp32-devkit', 'arduino-uno', 'resistor'],
  lessonIds: ['level-shifting'],
}
