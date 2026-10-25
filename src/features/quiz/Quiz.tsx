import { useEffect, useState, type FormEvent } from 'react'
import { getLesson } from '../../content'
import type { QuizQuestion } from '../../content/types'
import { useProgress } from '../../progress/store'
import { formatSI } from '../../ui/format'
import { RichText } from '../../ui/RichText'
import { parseAnswer, unitScale } from './parse'
import { optionOrder } from './shuffle'
import './Quiz.css'

type Status = 'answering' | 'retry' | 'answered'

const PASS = 0.8

/** formatAnswer(13.6, 'mA') → "13.6 mA"; formatAnswer(0.5, 'mA') → "500 µA". */
function formatAnswer(answer: number, unit: string): string {
  const scale = unitScale(unit)
  return formatSI(answer * scale, scale === 1 ? unit : unit.slice(1))
}

/** "…each second." inside "The right answer is …." would end with a double period. */
const withoutFinalStop = (text: string) => text.replace(/[.!?]+(\**)$/, '$1')
/** "Right. Voltage is…" reads oddly to someone who just got it wrong. */
const withoutPraise = (text: string) => text.replace(/^(right|correct|exactly|yes)[.!,]\s*/i, '')

/** Where the learner is in a quiz. Kept in sessionStorage so leaving the quiz step mid-way doesn't reset it. */
interface QuizState {
  index: number
  /** First-attempt correctness of each answered question. */
  results: boolean[]
  finished: boolean
}

const FRESH: QuizState = { index: 0, results: [], finished: false }
const sessionKey = (lessonId: string) => `ohmlab.quiz.${lessonId}`

function loadState(lessonId: string, total: number): QuizState {
  try {
    const x = JSON.parse(sessionStorage.getItem(sessionKey(lessonId)) ?? 'null') as QuizState | null
    const valid =
      x !== null &&
      Number.isInteger(x.index) &&
      Array.isArray(x.results) &&
      x.results.every((r) => typeof r === 'boolean') &&
      typeof x.finished === 'boolean' &&
      x.index >= 0 &&
      x.index < total &&
      x.results.length <= total
    return valid ? x : FRESH
  } catch {
    return FRESH // blocked storage or bad JSON: start over
  }
}

export function Quiz({ lessonId, questions }: { lessonId: string; questions: QuizQuestion[] }) {
  const { progress, recordQuiz, isComplete } = useProgress()
  const total = questions.length
  const [state, setState] = useState(() => loadState(lessonId, total))
  const [status, setStatus] = useState<Status>('answering')
  const [selected, setSelected] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [unparseable, setUnparseable] = useState(false)
  const [correct, setCorrect] = useState(false)

  useEffect(() => {
    try {
      sessionStorage.setItem(sessionKey(lessonId), JSON.stringify(state))
    } catch {
      // storage blocked: the quiz just won't survive leaving the step
    }
  }, [lessonId, state])

  if (total === 0) return null
  const { index, results, finished } = state
  const question = questions[Math.min(index, total - 1)]
  const score = results.filter(Boolean).length
  // Recorded attempts so far: the order is stable within an attempt and reshuffles on retry.
  const attempt = progress.lessons[lessonId]?.quizAttempts ?? 0

  const resetQuestion = () => {
    setStatus('answering')
    setSelected(null)
    setText('')
    setUnparseable(false)
    setCorrect(false)
  }

  const check = (e: FormEvent) => {
    e.preventDefault()
    if (status === 'answered') return
    let isCorrect: boolean
    if (question.type === 'choice') {
      if (selected === null) return
      isCorrect = question.options[selected].correct === true
      setStatus('answered')
    } else {
      const value = parseAnswer(text, question.unit)
      setUnparseable(value === null)
      if (value === null) return
      isCorrect = Math.abs(value - question.answer) <= question.tolerance * Math.abs(question.answer) + 1e-12
      // One retry for numeric answers: a wrong first attempt shows the hint instead of the solution.
      setStatus(!isCorrect && status === 'answering' ? 'retry' : 'answered')
    }
    setCorrect(isCorrect)
    if (status === 'answering' && results.length === index)
      setState((s) => ({ ...s, results: [...s.results, isCorrect] }))
  }

  const next = () => {
    if (index + 1 < total) {
      setState((s) => ({ ...s, index: s.index + 1 }))
      resetQuestion()
    } else {
      setState((s) => ({ ...s, finished: true }))
      recordQuiz(lessonId, score / total)
    }
  }

  const restart = () => {
    setState(FRESH)
    resetQuestion()
  }

  if (finished) {
    const passed = score / total >= PASS
    const lesson = getLesson(lessonId)
    const challenges = lesson?.lab?.challenges ?? []
    const done = progress.lessons[lessonId]?.challengesDone ?? []
    const unfinished = challenges.filter((c) => !done.includes(c.id))
    return (
      <section aria-label="Quiz" className="quiz">
        <div className={`quiz-result ${passed ? 'quiz-result--pass' : ''}`} aria-live="polite">
          <p className="quiz-score">
            You scored {score} / {total}
          </p>
          <p>
            {passed
              ? 'Nice work, that’s a pass! You’ve got the core ideas of this lesson.'
              : `You need ${Math.ceil(PASS * total)} / ${total} to pass. Look back at the ones you missed, then have another go.`}
          </p>
          {passed && lesson && !isComplete(lesson) && unfinished.length > 0 && (
            <div className="quiz-todo">
              <p>
                To finish this lesson, complete the lab challenges: {challenges.length - unfinished.length} /{' '}
                {challenges.length} done. Still to do:
              </p>
              <ul>
                {unfinished.map((c) => (
                  <li key={c.id}>
                    <RichText text={c.prompt} />
                  </li>
                ))}
              </ul>
              <p className="quiz-todo-where">You’ll find them in the Challenges tray under the circuit.</p>
            </div>
          )}
        </div>
        <ol className="quiz-review" aria-label="Your answers">
          {questions.map((q, i) => (
            <li key={q.id} className={results[i] ? 'quiz-review--right' : 'quiz-review--missed'}>
              <span className="quiz-review-mark" aria-hidden="true">
                {results[i] ? '✓' : '✗'}
              </span>
              <span>
                <span className="sr-only">{results[i] ? 'Right: ' : 'Missed: '}</span>
                <RichText text={q.prompt} />
              </span>
            </li>
          ))}
        </ol>
        <button type="button" className="quiz-button" onClick={restart} autoFocus>
          Retry quiz
        </button>
      </section>
    )
  }

  const answered = status === 'answered'
  const correctOption = question.type === 'choice' ? question.options.find((o) => o.correct) : undefined
  const order = question.type === 'choice' ? optionOrder(lessonId, question.id, attempt, question.options.length) : []

  return (
    <section aria-label="Quiz" className="quiz">
      <div className="quiz-progress">
        <p>
          Question {index + 1} of {total}
        </p>
        <div className="quiz-progress-bar" aria-hidden="true">
          <span style={{ width: `${((index + (answered ? 1 : 0)) / total) * 100}%` }} />
        </div>
      </div>

      <form onSubmit={check} key={question.id}>
        {question.type === 'choice' ? (
          <fieldset className="quiz-fieldset" disabled={answered}>
            <legend className="quiz-prompt">
              <RichText text={question.prompt} />
            </legend>
            {order.map((i, position) => {
              const option = question.options[i]
              return (
                <label
                  key={i}
                  className={[
                    'quiz-option',
                    answered && option.correct ? 'quiz-option--correct' : '',
                    answered && i === selected && !option.correct ? 'quiz-option--wrong' : '',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name={`quiz-${question.id}`}
                    checked={selected === i}
                    onChange={() => setSelected(i)}
                    autoFocus={index > 0 && position === 0}
                  />
                  <span>
                    <RichText text={option.text} />
                  </span>
                </label>
              )
            })}
          </fieldset>
        ) : (
          <div className="quiz-numeric">
            <p className="quiz-prompt" id={`quiz-prompt-${question.id}`}>
              <RichText text={question.prompt} />
            </p>
            <label className="quiz-numeric-field">
              <span>Your answer{question.unit ? ` (${question.unit})` : ''}</span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                aria-describedby={`quiz-prompt-${question.id}`}
                value={text}
                disabled={answered}
                onChange={(e) => setText(e.target.value)}
                autoFocus={index > 0}
              />
            </label>
          </div>
        )}

        {!answered && (
          <button
            type="submit"
            className="quiz-button"
            disabled={question.type === 'choice' ? selected === null : text.trim() === ''}
          >
            Check answer
          </button>
        )}
      </form>

      <div className="quiz-feedback" aria-live="polite">
        {unparseable && <p className="quiz-note">Type a number, like 330, 0.33k or 13.6 mA.</p>}
        {status === 'retry' && !unparseable && question.type === 'numeric' && (
          <div className="quiz-verdict quiz-verdict--retry">
            <p className="quiz-verdict-title">Not quite. Have one more go.</p>
            <p>
              <RichText text={question.hint} />
            </p>
          </div>
        )}
        {answered && (
          <div className={`quiz-verdict ${correct ? 'quiz-verdict--correct' : 'quiz-verdict--wrong'}`}>
            <p className="quiz-verdict-title">{correct ? 'Correct!' : 'Not quite.'}</p>
            {question.type === 'choice' ? (
              <>
                {selected !== null && (
                  <p>
                    <RichText text={question.options[selected].why} />
                  </p>
                )}
                {!correct && correctOption && (
                  <p>
                    The right answer is{' '}
                    <strong>
                      <RichText text={withoutFinalStop(correctOption.text)} />
                    </strong>
                    . <RichText text={withoutPraise(correctOption.why)} />
                  </p>
                )}
              </>
            ) : (
              <>
                {!correct && <p>The answer is {formatAnswer(question.answer, question.unit)}.</p>}
                <p>
                  <RichText text={question.explanation} />
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {answered && (
        <button type="button" className="quiz-button" onClick={next} autoFocus>
          Next question
        </button>
      )}
    </section>
  )
}
