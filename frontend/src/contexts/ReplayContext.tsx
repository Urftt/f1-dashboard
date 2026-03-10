/**
 * ReplayContext — Shared state for the race replay engine.
 *
 * Provides replay state updates (current lap, status, speed, etc.) and
 * computed dashboard data (standings rows, gap chart data) via React Context.
 * Both the StandingsBoard and GapChart components consume this context to
 * trigger re-renders when the replay timer advances to a new lap.
 *
 * Architecture:
 * - ReplayProvider wraps the useReplayTimer hook and manages derived data
 * - useReplayContext() gives consumer components access to replay state
 * - useReplayControls() gives consumer components access to replay controls
 * - State updates from the timer (currentLap changes) propagate through
 *   context to all subscribed consumers simultaneously
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useReplayTimer } from '../hooks/useReplayTimer';
import { fetchGapChart, fetchSessionLapData, fetchStandings } from '../api/client';
import { buildStandingsRows } from '../components/StandingsBoard';
import type { StandingsRow } from '../components/StandingsBoard';
import type { ReplayState, ReplayControls } from '../hooks/useReplayTimer';
import type {
  GapChartData,
  LoadSessionResponse,
  SessionLapData,
  ServerStandingsEntry,
} from '../types';

// ── Context value types ─────────────────────────────────────────────

/** Data computed/fetched for the dashboard, derived from replay state. */
export interface DashboardData {
  /** Standings rows at the current lap (client-side or server re-sync). */
  standings: StandingsRow[];
  /** Gap chart data for the selected driver pair. */
  gapData: GapChartData | null;
  /** Full session lap data (for client-side standings computation). */
  lapData: SessionLapData | null;
  /** Whether initial data is still loading. */
  dataLoading: boolean;
  /** Whether gap chart data is loading. */
  gapLoading: boolean;
  /** Whether a re-sync (jump-to-lap) fetch is in progress. */
  resyncLoading: boolean;
  /** Currently selected driver 1 abbreviation. */
  driver1: string;
  /** Currently selected driver 2 abbreviation. */
  driver2: string;
}

/** Actions available on the dashboard data layer. */
export interface DashboardActions {
  /** Change the selected driver pair for the gap chart. */
  setDrivers: (d1: string, d2: string) => void;
  /** Jump to a specific lap with server re-sync. */
  jumpToLap: (lap: number) => void;
  /** Start the replay (play + notify parent). */
  startReplay: () => void;
  /** End the replay (reset + notify parent). */
  endReplay: () => void;
}

/** The full context value provided to consumers. */
export interface ReplayContextValue {
  /** Current replay engine state (status, currentLap, speed, etc.). */
  replayState: ReplayState;
  /** Replay engine controls (play, pause, setSpeed, etc.). */
  replayControls: ReplayControls;
  /** Computed dashboard data (standings, gap chart, etc.). */
  dashboard: DashboardData;
  /** Dashboard-level actions (driver selection, jump-to-lap, etc.). */
  actions: DashboardActions;
  /** Session metadata. */
  session: LoadSessionResponse;
}

// ── Context creation ────────────────────────────────────────────────

const ReplayContext = createContext<ReplayContextValue | null>(null);
ReplayContext.displayName = 'ReplayContext';

// ── Helpers ─────────────────────────────────────────────────────────

/** Map server-side standings entries (snake_case) to client StandingsRow format. */
function mapServerStandingsToRows(entries: ServerStandingsEntry[]): StandingsRow[] {
  return entries.map((e) => ({
    position: e.position,
    driverAbbr: e.driver,
    fullName: e.full_name,
    teamName: e.team,
    teamColor: e.team_color,
    gapToLeader: e.gap_to_leader,
    interval: e.interval,
    lastLapTime: e.last_lap_time,
    compound: e.tire_compound || null,
    tyreAge: e.tire_age,
    pitStops: e.pit_stops,
    hasFastestLap: e.has_fastest_lap,
  }));
}

// ── Provider props ──────────────────────────────────────────────────

export interface ReplayProviderProps {
  /** The loaded session metadata. */
  session: LoadSessionResponse;
  /** Called when user starts the replay. */
  onReplayStart?: () => void;
  /** Called when user ends the replay. */
  onReplayEnd?: () => void;
  /** Children to render within the provider. */
  children: React.ReactNode;
}

// ── Provider component ──────────────────────────────────────────────

/**
 * ReplayProvider — Manages replay state and derived dashboard data.
 *
 * This provider:
 * 1. Initializes the replay timer when a session loads
 * 2. Fetches session lap data and gap chart data
 * 3. Computes standings from lap data at the current replay lap
 * 4. Handles jump-to-lap re-sync (server-side data fetch)
 * 5. Emits all state updates through React context for consumers
 */
export const ReplayProvider: React.FC<ReplayProviderProps> = ({
  session,
  onReplayStart,
  onReplayEnd,
  children,
}) => {
  const { session_key: sessionKey, total_laps: totalLaps } = session;

  // ── Replay timer engine ──────────────────────────────────────────
  const [replayState, replayControls] = useReplayTimer();

  // ── Driver selection for gap chart ───────────────────────────────
  const [driver1, setDriver1] = useState('');
  const [driver2, setDriver2] = useState('');

  // ── Data state ───────────────────────────────────────────────────
  const [lapData, setLapData] = useState<SessionLapData | null>(null);
  const [gapData, setGapData] = useState<GapChartData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [gapLoading, setGapLoading] = useState(false);

  // ── Re-sync state ────────────────────────────────────────────────
  const [resyncStandings, setResyncStandings] = useState<StandingsRow[] | null>(null);
  const [resyncLoading, setResyncLoading] = useState(false);
  const resyncAbortRef = useRef<AbortController | null>(null);
  const driver1Ref = useRef(driver1);
  const driver2Ref = useRef(driver2);

  // Keep driver refs in sync
  useEffect(() => { driver1Ref.current = driver1; }, [driver1]);
  useEffect(() => { driver2Ref.current = driver2; }, [driver2]);

  // ── Initialize replay timer when session loads ───────────────────
  useEffect(() => {
    if (sessionKey) {
      replayControls.initialize(sessionKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  // ── Fetch full lap data once for standings computation ───────────
  useEffect(() => {
    if (!sessionKey) return;
    let cancelled = false;
    setDataLoading(true);

    fetchSessionLapData(sessionKey)
      .then((data) => {
        if (!cancelled) {
          setLapData(data);
          setDataLoading(false);

          // Auto-select first two drivers for gap chart
          if (data.drivers.length >= 2) {
            setDriver1(data.drivers[0].abbreviation);
            setDriver2(data.drivers[1].abbreviation);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to fetch lap data:', err);
          setDataLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [sessionKey]);

  // ── Fetch gap chart data when drivers change ─────────────────────
  useEffect(() => {
    if (!sessionKey || !driver1 || !driver2 || driver1 === driver2) {
      setGapData(null);
      return;
    }

    let cancelled = false;
    setGapLoading(true);

    fetchGapChart(sessionKey, driver1, driver2)
      .then((data) => {
        if (!cancelled) {
          setGapData(data);
          setGapLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to fetch gap data:', err);
          setGapLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [sessionKey, driver1, driver2]);

  // ── Clear re-sync standings on normal lap advance ────────────────
  const prevLapRef = useRef(replayState.currentLap);
  useEffect(() => {
    const prev = prevLapRef.current;
    const curr = replayState.currentLap;
    prevLapRef.current = curr;

    // Normal advance: lap incremented by exactly 1 while playing
    if (curr === prev + 1 && replayState.status === 'playing' && resyncStandings !== null) {
      setResyncStandings(null);
    }
  }, [replayState.currentLap, replayState.status, resyncStandings]);

  // ── Jump-to-lap re-sync handler ──────────────────────────────────
  const handleJumpToLap = useCallback(
    (lap: number) => {
      // Update the replay timer
      replayControls.jumpToLap(lap);

      if (lap <= 0 || !sessionKey) {
        setResyncStandings(null);
        return;
      }

      // Cancel in-flight re-sync
      if (resyncAbortRef.current) {
        resyncAbortRef.current.abort();
      }
      const abortController = new AbortController();
      resyncAbortRef.current = abortController;

      setResyncLoading(true);

      const standingsPromise = fetchStandings(sessionKey, lap).catch((err) => {
        if (!abortController.signal.aborted) {
          console.error('Re-sync standings fetch failed:', err);
        }
        return null;
      });

      const d1 = driver1Ref.current;
      const d2 = driver2Ref.current;
      const gapPromise = (d1 && d2 && d1 !== d2)
        ? fetchGapChart(sessionKey, d1, d2, lap).catch((err) => {
            if (!abortController.signal.aborted) {
              console.error('Re-sync gap chart fetch failed:', err);
            }
            return null;
          })
        : Promise.resolve(null);

      Promise.all([standingsPromise, gapPromise]).then(([standingsResp, gapResp]) => {
        if (abortController.signal.aborted) return;

        if (standingsResp && standingsResp.standings.length > 0) {
          setResyncStandings(mapServerStandingsToRows(standingsResp.standings));
        }

        if (gapResp) {
          setGapData(gapResp);
        }

        setResyncLoading(false);
        resyncAbortRef.current = null;
      });
    },
    [sessionKey, replayControls],
  );

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (resyncAbortRef.current) {
        resyncAbortRef.current.abort();
      }
    };
  }, []);

  // ── Driver change handler ────────────────────────────────────────
  const setDrivers = useCallback((d1: string, d2: string) => {
    setDriver1(d1);
    setDriver2(d2);
  }, []);

  // ── Start/End replay handlers ────────────────────────────────────
  const startReplay = useCallback(() => {
    replayControls.play();
    onReplayStart?.();
  }, [replayControls, onReplayStart]);

  const endReplay = useCallback(() => {
    replayControls.reset();
    onReplayEnd?.();
  }, [replayControls, onReplayEnd]);

  // ── Compute standings at the current replay lap ──────────────────
  const standings = useMemo(() => {
    if (resyncStandings !== null) return resyncStandings;
    if (!lapData || replayState.currentLap <= 0) return [];
    return buildStandingsRows(lapData.laps, lapData.drivers, replayState.currentLap);
  }, [lapData, replayState.currentLap, resyncStandings]);

  // ── Build context value ──────────────────────────────────────────
  const dashboard: DashboardData = useMemo(
    () => ({
      standings,
      gapData,
      lapData,
      dataLoading,
      gapLoading,
      resyncLoading,
      driver1,
      driver2,
    }),
    [standings, gapData, lapData, dataLoading, gapLoading, resyncLoading, driver1, driver2],
  );

  const actions: DashboardActions = useMemo(
    () => ({
      setDrivers,
      jumpToLap: handleJumpToLap,
      startReplay,
      endReplay,
    }),
    [setDrivers, handleJumpToLap, startReplay, endReplay],
  );

  const contextValue: ReplayContextValue = useMemo(
    () => ({
      replayState,
      replayControls,
      dashboard,
      actions,
      session,
    }),
    [replayState, replayControls, dashboard, actions, session],
  );

  return (
    <ReplayContext.Provider value={contextValue}>
      {children}
    </ReplayContext.Provider>
  );
};

// ── Consumer hooks ──────────────────────────────────────────────────

/**
 * Access the full replay context value.
 * Must be used within a ReplayProvider.
 */
export function useReplayContext(): ReplayContextValue {
  const ctx = useContext(ReplayContext);
  if (!ctx) {
    throw new Error('useReplayContext must be used within a <ReplayProvider>');
  }
  return ctx;
}

/**
 * Access only the replay state (status, currentLap, speed, etc.).
 * Convenience hook for components that only need to read state.
 */
export function useReplayState(): ReplayState {
  return useReplayContext().replayState;
}

/**
 * Access only the replay controls (play, pause, jumpToLap, etc.).
 * Convenience hook for components that only need to trigger actions.
 */
export function useReplayControlsFromContext(): ReplayControls {
  return useReplayContext().replayControls;
}

/**
 * Access the dashboard data (standings, gap chart, drivers, loading states).
 * Used by StandingsBoard and GapChart to get data derived from replay state.
 */
export function useDashboardData(): DashboardData {
  return useReplayContext().dashboard;
}

/**
 * Access dashboard actions (driver selection, jump-to-lap, start/end replay).
 */
export function useDashboardActions(): DashboardActions {
  return useReplayContext().actions;
}

export default ReplayContext;
