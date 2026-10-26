import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { Block } from '../content/types'
import { Icon } from '../ui/primitives'
import { RichText } from '../ui/RichText'
import { highlight } from './highlight'

type Walkthrough = Extract<Block, { type: 'walkthrough' }>
type Predict = Extract<Block, { type: 'predict' }>
type Code = Extract<Block, { type: 'code' }>

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
    case 'code':
      return <CodeView block={block} />
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

const LANGUAGE_NAMES: Record<Code['language'], string> = { cpp: 'Arduino C++', python: 'Python', text: 'Text' }

/** Put text on the clipboard: the async API where allowed, else a hidden textarea and execCommand. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.append(area)
    area.select()
    try {
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      area.remove()
    }
  }
}

/**
 * A code panel: highlighted source with line numbers (both out of text selection), "Copy code", and numbered
 * notes; hovering or focusing a note lights its line. The code scrolls sideways inside its own frame.
 */
function CodeView({ block }: { block: Code }) {
  const lines = highlight(block.code, block.language)
  const notes = [...(block.notes ?? [])].sort((a, b) => a.line - b.line)
  const [hot, setHot] = useState<number | null>(null)
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null)
  const label = LANGUAGE_NAMES[block.language]
  const notesId = useId()

  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(null), 2000)
    return () => window.clearTimeout(t)
  }, [copied])

  return (
    <figure className="blk-code">
      <div className="blk-code-bar">
        <span className="blk-code-lang num">{label}</span>
        <button
          type="button"
          className="btn btn-ghost blk-code-copy"
          data-copied={copied === 'yes' || undefined}
          onClick={async () => setCopied((await copyText(block.code)) ? 'yes' : 'failed')}
        >
          <Icon name={copied === 'yes' ? 'check' : 'copy'} size={16} />
          {copied === 'yes' ? 'Copied' : 'Copy code'}
        </button>
        <span className="sr-only" role="status">
          {copied === 'yes' ? 'Code copied to the clipboard' : copied === 'failed' ? 'Copying failed: select the code and copy it' : ''}
        </span>
      </div>
      <div
        className="blk-code-scroll"
        role="region"
        aria-label={`${label} code`}
        aria-describedby={notes.length ? notesId : undefined}
        tabIndex={0}
      >
        <pre>
          <code>
            {lines.map((tokens, i) => {
              const n = i + 1
              const marks = notes.flatMap((note, k) => (note.line === n ? [k + 1] : []))
              return (
                <span key={i} className="blk-code-line" data-hot={hot === n || undefined}>
                  <span className="blk-code-ln" aria-hidden="true">
                    {n}
                  </span>
                  <span className="blk-code-src">
                    {tokens.map((t, j) =>
                      t.kind === 'plain' ? t.text : (
                        <span key={j} className={`tok-${t.kind}`}>
                          {t.text}
                        </span>
                      ),
                    )}
                  </span>
                  {marks.map((k) => (
                    <span key={k} className="blk-code-mark mono" aria-hidden="true">
                      {k}
                    </span>
                  ))}
                  {'\n'}
                </span>
              )
            })}
          </code>
        </pre>
      </div>
      {block.caption && (
        <figcaption>
          <RichText text={block.caption} />
        </figcaption>
      )}
      {notes.length > 0 && (
        <ol className="blk-code-notes" id={notesId} aria-label="Notes on the code">
          {notes.map((note, k) => (
            <li
              key={k}
              tabIndex={0}
              data-hot={hot === note.line || undefined}
              onMouseEnter={() => setHot(note.line)}
              onMouseLeave={() => setHot(null)}
              onFocus={() => setHot(note.line)}
              onBlur={() => setHot(null)}
            >
              <span className="blk-code-note-num mono" aria-hidden="true">
                {k + 1}
              </span>
              <span>
                <span className="blk-code-note-line num">Line {note.line}</span> <RichText text={note.text} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </figure>
  )
}
