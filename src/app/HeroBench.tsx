import { useMemo, useState, type CSSProperties } from 'react'
import { solveDC } from '../sim/solver'
import type { Circuit } from '../sim/types'
import { formatSI } from '../ui/format'
import { useSettings } from './settings'

// ponytail: 0.1 Ω stands in for "a bare wire" so the solver sees a real (tiny) resistance.
const RESISTORS = [
  { ohms: 0.1, label: 'None' },
  { ohms: 220, label: formatSI(220, 'Ω') },
  { ohms: 1000, label: formatSI(1000, 'Ω') },
  { ohms: 10000, label: formatSI(10000, 'Ω') },
]

function benchCircuit(ohms: number): Circuit {
  return {
    ground: 'gnd',
    components: [
      { kind: 'vsource', id: 'B1', pos: 'vcc', neg: 'gnd', volts: 5 },
      { kind: 'resistor', id: 'R1', a: 'vcc', b: 'mid', ohms },
      { kind: 'led', id: 'D1', anode: 'mid', cathode: 'gnd', color: 'red' },
    ],
  }
}

/** A tiny live circuit on the home page. Every number shown comes from solveDC. */
export function HeroBench() {
  const { animateFlow } = useSettings()
  const [ohms, setOhms] = useState(220)
  const result = useMemo(() => solveDC(benchCircuit(ohms)), [ohms])
  const led = result.components.D1
  const resistor = result.components.R1
  const current = led?.current ?? 0
  const brightness = led?.status === 'burnt' ? 0 : (led?.brightness ?? 0)
  const mA = Math.abs(current) * 1000
  // Faster dots for more current; ~1.6 s per cycle at 15 mA.
  const flowStyle = { '--flow-dur': `${Math.min(6, Math.max(0.25, 24 / Math.max(mA, 0.5)))}s` } as CSSProperties
  const status = led?.status

  return (
    <div className="bench panel" aria-label="Try it: a live LED circuit" role="group">
      <div className="bench-head">
        <span className="eyebrow">
          <span className="live-dot" aria-hidden="true" /> live circuit
        </span>
        <span className="chip">5 V · red LED</span>
      </div>

      <svg className="bench-svg" viewBox="0 0 360 220" aria-hidden="true" data-burnt={status === 'burnt' || undefined}>
        <defs>
          <radialGradient id="bench-glow">
            <stop offset="0" style={{ stopColor: 'var(--danger)', stopOpacity: 0.95 }} />
            <stop offset="1" style={{ stopColor: 'var(--danger)', stopOpacity: 0 }} />
          </radialGradient>
        </defs>
        <g className="bench-wire">
          <path d="M60 100V40h70M210 40h90v45M300 135v45H60v-66" />
        </g>
        {animateFlow && mA > 0.05 && (
          <g className="bench-flow" style={flowStyle}>
            <path d="M60 100V40h70" />
            <path d="M210 40h90v45" />
            <path d="M300 135v45H60v-66" />
          </g>
        )}
        <g className="bench-part">
          <path d="M42 100h36M50 114h20" className="bench-battery" />
          <path d="M130 40l5-10 10 20 10-20 10 20 10-20 10 20 10-20 10 20 5-10" className="bench-resistor" />
          <circle cx="300" cy="109" r={18 + brightness * 34} fill="url(#bench-glow)" opacity={brightness} />
          <path d="M300 85v13M300 120v15M286 120h28" />
          <path d="M286 98h28l-14 22z" className="bench-led" style={{ fillOpacity: 0.15 + brightness * 0.85 }} />
          <path d="M318 96l8-8M322 104l8-8" className="bench-rays" opacity={brightness} />
        </g>
        <text x="86" y="96" className="bench-label">+</text>
        <text x="20" y="150" className="bench-label">5 V</text>
        <text x="170" y="74" className="bench-label" textAnchor="middle">
          {ohms < 1 ? 'just wire' : formatSI(ohms, 'Ω')}
        </text>
        <text x="236" y="114" className="bench-label">LED</text>
      </svg>

      <dl className="bench-readouts">
        <div data-sig="current">
          <dt>Current</dt>
          <dd>{formatSI(Math.abs(current), 'A')}</dd>
        </div>
        <div data-sig="voltage">
          <dt>LED voltage</dt>
          <dd>{formatSI(led?.voltage ?? 0, 'V')}</dd>
        </div>
        <div data-sig="power">
          <dt>Resistor power</dt>
          <dd>{formatSI(resistor?.power ?? 0, 'W')}</dd>
        </div>
      </dl>

      <fieldset className="bench-control">
        <legend>Resistor</legend>
        <div className="segmented">
          {RESISTORS.map((r) => (
            <label key={r.ohms}>
              <input
                type="radio"
                name="bench-ohms"
                value={r.ohms}
                checked={ohms === r.ohms}
                onChange={() => setOhms(r.ohms)}
              />
              <span>{r.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="bench-verdict" role="status" data-status={status}>
        {status === 'burnt'
          ? 'Pop! With no resistor the current runs away and the LED burns out. That is lesson one.'
          : status === 'overcurrent'
            ? 'Too much current: the LED is overloaded and will not last long.'
            : brightness < 0.15
            ? 'Barely glowing: a big resistor lets only a trickle of current through.'
            : 'Glowing nicely. Swap the resistor and watch the current change.'}
      </p>
    </div>
  )
}
