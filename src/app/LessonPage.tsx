import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getLesson, lessons } from '../content'
import type { Lesson } from '../content/types'
import { Lab } from '../features/lab/Lab'
import { Quiz } from '../features/quiz/Quiz'
import { useProgress } from '../progress/store'
import { Icon, ProgressRing } from '../ui/primitives'
import { RichText } from '../ui/RichText'
import { BlockView } from './blocks'
import { BuildGuide, WiringFigure, partsForStep } from './BuildGuide'
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

// The lab re-renders only when its own props change, not on every step change, so a step change stays well inside one
// frame. Hence one shared empty highlight, never a fresh [].
const StageLab = memo(Lab)
const NO_HIGHLIGHT: string[] = []

const STEP_STATE_TEXT: Record<StepState, string> = { done: 'Done', seen: 'Seen', unseen: 'Not seen yet' }

function LessonView({ lesson, stepParam }: { lesson: Lesson; stepParam?: string }) {
  const { progress, markStep, mastery } = useProgress()
  const { animateFlow } = useSettings()
  const steps = lessonSteps(lesson)
  const index = Math.max(0, steps.findIndex((s) => s.id === stepParam))
  const step = steps[index]
  const [walkHighlight, setWalkHighlight] = useState<{ stepId: string; ids: string[] }>({ stepId: '', ids: [] })
  const highlight = walkHighlight.stepId === step.id ? walkHighlight.ids : NO_HIGHLIGHT
  const lp = progress.lessons[lesson.id]
  const following = nextLesson(lessons, lesson)
  const isLast = index === steps.length - 1
  // Mastery also weighs steps read, so a complete lesson can sit below 100 %: say which part is missing.
  const unreadSteps = steps.filter((s) => !lp?.stepsSeen.includes(s.id)).length
  const [stageCollapsed, setStageCollapsed] = useState(false)
  // On the Build step the stage shows the wiring diagram (with the simulator a toggle away), beside the steps.
  const build = lesson.realBuild
  const wiringStage = step.id === 'build' && !!lesson.lab && !!build?.breadboard
  const [stageView, setStageView] = useState<'wiring' | 'lab'>('wiring')
  const showWiring = wiringStage && stageView === 'wiring'
  const [buildStep, setBuildStep] = useState<number | null>(null)
  // The quiz keeps its own "Next question"; until it's finished on this visit, the lesson button becomes a quiet "Skip quiz".
  const attemptsOnArrival = useRef(lp?.quizAttempts ?? 0)
  const quizInProgress = step.id === 'quiz' && (lp?.quizAttempts ?? 0) === attemptsOnArrival.current

  // On phones the step chips are one scrolling row: keep the current one in view (without moving the page).
  const stepList = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const list = stepList.current
    // The chip's <li>: positioned, so its offsets are relative to the (positioned) list.
    const current = list?.querySelector('[aria-current="step"]')?.closest('li')
    if (list && current && list.scrollWidth > list.clientWidth)
      list.scrollLeft = current.offsetLeft - (list.clientWidth - current.offsetWidth) / 2
  }, [index])

  // The current-step pill glides to the new chip (CSS transition on transform and width). Placed without motion on
  // first layout and on resize, when chips reflow.
  const glider = useRef<HTMLLIElement>(null)
  useLayoutEffect(() => {
    const list = stepList.current
    const pill = glider.current
    if (!list || !pill) return
    const place = (animate: boolean) => {
      const current = list.querySelector('[aria-current="step"]')?.closest('li')
      if (!current) return
      if (!animate) pill.style.transition = 'none'
      pill.style.transform = `translate(${current.offsetLeft}px, ${current.offsetTop}px)`
      pill.style.width = `${current.offsetWidth}px`
      pill.style.height = `${current.offsetHeight}px`
      list.dataset.glide = ''
      if (!animate) {
        void pill.offsetWidth
        pill.style.transition = ''
      }
    }
    place(list.dataset.glide !== undefined)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => place(false))
    ro.observe(list)
    return () => ro.disconnect()
  }, [index])

  // Step change: the card plays its exit (CSS `step-out`), then the route changes and the new card enters.
  const [leavingFrom, setLeavingFrom] = useState<string | null>(null)
  const leaving = leavingFrom === step.id
  const pendingGo = useRef<() => void>(undefined)

  const highlightParts = (ids: string[]) => {
    setWalkHighlight({ stepId: step.id, ids })
    if (ids.length > 0) setStageCollapsed(false)
  }

  const jumpToChallenges = () => {
    setStageCollapsed(false)
    setStageView('lab')
    requestAnimationFrame(() => revealChallenges())
  }

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

  // Where the learner has asked to go, which can run ahead of `index` while the exit animation plays.
  const targetIndex = useRef<number | null>(null)
  useEffect(() => {
    targetIndex.current = null
  }, [index])

  const goTo = (i: number) => {
    if (i === (targetIndex.current ?? index)) return
    targetIndex.current = i
    attemptsOnArrival.current = lp?.quizAttempts ?? 0
    const go = () => {
      pendingGo.current = undefined
      window.location.assign(href('lesson', lesson.id, steps[i].id))
    }
    // A second request during the exit cuts it short: a click is never dropped.
    if (leaving || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true)) return go()
    pendingGo.current = go
    setLeavingFrom(step.id)
    // animationend never fires in a hidden tab or a display:none card; don't strand the learner.
    window.setTimeout(() => {
      if (pendingGo.current === go) go()
    }, 400)
  }
  const onNext = () => {
    const from = targetIndex.current ?? index
    if (from < steps.length - 1) goTo(from + 1)
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
          <div className="lesson-head-row">
            <p className="lesson-meta">
              <Icon name="clock" size={16} /> {lesson.minutes} min
              <span aria-hidden="true">·</span>
              {steps.length} steps
            </p>
            <CompletionChecklist lesson={lesson} onJumpToChallenges={jumpToChallenges} />
          </div>
        </div>
        <div className="lesson-mastery">
          <ProgressRing value={mastery(lesson)} size={68} />
          {unreadSteps > 0 && (
            <p className="lesson-mastery-note mono">
              steps read {steps.length - unreadSteps} / {steps.length}
            </p>
          )}
        </div>
      </header>

      <div className="lesson-body">
        <div className="lesson-panel">
          <nav className="steps-nav" aria-label="Lesson steps">
            <ol ref={stepList}>
              <li ref={glider} className="steps-glider" aria-hidden="true" />
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

          <article
            className="step"
            key={step.id}
            aria-labelledby="step-title"
            data-leaving={leaving || undefined}
            onAnimationEnd={(e) => {
              if (e.animationName !== 'step-out' || e.target !== e.currentTarget) return
              const go = pendingGo.current
              pendingGo.current = undefined
              go?.()
            }}
          >
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
              onHighlight={highlightParts}
              onJumpToChallenges={jumpToChallenges}
              buildStep={buildStep}
              onBuildStep={setBuildStep}
              wiringStaged={wiringStage}
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
                className={quizInProgress ? 'btn btn-ghost' : 'btn btn-primary'}
                onClick={onNext}
                aria-describedby={isLast ? 'next-caption' : undefined}
              >
                {quizInProgress ? 'Skip quiz' : 'Next'}
                <Icon name="right" size={18} />
              </button>
            </div>
          </div>
        </div>

        {lesson.lab && (
          <div
            className="lesson-stage"
            data-collapsed={stageCollapsed || undefined}
            data-view={wiringStage ? stageView : undefined}
          >
            <div className="stage-bar">
              {wiringStage ? (
                <div className="stage-views" role="group" aria-label="Stage view">
                  <button type="button" aria-pressed={stageView === 'wiring'} onClick={() => setStageView('wiring')}>
                    Wiring
                  </button>
                  <button type="button" aria-pressed={stageView === 'lab'} onClick={() => setStageView('lab')}>
                    Simulator
                  </button>
                </div>
              ) : (
                <span className="stage-bar-title">
                  <span className="live-dot" aria-hidden="true" />
                  {lesson.lab.title}
                </span>
              )}
              <button
                type="button"
                className="stage-toggle"
                aria-expanded={!stageCollapsed}
                aria-controls="lesson-stage-lab"
                onClick={() => setStageCollapsed((c) => !c)}
              >
                {stageCollapsed ? 'Show circuit' : 'Hide circuit'}
                <Icon name={stageCollapsed ? 'down' : 'up'} size={16} />
              </button>
            </div>
            <div className="lesson-stage-lab" id="lesson-stage-lab">
              {wiringStage && build?.breadboard && (
                <div className="stage-wiring" aria-hidden={!showWiring || undefined} inert={!showWiring}>
                  <WiringFigure
                    layout={build.breadboard}
                    title={lesson.title}
                    highlight={buildStep === null ? [] : partsForStep(build, buildStep)}
                  >
                    {/* A visual echo of the current step under the board; the step list carries it for screen readers. */}
                    {buildStep !== null && (
                      <p className="wiring-step" aria-hidden="true">
                        <span className="wiring-step-num mono">
                          Step {buildStep + 1} of {build.steps.length}
                        </span>
                        <span className="wiring-step-text">
                          <RichText text={build.steps[buildStep]} />
                        </span>
                      </p>
                    )}
                  </WiringFigure>
                </div>
              )}
              {/* Behind the wiring view the lab stays mounted, so it keeps its state. */}
              <div className="stage-sim" aria-hidden={showWiring || undefined} inert={showWiring}>
                <StageLab lessonId={lesson.id} lab={lesson.lab} highlight={highlight} showFlow={animateFlow} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Open the lab's challenge tray and bring it into view: the Lab's `.lab-tray-details` (or `#lab-challenges` /
 * `.lab-challenges`), opened if it is or sits in a <details>, then its summary gets focus.
 */
function revealChallenges() {
  const target = document.querySelector<HTMLElement>('#lab-challenges, .lab-tray-details, .lab-challenges')
  if (!target) return
  const details = target instanceof HTMLDetailsElement ? target : target.closest('details')
  if (details) details.open = true
  const focusable = target.matches('summary, button, [tabindex]') ? target : target.querySelector<HTMLElement>('summary, button')
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
  focusable?.focus({ preventScroll: true })
}

/** What "complete" needs: quiz ≥ 80 % and every lab challenge. Shown in the header and on the Build step. */
function CompletionChecklist({
  lesson,
  onJumpToChallenges,
}: {
  lesson: Lesson
  onJumpToChallenges: () => void
}) {
  const { progress, isComplete } = useProgress()
  const lp = progress.lessons[lesson.id]
  const best = Math.round((lp?.quizBest ?? 0) * 100)
  const quizDone = (lp?.quizBest ?? 0) >= 0.8
  const challenges = lesson.lab?.challenges ?? []
  const challengesDone = challenges.filter((c) => lp?.challengesDone.includes(c.id)).length
  const labDone = challengesDone === challenges.length
  const complete = isComplete(lesson)

  return (
    <div className="checklist" role="group" aria-label="To complete this lesson" data-complete={complete || undefined}>
      <p className="checklist-title">{complete ? 'Lesson complete' : 'To complete this lesson'}</p>
      <ul>
        <li data-done={quizDone || undefined}>
          <span className="checklist-mark" aria-hidden="true">
            <Icon name={quizDone ? 'check' : 'close'} size={14} />
          </span>
          <span>
            Quiz ≥ 80 %{' '}
            <span className="checklist-detail mono">
              {lp?.quizAttempts ? `best ${best} %` : 'not taken yet'}
            </span>
            <span className="sr-only">{quizDone ? ', done' : ', not done yet'}</span>
          </span>
        </li>
        {challenges.length > 0 && (
          <li data-done={labDone || undefined}>
            <span className="checklist-mark" aria-hidden="true">
              <Icon name={labDone ? 'check' : 'close'} size={14} />
            </span>
            <span>
              Lab challenges{' '}
              <span className="checklist-detail mono">
                {challengesDone} / {challenges.length}
              </span>
              <span className="sr-only">{labDone ? ', done' : ', not done yet'}</span>
            </span>
            {!labDone && (
              <button type="button" className="checklist-jump" onClick={onJumpToChallenges}>
                Go to challenges
              </button>
            )}
          </li>
        )}
      </ul>
    </div>
  )
}

function StepContent({
  lesson,
  stepId,
  onHighlight,
  onJumpToChallenges,
  buildStep,
  onBuildStep,
  wiringStaged,
}: {
  lesson: Lesson
  stepId: string
  onHighlight: (ids: string[]) => void
  onJumpToChallenges: () => void
  buildStep: number | null
  onBuildStep: (step: number) => void
  wiringStaged: boolean
}) {
  if (stepId === 'quiz') return <Quiz lessonId={lesson.id} questions={lesson.quiz} />

  if (stepId === 'build' && lesson.realBuild)
    return (
      <div className="build">
        <BuildGuide
          build={lesson.realBuild}
          title={lesson.title}
          active={buildStep}
          onActive={onBuildStep}
          staged={wiringStaged}
        />
        <CompletionChecklist lesson={lesson} onJumpToChallenges={onJumpToChallenges} />
      </div>
    )

  const section = lesson.sections.find((s) => s.id === stepId)
  return (
    <div className="blocks">
      {section?.blocks.map((block, i) => (
        <BlockView key={i} block={block} onHighlight={onHighlight} />
      ))}
    </div>
  )
}
