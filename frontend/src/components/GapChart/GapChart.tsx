import Plot from 'react-plotly.js'
import { useGapData } from './useGapData'
import { useSessionStore } from '@/stores/sessionStore'

/**
 * GapChart — Plotly scatter chart showing gap-over-time between two drivers.
 *
 * Features:
 * - Dark theme via plotly_dark template
 * - Dynamic team-color line segments (from useGapData segments)
 * - Zero-line reference for "equal time" baseline
 * - Hover tooltip showing "Lap N: +X.XXXs"
 * - Vertical dashed cursor line at currentLap (from replay store)
 */
export function GapChart() {
  const { segments } = useGapData()
  const currentLap = useSessionStore((s) => s.currentLap)

  const cursorShape =
    currentLap > 0
      ? [
          {
            type: 'line' as const,
            x0: currentLap,
            x1: currentLap,
            y0: 0,
            y1: 1,
            yref: 'paper' as const, // paper coords — spans full chart height regardless of data range
            line: {
              color: 'rgba(255,255,255,0.6)',
              width: 1.5,
              dash: 'dash' as const,
            },
          },
        ]
      : []

  const layout: Partial<Plotly.Layout> = {
    template: 'plotly_dark' as unknown as Plotly.Template,
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    yaxis: {
      zeroline: true,
      zerolinecolor: 'rgba(255,255,255,0.3)',
      zerolinewidth: 1.5,
      gridcolor: 'rgba(255,255,255,0.08)',
      title: { text: 'Gap (s)' },
    },
    xaxis: {
      gridcolor: 'rgba(255,255,255,0.08)',
      title: { text: 'Lap' },
    },
    margin: { t: 16, r: 8, b: 40, l: 56 },
    showlegend: false,
    hovermode: 'x unified',
    shapes: cursorShape,
  }

  if (segments.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Select two drivers to see their gap
        </p>
      </div>
    )
  }

  return (
    <div className="h-[400px] min-h-[350px] w-full">
      <Plot
        data={segments}
        layout={layout}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
        config={{ displayModeBar: false }}
      />
    </div>
  )
}
