/**
 * Tests for ReplayContext — verifies that replay timer state updates
 * propagate through the context to both the standings board and gap chart.
 *
 * Tests cover:
 * 1. Context provides replay state to consumers
 * 2. Lap advance triggers re-render in all consuming components
 * 3. Jump-to-lap updates both standings and gap chart via context
 * 4. Driver selection changes propagate through context
 * 5. Consumer hooks work correctly
 * 6. Error thrown when used outside provider
 */

import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import {
  ReplayProvider,
  useReplayContext,
  useReplayState,
  useReplayControlsFromContext,
  useDashboardData,
  useDashboardActions,
} from './ReplayContext';
import * as api from '../api/client';
import type { LoadSessionResponse, SessionLapData, LapDurationsResponse, GapChartData, StandingsBoardResponse } from '../types';

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
  ],
  laps: [
    { driver: 'VER', lap_number: 1, lap_time_ms: 95000, position: 1, sector1_ms: null, sector2_ms: null, sector3_ms: null, compound: 'MEDIUM', tyre_life: 1, is_pit_out_lap: false, is_pit_in_lap: false, elapsed_ms: 95000 },
    { driver: 'HAM', lap_number: 1, lap_time_ms: 96500, position: 2, sector1_ms: null, sector2_ms: null, sector3_ms: null, compound: 'SOFT', tyre_life: 1, is_pit_out_lap: false, is_pit_in_lap: false, elapsed_ms: 96500 },
    { driver: 'VER', lap_number: 2, lap_time_ms: 93000, position: 1, sector1_ms: null, sector2_ms: null, sector3_ms: null, compound: 'MEDIUM', tyre_life: 2, is_pit_out_lap: false, is_pit_in_lap: false, elapsed_ms: 188000 },
    { driver: 'HAM', lap_number: 2, lap_time_ms: 93800, position: 2, sector1_ms: null, sector2_ms: null, sector3_ms: null, compound: 'SOFT', tyre_life: 2, is_pit_out_lap: false, is_pit_in_lap: false, elapsed_ms: 190300 },
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

// ── Helper: Test consumer component that displays context state ───

const TestConsumer: React.FC = () => {
  const { replayState, dashboard } = useReplayContext();
  return (
    <div>
      <span data-testid="status">{replayState.status}</span>
      <span data-testid="current-lap">{replayState.currentLap}</span>
      <span data-testid="total-laps">{replayState.totalLaps}</span>
      <span data-testid="speed">{replayState.speed}</span>
      <span data-testid="standings-count">{dashboard.standings.length}</span>
      <span data-testid="has-gap-data">{dashboard.gapData ? 'yes' : 'no'}</span>
      <span data-testid="driver1">{dashboard.driver1}</span>
      <span data-testid="driver2">{dashboard.driver2}</span>
      <span data-testid="data-loading">{String(dashboard.dataLoading)}</span>
    </div>
  );
};

/** Component that also renders controls to interact with context. */
const TestConsumerWithControls: React.FC = () => {
  const { replayState, replayControls, dashboard, actions } = useReplayContext();
  return (
    <div>
      <span data-testid="status">{replayState.status}</span>
      <span data-testid="current-lap">{replayState.currentLap}</span>
      <span data-testid="standings-count">{dashboard.standings.length}</span>
      <span data-testid="has-gap-data">{dashboard.gapData ? 'yes' : 'no'}</span>
      <span data-testid="driver1">{dashboard.driver1}</span>
      <span data-testid="driver2">{dashboard.driver2}</span>
      <button data-testid="play-btn" onClick={replayControls.play}>Play</button>
      <button data-testid="pause-btn" onClick={replayControls.pause}>Pause</button>
      <button data-testid="reset-btn" onClick={replayControls.reset}>Reset</button>
      <button data-testid="jump-btn" onClick={() => actions.jumpToLap(2)}>Jump to 2</button>
      <button data-testid="set-drivers-btn" onClick={() => actions.setDrivers('HAM', 'VER')}>Switch Drivers</button>
    </div>
  );
};

// ── Tests ──────────────────────────────────────────────────────────

describe('ReplayContext', () => {
  describe('Provider initialization', () => {
    it('provides initial replay state to consumers', async () => {
      render(
        <ReplayProvider session={mockSession}>
          <TestConsumer />
        </ReplayProvider>,
      );

      // Initially loading, then ready after initialization
      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('ready');
      });

      expect(screen.getByTestId('current-lap').textContent).toBe('0');
      expect(screen.getByTestId('total-laps').textContent).toBe('57');
      expect(screen.getByTestId('speed').textContent).toBe('1');
    });

    it('fetches lap data and initializes replay timer on mount', async () => {
      render(
        <ReplayProvider session={mockSession}>
          <TestConsumer />
        </ReplayProvider>,
      );

      await waitFor(() => {
        expect(mockedApi.fetchSessionLapData).toHaveBeenCalledWith('2024::Bahrain::Race');
        expect(mockedApi.fetchLapDurations).toHaveBeenCalledWith('2024::Bahrain::Race');
      });
    });

    it('auto-selects first two drivers for gap chart', async () => {
      render(
        <ReplayProvider session={mockSession}>
          <TestConsumer />
        </ReplayProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('driver1').textContent).toBe('VER');
        expect(screen.getByTestId('driver2').textContent).toBe('HAM');
      });
    });

    it('fetches gap chart data after drivers are auto-selected', async () => {
      render(
        <ReplayProvider session={mockSession}>
          <TestConsumer />
        </ReplayProvider>,
      );

      await waitFor(() => {
        expect(mockedApi.fetchGapChart).toHaveBeenCalledWith(
          '2024::Bahrain::Race',
          'VER',
          'HAM',
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('has-gap-data').textContent).toBe('yes');
      });
    });
  });

  describe('State propagation to consumers', () => {
    it('emits standings updates when currentLap changes via jumpToLap', async () => {
      render(
        <ReplayProvider session={mockSession}>
          <TestConsumerWithControls />
        </ReplayProvider>,
      );

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('ready');
      });

      // At lap 0, standings should be empty
      expect(screen.getByTestId('standings-count').textContent).toBe('0');

      // Jump to lap 2 — this triggers standings re-computation
      fireEvent.click(screen.getByTestId('jump-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('current-lap').textContent).toBe('2');
      });

      // After jump to lap 2, standings should have entries (from server re-sync or client-side)
      await waitFor(() => {
        const count = parseInt(screen.getByTestId('standings-count').textContent || '0');
        expect(count).toBeGreaterThan(0);
      });
    });

    it('both standings and gap data update simultaneously on lap change', async () => {
      render(
        <ReplayProvider session={mockSession}>
          <TestConsumerWithControls />
        </ReplayProvider>,
      );

      // Wait for initialization and gap data
      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('ready');
        expect(screen.getByTestId('has-gap-data').textContent).toBe('yes');
      });

      // Jump to lap 2
      fireEvent.click(screen.getByTestId('jump-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('current-lap').textContent).toBe('2');
        // Gap data should still be available
        expect(screen.getByTestId('has-gap-data').textContent).toBe('yes');
        // Standings should be populated
        const count = parseInt(screen.getByTestId('standings-count').textContent || '0');
        expect(count).toBeGreaterThan(0);
      });
    });

    it('driver selection change propagates through context', async () => {
      render(
        <ReplayProvider session={mockSession}>
          <TestConsumerWithControls />
        </ReplayProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('driver1').textContent).toBe('VER');
        expect(screen.getByTestId('driver2').textContent).toBe('HAM');
      });

      // Switch drivers
      fireEvent.click(screen.getByTestId('set-drivers-btn'));

      expect(screen.getByTestId('driver1').textContent).toBe('HAM');
      expect(screen.getByTestId('driver2').textContent).toBe('VER');

      // Gap chart should be re-fetched with new driver order
      await waitFor(() => {
        expect(mockedApi.fetchGapChart).toHaveBeenCalledWith(
          '2024::Bahrain::Race',
          'HAM',
          'VER',
        );
      });
    });
  });

  describe('Replay controls via context', () => {
    it('play/pause controls work through context', async () => {
      jest.useFakeTimers();

      render(
        <ReplayProvider session={mockSession}>
          <TestConsumerWithControls />
        </ReplayProvider>,
      );

      // Wait for ready
      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('ready');
      });

      // Play
      act(() => {
        fireEvent.click(screen.getByTestId('play-btn'));
      });
      expect(screen.getByTestId('status').textContent).toBe('playing');

      // Pause
      act(() => {
        fireEvent.click(screen.getByTestId('pause-btn'));
      });
      expect(screen.getByTestId('status').textContent).toBe('paused');

      jest.useRealTimers();
    });

    it('reset returns to lap 0', async () => {
      render(
        <ReplayProvider session={mockSession}>
          <TestConsumerWithControls />
        </ReplayProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('ready');
      });

      // Jump to lap 2
      fireEvent.click(screen.getByTestId('jump-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('current-lap').textContent).toBe('2');
      });

      // Reset
      fireEvent.click(screen.getByTestId('reset-btn'));
      expect(screen.getByTestId('current-lap').textContent).toBe('0');
    });
  });

  describe('Consumer hooks', () => {
    it('useReplayContext throws when used outside provider', () => {
      // Suppress console.error for expected error
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const BadComponent = () => {
        useReplayContext();
        return <div />;
      };

      expect(() => render(<BadComponent />)).toThrow(
        'useReplayContext must be used within a <ReplayProvider>',
      );

      spy.mockRestore();
    });

    it('useReplayState returns only state', async () => {
      const StateReader: React.FC = () => {
        const state = useReplayState();
        return <span data-testid="hook-status">{state.status}</span>;
      };

      render(
        <ReplayProvider session={mockSession}>
          <StateReader />
        </ReplayProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('hook-status').textContent).toBe('ready');
      });
    });

    it('useDashboardData returns dashboard data', async () => {
      const DataReader: React.FC = () => {
        const data = useDashboardData();
        return (
          <div>
            <span data-testid="d-driver1">{data.driver1}</span>
            <span data-testid="d-loading">{String(data.dataLoading)}</span>
          </div>
        );
      };

      render(
        <ReplayProvider session={mockSession}>
          <DataReader />
        </ReplayProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('d-driver1').textContent).toBe('VER');
        expect(screen.getByTestId('d-loading').textContent).toBe('false');
      });
    });

    it('useDashboardActions returns action handlers', async () => {
      const ActionUser: React.FC = () => {
        const actions = useDashboardActions();
        const data = useDashboardData();
        return (
          <div>
            <span data-testid="a-driver1">{data.driver1}</span>
            <button data-testid="a-set" onClick={() => actions.setDrivers('LEC', 'NOR')}>Set</button>
          </div>
        );
      };

      render(
        <ReplayProvider session={mockSession}>
          <ActionUser />
        </ReplayProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('a-driver1').textContent).toBe('VER');
      });

      fireEvent.click(screen.getByTestId('a-set'));
      expect(screen.getByTestId('a-driver1').textContent).toBe('LEC');
    });

    it('useReplayControlsFromContext returns controls', async () => {
      const ControlUser: React.FC = () => {
        const controls = useReplayControlsFromContext();
        const state = useReplayState();
        return (
          <div>
            <span data-testid="c-status">{state.status}</span>
            <button data-testid="c-play" onClick={controls.play}>Play</button>
          </div>
        );
      };

      jest.useFakeTimers();

      render(
        <ReplayProvider session={mockSession}>
          <ControlUser />
        </ReplayProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('c-status').textContent).toBe('ready');
      });

      act(() => {
        fireEvent.click(screen.getByTestId('c-play'));
      });
      expect(screen.getByTestId('c-status').textContent).toBe('playing');

      jest.useRealTimers();
    });
  });

  describe('Callback props', () => {
    it('calls onReplayStart when startReplay action is invoked', async () => {
      const onStart = jest.fn();

      // Ensure real timers are active (previous test may have used fakeTimers)
      jest.useRealTimers();

      const StartConsumer: React.FC = () => {
        const actions = useDashboardActions();
        const state = useReplayState();
        return (
          <div>
            <span data-testid="cb-status">{state.status}</span>
            <button data-testid="start" onClick={actions.startReplay}>Start</button>
          </div>
        );
      };

      render(
        <ReplayProvider session={mockSession} onReplayStart={onStart}>
          <StartConsumer />
        </ReplayProvider>,
      );

      // Wait for the replay timer to be ready (async initialization)
      await waitFor(() => {
        expect(screen.getByTestId('cb-status').textContent).toBe('ready');
      }, { timeout: 3000 });

      act(() => {
        fireEvent.click(screen.getByTestId('start'));
      });
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('calls onReplayEnd when endReplay action is invoked', async () => {
      const onEnd = jest.fn();

      // Ensure real timers are active
      jest.useRealTimers();

      const EndConsumer: React.FC = () => {
        const actions = useDashboardActions();
        const state = useReplayState();
        return (
          <div>
            <span data-testid="cb-status">{state.status}</span>
            <button data-testid="end" onClick={actions.endReplay}>End</button>
          </div>
        );
      };

      render(
        <ReplayProvider session={mockSession} onReplayEnd={onEnd}>
          <EndConsumer />
        </ReplayProvider>,
      );

      // Wait for the replay timer to be ready (async initialization)
      await waitFor(() => {
        expect(screen.getByTestId('cb-status').textContent).toBe('ready');
      }, { timeout: 3000 });

      act(() => {
        fireEvent.click(screen.getByTestId('end'));
      });
      expect(onEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe('Multiple consumers', () => {
    it('multiple consumer components all receive the same state updates', async () => {
      const Consumer1: React.FC = () => {
        const state = useReplayState();
        return <span data-testid="c1-lap">{state.currentLap}</span>;
      };

      const Consumer2: React.FC = () => {
        const state = useReplayState();
        return <span data-testid="c2-lap">{state.currentLap}</span>;
      };

      const Consumer3: React.FC = () => {
        const data = useDashboardData();
        return <span data-testid="c3-standings">{data.standings.length}</span>;
      };

      const JumpButton: React.FC = () => {
        const actions = useDashboardActions();
        return <button data-testid="multi-jump" onClick={() => actions.jumpToLap(1)}>Jump</button>;
      };

      render(
        <ReplayProvider session={mockSession}>
          <Consumer1 />
          <Consumer2 />
          <Consumer3 />
          <JumpButton />
        </ReplayProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('c1-lap').textContent).toBe('0');
        expect(screen.getByTestId('c2-lap').textContent).toBe('0');
        expect(screen.getByTestId('c3-standings').textContent).toBe('0');
      });

      // Jump to lap 1 — all consumers should update
      fireEvent.click(screen.getByTestId('multi-jump'));

      await waitFor(() => {
        expect(screen.getByTestId('c1-lap').textContent).toBe('1');
        expect(screen.getByTestId('c2-lap').textContent).toBe('1');
        // Standings should now have entries (client-side computation)
        const count = parseInt(screen.getByTestId('c3-standings').textContent || '0');
        expect(count).toBeGreaterThan(0);
      });
    });
  });
});
