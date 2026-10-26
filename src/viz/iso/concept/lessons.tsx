// Visual check: every lesson's breadboard on the iso bench, in a parent-sized box.
// `npx vite src/viz/iso/concept` then /lessons.html?l=<index>&w=640&h=560[&focus=R1,D1]. Not part of the app bundle.
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../../index.css'
import { lessons } from '../../../content'
import type { ControlValue } from '../../../content/types'
import { solveDC } from '../../../sim/solver'
import type { Circuit } from '../../../sim/types'
import { IsoBench } from '../IsoBench'

/** Lab settings each drawing builds (as in content/lessons.test.ts). */
const BUILD: Record<string, Record<string, ControlValue>> = {
  'series-parallel': { s1: true },
  'voltage-divider': { load: true },
  'esp32-intro': { r1: 220 },
  'level-shifting': { r1: 5100, r3: 220, r2: 10000 },
  'esp32-wifi-led': { gpio: 3.3 },
}

const q = new URLSearchParams(location.search)
const lesson = lessons[Number(q.get('l') ?? 0)]
const lab = lesson.lab!
const circuit: Circuit = {
  ...lab.circuit,
  components: lab.circuit.components.map((c) => {
    const set = Object.entries(BUILD[lesson.id] ?? {}).find(([id]) => {
      const control = lab.controls.find((k) => k.id === id)
      return control && 'componentId' in control && control.componentId === c.id
    })
    if (!set) return c
    const control = lab.controls.find((k) => k.id === set[0])!
    return 'prop' in control ? ({ ...c, [control.prop]: set[1] } as typeof c) : c
  }),
}
const parts = lesson.realBuild!.breadboard!.parts.filter((p) => p.kind !== 'wire').map((p) => p.id)
// ?cycle=1 steps the focus every 900 ms (one part, all parts, none), for measuring the camera tween.
const STEPS = [parts.slice(0, 1), parts, []]
const result = solveDC(circuit)

function Harness() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (!q.get('cycle')) return
    const t = setInterval(() => setStep((s) => s + 1), 900)
    return () => clearInterval(t)
  }, [])
  const focus = q.get('cycle') ? STEPS[step % 3] : q.get('focus')?.split(',').filter(Boolean)
  return (
    <div style={{ width: `${q.get('w') ?? 640}px`, height: `${q.get('h') ?? 560}px`, margin: q.get('w') === '375' ? 0 : 16, border: '1px solid var(--border)' }}>
      <IsoBench layout={lesson.realBuild!.breadboard!} circuit={circuit} result={result} focus={focus} ariaLabel={`Breadboard wiring for ${lesson.title}`} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
