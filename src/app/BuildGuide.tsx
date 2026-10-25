import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { RealBuild, RichString } from '../content/types'
import { Icon } from '../ui/primitives'
import { RichText } from '../ui/RichText'
import { BreadboardView } from '../viz/BreadboardView'
import type { BreadboardLayout } from '../viz/types'

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Breadboard part ids named in a build step, as whole words ("R1" matches "**R1**" but not "R10"), in layout order. */
export function partIdsInStep(step: RichString, layout: BreadboardLayout): string[] {
  return layout.parts
    .map((p) => p.id)
    .filter((id) => id && new RegExp(`(?<![\\w-])${escapeRegExp(id)}(?![\\w-])`).test(step))
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
      <p className="blk-text">Time to leave the simulator. Here is everything you need from your kit.</p>
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
          <span className="build-parts-count mono">
            {have.length} / {build.parts.length} ready
          </span>
        </legend>
        <ul>
          {build.parts.map((p) => (
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
                </span>
              </label>
            </li>
          ))}
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

/** The breadboard for this build, with an expand button that opens it large in a modal dialog. `children` go under the board. */
export function WiringFigure({
  layout,
  title,
  highlight,
  children,
}: {
  layout: BreadboardLayout
  title: string
  highlight: string[]
  children?: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const expandButton = useRef<HTMLButtonElement>(null)
  const [expanded, setExpanded] = useState(false)
  const figure = useRef<HTMLElement>(null)
  const ariaLabel = `Breadboard wiring for ${title}`

  // The board's aspect ratio, so CSS can fit it to the height of the lesson stage (see `.lesson-stage .wiring-board`).
  useLayoutEffect(() => {
    const vb = figure.current?.querySelector<SVGSVGElement>('.wiring-board svg')?.viewBox?.baseVal
    if (vb?.width && vb.height) figure.current?.style.setProperty('--bb-ratio', String(vb.width / vb.height))
  }, [layout])

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
      <div className="wiring-board">
        <BreadboardView layout={layout} ariaLabel={ariaLabel} highlight={highlight} />
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
            <div className="wiring-dialog-board">
              <BreadboardView layout={layout} ariaLabel={`${ariaLabel}, enlarged`} highlight={highlight} />
            </div>
          </>
        )}
      </dialog>
    </figure>
  )
}
