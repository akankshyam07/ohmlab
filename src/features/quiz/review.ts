import type { Block, Lesson, QuizQuestion, Section } from '../../content/types'

const STOP = new Set(
  'the and for are but not you your with that this what which when does into from than then them they each have has its how why who will would can could should about there their more less just only also very much any some all one two out off use used using like make makes made get gets show shows'.split(
    ' ',
  ),
)

/** Lower-case content words, with a plural "s" dropped so "flows" meets "flow". */
function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[*`]/g, '')
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 3 && !STOP.has(w))
      .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)),
  )
}

function strings(x: unknown): string[] {
  if (typeof x === 'string') return [x]
  if (Array.isArray(x)) return x.flatMap(strings)
  if (x && typeof x === 'object') return Object.values(x).flatMap(strings)
  return []
}

const keyTerms = (text: string) => [...text.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1])
const firstSentence = (text: string) => text.split(/(?<=[.!?])\s/)[0]

/** What the question teaches: its prompt and its right answer, not the distractors. */
function idea(q: QuizQuestion): string[] {
  if (q.type === 'numeric') return [q.prompt, q.hint, q.explanation]
  const right = q.options.find((o) => o.correct)
  return [q.prompt, right?.text ?? '', right?.why ?? '']
}

/** Worked examples and predictions: the blocks that practise one idea. Distractor options are left out. */
function practice(b: Block): string[] | undefined {
  if (b.type === 'walkthrough') return [b.title, ...b.steps.flatMap((s) => [s.text, s.math ?? ''])]
  if (b.type === 'predict') return idea({ id: b.id, type: 'choice', prompt: b.prompt, options: b.options })
  return undefined
}

/**
 * The lesson section that best teaches a quiz question. Words from the question's prompt and right answer
 * score by rarity across sections; a word counts triple when it is a key term (in the section title, or
 * bold in a text block's first sentence, where the lessons introduce their terms), and the section's best-matching walkthrough or predict block adds its own
 * overlap on top, so the section that practises the idea wins over one that only mentions its words.
 * ponytail: word overlap, not meaning; add an explicit `section` on QuizQuestion if a pick reads wrong.
 */
export function teachingSection(lesson: Lesson, question: QuizQuestion): Section | undefined {
  const query = words(idea(question).join(' '))
  const sections = lesson.sections.map((s) => ({
    s,
    body: words([s.title, ...strings(s.blocks)].join(' ')),
    key: words([s.title, ...s.blocks.flatMap((b) => (b.type === 'text' ? keyTerms(firstSentence(b.text)) : []))].join(' ')),
    practices: s.blocks.flatMap((b) => {
      const text = practice(b)
      return text ? [words(text.join(' '))] : []
    }),
  }))
  const weight = (w: string) => Math.log(1 + sections.length / sections.filter((x) => x.body.has(w)).length)
  const overlap = (set: Set<string>) => [...query].reduce((sum, w) => sum + (set.has(w) ? weight(w) : 0), 0)
  let best: Section | undefined
  let bestScore = 0
  for (const { s, body, key, practices } of sections) {
    const score = overlap(body) + 2 * overlap(key) + Math.max(0, ...practices.map(overlap))
    if (score > bestScore) [best, bestScore] = [s, score]
  }
  return best
}
