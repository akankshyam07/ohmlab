import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'

interface CodeInputProps {
  length?: number
  /** Called once every box holds a digit. */
  onComplete: (code: string) => void
  onChange?: (code: string) => void
  disabled?: boolean
  invalid?: boolean
  labelledBy: string
  describedBy?: string
}

/**
 * One box per digit. Typing advances, Backspace steps back, arrows move, and a pasted or autofilled code (iOS puts
 * the whole code into the first box) spreads across the boxes. Remount it (a new `key`) to clear it.
 */
export function CodeInput({ length = 6, onComplete, onChange, disabled, invalid, labelledBy, describedBy }: CodeInputProps) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(''))
  const boxes = useRef<(HTMLInputElement | null)[]>([])

  const focus = (i: number) => {
    const box = boxes.current[Math.max(0, Math.min(length - 1, i))]
    box?.focus()
    box?.select()
  }

  const update = (next: string[]) => {
    setDigits(next)
    const code = next.join('')
    onChange?.(code)
    if (next.every((d) => d !== '')) onComplete(code)
  }

  /** Writes `typed` digits from box `at` onwards, then focuses the box after the last one written. */
  const fill = (at: number, typed: string) => {
    const next = [...digits]
    const chars = typed.slice(0, length - at).split('')
    chars.forEach((d, k) => (next[at + k] = d))
    update(next)
    focus(at + chars.length)
  }

  const onInput = (i: number, raw: string) => {
    const typed = raw.replace(/\D/g, '')
    if (!typed) {
      if (raw === '') update(digits.map((d, k) => (k === i ? '' : d)))
      return
    }
    // Typing into a filled box whose text wasn't selected gives two digits: keep the new one.
    const previous = digits[i]
    if (previous && typed.length === 2 && typed.includes(previous)) {
      fill(i, typed[0] === previous ? typed[1] : typed[0])
      return
    }
    fill(typed.length === length ? 0 : i, typed)
  }

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    const move = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: length - 1 }[e.key]
    if (move !== undefined) {
      e.preventDefault()
      focus(move)
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      const target = digits[i] || e.key === 'Delete' ? i : i - 1
      if (target < 0) return
      update(digits.map((d, k) => (k === target ? '' : d)))
      focus(target)
    }
  }

  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const typed = e.clipboardData.getData('text').replace(/\D/g, '')
    if (typed) fill(typed.length >= length ? 0 : i, typed)
  }

  return (
    <div className="code-input" role="group" aria-labelledby={labelledBy} aria-describedby={describedBy}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el
          }}
          className="code-box"
          value={d}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          enterKeyHint="done"
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          data-filled={d ? true : undefined}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => onPaste(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  )
}
