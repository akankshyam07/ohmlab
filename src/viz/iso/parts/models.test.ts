import { describe, expect, it } from 'vitest'
import { PART_ANCHORS, type PartId } from '../../../content/types'
import { PART_MODELS, listModelAnchors } from './models'

describe('part models', () => {
  const ids = Object.keys(PART_ANCHORS) as PartId[]

  it('there is one model per PartId', () => {
    expect(Object.keys(PART_MODELS).sort()).toEqual([...ids].sort())
  })

  for (const id of ids) {
    it(`${id} provides exactly the anchors PART_ANCHORS lists, each inside its bounds`, () => {
      const m = PART_MODELS[id]
      expect(m.id).toBe(id)
      expect(Object.keys(m.anchors).sort()).toEqual([...PART_ANCHORS[id]].sort())
      expect(listModelAnchors(id)).toEqual([...PART_ANCHORS[id]])
      const b = m.bounds
      for (const [name, p] of Object.entries(m.anchors)) {
        for (const v of [p.x, p.y, p.z]) expect(Number.isFinite(v), `${id}.${name}`).toBe(true)
        const tol = 1.5
        expect(p.x, `${id}.${name} x`).toBeGreaterThanOrEqual(b.x0 - tol)
        expect(p.x, `${id}.${name} x`).toBeLessThanOrEqual(b.x1 + tol)
        expect(p.y, `${id}.${name} y`).toBeGreaterThanOrEqual(b.y0 - tol)
        expect(p.y, `${id}.${name} y`).toBeLessThanOrEqual(b.y1 + tol)
        expect(p.z, `${id}.${name} z`).toBeGreaterThanOrEqual(b.z0 - tol)
        expect(p.z, `${id}.${name} z`).toBeLessThanOrEqual(b.z1 + tol)
      }
    })
  }
})
