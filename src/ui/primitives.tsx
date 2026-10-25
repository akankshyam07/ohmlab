import { useId, type ReactNode } from 'react'
import './ui.css'

/** The Ohmlab mark: a resistor zig-zag that reads as a waveform. */
export function LogoMark({ size = 32 }: { size?: number }) {
  const id = useId()
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: 'var(--sig-current)' }} />
          <stop offset="1" style={{ stopColor: 'var(--brand)' }} />
        </linearGradient>
      </defs>
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="8" className="logo-mark-plate" />
      <path
        d="M4 16h5l2-5 3 10 3-10 3 10 2-5h6"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const ICONS = {
  learn: 'M3 12h4l2-5 3 10 3-10 2 5h4',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  close: 'M6 6l12 12M18 6L6 18',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6l1-7z',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1.5 1 2 2 2 3 1-2 1-5 1-7z',
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
          strokeDashoffset={circumference * (1 - pct / 100)}
        />
      </svg>
      <span className="ring-label" aria-hidden="true">
        {children ?? `${pct}%`}
      </span>
    </div>
  )
}
