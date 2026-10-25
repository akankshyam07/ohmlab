import { useState } from 'react'
import { getLesson, lessons, phases } from '../content'
import type { Phase } from '../content/types'
import { achievements } from '../progress/achievements'
import { useProgress } from '../progress/store'
import { Icon } from '../ui/primitives'
import { continueTarget, lessonState } from './curriculum'
import { HeroBench } from './HeroBench'
import { href } from './router'
import './home.css'

export function Home() {
  const { progress, mastery, isComplete, streak } = useProgress()
  const target = continueTarget(lessons, progress, isComplete)
  const completed = lessons.filter(isComplete).length
  const avgMastery = lessons.length ? lessons.reduce((sum, l) => sum + mastery(l), 0) / lessons.length : 0
  const days = streak()

  return (
    <div className="home">
      <section className="hero" aria-labelledby="home-title">
        <HeroWaves />
        <div className="hero-copy">
          <h1 id="home-title" className="hero-brand">
            <span className="live-dot" aria-hidden="true" />
            Ohmlab
          </h1>
          <p className="hero-title">
            Learn electronics by <span className="hero-accent">experimenting</span>.
          </p>
          <p className="hero-lead">
            Change a part and the circuit is solved again in an instant. Watch voltage, current and power
            respond, break things safely, and understand <em>why</em> before you touch a breadboard.
          </p>
          <div className="hero-actions">
            {target && (
              <a className="btn btn-primary hero-cta" href={href('lesson', target.lesson.id)}>
                {`${target.verb}: Day ${target.lesson.day} — ${target.lesson.title}`}
                <Icon name="right" size={18} />
              </a>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => document.getElementById('phase-map')?.scrollIntoView({ behavior: 'smooth' })}
            >
              See the 100-day map
            </button>
          </div>
        </div>
        <HeroBench />
      </section>

      <section className="stats" aria-label="Your progress">
        <dl>
          <div className="stat panel">
            <dt>Lessons completed</dt>
            <dd>
              <span className="stat-value">{completed}</span>
              <span className="stat-unit">/ {lessons.length}</span>
            </dd>
          </div>
          <div className="stat panel">
            <dt>Average mastery</dt>
            <dd>
              <span className="stat-value">{Math.round(avgMastery * 100)}</span>
              <span className="stat-unit">%</span>
            </dd>
          </div>
          <div className="stat panel" data-hot={days > 0 || undefined}>
            <dt>Streak</dt>
            <dd>
              <Icon name="flame" size={22} />
              <span className="stat-value">{days}</span>
              <span className="stat-unit">{days === 1 ? 'day' : 'days'}</span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="map" id="phase-map" aria-labelledby="map-title">
        <div className="section-head">
          <h2 id="map-title">The 100-day map</h2>
          <p>Seven phases from “what is a volt?” to building your own projects. Lit days are ready to play.</p>
        </div>
        {phases.map((phase) => (
          <PhaseCard key={phase.n} phase={phase} />
        ))}
      </section>

      <AchievementsPreview />
    </div>
  )
}

function PhaseCard({ phase }: { phase: Phase }) {
  const { progress, mastery, isComplete } = useProgress()
  const live = phase.days.filter((d) => d.lessonId && getLesson(d.lessonId))
  const [open, setOpen] = useState(live.length > 0)
  const listId = `phase-${phase.n}-days`
  return (
    <section className="phase panel" aria-labelledby={`phase-${phase.n}-title`} data-live={live.length > 0 || undefined}>
      <header className="phase-head">
        <span className="phase-index mono" aria-hidden="true">
          P{phase.n}
        </span>
        <div className="phase-text">
          <h3 id={`phase-${phase.n}-title`}>
            Phase {phase.n} · {phase.title}
          </h3>
          <p>{phase.summary}</p>
        </div>
        <div className="phase-meta">
          <span className="chip" data-tone={live.length ? 'brand' : undefined}>
            {live.length ? `${live.length} of ${phase.days.length} days ready` : 'Coming soon'}
          </span>
          <button
            type="button"
            className="btn btn-ghost phase-toggle"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen(!open)}
          >
            {open ? 'Hide days' : `Show ${phase.days.length} days`}
          </button>
        </div>
      </header>
      <div className="phase-ticks" aria-hidden="true">
        {phase.days.map((d) => {
          const lesson = d.lessonId ? getLesson(d.lessonId) : undefined
          return (
            <span
              key={d.day}
              data-state={lesson ? (isComplete(lesson) ? 'complete' : 'live') : 'soon'}
            />
          )
        })}
      </div>
      <ol className="days" id={listId} hidden={!open}>
        {phase.days.map((d) => {
          const lesson = d.lessonId ? getLesson(d.lessonId) : undefined
          if (!lesson)
            return (
              <li key={d.day} className="day day-soon">
                <span className="day-num mono">Day {d.day}</span>
                <span className="day-title">{d.title}</span>
                <span className="day-state">Coming soon</span>
              </li>
            )
          const complete = isComplete(lesson)
          const state = lessonState(progress.lessons[lesson.id], complete)
          const pct = Math.round(mastery(lesson) * 100)
          const stateId = `day-${d.day}-state`
          return (
            <li key={d.day}>
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
                    {state === 'complete' ? 'Complete' : state === 'in-progress' ? `In progress · ${pct}%` : 'Not started'}
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
  )
}

function AchievementsPreview() {
  const { progress } = useProgress()
  const sorted = [...achievements].sort(
    (a, b) => Number(Boolean(progress.achievements[b.id])) - Number(Boolean(progress.achievements[a.id])),
  )
  const unlocked = achievements.filter((a) => progress.achievements[a.id]).length
  return (
    <section className="ach-preview" aria-labelledby="ach-preview-title">
      <div className="section-head section-head-row">
        <div>
          <h2 id="ach-preview-title">Achievements</h2>
          <p>
            {unlocked} of {achievements.length} unlocked
          </p>
        </div>
        <a className="btn btn-ghost" href={href('achievements')}>
          All achievements <Icon name="right" size={18} />
        </a>
      </div>
      <ul className="ach-strip">
        {sorted.slice(0, 4).map((a) => {
          const on = Boolean(progress.achievements[a.id])
          return (
            <li key={a.id} className="ach-mini panel" data-unlocked={on || undefined}>
              <span className="ach-icon" aria-hidden="true">
                {on ? a.icon : <Icon name="lock" size={18} />}
              </span>
              <span>
                <strong>{a.title}</strong>
                <span className="sr-only">{on ? ' (unlocked)' : ' (locked)'}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function HeroWaves() {
  return (
    <svg className="hero-waves" viewBox="0 0 1200 400" preserveAspectRatio="none" aria-hidden="true">
      <path
        className="wave wave-current"
        d="M0 200 C100 120 200 120 300 200 S500 280 600 200 S800 120 900 200 S1100 280 1200 200 S1400 120 1500 200 S1700 280 1800 200 S2000 120 2100 200 S2300 280 2400 200"
      />
      <path
        className="wave wave-voltage"
        d="M0 230 C150 150 300 150 450 230 S750 310 900 230 S1200 150 1350 230 S1650 310 1800 230 S2100 150 2250 230 S2550 310 2700 230"
      />
    </svg>
  )
}
