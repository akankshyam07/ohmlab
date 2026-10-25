import { useEffect, useState } from 'react'
import { getLesson, lessons } from '../content'
import type { Lesson } from '../content/types'
import { Lab } from '../features/lab/Lab'
import { Quiz } from '../features/quiz/Quiz'
import { useProgress } from '../progress/store'
import { Icon, ProgressRing } from '../ui/primitives'
import { RichText } from '../ui/RichText'
import { BlockView } from './blocks'
import { lessonSteps, nextLesson } from './curriculum'
import { NotFound } from './pages'
import { href } from './router'
import { useSettings } from './settings'
import './lesson.css'

export function LessonPage({ id, step }: { id: string; step?: string }) {
  const lesson = getLesson(id)
  if (!lesson) return <NotFound />
  return <LessonView key={lesson.id} lesson={lesson} stepParam={step} />
}

type StepState = 'done' | 'seen' | 'unseen'

const STEP_STATE_TEXT: Record<StepState, string> = { done: 'Done', seen: 'Seen', unseen: 'Not seen yet' }

function LessonView({ lesson, stepParam }: { lesson: Lesson; stepParam?: string }) {
  const { progress, markStep, mastery } = useProgress()
  const { animateFlow } = useSettings()
  const steps = lessonSteps(lesson)
  const index = Math.max(0, steps.findIndex((s) => s.id === stepParam))
  const step = steps[index]
  const [walkHighlight, setWalkHighlight] = useState<{ stepId: string; ids: string[] }>({ stepId: '', ids: [] })
  const highlight = walkHighlight.stepId === step.id ? walkHighlight.ids : []
  const lp = progress.lessons[lesson.id]
  const following = nextLesson(lessons, lesson)
  const isLast = index === steps.length - 1

  useEffect(() => {
    markStep(lesson.id, step.id)
    // The lab is not a step of its own: it is the stage, visible on every step. The store still counts it.
    if (lesson.lab) markStep(lesson.id, 'lab')
  }, [lesson, step.id, markStep])

  const stateOf = (stepId: string): StepState => {
    if (!lp?.stepsSeen.includes(stepId)) return 'unseen'
    if (stepId === 'quiz' && lp.quizBest < 0.8) return 'seen'
    return 'done'
  }

  const goTo = (i: number) => {
    window.location.assign(href('lesson', lesson.id, steps[i].id))
  }
  const onNext = () => {
    if (!isLast) goTo(index + 1)
    else window.location.assign(following ? href('lesson', following.id) : href())
  }

  return (
    <div className="lesson" data-lab={lesson.lab ? 'yes' : 'no'}>
      <header className="lesson-head">
        <div className="lesson-head-text">
          <p className="eyebrow">
            Phase {lesson.phase} · Day {lesson.day}
          </p>
          <h1>{lesson.title}</h1>
          <p className="lesson-tagline">{lesson.tagline}</p>
          <p className="lesson-meta">
            <Icon name="clock" size={16} /> {lesson.minutes} min
            <span aria-hidden="true">·</span>
            {steps.length} steps
          </p>
        </div>
        <ProgressRing value={mastery(lesson)} size={68} />
      </header>

      <div className="lesson-body">
        {lesson.lab && (
          <div className="lesson-stage">
            <Lab lessonId={lesson.id} lab={lesson.lab} highlight={highlight} showFlow={animateFlow} />
          </div>
        )}

        <div className="lesson-panel">
          <nav className="steps-nav" aria-label="Lesson steps">
            <ol>
              {steps.map((s, i) => {
                const state = stateOf(s.id)
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="step-btn"
                      data-state={state}
                      aria-current={i === index ? 'step' : undefined}
                      aria-label={s.title}
                      aria-describedby={`step-state-${state}`}
                      onClick={() => goTo(i)}
                    >
                      <span className="step-btn-num mono" aria-hidden="true">
                        {state === 'done' ? <Icon name="check" size={14} /> : String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="step-btn-title" aria-hidden="true">
                        {s.title}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
            {(Object.keys(STEP_STATE_TEXT) as StepState[]).map((s) => (
              <span key={s} id={`step-state-${s}`} hidden>
                {STEP_STATE_TEXT[s]}
              </span>
            ))}
            <div className="steps-meter" aria-hidden="true">
              <span style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
            </div>
          </nav>

          <article className="step" key={step.id} aria-labelledby="step-title">
            <p className="step-count mono">
              Step {index + 1} of {steps.length}
            </p>
            <h2 id="step-title" tabIndex={-1} data-autofocus>
              {step.title}
            </h2>

            {index === 0 && lesson.objectives.length > 0 && (
              <section className="objectives" aria-label="Learning objectives">
                <p className="objectives-title">In this lesson you will</p>
                <ul>
                  {lesson.objectives.map((o) => (
                    <li key={o}>
                      <Icon name="bolt" size={16} />
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <StepContent
              lesson={lesson}
              stepId={step.id}
              onHighlight={(ids) => setWalkHighlight({ stepId: step.id, ids })}
            />
          </article>

          <div className="step-footer">
            <button type="button" className="btn btn-ghost" disabled={index === 0} onClick={() => goTo(index - 1)}>
              <Icon name="left" size={18} />
              Back
            </button>
            <div className="step-footer-next">
              {isLast && (
                <span className="step-footer-caption" id="next-caption">
                  {following ? `Up next: Day ${following.day} — ${following.title}` : 'Back to the map'}
                </span>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={onNext}
                aria-describedby={isLast ? 'next-caption' : undefined}
              >
                Next
                <Icon name="right" size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StepContent({
  lesson,
  stepId,
  onHighlight,
}: {
  lesson: Lesson
  stepId: string
  onHighlight: (ids: string[]) => void
}) {
  if (stepId === 'quiz') return <Quiz lessonId={lesson.id} questions={lesson.quiz} />

  if (stepId === 'build' && lesson.realBuild) {
    const build = lesson.realBuild
    return (
      <div className="build">
        <p className="blk-text">Time to leave the simulator. Here is everything you need from your kit.</p>
        <h3>Parts</h3>
        <ul className="build-parts">
          {build.parts.map((p) => (
            <li key={p}>
              <Icon name="check" size={16} />
              <RichText text={p} />
            </li>
          ))}
        </ul>
        <h3>Steps</h3>
        <ol className="build-steps">
          {build.steps.map((s, i) => (
            <li key={i}>
              <RichText text={s} />
            </li>
          ))}
        </ol>
        {build.safety?.map((s, i) => (
          <BlockView key={i} block={{ type: 'callout', tone: 'warn', title: 'Safety', text: s }} onHighlight={onHighlight} />
        ))}
      </div>
    )
  }

  const section = lesson.sections.find((s) => s.id === stepId)
  return (
    <div className="blocks">
      {section?.blocks.map((block, i) => (
        <BlockView key={i} block={block} onHighlight={onHighlight} />
      ))}
    </div>
  )
}
