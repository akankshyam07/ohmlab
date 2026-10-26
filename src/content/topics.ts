import { parts } from './parts'
import type { Topic } from './types'

const range = (first: number, last: number) => Array.from({ length: last - first + 1 }, (_, i) => first + i)
/** A topic's parts are the ones that list it in their own `topicIds`, so the two never disagree. */
const partsIn = (topicId: string) => parts.filter((p) => p.topicIds.includes(topicId)).map((p) => p.id)

export const topics: Topic[] = [
  {
    id: 'basics',
    title: 'Basics',
    summary: 'Voltage, current, resistance, dividers, power and diodes, each tied to a breadboard build you can copy hole for hole.',
    lessonIds: ['first-led', 'ohms-law', 'series-parallel', 'voltage-divider', 'power', 'diodes-leds'],
    partIds: partsIn('basics'),
    days: range(1, 12),
  },
  {
    id: 'arduino',
    title: 'Arduino',
    summary: 'The Uno and its pins: uploading, buttons, analog input, PWM, sound and non-blocking code.',
    lessonIds: [],
    partIds: partsIn('arduino'),
    days: range(13, 28),
  },
  {
    id: 'power-motors',
    title: 'Power & motors',
    summary: 'Why a pin can’t drive a motor, and the transistors, drivers, servos and supplies that can.',
    lessonIds: [],
    partIds: partsIn('power-motors'),
    days: range(29, 40),
  },
  {
    id: 'sensors-displays',
    title: 'Sensors & displays',
    summary: 'Distance, temperature and motion sensors, LED and LCD displays, and the buses (UART, I2C, SPI) that connect them.',
    lessonIds: [],
    partIds: partsIn('sensors-displays'),
    days: range(41, 56),
  },
  {
    id: 'analog-logic',
    title: 'Analog & logic',
    summary: '555 timers, logic gates, op-amps and filters: circuits that work with no code at all.',
    lessonIds: [],
    partIds: partsIn('analog-logic'),
    days: range(57, 70),
  },
  {
    id: 'esp32-wireless',
    title: 'ESP32 & wireless',
    summary: 'The 3.3 V ESP32: safe pins, level shifting, WiFi and Bluetooth, and running on batteries.',
    lessonIds: ['esp32-intro', 'level-shifting', 'esp32-wifi-led'],
    partIds: partsIn('esp32-wireless'),
    days: range(71, 82),
  },
  {
    id: 'permanent',
    title: 'Make it permanent',
    summary: 'From breadboard to solder and perfboard, then your own PCB in KiCad and a capstone device.',
    lessonIds: [],
    partIds: partsIn('permanent'),
    days: range(83, 100),
  },
]
