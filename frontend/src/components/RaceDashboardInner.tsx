/**
 * RaceDashboardInner — Inner dashboard layout that consumes replay state
 * from the ReplayContext.
 *
 * This component renders the session info bar, start hero, replay controls,
 * standings board, and gap chart. All replay state and dashboard data are
 * obtained from the ReplayContext, ensuring that both the standings board
 * and gap chart re-render together when the replay timer advances.
 */

import React from 'react';
import { useReplayContext } from '../contexts/ReplayContext';
import ReplayControlsComponent from './ReplayControls';
import ConnectedStandingsBoard from './ConnectedStandingsBoard';
import ConnectedGapChart from './ConnectedGapChart';
import DriverSelector from './DriverSelector';

interface RaceDashboardInnerProps {
  /** Whether the replay is currently active (controlled by App phase). */
  isReplaying: boolean;
}

const RaceDashboardInner: React.FC<RaceDashboardInnerProps> = ({ isReplaying }) => {
  const { replayState, replayControls, dashboard, actions, session } = useReplayContext();

  const { session_key: sessionKey, total_laps: totalLaps, event_name, session_type } = session;
  const { dataLoading, lapData, gapData, gapLoading, resyncLoading, driver1, driver2 } = dashboard;

  const effectiveTotalLaps = totalLaps ?? replayState.totalLaps;

  // ── Loading state ──────────────────────────────────────────────────
  if (dataLoading && !lapData) {
    return (
      <div className="race-dashboard">
        <div className="race-dashboard__loading">
          <span className="race-dashboard__spinner" />
          Preparing race data...
        </div>
      </div>
    );
  }

  const isReplayReady =
    replayState.status === 'ready' ||
    replayState.status === 'paused' ||
    replayState.status === 'playing' ||
    replayState.status === 'finished';

  return (
    <div className="race-dashboard">
      {/* Session info bar */}
      <div className="race-dashboard__session-info">
        <span className="race-dashboard__event-name">{event_name}</span>
        <span className="race-dashboard__session-type">{session_type}</span>
        <span className="race-dashboard__year">{session.year}</span>
        {isReplaying && (
          <button
            className="race-dashboard__end-replay-btn"
            onClick={actions.endReplay}
            type="button"
            data-testid="end-replay-btn"
          >
            End Replay
          </button>
        )}
      </div>

      {/* Start Replay hero — shown before replay begins */}
      {!isReplaying && isReplayReady && (
        <div className="race-dashboard__start-hero" data-testid="start-replay-hero">
          <div className="race-dashboard__start-hero-content">
            <div className="race-dashboard__start-hero-lights">
              <span className="race-dashboard__light race-dashboard__light--off" />
              <span className="race-dashboard__light race-dashboard__light--off" />
              <span className="race-dashboard__light race-dashboard__light--off" />
              <span className="race-dashboard__light race-dashboard__light--off" />
              <span className="race-dashboard__light race-dashboard__light--off" />
            </div>
            <h3 className="race-dashboard__start-hero-title">
              {event_name} — {session_type}
            </h3>
            <p className="race-dashboard__start-hero-subtitle">
              {effectiveTotalLaps} laps &middot; {session.num_drivers} drivers &middot; {session.year} season
            </p>
            <button
              className="race-dashboard__start-replay-btn"
              onClick={actions.startReplay}
              type="button"
              data-testid="start-replay-btn"
              aria-label="Start race replay"
            >
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <polygon points="6,4 20,12 6,20" />
              </svg>
              Start Replay
            </button>
          </div>
        </div>
      )}

      {/* Replay controls — only visible during active replay */}
      {isReplaying && (
        <ReplayControlsComponent
          state={replayState}
          controls={replayControls}
          onJumpToLap={actions.jumpToLap}
        />
      )}

      {/* Main dashboard grid: standings + gap chart — only during active replay */}
      {isReplaying && (
        <div className="race-dashboard__grid">
          {/* Standings board — consumes replay state from context */}
          <div className="race-dashboard__standings">
            <ConnectedStandingsBoard
              totalLaps={effectiveTotalLaps}
              title="RACE STANDINGS"
            />
            {resyncLoading && (
              <div className="race-dashboard__resync-indicator" data-testid="resync-indicator">
                Syncing...
              </div>
            )}
          </div>

          {/* Gap chart panel — consumes replay state from context */}
          <div className="race-dashboard__gap-panel">
            {/* Driver selector for gap chart */}
            {lapData && (
              <DriverSelector
                sessionKey={sessionKey}
                driver1={driver1}
                driver2={driver2}
                onDriversChanged={actions.setDrivers}
              />
            )}

            {/* Gap chart — filtered to visible laps via context */}
            {gapLoading && !gapData && (
              <div className="race-dashboard__gap-loading">
                <span className="race-dashboard__spinner" />
                Loading gap data...
              </div>
            )}

            <ConnectedGapChart totalLaps={effectiveTotalLaps} />

            {!gapData && !gapLoading && driver1 && driver2 && (
              <div className="race-dashboard__gap-placeholder">
                Select two drivers to view the gap chart
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RaceDashboardInner;
