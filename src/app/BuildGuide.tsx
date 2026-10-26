import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { getPart } from '../content/parts'
import type { PartId, PartInfo, RealBuild, RichString } from '../content/types'
import type { Circuit, SolveResult } from '../sim/types'
import { Icon } from '../ui/primitives'
import { RichText } from '../ui/RichText'
import { BreadboardView } from '../viz/BreadboardView'
import { IsoBench } from '../viz/iso/IsoBench'
import { href } from './router'
import type { BreadboardLayout } from '../viz/types'

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Breadboard part ids named in a build step, as whole words ("R1" matches "**R1**" but not "R10"), in layout order. */
export function partIdsInStep(step: RichString, layout: BreadboardLayout): string[] {
  return layout.parts
    .map((p) => p.id)
    .filter((id) => id && new RegExp(`(?<![\\w-])${escapeRegExp(id)}(?![\\w-])`).test(step))
}

// Kit-list wording → the part page it is about (first match wins; "Elegoo Uno and USB cable" is the Uno).
const KIT_LINE_PARTS: [RegExp, PartId][] = [
  [/\besp32\b/i, 'esp32-devkit'],
  [/\buno\b/i, 'arduino-uno'],
  [/breadboard/i, 'breadboard'],
  [/1N400\d|\bdiode/i, 'diode-1n4007'],
  [/\bLEDs?\b/, 'led'],
  [/resistor/i, 'resistor'],
  [/potentiometer/i, 'potentiometer'],
  [/capacitor/i, 'electrolytic-capacitor'],
  [/push ?button|\bbutton/i, 'push-button'],
  [/servo|SG90/i, 'servo-sg90'],
  [/HC-SR04|ultrasonic/i, 'hc-sr04'],
  [/9 ?V\b.*batter|batter.*9 ?V/i, 'battery-9v'],
  [/jumper|wires?\b/i, 'jumper-wire'],
]

/** The part page a kit-list line is about, when there is one. */
export function partForKitLine(line: RichString): PartInfo | undefined {
  const hit = KIT_LINE_PARTS.find(([re]) => re.test(line))
  return hit ? getPart(hit[1]) : undefined
}

/** The parts build step `i` lights up: the authored `stepParts[i]`, else (no `stepParts` at all) the ids its text names. */
export function partsForStep(build: RealBuild, i: number): string[] {
  if (build.stepParts) return build.stepParts[i] ?? []
  return build.breadboard ? partIdsInStep(build.steps[i], build.breadboard) : []
}

/** A focus or click owns the highlight this long, so the scroll it causes doesn't hand it to a neighbour. */
const PICK_HOLD_MS = 800

/**
 * The real-kit build: safety first, a tick-off parts list (this visit only), then numbered steps. The current step
 * (`active`) is the one focused, clicked or scrolled across the reading line; the lesson stage shows the wiring
 * diagram for it. Without a stage (`staged` false) the diagram sits above the steps instead.
 */
export function BuildGuide({
  build,
  title,
  active,
  onActive,
  staged = false,
}: {
  build: RealBuild
  title: string
  active: number | null
  onActive: (step: number) => void
  staged?: boolean
}) {
  const [have, setHave] = useState<string[]>([])
  const layout = build.breadboard
  const stepList = useRef<HTMLOListElement>(null)
  const pickedAt = useRef(0)
  const pick = (i: number) => {
    pickedAt.current = Date.now()
    onActive(i)
  }

  // Reading alone moves the highlight: the step crossing the reading line becomes current. The line is mid-viewport
  // on desktop, and lower on phones, where the pinned mini-stage covers the top half.
  useEffect(() => {
    const items = stepList.current?.children
    if (!layout || !items || typeof IntersectionObserver === 'undefined') return
    const line = window.matchMedia?.('(max-width: 1023px)').matches ? 72 : 50
    const io = new IntersectionObserver(
      (entries) => {
        if (Date.now() - pickedAt.current < PICK_HOLD_MS) return
        const hit = entries.find((e) => e.isIntersecting)
        if (hit) onActive(Number((hit.target as HTMLElement).dataset.step))
      },
      { rootMargin: `-${line}% 0px -${100 - line}% 0px` },
    )
    for (const li of items) io.observe(li)
    return () => io.disconnect()
  }, [layout, onActive])

  return (
    <>
      <p className="blk-text">Time to leave the simulator. Here’s everything you need.</p>
      {build.safety && build.safety.length > 0 && (
        <aside className="blk-callout build-safety" data-tone="warn" role="note">
          <p className="blk-callout-title">Before you plug anything in</p>
          <ul>
            {build.safety.map((s, i) => (
              <li key={i}>
                <RichText text={s} />
              </li>
            ))}
          </ul>
        </aside>
      )}
      <fieldset className="build-parts">
        <legend>
          Parts{' '}
          <span className="build-parts-count num">
            {have.length} / {build.parts.length} ready
          </span>
        </legend>
        <ul>
          {build.parts.map((p) => {
            const info = partForKitLine(p)
            return (
              <li key={p}>
                <label>
                  <input
                    type="checkbox"
                    checked={have.includes(p)}
                    onChange={(e) => setHave((h) => (e.target.checked ? [...h, p] : h.filter((x) => x !== p)))}
                  />
                  <span className="build-check" aria-hidden="true">
                    <Icon name="check" size={14} />
                  </span>
                  <span>
                    <RichText text={p} />
                    {info?.availability.source === 'buy' && (
                      <span className="chip part-badge build-buy" data-tone="buy">
                        Not in the kit · ~{info.availability.price.replace(/^~/, '')}
                      </span>
                    )}
                  </span>
                </label>
                {info && (
                  <a className="build-part-link" href={href('parts', info.id)} aria-label={`About the ${info.name}`}>
                    <Icon name="chip" size={18} />
                  </a>
                )}
              </li>
            )
          })}
        </ul>
      </fieldset>
      {layout && !staged && (
        <WiringFigure layout={layout} title={title} highlight={active === null ? [] : partsForStep(build, active)} />
      )}
      <h3>Steps</h3>
      <ol ref={stepList} className="build-steps" data-interactive={layout ? 'yes' : undefined}>
        {build.steps.map((s, i) => {
          const content = (
            <>
              <span className="build-step-num mono" aria-hidden="true">
                {i + 1}
              </span>
              <span>
                <RichText text={s} />
              </span>
            </>
          )
          return (
            <li key={i} data-step={i}>
              {layout ? (
                // Focus and click both select (no toggle), so a mouse click never undoes its own focus.
                <button
                  type="button"
                  className="build-step"
                  aria-current={active === i ? 'step' : undefined}
                  onFocus={() => pick(i)}
                  onClick={() => pick(i)}
                >
                  {content}
                </button>
              ) : (
                content
              )}
            </li>
          )
        })}
      </ol>
    </>
  )
}

export type WiringView = 'iso' | 'flat'

const WIRING_VIEW_KEY = 'ohmlab.wiringView'

function loadWiringView(): WiringView {
  try {
    return localStorage.getItem(WIRING_VIEW_KEY) === 'flat' ? 'flat' : 'iso'
  } catch {
    return 'iso'
  }
}

/**
 * The breadboard for this build: the 3D bench (IsoBench) by default, or the flat BreadboardView for reading exact
 * holes ("3D | Flat", remembered in localStorage), with an expand button that opens the same view large in a modal
 * dialog. `live` is the lab's starting circuit and its solution, so LEDs glow and current pulses on the bench;
 * `children` go under the board.
 */
export function WiringFigure({
  layout,
  title,
  highlight,
  live,
  animate = true,
  children,
}: {
  layout: BreadboardLayout
  title: string
  highlight: string[]
  live?: { circuit: Circuit; result: SolveResult }
  animate?: boolean
  children?: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const expandButton = useRef<HTMLButtonElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [view, setView] = useState(loadWiringView)
  const figure = useRef<HTMLElement>(null)
  const ariaLabel = `Breadboard wiring for ${title}`

  const pickView = (next: WiringView) => {
    setView(next)
    try {
      localStorage.setItem(WIRING_VIEW_KEY, next)
    } catch {
      // Storage blocked: the choice holds for this visit.
    }
  }

  const board = (label: string) =>
    view === 'iso' ? (
      <IsoBench
        layout={layout}
        circuit={live?.circuit}
        result={live?.result}
        highlight={highlight}
        focus={highlight}
        animate={animate}
        ariaLabel={label}
      />
    ) : (
      <BreadboardView layout={layout} ariaLabel={label} highlight={highlight} />
    )

  // The board's aspect ratio, so CSS can fit it to the height of the lesson stage (see `.lesson-stage .wiring-board`):
  // the rendered box's own ratio (it includes the flat board's frame), else the drawing's viewBox.
  useLayoutEffect(() => {
    const box = figure.current?.querySelector<HTMLElement>('.wiring-board > *')
    const vb = figure.current?.querySelector<SVGSVGElement>('.wiring-board svg[viewBox]')?.viewBox?.baseVal
    const ratio = box?.offsetHeight ? box.offsetWidth / box.offsetHeight : vb?.height ? vb.width / vb.height : 0
    if (ratio) figure.current?.style.setProperty('--bb-ratio', String(ratio))
  }, [layout, view])

  // When the board is wider (or taller) than its window, pan to the highlighted parts, without moving the page.
  const highlightKey = highlight.join(' ')
  useEffect(() => {
    const lit = figure.current?.querySelectorAll('.wiring-board .is-highlighted')
    if (!lit?.length) return
    const rects = [...lit].map((el) => el.getBoundingClientRect())
    const x = (Math.min(...rects.map((r) => r.left)) + Math.max(...rects.map((r) => r.right))) / 2
    const y = (Math.min(...rects.map((r) => r.top)) + Math.max(...rects.map((r) => r.bottom))) / 2
    const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    for (const scroller of figure.current?.querySelectorAll<HTMLElement>('.wiring-board, .wiring-board .bb-scroll') ?? []) {
      const box = scroller.getBoundingClientRect()
      const left = scroller.scrollWidth > scroller.clientWidth ? x - (box.left + box.width / 2) : 0
      const top = scroller.scrollHeight > scroller.clientHeight ? y - (box.top + box.height / 2) : 0
      if (left || top) scroller.scrollBy?.({ left, top, behavior })
    }
  }, [highlightKey])

  // showModal gives the focus trap, the inert page and Escape; the large board only mounts while open.
  useEffect(() => {
    if (!expanded || dialog.current?.open) return
    dialog.current?.showModal?.()
    // On a phone the enlarged board is wider than the screen: start panned to the middle, where the parts sit.
    const board = dialog.current?.querySelector('.wiring-dialog-board')
    if (board) board.scrollLeft = (board.scrollWidth - board.clientWidth) / 2
  }, [expanded])

  return (
    <figure ref={figure} className="wiring">
      <div className="wiring-head">
        <figcaption>
          <span className="wiring-title">Wiring diagram</span>
          <span className="wiring-hint">Select a step to highlight its parts.</span>
        </figcaption>
        <div className="wiring-actions">
          <div className="stage-views wiring-views" role="group" aria-label="Wiring view">
            <button type="button" aria-pressed={view === 'iso'} onClick={() => pickView('iso')}>
              3D
            </button>
            <button type="button" aria-pressed={view === 'flat'} onClick={() => pickView('flat')}>
              Flat
            </button>
          </div>
          <button
            ref={expandButton}
            type="button"
            className="btn btn-ghost wiring-expand"
            aria-haspopup="dialog"
            onClick={() => setExpanded(true)}
          >
            <Icon name="expand" size={18} />
            Full screen
          </button>
        </div>
      </div>
      <div className="wiring-board" data-view={view}>
        {board(ariaLabel)}
      </div>
      {children}
      <dialog
        ref={dialog}
        className="wiring-dialog"
        aria-labelledby="wiring-dialog-title"
        onClose={() => {
          setExpanded(false)
          expandButton.current?.focus()
        }}
      >
        {expanded && (
          <>
            <div className="wiring-dialog-bar">
              <h2 id="wiring-dialog-title">Wiring diagram</h2>
              <button
                type="button"
                className="btn btn-ghost"
                autoFocus
                onClick={() => dialog.current?.close()}
              >
                <Icon name="close" size={18} />
                Close
              </button>
            </div>
            <div className="wiring-dialog-board" data-view={view}>
              {board(`${ariaLabel}, enlarged`)}
            </div>
          </>
        )}
      </dialog>
    </figure>
  )
}
