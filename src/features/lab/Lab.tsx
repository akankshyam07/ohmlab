import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ControlValue, Lab as LabData, LabControl, Readout } from '../../content/types'
import { useProgress } from '../../progress/store'
import { SIM_LIMITATIONS } from '../../sim/limitations'
import { solveDC } from '../../sim/solver'
import type { Circuit, Component, ComponentKind, ComponentStatus, SolveResult } from '../../sim/types'
import { formatSI } from '../../ui/format'
import { RichText } from '../../ui/RichText'
import type { CircuitLayout } from '../../viz/types'
import { CircuitView } from '../../viz/CircuitView'
import './Lab.css'

const UNIT: Record<Readout['quantity'], string> = { current: 'A', voltage: 'V', power: 'W' }
// Like a bench multimeter: readings below the meter's resolution show as 0, so solver leakage
// (picoamps through a reversed LED) isn't presented as a real current.
const RESOLUTION: Record<Readout['quantity'], number> = { current: 1e-7, voltage: 1e-3, power: 1e-6 }
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
  const aboutRef = useRef<HTMLDetailsElement>(null)
  const [bannersOpen, setBannersOpen] = useState(false)

  // A different lab (new lesson) starts fresh.
  if (source !== lab) {
    setSource(lab)
    setCircuit(clone(lab.circuit))
    setLayout(clone(lab.layout))
    setDoneBefore(done)
  }

  const result = useMemo(() => solveDC(circuit), [circuit])

  const withStatus = (...statuses: ComponentStatus[]) =>
    Object.entries(result.components).filter(([, r]) => statuses.includes(r.status))
  const burnt = withStatus('burnt')
  const stressed = withStatus('overcurrent', 'overpower')
  const overvolted = withStatus('overvoltage')
  const isShort = !result.ok && /short/i.test(result.error ?? '')

  useEffect(() => {
    if (isShort) unlock('short-circuit')
    if (burnt.length > 0) unlock('magic-smoke')
  }, [isShort, burnt.length, unlock])

  // Challenges unlock in order and only the learner's own moves complete them: each change is checked
  // against the first unfinished challenge alone. So an accidental state can't tick off a challenge the
  // learner hasn't reached, and one that just became active waits for the next move.
  const active = lab.challenges.find((ch) => !done.includes(ch.id))
  const change = (next: Circuit) => {
    setCircuit(next)
    if (active && passes(active.check, solveDC(next), next)) completeChallenge(lessonId, active.id)
  }

  const componentOf = (id: string) => circuit.components.find((c) => c.id === id)

  const applyControl = (control: LabControl, value?: ControlValue) => {
    if (control.type === 'flip') {
      const [c, l] = flip(circuit, layout, control.componentId)
      change(c)
      setLayout(l)
    } else if (value !== undefined) {
      change(setProp(circuit, control.componentId, control.prop, value))
    }
  }

  const onPartClick = (componentId: string) => {
    const control = lab.controls.find((c) => c.id === lab.clickControls?.[componentId])
    if (!control) return
    if (control.type === 'flip') return applyControl(control)
    if (control.type === 'slider') return
    const current = readProp(circuit, control.componentId, control.prop)
    if (control.type === 'toggle') return applyControl(control, !current)
    // Advance to the next option a click may land on; skipOnClick ones (e.g. "No resistor") need a deliberate choice.
    const { options } = control
    const i = options.findIndex((o) => o.value === current)
    for (let step = 1; step <= options.length; step++) {
      const option = options[(i + step + options.length) % options.length]
      if (!option.skipOnClick) return applyControl(control, option.value)
    }
  }

  const reset = () => {
    change(clone(lab.circuit))
    setLayout(clone(lab.layout))
  }

  const showAbout = () => {
    const about = aboutRef.current
    if (!about) return
    about.open = true
    about.scrollIntoView?.({ block: 'nearest' }) // absent in jsdom
    about.querySelector('summary')?.focus()
  }
  const aboutLink = (
    <button type="button" className="lab-link" onClick={showAbout}>
      How the simulator works
    </button>
  )

  // In a short stage each banner is a one-line chip; "More" shows the full text (it is always in the DOM).
  const banner = (key: string, tone: 'danger' | 'warn', alert: boolean, headline: string, text: ReactNode, link = true) => (
    <div
      key={key}
      role={alert ? 'alert' : undefined}
      aria-live={alert ? undefined : 'polite'}
      className={`lab-banner lab-banner--${tone}`}
      data-expanded={bannersOpen || undefined}
    >
      <span className="lab-banner-text">
        <strong>{headline}</strong> {text}
      </span>{' '}
      {link && aboutLink}
      <button
        type="button"
        className="lab-banner-toggle"
        aria-expanded={bannersOpen}
        onClick={() => setBannersOpen((open) => !open)}
      >
        {bannersOpen ? 'Less' : 'More'}
      </button>
    </div>
  )

  const doneCount = lab.challenges.filter((ch) => done.includes(ch.id)).length
  const fresh = lab.challenges.filter((ch) => done.includes(ch.id) && !doneBefore.includes(ch.id))
  const latest = fresh.at(-1)

  return (
    <section aria-label="Circuit lab" className="lab">
      {/* lab-main is what must fit in the stage; lab-more scrolls below it on short (phone) stages. */}
      <div className="lab-main">
        <header className="lab-header">
          <h2 className="lab-title">{lab.title}</h2>
          <button type="button" className="lab-reset" onClick={reset}>
            <span className="lab-reset-icon" aria-hidden="true">
              ↺
            </span>
            <span className="lab-reset-text">Reset circuit</span>
          </button>
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

        {lab.readouts.length > 0 && (
          <div className="lab-meters">
            {lab.readouts.map((readout) => {
              const r = result.ok ? result.components[readout.componentId] : undefined
              const raw = r?.[readout.quantity]
              // Direction is shown by the diagram; meters show magnitude except for voltage, whose sign beginners probe.
              const signed = raw === undefined ? undefined : readout.quantity === 'voltage' ? raw : Math.abs(raw)
              const value = signed !== undefined && Math.abs(signed) < RESOLUTION[readout.quantity] ? 0 : signed
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

        {!result.ok &&
          banner('settle', 'danger', true, 'The circuit can’t settle.', (
            <>
              {result.error}
              {isShort && ' Current would rush straight through with nothing to limit it. Real batteries get hot and wires can melt.'}
            </>
          ), false)}
        {burnt.map(([id]) => {
          const kind = KIND_NAME[componentOf(id)?.kind ?? 'resistor']
          return banner(id, 'danger', true, `${id} burnt out.`, (
            <>
              In real life this {kind} would be dead (maybe with a puff of smoke). That’s why we simulate first.
              The meters show the current at the instant it failed; a real {kind} usually breaks open then, so the
              current stops.
            </>
          ))
        })}
        {overvolted.map(([id, r]) =>
          banner(
            id,
            'warn',
            true,
            `${id} is reverse-biased by ${Math.abs(r.voltage).toFixed(1)} V;`,
            componentOf(id)?.kind === 'led'
              ? 'most LEDs are rated for only 5 V in reverse and can be damaged.'
              : 'that’s more than this diode is rated to block, and it can be damaged.',
          ),
        )}
        {stressed.map(([id, r]) =>
          banner(
            id,
            'warn',
            false,
            `${id} is under stress.`,
            r.status === 'overpower'
              ? 'This resistor is turning more power into heat than it’s rated for. A real one would get very hot.'
              : componentOf(id)?.kind === 'led'
                ? 'More than the 20 mA a typical LED is rated for. A real one would run hot and wear out quickly.'
                : 'More current than it’s made for. A real part would run hot and wear out quickly.',
          ),
        )}

        {lab.controls.length > 0 && (
          <div className="lab-controls">
            {lab.controls.map((control) => (
              <Control
                key={control.id}
                control={control}
                value={control.type === 'flip' ? undefined : readProp(circuit, control.componentId, control.prop)}
                flipped={control.type === 'flip' && isFlipped(lab.circuit, circuit, control.componentId)}
                onChange={(v) => applyControl(control, v)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="lab-more">
        <p className="lab-intro">
          <RichText text={lab.intro} />
        </p>

        {lab.challenges.length > 0 && (
          <div className="lab-tray">
            <details className="lab-tray-details">
              <summary className="lab-tray-summary">
                <span className="lab-tray-count">
                  Challenges {doneCount} / {lab.challenges.length}
                </span>
                <span className="lab-tray-next">
                  {active ? (
                    <>
                      <span className="lab-tray-next-label">Next: </span>
                      <RichText text={active.prompt} />
                    </>
                  ) : (
                    'All done!'
                  )}
                </span>
              </summary>
              <ol className="lab-challenge-list">
                {lab.challenges.map((ch) => {
                  const isDone = done.includes(ch.id)
                  const isLocked = !isDone && ch !== active
                  return (
                    <li
                      key={ch.id}
                      className={`lab-challenge ${isDone ? 'lab-challenge--done' : ''} ${isLocked ? 'lab-challenge--locked' : ''}`}
                    >
                      <span className="lab-challenge-check" aria-hidden="true">
                        {isDone ? '✓' : ''}
                      </span>
                      <div className="lab-challenge-body">
                        <p className="lab-challenge-prompt">
                          <RichText text={ch.prompt} />
                          {isDone && <span className="sr-only"> (done)</span>}
                          {isLocked && <span className="lab-tag">Up next</span>}
                        </p>
                        {isDone && ch !== latest && (
                          <p className="lab-challenge-success">
                            <RichText text={ch.success} />
                          </p>
                        )}
                        {ch === active && (
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
            </details>
            {/* The just-solved challenge's explanation stays visible while the tray is closed. */}
            <p className="lab-tray-flash" aria-live="polite">
              {latest && (
                <span key={latest.id} className="lab-celebrate">
                  <span aria-hidden="true">✓ </span>
                  <RichText text={latest.success} />
                </span>
              )}
            </p>
          </div>
        )}

        <details className="lab-about" ref={aboutRef}>
          <summary>About this simulator</summary>
          <ul>
            {SIM_LIMITATIONS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      </div>
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
