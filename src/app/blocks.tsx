import { useId, useRef, useState, type FormEvent } from 'react'
import type { Block } from '../content/types'
import { Icon } from '../ui/primitives'
import { RichText } from '../ui/RichText'

type Walkthrough = Extract<Block, { type: 'walkthrough' }>
type Predict = Extract<Block, { type: 'predict' }>

const CALLOUT_TITLES = { tip: 'Tip', warn: 'Careful', info: 'Good to know' } as const

export function BlockView({ block, onHighlight }: { block: Block; onHighlight: (ids: string[]) => void }) {
  switch (block.type) {
    case 'text':
      return (
        <p className="blk-text">
          <RichText text={block.text} />
        </p>
      )
    case 'callout':
      return (
        <aside className="blk-callout" data-tone={block.tone} role="note">
          <p className="blk-callout-title">{block.title ?? CALLOUT_TITLES[block.tone]}</p>
          <p>
            <RichText text={block.text} />
          </p>
        </aside>
      )
    case 'formula':
      return (
        <figure className="blk-formula">
          <div className="blk-formula-expr">{block.expr}</div>
          {block.caption && (
            <figcaption>
              <RichText text={block.caption} />
            </figcaption>
          )}
        </figure>
      )
    case 'table':
      return (
        <div className="blk-table" role="region" aria-label="Table" tabIndex={0}>
          {/* Explicit roles keep table semantics when phones restyle the rows as cards (display: block). */}
          <table role="table">
            <thead role="rowgroup">
              <tr role="row">
                {block.head.map((h, i) => (
                  <th key={i} scope="col" role="columnheader">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody role="rowgroup">
              {block.rows.map((row, r) => (
                <tr key={r} role="row">
                  {row.map((cell, c) => (
                    <td key={c} role="cell" data-label={block.head[c]}>
                      <RichText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'walkthrough':
      return <WalkthroughView block={block} onHighlight={onHighlight} />
    case 'predict':
      return <PredictView block={block} />
  }
}

function WalkthroughView({ block, onHighlight }: { block: Walkthrough; onHighlight: (ids: string[]) => void }) {
  const [active, setActive] = useState<number | null>(null)
  return (
    <section className="blk-walk" aria-label={block.title}>
      <h3>{block.title}</h3>
      <ol>
        {block.steps.map((step, i) => (
          <li key={i}>
            <button
              type="button"
              className="blk-walk-step"
              aria-pressed={active === i}
              onClick={() => {
                const next = active === i ? null : i
                setActive(next)
                onHighlight(next === null ? [] : (step.highlight ?? []))
              }}
            >
              <span className="blk-walk-num mono" aria-hidden="true">
                {i + 1}
              </span>
              <span className="blk-walk-body">
                <span className="blk-walk-text">
                  <RichText text={step.text} />
                </span>
                {step.math && <span className="blk-walk-math mono">{step.math}</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Strip trailing sentence punctuation so an option can be quoted inside a sentence. */
const unpunctuated = (text: string) => text.trim().replace(/[.!?…]+$/, '')

interface PredictState {
  locked: number
  revealed: boolean
}

const predictKey = (id: string) => `ohmlab.predict.${id}`

function loadPredict(id: string, options: number): PredictState | null {
  try {
    const x = JSON.parse(localStorage.getItem(predictKey(id)) ?? 'null') as PredictState | null
    return x && Number.isInteger(x.locked) && x.locked >= 0 && x.locked < options && typeof x.revealed === 'boolean'
      ? x
      : null
  } catch {
    return null // blocked storage or bad JSON: ask again
  }
}

function savePredict(id: string, state: PredictState) {
  try {
    localStorage.setItem(predictKey(id), JSON.stringify(state))
  } catch {
    // Storage blocked: the guess simply lasts for this visit.
  }
}

/**
 * Commit to a guess, test it in the lab, then reveal why. The answer stays hidden until the learner asks
 * ("Show the answer"), so the lab gets to answer first. The guess is kept in this browser.
 */
function PredictView({ block }: { block: Predict }) {
  const id = useId()
  const [saved, setSaved] = useState(() => loadPredict(block.id, block.options.length))
  const [choice, setChoice] = useState<number | null>(saved?.locked ?? null)
  const panel = useRef<HTMLDivElement>(null)
  const picked = saved ? block.options[saved.locked] : undefined
  const revealed = picked !== undefined && saved?.revealed
  const correct = block.options.find((o) => o.correct)

  const update = (next: PredictState) => {
    setSaved(next)
    savePredict(block.id, next)
    requestAnimationFrame(() => panel.current?.focus())
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (choice !== null) update({ locked: choice, revealed: false })
  }

  return (
    <section className="blk-predict" aria-labelledby={`${id}-title`}>
      <p className="blk-predict-kicker" id={`${id}-title`}>
        <Icon name="bolt" size={16} /> Predict first
      </p>
      <form onSubmit={onSubmit}>
        <fieldset disabled={picked !== undefined}>
          <legend className="blk-predict-prompt">
            <RichText text={block.prompt} />
          </legend>
          <div className="blk-predict-options">
            {block.options.map((option, i) => (
              <label
                key={i}
                className="blk-predict-option"
                data-result={
                  revealed ? (option.correct ? 'correct' : saved?.locked === i ? 'wrong' : undefined) : undefined
                }
              >
                <input
                  type="radio"
                  name={`${id}-option`}
                  checked={choice === i}
                  onChange={() => setChoice(i)}
                />
                <span>
                  <RichText text={option.text} />
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {!picked && (
          <button type="submit" className="btn btn-primary blk-predict-submit" disabled={choice === null}>
            Lock in my guess
          </button>
        )}
      </form>
      {picked && !revealed && (
        <div className="blk-predict-reveal blk-predict-test" ref={panel} tabIndex={-1}>
          <p className="blk-predict-verdict">Guess locked in. Now test it.</p>
          <p className="blk-predict-try">
            <span className="blk-predict-try-icon" aria-hidden="true">
              <Icon name="left" size={18} />
            </span>
            <span>
              <strong>Try it in the lab:</strong> <RichText text={block.tryIt} />
            </span>
          </p>
          <p>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => saved && update({ ...saved, revealed: true })}
            >
              Show the answer
            </button>
          </p>
        </div>
      )}
      {picked && revealed && (
        <div className="blk-predict-reveal" ref={panel} tabIndex={-1} data-correct={picked.correct || undefined}>
          <p className="blk-predict-verdict">
            {picked.correct ? 'Good call.' : 'Not this time, and that’s fine: a wrong guess is how the idea sticks.'}
          </p>
          <p>
            <RichText text={picked.why} />
          </p>
          {!picked.correct && correct && (
            <p>
              <strong>The answer:</strong> <RichText text={unpunctuated(correct.text)} />.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
