import { getLesson, lessons, phases } from '../content'
import { getPart } from '../content/parts'
import { topics } from '../content/topics'
import type { Lesson, PartInfo, Topic } from '../content/types'
import { useProgress } from '../progress/store'
import { Icon } from '../ui/primitives'
import { RichText } from '../ui/RichText'
import { lessonState } from './curriculum'
import { NotFound } from './pages'
import { PartChip } from './parts'
import { href } from './router'
import './home.css'
import './explore.css'

const dayTitles = new Map(phases.flatMap((p) => p.days.map((d) => [d.day, d.title] as const)))

/** A topic's lessons that exist, in its suggested order. */
export function topicLessons(topic: Topic): Lesson[] {
  return topic.lessonIds.map((id) => getLesson(id)).filter((l): l is Lesson => Boolean(l))
}

export function topicParts(topic: Topic): PartInfo[] {
  return topic.partIds.map((id) => getPart(id)).filter((p): p is PartInfo => Boolean(p))
}

/** Every day of a topic in curriculum order: the lesson when there is one, otherwise the day's title, coming soon. */
export function topicDays(topic: Topic): { day: number; title: string; lesson?: Lesson }[] {
  const own = topicLessons(topic)
  const days = new Set([...topic.days, ...own.map((l) => l.day)])
  return [...days]
    .sort((a, b) => a - b)
    .map((day) => {
      const lesson = own.find((l) => l.day === day) ?? lessons.find((l) => l.day === day)
      return { day, title: lesson?.title ?? dayTitles.get(day) ?? `Day ${day}`, lesson }
    })
}

const dayRange = (topic: Topic) => {
  if (topic.days.length === 0) return ''
  const lo = Math.min(...topic.days)
  const hi = Math.max(...topic.days)
  return lo === hi ? `Day ${lo}` : `Days ${lo}–${hi}`
}

function useTopicProgress(topic: Topic) {
  const { isComplete } = useProgress()
  const own = topicLessons(topic)
  return { live: own.length, done: own.filter(isComplete).length }
}

export function TopicsPage() {
  return (
    <div className="page explore">
      <header className="page-head">
        <p className="eyebrow">Learn by topic</p>
        <h1 tabIndex={-1} data-autofocus>
          Topics
        </h1>
        <p>
          The same 100 days, cut by subject. Already know the theory? Jump straight to the hands-on part you need, from
          your first LED to WiFi on the ESP32.
        </p>
      </header>
      <ul className="topic-grid">
        {topics.map((t, i) => (
          <li key={t.id}>
            <TopicCard topic={t} index={i} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A topic summary card; the whole card is the link (stretched from the title). */
export function TopicCard({ topic, index, compact = false }: { topic: Topic; index?: number; compact?: boolean }) {
  const { live, done } = useTopicProgress(topic)
  const tparts = topicParts(topic)
  const pct = live ? Math.round((done / live) * 100) : 0
  return (
    <article className="topic-card panel" data-compact={compact || undefined} data-live={live > 0 || undefined}>
      <div className="topic-card-top">
        {index !== undefined && (
          <span className="topic-index mono" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
        )}
        <span className="topic-days mono">{dayRange(topic)}</span>
      </div>
      <h2 className="topic-title">
        <a href={href('topics', topic.id)}>{topic.title}</a>
      </h2>
      {!compact && (
        <p className="topic-summary">
          <RichText text={topic.summary} />
        </p>
      )}
      <p className="topic-stats mono">
        {live > 0 ? `${live} ${live === 1 ? 'lesson' : 'lessons'} ready` : 'Coming soon'}
        <span aria-hidden="true"> · </span>
        {tparts.length} {tparts.length === 1 ? 'part' : 'parts'}
      </p>
      {live > 0 && (
        <div className="topic-progress">
          <span className="topic-bar" aria-hidden="true">
            <span style={{ width: `${pct}%` }} />
          </span>
          <span className="topic-progress-text mono">
            {done} / {live} complete
          </span>
        </div>
      )}
      {!compact && tparts.length > 0 && (
        <ul className="topic-parts" aria-label="Parts">
          {tparts.slice(0, 4).map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
          {tparts.length > 4 && <li>+{tparts.length - 4} more</li>}
        </ul>
      )}
    </article>
  )
}

export function TopicPage({ id }: { id: string }) {
  const topic = topics.find((t) => t.id === id)
  const { progress, mastery, isComplete } = useProgress()
  if (!topic) return <NotFound />
  const days = topicDays(topic)
  const tparts = topicParts(topic)
  const live = days.filter((d) => d.lesson)
  const done = live.filter((d) => d.lesson && isComplete(d.lesson)).length

  return (
    <div className="page explore topic-page">
      <header className="page-head">
        <p className="eyebrow">
          <a href={href('topics')}>Topics</a> <span aria-hidden="true">/</span> {dayRange(topic)}
        </p>
        <h1 tabIndex={-1} data-autofocus>
          {topic.title}
        </h1>
        <p>
          <RichText text={topic.summary} />
        </p>
        {live.length > 0 && (
          <p className="topic-head-progress mono">
            {done} of {live.length} {live.length === 1 ? 'lesson' : 'lessons'} complete
          </p>
        )}
      </header>

      <section className="explore-section" aria-labelledby="topic-lessons">
        <h2 id="topic-lessons">Lessons, in order</h2>
        <ol className="days topic-day-list">
          {days.map(({ day, title, lesson }) => {
            if (!lesson)
              return (
                <li key={day} className="day day-soon">
                  <span className="day-num mono">Day {day}</span>
                  <span className="day-title">{title}</span>
                  <span className="day-state">Coming soon</span>
                </li>
              )
            const complete = isComplete(lesson)
            const state = lessonState(progress.lessons[lesson.id], complete)
            const pct = Math.round(mastery(lesson) * 100)
            const stateId = `topic-day-${day}-state`
            return (
              <li key={day}>
                <a
                  className="day day-live"
                  data-state={state}
                  href={href('lesson', lesson.id)}
                  aria-label={`Day ${lesson.day}: ${lesson.title}`}
                  aria-describedby={stateId}
                >
                  <span className="day-num mono">Day {lesson.day}</span>
                  <span className="day-title">{lesson.title}</span>
                  <span className="day-foot">
                    <span className="day-state" id={stateId}>
                      {state === 'complete'
                        ? 'Complete'
                        : state === 'in-progress'
                          ? `In progress · ${pct}%`
                          : 'Not started'}
                    </span>
                    <span className="day-bar" aria-hidden="true">
                      <span style={{ width: `${pct}%` }} />
                    </span>
                    {complete && <Icon name="check" size={16} />}
                  </span>
                </a>
              </li>
            )
          })}
        </ol>
      </section>

      {tparts.length > 0 && (
        <section className="explore-section" aria-labelledby="topic-parts">
          <div className="section-head section-head-row">
            <h2 id="topic-parts">Parts you’ll use</h2>
            <a className="btn btn-ghost" href={href('parts')}>
              All parts <Icon name="right" size={18} />
            </a>
          </div>
          <ul className="part-chips">
            {tparts.map((p) => (
              <li key={p.id}>
                <PartChip part={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
