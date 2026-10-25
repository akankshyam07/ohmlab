// Concept page for approving the isometric bench. Build: see the report; not part of the app bundle.
import { StrictMode, useMemo, useState, type CSSProperties } from 'react'
import { createRoot } from 'react-dom/client'
import '../../../index.css'
import day01 from '../../../content/lessons/day01'
import day08 from '../../../content/lessons/day08'
import { solveDC } from '../../../sim/solver'
import type { Circuit, LedColor } from '../../../sim/types'
import { formatSI } from '../../../ui/format'
import { resistorBands } from '../../BreadboardView'
import { LED_COLORS } from '../../describe'
import type { BreadboardLayout } from '../../types'
import { IsoBench, type IsoCallout, type IsoViewName } from '../IsoBench'
import './concept.css'

const RESISTORS = [
  { ohms: 220, label: '220 Ω' },
  { ohms: 1000, label: '1 kΩ' },
  { ohms: 10000, label: '10 kΩ' },
  { ohms: 0, label: 'None' },
]
const COLOURS: LedColor[] = ['red', 'yellow', 'green', 'blue', 'white']
const VIEWS: { id: IsoViewName; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'top', label: 'Top' },
]

const board1 = day01.realBuild!.breadboard!
const lab1 = day01.lab!.circuit
const board8 = day08.realBuild!.breadboard!
const circuit8 = day08.lab!.circuit
const result8 = solveDC(circuit8)
const CALLOUTS8: IsoCallout[] = [
  { at: 'S1', title: 'Jumper S1', text: 'Skips D2, so D2 stays dark.' },
  { at: 'D3', title: 'D3 · 1N4007', text: 'Silver band marks the cathode.' },
  { at: 'S2', title: 'Jumper S2', text: 'Bypasses D3.' },
]

function build(ohms: number, color: LedColor, flipped: boolean): { layout: BreadboardLayout; circuit: Circuit } {
  const layout: BreadboardLayout = {
    ...board1,
    parts: board1.parts.map((p) => {
      if (p.id === 'R1' && p.kind === 'resistor') return { ...p, ohms }
      if (p.id === 'D1' && p.kind === 'led') return { ...p, color, ...(flipped ? { anode: p.cathode, cathode: p.anode } : {}) }
      return p
    }),
  }
  const circuit: Circuit = {
    ...lab1,
    components: lab1.components.map((c) => {
      if (c.id === 'R1' && c.kind === 'resistor') return { ...c, ohms }
      if (c.id === 'D1' && c.kind === 'led') return { ...c, color, ...(flipped ? { anode: c.cathode, cathode: c.anode } : {}) }
      return c
    }),
  }
  return { layout, circuit }
}

const bandWords = (ohms: number) => resistorBands(ohms).join(' · ')

function Meter({ label, value, tone, note }: { label: string; value: string; tone: 'current' | 'voltage' | 'power'; note?: string }) {
  return (
    <div className={`meter is-${tone}`}>
      <span className="meter-label">{label}</span>
      <span className="meter-value">{value}</span>
      {note && <span className="meter-note">{note}</span>}
    </div>
  )
}

function Concept() {
  const [ohms, setOhms] = useState(220)
  const [color, setColor] = useState<LedColor>('red')
  const [flipped, setFlipped] = useState(false)
  const [view, setView] = useState<IsoViewName>('front')
  const [animate, setAnimate] = useState(true)
  const { layout, circuit } = useMemo(() => build(ohms, color, flipped), [ohms, color, flipped])
  const result = useMemo(() => solveDC(circuit), [circuit])
  const led = result.components.D1
  const r1 = result.components.R1

  const ledState =
    led?.status === 'burnt'
      ? { text: 'Burnt out', tone: 'danger' }
      : led?.status === 'overcurrent'
        ? { text: 'Over 20 mA', tone: 'warn' }
        : (led?.voltage ?? 0) < -0.1
          ? { text: 'Blocking (backwards)', tone: 'info' }
          : (led?.brightness ?? 0) > 0.01
            ? { text: (led?.brightness ?? 0) > 0.35 ? 'Lit, bright' : 'Lit, faint', tone: 'ok' }
            : { text: 'Off', tone: 'muted' }

  const callouts: IsoCallout[] = useMemo(
    () => [
      { at: 'uno:usb', title: 'USB port', text: 'Power from your computer. The Uno is just a 5 V supply today.' },
      { at: 'uno:5V', title: '5V pin', text: 'The + side of the supply. Red jumper to the + rail.' },
      { at: 'T-22', title: 'Power rails', text: 'Each rail is one strip along the whole board.' },
      { at: 'R1', title: ohms ? `R1 · ${formatSI(ohms, 'Ω')}` : 'R1 · 0 Ω link', text: ohms ? `Bands: ${bandWords(ohms)}` : 'Nothing limits the current.' },
      { at: 'D1.anode', title: 'Anode +', text: 'Long leg, with the kink.' },
      { at: 'D1.cathode', title: 'Cathode −', text: 'Short leg, flat side of the rim.' },
    ],
    [ohms],
  )

  const onPartClick = (id: string) => {
    if (id === 'D1') setFlipped((f) => !f)
    if (id === 'R1') {
      const safe = RESISTORS.filter((r) => r.ohms > 0)
      const i = safe.findIndex((r) => r.ohms === ohms)
      setOhms(safe[(i + 1) % safe.length].ohms)
    }
  }

  return (
    <main className="concept">
      <header className="concept-head">
        <p className="eyebrow">Ohmlab · concept for approval</p>
        <h1>The bench, illustrated.</h1>
        <p className="lede">You’re approving one look for every lesson’s real build: inked isometric parts in the night-lab palette, lit and animated live by the lab’s solver.</p>
      </header>

      <section className="hero" aria-label="Day 1 bench">
        <div className="panel bench-panel">
          <div className="panel-bar">
            <div>
              <span className="tag">Day 1</span>
              <span className="panel-title">Your first LED</span>
            </div>
            <div className="seg" role="group" aria-label="Camera">
              {VIEWS.map((v) => (
                <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => setView(v.id)}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <IsoBench
            layout={layout}
            circuit={circuit}
            result={result}
            view={view}
            animate={animate}
            onPartClick={onPartClick}
            callouts={callouts}
            aspect={1.7}
            padding={0.06}
            caption="Uno 5V → + rail → R1 → LED D1 → − rail → GND. Click R1 to step its value, click D1 to flip it."
          />
        </div>

        <aside className="panel controls" aria-label="Try it">
          <h2>Try it</h2>
          <div className="field">
            <span className="field-label">Resistor R1</span>
            <div className="seg seg-wide" role="group" aria-label="Resistor R1">
              {RESISTORS.map((r) => (
                <button key={r.ohms} type="button" aria-pressed={ohms === r.ohms} onClick={() => setOhms(r.ohms)} className={r.ohms === 0 ? 'is-danger' : undefined}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">LED D1</span>
            <div className="row">
              <button type="button" className="btn" aria-pressed={flipped} onClick={() => setFlipped((f) => !f)}>
                ⇄ Flip the LED
              </button>
              <div className="swatches" role="group" aria-label="LED colour">
                {COLOURS.map((c) => (
                  <button key={c} type="button" aria-pressed={color === c} aria-label={c} title={c} style={{ '--sw': LED_COLORS[c] } as CSSProperties} onClick={() => setColor(c)} />
                ))}
              </div>
            </div>
          </div>

          <div className="meters">
            <Meter label="Current through the loop" value={formatSI(Math.abs(led?.current ?? 0), 'A')} tone="current" />
            <Meter label="Voltage across the LED" value={formatSI(led?.voltage ?? 0, 'V')} tone="voltage" />
            <Meter label="Voltage across R1" value={formatSI(r1?.voltage ?? 0, 'V')} tone="voltage" />
            <Meter label="Power in R1" value={formatSI(Math.abs(r1?.power ?? 0), 'W')} tone="power" />
          </div>
          <p className={`state is-${ledState.tone}`}>
            <span className="dot" aria-hidden /> LED: {ledState.text}
          </p>
          <label className="switch">
            <input type="checkbox" checked={animate} onChange={(e) => setAnimate(e.target.checked)} />
            <span>Animate current flow</span>
          </label>
        </aside>
      </section>

      <section className="dense">
        <div className="dense-copy">
          <span className="tag">Day 8</span>
          <h2>Dense layouts, same renderer</h2>
          <p>Two LEDs in series, a 1N4007 diode and two bypass jumpers, drawn from the lesson’s layout data with no per-lesson art. Jumper S1 skips D2, so only D1 lights; current pulses take the jumpers.</p>
          <ul className="checks">
            <li>Every part at real size, legs in real holes</li>
            <li>Polarity visible: kinked anode, flat rim, diode band</li>
            <li>Respects reduced motion and the flow setting</li>
          </ul>
        </div>
        <div className="panel dense-panel">
          <IsoBench layout={board8} circuit={circuit8} result={result8} animate={animate} aspect={1.6} padding={0.06} callouts={CALLOUTS8} caption="Day 8: 220 Ω, D1 and D2 in series, S1 across D2, D3 bypassed by S2." />
        </div>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Concept />
  </StrictMode>,
)
