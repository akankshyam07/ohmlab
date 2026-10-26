import { useEffect, useState, type ReactNode } from 'react'
import './ui.css'

/** The Ohmlab mark: a resistor zig-zag that reads as a waveform. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="7" className="logo-mark-plate" />
      <path
        d="M4 16h5l2-5 3 10 3-10 3 10 2-5h6"
        fill="none"
        stroke="var(--brand-strong)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const ICONS = {
  learn: 'M3 12h4l2-5 3 10 3-10 2 5h4',
  topics: 'M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z',
  chip: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4M10 10h4v4h-4z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  up: 'M5 15l7-7 7 7',
  down: 'M5 9l7 7 7-7',
  close: 'M6 6l12 12M18 6L6 18',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6l1-7z',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1.5 1 2 2 2 3 1-2 1-5 1-7z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0',
  cloud: 'M7.5 18.5h9.5a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 9.6a4.5 4.5 0 0 0 .5 8.9zM12 16v-5M9.5 13.5L12 11l2.5 2.5',
  logout: 'M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9',
} as const

export type IconName = keyof typeof ICONS

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  )
}

/** Circular gauge for a 0..1 value. Announced as "<label> N %". */
export function ProgressRing({
  value,
  size = 56,
  label = 'Mastery',
  children,
}: {
  value: number
  size?: number
  label?: string
  children?: ReactNode
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  // Drawn from 0 on mount, then to each new value: the stroke transition animates the fill (instant under reduced motion).
  const [drawn, setDrawn] = useState(0)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(pct))
    return () => cancelAnimationFrame(frame)
  }, [pct])
  const r = 15.5
  const circumference = 2 * Math.PI * r
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${label} ${pct} %`}>
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle className="ring-track" cx="18" cy="18" r={r} />
        <circle
          className="ring-value"
          data-complete={pct === 100 || undefined}
          cx="18"
          cy="18"
          r={r}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - drawn / 100)}
        />
      </svg>
      <span className="ring-label" aria-hidden="true">
        {children ?? `${pct}%`}
      </span>
    </div>
  )
}
