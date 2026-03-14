import _Plot from 'react-plotly.js'
// react-plotly.js is CJS — Vite interop may double-wrap the default export
const Plot = (typeof (_Plot as any).default === 'function' ? (_Plot as any).default : _Plot) as typeof _Plot
import { useLapTimeData } from './useLapTimeData'

interface LapTimeChartProps {
  visibleDrivers: Set<string>
}

/**
 * LapTimeChart — Plotly scatter chart showing lap times per driver.
 *
 * Features:
 * - Dark theme via plotly_dark template
 * - One scatter trace per visible driver (WebGL scattergl)
 * - Outlier laps (lap 1, pit laps, SC laps) rendered at 30% opacity
 * - Per-stint linear trend lines from clean laps only
 * - SC/VSC/RED period shading
 * - Vertical dashed cursor line at currentLap (from replay store)
 * - Progressive reveal: only shows laps up to currentLap
 */
export function LapTimeChart({ visibleDrivers }: LapTimeChartProps) {
  const { scatterTraces, trendTraces, scShapes, cursorShapes } = useLapTimeData(visibleDrivers)

  const layout: Partial<Plotly.Layout> = {
    template: 'plotly_dark' as unknown as Plotly.Template,
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    height: 400,
    xaxis: {
      title: { text: 'Lap' },
      gridcolor: '#2d2d3d',
      color: '#e0e0f0',
    },
    yaxis: {
      title: { text: 'Lap Time (s)' },
      gridcolor: '#2d2d3d',
      color: '#e0e0f0',
    },
    shapes: [...scShapes, ...cursorShapes].filter(Boolean),
    showlegend: false,
    hovermode: 'closest',
    margin: { t: 16, r: 8, b: 40, l: 56 },
  }

  const config = { responsive: true, displayModeBar: false }

  if (scatterTraces.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <p className="text-sm text-muted-foreground">No lap time data available</p>
      </div>
    )
  }

  return (
    <Plot
      data={[...scatterTraces, ...trendTraces]}
      layout={layout}
      config={config}
      useResizeHandler={true}
      style={{ width: '100%', height: '100%' }}
      className="w-full"
    />
  )
}
