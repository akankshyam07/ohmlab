import { useState, type FormEvent } from 'react'
import type { QuizQuestion } from '../../content/types'
import { useProgress } from '../../progress/store'
import { formatSI } from '../../ui/format'
import { RichText } from '../../ui/RichText'
import { parseAnswer, unitScale } from './parse'
import './Quiz.css'

type Status = 'answering' | 'retry' | 'answered'

const PASS = 0.8

/** formatAnswer(13.6, 'mA') → "13.6 mA"; formatAnswer(0.5, 'mA') → "500 µA". */
function formatAnswer(answer: number, unit: string): string {
  const scale = unitScale(unit)
  return formatSI(answer * scale, scale === 1 ? unit : unit.slice(1))
}

export function Quiz({ lessonId, questions }: { lessonId: string; questions: QuizQuestion[] }) {
  const { recordQuiz } = useProgress()
  const [index, setIndex] = useState(0)
  const [status, setStatus] = useState<Status>('answering')
  const [selected, setSelected] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [unparseable, setUnparseable] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)

  const total = questions.length
  if (total === 0) return null
  const question = questions[Math.min(index, total - 1)]

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
    if (isCorrect && status === 'answering') setScore((s) => s + 1)
  }

  const next = () => {
    if (index + 1 < total) {
      setIndex(index + 1)
      resetQuestion()
    } else {
      setFinished(true)
      recordQuiz(lessonId, score / total)
    }
  }

  const restart = () => {
    setIndex(0)
    setScore(0)
    setFinished(false)
    resetQuestion()
  }

  if (finished) {
    const passed = score / total >= PASS
    return (
      <section aria-label="Quiz" className="quiz">
        <div className={`quiz-result ${passed ? 'quiz-result--pass' : ''}`} aria-live="polite">
          <p className="quiz-score">
            You scored {score} / {total}
          </p>
          <p>
            {passed
              ? 'Nice work, that’s a pass! You’ve got the core ideas of this lesson.'
              : `You need ${Math.ceil(PASS * total)} / ${total} to pass. Skim the lesson again, then have another go.`}
          </p>
        </div>
        <button type="button" className="quiz-button" onClick={restart} autoFocus>
          Retry quiz
        </button>
      </section>
    )
  }

  const answered = status === 'answered'
  const correctOption = question.type === 'choice' ? question.options.find((o) => o.correct) : undefined

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
            {question.options.map((option, i) => (
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
                  autoFocus={index > 0 && i === 0}
                />
                <span>
                  <RichText text={option.text} />
                </span>
              </label>
            ))}
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
        {status === 'retry' && question.type === 'numeric' && (
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
                    The right answer is <strong><RichText text={correctOption.text} /></strong>.{' '}
                    <RichText text={correctOption.why} />
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
