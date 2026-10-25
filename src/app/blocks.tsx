import { useState } from 'react'
import type { Block } from '../content/types'
import { RichText } from '../ui/RichText'

type Walkthrough = Extract<Block, { type: 'walkthrough' }>

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
                <RichText text={step.text} />
                {step.math && <span className="blk-walk-math mono">{step.math}</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
