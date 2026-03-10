/**
 * ConnectedStandingsBoard — Context-connected standings board.
 *
 * Consumes replay state (currentLap) and dashboard data (standings rows)
 * from the ReplayContext. When the replay timer advances to a new lap,
 * the context emits updated standings which triggers this component to
 * re-render with the new standings data.
 *
 * Tracks position changes between laps to display up/down arrows showing
 * which drivers gained or lost positions since the previous lap.
 *
 * This component bridges the ReplayContext with the presentational
 * StandingsBoard component, keeping the presentation layer pure and testable.
 */

import React, { useMemo, useRef } from 'react';
import { useReplayContext } from '../contexts/ReplayContext';
import StandingsBoard, { computePositionChanges } from './StandingsBoard';
import type { StandingsRow, PositionChangeMap } from './StandingsBoard';

interface ConnectedStandingsBoardProps {
  /** Total laps in the race (for header display). */
  totalLaps: number;
  /** Title shown in the header bar. */
  title?: string;
}

/**
 * Reads standings and currentLap from the ReplayContext and passes them
 * to the presentational StandingsBoard. Re-renders whenever the context
 * emits a new currentLap or standings update.
 *
 * Also computes position change deltas between consecutive laps so the
 * StandingsBoard can show gain/loss arrows next to driver positions.
 */
const ConnectedStandingsBoard: React.FC<ConnectedStandingsBoardProps> = ({
  totalLaps,
  title = 'RACE STANDINGS',
}) => {
  const { replayState, dashboard } = useReplayContext();

  // Track previous standings for position change computation
  const prevStandingsRef = useRef<StandingsRow[]>([]);
  const prevLapRef = useRef<number>(0);

  const positionChanges = useMemo<PositionChangeMap>(() => {
    const changes = computePositionChanges(dashboard.standings, prevStandingsRef.current);
    // Update previous ref only when lap actually changes
    if (replayState.currentLap !== prevLapRef.current) {
      prevStandingsRef.current = dashboard.standings;
      prevLapRef.current = replayState.currentLap;
    }
    return changes;
  }, [dashboard.standings, replayState.currentLap]);

  return (
    <StandingsBoard
      standings={dashboard.standings}
      currentLap={replayState.currentLap}
      totalLaps={totalLaps}
      title={title}
      positionChanges={positionChanges}
    />
  );
};

export default ConnectedStandingsBoard;
