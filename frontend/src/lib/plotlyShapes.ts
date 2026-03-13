import type Plotly from 'plotly.js'

export function makeReplayCursorShape(
  currentLap: number
): Partial<Plotly.Shape> | null {
  if (currentLap <= 0) return null

  return {
    type: 'line' as const,
    x0: currentLap,
    x1: currentLap,
    y0: 0,
    y1: 1,
    yref: 'paper' as const,
    line: {
      color: 'rgba(255,255,255,0.6)',
      width: 1.5,
      dash: 'dash' as const,
    },
  }
}
