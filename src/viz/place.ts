/** Axis-aligned box in viewBox units. */
export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

const overlapArea = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))

/**
 * Greedy label placement. Items are placed in order; each takes its first candidate box that
 * overlaps no obstacle and no label placed before it, or, if every candidate collides, the one
 * with the least overlap. Returns the chosen candidate index for each item.
 */
export function placeLabels(candidates: Box[][], obstacles: Box[] = []): number[] {
  const placed = [...obstacles]
  return candidates.map((boxes) => {
    let best = 0
    let bestArea = Infinity
    for (let i = 0; i < boxes.length; i++) {
      const area = placed.reduce((sum, p) => sum + overlapArea(boxes[i], p), 0)
      if (area < bestArea) {
        best = i
        bestArea = area
      }
      if (area === 0) break
    }
    if (boxes.length) placed.push(boxes[best])
    return best
  })
}

