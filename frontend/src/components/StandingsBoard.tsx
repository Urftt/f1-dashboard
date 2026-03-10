/**
 * StandingsBoard — F1 TV-style race standings table.
 *
 * Renders a dark-themed standings board with columns for position, driver,
 * team, gap to leader, interval, last lap time, tire compound/age, pit stops,
 * and fastest lap indicator. Designed to match the broadcast F1 TV aesthetic.
 *
 * Visual features:
 * - Team color bars with hover glow
 * - Purple fastest lap highlight (row tint, dot pulse, text glow)
 * - Tire compound color badges (SOFT=red, MEDIUM=yellow, HARD=white, etc.)
 * - Pit stop wrench icon with count
 * - Podium position coloring (gold P1, silver P2, bronze P3)
 * - Staggered row entry animation
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { DriverInfo, LapDataEntry } from '../types';
import './StandingsBoard.css';

// ── Tire compound colour mapping ──────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const COMPOUND_COLORS: Record<string, string> = {
  SOFT: '#FF3333',
  MEDIUM: '#FFC800',
  HARD: '#CCCCCC',
  INTERMEDIATE: '#43B02A',
  WET: '#0072C6',
};

const COMPOUND_SHORT: Record<string, string> = {
  SOFT: 'S',
  MEDIUM: 'M',
  HARD: 'H',
  INTERMEDIATE: 'I',
  WET: 'W',
};

const COMPOUND_CLASS: Record<string, string> = {
  SOFT: 'sb__tyre-badge--soft',
  MEDIUM: 'sb__tyre-badge--medium',
  HARD: 'sb__tyre-badge--hard',
  INTERMEDIATE: 'sb__tyre-badge--intermediate',
  WET: 'sb__tyre-badge--wet',
};

// ── Public types ──────────────────────────────────────────────────────

/** A single row in the standings board. */
export interface StandingsRow {
  position: number;
  driverAbbr: string;
  fullName: string;
  teamName: string;
  teamColor: string; // hex without '#'
  gapToLeader: string; // formatted, e.g. "+12.345" or "LEADER"
  interval: string; // formatted, e.g. "+1.234" or "LEADER"
  lastLapTime: string; // formatted, e.g. "1:32.456"
  compound: string | null; // e.g. "SOFT", "MEDIUM"
  tyreAge: number | null; // laps on current set
  pitStops: number;
  hasFastestLap: boolean;
}

/** Position change direction for a driver between laps. */
export type PositionChange = 'gained' | 'lost' | 'unchanged';

/** Map of driver abbreviation → number of positions gained (positive) or lost (negative). */
export type PositionChangeMap = Map<string, number>;

export interface StandingsBoardProps {
  /** Processed standings rows, ordered by position. */
  standings: StandingsRow[];
  /** Current lap number (shown in header). */
  currentLap: number;
  /** Total race laps (shown in header). */
  totalLaps: number;
  /** Title shown in the red header bar. */
  title?: string;
  /** Map of driver abbr → position delta (positive = gained positions). Computed automatically if not provided. */
  positionChanges?: PositionChangeMap;
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Format milliseconds as M:SS.mmm or SS.mmm for short times. */
export function formatLapTime(ms: number | null | undefined): string {
  if (ms == null || isNaN(ms) || ms <= 0) return '\u2014';
  const totalSec = ms / 1000;
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes > 0) {
    return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
  }
  return seconds.toFixed(3);
}

/** Format a gap value in seconds as "+X.XXX" or "LEADER". */
export function formatGap(gapMs: number | null | undefined, isLeader: boolean): string {
  if (isLeader) return 'LEADER';
  if (gapMs == null || isNaN(gapMs)) return '\u2014';
  const sec = gapMs / 1000;
  return `+${sec.toFixed(3)}`;
}

/**
 * Build StandingsRow[] from raw lap data at a given lap number.
 *
 * This is a convenience function that processes LapDataEntry[] and DriverInfo[]
 * into the format expected by StandingsBoard.
 */
export function buildStandingsRows(
  laps: LapDataEntry[],
  drivers: DriverInfo[],
  currentLap: number,
): StandingsRow[] {
  const driverMap = new Map(drivers.map((d) => [d.abbreviation, d]));

  // Get the latest lap entry for each driver up to and including currentLap
  const latestByDriver = new Map<string, LapDataEntry>();
  for (const lap of laps) {
    if (lap.lap_number > currentLap) continue;
    const existing = latestByDriver.get(lap.driver);
    if (!existing || lap.lap_number > existing.lap_number) {
      latestByDriver.set(lap.driver, lap);
    }
  }

  // Count pit stops per driver (pit-in laps up to currentLap)
  const pitCounts = new Map<string, number>();
  for (const lap of laps) {
    if (lap.lap_number > currentLap) continue;
    if (lap.is_pit_in_lap) {
      pitCounts.set(lap.driver, (pitCounts.get(lap.driver) || 0) + 1);
    }
  }

  // Find fastest lap across all drivers up to currentLap
  let fastestLapMs = Infinity;
  let fastestLapDriver: string | null = null;
  for (const lap of laps) {
    if (lap.lap_number > currentLap || lap.lap_number < 2) continue; // skip lap 1 (formation)
    if (lap.lap_time_ms != null && lap.lap_time_ms > 0 && lap.lap_time_ms < fastestLapMs) {
      fastestLapMs = lap.lap_time_ms;
      fastestLapDriver = lap.driver;
    }
  }

  // Build rows from drivers that have data at currentLap
  const rows: StandingsRow[] = [];
  for (const [abbr, lap] of Array.from(latestByDriver.entries())) {
    const info = driverMap.get(abbr);
    rows.push({
      position: lap.position ?? 99,
      driverAbbr: abbr,
      fullName: info?.full_name ?? abbr,
      teamName: info?.team_name ?? '',
      teamColor: info?.team_color ?? 'FFFFFF',
      gapToLeader: '', // computed after sort
      interval: '', // computed after sort
      lastLapTime: formatLapTime(lap.lap_time_ms),
      compound: lap.compound,
      tyreAge: lap.tyre_life,
      pitStops: pitCounts.get(abbr) || 0,
      hasFastestLap: abbr === fastestLapDriver,
    });
  }

  // Sort by position
  rows.sort((a, b) => a.position - b.position);

  // Compute gap to leader and interval
  // Use elapsed_ms for gap calculations where available
  const leaderLap = rows.length > 0 ? latestByDriver.get(rows[0].driverAbbr) : null;
  const leaderElapsed = leaderLap?.elapsed_ms;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const driverLap = latestByDriver.get(row.driverAbbr);

    if (i === 0) {
      row.gapToLeader = 'LEADER';
      row.interval = 'LEADER';
    } else {
      // Gap to leader
      if (leaderElapsed != null && driverLap?.elapsed_ms != null) {
        const gapMs = driverLap.elapsed_ms - leaderElapsed;
        row.gapToLeader = `+${(gapMs / 1000).toFixed(3)}`;
      } else {
        row.gapToLeader = '\u2014';
      }

      // Interval to car ahead
      const aheadLap = latestByDriver.get(rows[i - 1].driverAbbr);
      if (aheadLap?.elapsed_ms != null && driverLap?.elapsed_ms != null) {
        const intMs = driverLap.elapsed_ms - aheadLap.elapsed_ms;
        row.interval = `+${(intMs / 1000).toFixed(3)}`;
      } else {
        row.interval = '\u2014';
      }
    }
  }

  return rows;
}

// ── Pit stop wrench SVG icon ──────────────────────────────────────────
const PitStopIcon: React.FC = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

/**
 * Compute position changes between two standings snapshots.
 * Returns a map of driver abbreviation → delta (positive = gained positions).
 */
export function computePositionChanges(
  currentStandings: StandingsRow[],
  previousStandings: StandingsRow[],
): PositionChangeMap {
  const changes: PositionChangeMap = new Map();
  if (previousStandings.length === 0) return changes;

  const prevPositions = new Map<string, number>();
  for (const row of previousStandings) {
    prevPositions.set(row.driverAbbr, row.position);
  }

  for (const row of currentStandings) {
    const prevPos = prevPositions.get(row.driverAbbr);
    if (prevPos != null) {
      // Delta: positive means gained positions (moved up the grid)
      changes.set(row.driverAbbr, prevPos - row.position);
    }
  }

  return changes;
}

// ── Position change arrow component ───────────────────────────────────
const PositionChangeArrow: React.FC<{ delta: number }> = ({ delta }) => {
  if (delta === 0) return null;
  const isGain = delta > 0;
  return (
    <span
      className={`sb__pos-change ${isGain ? 'sb__pos-change--gained' : 'sb__pos-change--lost'}`}
      title={isGain ? `Gained ${delta} position${delta > 1 ? 's' : ''}` : `Lost ${Math.abs(delta)} position${Math.abs(delta) > 1 ? 's' : ''}`}
      aria-label={isGain ? `Gained ${delta}` : `Lost ${Math.abs(delta)}`}
    >
      {isGain ? '▲' : '▼'}
      <span className="sb__pos-change-num">{Math.abs(delta)}</span>
    </span>
  );
};

// ── Position class helper ─────────────────────────────────────────────
function positionClass(pos: number): string {
  if (pos === 1) return 'sb__cell sb__cell--pos sb__cell--pos-1';
  if (pos === 2) return 'sb__cell sb__cell--pos sb__cell--pos-2';
  if (pos === 3) return 'sb__cell sb__cell--pos sb__cell--pos-3';
  return 'sb__cell sb__cell--pos';
}

// ── Component ─────────────────────────────────────────────────────────

const StandingsBoard: React.FC<StandingsBoardProps> = ({
  standings,
  currentLap,
  totalLaps,
  title = 'RACE STANDINGS',
  positionChanges: externalChanges,
}) => {
  // ── Track previous standings for automatic position change detection ──
  const prevStandingsRef = useRef<StandingsRow[]>([]);
  const prevLapRef = useRef<number>(0);
  const [lapFlash, setLapFlash] = useState(false);

  // Compute position changes: use external if provided, else auto-compute
  const positionChanges = useMemo(() => {
    if (externalChanges) return externalChanges;
    return computePositionChanges(standings, prevStandingsRef.current);
  }, [standings, externalChanges]);

  // Detect lap change and trigger flash animation + update previous standings
  useEffect(() => {
    if (currentLap !== prevLapRef.current && currentLap > 0) {
      // Trigger lap-change flash
      setLapFlash(true);
      const timer = setTimeout(() => setLapFlash(false), 600);

      // Store current standings as previous for next lap's change detection
      prevStandingsRef.current = standings;
      prevLapRef.current = currentLap;

      return () => clearTimeout(timer);
    }
    prevLapRef.current = currentLap;
  }, [currentLap, standings]);

  const lapDisplay = useMemo(() => {
    if (totalLaps > 0) return `LAP ${currentLap}/${totalLaps}`;
    if (currentLap > 0) return `LAP ${currentLap}`;
    return '';
  }, [currentLap, totalLaps]);

  if (!standings || standings.length === 0) {
    return (
      <div className="sb" role="table" aria-label={title}>
        <div className="sb__header">
          <span className="sb__title">{title}</span>
          <span className="sb__lap">{lapDisplay}</span>
        </div>
        <div className="sb__empty">No standings data available</div>
      </div>
    );
  }

  return (
    <div className={`sb ${lapFlash ? 'sb--lap-flash' : ''}`} role="table" aria-label={title} data-lap={currentLap}>
      {/* ── Header bar ───────────────────────────────────── */}
      <div className="sb__header">
        <span className="sb__title">{title}</span>
        <span className={`sb__lap ${lapFlash ? 'sb__lap--flash' : ''}`}>{lapDisplay}</span>
      </div>

      {/* ── Column headings ──────────────────────────────── */}
      <div className="sb__col-headings" role="row">
        <span className="sb__col sb__col--pos">POS</span>
        <span className="sb__col sb__col--bar" />
        <span className="sb__col sb__col--driver">DRIVER</span>
        <span className="sb__col sb__col--team">TEAM</span>
        <span className="sb__col sb__col--gap">GAP</span>
        <span className="sb__col sb__col--int">INT</span>
        <span className="sb__col sb__col--last">LAST</span>
        <span className="sb__col sb__col--tyre">TYRE</span>
        <span className="sb__col sb__col--pit">PIT</span>
      </div>

      {/* ── Driver rows ──────────────────────────────────── */}
      <div className="sb__body">
        {standings.map((row, idx) => {
          const teamColor = `#${row.teamColor.replace('#', '')}`;
          const compoundKey = row.compound?.toUpperCase() ?? '';
          const compoundLetter = COMPOUND_SHORT[compoundKey] ?? '?';
          const compoundCls = COMPOUND_CLASS[compoundKey] ?? 'sb__tyre-badge--unknown';
          const isLeader = row.position === 1;
          const posDelta = positionChanges.get(row.driverAbbr) ?? 0;

          // Build row class list
          const rowCls = [
            'sb__row',
            idx % 2 === 0 ? 'sb__row--even' : 'sb__row--odd',
            row.hasFastestLap ? 'sb__row--fastest' : '',
            posDelta > 0 ? 'sb__row--gained' : '',
            posDelta < 0 ? 'sb__row--lost' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div className={rowCls} key={row.driverAbbr} role="row">
              {/* Position — podium colors for P1/P2/P3 */}
              <span className={positionClass(row.position)} role="cell">
                {row.position}
                {posDelta !== 0 && <PositionChangeArrow delta={posDelta} />}
              </span>

              {/* Team colour bar */}
              <span
                className="sb__cell sb__cell--bar"
                style={{ backgroundColor: teamColor, color: teamColor }}
                role="presentation"
              />

              {/* Driver */}
              <span className="sb__cell sb__cell--driver" role="cell" title={row.fullName}>
                {row.driverAbbr}
                {row.hasFastestLap && (
                  <span className="sb__fastest-dot" title="Fastest Lap" />
                )}
              </span>

              {/* Team */}
              <span className="sb__cell sb__cell--team" role="cell">
                {row.teamName}
              </span>

              {/* Gap to leader */}
              <span
                className={`sb__cell sb__cell--gap ${isLeader ? 'sb__cell--leader' : ''}`}
                role="cell"
              >
                {row.gapToLeader}
              </span>

              {/* Interval */}
              <span
                className={`sb__cell sb__cell--int ${isLeader ? 'sb__cell--leader' : ''}`}
                role="cell"
              >
                {row.interval}
              </span>

              {/* Last lap time */}
              <span
                className={`sb__cell sb__cell--last ${row.hasFastestLap ? 'sb__cell--fastest' : ''}`}
                role="cell"
              >
                {row.lastLapTime}
              </span>

              {/* Tire compound + age */}
              <span className="sb__cell sb__cell--tyre" role="cell">
                {row.compound ? (
                  <>
                    <span
                      className={`sb__tyre-badge ${compoundCls}`}
                      title={row.compound}
                    >
                      {compoundLetter}
                    </span>
                    {row.tyreAge != null && (
                      <span className="sb__tyre-age">{row.tyreAge}</span>
                    )}
                  </>
                ) : (
                  '\u2014'
                )}
              </span>

              {/* Pit stops — wrench icon + count */}
              <span className="sb__cell sb__cell--pit" role="cell">
                {row.pitStops > 0 ? (
                  <span className="sb__pit-icon">
                    <PitStopIcon />
                    <span className="sb__pit-count">{row.pitStops}</span>
                  </span>
                ) : (
                  '\u2014'
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StandingsBoard;
