import { useCallback, useEffect, useId, useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import type { PartId } from '../../content/types'
import { useReducedMotion, usePanZoom, useSize, useViewMorph } from './camera'
import { Defs, drawBench } from './draw'
import { type Camera, type IsoViewName, type Rect, type Vec3, type View, type Zoom, VIEWS, clampZoom, f, fitCamera, frameRect, groundMatrix, invertAffine, multiplyAffine, project } from './geom'
import { readPalette } from './model'
import { PART_MODELS } from './parts/models'
import './IsoBench.css'
import './PartViewer.css'

export interface PartViewerProps {
  partId: PartId
  /** The selected hotspot (controlled); the camera eases in on it. null or undefined shows the whole part. */
  activeAnchor?: string | null
  /** A hotspot was chosen (or cleared, with null: Escape or the reset button). */
  onAnchor?(anchor: string | null): void
  /** Visible names for hotspots, by anchor id (defaults to the id in words). */
  anchorLabels?: Record<string, string>
  ariaLabel: string
  /** Motion is also off under prefers-reduced-motion. */
  animate?: boolean
  /** A static, centred picture of the part for index tiles: no hotspots, controls, motion or listeners. */
  thumbnail?: boolean
}

const VBW = 1000
const VBH = 750
const MAX_ZOOM = 5
const deg = Math.PI / 180
/** The turntable: a full circle in 45° steps from the front view, each step a morph. */
const TURN_STEPS = 8
const STEP_MS = 560
type ViewKey = IsoViewName | `turn${number}`

function viewOf(key: ViewKey): View {
  if (key in VIEWS) return VIEWS[key as IsoViewName]
  const k = Number(key.slice(4))
  return { yaw: VIEWS.front.yaw + k * 45 * deg, tilt: VIEWS.front.tilt }
}

const words = (id: string) => id.replace(/-/g, ' ')

export function PartViewer(props: PartViewerProps) {
  return props.thumbnail ? <PartThumbnail partId={props.partId} ariaLabel={props.ariaLabel} /> : <PartExplorer {...props} />
}

/** One front view in an SVG whose viewBox hugs the part, so it centres itself at any size. */
function PartThumbnail({ partId, ariaLabel }: { partId: PartId; ariaLabel: string }) {
  const uid = 'pt' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const model = PART_MODELS[partId]
  const pal = readPalette()
  const { node, box } = useMemo(() => {
    const b = model.bounds
    const pts: Vec3[] = []
    for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) pts.push({ x, y, z })
    const cam = fitCamera(VIEWS.front, pts, VBW, VBH, 0)
    const proj = pts.map((p) => project(cam, p.x, p.y, p.z))
    const x0 = Math.min(...proj.map((p) => p.x))
    const x1 = Math.max(...proj.map((p) => p.x))
    const y0 = Math.min(...proj.map((p) => p.y))
    const y1 = Math.max(...proj.map((p) => p.y))
    const pad = Math.max(x1 - x0, y1 - y0) * 0.06
    const defs = new Defs(uid)
    const drawing = model.draw(cam, pal, defs)
    return {
      box: { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad },
      node: (
        <>
          {defs.list()}
          {drawing}
        </>
      ),
    }
  }, [model, pal, uid])
  // Ink widths assume a tile about 200 px across (close enough for a thumbnail, and no resize observer).
  return (
    <svg
      className="iso-bench pv-thumb iso-still"
      viewBox={`${f(box.x)} ${f(box.y)} ${f(box.w)} ${f(box.h)}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={ariaLabel}
      style={{ '--iso-px': `${(box.w / 200).toFixed(3)}px` } as CSSProperties}
    >
      {node}
    </svg>
  )
}

function PartExplorer({ partId, activeAnchor, onAnchor, anchorLabels, ariaLabel, animate = true }: PartViewerProps) {
  const uid = 'pv' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const model = PART_MODELS[partId]
  const reduced = useReducedMotion()
  const motion = animate && !reduced
  const [stageRef, size] = useSize<HTMLDivElement>()
  const { w: W, h: H } = size
  const pal = readPalette()

  /* ---------------- per-view drawings (cached) */
  const scenes = useMemo(() => {
    const b = model.bounds
    const pts: Vec3[] = []
    for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) pts.push({ x, y, z })
    const centre = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }
    const reach = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.95 + 20
    const cache = new Map<ViewKey, { cam: Camera; node: ReactNode; content: Rect }>()
    return (key: ViewKey) => {
      const hit = cache.get(key)
      if (hit) return hit
      const cam = fitCamera(viewOf(key), pts, VBW, VBH, 0.08)
      const defs = new Defs(`${uid}-${key}`)
      const drawing = model.draw(cam, pal, defs)
      const proj = pts.map((p) => project(cam, p.x, p.y, p.z))
      const scene = {
        cam,
        content: { x0: Math.min(...proj.map((p) => p.x)), x1: Math.max(...proj.map((p) => p.x)), y0: Math.min(...proj.map((p) => p.y)), y1: Math.max(...proj.map((p) => p.y)) },
        node: (
          <>
            {drawBench(cam, pal, `${uid}-${key}`, centre, { x: reach, y: reach * 0.85 })}
            {defs.list()}
            {drawing}
          </>
        ),
      }
      cache.set(key, scene)
      return scene
    }
  }, [model, pal, uid])

  /* ---------------- views and the turntable */
  const [view, setView] = useState<ViewKey>('front')
  const [turning, setTurning] = useState(false)
  useEffect(() => {
    if (!turning) return
    const t = window.setInterval(() => {
      setView((v) => {
        const k = v.startsWith('turn') ? Number(v.slice(4)) + 1 : 1
        if (k >= TURN_STEPS) {
          setTurning(false)
          return 'front'
        }
        return `turn${k}`
      })
    }, motion ? STEP_MS : 700)
    return () => clearInterval(t)
  }, [turning, motion])
  useEffect(() => setView('front'), [partId])
  // Every preset and turntable step, drawn while idle, so a switch only mounts ready-made geometry.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200))
    const cancel = window.cancelIdleCallback ?? window.clearTimeout
    const keys: ViewKey[] = ['front', 'left', 'right', 'top', ...Array.from({ length: TURN_STEPS - 1 }, (_, k) => `turn${k + 1}` as ViewKey)]
    const id = idle(() => keys.forEach((k) => scenes(k)))
    return () => cancel(id)
  }, [scenes])

  const planeMap = useCallback((from: ViewKey, to: ViewKey) => multiplyAffine(groundMatrix(scenes(to).cam, 0), invertAffine(groundMatrix(scenes(from).cam, 0))), [scenes])
  const { shown, leaving, leaveRef, enterRef } = useViewMorph(view, motion, planeMap)
  const scene = scenes(shown)

  /* ---------------- hotspot selection */
  const [ownSel, setOwnSel] = useState<string | null>(null)
  const sel = activeAnchor !== undefined ? activeAnchor : ownSel
  const choose = (a: string | null) => {
    setOwnSel(a)
    onAnchor?.(a)
  }
  useEffect(() => setOwnSel(null), [partId])

  /* ---------------- camera: fit, or ease in on the selected feature */
  const fit = W && H ? frameRect(scene.content, W, H, 0.06) : { s: 1, tx: 0, ty: 0 }
  const limit = useCallback((z: Zoom) => clampZoom(z, scene.content, W, H, fit.s, fit.s * MAX_ZOOM), [scene, W, H, fit.s])
  const target = useMemo(() => {
    const a = sel ? model.anchors[sel] : null
    if (!a || !W || !H) return fit
    // Ease in about the feature: a fixed step up from the fit (closer for boards, whose features are small).
    const p = project(scene.cam, a.x, a.y, a.z)
    const s = fit.s * (model.focusZoom ?? 2.2)
    return limit({ s, tx: W / 2 - p.x * s, ty: H / 2 - p.y * s })
    // fit derives from scene, W and H.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, scene, W, H, model, limit])
  const { camRef, zoom, userZoom, setUserZoom, moving, zoomBy, handlers } = usePanZoom({
    stageRef,
    target,
    limit,
    size,
    animate: motion,
    resetKeys: [sel, shown, partId],
    wheel: 'always',
  })

  const reset = () => {
    choose(null)
    setUserZoom(null)
    setTurning(false)
    setView('front')
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && (sel || userZoom)) {
      e.preventDefault()
      choose(null)
      setUserZoom(null)
    }
  }

  const sceneDiv = (key: ViewKey, role: 'leave' | 'enter' | 'still') => (
    <div key={key} ref={role === 'leave' ? leaveRef : role === 'enter' ? enterRef : undefined} className={`iso-scene iso-${role}`} aria-hidden>
      <svg className="iso-layer" viewBox={`0 0 ${VBW} ${VBH}`}>
        {scenes(key).node}
      </svg>
    </div>
  )

  const toPx = (x: number, y: number) => ({ x: x * zoom.s + zoom.tx, y: y * zoom.s + zoom.ty })
  const anchorIds = Object.keys(model.anchors)
  const zoomedIn = zoom.s > fit.s * 1.02
  const stageClass = ['iso-stage', 'pv-stage', (moving || leaving) && 'is-moving', !motion && 'iso-still', zoomedIn && 'is-zoomed'].filter(Boolean).join(' ')
  return (
    <figure className="iso-bench pv" aria-label={ariaLabel} onKeyDown={onKeyDown} style={{ '--iso-px': `${(1 / zoom.s).toFixed(4)}px`, '--iso-aspect': '4 / 3' } as CSSProperties}>
      <div ref={stageRef} className={stageClass} {...handlers}>
        <div ref={camRef} className="iso-cam" style={{ width: VBW, height: VBH }}>
          {leaving && sceneDiv(leaving.view, 'leave')}
          {sceneDiv(shown, leaving ? 'enter' : 'still')}
        </div>
        <div className="iso-overlay pv-hotspots">
          {anchorIds.map((id) => {
            const a = model.anchors[id]
            const p = project(scene.cam, a.x, a.y, a.z)
            const q = toPx(p.x, p.y)
            const label = anchorLabels?.[id] ?? words(id)
            const on = sel === id
            // Zoomed in, hotspots that have left the stage are dropped (Reset brings them all back).
            if (!on && W && (q.x < -4 || q.y < -4 || q.x > W + 4 || q.y > H + 4)) return null
            return (
              <button
                key={id}
                type="button"
                className={`pv-hotspot${on ? ' is-on' : ''}`}
                style={{ left: q.x, top: q.y }}
                aria-label={label}
                aria-pressed={on}
                title={label}
                onClick={() => choose(on ? null : id)}
              >
                {on && <span className="pv-label">{label}</span>}
              </button>
            )
          })}
        </div>
        <div className="pv-tools" role="toolbar" aria-label="View">
          {(['front', 'left', 'right', 'top'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => {
                setTurning(false)
                setView(v)
              }}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
          <button type="button" aria-pressed={turning} onClick={() => setTurning((t) => !t)}>
            Turn
          </button>
        </div>
        <div className="pv-zoom" role="group" aria-label="Zoom">
          <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.4)}>
            +
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.4)}>
            −
          </button>
          {(sel || userZoom || view !== 'front') && (
            <button type="button" className="pv-reset" onClick={reset}>
              Reset
            </button>
          )}
        </div>
      </div>
      <figcaption className="iso-sr">{ariaLabel}</figcaption>
    </figure>
  )
}
