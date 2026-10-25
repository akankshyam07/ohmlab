import { useEffect, useMemo, useState } from 'react'
import type { ControlValue, Lab as LabData, LabControl, Readout } from '../../content/types'
import { useProgress } from '../../progress/store'
import { solveDC } from '../../sim/solver'
import type { Circuit, Component, ComponentKind, SolveResult } from '../../sim/types'
import { formatSI } from '../../ui/format'
import { RichText } from '../../ui/RichText'
import type { CircuitLayout } from '../../viz/types'
import { CircuitView } from '../../viz/CircuitView'
import './Lab.css'

const UNIT: Record<Readout['quantity'], string> = { current: 'A', voltage: 'V', power: 'W' }
const KIND_NAME: Record<ComponentKind, string> = {
  vsource: 'battery',
  resistor: 'resistor',
  led: 'LED',
  diode: 'diode',
  switch: 'switch',
}

const clone = <T,>(x: T): T => structuredClone(x)

function readProp(circuit: Circuit, componentId: string, prop: string): ControlValue | undefined {
  const component = circuit.components.find((c) => c.id === componentId)
  return component ? (component as unknown as Record<string, ControlValue>)[prop] : undefined
}

function setProp(circuit: Circuit, componentId: string, prop: string, value: ControlValue): Circuit {
  return {
    ...circuit,
    components: circuit.components.map((c) => (c.id === componentId ? ({ ...c, [prop]: value } as Component) : c)),
  }
}

/** Swap an LED/diode's terminals in the circuit and its drawn from/to, so the anode stays at `from`. */
function flip(circuit: Circuit, layout: CircuitLayout, componentId: string): [Circuit, CircuitLayout] {
  return [
    {
      ...circuit,
      components: circuit.components.map((c) =>
        c.id === componentId && (c.kind === 'led' || c.kind === 'diode')
          ? { ...c, anode: c.cathode, cathode: c.anode }
          : c,
      ),
    },
    {
      ...layout,
      parts: layout.parts.map((p) => (p.id === componentId ? { ...p, from: p.to, to: p.from } : p)),
    },
  ]
}

function passes(check: LabData['challenges'][number]['check'], result: SolveResult, circuit: Circuit): boolean {
  try {
    return check(result, circuit)
  } catch {
    return false // a check that trips over a failed solve simply hasn't passed yet
  }
}

interface LabProps {
  lessonId: string
  lab: LabData
  highlight?: string[]
  showFlow?: boolean
}

export function Lab({ lessonId, lab, highlight, showFlow }: LabProps) {
  const { progress, completeChallenge, unlock } = useProgress()
  const [source, setSource] = useState(lab)
  const [circuit, setCircuit] = useState(() => clone(lab.circuit))
  const [layout, setLayout] = useState(() => clone(lab.layout))
  const done = progress.lessons[lessonId]?.challengesDone ?? []
  // Challenges finished in an earlier visit show as done without the celebration.
  const [doneBefore, setDoneBefore] = useState(done)

  // A different lab (new lesson) starts fresh.
  if (source !== lab) {
    setSource(lab)
    setCircuit(clone(lab.circuit))
    setLayout(clone(lab.layout))
    setDoneBefore(done)
  }

  const result = useMemo(() => solveDC(circuit), [circuit])

  const burnt = Object.entries(result.components).filter(([, r]) => r.status === 'burnt')
  const stressed = Object.entries(result.components).filter(
    ([, r]) => r.status === 'overcurrent' || r.status === 'overpower',
  )
  const isShort = !result.ok && /short/i.test(result.error ?? '')

  useEffect(() => {
    if (isShort) unlock('short-circuit')
    if (burnt.length > 0) unlock('magic-smoke')
  }, [isShort, burnt.length, unlock])

  const doneKey = done.join('|')
  useEffect(() => {
    const doneNow = doneKey.split('|')
    const passed = lab.challenges.filter((ch) => !doneNow.includes(ch.id) && passes(ch.check, result, circuit))
    for (const ch of passed) completeChallenge(lessonId, ch.id)
  }, [result, circuit, lab, lessonId, doneKey, completeChallenge])

  const componentOf = (id: string) => circuit.components.find((c) => c.id === id)

  const applyControl = (control: LabControl, value?: ControlValue) => {
    if (control.type === 'flip') {
      const [c, l] = flip(circuit, layout, control.componentId)
      setCircuit(c)
      setLayout(l)
    } else if (value !== undefined) {
      setCircuit(setProp(circuit, control.componentId, control.prop, value))
    }
  }

  const onPartClick = (componentId: string) => {
    const control = lab.controls.find((c) => c.id === lab.clickControls?.[componentId])
    if (!control) return
    if (control.type === 'flip') return applyControl(control)
    if (control.type === 'slider') return
    const current = readProp(circuit, control.componentId, control.prop)
    if (control.type === 'toggle') return applyControl(control, !current)
    const i = control.options.findIndex((o) => o.value === current)
    applyControl(control, control.options[(i + 1) % control.options.length].value)
  }

  const reset = () => {
    setCircuit(clone(lab.circuit))
    setLayout(clone(lab.layout))
  }

  return (
    <section aria-label="Circuit lab" className="lab">
      <header className="lab-header">
        <h2 className="lab-title">{lab.title}</h2>
        <p className="lab-intro">
          <RichText text={lab.intro} />
        </p>
      </header>

      <div className="lab-stage">
        <CircuitView
          circuit={circuit}
          layout={layout}
          result={result}
          ariaLabel={`${lab.title}: circuit diagram`}
          onPartClick={onPartClick}
          highlight={highlight}
          showFlow={showFlow}
        />
      </div>

      {!result.ok && (
        <div role="alert" className="lab-banner lab-banner--danger">
          <strong>The circuit can’t settle.</strong> {result.error}
          {isShort && ' Current would rush straight through with nothing to limit it. Real batteries get hot and wires can melt.'}
        </div>
      )}
      {burnt.map(([id]) => {
        const kind = KIND_NAME[componentOf(id)?.kind ?? 'resistor']
        return (
          <div key={id} role="alert" className="lab-banner lab-banner--danger">
            <strong>{id} burnt out.</strong> In real life this {kind} would be dead (maybe with a puff of
            smoke). That’s why we simulate first.
          </div>
        )
      })}
      {stressed.map(([id, r]) => (
        <div key={id} className="lab-banner lab-banner--warn" aria-live="polite">
          <strong>{id} is under stress.</strong>{' '}
          {r.status === 'overpower'
            ? 'This resistor is turning more power into heat than it’s rated for. A real one would get very hot.'
            : 'More current than it’s made for. A real part would run hot and wear out quickly.'}
        </div>
      ))}

      {lab.controls.length > 0 && (
        <div className="lab-controls">
          {lab.controls.map((control) => (
            <Control
              key={control.id}
              control={control}
              value={control.type === 'flip' ? undefined : readProp(circuit, control.componentId, control.prop)}
              flipped={
                control.type === 'flip' &&
                isFlipped(lab.circuit, circuit, control.componentId)
              }
              onChange={(v) => applyControl(control, v)}
            />
          ))}
        </div>
      )}

      {lab.readouts.length > 0 && (
        <div className="lab-meters">
          {lab.readouts.map((readout) => {
            const r = result.ok ? result.components[readout.componentId] : undefined
            const raw = r?.[readout.quantity]
            // Direction is shown by the diagram; meters show magnitude except for voltage, whose sign beginners probe.
            const value = raw === undefined ? undefined : readout.quantity === 'voltage' ? raw : Math.abs(raw)
            return (
              <div
                key={`${readout.componentId}-${readout.quantity}`}
                role="status"
                className={`lab-meter lab-meter--${readout.quantity}`}
              >
                <span className="lab-meter-label">{readout.label}</span>
                <span className="lab-meter-value">{value === undefined ? '—' : formatSI(value, UNIT[readout.quantity])}</span>
              </div>
            )
          })}
        </div>
      )}

      {lab.challenges.length > 0 && (
        <div className="lab-challenges">
          <h3 className="lab-subtitle">Challenges</h3>
          <ol className="lab-challenge-list">
            {lab.challenges.map((ch) => {
              const isDone = done.includes(ch.id)
              return (
                <li
                  key={ch.id}
                  className={`lab-challenge ${isDone ? 'lab-challenge--done' : ''} ${isDone && !doneBefore.includes(ch.id) ? 'lab-challenge--celebrate' : ''}`}
                >
                  <span className="lab-challenge-check" aria-hidden="true">
                    {isDone ? '✓' : ''}
                  </span>
                  <div className="lab-challenge-body">
                    <p className="lab-challenge-prompt">
                      <RichText text={ch.prompt} />
                      {isDone && <span className="visually-hidden"> (done)</span>}
                    </p>
                    {isDone ? (
                      <p className="lab-challenge-success" aria-live="polite">
                        <RichText text={ch.success} />
                      </p>
                    ) : (
                      <details className="lab-hint">
                        <summary>Hint</summary>
                        <p>
                          <RichText text={ch.hint} />
                        </p>
                      </details>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      <button type="button" className="lab-reset" onClick={reset}>
        Reset circuit
      </button>
    </section>
  )
}

function isFlipped(initial: Circuit, circuit: Circuit, componentId: string): boolean {
  const before = initial.components.find((c) => c.id === componentId)
  const now = circuit.components.find((c) => c.id === componentId)
  return !!before && !!now && 'anode' in before && 'anode' in now && before.anode !== now.anode
}

function Control({
  control,
  value,
  flipped,
  onChange,
}: {
  control: LabControl
  value: ControlValue | undefined
  flipped: boolean
  onChange: (value?: ControlValue) => void
}) {
  switch (control.type) {
    case 'choice':
      return (
        <fieldset className="lab-control lab-choice">
          <legend className="lab-control-label">{control.label}</legend>
          <div className="lab-segments">
            {control.options.map((option) => (
              <label key={String(option.value)} className="lab-segment">
                <input
                  type="radio"
                  name={`lab-${control.id}`}
                  checked={option.value === value}
                  onChange={() => onChange(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )
    case 'slider': {
      const n = typeof value === 'number' ? value : control.min
      const shown = formatSI(n, control.unit)
      return (
        <label className="lab-control lab-slider">
          <span className="lab-control-label">
            {control.label} <output className="lab-slider-value">{shown}</output>
          </span>
          <input
            type="range"
            min={control.min}
            max={control.max}
            step={control.step}
            value={n}
            aria-valuetext={shown}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </label>
      )
    }
    case 'toggle': {
      const on = value === true
      return (
        <label className="lab-control lab-toggle">
          <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} />
          <span className="lab-toggle-track" aria-hidden="true" />
          <span className="lab-control-label">{control.label}</span>
          <span className="lab-toggle-state">{on ? control.onLabel : control.offLabel}</span>
        </label>
      )
    }
    case 'flip':
      return (
        <div className="lab-control">
          <button type="button" className="lab-flip" aria-pressed={flipped} onClick={() => onChange()}>
            ⇄ {control.label}
          </button>
        </div>
      )
  }
}
