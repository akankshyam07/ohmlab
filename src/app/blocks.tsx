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
          <table>
            <thead>
              <tr>
                {block.head.map((h, i) => (
                  <th key={i} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>
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

/** Commit to a guess, then reveal why. Nothing is stored: predicting is practice, not a test. */
function PredictView({ block }: { block: Predict }) {
  const id = useId()
  const [choice, setChoice] = useState<number | null>(null)
  const [locked, setLocked] = useState<number | null>(null)
  const reveal = useRef<HTMLDivElement>(null)
  const picked = locked === null ? undefined : block.options[locked]
  const correct = block.options.find((o) => o.correct)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (choice === null) return
    setLocked(choice)
    requestAnimationFrame(() => reveal.current?.focus())
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
                data-result={picked && (option.correct ? 'correct' : locked === i ? 'wrong' : undefined)}
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
      {picked && (
        <div className="blk-predict-reveal" ref={reveal} tabIndex={-1} data-correct={picked.correct || undefined}>
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
          <p className="blk-predict-try">
            <span className="blk-predict-try-icon" aria-hidden="true">
              <Icon name="left" size={18} />
            </span>
            <span>
              <strong>Try it in the lab:</strong> <RichText text={block.tryIt} />
            </span>
          </p>
        </div>
      )}
    </section>
  )
}
