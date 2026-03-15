import { useState } from 'react'
import _Plot from 'react-plotly.js'
// react-plotly.js is CJS — Vite interop may double-wrap the default export
const Plot = (typeof (_Plot as any).default === 'function' ? (_Plot as any).default : _Plot) as typeof _Plot
import { useLapTimeData } from './useLapTimeData'

interface LapTimeChartProps {
  visibleDrivers: Set<string>
}

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-white/30' : 'bg-white/10'
        }`}
      >
        <span
          className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </button>
      {label}
    </label>
  )
}

/**
 * LapTimeChart — Plotly scatter chart showing lap times per driver.
 *
 * Features:
 * - Toggle to exclude SC/VSC laps from y-axis scaling
 * - Per-stint linear trend lines with slope annotations (ms/lap degradation)
 * - Standard deviation bands around trend lines showing consistency
 * - Outlier laps (lap 1, pit laps, SC laps) rendered at 30% opacity
 * - SC/VSC/RED period shading + replay cursor
 */
export function LapTimeChart({ visibleDrivers }: LapTimeChartProps) {
  const [excludeSCFromScale, setExcludeSCFromScale] = useState(true)
  const { scatterTraces, trendTraces, stdDevTraces, slopeAnnotations, scShapes, pitStopShapes, cursorShapes, cleanYRange } =
    useLapTimeData(visibleDrivers)

  const yaxis: Partial<Plotly.LayoutAxis> = {
    title: { text: 'Lap Time (s)' },
    gridcolor: '#2d2d3d',
    color: '#e0e0f0',
  }

  if (excludeSCFromScale && cleanYRange) {
    const padding = (cleanYRange.max - cleanYRange.min) * 0.1
    yaxis.range = [cleanYRange.min - padding, cleanYRange.max + padding]
  }

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
    yaxis,
    shapes: [...scShapes, ...pitStopShapes, ...cursorShapes].filter(Boolean),
    annotations: slopeAnnotations as Plotly.Annotations[],
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
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Lap Times</h3>
        <ToggleSwitch
          checked={excludeSCFromScale}
          onChange={setExcludeSCFromScale}
          label="Exclude SC/VSC from scale"
        />
      </div>
      <Plot
        data={[...stdDevTraces, ...scatterTraces, ...trendTraces]}
        layout={layout}
        config={config}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
        className="w-full"
      />
    </div>
  )
}
