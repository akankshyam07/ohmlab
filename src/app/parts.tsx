import { useEffect, useRef, useState } from 'react'
import { getLesson } from '../content'
import { getPart, parts } from '../content/parts'
import { topics } from '../content/topics'
import type { Lesson, PartId, PartInfo } from '../content/types'
import { Icon } from '../ui/primitives'
import { RichText } from '../ui/RichText'
import { PartViewer } from '../viz/iso/PartViewer'
import { NotFound } from './pages'
import { href } from './router'
import './explore.css'

export const CATEGORY_LABELS: Record<PartInfo['category'], string> = {
  board: 'Boards',
  passive: 'Passives',
  semiconductor: 'Semiconductors',
  input: 'Inputs',
  output: 'Outputs',
  sensor: 'Sensors',
  power: 'Power',
  tool: 'Tools and wiring',
}

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as PartInfo['category'][]

export function AvailabilityBadge({ part }: { part: PartInfo }) {
  const a = part.availability
  return a.source === 'kit' ? (
    <span className="chip part-badge" data-tone="ok" title="In a typical Elegoo Uno starter kit">
      Kit
    </span>
  ) : (
    <span className="chip part-badge" data-tone="buy" title="Not in the starter kit">
      Buy ~{a.price.replace(/^~/, '')}
    </span>
  )
}

/** A small link to a part's page: name and badge. */
export function PartChip({ part }: { part: PartInfo }) {
  return (
    <a className="part-chip" href={href('parts', part.id)}>
      <span className="part-chip-name">{part.name}</span>
      <AvailabilityBadge part={part} />
    </a>
  )
}

/** Parts that pass the topic filter (null: all), grouped by category in a fixed order. */
export function groupParts(list: PartInfo[], topicId: string | null) {
  const shown = topicId ? list.filter((p) => p.topicIds.includes(topicId)) : list
  return CATEGORY_ORDER.map((category) => ({ category, parts: shown.filter((p) => p.category === category) })).filter(
    (g) => g.parts.length > 0,
  )
}

export function PartsPage() {
  const [topicId, setTopicId] = useState<string | null>(null)
  const groups = groupParts(parts, topicId)
  const filterTopics = topics.filter((t) => parts.some((p) => p.topicIds.includes(t.id)))

  return (
    <div className="page explore">
      <header className="page-head">
        <p className="eyebrow">Real parts</p>
        <h1 tabIndex={-1} data-autofocus>
          Parts
        </h1>
        <p>
          Every part you’ll hold, up close. Turn it, zoom into its pins and markings, and learn how to wire it on a real
          bench before you plug anything in.
        </p>
      </header>

      <fieldset className="part-filter">
        <legend>Filter by topic</legend>
        <div className="part-filter-options">
          {[{ id: null, title: 'All parts' }, ...filterTopics].map((t) => (
            <label key={t.id ?? 'all'}>
              <input type="radio" name="part-topic" checked={topicId === t.id} onChange={() => setTopicId(t.id)} />
              <span>{t.title}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="sr-only" role="status">
        {groups.reduce((n, g) => n + g.parts.length, 0)} parts shown
      </p>

      {groups.map((g) => (
        <section key={g.category} className="explore-section" aria-labelledby={`cat-${g.category}`}>
          <h2 id={`cat-${g.category}`} className="part-cat">
            {CATEGORY_LABELS[g.category]}
          </h2>
          <ul className="part-grid">
            {g.parts.map((p) => (
              <li key={p.id}>
                <PartTile part={p} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** A part card with a static model thumbnail; the whole card is the link (stretched from the name). */
export function PartTile({ part, featured = false }: { part: PartInfo; featured?: boolean }) {
  return (
    <article className="part-tile panel" data-featured={featured || undefined}>
      {/* A picture only: the hotspots stay out of reach (inert), the card is the link. */}
      <div className="part-thumb" aria-hidden="true" inert>
        <PartViewer partId={part.id} ariaLabel={part.name} animate={false} />
      </div>
      <div className="part-tile-text">
        <h3 className="part-tile-name">
          <a href={href('parts', part.id)}>{part.name}</a>
        </h3>
        <p className="part-tile-summary">
          <RichText text={part.summary} />
        </p>
        <AvailabilityBadge part={part} />
      </div>
    </article>
  )
}

export function PartPage({ id, anchor }: { id: string; anchor?: string }) {
  const part = getPart(id as PartId)
  if (!part) return <NotFound />
  return <PartView key={part.id} part={part} anchor={anchor} />
}

function PartView({ part, anchor }: { part: PartInfo; anchor?: string }) {
  const known = (a?: string) => (a && part.features.some((f) => f.anchor === a) ? a : undefined)
  const [active, setActive] = useState(() => known(anchor))
  const featureList = useRef<HTMLOListElement>(null)

  // A deep link or Back/Forward (#/parts/:id/:anchor) moves the camera too.
  useEffect(() => {
    setActive(known(anchor))
  }, [anchor]) // `known` reads only `part`, fixed for this mount

  const select = (next: string | undefined) => {
    setActive(next)
    // Keep the address shareable without a history entry per feature.
    window.history.replaceState(null, '', next ? href('parts', part.id, next) : href('parts', part.id))
  }

  // A hotspot on the model selects its feature and brings it into view in the list; null (Escape, reset) clears it.
  const onHotspot = (a: string | null) => {
    if (a === null) return select(undefined)
    if (!known(a)) return
    select(a)
    const item = featureList.current?.querySelector<HTMLElement>(`[data-anchor="${CSS.escape(a)}"]`)
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    item?.scrollIntoView?.({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
  }

  const activeFeature = part.features.find((f) => f.anchor === active)
  const anchorLabels = Object.fromEntries(part.features.map((f) => [f.anchor, f.title]))
  const related = (part.related ?? []).map((r) => getPart(r)).filter((p): p is PartInfo => Boolean(p))
  const usedIn = (part.lessonIds ?? []).map((l) => getLesson(l)).filter((l): l is Lesson => Boolean(l))
  const partTopics = topics.filter((t) => part.topicIds.includes(t.id))

  return (
    <div className="part-page">
      <header className="part-head">
        <p className="eyebrow">
          <a href={href('parts')}>Parts</a> <span aria-hidden="true">/</span> {CATEGORY_LABELS[part.category]}
        </p>
        <h1 tabIndex={-1} data-autofocus>
          {part.name}
        </h1>
        <div className="part-head-meta">
          <AvailabilityBadge part={part} />
          {partTopics.map((t) => (
            <a key={t.id} className="chip part-topic-chip" href={href('topics', t.id)}>
              {t.title}
            </a>
          ))}
        </div>
      </header>

      <div className="part-body">
        <div className="part-panel">
          <p className="part-summary">
            <RichText text={part.summary} />
          </p>

          <section className="part-section" aria-labelledby="part-features">
            <h2 id="part-features">Features</h2>
            <p className="part-hint">Pick one to zoom the model onto it, or tap a hotspot on the model.</p>
            <ol ref={featureList} className="feature-list">
              {part.features.map((f) => (
                <li key={f.anchor} data-anchor={f.anchor}>
                  <button
                    type="button"
                    className="feature"
                    aria-pressed={active === f.anchor}
                    onClick={() => select(active === f.anchor ? undefined : f.anchor)}
                  >
                    <span className="feature-title">{f.title}</span>
                    <span className="feature-detail">
                      <RichText text={f.detail} />
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          {part.pins && part.pins.length > 0 && (
            <section className="part-section" aria-labelledby="part-pins">
              <h2 id="part-pins">Pins</h2>
              <div className="pin-table-wrap">
                <table className="pin-table">
                  <thead>
                    <tr>
                      <th scope="col">Pin</th>
                      <th scope="col">What it does</th>
                    </tr>
                  </thead>
                  <tbody>
                    {part.pins.map((p) => (
                      <tr key={p.name}>
                        <th scope="row" className="mono">
                          {p.name}
                        </th>
                        <td>
                          <RichText text={p.detail} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="part-section" aria-labelledby="part-connect">
            <h2 id="part-connect">How to connect it in real life</h2>
            <ol className="connect-steps">
              {part.howToConnect.map((s, i) => (
                <li key={i}>
                  <span className="connect-num mono" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span>
                    <RichText text={s} />
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {part.mistakes.length > 0 && (
            <aside className="blk-callout part-mistakes" data-tone="warn" aria-labelledby="part-mistakes">
              <h2 id="part-mistakes" className="blk-callout-title">
                Common mistakes
              </h2>
              <ul>
                {part.mistakes.map((m, i) => (
                  <li key={i}>
                    <RichText text={m} />
                  </li>
                ))}
              </ul>
            </aside>
          )}

          {usedIn.length > 0 && (
            <section className="part-section" aria-labelledby="part-lessons">
              <h2 id="part-lessons">Lessons that use it</h2>
              <ul className="part-lessons">
                {usedIn.map((l) => (
                  <li key={l.id}>
                    <a href={href('lesson', l.id)}>
                      <span className="mono">Day {l.day}</span> {l.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {related.length > 0 && (
            <section className="part-section" aria-labelledby="part-related">
              <h2 id="part-related">Related parts</h2>
              <ul className="part-chips">
                {related.map((p) => (
                  <li key={p.id}>
                    <PartChip part={p} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="part-stage">
          <div className="part-stage-bar">
            <span className="part-stage-caption" aria-live="polite">
              {activeFeature ? activeFeature.title : 'Whole part. Pick a feature to zoom in.'}
            </span>
            {activeFeature && (
              <button type="button" className="btn btn-ghost part-stage-reset" onClick={() => select(undefined)}>
                <Icon name="expand" size={16} />
                Whole part
              </button>
            )}
          </div>
          <div className="part-stage-viewer">
            <PartViewer
              partId={part.id}
              activeAnchor={active}
              onAnchor={onHotspot}
              anchorLabels={anchorLabels}
              ariaLabel={`3D model of the ${part.name}`}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
