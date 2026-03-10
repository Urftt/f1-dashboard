/**
 * useReplayTimer – Replay timer engine for lap-by-lap race advancement.
 *
 * Schedules lap reveals using real historical lap durations from FastF1.
 * Each lap N is revealed after waiting lap N's actual duration (scaled by
 * a speed multiplier). Supports play/pause, jump-to-lap (re-sync), and
 * speed adjustment.
 *
 * The engine uses a setTimeout chain (not setInterval) so that each lap's
 * wait matches the real historical duration within 1-second tolerance.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLapDurations } from '../api/client';
import type { LapDurationEntry } from '../types';

export type ReplayStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'finished' | 'error';

export interface ReplayState {
  /** Current status of the replay engine */
  status: ReplayStatus;
  /** Currently revealed lap (0 = pre-race / lights out, 1..N = lap data visible) */
  currentLap: number;
  /** Total laps in the session */
  totalLaps: number;
  /** Current speed multiplier (1 = real-time, 2 = 2x, etc.) */
  speed: number;
  /** Lap durations in seconds, indexed by lap number (1-based: durations[0] = lap 1) */
  lapDurations: number[];
  /** Progress fraction 0..1 */
  progress: number;
  /** Error message if status === 'error' */
  error: string | null;
  /** Timestamp (ms) when the current lap timer started, for UI countdown */
  lapTimerStartedAt: number | null;
  /** Duration (ms) of current lap timer, for UI countdown */
  lapTimerDuration: number | null;
}

export interface ReplayControls {
  /** Start or resume playback */
  play: () => void;
  /** Pause playback */
  pause: () => void;
  /** Jump to a specific lap number (mid-race re-sync) */
  jumpToLap: (lap: number) => void;
  /** Reset to lap 0 (pre-race state) */
  reset: () => void;
  /** Change speed multiplier */
  setSpeed: (speed: number) => void;
  /** Initialize the engine by fetching lap durations for a session */
  initialize: (sessionKey: string) => void;
}

const DEFAULT_LAP_DURATION_S = 90; // fallback if a lap has no duration data

export function useReplayTimer(): [ReplayState, ReplayControls] {
  const [status, setStatus] = useState<ReplayStatus>('idle');
  const [currentLap, setCurrentLap] = useState(0);
  const [totalLaps, setTotalLaps] = useState(0);
  const [speed, setSpeedState] = useState(1);
  const [lapDurations, setLapDurations] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lapTimerStartedAt, setLapTimerStartedAt] = useState<number | null>(null);
  const [lapTimerDuration, setLapTimerDuration] = useState<number | null>(null);

  // Refs for values accessed in timeout callbacks (avoid stale closures)
  const currentLapRef = useRef(0);
  const totalLapsRef = useRef(0);
  const speedRef = useRef(1);
  const lapDurationsRef = useRef<number[]>([]);
  const statusRef = useRef<ReplayStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync with state
  useEffect(() => { currentLapRef.current = currentLap; }, [currentLap]);
  useEffect(() => { totalLapsRef.current = totalLaps; }, [totalLaps]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { lapDurationsRef.current = lapDurations; }, [lapDurations]);
  useEffect(() => { statusRef.current = status; }, [status]);

  /** Clear any pending timer */
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setLapTimerStartedAt(null);
    setLapTimerDuration(null);
  }, []);

  /** Get the duration in ms for a given lap number (1-based), scaled by speed */
  const getLapDurationMs = useCallback((lapNumber: number, spd: number): number => {
    // lapDurations array is 0-indexed: index 0 = lap 1
    const idx = lapNumber - 1;
    const durationS = (idx >= 0 && idx < lapDurationsRef.current.length)
      ? lapDurationsRef.current[idx]
      : DEFAULT_LAP_DURATION_S;
    return (durationS / spd) * 1000;
  }, []);

  /** Schedule the next lap reveal. Called recursively via setTimeout chain. */
  const scheduleNextLap = useCallback(() => {
    const lap = currentLapRef.current;
    const total = totalLapsRef.current;
    const spd = speedRef.current;

    if (lap >= total) {
      setStatus('finished');
      clearTimer();
      return;
    }

    // The next lap to reveal
    const nextLap = lap + 1;
    const durationMs = getLapDurationMs(nextLap, spd);

    // Record timer info for UI countdown display
    const now = Date.now();
    setLapTimerStartedAt(now);
    setLapTimerDuration(durationMs);

    timerRef.current = setTimeout(() => {
      timerRef.current = null;

      // Advance to next lap
      setCurrentLap(nextLap);
      currentLapRef.current = nextLap;

      // Check if we've reached the end
      if (nextLap >= totalLapsRef.current) {
        setStatus('finished');
        setLapTimerStartedAt(null);
        setLapTimerDuration(null);
      } else if (statusRef.current === 'playing') {
        // Schedule the following lap
        scheduleNextLap();
      }
    }, durationMs);
  }, [clearTimer, getLapDurationMs]);

  /** Initialize: fetch lap durations from the backend */
  const initialize = useCallback((sessionKey: string) => {
    clearTimer();
    setStatus('loading');
    setCurrentLap(0);
    currentLapRef.current = 0;
    setError(null);

    fetchLapDurations(sessionKey)
      .then((data) => {
        const durations = data.lap_durations.map((d: LapDurationEntry) => d.duration_seconds);
        setLapDurations(durations);
        lapDurationsRef.current = durations;
        setTotalLaps(data.total_laps);
        totalLapsRef.current = data.total_laps;
        setStatus('ready');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      });
  }, [clearTimer]);

  /** Play / resume */
  const play = useCallback(() => {
    const s = statusRef.current;
    if (s !== 'ready' && s !== 'paused') return;

    // If we're at the end, restart
    if (currentLapRef.current >= totalLapsRef.current) {
      setCurrentLap(0);
      currentLapRef.current = 0;
    }

    setStatus('playing');
    statusRef.current = 'playing';
    scheduleNextLap();
  }, [scheduleNextLap]);

  /** Pause */
  const pause = useCallback(() => {
    if (statusRef.current !== 'playing') return;
    clearTimer();
    setStatus('paused');
    statusRef.current = 'paused';
  }, [clearTimer]);

  /** Jump to a specific lap (mid-race re-sync) */
  const jumpToLap = useCallback((lap: number) => {
    const clamped = Math.max(0, Math.min(lap, totalLapsRef.current));
    clearTimer();
    setCurrentLap(clamped);
    currentLapRef.current = clamped;

    if (clamped >= totalLapsRef.current) {
      setStatus('finished');
      statusRef.current = 'finished';
    } else {
      const wasPlaying = statusRef.current === 'playing';
      if (wasPlaying) {
        // Continue playing from the new lap
        setStatus('playing');
        statusRef.current = 'playing';
        // Use requestAnimationFrame to let React flush state before scheduling
        requestAnimationFrame(() => scheduleNextLap());
      } else {
        // Stay paused/ready at the new lap
        const newStatus = statusRef.current === 'idle' ? 'ready' :
                          statusRef.current === 'finished' ? 'paused' : statusRef.current;
        if (newStatus !== statusRef.current) {
          setStatus(newStatus as ReplayStatus);
          statusRef.current = newStatus as ReplayStatus;
        }
      }
    }
  }, [clearTimer, scheduleNextLap]);

  /** Reset to pre-race */
  const reset = useCallback(() => {
    clearTimer();
    setCurrentLap(0);
    currentLapRef.current = 0;
    if (totalLapsRef.current > 0) {
      setStatus('ready');
      statusRef.current = 'ready';
    }
  }, [clearTimer]);

  /** Update speed multiplier */
  const setSpeed = useCallback((newSpeed: number) => {
    const clamped = Math.max(0.25, Math.min(newSpeed, 100));
    setSpeedState(clamped);
    speedRef.current = clamped;

    // If currently playing, restart the current timer with new speed
    if (statusRef.current === 'playing' && timerRef.current !== null) {
      clearTimer();
      scheduleNextLap();
    }
  }, [clearTimer, scheduleNextLap]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const progress = totalLaps > 0 ? currentLap / totalLaps : 0;

  const state: ReplayState = {
    status,
    currentLap,
    totalLaps,
    speed,
    lapDurations,
    progress,
    error,
    lapTimerStartedAt,
    lapTimerDuration,
  };

  const controls: ReplayControls = {
    play,
    pause,
    jumpToLap,
    reset,
    setSpeed,
    initialize,
  };

  return [state, controls];
}
