import { describe, expect, it } from 'vitest'
import {
  type Box3,
  VIEWS,
  compareDepth,
  convexHull,
  depthSort,
  faceShade,
  fitCamera,
  groundMatrix,
  hullBands,
  iso,
  makeCamera,
  pointAt,
  prism,
  project,
  rect,
  shade,
  track,
} from './geom'

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6)

describe('projection', () => {
  it('the front view is true isometric: iso() on the bench turned a quarter turn', () => {
    const cam = makeCamera(VIEWS.front, 3)
    for (const [x, y, z] of [
      [0, 0, 0],
      [10, 0, 0],
      [0, 10, 0],
      [4, -7, 9],
      [82, 55, 8.5],
    ]) {
      const p = project(cam, x, y, z)
      const q = iso(y, -x, z, 3)
      close(p.x, q.sx)
      close(p.y, q.sy)
    }
  })

  it('iso() uses 30° axes and full-height z', () => {
    close(iso(1, 0).sy / iso(1, 0).sx, Math.tan(Math.PI / 6))
    close(iso(0, 0, 1).sy, -1)
  })

  it('groundMatrix maps the plane at height z exactly like project()', () => {
    for (const v of Object.values(VIEWS)) {
      const cam = makeCamera(v, 2.5, 100, 40)
      const [a, b, c, d, e, f] = groundMatrix(cam, 8.5)
      const p = project(cam, 12, -30, 8.5)
      close(a * 12 + c * -30 + e, p.x)
      close(b * 12 + d * -30 + f, p.y)
    }
  })

  it('fitCamera keeps every point inside the padded frame', () => {
    const pts = [
      { x: 0, y: 0, z: 0 },
      { x: 84, y: 53, z: 8.5 },
      { x: 30, y: -60, z: 14 },
    ]
    for (const v of Object.values(VIEWS)) {
      const cam = fitCamera(v, pts, 1000, 600, 0.1)
      for (const p of pts) {
        const s = project(cam, p.x, p.y, p.z)
        expect(s.x).toBeGreaterThanOrEqual(100 - 1e-6)
        expect(s.x).toBeLessThanOrEqual(900 + 1e-6)
        expect(s.y).toBeGreaterThanOrEqual(60 - 1e-6)
        expect(s.y).toBeLessThanOrEqual(540 + 1e-6)
      }
    }
  })
})

describe('shading', () => {
  it('darkens and lightens a hex colour', () => {
    expect(shade('#808080', 0.5)).toBe('#404040')
    expect(shade('#000000', -1)).toBe('#ffffff')
    expect(shade('#123456', 0)).toBe('#123456')
  })

  it('left faces get 18 % and right faces 32 % at true isometric angles', () => {
    const cam = makeCamera(VIEWS.front)
    // At yaw −45° the camera sees the −x face (screen-left) and the +y face (screen-right).
    close(faceShade(cam, -1, 0), 0.18)
    close(faceShade(cam, 0, 1), 0.32)
  })

  it('a box shows its top and exactly the two faces turned to the camera', () => {
    const cam = makeCamera(VIEWS.front)
    const faces = prism(cam, rect(0, 0, 10, 10), 0, 5)
    expect(faces.sides).toHaveLength(2)
    expect(faces.sides.map((s) => +s.shade.toFixed(2)).sort()).toEqual([0.18, 0.32])
    expect(faces.frontEdges).toHaveLength(2)
    // Winding doesn't matter.
    expect(prism(cam, [...rect(0, 0, 10, 10)].reverse(), 0, 5).sides).toHaveLength(2)
  })
})

describe('depth sorting', () => {
  const board: Box3 = { x0: 0, x1: 84, y0: 0, y1: 53, z0: 0, z1: 8.5 }
  const led: Box3 = { x0: 30, x1: 36, y0: 10, y1: 16, z0: 8.5, z1: 20 }

  it('paints a part on the board after the board', () => {
    const cam = makeCamera(VIEWS.front)
    expect(compareDepth(cam, board, led)).toBeLessThan(0)
    expect(compareDepth(cam, led, board)).toBeGreaterThan(0)
  })

  it('orders side-by-side solids by which side the camera is on', () => {
    const a: Box3 = { x0: 0, x1: 5, y0: 0, y1: 5, z0: 0, z1: 5 }
    const b: Box3 = { x0: 0, x1: 5, y0: 10, y1: 15, z0: 0, z1: 5 }
    // Every preset camera looks from +y, so the larger-y solid is nearer.
    for (const v of Object.values(VIEWS)) expect(compareDepth(makeCamera(v), a, b)).toBeLessThan(0)
    // Along x it depends on the yaw: front (−45°) looks from −x, right (+22°) from +x.
    const c: Box3 = { ...a, x0: 10, x1: 15 }
    expect(compareDepth(makeCamera(VIEWS.front), a, c)).toBeGreaterThan(0)
    expect(compareDepth(makeCamera(VIEWS.right), a, c)).toBeLessThan(0)
  })

  it('depthSort paints back to front and survives overlapping boxes', () => {
    const cam = makeCamera(VIEWS.front)
    const back: Box3 = { x0: 0, x1: 5, y0: 0, y1: 5, z0: 0, z1: 5 }
    const mid: Box3 = { ...back, y0: 10, y1: 15 }
    const front: Box3 = { ...back, y0: 20, y1: 25 }
    const names = depthSort(cam, [front, back, mid], (b) => b).map((b) => (b === back ? 'back' : b === mid ? 'mid' : 'front'))
    expect(names).toEqual(['back', 'mid', 'front'])
    const sorted = depthSort(cam, [board, led, board], (b) => b)
    expect(sorted).toHaveLength(3)
    expect(sorted[2]).toBe(led)
  })
})

describe('outlines and tracks', () => {
  it('convexHull drops interior points', () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 5 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ])
    expect(hull).toHaveLength(4)
  })

  it('hullBands of a diamond leave its bounding-box corners free', () => {
    const diamond = [
      { x: 50, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 100 },
      { x: 0, y: 50 },
    ]
    const bands = hullBands(diamond, 10)
    expect(bands).toHaveLength(10)
    const coversCorner = bands.some((b) => b.x0 <= 5 && b.y0 <= 5)
    expect(coversCorner).toBe(false)
    expect(bands.some((b) => b.x0 <= 1 && b.x1 >= 99)).toBe(true)
  })

  it('pointAt walks a polyline at constant speed', () => {
    const t = track([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ])
    expect(t.length).toBe(20)
    expect(pointAt(t, 5)).toEqual({ x: 5, y: 0 })
    expect(pointAt(t, 15)).toEqual({ x: 10, y: 5 })
    expect(pointAt(t, 99)).toEqual({ x: 10, y: 10 })
  })
})
