/**
 * GapChart — Reactive Plotly.js line/bar chart showing lap-by-lap gap between two drivers.
 *
 * Subscribes to replay state via `visibleLap` prop and reactively updates:
 * - Data points are progressively revealed as the replay advances
 * - A "current lap" vertical marker tracks the latest revealed lap
 * - The latest data point is highlighted with a pulsing glow marker
 * - X-axis dynamically scrolls to follow the replay position
 * - Gap trend direction indicator shows if the gap is growing or shrinking
 * - Plotly transitions provide smooth animation between lap reveals
 *
 * Positive gap values (driver 1 ahead) are colored with driver 1's team color.
 * Negative gap values (driver 2 ahead) are colored with driver 2's team color.
 *
 * Features:
 * - Line trace showing cumulative gap evolution across laps
 * - Colored bar chart showing per-lap gap with positive/negative coloring
 * - Pit stop markers indicated on the chart
 * - Hover tooltips with gap details, positions, and lap times
 * - F1-themed dark styling matching the dashboard
 * - Responsive layout
 */

import React, { useMemo, useRef, useEffect } from 'react';
import Plot from 'react-plotly.js';
import type { GapChartData, GapChartPoint } from '../types';
import './GapChart.css';

export interface GapChartProps {
  /** Gap chart data from the API. */
  data: GapChartData;
  /** Optional: only render up to this lap (for replay mode). */
  visibleLap?: number;
  /** Total laps in the session (used for x-axis range in replay mode). */
  totalLaps?: number;
}

/** Format seconds to a display string like "+1.234s" or "-0.567s". */
function formatGap(seconds: number): string {
  const sign = seconds >= 0 ? '+' : '';
  return `${sign}${seconds.toFixed(3)}s`;
}

/** Format a lap time from seconds to "M:SS.mmm". */
function formatLapTime(seconds: number | null): string {
  if (seconds === null) return '--:--.---';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs.toFixed(3)}`;
}

/** Determine the gap trend direction between last two points. */
function getGapTrend(
  points: GapChartPoint[],
): { direction: 'growing' | 'shrinking' | 'stable'; change: number } | null {
  if (points.length < 2) return null;
  const curr = points[points.length - 1];
  const prev = points[points.length - 2];
  const change = Math.abs(curr.gap_seconds) - Math.abs(prev.gap_seconds);
  const threshold = 0.05; // 50ms threshold for "stable"
  if (Math.abs(change) < threshold) return { direction: 'stable', change };
  return {
    direction: change > 0 ? 'growing' : 'shrinking',
    change,
  };
}

/** Number of laps visible in the scrolling window during replay. */
const REPLAY_WINDOW_SIZE = 20;

const GapChart: React.FC<GapChartProps> = ({ data, visibleLap, totalLaps: totalLapsProp }) => {
  const isReplayMode = visibleLap !== undefined;
  const prevVisibleLapRef = useRef<number | undefined>(visibleLap);

  // Track whether this is a new lap reveal (for animation trigger)
  const isNewLapReveal = useRef(false);
  useEffect(() => {
    const prev = prevVisibleLapRef.current;
    if (visibleLap !== undefined && prev !== undefined && visibleLap > prev) {
      isNewLapReveal.current = true;
    } else {
      isNewLapReveal.current = false;
    }
    prevVisibleLapRef.current = visibleLap;
  }, [visibleLap]);

  // Filter points based on visibleLap (for replay mode)
  const points: GapChartPoint[] = useMemo(() => {
    if (visibleLap === undefined) return data.points;
    return data.points.filter((p) => p.lap_number <= visibleLap);
  }, [data.points, visibleLap]);

  const d1Color = `#${data.driver1_color}`;
  const d2Color = `#${data.driver2_color}`;

  // Build bar colors: positive gap = driver1 color, negative = driver2 color
  const barColors = useMemo(
    () => points.map((p) => (p.gap_seconds >= 0 ? d1Color : d2Color)),
    [points, d1Color, d2Color],
  );

  // Build hover text for bars
  const barHoverText = useMemo(
    () =>
      points.map((p) => {
        const leader = p.gap_seconds >= 0 ? data.driver1 : data.driver2;
        const gapStr = formatGap(p.gap_seconds);
        const d1Lap = formatLapTime(p.driver1_lap_time_s);
        const d2Lap = formatLapTime(p.driver2_lap_time_s);
        const pitInfo: string[] = [];
        if (p.is_pit_lap_d1) pitInfo.push(`${data.driver1} PIT`);
        if (p.is_pit_lap_d2) pitInfo.push(`${data.driver2} PIT`);
        return [
          `<b>Lap ${p.lap_number}</b>`,
          `Gap: <b>${gapStr}</b> (${leader} ahead)`,
          `${data.driver1} P${p.driver1_position} | ${d1Lap}`,
          `${data.driver2} P${p.driver2_position} | ${d2Lap}`,
          ...(pitInfo.length > 0 ? [`<i>${pitInfo.join(', ')}</i>`] : []),
        ].join('<br>');
      }),
    [points, data.driver1, data.driver2],
  );

  // Pit stop lap markers for driver 1
  const d1PitLaps = useMemo(
    () => points.filter((p) => p.is_pit_lap_d1),
    [points],
  );
  const d2PitLaps = useMemo(
    () => points.filter((p) => p.is_pit_lap_d2),
    [points],
  );

  const lapNumbers = points.map((p) => p.lap_number);
  const gapValues = points.map((p) => p.gap_seconds);

  // Build bar opacity: pit laps get a striped/dimmed look to stand out
  const barOpacities = useMemo(
    () => points.map((p) => (p.is_pit_lap_d1 || p.is_pit_lap_d2 ? 0.25 : 0.5)),
    [points],
  );

  // Determine axis range for symmetric padding
  const maxAbsGap = useMemo(() => {
    if (gapValues.length === 0) return 5;
    const maxVal = Math.max(...gapValues.map(Math.abs));
    return Math.ceil(maxVal * 1.15); // 15% padding
  }, [gapValues]);

  // Latest point and second-to-last for the "highlight" marker
  const latestPoint = points.length > 0 ? points[points.length - 1] : null;

  // Build marker sizes: latest point gets a larger marker in replay mode
  const markerSizes = useMemo(() => {
    if (!isReplayMode || points.length === 0) {
      return points.map(() => 6);
    }
    return points.map((_, i) => (i === points.length - 1 ? 10 : 6));
  }, [points, isReplayMode]);

  // Build marker line widths: latest point gets a highlight ring
  const markerLineWidths = useMemo(() => {
    if (!isReplayMode || points.length === 0) {
      return points.map(() => 1.5);
    }
    return points.map((_, i) => (i === points.length - 1 ? 3 : 1.5));
  }, [points, isReplayMode]);

  // Build marker line colors: latest point gets a bright glow ring
  const markerLineColors = useMemo(() => {
    if (!isReplayMode || points.length === 0) {
      return points.map(() => '#1a1a2e');
    }
    return points.map((_, i) => (i === points.length - 1 ? '#ffffff' : '#1a1a2e'));
  }, [points, isReplayMode]);

  // Dynamic x-axis range for replay scrolling window
  const xAxisRange = useMemo(() => {
    if (!isReplayMode || visibleLap === undefined) {
      // Full race view — let Plotly auto-range
      return undefined;
    }
    const sessLaps = totalLapsProp ?? data.total_laps;
    if (visibleLap <= REPLAY_WINDOW_SIZE) {
      // Early in the race — show from lap 0 to window size
      return [0, Math.min(REPLAY_WINDOW_SIZE + 1, sessLaps + 1)];
    }
    // Scrolling window: keep current lap near the right edge
    return [visibleLap - REPLAY_WINDOW_SIZE, visibleLap + 2];
  }, [isReplayMode, visibleLap, totalLapsProp, data.total_laps]);

  const plotData: Plotly.Data[] = [
    // Bar chart: per-lap gap with color coding
    {
      type: 'bar',
      x: lapNumbers,
      y: gapValues,
      marker: {
        color: barColors,
        opacity: barOpacities,
        line: {
          color: barColors,
          width: 1,
        },
      },
      hovertext: barHoverText,
      hoverinfo: 'text' as const,
      name: 'Gap',
      showlegend: false,
    },
    // Line trace: cumulative gap evolution
    {
      type: 'scatter',
      mode: 'lines+markers' as const,
      x: lapNumbers,
      y: gapValues,
      line: {
        color: '#ffffff',
        width: 2,
        shape: 'spline' as const,
      },
      marker: {
        color: barColors,
        size: markerSizes,
        line: {
          color: markerLineColors,
          width: markerLineWidths,
        },
      },
      hovertext: barHoverText,
      hoverinfo: 'text' as const,
      name: 'Gap Trend',
      showlegend: false,
    },
    // "Latest lap" highlight marker (larger, glowing) — only in replay mode
    ...(isReplayMode && latestPoint
      ? [
          {
            type: 'scatter' as const,
            mode: 'markers' as const,
            x: [latestPoint.lap_number],
            y: [latestPoint.gap_seconds],
            marker: {
              color: latestPoint.gap_seconds >= 0 ? d1Color : d2Color,
              size: 14,
              symbol: 'circle' as const,
              opacity: 0.4,
              line: { color: '#ffffff', width: 2 },
            },
            hoverinfo: 'skip' as const,
            name: 'Current Lap',
            showlegend: false,
          },
        ]
      : []),
    // Pit stop markers for driver 1
    ...(d1PitLaps.length > 0
      ? [
          {
            type: 'scatter' as const,
            mode: 'text+markers' as const,
            x: d1PitLaps.map((p) => p.lap_number),
            y: d1PitLaps.map((p) => p.gap_seconds),
            text: d1PitLaps.map(() => 'PIT'),
            textposition: 'top center' as const,
            textfont: {
              size: 9,
              color: d1Color,
              family: "'Inter', sans-serif",
            },
            marker: {
              symbol: 'diamond' as const,
              size: 14,
              color: d1Color,
              line: { color: '#ffffff', width: 2 },
            },
            hovertext: d1PitLaps.map(
              (p) =>
                `<b>${data.driver1} PIT STOP</b><br>Lap ${p.lap_number}<br>Lap time: ${formatLapTime(p.driver1_lap_time_s)}<br>Gap: ${formatGap(p.gap_seconds)}`,
            ),
            hoverinfo: 'text' as const,
            name: `${data.driver1} Pit`,
            showlegend: true,
          },
        ]
      : []),
    // Pit stop markers for driver 2
    ...(d2PitLaps.length > 0
      ? [
          {
            type: 'scatter' as const,
            mode: 'text+markers' as const,
            x: d2PitLaps.map((p) => p.lap_number),
            y: d2PitLaps.map((p) => p.gap_seconds),
            text: d2PitLaps.map(() => 'PIT'),
            textposition: 'bottom center' as const,
            textfont: {
              size: 9,
              color: d2Color,
              family: "'Inter', sans-serif",
            },
            marker: {
              symbol: 'diamond' as const,
              size: 14,
              color: d2Color,
              line: { color: '#ffffff', width: 2 },
            },
            hovertext: d2PitLaps.map(
              (p) =>
                `<b>${data.driver2} PIT STOP</b><br>Lap ${p.lap_number}<br>Lap time: ${formatLapTime(p.driver2_lap_time_s)}<br>Gap: ${formatGap(p.gap_seconds)}`,
            ),
            hoverinfo: 'text' as const,
            name: `${data.driver2} Pit`,
            showlegend: true,
          },
        ]
      : []),
  ];

  // Current lap vertical marker shape (red dashed line at the latest visible lap)
  const currentLapMarker = isReplayMode && latestPoint
    ? [{
        type: 'line' as const,
        x0: latestPoint.lap_number,
        x1: latestPoint.lap_number,
        y0: 0,
        y1: 1,
        yref: 'paper' as const,
        line: {
          color: '#e10600',
          width: 2,
          dash: 'dot' as const,
        },
        opacity: 0.7,
      }]
    : [];

  // Current lap annotation (shows "LAP N" above the current position)
  const currentLapAnnotation = isReplayMode && latestPoint
    ? [{
        x: latestPoint.lap_number,
        y: 1.05,
        xref: 'x' as const,
        yref: 'paper' as const,
        text: `LAP ${latestPoint.lap_number}`,
        showarrow: false,
        font: { size: 10, color: '#e10600', family: "'Inter', sans-serif" },
        xanchor: 'center' as const,
        yanchor: 'bottom' as const,
      }]
    : [];

  const layout: Partial<Plotly.Layout> = {
    paper_bgcolor: '#1a1a2e',
    plot_bgcolor: '#1a1a2e',
    font: {
      family: "'Inter', 'Segoe UI', system-ui, sans-serif",
      color: '#e0e0f0',
      size: 12,
    },
    margin: { t: 60, r: 30, b: 60, l: 60 },
    xaxis: {
      title: {
        text: 'Lap',
        font: { size: 13, color: '#8b8ba0' },
      },
      gridcolor: '#2d2d3d',
      zerolinecolor: '#2d2d3d',
      tickfont: { color: '#8b8ba0', size: 11 },
      dtick: 5,
      ...(xAxisRange ? { range: xAxisRange } : {}),
    },
    yaxis: {
      title: {
        text: 'Gap (seconds)',
        font: { size: 13, color: '#8b8ba0' },
      },
      gridcolor: '#2d2d3d',
      zerolinecolor: '#e10600',
      zerolinewidth: 2,
      tickfont: { color: '#8b8ba0', size: 11 },
      range: [-maxAbsGap, maxAbsGap],
    },
    legend: {
      orientation: 'h' as const,
      x: 0.5,
      xanchor: 'center' as const,
      y: 1.12,
      font: { size: 11, color: '#e0e0f0' },
      bgcolor: 'rgba(0,0,0,0)',
    },
    hovermode: 'x unified' as const,
    hoverlabel: {
      bgcolor: '#15151e',
      bordercolor: '#3d3d4d',
      font: { family: "'Inter', sans-serif", size: 12, color: '#e0e0f0' },
    },
    // Smooth transitions when data updates during replay
    transition: isReplayMode
      ? {
          duration: 300,
          easing: 'cubic-in-out' as const,
        }
      : undefined,
    // Annotations: driver labels on each side of the zero line + current lap marker
    annotations: [
      {
        x: 0.01,
        y: 1,
        xref: 'paper' as const,
        yref: 'paper' as const,
        text: `<b style="color:${d1Color}">${data.driver1}</b> ahead`,
        showarrow: false,
        font: { size: 11, color: d1Color },
        xanchor: 'left' as const,
        yanchor: 'top' as const,
      },
      {
        x: 0.01,
        y: 0,
        xref: 'paper' as const,
        yref: 'paper' as const,
        text: `<b style="color:${d2Color}">${data.driver2}</b> ahead`,
        showarrow: false,
        font: { size: 11, color: d2Color },
        xanchor: 'left' as const,
        yanchor: 'bottom' as const,
      },
      ...currentLapAnnotation,
    ],
    shapes: [
      // Zero line emphasis
      {
        type: 'line' as const,
        x0: 0,
        x1: 1,
        xref: 'paper' as const,
        y0: 0,
        y1: 0,
        line: {
          color: '#e10600',
          width: 2,
          dash: 'dot' as const,
        },
      },
      // Current lap vertical marker
      ...currentLapMarker,
      // Vertical dashed lines at pit stop laps for driver 1
      ...d1PitLaps.map((p) => ({
        type: 'line' as const,
        x0: p.lap_number,
        x1: p.lap_number,
        y0: 0,
        y1: 1,
        yref: 'paper' as const,
        line: {
          color: d1Color,
          width: 1,
          dash: 'dash' as const,
        },
        opacity: 0.4,
      })),
      // Vertical dashed lines at pit stop laps for driver 2
      ...d2PitLaps.map((p) => ({
        type: 'line' as const,
        x0: p.lap_number,
        x1: p.lap_number,
        y0: 0,
        y1: 1,
        yref: 'paper' as const,
        line: {
          color: d2Color,
          width: 1,
          dash: 'dash' as const,
        },
        opacity: 0.4,
      })),
    ],
  };

  const config: Partial<Plotly.Config> = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: [
      'select2d',
      'lasso2d',
      'autoScale2d',
      'toggleSpikelines',
    ] as any,
  };

  // Summary stats
  const maxGap = useMemo(() => {
    if (points.length === 0) return null;
    return points.reduce((max, p) =>
      Math.abs(p.gap_seconds) > Math.abs(max.gap_seconds) ? p : max,
    );
  }, [points]);

  // Gap trend (growing/shrinking) for the latest transition
  const gapTrend = useMemo(() => getGapTrend(points), [points]);

  return (
    <div className="gap-chart" data-testid="gap-chart">
      <div className="gap-chart__header">
        <h2 className="gap-chart__title">Gap Chart</h2>
        <div className="gap-chart__drivers">
          <span
            className="gap-chart__driver-tag"
            style={{ borderColor: d1Color, color: d1Color }}
          >
            {data.driver1}
          </span>
          <span className="gap-chart__vs">vs</span>
          <span
            className="gap-chart__driver-tag"
            style={{ borderColor: d2Color, color: d2Color }}
          >
            {data.driver2}
          </span>
        </div>
      </div>

      {/* Summary stats row */}
      {latestPoint && (
        <div className="gap-chart__stats" data-testid="gap-chart-stats">
          <div className="gap-chart__stat">
            <span className="gap-chart__stat-label">Current Gap</span>
            <span
              className="gap-chart__stat-value"
              data-testid="current-gap-value"
              style={{
                color:
                  latestPoint.gap_seconds >= 0 ? d1Color : d2Color,
              }}
            >
              {formatGap(latestPoint.gap_seconds)}
            </span>
          </div>
          <div className="gap-chart__stat">
            <span className="gap-chart__stat-label">Leader</span>
            <span className="gap-chart__stat-value">
              {latestPoint.gap_seconds >= 0 ? data.driver1_name : data.driver2_name}
            </span>
          </div>
          <div className="gap-chart__stat">
            <span className="gap-chart__stat-label">Lap</span>
            <span className="gap-chart__stat-value" data-testid="current-lap-value">
              {latestPoint.lap_number}
            </span>
          </div>
          {/* Gap Trend indicator — shows if gap is growing or shrinking */}
          {gapTrend && (
            <div className="gap-chart__stat" data-testid="gap-trend">
              <span className="gap-chart__stat-label">Trend</span>
              <span className={`gap-chart__stat-value gap-chart__trend gap-chart__trend--${gapTrend.direction}`}>
                {gapTrend.direction === 'growing' && (
                  <span className="gap-chart__trend-arrow" data-testid="trend-arrow-growing" aria-label="Gap growing">&#9650;</span>
                )}
                {gapTrend.direction === 'shrinking' && (
                  <span className="gap-chart__trend-arrow" data-testid="trend-arrow-shrinking" aria-label="Gap shrinking">&#9660;</span>
                )}
                {gapTrend.direction === 'stable' && (
                  <span className="gap-chart__trend-arrow" data-testid="trend-arrow-stable" aria-label="Gap stable">&#9644;</span>
                )}
                <span className="gap-chart__trend-label">
                  {gapTrend.direction === 'growing' ? 'Growing' :
                   gapTrend.direction === 'shrinking' ? 'Closing' : 'Stable'}
                </span>
              </span>
            </div>
          )}
          {maxGap && (
            <div className="gap-chart__stat">
              <span className="gap-chart__stat-label">Max Gap</span>
              <span
                className="gap-chart__stat-value"
                style={{
                  color: maxGap.gap_seconds >= 0 ? d1Color : d2Color,
                }}
              >
                {formatGap(maxGap.gap_seconds)}
                <span className="gap-chart__stat-sub">
                  {' '}(Lap {maxGap.lap_number})
                </span>
              </span>
            </div>
          )}
          {(d1PitLaps.length > 0 || d2PitLaps.length > 0) && (
            <div className="gap-chart__stat gap-chart__stat--pits">
              <span className="gap-chart__stat-label">Pit Stops</span>
              <span className="gap-chart__stat-value gap-chart__pit-counts">
                {d1PitLaps.length > 0 && (
                  <span className="gap-chart__pit-badge" style={{ borderColor: d1Color, color: d1Color }}>
                    {data.driver1} ×{d1PitLaps.length}
                  </span>
                )}
                {d2PitLaps.length > 0 && (
                  <span className="gap-chart__pit-badge" style={{ borderColor: d2Color, color: d2Color }}>
                    {data.driver2} ×{d2PitLaps.length}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Replay mode indicator */}
      {isReplayMode && latestPoint && (
        <div className="gap-chart__replay-indicator" data-testid="replay-mode-indicator">
          <span className="gap-chart__replay-dot" />
          <span className="gap-chart__replay-text">
            REPLAY — Lap {latestPoint.lap_number} of {totalLapsProp ?? data.total_laps}
          </span>
        </div>
      )}

      {/* Plotly chart */}
      {points.length > 0 ? (
        <div className="gap-chart__plot" data-testid="gap-chart-plot">
          <Plot
            data={plotData}
            layout={layout}
            config={config}
            useResizeHandler
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      ) : (
        <div className="gap-chart__empty">
          <p>No gap data available yet.</p>
          <p className="gap-chart__empty-hint">
            Waiting for lap data to compute driver gap...
          </p>
        </div>
      )}
    </div>
  );
};

export default GapChart;
