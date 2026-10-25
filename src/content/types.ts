import type { Circuit, SolveResult } from '../sim/types'
import type { CircuitLayout } from '../viz/types'

/** Inline text supports **bold**, *emphasis* and `code` (see src/ui/RichText.tsx). */
export type RichString = string

export type Block =
  | { type: 'text'; text: RichString }
  | { type: 'callout'; tone: 'tip' | 'warn' | 'info'; title?: string; text: RichString }
  | { type: 'formula'; expr: string; caption?: RichString }
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
