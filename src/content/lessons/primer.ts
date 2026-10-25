import type { RichString } from '../types'

// "Before you build" primers, shared by every realBuild until the Day 3 (breadboard) and
// Day 4 (multimeter) lessons exist. Each realBuild's steps start with BREADBOARD.

export const BREADBOARD: RichString =
  '**Before you build: the breadboard.** Each numbered row is split by the centre gap into two strips of 5 holes (a–e and f–j). The 5 holes in one strip are joined by metal inside, so parts pushed into the same strip are connected. Nothing connects across the centre gap. The long **+** (red) and **−** (blue) rails along the edges are joined along their length; on some boards they break halfway, so if the coloured line has a gap, bridge it with a jumper.'

export const LED_WAY: RichString =
  '**Which way the LED goes.** The **long leg** (anode, +) points towards the supply’s + through the resistor. The **short leg** (cathode, −), on the flat side of the rim, goes towards GND. Put the two legs in **different** rows: in the same row they are shorted together.'

export const METER_VOLTS: RichString =
  '**Measuring volts with a multimeter.** Black lead in **COM**, red lead in the socket marked **V** (never the A socket). Turn the dial to **DC volts** (V with a straight line; pick the 20 V range if your meter has ranges). With the circuit powered, touch black to GND and red to the point you want. A minus sign only means the leads are the wrong way round.'

export const METER_OHMS: RichString =
  '**Measuring resistance.** Same leads (COM and V/Ω), dial on **Ω**, and the circuit **unpowered**. Touch one lead to each end of the resistor or group; the order doesn’t matter.'

export const NO_METER: RichString = '**Multimeter:** not needed today.'
export const METER_NEEDED: RichString = '**Multimeter:** needed today. Every measurement step below uses it.'
export const METER_OPTIONAL: RichString = '**Multimeter:** optional today. Without one, skip the measuring and just watch the LEDs.'
