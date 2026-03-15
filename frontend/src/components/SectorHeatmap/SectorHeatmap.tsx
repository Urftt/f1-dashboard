import { useState } from 'react'
import _Plot from 'react-plotly.js'
// react-plotly.js is CJS — Vite interop may double-wrap the default export
const Plot = (typeof (_Plot as any).default === 'function' ? (_Plot as any).default : _Plot) as typeof _Plot
import { useSectorData } from './useSectorData'

interface SectorHeatmapProps {
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

const SECTOR_COLORSCALE: [number, string][] = [
  [0.0, '#9933ff'],   // -1.0 mapped: session best (purple)
  [0.20, '#9933ff'],  // still purple zone
  [0.25, '#00cc44'],  // -0.5 mapped: personal best (green)
  [0.30, '#00cc44'],  // still green zone
  [0.50, '#00cc44'],  // 0.0 normalized: personal best (green)
  [0.65, '#cccc00'],  // ~0.3 normalized: yellow
  [0.80, '#ff8800'],  // ~0.6 normalized: orange
  [1.0, '#cc0000'],   // 1.0 normalized: red (worst)
]

const CELL_WIDTH = 10

/**
 * SectorHeatmap — Plotly heatmap showing per-driver per-sector times across laps.
 *
 * Features:
 * - Purple for session best, green for personal best, gradient for relative pace
 * - Missing data renders as dark empty cells (null in z-array)
 * - Horizontal scroll for wide grids (60+ laps)
 * - Current lap highlighted with white border rectangle
 * - Loading spinner while sector data fetches
 * - Driver rows ordered by race position at currentLap
 * - Toggle to exclude SC/VSC laps from color normalization
 */
export function SectorHeatmap({ visibleDrivers }: SectorHeatmapProps) {
  const [excludeSC, setExcludeSC] = useState(true)
  const { loading, error, heatmapResult, cursorShapes } = useSectorData(visibleDrivers, excludeSC)

  if (loading) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <p className="text-sm text-muted-foreground animate-pulse">Loading sector data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <p className="text-sm text-muted-foreground">Error loading sector data: {error}</p>
      </div>
    )
  }

  if (!heatmapResult || heatmapResult.z.length === 0 || heatmapResult.maxLap === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <p className="text-sm text-muted-foreground">No sector data available</p>
      </div>
    )
  }

  const chartWidth = Math.max(heatmapResult.maxLap * 3 * CELL_WIDTH + 100, 400)
  const chartHeight = Math.max(heatmapResult.driverOrder.length * 26 + 60, 200)

  const data: Partial<Plotly.PlotData>[] = [
    {
      type: 'heatmap' as const,
      z: heatmapResult.z,
      x: heatmapResult.x,
      y: heatmapResult.y,
      customdata: heatmapResult.customdata,
      colorscale: SECTOR_COLORSCALE,
      zmin: -1.0,
      zmax: 1.0,
      showscale: false,
      hoverongaps: false,
      xgap: 1,
      ygap: 1,
      hovertemplate: '%{customdata.label}<extra></extra>',
    } as unknown as Partial<Plotly.PlotData>,
  ]

  // Tick values at the middle sector (S2) of each lap group
  const tickvals = Array.from({ length: heatmapResult.maxLap }, (_, i) => i * 3 + 1)
  const ticktext = Array.from({ length: heatmapResult.maxLap }, (_, i) => String(i + 1))

  const layout: Partial<Plotly.Layout> = {
    template: 'plotly_dark' as unknown as Plotly.Template,
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    width: chartWidth,
    height: chartHeight,
    margin: { t: 30, r: 16, b: 40, l: 56 },
    xaxis: {
      showticklabels: true,
      tickvals,
      ticktext,
      title: { text: 'Lap' },
      color: '#e0e0f0',
      gridcolor: '#2d2d3d',
      side: 'bottom' as const,
    },
    yaxis: {
      autorange: 'reversed' as const,
      color: '#e0e0f0',
      tickfont: { size: 10 },
    },
    shapes: [...cursorShapes].filter(Boolean) as Plotly.Shape[],
    showlegend: false,
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Sector Times</h3>
        <ToggleSwitch
          checked={excludeSC}
          onChange={setExcludeSC}
          label="Exclude SC/VSC from colors"
        />
      </div>
      <div className="overflow-x-auto">
      <Plot
        data={data}
        layout={layout}
        config={{ responsive: false, displayModeBar: false }}
        style={{ width: `${chartWidth}px`, height: `${chartHeight}px` }}
      />
      </div>
    </div>
  )
}
