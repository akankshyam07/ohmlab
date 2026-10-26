import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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

/**
 * The phone mini-stage form of a meter label: "Voltage across D1" → "V across D1", "Current from the supply
 * (through R1)" → "I from supply". The full label stays as the accessible name.
 */
export function shortMeterLabel(label: string): string {
  return label
    .replace(/\s*\([^)]*\)$/, '')
    .replace(/^Voltage (?=\S)/, 'V ')
    .replace(/^Current (?=\S)/, 'I ')
    .replace(/\bthe /g, '')
}

const CHIP_MS = 4000

const CONTROL_STOP = new Set('the and to of on in it its a an so is are be with at least while get make your'.split(' '))
const tokens = (text: string) =>
  text
    .toLowerCase()
    .replace(/\*/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => (w.length >= 2 || /\d/.test(w)) && !CONTROL_STOP.has(w))

/**
 * The control a challenge prompt names: prompt words found in a control's label or option labels, each worth
 * 1 / (number of controls using it), so "blue" picks "LED colour" while "LED" alone (in several labels) picks none.
 */
export function controlForPrompt(controls: LabControl[], prompt: string): string | undefined {
  const words = new Set(tokens(prompt))
  const vocab = controls.map(
    (c) => new Set(tokens([c.label, ...(c.type === 'choice' ? c.options.map((o) => o.label) : [])].join(' '))),
  )
  const df = (w: string) => vocab.filter((v) => v.has(w)).length
  let best: string | undefined
  let bestScore = 0.99 // at least one distinctive word
  controls.forEach((c, i) => {
    const score = [...vocab[i]].reduce((sum, w) => sum + (words.has(w) ? 1 / df(w) : 0), 0)
    if (score > bestScore) [best, bestScore] = [c.id, score]
  })
  return best
}

/**
 * Scroll `scroller` (not the page) to show `el`: its bottom row of buttons first (a legend may stay under the
 * pinned alerts, `topInset`), and the start of a control wider than a sideways row.
 */
function reveal(scroller: HTMLElement | null, el: Element, topInset = 0) {
  if (!scroller) return
  const s = scroller.getBoundingClientRect()
  const e = el.getBoundingClientRect()
  if (e.bottom > s.bottom) scroller.scrollTop += e.bottom - s.bottom
  else if (e.top < s.top + topInset) scroller.scrollTop -= s.top + topInset - e.top
  // 32 px clears the sideways row's start fade (Lab.css, --fade-start).
  if (e.left < s.left || e.right > s.right) scroller.scrollLeft += e.left - s.left - 32
}

/** Marks a scroller with data-overflow="start end top bottom" (the edges hiding more) so CSS can fade them. */
function useOverflowEdges<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  // No deps: content (meter values, alerts) changes on every render and can change the overflow.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const edges = []
      if (el.scrollLeft > 1) edges.push('start')
      if (el.scrollLeft < el.scrollWidth - el.clientWidth - 1) edges.push('end')
      if (el.scrollTop > 1) edges.push('top')
      if (el.scrollTop < el.scrollHeight - el.clientHeight - 1) edges.push('bottom')
      el.dataset.overflow = edges.join(' ')
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update)
    observer?.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      observer?.disconnect()
    }
  })
  return ref
}

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
  const [introOpen, setIntroOpen] = useState(false)
  // A short-lived note over the schematic: a challenge just completed, or a later one was met too early.
  const [chip, setChip] = useState<{ id: string; locked: boolean }>()
  const stageRef = useRef<HTMLDivElement>(null)
  const trayRef = useRef<HTMLDetailsElement>(null)
  const metersRef = useOverflowEdges<HTMLDivElement>()
  const controlsRef = useOverflowEdges<HTMLDivElement>()
  const dockRef = useOverflowEdges<HTMLDivElement>()

  // A different lab (new lesson) starts fresh.
  if (source !== lab) {
    setSource(lab)
    setCircuit(clone(lab.circuit))
    setLayout(clone(lab.layout))
    setDoneBefore(done)
    setChip(undefined)
  }

  useEffect(() => {
    if (!chip) return
    const timer = setTimeout(() => setChip(undefined), CHIP_MS)
    return () => clearTimeout(timer)
  }, [chip])

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
  // Bring the control the next challenge needs into view inside the dock (and the phone's sideways row).
  useEffect(() => {
    const id = active && controlForPrompt(lab.controls, active.prompt)
    const el = id && dockRef.current?.querySelector(`[data-control="${id}"]`)
    if (!el) return
    reveal(controlsRef.current, el)
    // Alerts stay pinned at the top of the dock, so the control must show below them.
    reveal(dockRef.current, el, dockRef.current?.querySelector<HTMLElement>('.lab-alerts')?.offsetHeight)
  }, [active, lab.controls, controlsRef, dockRef])
  const change = (next: Circuit) => {
    setCircuit(next)
    if (!active) return
    const solved = solveDC(next)
    if (passes(active.check, solved, next)) {
      completeChallenge(lessonId, active.id)
      setChip({ id: active.id, locked: false })
      return
    }
    // Meeting a later challenge early doesn't count; say so instead of staying silent.
    const early = lab.challenges.find((ch) => ch !== active && !done.includes(ch.id) && passes(ch.check, solved, next))
    if (early) setChip({ id: early.id, locked: true })
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

  // Each banner is a one-line chip; "More" shows the full text (it is always in the DOM).
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
  const chipChallenge = chip && lab.challenges.find((ch) => ch.id === chip.id)

  // On a tall (desktop) stage the open challenge list is a sheet over the meters and controls, sized so it
  // never covers the schematic.
  const sizeTraySheet = (tray: HTMLDetailsElement) => {
    const stage = stageRef.current
    if (!tray.open || !stage) return
    const room = tray.getBoundingClientRect().top - stage.getBoundingClientRect().bottom - 8
    tray.style.setProperty('--sheet-room', `${Math.max(Math.round(room), 140)}px`)
  }

  return (
    <section aria-label="Circuit lab" className={`lab ${showFlow === false ? 'lab--still' : ''}`}>
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

        <div className="lab-intro" data-expanded={introOpen || undefined}>
          <p className="lab-intro-text" id={`lab-intro-${lessonId}`}>
            <RichText text={lab.intro} />
          </p>
          <button
            type="button"
            className="lab-link lab-intro-toggle"
            aria-expanded={introOpen}
            aria-controls={`lab-intro-${lessonId}`}
            onClick={() => setIntroOpen((open) => !open)}
          >
            {introOpen ? 'Hide details' : 'Show details'}
          </button>
        </div>

        <div className="lab-stage" ref={stageRef}>
          <CircuitView
            circuit={circuit}
            layout={layout}
            result={result}
            ariaLabel={`${lab.title}: circuit diagram`}
            onPartClick={onPartClick}
            highlight={highlight}
            showFlow={showFlow}
          />
          <div className="lab-chip-region" aria-live="polite">
            {chipChallenge && chip && (
              <div key={`${chip.id}-${chip.locked}`} className={`lab-chip ${chip.locked ? 'lab-chip--early' : ''}`}>
                {chip.locked ? (
                  <>
                    <p className="lab-chip-line">
                      That’s a later challenge: <RichText text={chipChallenge.prompt} />
                    </p>
                    {active && (
                      <p className="lab-chip-next">
                        Finish this one first: <RichText text={active.prompt} />
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="lab-chip-line">
                      <span aria-hidden="true">✓ </span>Challenge done: <RichText text={chipChallenge.prompt} />
                      <span className="sr-only">
                        {' '}
                        <RichText text={chipChallenge.success} />
                      </span>
                    </p>
                    <p className="lab-chip-next">
                      {active ? (
                        <>
                          Next: <RichText text={active.prompt} />
                        </>
                      ) : (
                        'All challenges done.'
                      )}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {lab.readouts.length > 0 && (
          <div className="lab-meters" ref={metersRef}>
            {lab.readouts.map((readout) => {
              const r = result.ok ? result.components[readout.componentId] : undefined
              const raw = r?.[readout.quantity]
              // Direction is shown by the diagram; meters show magnitude except for voltage, whose sign beginners probe.
              const signed = raw === undefined ? undefined : readout.quantity === 'voltage' ? raw : Math.abs(raw)
              const value = signed !== undefined && Math.abs(signed) < RESOLUTION[readout.quantity] ? 0 : signed
              return (
                <Meter
                  key={`${readout.componentId}-${readout.quantity}`}
                  readout={readout}
                  value={value}
                  // The solve is the moment of failure; the burnt part has since opened the circuit (see the alert).
                  atFailure={burnt.length > 0 && readout.quantity !== 'voltage'}
                  noteId={`lab-meter-note-${lessonId}-${readout.componentId}-${readout.quantity}`}
                  animate={showFlow !== false}
                />
              )
            })}
          </div>
        )}

        <div className="lab-dock" ref={dockRef}>
          <div className="lab-alerts">
            {!result.ok &&
              banner('settle', 'danger', true, 'The circuit can’t settle.', (
                <>
                  {result.error}
                  {isShort && ' Current would rush straight through with nothing to limit it. Real batteries get hot and wires can melt.'}
                </>
              ), false)}
            {burnt.map(([id]) => {
              const kind = KIND_NAME[componentOf(id)?.kind ?? 'resistor']
              return banner(id, 'danger', true, `${id} burnt out: the circuit is now open (0 A).`, (
                <>
                  In real life this {kind} would be dead (maybe with a puff of smoke). That’s why we simulate first.
                  A burnt {kind} usually breaks open, so no current flows now. The meters show the peak, the current
                  at the instant it failed.
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
          </div>

          {lab.controls.length > 0 && (
            <div className="lab-controls" ref={controlsRef}>
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
      </div>

      <div className="lab-more">
        {lab.challenges.length > 0 && (
          <div className="lab-tray">
            <details className="lab-tray-details" ref={trayRef} onToggle={(e) => sizeTraySheet(e.currentTarget)}>
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
                        {isDone && (
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
            {/* The just-solved challenge's explanation stays in view while the tray is closed (one line on a tall
                stage, where it opens the tray with the full text). */}
            {latest && (
              <button
                type="button"
                className="lab-tray-flash"
                onClick={() => {
                  if (trayRef.current) trayRef.current.open = true
                }}
              >
                <span key={latest.id} className="lab-celebrate">
                  <span aria-hidden="true">✓ </span>
                  <RichText text={latest.success} />
                </span>
              </button>
            )}
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

/** A CSS time token in ms, e.g. --dur-tween; 0 under prefers-reduced-motion (tokens.css) or when unset. */
function cssDuration(el: Element | null, name: string): number {
  if (!el) return 0
  const v = getComputedStyle(el).getPropertyValue(name).trim()
  return v.endsWith('ms') ? parseFloat(v) : v.endsWith('s') ? parseFloat(v) * 1000 : 0
}

/** The value to draw while gliding (ease-out, one rAF per frame) from the last shown value to `target`. */
function useTween(target: number | undefined, duration: () => number): number | undefined {
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  const [gliding, setGliding] = useState(false)
  useEffect(() => {
    const start = from.current
    const ms = duration()
    if (target === undefined || start === undefined || start === target || ms <= 0) {
      from.current = target
      setGliding(false)
      return
    }
    const t0 = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const k = Math.min(1, (now - t0) / ms)
      from.current = start + (target - start) * (1 - (1 - k) ** 3)
      setShown(from.current)
      setGliding(k < 1)
      if (k < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [target]) // duration is read fresh on each change; it is not a trigger
  return gliding ? shown : target
}

function Meter({
  readout,
  value,
  atFailure,
  noteId,
  animate,
}: {
  readout: Readout
  value: number | undefined
  atFailure: boolean
  noteId: string
  animate: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const duration = () => (animate ? cssDuration(ref.current, '--dur-tween') : 0)
  const shown = useTween(value, duration)
  const unit = UNIT[readout.quantity]
  const final = value === undefined ? '—' : formatSI(value, unit)
  const short = shortMeterLabel(readout.label)

  // A brief glow in the meter's signal colour when its reading changes (not on first render).
  const last = useRef(final)
  useEffect(() => {
    if (last.current === final) return
    last.current = final
    const el = ref.current
    if (!el || duration() <= 0) return
    const colour = getComputedStyle(el).getPropertyValue('--meter').trim() || 'currentColor'
    el.animate?.(
      [
        { boxShadow: `0 0 0 1px ${colour}, 0 0 18px -2px ${colour}` },
        { boxShadow: `0 0 0 1px transparent, 0 0 18px -2px transparent` },
      ],
      { duration: 600, easing: 'ease-out' },
    )
  }, [final]) // only a new reading glows

  return (
    <div
      ref={ref}
      role="status"
      className={`lab-meter lab-meter--${readout.quantity}`}
      aria-describedby={atFailure ? noteId : undefined}
    >
      <span className="lab-meter-label">
        <span className="lab-meter-long">{readout.label}</span>
        {short !== readout.label && (
          <span className="lab-meter-short" aria-hidden="true">
            {short}
          </span>
        )}
      </span>
      <span className="lab-meter-reading">
        {/* The gliding digits are for the eye; the status announces (and tests read) only the final value. */}
        <span className="lab-meter-digits" aria-hidden="true">
          {shown === undefined ? '—' : formatSI(shown, unit)}
        </span>
        <span className="lab-meter-value sr-only">{final}</span>
        {atFailure && (
          <span className="lab-meter-note" id={noteId}>
            peak at failure
          </span>
        )}
      </span>
    </div>
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
        <fieldset className="lab-control lab-choice" data-control={control.id}>
          <legend className="lab-control-label">{control.label}</legend>
          <Segments value={value}>
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
          </Segments>
        </fieldset>
      )
    case 'slider': {
      const n = typeof value === 'number' ? value : control.min
      const shown = formatSI(n, control.unit)
      return (
        <label className="lab-control lab-slider" data-control={control.id}>
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
        <label className="lab-control lab-toggle" data-control={control.id}>
          <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} />
          <span className="lab-toggle-track" aria-hidden="true" />
          <span className="lab-control-label">{control.label}</span>
          <span className="lab-toggle-state">{on ? control.onLabel : control.offLabel}</span>
        </label>
      )
    }
    case 'flip':
      return (
        <div className="lab-control" data-control={control.id}>
          <button type="button" className="lab-flip" aria-pressed={flipped} onClick={() => onChange()}>
            ⇄ {control.label}
          </button>
        </div>
      )
  }
}

/** A segmented control whose selected-state pill slides between options (the move is a CSS transition). */
function Segments({ value, children }: { value: ControlValue | undefined; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState<{ x: number; y: number; w: number; h: number }>()
  useLayoutEffect(() => {
    const box = ref.current
    if (!box) return
    const measure = () => {
      const checked = box.querySelector<HTMLElement>('input:checked')?.closest<HTMLElement>('.lab-segment')
      setThumb(
        checked
          ? { x: checked.offsetLeft, y: checked.offsetTop, w: checked.offsetWidth, h: checked.offsetHeight }
          : undefined,
      )
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(box)
    return () => observer?.disconnect()
  }, [value])
  return (
    <div className="lab-segments" ref={ref}>
      {thumb && (
        <span
          className="lab-segments-thumb"
          aria-hidden="true"
          style={{ transform: `translate(${thumb.x}px, ${thumb.y}px)`, width: thumb.w, height: thumb.h }}
        />
      )}
      {children}
    </div>
  )
}
