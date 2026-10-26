import type { BreadboardLayout, BreadboardPart } from '../../viz/types'
import type { RichString } from '../types'

// "Before you build" primers, shared by every realBuild until the Day 3 (breadboard) and
// Day 4 (multimeter) lessons exist. Each realBuild's steps start with BREADBOARD.

export const BREADBOARD: RichString =
  '**Before you build: the breadboard.** Each numbered column of holes is split by the centre gap into two strips of 5 (rows a–e and rows f–j). The 5 holes in one strip are joined by metal inside, so parts pushed into the same strip are connected. Nothing connects across the centre gap. Hole **c12** means row c, column 12. The long **+** (red) and **−** (blue) rails along the top and bottom edges are joined along their length; on some boards they break halfway, so if the coloured line has a gap, bridge it with a jumper.'

export const LED_WAY: RichString =
  '**Which way the LED goes.** The **long leg** (anode, +) points towards the supply’s + through the resistor. The **short leg** (cathode, −), on the flat side of the rim, goes towards GND. Put the two legs in **different** columns: in the same strip they are shorted together.'

export const METER_VOLTS: RichString =
  '**Measuring volts with a multimeter.** Black lead in **COM**, red lead in the socket marked **V** (never the A socket). Turn the dial to **DC volts** (V with a straight line; pick the 20 V range if your meter has ranges). With the circuit powered, touch black to GND and red to the point you want. A minus sign only means the leads are the wrong way round.'

export const METER_OHMS: RichString =
  '**Measuring resistance.** Same leads (COM and V/Ω), dial on **Ω**, and the circuit **unpowered**. Touch one lead to each end of the resistor or group; the order doesn’t matter.'

export const NO_METER: RichString = '**Multimeter:** not needed today.'
export const METER_NEEDED: RichString = '**Multimeter:** needed today. Every measurement step below uses it.'
export const METER_OPTIONAL: RichString = '**Multimeter:** optional today. Without one, skip the measuring and just watch the LEDs.'

/** Uno 5V and GND to the top rails. Every Uno build starts with these two wires. */
export const UNO_POWER: BreadboardPart[] = [
  { kind: 'wire', id: 'w-5v', from: 'uno:5V', to: 'T+1', color: 'red' },
  { kind: 'wire', id: 'w-gnd', from: 'uno:GND', to: 'T-1', color: 'black' },
]

export const UNO_POWER_STEP: RichString =
  'Power the rails: a **red** jumper from the Uno’s **5V** pin to the top **+** rail, and a **black** jumper from a **GND** pin to the top **−** rail.'

/** ESP32 GND to the top − rail. Every ESP32 build starts with this wire. */
export const ESP32_GND: BreadboardPart = { kind: 'wire', id: 'w-gnd', from: 'esp32:GND', to: 'T-1', color: 'black' }

export const ESP32_GND_STEP: RichString =
  'Ground first: a **black** jumper from one of the ESP32’s **GND** pins to the top **−** rail. The DevKit is too wide for one half-size breadboard, so it stays beside the board and male-to-female jumpers reach its pins.'

/** GPIO23 → R1 (220 Ω) → red LED → GND, used by Day 71 and Day 73. */
export const ESP32_LED_BOARD: BreadboardLayout = {
  supply: 'esp32',
  parts: [
    ESP32_GND,
    { kind: 'wire', id: 'w-gpio', from: 'esp32:GPIO23', to: 'a8', color: 'yellow' },
    { kind: 'resistor', id: 'R1', from: 'c8', to: 'c12', ohms: 220 },
    { kind: 'led', id: 'D1', anode: 'e12', cathode: 'e13', color: 'red' },
    { kind: 'wire', id: 'w-minus', from: 'a13', to: 'T-13', color: 'black' },
  ],
}
