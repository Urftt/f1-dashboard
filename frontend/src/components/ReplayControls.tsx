/**
 * ReplayControls – Playback control bar for the race replay engine.
 *
 * Renders play/pause, lap slider (jump-to-lap), speed selector,
 * and a lap progress indicator. F1-themed dark UI.
 */

import React, { useCallback, useMemo, useState } from 'react';
import type { ReplayState, ReplayControls as ReplayControlsType } from '../hooks/useReplayTimer';
import './ReplayControls.css';

interface Props {
  state: ReplayState;
  controls: ReplayControlsType;
  /**
   * Optional callback for jump-to-lap re-sync.
   * When provided, this is called instead of controls.jumpToLap() directly,
   * allowing the parent (RaceDashboard) to fetch server-side data and
   * update all dashboard views before/after the timer resets.
   */
  onJumpToLap?: (lap: number) => void;
}

const SPEED_OPTIONS = [0.5, 1, 2, 5, 10, 20, 50];

function formatLapDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1);
  return m > 0 ? `${m}:${s.padStart(4, '0')}` : `${s}s`;
}

const ReplayControlsComponent: React.FC<Props> = ({ state, controls, onJumpToLap }) => {
  const { status, currentLap, totalLaps, speed, progress, lapDurations } = state;

  const [jumpLapInput, setJumpLapInput] = useState('');

  const isPlayable = status === 'ready' || status === 'paused' || status === 'finished';
  const isPausable = status === 'playing';
  const isInitialized = status !== 'idle' && status !== 'loading' && status !== 'error';

  const handlePlayPause = useCallback(() => {
    if (isPausable) {
      controls.pause();
    } else if (isPlayable) {
      controls.play();
    }
  }, [isPausable, isPlayable, controls]);

  // Use the re-sync handler if provided, otherwise fall back to direct jumpToLap
  const jumpHandler = onJumpToLap ?? controls.jumpToLap;

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      jumpHandler(parseInt(e.target.value, 10));
    },
    [jumpHandler],
  );

  const handleSpeedChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      controls.setSpeed(parseFloat(e.target.value));
    },
    [controls],
  );

  const handleReset = useCallback(() => {
    controls.reset();
  }, [controls]);

  /** Parse input and trigger jump-to-lap re-sync */
  const handleJumpToLap = useCallback(() => {
    const parsed = parseInt(jumpLapInput, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= totalLaps) {
      jumpHandler(parsed);
      setJumpLapInput('');
    }
  }, [jumpLapInput, totalLaps, jumpHandler]);

  /** Allow Enter key to submit the jump-to-lap */
  const handleJumpKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleJumpToLap();
      }
    },
    [handleJumpToLap],
  );

  /** Validate that input is a valid lap number */
  const isJumpInputValid = useMemo(() => {
    const parsed = parseInt(jumpLapInput, 10);
    return !isNaN(parsed) && parsed >= 0 && parsed <= totalLaps;
  }, [jumpLapInput, totalLaps]);

  // Current lap duration info
  const currentLapDuration = useMemo(() => {
    if (currentLap > 0 && currentLap <= lapDurations.length) {
      return lapDurations[currentLap - 1];
    }
    return null;
  }, [currentLap, lapDurations]);

  // Next lap duration info
  const nextLapDuration = useMemo(() => {
    const nextLap = currentLap + 1;
    if (nextLap > 0 && nextLap <= lapDurations.length) {
      return lapDurations[nextLap - 1];
    }
    return null;
  }, [currentLap, lapDurations]);

  if (!isInitialized) return null;

  return (
    <div className="replay-controls">
      <div className="replay-controls__top-row">
        {/* Play/Pause button */}
        <button
          className={`replay-controls__play-btn ${isPausable ? 'replay-controls__play-btn--playing' : ''}`}
          onClick={handlePlayPause}
          disabled={!isPlayable && !isPausable}
          type="button"
          aria-label={isPausable ? 'Pause replay' : 'Start replay'}
        >
          {isPausable ? (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          )}
        </button>

        {/* Reset button */}
        <button
          className="replay-controls__reset-btn"
          onClick={handleReset}
          disabled={currentLap === 0 && status === 'ready'}
          type="button"
          aria-label="Reset to start"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" transform="scale(-1,1) translate(-24,0)" />
          </svg>
        </button>

        {/* Lap counter */}
        <div className="replay-controls__lap-counter">
          <span className="replay-controls__lap-label">LAP</span>
          <span className="replay-controls__lap-value">
            {currentLap} <span className="replay-controls__lap-total">/ {totalLaps}</span>
          </span>
        </div>

        {/* Status indicator */}
        <div className={`replay-controls__status replay-controls__status--${status}`}>
          {status === 'ready' && 'LIGHTS OUT'}
          {status === 'playing' && 'LIVE'}
          {status === 'paused' && 'PAUSED'}
          {status === 'finished' && 'CHEQUERED FLAG'}
        </div>

        {/* Speed selector */}
        <div className="replay-controls__speed">
          <label className="replay-controls__speed-label" htmlFor="replay-speed">
            SPEED
          </label>
          <select
            id="replay-speed"
            className="replay-controls__speed-select"
            value={speed}
            onChange={handleSpeedChange}
          >
            {SPEED_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </div>

        {/* Jump to Lap control */}
        <div className="replay-controls__jump">
          <label className="replay-controls__jump-label" htmlFor="jump-to-lap-input">
            GO TO LAP
          </label>
          <div className="replay-controls__jump-input-group">
            <input
              id="jump-to-lap-input"
              type="number"
              className="replay-controls__jump-input"
              min={0}
              max={totalLaps}
              value={jumpLapInput}
              onChange={(e) => setJumpLapInput(e.target.value)}
              onKeyDown={handleJumpKeyDown}
              placeholder={`0–${totalLaps}`}
              aria-label="Target lap number"
            />
            <button
              className="replay-controls__jump-btn"
              onClick={handleJumpToLap}
              disabled={!isJumpInputValid}
              type="button"
              aria-label="Go to target lap"
            >
              GO
            </button>
          </div>
        </div>

        {/* Lap duration info */}
        {status === 'playing' && nextLapDuration !== null && (
          <div className="replay-controls__timing">
            <span className="replay-controls__timing-label">NEXT LAP</span>
            <span className="replay-controls__timing-value">
              {formatLapDuration(nextLapDuration / speed)}
            </span>
          </div>
        )}
        {(status === 'paused' || status === 'ready') && currentLapDuration !== null && (
          <div className="replay-controls__timing">
            <span className="replay-controls__timing-label">LAST LAP</span>
            <span className="replay-controls__timing-value">
              {formatLapDuration(currentLapDuration)}
            </span>
          </div>
        )}
      </div>

      {/* Lap slider / progress bar */}
      <div className="replay-controls__slider-row">
        <input
          type="range"
          className="replay-controls__slider"
          min={0}
          max={totalLaps}
          value={currentLap}
          onChange={handleSliderChange}
          aria-label="Jump to lap"
        />
        <div
          className="replay-controls__progress-fill"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
};

export default ReplayControlsComponent;
