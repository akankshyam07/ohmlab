const PREFIX_SCALE: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  µ: 1e-6, // micro sign U+00B5
  μ: 1e-6, // Greek mu U+03BC
  m: 1e-3,
  k: 1e3,
  K: 1e3,
  M: 1e6,
}

const WORD_PREFIX: [string, number][] = [
  ['pico', 1e-12],
  ['nano', 1e-9],
  ['micro', 1e-6],
  ['milli', 1e-3],
  ['kilo', 1e3],
  ['mega', 1e6],
]

function prefixScale(suffix: string): number {
  const lower = suffix.toLowerCase()
  const word = WORD_PREFIX.find(([name]) => lower.startsWith(name))
  return word ? word[1] : (PREFIX_SCALE[suffix[0]] ?? 1)
}

const QUANTITY =/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([\p{L}%°\s-]*)$/iu

function parseParts(text: string): { value: number; suffix: string } | null {
  const match = QUANTITY.exec(text.trim().replace(',', '.'))
  if (!match) return null
  const value = Number(match[1])
  const suffix = match[2].trim()
  if (!Number.isFinite(value)) return null
  return { value: value * prefixScale(suffix), suffix }
}

/**
 * "330" → 330, "0.33k" → 330, "330 Ω" → 330, "13.6 mA" → 0.0136, "13,6" → 13.6.
 * A number, an optional SI prefix (p n u µ m k M) and an optional unit. Returns null if it isn't a number.
 */
export function parseSI(text: string): number | null {
  return parseParts(text)?.value ?? null
}

/** Scale of a unit's own prefix: unitScale('mA') = 1e-3, unitScale('kΩ') = 1e3, unitScale('V') = 1. */
export function unitScale(unit: string): number {
  return unit.length > 1 ? (PREFIX_SCALE[unit[0]] ?? 1) : 1
}

/**
 * Parse a learner's answer into the question's unit. A bare number ("13.6") is read in the question's
 * unit; anything with a prefix or unit ("13.6 mA", "0.0136 A") is converted. Null if unparseable.
 */
export function parseAnswer(text: string, unit: string): number | null {
  const parts = parseParts(text)
  if (!parts) return null
  return parts.suffix === '' ? parts.value : parts.value / unitScale(unit)
}
