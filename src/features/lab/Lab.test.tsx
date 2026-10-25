import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Lab as LabData } from '../../content/types'
import { ProgressProvider } from '../../progress/store'
import { STORAGE_KEY } from '../../progress/types'
import { Lab } from './Lab'

vi.mock('../../content', () => ({ lessons: [], getLesson: () => undefined, phases: [] }))

const lab: LabData = {
  title: 'Light an LED',
  intro: 'Pick a resistor and watch the **current**.',
  circuit: {
    ground: 'gnd',
    components: [
      { kind: 'vsource', id: 'B1', pos: 'n1', neg: 'gnd', volts: 5 },
      { kind: 'resistor', id: 'R1', a: 'n1', b: 'n2', ohms: 220 },
      { kind: 'led', id: 'D1', anode: 'n2', cathode: 'gnd', color: 'red' },
    ],
  },
  layout: {
    width: 10,
    height: 6,
    parts: [
      { id: 'B1', from: { x: 1, y: 4 }, to: { x: 1, y: 1 } },
      { id: 'R1', from: { x: 2, y: 1 }, to: { x: 5, y: 1 } },
      { id: 'D1', from: { x: 6, y: 1 }, to: { x: 6, y: 4 } },
    ],
    wires: [
      { id: 'w1', points: [{ x: 1, y: 1 }, { x: 2, y: 1 }] },
      { id: 'w2', points: [{ x: 5, y: 1 }, { x: 6, y: 1 }] },
      { id: 'w3', points: [{ x: 6, y: 4 }, { x: 1, y: 4 }] },
    ],
  },
  controls: [
    {
      type: 'choice',
      id: 'r',
      label: 'Resistor',
      componentId: 'R1',
      prop: 'ohms',
      options: [
        { label: '0 Ω', value: 0 },
        { label: '220 Ω', value: 220 },
        { label: '1 kΩ', value: 1000 },
      ],
    },
    { type: 'flip', id: 'flip', label: 'Flip LED', componentId: 'D1' },
  ],
  readouts: [{ componentId: 'D1', quantity: 'current', label: 'LED current' }],
  challenges: [
    {
      id: 'dim',
      prompt: 'Make the LED current less than 5 mA.',
      hint: 'A bigger resistor lets less current through.',
      success: 'Dimmer, and safer!',
      check: (r) => r.ok && r.components.D1.current > 0.0005 && r.components.D1.current < 0.005,
    },
  ],
  clickControls: { R1: 'r', D1: 'flip' },
}

function setup() {
  render(
    <ProgressProvider>
      <Lab lessonId="day01" lab={lab} showFlow={false} />
    </ProgressProvider>,
  )
  return userEvent.setup()
}

const meter = () => within(screen.getByRole('status')).getByText(/A$/).textContent ?? ''
const milliamps = () => {
  const [, n, unit] = /^([\d.]+) (mA|µA|A|nA)$/.exec(meter()) ?? []
  return Number(n) * ({ A: 1e3, mA: 1, µA: 1e-3, nA: 1e-6 }[unit] ?? NaN)
}

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('Lab', () => {
  it('renders the lab region, the diagram and a live readout', () => {
    setup()
    const region = screen.getByRole('region', { name: 'Circuit lab' })
    expect(within(region).getByText('LED current')).toBeInTheDocument()
    expect(milliamps()).toBeGreaterThan(10)
    expect(milliamps()).toBeLessThan(17)
    expect(screen.getByRole('button', { name: /^Resistor R1, 220 Ω/ })).toBeInTheDocument()
  })

  it('updates the readout when a control changes and completes a satisfied challenge', async () => {
    const user = setup()
    expect(screen.queryByText('Dimmer, and safer!')).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '1 kΩ' }))
    expect(milliamps()).toBeLessThan(5)
    expect(screen.getByText('Dimmer, and safer!')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).lessons.day01.challengesDone).toEqual(['dim'])
  })

  it('shows challenges completed earlier as done', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        lessons: { day01: { stepsSeen: [], challengesDone: ['dim'], quizBest: 0, quizAttempts: 0 } },
        achievements: {},
        activeDays: [],
      }),
    )
    setup()
    expect(screen.getByText('Dimmer, and safer!')).toBeInTheDocument()
    expect(screen.queryByText('Hint')).not.toBeInTheDocument()
  })

  it('clicking a part advances its control, and Reset circuit restores it', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: /^Resistor R1, 220 Ω/ }))
    expect(screen.getByRole('radio', { name: '1 kΩ' })).toBeChecked()
    expect(screen.getByRole('button', { name: /^Resistor R1, 1 kΩ/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset circuit' }))
    expect(screen.getByRole('radio', { name: '220 Ω' })).toBeChecked()
    expect(milliamps()).toBeGreaterThan(10)
  })

  it('flip swaps the LED terminals so it stops conducting', async () => {
    const user = setup()
    const flip = screen.getByRole('button', { name: /Flip LED/ })
    expect(flip).toHaveAttribute('aria-pressed', 'false')
    await user.click(flip)
    expect(flip).toHaveAttribute('aria-pressed', 'true')
    expect(milliamps()).toBeLessThan(0.01)
    expect(screen.getByRole('button', { name: /^LED D1 \(red\), off/ })).toBeInTheDocument()

    await user.click(flip)
    expect(milliamps()).toBeGreaterThan(10)
  })

  it('warns when a part burns out and unlocks Magic Smoke', async () => {
    const user = setup()
    await user.click(screen.getByRole('radio', { name: '0 Ω' }))
    const alerts = screen.getAllByRole('alert').map((a) => a.textContent).join(' ')
    expect(alerts).toMatch(/would be dead/)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).achievements['magic-smoke']).toBeTruthy()
  })
})
