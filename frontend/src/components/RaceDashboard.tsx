/**
 * RaceDashboard — Orchestrates the replay timer, gap chart, and standings board.
 *
 * Uses ReplayProvider (React Context) to share replay state updates with all
 * child components. When the replay timer advances to a new lap, the context
 * emits state changes that both the standings board and gap chart consume to
 * trigger their re-renders.
 *
 * Supports mid-race re-sync (jump-to-lap) through the replay controls,
 * which fetches server-side standings + gap chart data in parallel.
 */

import React from 'react';
import { ReplayProvider } from '../contexts/ReplayContext';
import RaceDashboardInner from './RaceDashboardInner';
import type { LoadSessionResponse } from '../types';
import './RaceDashboard.css';

interface RaceDashboardProps {
  /** The loaded session metadata. */
  session: LoadSessionResponse;
  /** Whether the replay is currently active. */
  isReplaying?: boolean;
  /** Called when user clicks "Start Replay" — transitions App to replaying phase. */
  onReplayStart?: () => void;
  /** Called when user ends the replay — transitions App back to loaded phase. */
  onReplayEnd?: () => void;
}

/**
 * RaceDashboard wraps the inner dashboard content with the ReplayProvider,
 * making replay state available to all descendant components via React Context.
 *
 * State flow:
 *   ReplayProvider (useReplayTimer + data fetching + standings computation)
 *     └─ ReplayContext.Provider (emits state updates)
 *         ├─ ReplayControls (consumes replay state + controls)
 *         ├─ ConnectedStandingsBoard (consumes standings from context)
 *         └─ ConnectedGapChart (consumes gap data + visibleLap from context)
 */
const RaceDashboard: React.FC<RaceDashboardProps> = ({
  session,
  isReplaying = false,
  onReplayStart,
  onReplayEnd,
}) => {
  return (
    <ReplayProvider
      session={session}
      onReplayStart={onReplayStart}
      onReplayEnd={onReplayEnd}
    >
      <RaceDashboardInner isReplaying={isReplaying} />
    </ReplayProvider>
  );
};

export default RaceDashboard;
