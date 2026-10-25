// Visual check for CircuitView and BreadboardView: `npx vite src/viz/demo --port 5199`. Not part of the app bundle.
import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { lessons } from '../../content'
import { solveDC } from '../../sim/solver'
import type { Circuit } from '../../sim/types'
import { BreadboardView, layoutProblems } from '../BreadboardView'
import { CircuitView } from '../CircuitView'
import type { BreadboardLayout, CircuitLayout } from '../types'

const ledCircuit = (ohms: number, volts: number): Circuit => ({
  ground: 'gnd',
  components: [
    { kind: 'vsource', id: 'B1', pos: 'vcc', neg: 'gnd', volts },
    { kind: 'resistor', id: 'R1', a: 'vcc', b: 'mid', ohms },
    { kind: 'led', id: 'D1', anode: 'mid', cathode: 'gnd', color: 'red' },
  ],
})

const ledLayout: CircuitLayout = {
  width: 7,
  height: 5,
  parts: [
    { id: 'B1', from: { x: 0, y: 1 }, to: { x: 0, y: 4 } },
    { id: 'R1', from: { x: 2, y: 0 }, to: { x: 5, y: 0 } },
    { id: 'D1', from: { x: 7, y: 1 }, to: { x: 7, y: 4 } },
  ],
  wires: [
    { id: 'w1', points: [{ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 2, y: 0 }], carries: { componentId: 'B1', sign: 1 } },
    { id: 'w2', points: [{ x: 5, y: 0 }, { x: 7, y: 0 }, { x: 7, y: 1 }], carries: { componentId: 'R1', sign: 1 } },
    { id: 'w3', points: [{ x: 7, y: 4 }, { x: 7, y: 5 }, { x: 0, y: 5 }, { x: 0, y: 4 }], carries: { componentId: 'D1', sign: 1 } },
  ],
  probes: [{ node: 'mid', at: { x: 6, y: 0 }, label: 'A' }],
}



const divider = (closed: boolean, r1: number): Circuit => ({
  ground: 'gnd',
  components: [
    { kind: 'vsource', id: 'B1', pos: 'vcc', neg: 'gnd', volts: 9 },
    { kind: 'switch', id: 'S1', a: 'vcc', b: 'top', closed },
    { kind: 'resistor', id: 'R1', a: 'top', b: 'out', ohms: r1, ratedWatts: 1.5 },
    { kind: 'resistor', id: 'R2', a: 'out', b: 'gnd', ohms: 10, ratedWatts: 5 },
  ],
})

const dividerLayout: CircuitLayout = {
  width: 8,
  height: 8,
  parts: [
    { id: 'B1', from: { x: 0, y: 3 }, to: { x: 0, y: 6 } },
    { id: 'S1', from: { x: 2, y: 0 }, to: { x: 5, y: 0 } },
    { id: 'R1', from: { x: 7, y: 1 }, to: { x: 7, y: 4 } },
    { id: 'R2', from: { x: 7, y: 4 }, to: { x: 7, y: 7 } },
  ],
  wires: [
    { id: 'w1', points: [{ x: 0, y: 3 }, { x: 0, y: 0 }, { x: 2, y: 0 }], carries: { componentId: 'B1', sign: 1 } },
    { id: 'w2', points: [{ x: 5, y: 0 }, { x: 7, y: 0 }, { x: 7, y: 1 }], carries: { componentId: 'S1', sign: 1 } },
    { id: 'w3', points: [{ x: 7, y: 4 }, { x: 8, y: 4 }] },
    { id: 'w4', points: [{ x: 7, y: 7 }, { x: 7, y: 8 }, { x: 0, y: 8 }, { x: 0, y: 6 }], carries: { componentId: 'R2', sign: 1 } },
  ],
  probes: [
    { node: 'vcc', at: { x: 0, y: 0 }, label: 'V+' },
    { node: 'out', at: { x: 8, y: 4 }, label: 'Vout' },
  ],
}



const c1 = ledCircuit(220, 5)
const c2 = ledCircuit(0, 9)
const c3 = divider(false, 10_000)
const c4 = divider(true, 10)
const c5: Circuit = {
  ground: 'gnd',
  components: [
    { kind: 'vsource', id: 'V1', pos: 'vcc', neg: 'gnd', volts: 9 },
    { kind: 'resistor', id: 'R1', a: 'vcc', b: 'mid', ohms: 220 },
    { kind: 'led', id: 'D1', anode: 'gnd', cathode: 'mid', color: 'red' },
  ],
}
const c6 = ledCircuit(330, 9)

// Same shape as the Day 1 lesson layout: empty grid columns on the left, value repeated in the label.
const lessonLayout: CircuitLayout = {
  width: 13,
  height: 8,
  parts: [
    { id: 'V1', from: { x: 2, y: 3 }, to: { x: 2, y: 6 }, label: '9 V supply', labelSide: 'left' },
    { id: 'R1', from: { x: 5, y: 1 }, to: { x: 8, y: 1 }, label: 'R1', labelSide: 'above' },
    { id: 'D1', from: { x: 11, y: 6 }, to: { x: 11, y: 3 }, label: 'D1', labelSide: 'right' },
  ],
  wires: [
    { id: 'w1', points: [{ x: 2, y: 3 }, { x: 2, y: 1 }, { x: 5, y: 1 }], carries: { componentId: 'V1', sign: 1 } },
    { id: 'w2', points: [{ x: 8, y: 1 }, { x: 11, y: 1 }, { x: 11, y: 3 }], carries: { componentId: 'R1', sign: 1 } },
    { id: 'w3', points: [{ x: 11, y: 6 }, { x: 11, y: 7 }, { x: 2, y: 7 }, { x: 2, y: 6 }] },
  ],
  probes: [{ node: 'mid', at: { x: 11, y: 2 }, label: 'LED +' }],
}

const unoLed: BreadboardLayout = {
  supply: 'uno',
  parts: [
    { kind: 'wire', id: 'W1', from: 'uno:5V', to: 'T+1', color: 'red' },
    { kind: 'wire', id: 'W2', from: 'uno:GND', to: 'T-2', color: 'black' },
    { kind: 'wire', id: 'W3', from: 'T+6', to: 'a6', color: 'red' },
    { kind: 'resistor', id: 'R1', from: 'b6', to: 'b10', ohms: 220 },
    { kind: 'led', id: 'D1', anode: 'e10', cathode: 'e11', color: 'red' },
    { kind: 'wire', id: 'W4', from: 'a11', to: 'T-11', color: 'black' },
  ],
}

const batteryLed: BreadboardLayout = {
  supply: 'battery9v',
  parts: [
    { kind: 'wire', id: 'W1', from: 'bat:+', to: 'T+1', color: 'red' },
    { kind: 'wire', id: 'W2', from: 'bat:-', to: 'T-2', color: 'black' },
    { kind: 'wire', id: 'W3', from: 'T+6', to: 'a6', color: 'red' },
    { kind: 'resistor', id: 'R1', from: 'b6', to: 'b10', ohms: 470 },
    { kind: 'diode', id: 'D2', anode: 'c10', cathode: 'c14' },
    { kind: 'led', id: 'D1', anode: 'e14', cathode: 'e15', color: 'green' },
    { kind: 'wire', id: 'W4', from: 'a15', to: 'T-15', color: 'black' },
    { kind: 'wire', id: 'W5', from: 'j20', to: 'B-20', color: 'blue' },
    { kind: 'resistor', id: 'R2', from: 'g20', to: 'g26', ohms: 4700 },
    { kind: 'wire', id: 'W6', from: 'f26', to: 'e26', color: 'yellow' },
  ],
}

const click = (id: string) => console.log('clicked', id)

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ fontSize: 'var(--fs-lg)', color: 'var(--text-muted)' }}>{title}</h2>
      {children}
    </section>
  )
}

/** `?content`: every lesson's build breadboard, to eyeball the real layouts. */
function ContentBoards() {
  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: 'var(--sp-5) var(--sp-4)', display: 'grid', gap: 'var(--sp-6)', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 520px), 1fr))' }}>
      <style>{'.lab-probe { display: grid } .lab-probe .cv, .lab-probe .cv-svg { height: 100% }'}</style>
      {lessons.map((l) => {
        const layout = l.realBuild?.breadboard
        if (!layout) return null
        const problems = layoutProblems(layout)
        return (
          <Card key={l.id} title={`Day ${l.day} · ${problems.length ? problems.join('; ') : 'ok'}`}>
            <BreadboardView layout={layout} ariaLabel={`Day ${l.day} build`} />
            {l.lab && (
              <div className="lab-probe" style={{ height: 230 }}>
                <CircuitView circuit={l.lab.circuit} layout={l.lab.layout} result={solveDC(l.lab.circuit)} ariaLabel={`Day ${l.day} lab`} />
              </div>
            )}
          </Card>
        )
      })}
    </main>
  )
}

function Demo() {
  if (new URLSearchParams(location.search).has('content')) return <ContentBoards />
  return (
    <main
      style={{
        maxWidth: 1180,
        margin: '0 auto',
        padding: 'var(--sp-5) var(--sp-4)',
        display: 'grid',
        gap: 'var(--sp-6)',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))',
      }}
    >
      <Card title="Breadboard · Uno 5 V, 220 Ω, red LED (R1 highlighted)">
        <BreadboardView layout={unoLed} ariaLabel="Breadboard: Uno 5 V through 220 Ω to a red LED" highlight={['R1']} />
      </Card>
      <Card title="Breadboard · 9 V battery, 470 Ω, diode, green LED">
        <BreadboardView layout={batteryLed} ariaLabel="Breadboard: 9 V battery, resistor, diode and green LED" />
      </Card>
      <Card title="1 · 5 V, 220 Ω, red LED">
        <CircuitView circuit={c1} layout={ledLayout} result={solveDC(c1)} ariaLabel="Battery, resistor and red LED in series" onPartClick={click} />
      </Card>
      <Card title="2 · No resistor: LED burnt">
        <CircuitView circuit={c2} layout={ledLayout} result={solveDC(c2)} ariaLabel="Battery and LED with no resistor" onPartClick={click} />
      </Card>
      <Card title="3 · Divider, switch open (S1 highlighted)">
        <CircuitView circuit={c3} layout={dividerLayout} result={solveDC(c3)} ariaLabel="Voltage divider with open switch" onPartClick={click} highlight={['S1']} />
      </Card>
      <Card title="4 · Divider, switch closed, R1 overheating (no flow animation)">
        <CircuitView circuit={c4} layout={dividerLayout} result={solveDC(c4)} ariaLabel="Voltage divider, R1 overheating" showFlow={false} />
      </Card>
      <Card title="5 · D1 flipped on 9 V: reverse voltage too high">
        <CircuitView circuit={c5} layout={lessonLayout} result={solveDC(c5)} ariaLabel="Reversed LED on 9 V" onPartClick={click} />
      </Card>
      <Card title="6 · 9 V, 330 Ω: R1 warm">
        <CircuitView circuit={c6} layout={ledLayout} result={solveDC(c6)} ariaLabel="LED on 9 V through 330 ohms" onPartClick={click} />
      </Card>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
)
