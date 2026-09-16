export function percentChange(from: number, to: number): number {
  if (from === 0) return 0
  return ((to - from) / from) * 100
}

export function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
