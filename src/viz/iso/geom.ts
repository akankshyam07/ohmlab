// Isometric projection, shading and depth sorting for the illustrated bench. Pure maths, no DOM.
// Model space is millimetres: x and y on the bench, z up. Screen space is SVG user units, y down.

export interface Pt {
  x: number
  y: number
}

export type IsoViewName = 'front' | 'left' | 'right' | 'top'

/** A camera direction: yaw turns the bench about z, tilt is the camera's elevation above the bench. */
export interface View {
  yaw: number
  tilt: number
}

const C = Math.cos(Math.PI / 6)
const S = Math.sin(Math.PI / 6)
/** The skill's reference projection: true isometric angles, z drawn at full scale. */
export const iso = (x: number, y: number, z = 0, k = 1) => ({ sx: (x - y) * C * k, sy: (x + y) * S * k - z * k })

const deg = Math.PI / 180
export const VIEWS: Record<IsoViewName, View> = {
  // True isometric (tilt atan(1/√2)) from the bench's front-left corner, so the breadboard's columns
  // climb to the right and the Uno sits behind. Equals iso() on the bench turned a quarter turn: iso(y, -x).
  front: { yaw: -45 * deg, tilt: Math.atan(Math.SQRT1_2) },
  // Further round to the left: the Uno's USB and power-jack openings face the camera.
  left: { yaw: -72 * deg, tilt: 32 * deg },
  // From the right end of the board, looking along the rows.
  right: { yaw: 22 * deg, tilt: 30 * deg },
  top: { yaw: 0, tilt: 68 * deg },
}

/** Scale that makes the general projection equal iso() at true isometric angles. */
const N = Math.sqrt(1.5)

export interface Camera {
  view: View
  /** Screen units per model mm along a ground axis at the front view (iso's k). */
  k: number
  ox: number
  oy: number
  ca: number
  sa: number
  ct: number
  st: number
}

export function makeCamera(view: View, k = 1, ox = 0, oy = 0): Camera {
  return { view, k, ox, oy, ca: Math.cos(view.yaw), sa: Math.sin(view.yaw), ct: Math.cos(view.tilt), st: Math.sin(view.tilt) }
}

export function project(cam: Camera, x: number, y: number, z = 0): Pt {
  const u = x * cam.ca - y * cam.sa
  const w = x * cam.sa + y * cam.ca
  return { x: cam.ox + u * N * cam.k, y: cam.oy + (w * cam.st - z * cam.ct) * N * cam.k }
}

/** Screen units per mm for lengths that face the camera (spheres, wire thickness). */
export const unitScale = (cam: Camera) => N * cam.k

/** Unit vector from the bench towards the camera. */
export const viewer = (cam: Camera) => ({ x: cam.sa * cam.ct, y: cam.ca * cam.ct, z: cam.st })

/** Distance towards the camera: larger is nearer, so it is painted later (proportional to x + y + z at iso's angles). */
export const depth = (cam: Camera, x: number, y: number, z = 0) => (x * cam.sa + y * cam.ca) * cam.ct + z * cam.st

/** SVG matrix(a b c d e f) mapping the bench plane at height z (model mm) to the screen. */
export function groundMatrix(cam: Camera, z = 0): [number, number, number, number, number, number] {
  const s = N * cam.k
  return [cam.ca * s, cam.sa * cam.st * s, -cam.sa * s, cam.ca * cam.st * s, cam.ox, cam.oy - z * cam.ct * s]
}

export type Affine = [number, number, number, number, number, number]

export function multiplyAffine([a1, b1, c1, d1, e1, f1]: Affine, [a2, b2, c2, d2, e2, f2]: Affine): Affine {
  return [a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2, b1 * c2 + d1 * d2, a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1]
}

export function invertAffine([a, b, c, d, e, f]: Affine): Affine {
  const det = a * d - b * c
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]
}

/* ------------------------------------------------------------------ shading */

/** Darken a #rrggbb colour towards black by `amount` (0..1); negative amounts lighten towards white. */
export function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(amount >= 0 ? v * (1 - amount) : v + (255 - v) * -amount))
  return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('')
}

/** Mix two #rrggbb colours: t = 0 gives a, 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = [16, 8, 0].map((s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t))
  return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('')
}

export const TOP_SHADE = 0
export const LEFT_SHADE = 0.18
export const RIGHT_SHADE = 0.32

/**
 * Darkening for a vertical face whose outward normal is (nx, ny): faces turned to screen-left get
 * LEFT_SHADE, to screen-right RIGHT_SHADE (exactly, at the front view), curved faces in between.
 */
export function faceShade(cam: Camera, nx: number, ny: number): number {
  const len = Math.hypot(nx, ny) || 1
  const sx = (nx * cam.ca - ny * cam.sa) / len
  return (LEFT_SHADE + RIGHT_SHADE) / 2 + ((RIGHT_SHADE - LEFT_SHADE) / 2) * (sx / Math.SQRT1_2)
}

/* ------------------------------------------------------------------ solids */

export interface Face {
  pts: Pt[]
  /** Darkening to apply to the solid's base colour. */
  shade: number
}

export interface PrismFaces {
  top: Pt[]
  /** Visible side faces, back to front. */
  sides: Face[]
  /** Edges of the top face that face the camera (where the highlight line goes). */
  frontEdges: [Pt, Pt][]
}

/** Visible faces of a vertical extrusion of a ground polygon (either winding) from z0 to z1. */
export function prism(cam: Camera, poly: Pt[], z0: number, z1: number): PrismFaces {
  let area = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    area += p.x * q.y - q.x * p.y
  }
  const sign = area > 0 ? 1 : -1
  const v = viewer(cam)
  const sides: (Face & { d: number })[] = []
  const frontEdges: [Pt, Pt][] = []
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    // Outward normal: for a positive-area (counter-clockwise in x-right, y-down maths) polygon, (dy, -dx).
    const nx = sign * (q.y - p.y)
    const ny = sign * -(q.x - p.x)
    if (nx * v.x + ny * v.y <= 1e-9) continue
    sides.push({
      pts: [project(cam, p.x, p.y, z0), project(cam, q.x, q.y, z0), project(cam, q.x, q.y, z1), project(cam, p.x, p.y, z1)],
      shade: faceShade(cam, nx, ny),
      d: depth(cam, (p.x + q.x) / 2, (p.y + q.y) / 2),
    })
    frontEdges.push([project(cam, p.x, p.y, z1), project(cam, q.x, q.y, z1)])
  }
  sides.sort((a, b) => a.d - b.d)
  return { top: poly.map((p) => project(cam, p.x, p.y, z1)), sides, frontEdges }
}

export const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
]

/** A ground circle as a polygon; points beyond `flat` along `flatDir` are pressed onto that line (an LED's flat rim). */
export function circlePoly(cx: number, cy: number, r: number, n = 28, flat?: { dir: Pt; at: number }): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    let dx = Math.cos(a) * r
    let dy = Math.sin(a) * r
    if (flat) {
      const along = dx * flat.dir.x + dy * flat.dir.y
      if (along > flat.at) {
        dx -= (along - flat.at) * flat.dir.x
        dy -= (along - flat.at) * flat.dir.y
      }
    }
    return { x: cx + dx, y: cy + dy }
  })
}

/** Screen geometry of a vertical cylinder: axis-aligned ellipses at both ends (true for every view). */
export function cylinder(cam: Camera, cx: number, cy: number, z0: number, z1: number, r: number) {
  const top = project(cam, cx, cy, z1)
  const bottom = project(cam, cx, cy, z0)
  const rx = r * unitScale(cam)
  const ry = rx * cam.st
  // Side: front half of the bottom ellipse, up the right edge, front half of the top ellipse back, close.
  const side =
    `M${f(bottom.x - rx)} ${f(bottom.y)}A${f(rx)} ${f(ry)} 0 0 0 ${f(bottom.x + rx)} ${f(bottom.y)}` +
    `L${f(top.x + rx)} ${f(top.y)}A${f(rx)} ${f(ry)} 0 0 1 ${f(top.x - rx)} ${f(top.y)}Z`
  return { top, bottom, rx, ry, side }
}

/** Convex hull (Andrew's monotone chain), for the silhouette of a smooth convex solid. */
export function convexHull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  if (pts.length < 3) return pts
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower: Pt[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Pt[] = []
  for (const p of pts.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

/* ------------------------------------------------------------------ depth sorting */

/** Axis-aligned bounds of a solid in model mm. */
export interface Box3 {
  x0: number
  x1: number
  y0: number
  y1: number
  z0: number
  z1: number
}

const EPS = 1e-6

/**
 * Painter's order of two solids: < 0 when `a` must be painted before `b`, > 0 after, 0 when no axis
 * separates them (then they don't hide each other and any order works). A separating axis decides by
 * which side the camera is on; ground axes first, so stacking (z) only decides for overlapping footprints.
 */
export function compareDepth(cam: Camera, a: Box3, b: Box3): number {
  const v = viewer(cam)
  const axes: [keyof Box3, keyof Box3, number][] = [
    ['x0', 'x1', v.x],
    ['y0', 'y1', v.y],
    ['z0', 'z1', v.z],
  ]
  for (const [lo, hi, dir] of axes) {
    if (Math.abs(dir) < EPS) continue
    if (a[hi] <= b[lo] + EPS) return dir > 0 ? -1 : 1
    if (b[hi] <= a[lo] + EPS) return dir > 0 ? 1 : -1
  }
  return 0
}

const centreDepth = (cam: Camera, b: Box3) => depth(cam, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2)

/**
 * Painter's algorithm: back first. A topological sort over pairwise compareDepth (which isn't
 * transitive, so Array.sort can't use it), ties broken by centre depth.
 */
export function depthSort<T>(cam: Camera, items: T[], boxOf: (item: T) => Box3): T[] {
  const n = items.length
  const boxes = items.map(boxOf)
  const after: number[][] = items.map(() => [])
  const indegree = new Array<number>(n).fill(0)
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const c = compareDepth(cam, boxes[i], boxes[j])
      if (c < 0) {
        after[i].push(j)
        indegree[j]++
      } else if (c > 0) {
        after[j].push(i)
        indegree[i]++
      }
    }
  const key = boxes.map((b) => centreDepth(cam, b))
  const ready = items.map((_, i) => i).filter((i) => indegree[i] === 0)
  const out: T[] = []
  const done = new Array<boolean>(n).fill(false)
  while (out.length < n) {
    if (!ready.length) {
      // A cycle (overlapping boxes): fall back to the nearest-to-back remaining item.
      let best = -1
      for (let i = 0; i < n; i++) if (!done[i] && (best < 0 || key[i] < key[best])) best = i
      ready.push(best)
    }
    ready.sort((p, q) => key[p] - key[q])
    const i = ready.shift()!
    if (done[i]) continue
    done[i] = true
    out.push(items[i])
    for (const j of after[i]) if (--indegree[j] === 0 && !done[j]) ready.push(j)
  }
  return out
}

/* ------------------------------------------------------------------ curves */

export interface Vec3 {
  x: number
  y: number
  z: number
}

/** Point on a cubic Bézier in model space. */
export function cubicAt(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y, z: a * p0.z + b * p1.z + c * p2.z + d * p3.z }
}

/** A polyline with cumulative lengths, for moving things along it at constant speed. */
export interface Track {
  pts: Pt[]
  cum: number[]
  length: number
}

export function track(pts: Pt[]): Track {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  return { pts, cum, length: cum[cum.length - 1] }
}

export function pointAt(t: Track, d: number): Pt {
  if (t.pts.length === 1 || d <= 0) return t.pts[0]
  if (d >= t.length) return t.pts[t.pts.length - 1]
  let lo = 0
  let hi = t.cum.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (t.cum[mid] <= d) lo = mid
    else hi = mid
  }
  const s = (d - t.cum[lo]) / (t.cum[hi] - t.cum[lo] || 1)
  return { x: t.pts[lo].x + (t.pts[hi].x - t.pts[lo].x) * s, y: t.pts[lo].y + (t.pts[hi].y - t.pts[lo].y) * s }
}

/* ------------------------------------------------------------------ fitting */

/** Camera for `view` that fits model points into a width × height frame with `pad` (fraction) all round. */
export function fitCamera(view: View, points: Vec3[], width: number, height: number, pad = 0.06): Camera {
  const unit = makeCamera(view)
  const pts = points.map((p) => project(unit, p.x, p.y, p.z))
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const k = Math.min((width * (1 - 2 * pad)) / (x1 - x0 || 1), (height * (1 - 2 * pad)) / (y1 - y0 || 1))
  return makeCamera(view, k, width / 2 - ((x0 + x1) / 2) * k, height / 2 - ((y0 + y1) / 2) * k)
}

/**
 * A convex screen polygon as a stack of horizontal boxes (for label placement, so labels can use
 * the empty corners an isometric diamond leaves in its bounding box).
 */
export function hullBands(hull: Pt[], bands = 8): { x0: number; y0: number; x1: number; y1: number }[] {
  if (hull.length < 3) return []
  const ys = hull.map((p) => p.y)
  const [top, bottom] = [Math.min(...ys), Math.max(...ys)]
  const xsAt = (y: number) => {
    const xs: number[] = []
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i]
      const b = hull[(i + 1) % hull.length]
      if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x))
      else if (a.y === y) xs.push(a.x)
    }
    return xs
  }
  const out = []
  for (let i = 0; i < bands; i++) {
    const y0 = top + ((bottom - top) * i) / bands
    const y1 = top + ((bottom - top) * (i + 1)) / bands
    const xs = [...xsAt(y0), ...xsAt(y1), ...hull.filter((p) => p.y > y0 && p.y < y1).map((p) => p.x)]
    if (xs.length) out.push({ x0: Math.min(...xs), y0, x1: Math.max(...xs), y1 })
  }
  return out
}

/* ------------------------------------------------------------------ 2D camera (pan and zoom) */

/** A uniform zoom then pan from drawing units to stage pixels: screen = p * s + (tx, ty). */
export interface Zoom {
  s: number
  tx: number
  ty: number
}

export interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** The zoom that fits `r` (drawing units) centred in a w × h stage, leaving `margin` (fraction) round it. */
export function frameRect(r: Rect, w: number, h: number, margin = 0): Zoom {
  const rw = Math.max(1e-6, r.x1 - r.x0)
  const rh = Math.max(1e-6, r.y1 - r.y0)
  const s = Math.min((w * (1 - 2 * margin)) / rw, (h * (1 - 2 * margin)) / rh)
  return { s, tx: w / 2 - ((r.x0 + r.x1) / 2) * s, ty: h / 2 - ((r.y0 + r.y1) / 2) * s }
}

/** Zoom by `factor` about the stage point (px, py), which stays put. */
export const zoomAt = (z: Zoom, factor: number, px: number, py: number): Zoom => ({ s: z.s * factor, tx: px - (px - z.tx) * factor, ty: py - (py - z.ty) * factor })

/**
 * Keep a zoom sensible: scale within [sMin, sMax], and the content either wholly in view (when it
 * fits) or covering the stage (when it doesn't), so it can never be panned away.
 */
export function clampZoom(z: Zoom, content: Rect, w: number, h: number, sMin: number, sMax: number): Zoom {
  const s = Math.min(sMax, Math.max(sMin, z.s))
  const k = s / z.s
  // Rescale about the stage centre first so clamping the scale doesn't jump the view.
  let tx = w / 2 - (w / 2 - z.tx) * k
  let ty = h / 2 - (h / 2 - z.ty) * k
  const fit = (t: number, c0: number, c1: number, size: number) => {
    const a = -c0 * s
    const b = size - c1 * s
    return Math.min(Math.max(a, b), Math.max(Math.min(a, b), t))
  }
  tx = fit(tx, content.x0, content.x1, w)
  ty = fit(ty, content.y0, content.y1, h)
  return { s, tx, ty }
}

/* ------------------------------------------------------------------ svg strings */

/** Round to 0.01 for compact path data. */
export const f = (n: number) => (Math.round(n * 100) / 100).toString()
export const poly = (pts: Pt[], close = true) => 'M' + pts.map((p) => `${f(p.x)} ${f(p.y)}`).join('L') + (close ? 'Z' : '')
