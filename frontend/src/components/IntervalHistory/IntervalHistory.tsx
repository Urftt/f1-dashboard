import { useState } from 'react'
import _Plot from 'react-plotly.js'
// react-plotly.js is CJS — Vite interop may double-wrap the default export
const Plot = (typeof (_Plot as any).default === 'function' ? (_Plot as any).default : _Plot) as typeof _Plot
import { useIntervalData } from './useIntervalData'

interface IntervalHistoryProps {
  visibleDrivers: Set<string>
}

/**
 * IntervalHistory — Plotly scattergl chart showing gap-to-car-ahead per driver across laps.
 *
 * Features:
 * - Dark theme via plotly_dark template
 * - Two traces per driver: normal (full opacity) and dim (0.3 opacity, lap 1 + pit laps)
 * - DRS threshold at 1.0s: green shaded zone below + dashed reference line
 * - "DRS" label annotation on the DRS line
 * - SC/VSC/RED period shading with progressive reveal
 * - Vertical dashed cursor line at currentLap (from replay store)
 * - Progressive reveal: only laps up to currentLap are shown
 * - Hover highlighting: hovered driver thickened/opaque, others dimmed
 *   (highlights both normal and dim traces for the same driver)
 * - End-of-line driver abbreviation labels at last visible interval value
 */
export function IntervalHistory({ visibleDrivers }: IntervalHistoryProps) {
  const { intervalTraces, annotations, scShapes, drsShapes, cursorShapes } =
    useIntervalData(visibleDrivers)

  // Track hovered driver name (not index) since each driver has 2 traces
  const [hoveredDriver, setHoveredDriver] = useState<string | null>(null)

  // Apply hover state — both normal and dim traces for the hovered driver get highlighted
  const data = intervalTraces.map((trace) => {
    if (hoveredDriver === null) {
      return trace
    }
    const traceName = (trace as any).name as string
    // Strip _dim suffix to get base driver name
    const baseDriver = traceName.endsWith('_dim')
      ? traceName.slice(0, -4)
      : traceName
    const isHovered = baseDriver === hoveredDriver
    const isDim = traceName.endsWith('_dim')

    if (isHovered) {
      return {
        ...trace,
        // Hovered dim traces keep 0.3 opacity but get thicker line
        opacity: isDim ? 0.3 : 1,
        line: {
          ...(trace as any).line,
          width: 3,
        },
      }
    } else {
      return {
        ...trace,
        opacity: isDim ? 0.15 : 0.4,
        line: {
          ...(trace as any).line,
          width: 1.5,
        },
      }
    }
  })

  // DRS "label" annotation at x=0.01 paper coords, y=1.0
  const drsAnnotation: Partial<Plotly.Annotations> = {
    x: 0.01,
    xref: 'paper' as const,
    y: 1.0,
    yref: 'y' as const,
    text: 'DRS',
    showarrow: false,
    font: { color: 'rgba(0, 200, 80, 0.6)', size: 10 },
    xanchor: 'left' as const,
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
    yaxis: {
      title: { text: 'Interval (s)' },
      gridcolor: '#2d2d3d',
      color: '#e0e0f0',
      // rangemode tozero ensures DRS line at 1.0s is always visible
      rangemode: 'tozero' as const,
    },
    annotations: [drsAnnotation, ...annotations] as Plotly.Annotations[],
    shapes: [...drsShapes, ...scShapes, ...cursorShapes].filter(Boolean),
    showlegend: false,
    hovermode: 'closest',
    margin: { t: 16, r: 40, b: 40, l: 56 },
  }

  const config = { responsive: true, displayModeBar: false }

  if (intervalTraces.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <p className="text-sm text-muted-foreground">No interval data available</p>
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
      divId="interval-history-chart"
      onHover={(event: any) => {
        const curveNumber = event?.points?.[0]?.curveNumber
        if (curveNumber !== undefined) {
          const traceName = (intervalTraces[curveNumber] as any)?.name as string | undefined
          if (traceName) {
            const baseDriver = traceName.endsWith('_dim')
              ? traceName.slice(0, -4)
              : traceName
            setHoveredDriver(baseDriver)
          }
        }
      }}
      onUnhover={() => {
        setHoveredDriver(null)
      }}
    />
  )
}
