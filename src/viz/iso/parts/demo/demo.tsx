// Visual check for every part model: `npx vite src/viz/iso/parts/demo`, then ?part=<id>&anchor=<id>. Not part of the app bundle.
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../../../index.css'
import { PART_ANCHORS, type PartId } from '../../../../content/types'
import { PartViewer } from '../../PartViewer'

const q = new URLSearchParams(location.search)
const IDS = Object.keys(PART_ANCHORS) as PartId[]

function Thumbs() {
  return (
    <main style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 160px)', gap: 10 }}>
      {IDS.map((id) => (
        <div key={id} style={{ width: 160, height: 120, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-1)' }}>
          <PartViewer thumbnail partId={id} ariaLabel={id} />
        </div>
      ))}
    </main>
  )
}

function Small() {
  const size = Number(q.get('box'))
  return (
    <main style={{ padding: 12, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {IDS.map((id) => (
        <div key={id} style={{ width: size, height: size, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <PartViewer partId={id} ariaLabel={id} />
        </div>
      ))}
    </main>
  )
}

function Demo() {
  const [part, setPart] = useState<PartId>((q.get('part') as PartId) ?? 'arduino-uno')
  const [anchor, setAnchor] = useState<string | null>(q.get('anchor'))
  return (
    <main style={{ padding: 12, display: 'grid', gap: 10 }}>
      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {IDS.map((id) => (
          <button key={id} type="button" className="btn" aria-pressed={id === part} onClick={() => (setPart(id), setAnchor(null))} style={{ font: '12px var(--font-mono)', padding: '3px 8px', borderRadius: 999, border: '1px solid var(--border)', background: id === part ? 'var(--surface-3)' : 'transparent', color: 'var(--text)' }}>
            {id}
          </button>
        ))}
      </nav>
      <div style={{ height: 'min(70vh, 640px)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <PartViewer key={part} partId={part} activeAnchor={anchor} onAnchor={setAnchor} ariaLabel={`${part} model`} />
      </div>
      <p style={{ margin: 0, font: '12px var(--font-mono)', color: 'var(--text-muted)' }}>anchor: {anchor ?? '—'}</p>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {q.get('thumbs') ? <Thumbs /> : q.get('box') ? <Small /> : <Demo />}
  </StrictMode>,
)
