/**
 * Tests for the GapChart component — including reactive replay behavior.
 *
 * Tests verify:
 * 1. Basic rendering of chart, stats, and driver tags
 * 2. Replay mode: visibleLap filtering reveals data progressively
 * 3. Current lap marker appears in replay mode
 * 4. Gap trend indicator updates as replay advances
 * 5. Replay mode indicator banner
 * 6. Latest point highlight marker in replay mode
 * 7. Dynamic x-axis range during replay scrolling
 * 8. Plotly transition config for smooth animation
 * 9. Re-render behavior when visibleLap prop changes
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import GapChart from './GapChart';
import { GapChartData } from '../types';

// Mock react-plotly.js to avoid loading the full Plotly bundle in tests
jest.mock('react-plotly.js', () => {
  const MockPlot = (props: any) => (
    <div
      data-testid="plotly-chart"
      data-traces={JSON.stringify(props.data)}
      data-layout={JSON.stringify(props.layout)}
      data-config={JSON.stringify(props.config)}
    />
  );
  MockPlot.displayName = 'MockPlot';
  return MockPlot;
});

const mockData: GapChartData = {
  session_key: '2023::Bahrain::Race',
  driver1: 'VER',
  driver2: 'HAM',
  driver1_color: '3671C6',
  driver2_color: '6CD3BF',
  driver1_name: 'Max Verstappen',
  driver2_name: 'Lewis Hamilton',
  total_laps: 57,
  points: [
    {
      lap_number: 1,
      gap_seconds: 1.5,
      driver1_position: 1,
      driver2_position: 2,
      driver1_lap_time_s: 95.123,
      driver2_lap_time_s: 96.623,
      gap_change: null,
      is_pit_lap_d1: false,
      is_pit_lap_d2: false,
    },
    {
      lap_number: 2,
      gap_seconds: 2.3,
      driver1_position: 1,
      driver2_position: 2,
      driver1_lap_time_s: 93.456,
      driver2_lap_time_s: 94.256,
      gap_change: 0.8,
      is_pit_lap_d1: false,
      is_pit_lap_d2: false,
    },
    {
      lap_number: 3,
      gap_seconds: -0.5,
      driver1_position: 2,
      driver2_position: 1,
      driver1_lap_time_s: 96.789,
      driver2_lap_time_s: 93.989,
      gap_change: -2.8,
      is_pit_lap_d1: true,
      is_pit_lap_d2: false,
    },
    {
      lap_number: 4,
      gap_seconds: 0.2,
      driver1_position: 1,
      driver2_position: 2,
      driver1_lap_time_s: 92.100,
      driver2_lap_time_s: 92.800,
      gap_change: 0.7,
      is_pit_lap_d1: false,
      is_pit_lap_d2: false,
    },
  ],
};

// ── Helper to parse Plotly props from the mock ──────────────────────
function getPlotlyProps() {
  const chart = screen.getByTestId('plotly-chart');
  const traces = JSON.parse(chart.getAttribute('data-traces') || '[]');
  const layout = JSON.parse(chart.getAttribute('data-layout') || '{}');
  const config = JSON.parse(chart.getAttribute('data-config') || '{}');
  return { traces, layout, config };
}

// ── Basic rendering tests ──────────────────────────────────────────

describe('GapChart', () => {
  it('renders the chart title and driver tags', () => {
    render(<GapChart data={mockData} />);

    expect(screen.getByText('Gap Chart')).toBeInTheDocument();
    expect(screen.getByText('VER')).toBeInTheDocument();
    expect(screen.getByText('HAM')).toBeInTheDocument();
    expect(screen.getByText('vs')).toBeInTheDocument();
  });

  it('renders the Plotly chart', () => {
    render(<GapChart data={mockData} />);
    expect(screen.getByTestId('plotly-chart')).toBeInTheDocument();
  });

  it('shows current gap stats', () => {
    render(<GapChart data={mockData} />);

    // Current gap should be the last point's gap
    expect(screen.getByText('Current Gap')).toBeInTheDocument();
    expect(screen.getByText('+0.200s')).toBeInTheDocument();
  });

  it('shows the leader name', () => {
    render(<GapChart data={mockData} />);
    expect(screen.getByText('Leader')).toBeInTheDocument();
    // Last point has positive gap, so driver1 is ahead
    expect(screen.getByText('Max Verstappen')).toBeInTheDocument();
  });

  it('shows the current lap number', () => {
    render(<GapChart data={mockData} />);
    expect(screen.getByText('Lap')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('shows max gap stat', () => {
    render(<GapChart data={mockData} />);
    expect(screen.getByText('Max Gap')).toBeInTheDocument();
    // Max absolute gap is 2.3s at lap 2
    expect(screen.getByText('+2.300s')).toBeInTheDocument();
  });

  it('applies driver colors to tags', () => {
    render(<GapChart data={mockData} />);
    const verTag = screen.getByText('VER');
    expect(verTag).toHaveStyle({ color: '#3671C6', borderColor: '#3671C6' });

    const hamTag = screen.getByText('HAM');
    expect(hamTag).toHaveStyle({ color: '#6CD3BF', borderColor: '#6CD3BF' });
  });

  it('renders empty state when no points', () => {
    const emptyData: GapChartData = {
      ...mockData,
      points: [],
    };
    render(<GapChart data={emptyData} />);

    expect(screen.getByText('No gap data available yet.')).toBeInTheDocument();
    expect(screen.queryByTestId('plotly-chart')).not.toBeInTheDocument();
  });

  it('passes correct bar colors to Plotly (positive=d1, negative=d2)', () => {
    render(<GapChart data={mockData} />);
    const { traces } = getPlotlyProps();

    // First trace is the bar chart
    const barTrace = traces[0];
    expect(barTrace.type).toBe('bar');

    // Check colors match: points 0,1,3 are positive (d1 color), point 2 is negative (d2 color)
    const colors = barTrace.marker.color;
    expect(colors[0]).toBe('#3671C6'); // positive
    expect(colors[1]).toBe('#3671C6'); // positive
    expect(colors[2]).toBe('#6CD3BF'); // negative
    expect(colors[3]).toBe('#3671C6'); // positive
  });

  it('renders pit stop diamond markers as separate traces', () => {
    render(<GapChart data={mockData} />);
    const { traces } = getPlotlyProps();

    // There should be a pit trace for driver 1 (lap 3 has is_pit_lap_d1: true)
    const d1PitTrace = traces.find(
      (t: any) => t.name === 'VER Pit',
    );
    expect(d1PitTrace).toBeDefined();
    expect(d1PitTrace.marker.symbol).toBe('diamond');
    expect(d1PitTrace.marker.size).toBe(14);
    expect(d1PitTrace.x).toEqual([3]); // only lap 3
    expect(d1PitTrace.mode).toBe('text+markers');
    expect(d1PitTrace.text).toEqual(['PIT']);
  });

  it('does not render pit trace for driver with no pit stops', () => {
    render(<GapChart data={mockData} />);
    const { traces } = getPlotlyProps();

    // Driver 2 has no pit laps in mockData
    const d2PitTrace = traces.find(
      (t: any) => t.name === 'HAM Pit',
    );
    expect(d2PitTrace).toBeUndefined();
  });

  it('shows pit stop count badges in stats', () => {
    render(<GapChart data={mockData} />);

    expect(screen.getByText('Pit Stops')).toBeInTheDocument();
    // VER has 1 pit stop
    expect(screen.getByText('VER ×1')).toBeInTheDocument();
  });

  it('dims bar opacity for pit stop laps', () => {
    render(<GapChart data={mockData} />);
    const { traces } = getPlotlyProps();

    const barTrace = traces[0];
    expect(barTrace.type).toBe('bar');

    // Lap 3 (index 2) is a pit lap → 0.25 opacity, others → 0.5
    const opacities = barTrace.marker.opacity;
    expect(opacities[0]).toBe(0.5);  // normal
    expect(opacities[1]).toBe(0.5);  // normal
    expect(opacities[2]).toBe(0.25); // pit lap
    expect(opacities[3]).toBe(0.5);  // normal
  });

  it('includes pit stop hover text with PIT STOP label', () => {
    render(<GapChart data={mockData} />);
    const { traces } = getPlotlyProps();

    const d1PitTrace = traces.find(
      (t: any) => t.name === 'VER Pit',
    );
    expect(d1PitTrace.hovertext[0]).toContain('VER PIT STOP');
    expect(d1PitTrace.hovertext[0]).toContain('Lap 3');
  });

  it('shows both driver pit badges when both have pit stops', () => {
    const dataWithBothPits: GapChartData = {
      ...mockData,
      points: [
        ...mockData.points,
        {
          lap_number: 5,
          gap_seconds: 1.0,
          driver1_position: 1,
          driver2_position: 2,
          driver1_lap_time_s: 93.0,
          driver2_lap_time_s: 119.0,
          gap_change: 0.8,
          is_pit_lap_d1: false,
          is_pit_lap_d2: true,
        },
      ],
    };
    render(<GapChart data={dataWithBothPits} />);

    expect(screen.getByText('VER ×1')).toBeInTheDocument();
    expect(screen.getByText('HAM ×1')).toBeInTheDocument();
  });
});

// ── Replay mode: visibleLap filtering ──────────────────────────────

describe('GapChart — Replay Mode (visibleLap)', () => {
  it('respects visibleLap prop — only renders points up to that lap', () => {
    render(<GapChart data={mockData} visibleLap={2} />);

    // Should only show up to lap 2
    // Current gap and max gap are both +2.300s (same point), so there are two matches
    const gapElements = screen.getAllByText('+2.300s');
    expect(gapElements.length).toBe(2); // current gap + max gap
    // Lap should show 2
    const lapElements = screen.getAllByText('2');
    expect(lapElements.length).toBeGreaterThanOrEqual(1);
  });

  it('filters Plotly bar trace data to only visible laps', () => {
    render(<GapChart data={mockData} visibleLap={2} />);
    const { traces } = getPlotlyProps();

    const barTrace = traces[0];
    expect(barTrace.type).toBe('bar');
    // Only laps 1 and 2 should be present
    expect(barTrace.x).toEqual([1, 2]);
    expect(barTrace.y).toEqual([1.5, 2.3]);
  });

  it('filters Plotly line trace data to only visible laps', () => {
    render(<GapChart data={mockData} visibleLap={2} />);
    const { traces } = getPlotlyProps();

    const lineTrace = traces[1];
    expect(lineTrace.type).toBe('scatter');
    expect(lineTrace.x).toEqual([1, 2]);
    expect(lineTrace.y).toEqual([1.5, 2.3]);
  });

  it('renders pit stop markers filtered by visibleLap in replay mode', () => {
    // With visibleLap=2, the pit stop on lap 3 should not appear
    render(<GapChart data={mockData} visibleLap={2} />);
    const { traces } = getPlotlyProps();

    // No pit trace should be present (pit is on lap 3, filtered out)
    const d1PitTrace = traces.find(
      (t: any) => t.name === 'VER Pit',
    );
    expect(d1PitTrace).toBeUndefined();
  });

  it('updates data when visibleLap changes (lap-by-lap reveal)', () => {
    const { rerender } = render(<GapChart data={mockData} visibleLap={1} />);

    // At lap 1: only one point visible
    let { traces } = getPlotlyProps();
    expect(traces[0].x).toEqual([1]);
    expect(traces[0].y).toEqual([1.5]);

    // Advance to lap 2
    rerender(<GapChart data={mockData} visibleLap={2} />);
    ({ traces } = getPlotlyProps());
    expect(traces[0].x).toEqual([1, 2]);
    expect(traces[0].y).toEqual([1.5, 2.3]);

    // Advance to lap 3
    rerender(<GapChart data={mockData} visibleLap={3} />);
    ({ traces } = getPlotlyProps());
    expect(traces[0].x).toEqual([1, 2, 3]);
    expect(traces[0].y).toEqual([1.5, 2.3, -0.5]);
  });

  it('stats update reactively when visibleLap advances', () => {
    const { rerender } = render(<GapChart data={mockData} visibleLap={1} />);

    // At lap 1: gap is +1.500s, leader is Max Verstappen
    expect(screen.getByTestId('current-gap-value')).toHaveTextContent('+1.500s');
    expect(screen.getByText('Max Verstappen')).toBeInTheDocument();

    // Advance to lap 3: gap is -0.500s, leader switches to Hamilton
    rerender(<GapChart data={mockData} visibleLap={3} />);
    expect(screen.getByTestId('current-gap-value')).toHaveTextContent('-0.500s');
    expect(screen.getByText('Lewis Hamilton')).toBeInTheDocument();
  });

  it('shows no data when visibleLap is 0 (pre-race)', () => {
    render(<GapChart data={mockData} visibleLap={0} />);

    expect(screen.getByText('No gap data available yet.')).toBeInTheDocument();
    expect(screen.queryByTestId('plotly-chart')).not.toBeInTheDocument();
  });
});

// ── Current lap marker ──────────────────────────────────────────────

describe('GapChart — Current Lap Marker', () => {
  it('adds a current lap vertical marker shape in replay mode', () => {
    render(<GapChart data={mockData} visibleLap={2} />);
    const { layout } = getPlotlyProps();

    // Should have shapes: zero line + current lap marker (no pit lines at lap 2)
    const currentLapMarker = layout.shapes.find(
      (s: any) => s.x0 === 2 && s.x1 === 2 && s.line?.color === '#e10600' && s.line?.dash === 'dot',
    );
    expect(currentLapMarker).toBeDefined();
    expect(currentLapMarker.opacity).toBe(0.7);
  });

  it('current lap marker moves when visibleLap changes', () => {
    const { rerender } = render(<GapChart data={mockData} visibleLap={1} />);
    let { layout } = getPlotlyProps();

    let marker = layout.shapes.find(
      (s: any) => s.line?.color === '#e10600' && s.line?.dash === 'dot' && typeof s.x0 === 'number' && s.x0 > 0,
    );
    expect(marker.x0).toBe(1);

    // Advance to lap 3
    rerender(<GapChart data={mockData} visibleLap={3} />);
    ({ layout } = getPlotlyProps());
    marker = layout.shapes.find(
      (s: any) => s.line?.color === '#e10600' && s.line?.dash === 'dot' && typeof s.x0 === 'number' && s.x0 > 0,
    );
    expect(marker.x0).toBe(3);
  });

  it('adds a current lap annotation in replay mode', () => {
    render(<GapChart data={mockData} visibleLap={2} />);
    const { layout } = getPlotlyProps();

    const lapAnnotation = layout.annotations.find(
      (a: any) => a.text && a.text.includes('LAP 2'),
    );
    expect(lapAnnotation).toBeDefined();
    expect(lapAnnotation.font.color).toBe('#e10600');
  });

  it('no current lap marker in non-replay mode', () => {
    render(<GapChart data={mockData} />);
    const { layout } = getPlotlyProps();

    // Only the zero line shape + pit stop lines should be present (no extra marker)
    const redDotLines = layout.shapes.filter(
      (s: any) => s.line?.color === '#e10600' && s.line?.dash === 'dot',
    );
    // Only the zero line has this color+dash
    expect(redDotLines.length).toBe(1);
    // No LAP annotation
    const lapAnnotation = layout.annotations.find(
      (a: any) => a.text && a.text.startsWith('LAP '),
    );
    expect(lapAnnotation).toBeUndefined();
  });
});

// ── Latest point highlight ──────────────────────────────────────────

describe('GapChart — Latest Point Highlight', () => {
  it('renders a highlight marker trace for the latest point in replay mode', () => {
    render(<GapChart data={mockData} visibleLap={2} />);
    const { traces } = getPlotlyProps();

    const highlightTrace = traces.find(
      (t: any) => t.name === 'Current Lap',
    );
    expect(highlightTrace).toBeDefined();
    expect(highlightTrace.x).toEqual([2]);
    expect(highlightTrace.y).toEqual([2.3]);
    expect(highlightTrace.marker.size).toBe(14);
    expect(highlightTrace.marker.opacity).toBe(0.4);
  });

  it('highlight marker updates when visibleLap advances', () => {
    const { rerender } = render(<GapChart data={mockData} visibleLap={1} />);
    let { traces } = getPlotlyProps();

    let highlight = traces.find((t: any) => t.name === 'Current Lap');
    expect(highlight.x).toEqual([1]);
    expect(highlight.y).toEqual([1.5]);

    rerender(<GapChart data={mockData} visibleLap={3} />);
    ({ traces } = getPlotlyProps());
    highlight = traces.find((t: any) => t.name === 'Current Lap');
    expect(highlight.x).toEqual([3]);
    expect(highlight.y).toEqual([-0.5]);
  });

  it('no highlight marker trace in non-replay mode', () => {
    render(<GapChart data={mockData} />);
    const { traces } = getPlotlyProps();

    const highlightTrace = traces.find(
      (t: any) => t.name === 'Current Lap',
    );
    expect(highlightTrace).toBeUndefined();
  });

  it('line trace markers are larger for the latest point in replay mode', () => {
    render(<GapChart data={mockData} visibleLap={3} />);
    const { traces } = getPlotlyProps();

    const lineTrace = traces[1];
    expect(lineTrace.type).toBe('scatter');
    // 3 points visible: sizes should be [6, 6, 10] (latest is 10)
    expect(lineTrace.marker.size).toEqual([6, 6, 10]);
    // Latest marker line should be white/wider
    expect(lineTrace.marker.line.color[2]).toBe('#ffffff');
    expect(lineTrace.marker.line.width[2]).toBe(3);
  });
});

// ── Gap Trend Indicator ──────────────────────────────────────────────

describe('GapChart — Gap Trend Indicator', () => {
  it('shows "Growing" when absolute gap increases between last two points', () => {
    // Lap 1: |1.5|, Lap 2: |2.3| → gap growing
    render(<GapChart data={mockData} visibleLap={2} />);

    expect(screen.getByText('Trend')).toBeInTheDocument();
    expect(screen.getByTestId('trend-arrow-growing')).toBeInTheDocument();
    expect(screen.getByText('Growing')).toBeInTheDocument();
  });

  it('shows "Closing" when absolute gap decreases between last two points', () => {
    // Lap 2: |2.3|, Lap 3: |-0.5| = 0.5 → gap shrinking
    render(<GapChart data={mockData} visibleLap={3} />);

    expect(screen.getByTestId('trend-arrow-shrinking')).toBeInTheDocument();
    expect(screen.getByText('Closing')).toBeInTheDocument();
  });

  it('does not show trend with only one point', () => {
    render(<GapChart data={mockData} visibleLap={1} />);

    expect(screen.queryByTestId('gap-trend')).not.toBeInTheDocument();
  });

  it('trend updates when visibleLap changes', () => {
    const { rerender } = render(<GapChart data={mockData} visibleLap={2} />);
    expect(screen.getByText('Growing')).toBeInTheDocument();

    // Advance to lap 3: gap shrinks from |2.3| to |0.5|
    rerender(<GapChart data={mockData} visibleLap={3} />);
    expect(screen.getByText('Closing')).toBeInTheDocument();
  });

  it('shows "Stable" when gap change is within threshold', () => {
    const stableData: GapChartData = {
      ...mockData,
      points: [
        {
          lap_number: 1,
          gap_seconds: 1.5,
          driver1_position: 1,
          driver2_position: 2,
          driver1_lap_time_s: 95.0,
          driver2_lap_time_s: 96.5,
          gap_change: null,
          is_pit_lap_d1: false,
          is_pit_lap_d2: false,
        },
        {
          lap_number: 2,
          gap_seconds: 1.52, // Only 0.02s change — within 0.05s threshold
          driver1_position: 1,
          driver2_position: 2,
          driver1_lap_time_s: 93.0,
          driver2_lap_time_s: 93.02,
          gap_change: 0.02,
          is_pit_lap_d1: false,
          is_pit_lap_d2: false,
        },
      ],
    };
    render(<GapChart data={stableData} visibleLap={2} />);

    expect(screen.getByTestId('trend-arrow-stable')).toBeInTheDocument();
    expect(screen.getByText('Stable')).toBeInTheDocument();
  });
});

// ── Replay Mode Indicator ───────────────────────────────────────────

describe('GapChart — Replay Mode Indicator', () => {
  it('shows replay indicator banner with current lap and total laps', () => {
    render(<GapChart data={mockData} visibleLap={3} totalLaps={57} />);

    const indicator = screen.getByTestId('replay-mode-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveTextContent('REPLAY');
    expect(indicator).toHaveTextContent('Lap 3 of 57');
  });

  it('uses data.total_laps when totalLaps prop not provided', () => {
    render(<GapChart data={mockData} visibleLap={3} />);

    const indicator = screen.getByTestId('replay-mode-indicator');
    expect(indicator).toHaveTextContent('Lap 3 of 57');
  });

  it('no replay indicator in non-replay mode', () => {
    render(<GapChart data={mockData} />);
    expect(screen.queryByTestId('replay-mode-indicator')).not.toBeInTheDocument();
  });

  it('replay indicator updates when visibleLap advances', () => {
    const { rerender } = render(<GapChart data={mockData} visibleLap={1} totalLaps={57} />);
    expect(screen.getByTestId('replay-mode-indicator')).toHaveTextContent('Lap 1 of 57');

    rerender(<GapChart data={mockData} visibleLap={4} totalLaps={57} />);
    expect(screen.getByTestId('replay-mode-indicator')).toHaveTextContent('Lap 4 of 57');
  });

  it('no replay indicator when visibleLap is 0 (empty state)', () => {
    render(<GapChart data={mockData} visibleLap={0} />);
    expect(screen.queryByTestId('replay-mode-indicator')).not.toBeInTheDocument();
  });
});

// ── Plotly Transition Config ────────────────────────────────────────

describe('GapChart — Plotly Transitions', () => {
  it('includes transition config in replay mode for smooth animation', () => {
    render(<GapChart data={mockData} visibleLap={2} />);
    const { layout } = getPlotlyProps();

    expect(layout.transition).toBeDefined();
    expect(layout.transition.duration).toBe(300);
    expect(layout.transition.easing).toBe('cubic-in-out');
  });

  it('no transition config in non-replay mode', () => {
    render(<GapChart data={mockData} />);
    const { layout } = getPlotlyProps();

    expect(layout.transition).toBeUndefined();
  });
});

// ── Dynamic X-Axis Range ────────────────────────────────────────────

describe('GapChart — Dynamic X-Axis Range', () => {
  it('applies scrolling x-axis range when visibleLap exceeds window size', () => {
    // Create data with many laps
    const manyLapsData: GapChartData = {
      ...mockData,
      total_laps: 57,
      points: Array.from({ length: 30 }, (_, i) => ({
        lap_number: i + 1,
        gap_seconds: Math.sin(i * 0.3) * 3,
        driver1_position: 1,
        driver2_position: 2,
        driver1_lap_time_s: 93.0 + Math.random(),
        driver2_lap_time_s: 93.5 + Math.random(),
        gap_change: i > 0 ? 0.1 : null,
        is_pit_lap_d1: false,
        is_pit_lap_d2: false,
      })),
    };

    render(<GapChart data={manyLapsData} visibleLap={25} totalLaps={57} />);
    const { layout } = getPlotlyProps();

    // When at lap 25, window should scroll: [25 - 20, 25 + 2] = [5, 27]
    expect(layout.xaxis.range).toEqual([5, 27]);
  });

  it('does not scroll x-axis early in the race', () => {
    render(<GapChart data={mockData} visibleLap={3} totalLaps={57} />);
    const { layout } = getPlotlyProps();

    // At lap 3, window should be [0, min(21, 58)] = [0, 21]
    expect(layout.xaxis.range).toEqual([0, 21]);
  });

  it('no custom x-axis range in non-replay mode', () => {
    render(<GapChart data={mockData} />);
    const { layout } = getPlotlyProps();

    // Should not have a range set on xaxis (Plotly auto-ranges)
    expect(layout.xaxis.range).toBeUndefined();
  });
});
