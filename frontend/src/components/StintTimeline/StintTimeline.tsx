import _Plot from 'react-plotly.js'
// react-plotly.js is CJS — Vite interop may double-wrap the default export
const Plot = (typeof (_Plot as any).default === 'function' ? (_Plot as any).default : _Plot) as typeof _Plot
import { useStintData } from './useStintData'
import { useSessionStore } from '@/stores/sessionStore'

/**
 * StintTimeline — Plotly horizontal bar chart showing tyre stints per driver.
 *
 * Features:
 * - Dark theme via plotly_dark template
 * - One horizontal bar per stint, colored by compound (red=SOFT, yellow=MEDIUM, white=HARD)
 * - Compound abbreviation (S/M/H/I/W) centered on each bar
 * - Hover tooltip with compound, lap range, stint length, tyre life
 * - Drivers ordered by current race position (P1 at top)
 * - Vertical dashed cursor line at currentLap (from replay store)
 * - Progressive reveal: only shows stints that have started by currentLap
 */
export function StintTimeline() {
  const { traces, cursorShapes, yAxisCategories } = useStintData()
  const laps = useSessionStore((s) => s.laps)

  // Derive maxLap from all laps in the store (not just visible stints)
  const maxLap = laps.length > 0
    ? Math.max(...laps.map((l) => l.LapNumber ?? 0))
    : 60

  if (traces.length === 0 || yAxisCategories.length === 0) {
    return (
      <div className="flex h-[500px] items-center justify-center">
        <p className="text-sm text-muted-foreground">No stint data available</p>
      </div>
    )
  }

  const layout: Partial<Plotly.Layout> = {
    template: 'plotly_dark' as unknown as Plotly.Template,
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    xaxis: {
      title: { text: 'Lap' },
      range: [0, maxLap + 1],
      gridcolor: '#2d2d3d',
      color: '#e0e0f0',
    },
    yaxis: {
      categoryorder: 'array' as const,
      // yAxisCategories is P1-first order; reverse for Plotly so P1 renders at top
      categoryarray: [...yAxisCategories].reverse(),
      gridcolor: '#2d2d3d',
      color: '#e0e0f0',
    },
    margin: { t: 16, r: 8, b: 40, l: 80 },
    height: 500,
    showlegend: false,
    hovermode: 'closest',
    bargap: 0.15,
    shapes: cursorShapes.filter(Boolean),
  }

  const config = { responsive: true, displayModeBar: false }

  return (
    <Plot
      data={traces}
      layout={layout}
      config={config}
      useResizeHandler={true}
      style={{ width: '100%', height: '100%' }}
      className="w-full"
    />
  )
}
