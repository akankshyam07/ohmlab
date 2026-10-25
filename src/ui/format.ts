const PREFIXES: [number, string][] = [
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
]

/** formatSI(0.01364, 'A') → "13.6 mA"; formatSI(1000, 'Ω') → "1 kΩ". Three significant figures. */
export function formatSI(value: number, unit: string): string {
  if (!Number.isFinite(value)) return `∞ ${unit}`
  const magnitude = Math.abs(value)
  if (magnitude < 1e-12) return `0 ${unit}`
  const [scale, prefix] = PREFIXES.find(([s]) => magnitude >= s) ?? PREFIXES[PREFIXES.length - 1]
  const scaled = Number((value / scale).toPrecision(3))
  return `${scaled} ${prefix}${unit}`
}
