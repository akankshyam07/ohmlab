import type { Circuit, SolveResult } from '../sim/types'
import type { BreadboardLayout, CircuitLayout } from '../viz/types'

/** Inline text supports **bold**, *emphasis* and `code` (see src/ui/RichText.tsx). */
export type RichString = string

export type Block =
  | { type: 'text'; text: RichString }
  | { type: 'callout'; tone: 'tip' | 'warn' | 'info'; title?: string; text: RichString }
  | { type: 'formula'; expr: string; caption?: RichString }
  /** Source code shown verbatim with a copy button; `notes` explain it line by line (1-based line numbers). */
  | { type: 'code'; language: 'cpp' | 'python' | 'text'; code: string; caption?: RichString; notes?: { line: number; text: RichString }[] }
  | { type: 'table'; head: string[]; rows: RichString[][] }
  /**
   * Predict-then-test: the learner commits to a guess before touching the lab. Picking an option reveals
   * its `why`; `tryIt` then tells them what to change in the lab to check. Exactly one option is correct.
   */
  | {
      type: 'predict'
      id: string
      prompt: RichString
      options: { text: RichString; correct?: boolean; why: RichString }[]
      tryIt: RichString
    }
  | {
      type: 'walkthrough'
      title: string
      steps: { text: RichString; math?: string; highlight?: string[] }[]
    }

export interface Section {
  id: string
  title: string
  blocks: Block[]
}

export type ControlValue = number | string | boolean

export type LabControl =
  | {
      type: 'choice'
      id: string
      label: string
      componentId: string
      prop: string
      /** skipOnClick: clicking the part in the diagram never lands on this option (e.g. "No resistor"). */
      options: { label: string; value: ControlValue; skipOnClick?: boolean }[]
    }
  | {
      type: 'slider'
      id: string
      label: string
      componentId: string
      prop: string
      min: number
      max: number
      step: number
      unit: string
    }
  | {
      type: 'toggle'
      id: string
      label: string
      componentId: string
      prop: string
      onLabel: string
      offLabel: string
    }
  /** Swap a diode/LED's terminals (and its layout from/to). */
  | { type: 'flip'; id: string; label: string; componentId: string }

export interface Readout {
  componentId: string
  quantity: 'current' | 'voltage' | 'power'
  label: string
}

export interface Challenge {
  id: string
  prompt: RichString
  hint: RichString
  success: RichString
  /** Pure function of the live, solved circuit. */
  check: (result: SolveResult, circuit: Circuit) => boolean
}

export interface Lab {
  title: string
  intro: RichString
  circuit: Circuit
  layout: CircuitLayout
  controls: LabControl[]
  readouts: Readout[]
  challenges: Challenge[]
  /** Clicking a part in the diagram advances this control (choice → next option, toggle/flip → toggle). */
  clickControls?: Record<string, string>
}

export type QuizQuestion =
  | {
      id: string
      type: 'choice'
      prompt: RichString
      /** Exactly one option is correct. Every option explains why it is right or wrong. */
      options: { text: RichString; correct?: boolean; why: RichString }[]
    }
  | {
      id: string
      type: 'numeric'
      prompt: RichString
      answer: number
      /** Relative tolerance, e.g. 0.05 accepts ±5 %. */
      tolerance: number
      unit: string
      hint: RichString
      explanation: RichString
    }

export interface RealBuild {
  parts: string[]
  steps: RichString[]
  safety?: RichString[]
  /** Illustrated wiring for the finished build; must connect the same way as the lab circuit. */
  breadboard?: BreadboardLayout
  /** Breadboard part ids each step places or uses, aligned with `steps` (empty array for steps with none). */
  stepParts?: string[][]
}

export interface Lesson {
  id: string
  day: number
  phase: number
  title: string
  tagline: string
  minutes: number
  objectives: string[]
  sections: Section[]
  lab?: Lab
  quiz: QuizQuestion[]
  realBuild?: RealBuild
}

export interface CurriculumDay {
  day: number
  title: string
  /** Present when an interactive lesson exists for this day. */
  lessonId?: string
}

export interface Phase {
  n: number
  title: string
  summary: string
  days: CurriculumDay[]
}

/** A real-world part the learner can explore: a zoomable model with labelled features, plus how to use it. */
export interface PartInfo {
  id: PartId
  name: string
  category: 'board' | 'passive' | 'semiconductor' | 'input' | 'output' | 'sensor' | 'power' | 'tool'
  summary: RichString
  /** 'kit': in a typical Elegoo Uno starter kit; 'buy': needs buying (with a rough price). */
  availability: { source: 'kit' } | { source: 'buy'; price: string }
  /** Each feature is a hotspot on the model; `anchor` must be one of PART_ANCHORS[id]. */
  features: { anchor: string; title: string; detail: RichString }[]
  pins?: { name: string; detail: RichString }[]
  /** Real-life wiring, step by step. */
  howToConnect: RichString[]
  mistakes: RichString[]
  topicIds: string[]
  related?: PartId[]
  /** A lesson that uses this part, if any. */
  lessonIds?: string[]
}

/** Named hotspot points each part model provides (the viz owns geometry; content owns the words). */
export const PART_ANCHORS = {
  'arduino-uno': ['usb', 'barrel-jack', 'regulator', 'atmega328p', 'crystal', 'reset-button', 'usb-chip', 'power-led', 'l-led', 'tx-rx-leds', 'digital-header', 'power-header', 'analog-header', 'icsp'],
  'esp32-devkit': ['esp32-module', 'antenna', 'usb', 'usb-uart', 'regulator', 'en-button', 'boot-button', 'power-led', 'gpio2-led', 'left-header', 'right-header', 'pin-3v3', 'pin-vin', 'pin-gnd'],
  breadboard: ['terminal-strip', 'centre-gap', 'power-rail-plus', 'power-rail-minus', 'column-numbers', 'row-letters'],
  resistor: ['body', 'bands', 'tolerance-band', 'lead'],
  led: ['lens', 'anode-leg', 'cathode-leg', 'flat-edge', 'die'],
  'push-button': ['plunger', 'legs-connected', 'legs-switched'],
  potentiometer: ['knob', 'pin-end-a', 'pin-wiper', 'pin-end-b'],
  'electrolytic-capacitor': ['can', 'negative-stripe', 'long-leg', 'vent'],
  'diode-1n4007': ['body', 'cathode-band', 'anode-lead', 'cathode-lead'],
  'servo-sg90': ['horn', 'case', 'wire-signal', 'wire-power', 'wire-ground'],
  'hc-sr04': ['transmitter', 'receiver', 'pin-vcc', 'pin-trig', 'pin-echo', 'pin-gnd', 'crystal'],
  'jumper-wire': ['male-pin', 'female-socket', 'housing'],
  'battery-9v': ['battery', 'snap', 'lead-red', 'lead-black'],
} as const satisfies Record<string, readonly string[]>

export type PartId = keyof typeof PART_ANCHORS

/** Topic-wise entry point, cutting across the day-by-day curriculum. */
export interface Topic {
  id: string
  title: string
  summary: RichString
  /** Lessons in suggested order (ids from `lessons`). */
  lessonIds: string[]
  partIds: PartId[]
  /** Curriculum days that belong to this topic (including ones without a lesson yet). */
  days: number[]
}
