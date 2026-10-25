import { useEffect, useRef, useState } from 'react'
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

/** The real-kit build: safety first, a tick-off parts list (this visit only), the wiring diagram, then numbered steps. */
export function BuildGuide({ build, title }: { build: RealBuild; title: string }) {
  const [have, setHave] = useState<string[]>([])
  const [active, setActive] = useState<number | null>(null)
  const layout = build.breadboard
  const highlight = layout && active !== null ? partIdsInStep(build.steps[active], layout) : []

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
      {layout && <WiringFigure layout={layout} title={title} highlight={highlight} />}
      <h3>Steps</h3>
      <ol className="build-steps" data-interactive={layout ? 'yes' : undefined}>
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
            <li key={i}>
              {layout ? (
                // Focus and click both select (no toggle), so a mouse click never undoes its own focus.
                <button
                  type="button"
                  className="build-step"
                  aria-current={active === i ? 'step' : undefined}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
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

/** The breadboard for this build, with an expand button that opens it large in a modal dialog. */
export function WiringFigure({
  layout,
  title,
  highlight,
}: {
  layout: BreadboardLayout
  title: string
  highlight: string[]
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const expandButton = useRef<HTMLButtonElement>(null)
  const [expanded, setExpanded] = useState(false)
  const ariaLabel = `Breadboard wiring for ${title}`

  // showModal gives the focus trap, the inert page and Escape; the large board only mounts while open.
  useEffect(() => {
    if (!expanded || dialog.current?.open) return
    dialog.current?.showModal?.()
    // On a phone the enlarged board is wider than the screen: start panned to the middle, where the parts sit.
    const board = dialog.current?.querySelector('.wiring-dialog-board')
    if (board) board.scrollLeft = (board.scrollWidth - board.clientWidth) / 2
  }, [expanded])

  return (
    <figure className="wiring">
      <div className="wiring-head">
        <figcaption>
          <span className="wiring-title">Wiring diagram</span>
          <span className="wiring-hint">Select a step below to highlight its parts.</span>
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
