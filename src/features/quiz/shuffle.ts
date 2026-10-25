/** 32-bit FNV-1a hash of a string, used as an RNG seed. */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return h >>> 0
}

/** mulberry32: a tiny seeded PRNG returning floats in [0, 1). */
function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Indices 0..n-1 in a Fisher–Yates order fixed by the seed: same seed, same order. */
export function shuffledOrder(seed: string, n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i)
  const random = rng(hash(seed))
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

/** The order a choice question's options are shown in, for one quiz attempt. */
export const optionOrder = (lessonId: string, questionId: string, attempt: number, n: number) =>
  shuffledOrder(`${lessonId}|${questionId}|${attempt}`, n)
