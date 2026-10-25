// Visual check for CircuitView: `npx vite src/viz/demo --port 5199`. Not part of the app bundle.
import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { solveDC } from '../../sim/solver'
import type { Circuit } from '../../sim/types'
import { CircuitView } from '../CircuitView'
import type { CircuitLayout } from '../types'

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

const click = (id: string) => console.log('clicked', id)

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ fontSize: 'var(--fs-lg)', color: 'var(--text-muted)' }}>{title}</h2>
      {children}
    </section>
  )
}

function Demo() {
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
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
)
