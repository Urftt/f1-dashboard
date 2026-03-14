import { useState } from 'react'
import _Plot from 'react-plotly.js'
// react-plotly.js is CJS — Vite interop may double-wrap the default export
const Plot = (typeof (_Plot as any).default === 'function' ? (_Plot as any).default : _Plot) as typeof _Plot
import { usePositionData } from './usePositionData'

interface PositionChartProps {
  visibleDrivers: Set<string>
}

/**
 * PositionChart — Plotly scattergl chart showing driver race positions over laps.
 *
 * Features:
 * - Dark theme via plotly_dark template
 * - One scattergl trace per visible driver (WebGL for 20-driver performance)
 * - Y-axis inverted so P1 is at the top
 * - Driver abbreviation labels at end of each line
 * - SC/VSC/RED period shading with progressive reveal
 * - Vertical dashed cursor line at currentLap (from replay store)
 * - Hover highlighting: hovered driver thickened, others dimmed
 * - Progressive reveal: only laps up to currentLap are shown
 */
export function PositionChart({ visibleDrivers }: PositionChartProps) {
  const { positionTraces, annotations, scShapes, cursorShapes } = usePositionData(visibleDrivers)

  // Track hovered driver index for opacity fallback (avoids Plotly.restyle race conditions)
  const [hoveredTraceIndex, setHoveredTraceIndex] = useState<number | null>(null)

  // Apply hover state to traces by recomputing line opacity/width per trace
  const data = positionTraces.map((trace, i) => {
    if (hoveredTraceIndex === null) {
      return trace
    }
    const isHovered = i === hoveredTraceIndex
    return {
      ...trace,
      line: {
        ...(trace as any).line,
        opacity: isHovered ? 1 : 0.3,
        width: isHovered ? 3 : 1.5,
      },
      marker: {
        ...(trace as any).marker,
        opacity: isHovered ? 1 : 0.3,
      },
    }
  })

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
      // P1 at top: autorange reversed
      autorange: 'reversed' as const,
      dtick: 1,
      gridcolor: '#2d2d3d',
      color: '#e0e0f0',
    },
    annotations: annotations as Plotly.Annotations[],
    shapes: [...scShapes, ...cursorShapes].filter(Boolean),
    showlegend: false,
    hovermode: 'closest',
    // Extra right margin for end-of-line labels
    margin: { t: 16, r: 40, b: 40, l: 56 },
  }

  const config = { responsive: true, displayModeBar: false }

  if (positionTraces.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <p className="text-sm text-muted-foreground">No position data available</p>
      </div>
    )
  }

  return (
    <Plot
      data={data}
      layout={layout}
      config={config}
      useResizeHandler={true}
      style={{ width: '100%', height: '100%' }}
      className="w-full"
      divId="position-chart"
      onHover={(event: any) => {
        const curveNumber = event?.points?.[0]?.curveNumber
        if (curveNumber !== undefined) {
          setHoveredTraceIndex(curveNumber)
        }
      }}
      onUnhover={() => {
        setHoveredTraceIndex(null)
      }}
    />
  )
}
