import type { Lesson, QuizQuestion, Section } from '../../content/types'

const STOP = new Set(
  'the and for are but not you your with that this what which when does into from than then them they each have has its how why who will would can could should about there their more less just only also very much any some all one two out off use used using like make makes made get gets show shows'.split(
    ' ',
  ),
)

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[*`]/g, '')
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => (w.length >= 3 || /\d/.test(w)) && !STOP.has(w)),
  )
}

function strings(x: unknown): string[] {
  if (typeof x === 'string') return [x]
  if (Array.isArray(x)) return x.flatMap(strings)
  if (x && typeof x === 'object') return Object.values(x).flatMap(strings)
  return []
}

/**
 * The lesson section that best teaches a quiz question: the one sharing the most distinctive words with the
 * question, its options and explanations (rarer words across sections count more; title words double).
 * ponytail: word overlap, not meaning; add an explicit `section` on QuizQuestion if a pick reads wrong.
 */
export function teachingSection(lesson: Lesson, question: QuizQuestion): Section | undefined {
  const query = words(strings(question).join(' '))
  const sections = lesson.sections.map((s) => ({ s, title: words(s.title), body: words(strings(s.blocks).join(' ')) }))
  const df = (w: string) => sections.filter((x) => x.body.has(w) || x.title.has(w)).length
  let best: Section | undefined
  let bestScore = 0
  for (const { s, title, body } of sections) {
    let score = 0
    for (const w of query) {
      if (!body.has(w) && !title.has(w)) continue
      score += Math.log(1 + sections.length / df(w)) * (title.has(w) ? 2 : 1)
    }
    if (score > bestScore) [best, bestScore] = [s, score]
  }
  return best
}
