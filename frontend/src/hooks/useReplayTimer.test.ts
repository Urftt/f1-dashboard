/**
 * Tests for the useReplayTimer hook.
 *
 * Verifies:
 * - Initialization from backend lap durations
 * - Play/pause/resume lifecycle
 * - Lap advancement timing matches lap durations
 * - Jump-to-lap (mid-race re-sync)
 * - Speed multiplier changes
 * - Reset behavior
 * - Edge cases (finish, restart after finish)
 */

import { renderHook, act } from '@testing-library/react';
import { useReplayTimer } from './useReplayTimer';
import * as client from '../api/client';

// Mock the API client
jest.mock('../api/client');
const mockFetchLapDurations = client.fetchLapDurations as jest.MockedFunction<typeof client.fetchLapDurations>;

describe('useReplayTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockLapDurationsResponse = {
    session_key: '2024::Bahrain::Race',
    year: 2024,
    event_name: 'Bahrain Grand Prix',
    session_type: 'Race',
    total_laps: 5,
    lap_durations: [
      { lap_number: 1, duration_seconds: 95.0 },
      { lap_number: 2, duration_seconds: 90.5 },
      { lap_number: 3, duration_seconds: 91.2 },
      { lap_number: 4, duration_seconds: 89.8 },
      { lap_number: 5, duration_seconds: 92.1 },
    ],
  };

  it('starts in idle status', () => {
    const { result } = renderHook(() => useReplayTimer());
    const [state] = result.current;

    expect(state.status).toBe('idle');
    expect(state.currentLap).toBe(0);
    expect(state.totalLaps).toBe(0);
    expect(state.speed).toBe(1);
  });

  it('initializes by fetching lap durations', async () => {
    mockFetchLapDurations.mockResolvedValue(mockLapDurationsResponse);

    const { result } = renderHook(() => useReplayTimer());

    act(() => {
      result.current[1].initialize('2024::Bahrain::Race');
    });

    expect(result.current[0].status).toBe('loading');

    // Flush the promise
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current[0].status).toBe('ready');
    expect(result.current[0].totalLaps).toBe(5);
    expect(result.current[0].lapDurations).toEqual([95.0, 90.5, 91.2, 89.8, 92.1]);
    expect(result.current[0].currentLap).toBe(0);
  });

  it('handles initialization error', async () => {
    mockFetchLapDurations.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useReplayTimer());

    act(() => {
      result.current[1].initialize('2024::Bahrain::Race');
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current[0].status).toBe('error');
    expect(result.current[0].error).toBe('Network error');
  });

  it('advances laps using real lap durations', async () => {
    mockFetchLapDurations.mockResolvedValue(mockLapDurationsResponse);

    const { result } = renderHook(() => useReplayTimer());

    // Initialize
    act(() => {
      result.current[1].initialize('2024::Bahrain::Race');
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Start playing
    act(() => {
      result.current[1].play();
    });
    expect(result.current[0].status).toBe('playing');
    expect(result.current[0].currentLap).toBe(0);

    // Advance through lap 1 (95 seconds = 95000ms)
    act(() => {
      jest.advanceTimersByTime(95000);
    });
    expect(result.current[0].currentLap).toBe(1);
    expect(result.current[0].status).toBe('playing');

    // Advance through lap 2 (90.5 seconds = 90500ms)
    act(() => {
      jest.advanceTimersByTime(90500);
    });
    expect(result.current[0].currentLap).toBe(2);
  });

  it('pauses and resumes correctly', async () => {
    mockFetchLapDurations.mockResolvedValue(mockLapDurationsResponse);

    const { result } = renderHook(() => useReplayTimer());

    act(() => {
      result.current[1].initialize('2024::Bahrain::Race');
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Play
    act(() => {
      result.current[1].play();
    });

    // Advance partially through lap 1
    act(() => {
      jest.advanceTimersByTime(50000);
    });
    expect(result.current[0].currentLap).toBe(0);

    // Pause
    act(() => {
      result.current[1].pause();
    });
    expect(result.current[0].status).toBe('paused');

    // Time passes but no advancement
    act(() => {
      jest.advanceTimersByTime(100000);
    });
    expect(result.current[0].currentLap).toBe(0);

    // Resume — should schedule from current position
    act(() => {
      result.current[1].play();
    });
    expect(result.current[0].status).toBe('playing');
  });

  it('jumps to a specific lap (mid-race re-sync)', async () => {
    mockFetchLapDurations.mockResolvedValue(mockLapDurationsResponse);

    const { result } = renderHook(() => useReplayTimer());

    act(() => {
      result.current[1].initialize('2024::Bahrain::Race');
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Jump to lap 3
    act(() => {
      result.current[1].jumpToLap(3);
    });
    expect(result.current[0].currentLap).toBe(3);
    expect(result.current[0].status).toBe('ready');
  });

  it('jumps to lap while playing and continues playback', async () => {
    mockFetchLapDurations.mockResolvedValue(mockLapDurationsResponse);

    const { result } = renderHook(() => useReplayTimer());

    act(() => {
      result.current[1].initialize('2024::Bahrain::Race');
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Start playing
    act(() => {
      result.current[1].play();
    });

    // Jump to lap 3 while playing
    act(() => {
      result.current[1].jumpToLap(3);
    });
    expect(result.current[0].currentLap).toBe(3);
    expect(result.current[0].status).toBe('playing');
  });

  it('finishes when reaching total laps', async () => {
    mockFetchLapDurations.mockResolvedValue(mockLapDurationsResponse);

    const { result } = renderHook(() => useReplayTimer());

    act(() => {
      result.current[1].initialize('2024::Bahrain::Race');
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Jump near the end and play
    act(() => {
      result.current[1].jumpToLap(4);
    });
    act(() => {
      result.current[1].play();
    });

    // Advance through lap 5 (92.1s)
    act(() => {
      jest.advanceTimersByTime(92100);
    });
    expect(result.current[0].currentLap).toBe(5);
    expect(result.current[0].status).toBe('finished');
    expect(result.current[0].progress).toBe(1);
  });

  it('resets to lap 0', async () => {
    mockFetchLapDurations.mockResolvedValue(mockLapDurationsResponse);

    const { result } = renderHook(() => useReplayTimer());

    act(() => {
      result.current[1].initialize('2024::Bahrain::Race');
    });
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current[1].jumpToLap(3);
    });
    act(() => {
      result.current[1].reset();
    });

    expect(result.current[0].currentLap).toBe(0);
    expect(result.current[0].status).toBe('ready');
  });

  it('applies speed multiplier to lap durations', async () => {
    mockFetchLapDurations.mockResolvedValue(mockLapDurationsResponse);

    const { result } = renderHook(() => useReplayTimer());

    act(() => {
      result.current[1].initialize('2024::Bahrain::Race');
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Set speed to 2x
    act(() => {
      result.current[1].setSpeed(2);
    });
    expect(result.current[0].speed).toBe(2);

    // Play at 2x speed — lap 1 (95s) should take 47.5s
    act(() => {
      result.current[1].play();
    });

    act(() => {
      jest.advanceTimersByTime(47500);
    });
    expect(result.current[0].currentLap).toBe(1);
  });

  it('clamps jump-to-lap to valid range', async () => {
    mockFetchLapDurations.mockResolvedValue(mockLapDurationsResponse);

    const { result } = renderHook(() => useReplayTimer());

    act(() => {
      result.current[1].initialize('2024::Bahrain::Race');
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Jump beyond total
    act(() => {
      result.current[1].jumpToLap(100);
    });
    expect(result.current[0].currentLap).toBe(5);
    expect(result.current[0].status).toBe('finished');

    // Jump below 0
    act(() => {
      result.current[1].jumpToLap(-5);
    });
    expect(result.current[0].currentLap).toBe(0);
  });

  it('calculates progress correctly', async () => {
    mockFetchLapDurations.mockResolvedValue(mockLapDurationsResponse);

    const { result } = renderHook(() => useReplayTimer());

    act(() => {
      result.current[1].initialize('2024::Bahrain::Race');
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current[0].progress).toBe(0);

    act(() => {
      result.current[1].jumpToLap(3);
    });
    expect(result.current[0].progress).toBeCloseTo(0.6);

    act(() => {
      result.current[1].jumpToLap(5);
    });
    expect(result.current[0].progress).toBe(1);
  });

  it('ignores play when not ready or paused', () => {
    const { result } = renderHook(() => useReplayTimer());

    // Idle state — play should be no-op
    act(() => {
      result.current[1].play();
    });
    expect(result.current[0].status).toBe('idle');
  });

  it('ignores pause when not playing', async () => {
    mockFetchLapDurations.mockResolvedValue(mockLapDurationsResponse);

    const { result } = renderHook(() => useReplayTimer());

    act(() => {
      result.current[1].initialize('2024::Bahrain::Race');
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Ready state — pause should be no-op
    act(() => {
      result.current[1].pause();
    });
    expect(result.current[0].status).toBe('ready');
  });
});
