/**
 * Tests for RaceDashboard — Integration of replay timer with
 * standings board and gap chart components.
 *
 * Verifies that:
 * 1. Start Replay button appears and triggers replay mode transition
 * 2. UI transitions between pre-replay hero and active replay mode
 * 3. Advancing to a new lap triggers updates in both components
 * 4. Jump-to-lap (mid-race re-sync) updates both components
 * 5. Gap chart receives the correct visibleLap prop
 * 6. Standings board receives current lap data
 */

import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import RaceDashboard from './RaceDashboard';
import * as api from '../api/client';
import { LoadSessionResponse, SessionLapData, LapDurationsResponse, GapChartData, StandingsBoardResponse } from '../types';

// Mock API client
jest.mock('../api/client');
const mockedApi = api as jest.Mocked<typeof api>;

// Mock react-plotly.js
jest.mock('react-plotly.js', () => {
  const MockPlot = (props: any) => (
    <div data-testid="plotly-chart" data-traces={JSON.stringify(props.data)} />
  );
  MockPlot.displayName = 'MockPlot';
  return MockPlot;
});

// Mock DriverSelector to avoid raw fetch calls
jest.mock('./DriverSelector', () => {
  const MockDriverSelector = (props: any) => (
    <div data-testid="driver-selector">
      <button
        data-testid="switch-drivers"
        onClick={() => props.onDriversChanged('LEC', 'HAM')}
      >
        Switch Drivers
      </button>
      <span>{props.driver1} vs {props.driver2}</span>
    </div>
  );
  MockDriverSelector.displayName = 'MockDriverSelector';
  return MockDriverSelector;
});

// ── Test data ──────────────────────────────────────────────────────

const mockSession: LoadSessionResponse = {
  status: 'loaded',
  session_key: '2024::Bahrain::Race',
  year: 2024,
  event_name: 'Bahrain Grand Prix',
  session_type: 'Race',
  num_drivers: 20,
  total_laps: 57,
};

const mockLapData: SessionLapData = {
  session_key: '2024::Bahrain::Race',
  year: 2024,
  event_name: 'Bahrain Grand Prix',
  session_type: 'Race',
  total_laps: 57,
  drivers: [
    { abbreviation: 'VER', driver_number: '1', full_name: 'Max Verstappen', team_name: 'Red Bull Racing', team_color: '3671C6' },
    { abbreviation: 'HAM', driver_number: '44', full_name: 'Lewis Hamilton', team_name: 'Mercedes', team_color: '6CD3BF' },
    { abbreviation: 'LEC', driver_number: '16', full_name: 'Charles Leclerc', team_name: 'Ferrari', team_color: 'F91536' },
  ],
  laps: [
    { driver: 'VER', lap_number: 1, lap_time_ms: 95000, position: 1, sector1_ms: null, sector2_ms: null, sector3_ms: null, compound: 'MEDIUM', tyre_life: 1, is_pit_out_lap: false, is_pit_in_lap: false, elapsed_ms: 95000 },
    { driver: 'HAM', lap_number: 1, lap_time_ms: 96500, position: 2, sector1_ms: null, sector2_ms: null, sector3_ms: null, compound: 'SOFT', tyre_life: 1, is_pit_out_lap: false, is_pit_in_lap: false, elapsed_ms: 96500 },
    { driver: 'LEC', lap_number: 1, lap_time_ms: 97000, position: 3, sector1_ms: null, sector2_ms: null, sector3_ms: null, compound: 'MEDIUM', tyre_life: 1, is_pit_out_lap: false, is_pit_in_lap: false, elapsed_ms: 97000 },
    { driver: 'VER', lap_number: 2, lap_time_ms: 93000, position: 1, sector1_ms: null, sector2_ms: null, sector3_ms: null, compound: 'MEDIUM', tyre_life: 2, is_pit_out_lap: false, is_pit_in_lap: false, elapsed_ms: 188000 },
    { driver: 'HAM', lap_number: 2, lap_time_ms: 93800, position: 2, sector1_ms: null, sector2_ms: null, sector3_ms: null, compound: 'SOFT', tyre_life: 2, is_pit_out_lap: false, is_pit_in_lap: false, elapsed_ms: 190300 },
    { driver: 'LEC', lap_number: 2, lap_time_ms: 94000, position: 3, sector1_ms: null, sector2_ms: null, sector3_ms: null, compound: 'MEDIUM', tyre_life: 2, is_pit_out_lap: false, is_pit_in_lap: false, elapsed_ms: 191000 },
    { driver: 'VER', lap_number: 3, lap_time_ms: 92500, position: 1, sector1_ms: null, sector2_ms: null, sector3_ms: null, compound: 'MEDIUM', tyre_life: 3, is_pit_out_lap: false, is_pit_in_lap: false, elapsed_ms: 280500 },
    { driver: 'LEC', lap_number: 3, lap_time_ms: 93200, position: 2, sector1_ms: null, sector2_ms: null, sector3_ms: null, compound: 'MEDIUM', tyre_life: 3, is_pit_out_lap: false, is_pit_in_lap: false, elapsed_ms: 284200 },
    { driver: 'HAM', lap_number: 3, lap_time_ms: 93500, position: 3, sector1_ms: null, sector2_ms: null, sector3_ms: null, compound: 'SOFT', tyre_life: 3, is_pit_out_lap: false, is_pit_in_lap: false, elapsed_ms: 283800 },
  ],
};

const mockLapDurations: LapDurationsResponse = {
  session_key: '2024::Bahrain::Race',
  year: 2024,
  event_name: 'Bahrain Grand Prix',
  session_type: 'Race',
  total_laps: 57,
  lap_durations: [
    { lap_number: 1, duration_seconds: 0.05 },
    { lap_number: 2, duration_seconds: 0.05 },
    { lap_number: 3, duration_seconds: 0.05 },
  ],
};

const mockGapData: GapChartData = {
  session_key: '2024::Bahrain::Race',
  driver1: 'VER',
  driver2: 'HAM',
  driver1_color: '3671C6',
  driver2_color: '6CD3BF',
  driver1_name: 'Max Verstappen',
  driver2_name: 'Lewis Hamilton',
  total_laps: 57,
  points: [
    { lap_number: 1, gap_seconds: 1.5, driver1_position: 1, driver2_position: 2, driver1_lap_time_s: 95.0, driver2_lap_time_s: 96.5, gap_change: null, is_pit_lap_d1: false, is_pit_lap_d2: false },
    { lap_number: 2, gap_seconds: 2.3, driver1_position: 1, driver2_position: 2, driver1_lap_time_s: 93.0, driver2_lap_time_s: 93.8, gap_change: 0.8, is_pit_lap_d1: false, is_pit_lap_d2: false },
    { lap_number: 3, gap_seconds: 3.3, driver1_position: 1, driver2_position: 3, driver1_lap_time_s: 92.5, driver2_lap_time_s: 93.5, gap_change: 1.0, is_pit_lap_d1: false, is_pit_lap_d2: false },
  ],
};

const mockStandingsResponse: StandingsBoardResponse = {
  session_key: '2024::Bahrain::Race',
  year: 2024,
  event_name: 'Bahrain Grand Prix',
  session_type: 'Race',
  lap_number: 2,
  total_laps: 57,
  standings: [
    { position: 1, driver: 'VER', driver_number: '1', full_name: 'Max Verstappen', team: 'Red Bull Racing', team_color: '3671C6', gap_to_leader: 'LEADER', interval: 'LEADER', last_lap_time: '1:33.000', tire_compound: 'MEDIUM', tire_age: 2, pit_stops: 0, has_fastest_lap: true },
    { position: 2, driver: 'HAM', driver_number: '44', full_name: 'Lewis Hamilton', team: 'Mercedes', team_color: '6CD3BF', gap_to_leader: '+2.300', interval: '+2.300', last_lap_time: '1:33.800', tire_compound: 'SOFT', tire_age: 2, pit_stops: 0, has_fastest_lap: false },
    { position: 3, driver: 'LEC', driver_number: '16', full_name: 'Charles Leclerc', team: 'Ferrari', team_color: 'F91536', gap_to_leader: '+3.000', interval: '+0.700', last_lap_time: '1:34.000', tire_compound: 'MEDIUM', tire_age: 2, pit_stops: 0, has_fastest_lap: false },
  ],
};

// ── Setup ──────────────────────────────────────────────────────────

beforeEach(() => {
  mockedApi.fetchSessionLapData.mockResolvedValue(mockLapData);
  mockedApi.fetchLapDurations.mockResolvedValue(mockLapDurations);
  mockedApi.fetchGapChart.mockResolvedValue(mockGapData);
  mockedApi.fetchStandings.mockResolvedValue(mockStandingsResponse);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────

describe('RaceDashboard', () => {
  // ── Pre-replay mode: Start Replay hero ────────────────────────────

  it('renders session info and fetches data on mount', async () => {
    render(<RaceDashboard session={mockSession} />);

    await waitFor(() => {
      expect(mockedApi.fetchSessionLapData).toHaveBeenCalledWith('2024::Bahrain::Race');
      expect(mockedApi.fetchLapDurations).toHaveBeenCalledWith('2024::Bahrain::Race');
    });

    expect(screen.getByText('Bahrain Grand Prix')).toBeInTheDocument();
    expect(screen.getByText('Race')).toBeInTheDocument();
  });

  it('shows Start Replay hero when loaded but not replaying', async () => {
    render(<RaceDashboard session={mockSession} />);

    await waitFor(() => {
      expect(screen.getByTestId('start-replay-hero')).toBeInTheDocument();
    });

    expect(screen.getByTestId('start-replay-btn')).toBeInTheDocument();
    expect(screen.getByText('Start Replay')).toBeInTheDocument();
  });

  it('shows session details in Start Replay hero', async () => {
    render(<RaceDashboard session={mockSession} />);

    await waitFor(() => {
      expect(screen.getByTestId('start-replay-hero')).toBeInTheDocument();
    });

    expect(screen.getByText(/57 laps/)).toBeInTheDocument();
    expect(screen.getByText(/20 drivers/)).toBeInTheDocument();
    expect(screen.getByText(/2024 season/)).toBeInTheDocument();
  });

  it('does not show replay controls or standings in pre-replay mode', async () => {
    render(<RaceDashboard session={mockSession} />);

    await waitFor(() => {
      expect(screen.getByTestId('start-replay-hero')).toBeInTheDocument();
    });

    expect(screen.queryByText('LIGHTS OUT')).not.toBeInTheDocument();
    expect(screen.queryByText('RACE STANDINGS')).not.toBeInTheDocument();
    expect(screen.queryByTestId('end-replay-btn')).not.toBeInTheDocument();
  });

  it('Start Replay button calls onReplayStart callback', async () => {
    const onReplayStart = jest.fn();
    render(
      <RaceDashboard session={mockSession} onReplayStart={onReplayStart} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('start-replay-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('start-replay-btn'));
    expect(onReplayStart).toHaveBeenCalledTimes(1);
  });

  it('Start Replay button has correct aria-label', async () => {
    render(<RaceDashboard session={mockSession} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Start race replay')).toBeInTheDocument();
    });
  });

  // ── Active replay mode (isReplaying=true) ─────────────────────────

  it('renders replay controls and standings when isReplaying is true', async () => {
    render(<RaceDashboard session={mockSession} isReplaying={true} />);

    await waitFor(() => {
      expect(screen.getByText('RACE STANDINGS')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Start replay')).toBeInTheDocument();
    expect(screen.queryByTestId('start-replay-hero')).not.toBeInTheDocument();
  });

  it('shows End Replay button during active replay', async () => {
    const onReplayEnd = jest.fn();
    render(
      <RaceDashboard session={mockSession} isReplaying={true} onReplayEnd={onReplayEnd} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('end-replay-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('end-replay-btn'));
    expect(onReplayEnd).toHaveBeenCalledTimes(1);
  });

  it('renders standings board that starts empty at lap 0', async () => {
    render(<RaceDashboard session={mockSession} isReplaying={true} />);

    await waitFor(() => {
      expect(screen.getByText('RACE STANDINGS')).toBeInTheDocument();
    });

    expect(screen.getByText('No standings data available')).toBeInTheDocument();
  });

  it('supports jump-to-lap — standings update when slider changes', async () => {
    render(<RaceDashboard session={mockSession} isReplaying={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Jump to lap')).toBeInTheDocument();
    });

    const slider = screen.getByLabelText('Jump to lap');
    fireEvent.change(slider, { target: { value: '2' } });

    await waitFor(() => {
      const verElements = screen.getAllByText('VER');
      expect(verElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('both standings and gap chart update when jumping to a different lap', async () => {
    render(<RaceDashboard session={mockSession} isReplaying={true} />);

    await waitFor(() => {
      expect(screen.getByText('Gap Chart')).toBeInTheDocument();
      expect(screen.getByText('RACE STANDINGS')).toBeInTheDocument();
    });

    expect(screen.getByText('No standings data available')).toBeInTheDocument();

    const slider = screen.getByLabelText('Jump to lap');
    fireEvent.change(slider, { target: { value: '2' } });

    await waitFor(() => {
      expect(screen.getByText('Current Gap')).toBeInTheDocument();
      expect(screen.getByText('Leader')).toBeInTheDocument();
    });
  });

  it('gap chart renders with visibleLap after jump', async () => {
    render(<RaceDashboard session={mockSession} isReplaying={true} />);

    await waitFor(() => {
      expect(screen.getByText('Gap Chart')).toBeInTheDocument();
    });

    const slider = screen.getByLabelText('Jump to lap');
    fireEvent.change(slider, { target: { value: '2' } });

    await waitFor(() => {
      expect(screen.getByText('Current Gap')).toBeInTheDocument();
    });
  });

  it('auto-selects first two drivers for gap chart', async () => {
    render(<RaceDashboard session={mockSession} isReplaying={true} />);

    await waitFor(() => {
      expect(mockedApi.fetchGapChart).toHaveBeenCalledWith(
        '2024::Bahrain::Race',
        'VER',
        'HAM',
      );
    });
  });

  it('fetches new gap chart data when drivers change', async () => {
    render(<RaceDashboard session={mockSession} isReplaying={true} />);

    await waitFor(() => {
      expect(mockedApi.fetchGapChart).toHaveBeenCalledTimes(1);
    });

    const switchBtn = screen.getByTestId('switch-drivers');
    fireEvent.click(switchBtn);

    await waitFor(() => {
      expect(mockedApi.fetchGapChart).toHaveBeenCalledWith(
        '2024::Bahrain::Race',
        'LEC',
        'HAM',
      );
    });
  });

  it('replay play button advances laps and updates components', async () => {
    render(<RaceDashboard session={mockSession} isReplaying={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Start replay')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Start replay'));

    await waitFor(
      () => {
        const verElements = screen.getAllByText('VER');
        expect(verElements.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 3000 },
    );
  });

  it('lap counter reflects current replay position', async () => {
    render(<RaceDashboard session={mockSession} isReplaying={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Jump to lap')).toBeInTheDocument();
    });

    const slider = screen.getByLabelText('Jump to lap');
    fireEvent.change(slider, { target: { value: '3' } });

    await waitFor(() => {
      const lapValues = screen.getAllByText('3');
      expect(lapValues.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows driver selector when lap data is loaded and replaying', async () => {
    render(<RaceDashboard session={mockSession} isReplaying={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('driver-selector')).toBeInTheDocument();
    });
  });
});
