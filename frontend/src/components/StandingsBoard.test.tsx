import React from 'react';
import { render, screen, act } from '@testing-library/react';
import StandingsBoard, {
  formatLapTime,
  formatGap,
  buildStandingsRows,
  computePositionChanges,
  StandingsRow,
  PositionChangeMap,
} from './StandingsBoard';
import type { DriverInfo, LapDataEntry } from '../types';

// ── Unit tests for helper functions ─────────────────────────────────

describe('formatLapTime', () => {
  it('formats time with minutes', () => {
    // 1:32.456 → 92456 ms
    expect(formatLapTime(92456)).toBe('1:32.456');
  });

  it('formats time under one minute', () => {
    expect(formatLapTime(45123)).toBe('45.123');
  });

  it('returns dash for null', () => {
    expect(formatLapTime(null)).toBe('—');
  });

  it('returns dash for zero', () => {
    expect(formatLapTime(0)).toBe('—');
  });

  it('returns dash for NaN', () => {
    expect(formatLapTime(NaN)).toBe('—');
  });
});

describe('formatGap', () => {
  it('returns LEADER for leader', () => {
    expect(formatGap(0, true)).toBe('LEADER');
  });

  it('formats gap in seconds', () => {
    expect(formatGap(12345, false)).toBe('+12.345');
  });

  it('returns dash for null', () => {
    expect(formatGap(null, false)).toBe('—');
  });
});

// ── buildStandingsRows tests ────────────────────────────────────────

const mockDrivers: DriverInfo[] = [
  {
    abbreviation: 'VER',
    driver_number: '1',
    full_name: 'Max Verstappen',
    team_name: 'Red Bull Racing',
    team_color: '3671C6',
  },
  {
    abbreviation: 'HAM',
    driver_number: '44',
    full_name: 'Lewis Hamilton',
    team_name: 'Mercedes',
    team_color: '6CD3BF',
  },
  {
    abbreviation: 'LEC',
    driver_number: '16',
    full_name: 'Charles Leclerc',
    team_name: 'Ferrari',
    team_color: 'F91536',
  },
];

const mockLaps: LapDataEntry[] = [
  {
    driver: 'VER', lap_number: 1, lap_time_ms: 95000, position: 1,
    sector1_ms: null, sector2_ms: null, sector3_ms: null,
    compound: 'MEDIUM', tyre_life: 1, is_pit_out_lap: false, is_pit_in_lap: false,
    elapsed_ms: 95000,
  },
  {
    driver: 'HAM', lap_number: 1, lap_time_ms: 95500, position: 2,
    sector1_ms: null, sector2_ms: null, sector3_ms: null,
    compound: 'SOFT', tyre_life: 1, is_pit_out_lap: false, is_pit_in_lap: false,
    elapsed_ms: 95500,
  },
  {
    driver: 'LEC', lap_number: 1, lap_time_ms: 96000, position: 3,
    sector1_ms: null, sector2_ms: null, sector3_ms: null,
    compound: 'HARD', tyre_life: 1, is_pit_out_lap: false, is_pit_in_lap: false,
    elapsed_ms: 96000,
  },
  {
    driver: 'VER', lap_number: 2, lap_time_ms: 91000, position: 1,
    sector1_ms: null, sector2_ms: null, sector3_ms: null,
    compound: 'MEDIUM', tyre_life: 2, is_pit_out_lap: false, is_pit_in_lap: false,
    elapsed_ms: 186000,
  },
  {
    driver: 'HAM', lap_number: 2, lap_time_ms: 91200, position: 2,
    sector1_ms: null, sector2_ms: null, sector3_ms: null,
    compound: 'SOFT', tyre_life: 2, is_pit_out_lap: false, is_pit_in_lap: false,
    elapsed_ms: 186700,
  },
  {
    driver: 'LEC', lap_number: 2, lap_time_ms: 91500, position: 3,
    sector1_ms: null, sector2_ms: null, sector3_ms: null,
    compound: 'HARD', tyre_life: 2, is_pit_out_lap: false, is_pit_in_lap: true,
    elapsed_ms: 187500,
  },
];

describe('buildStandingsRows', () => {
  it('builds rows sorted by position at lap 2', () => {
    const rows = buildStandingsRows(mockLaps, mockDrivers, 2);
    expect(rows).toHaveLength(3);
    expect(rows[0].driverAbbr).toBe('VER');
    expect(rows[1].driverAbbr).toBe('HAM');
    expect(rows[2].driverAbbr).toBe('LEC');
  });

  it('marks leader correctly', () => {
    const rows = buildStandingsRows(mockLaps, mockDrivers, 2);
    expect(rows[0].gapToLeader).toBe('LEADER');
    expect(rows[0].interval).toBe('LEADER');
  });

  it('computes gap to leader from elapsed times', () => {
    const rows = buildStandingsRows(mockLaps, mockDrivers, 2);
    // HAM elapsed 186700 - VER 186000 = 700ms = 0.700s
    expect(rows[1].gapToLeader).toBe('+0.700');
  });

  it('computes interval to car ahead', () => {
    const rows = buildStandingsRows(mockLaps, mockDrivers, 2);
    // LEC elapsed 187500 - HAM 186700 = 800ms = 0.800s
    expect(rows[2].interval).toBe('+0.800');
  });

  it('counts pit stops', () => {
    const rows = buildStandingsRows(mockLaps, mockDrivers, 2);
    expect(rows[2].pitStops).toBe(1); // LEC pitted on lap 2
    expect(rows[0].pitStops).toBe(0);
  });

  it('identifies fastest lap', () => {
    const rows = buildStandingsRows(mockLaps, mockDrivers, 2);
    // VER had 91000ms on lap 2 — fastest
    expect(rows[0].hasFastestLap).toBe(true);
    expect(rows[1].hasFastestLap).toBe(false);
  });

  it('returns correct tyre info', () => {
    const rows = buildStandingsRows(mockLaps, mockDrivers, 2);
    expect(rows[0].compound).toBe('MEDIUM');
    expect(rows[0].tyreAge).toBe(2);
    expect(rows[1].compound).toBe('SOFT');
  });

  it('only includes laps up to currentLap', () => {
    const rows = buildStandingsRows(mockLaps, mockDrivers, 1);
    expect(rows).toHaveLength(3);
    // At lap 1, positions should use lap 1 data
    expect(rows[0].driverAbbr).toBe('VER');
    expect(rows[0].tyreAge).toBe(1);
  });
});

// ── Component render tests ──────────────────────────────────────────

const sampleStandings: StandingsRow[] = [
  {
    position: 1, driverAbbr: 'VER', fullName: 'Max Verstappen',
    teamName: 'Red Bull Racing', teamColor: '3671C6',
    gapToLeader: 'LEADER', interval: 'LEADER',
    lastLapTime: '1:31.456', compound: 'MEDIUM', tyreAge: 12,
    pitStops: 1, hasFastestLap: true,
  },
  {
    position: 2, driverAbbr: 'HAM', fullName: 'Lewis Hamilton',
    teamName: 'Mercedes', teamColor: '6CD3BF',
    gapToLeader: '+3.456', interval: '+3.456',
    lastLapTime: '1:32.100', compound: 'SOFT', tyreAge: 5,
    pitStops: 2, hasFastestLap: false,
  },
];

describe('StandingsBoard component', () => {
  it('renders the header with title and lap info', () => {
    render(
      <StandingsBoard
        standings={sampleStandings}
        currentLap={25}
        totalLaps={57}
        title="RACE STANDINGS"
      />
    );
    expect(screen.getByText('RACE STANDINGS')).toBeInTheDocument();
    expect(screen.getByText('LAP 25/57')).toBeInTheDocument();
  });

  it('renders driver abbreviations', () => {
    render(
      <StandingsBoard standings={sampleStandings} currentLap={25} totalLaps={57} />
    );
    expect(screen.getByText('VER')).toBeInTheDocument();
    expect(screen.getByText('HAM')).toBeInTheDocument();
  });

  it('renders team names', () => {
    render(
      <StandingsBoard standings={sampleStandings} currentLap={25} totalLaps={57} />
    );
    expect(screen.getByText('Red Bull Racing')).toBeInTheDocument();
    expect(screen.getByText('Mercedes')).toBeInTheDocument();
  });

  it('renders gap and interval', () => {
    render(
      <StandingsBoard standings={sampleStandings} currentLap={25} totalLaps={57} />
    );
    // LEADER appears twice (gap + interval) for VER
    const leaders = screen.getAllByText('LEADER');
    expect(leaders.length).toBe(2);
    // +3.456 appears in both gap and interval columns for HAM
    const gaps = screen.getAllByText('+3.456');
    expect(gaps.length).toBe(2);
  });

  it('renders last lap times', () => {
    render(
      <StandingsBoard standings={sampleStandings} currentLap={25} totalLaps={57} />
    );
    expect(screen.getByText('1:31.456')).toBeInTheDocument();
    expect(screen.getByText('1:32.100')).toBeInTheDocument();
  });

  it('renders tyre compound badges', () => {
    render(
      <StandingsBoard standings={sampleStandings} currentLap={25} totalLaps={57} />
    );
    expect(screen.getByText('M')).toBeInTheDocument(); // MEDIUM
    expect(screen.getByText('S')).toBeInTheDocument(); // SOFT
  });

  it('renders tyre age', () => {
    render(
      <StandingsBoard standings={sampleStandings} currentLap={25} totalLaps={57} />
    );
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders pit stop counts', () => {
    render(
      <StandingsBoard standings={sampleStandings} currentLap={25} totalLaps={57} />
    );
    // "2" appears in position and pit stops — check the pit cell specifically
    const pitCells = screen.getAllByRole('cell').filter(
      (el) => el.classList.contains('sb__cell--pit') && el.textContent === '2'
    );
    expect(pitCells.length).toBe(1);
  });

  it('renders fastest lap indicator', () => {
    render(
      <StandingsBoard standings={sampleStandings} currentLap={25} totalLaps={57} />
    );
    const dot = screen.getByTitle('Fastest Lap');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('sb__fastest-dot');
  });

  it('renders empty state when no standings', () => {
    render(
      <StandingsBoard standings={[]} currentLap={0} totalLaps={0} />
    );
    expect(screen.getByText('No standings data available')).toBeInTheDocument();
  });

  it('shows only lap number when totalLaps is 0', () => {
    render(
      <StandingsBoard standings={sampleStandings} currentLap={10} totalLaps={0} />
    );
    expect(screen.getByText('LAP 10')).toBeInTheDocument();
  });

  it('applies podium color classes for P1/P2/P3', () => {
    const podiumStandings: StandingsRow[] = [
      { ...sampleStandings[0], position: 1 },
      { ...sampleStandings[1], position: 2, driverAbbr: 'HAM' },
      { ...sampleStandings[1], position: 3, driverAbbr: 'LEC', fullName: 'Charles Leclerc' },
    ];
    render(
      <StandingsBoard standings={podiumStandings} currentLap={25} totalLaps={57} />
    );
    const posCells = screen.getAllByRole('cell').filter(
      (el) => el.classList.contains('sb__cell--pos')
    );
    expect(posCells[0]).toHaveClass('sb__cell--pos-1'); // gold P1
    expect(posCells[1]).toHaveClass('sb__cell--pos-2'); // silver P2
    expect(posCells[2]).toHaveClass('sb__cell--pos-3'); // bronze P3
  });

  it('applies compound-specific CSS class to tyre badges', () => {
    render(
      <StandingsBoard standings={sampleStandings} currentLap={25} totalLaps={57} />
    );
    const mediumBadge = screen.getByTitle('MEDIUM');
    expect(mediumBadge).toHaveClass('sb__tyre-badge--medium');
    const softBadge = screen.getByTitle('SOFT');
    expect(softBadge).toHaveClass('sb__tyre-badge--soft');
  });

  it('renders pit stop wrench icon SVG for drivers with pit stops', () => {
    render(
      <StandingsBoard standings={sampleStandings} currentLap={25} totalLaps={57} />
    );
    // VER has 1 pit stop, HAM has 2 — both should have the wrench icon
    const pitIcons = document.querySelectorAll('.sb__pit-icon');
    expect(pitIcons.length).toBe(2);
    // Each pit icon should contain an SVG
    pitIcons.forEach((icon) => {
      expect(icon.querySelector('svg')).toBeTruthy();
    });
  });

  it('applies fastest lap row class to the fastest lap holder row', () => {
    render(
      <StandingsBoard standings={sampleStandings} currentLap={25} totalLaps={57} />
    );
    const rows = document.querySelectorAll('.sb__row');
    // VER (index 0) has fastest lap
    expect(rows[0]).toHaveClass('sb__row--fastest');
    // HAM (index 1) does not
    expect(rows[1]).not.toHaveClass('sb__row--fastest');
  });

  it('applies team color to the color bar element', () => {
    render(
      <StandingsBoard standings={sampleStandings} currentLap={25} totalLaps={57} />
    );
    const colorBars = document.querySelectorAll('.sb__cell--bar');
    // VER team color is 3671C6
    expect((colorBars[0] as HTMLElement).style.backgroundColor).toBeTruthy();
    // HAM team color is 6CD3BF
    expect((colorBars[1] as HTMLElement).style.backgroundColor).toBeTruthy();
  });
});

// ── computePositionChanges tests ───────────────────────────────────

describe('computePositionChanges', () => {
  it('returns empty map when previous standings are empty', () => {
    const current: StandingsRow[] = [
      { ...sampleStandings[0], position: 1 },
    ];
    const changes = computePositionChanges(current, []);
    expect(changes.size).toBe(0);
  });

  it('returns zero delta when positions are unchanged', () => {
    const lap1: StandingsRow[] = [
      { ...sampleStandings[0], position: 1, driverAbbr: 'VER' },
      { ...sampleStandings[1], position: 2, driverAbbr: 'HAM' },
    ];
    const lap2: StandingsRow[] = [
      { ...sampleStandings[0], position: 1, driverAbbr: 'VER' },
      { ...sampleStandings[1], position: 2, driverAbbr: 'HAM' },
    ];
    const changes = computePositionChanges(lap2, lap1);
    expect(changes.get('VER')).toBe(0);
    expect(changes.get('HAM')).toBe(0);
  });

  it('returns positive delta when driver gains positions', () => {
    const lap1: StandingsRow[] = [
      { ...sampleStandings[0], position: 1, driverAbbr: 'VER' },
      { ...sampleStandings[1], position: 3, driverAbbr: 'HAM' },
    ];
    const lap2: StandingsRow[] = [
      { ...sampleStandings[0], position: 1, driverAbbr: 'HAM' }, // HAM: 3→1 = gained 2
      { ...sampleStandings[1], position: 2, driverAbbr: 'VER' }, // VER: 1→2 = lost 1
    ];
    const changes = computePositionChanges(lap2, lap1);
    expect(changes.get('HAM')).toBe(2); // gained 2 positions
    expect(changes.get('VER')).toBe(-1); // lost 1 position
  });

  it('returns negative delta when driver loses positions', () => {
    const lap1: StandingsRow[] = [
      { ...sampleStandings[0], position: 1, driverAbbr: 'VER' },
    ];
    const lap2: StandingsRow[] = [
      { ...sampleStandings[0], position: 5, driverAbbr: 'VER' },
    ];
    const changes = computePositionChanges(lap2, lap1);
    expect(changes.get('VER')).toBe(-4); // 1 → 5 = lost 4
  });
});

// ── Position change indicator rendering tests ──────────────────────

describe('StandingsBoard position changes', () => {
  it('renders gain arrow when positionChanges shows positive delta', () => {
    const changes: PositionChangeMap = new Map([['HAM', 2]]);
    render(
      <StandingsBoard
        standings={sampleStandings}
        currentLap={10}
        totalLaps={57}
        positionChanges={changes}
      />
    );
    const arrow = screen.getByLabelText('Gained 2');
    expect(arrow).toBeInTheDocument();
    expect(arrow).toHaveClass('sb__pos-change--gained');
    expect(arrow.textContent).toContain('▲');
    expect(arrow.textContent).toContain('2');
  });

  it('renders loss arrow when positionChanges shows negative delta', () => {
    const changes: PositionChangeMap = new Map([['VER', -3]]);
    render(
      <StandingsBoard
        standings={sampleStandings}
        currentLap={10}
        totalLaps={57}
        positionChanges={changes}
      />
    );
    const arrow = screen.getByLabelText('Lost 3');
    expect(arrow).toBeInTheDocument();
    expect(arrow).toHaveClass('sb__pos-change--lost');
    expect(arrow.textContent).toContain('▼');
    expect(arrow.textContent).toContain('3');
  });

  it('does not render arrow when delta is zero', () => {
    const changes: PositionChangeMap = new Map([['VER', 0], ['HAM', 0]]);
    render(
      <StandingsBoard
        standings={sampleStandings}
        currentLap={10}
        totalLaps={57}
        positionChanges={changes}
      />
    );
    expect(screen.queryByLabelText(/Gained/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Lost/)).not.toBeInTheDocument();
  });

  it('applies gained row class when delta is positive', () => {
    const changes: PositionChangeMap = new Map([['HAM', 1]]);
    render(
      <StandingsBoard
        standings={sampleStandings}
        currentLap={10}
        totalLaps={57}
        positionChanges={changes}
      />
    );
    const rows = document.querySelectorAll('.sb__row');
    // HAM is row index 1
    expect(rows[1]).toHaveClass('sb__row--gained');
    // VER (no change) should not have gained/lost class
    expect(rows[0]).not.toHaveClass('sb__row--gained');
    expect(rows[0]).not.toHaveClass('sb__row--lost');
  });

  it('applies lost row class when delta is negative', () => {
    const changes: PositionChangeMap = new Map([['VER', -2]]);
    render(
      <StandingsBoard
        standings={sampleStandings}
        currentLap={10}
        totalLaps={57}
        positionChanges={changes}
      />
    );
    const rows = document.querySelectorAll('.sb__row');
    expect(rows[0]).toHaveClass('sb__row--lost');
  });
});

// ── Reactive re-rendering tests ────────────────────────────────────

describe('StandingsBoard reactive behavior', () => {
  it('re-renders with new data when standings and currentLap change', () => {
    const standingsLap1: StandingsRow[] = [
      {
        position: 1, driverAbbr: 'VER', fullName: 'Max Verstappen',
        teamName: 'Red Bull Racing', teamColor: '3671C6',
        gapToLeader: 'LEADER', interval: 'LEADER',
        lastLapTime: '1:35.000', compound: 'MEDIUM', tyreAge: 1,
        pitStops: 0, hasFastestLap: false,
      },
    ];

    const standingsLap2: StandingsRow[] = [
      {
        position: 1, driverAbbr: 'VER', fullName: 'Max Verstappen',
        teamName: 'Red Bull Racing', teamColor: '3671C6',
        gapToLeader: 'LEADER', interval: 'LEADER',
        lastLapTime: '1:31.456', compound: 'MEDIUM', tyreAge: 2,
        pitStops: 0, hasFastestLap: true,
      },
    ];

    // Render at lap 1
    const { rerender } = render(
      <StandingsBoard standings={standingsLap1} currentLap={1} totalLaps={57} />
    );
    expect(screen.getByText('LAP 1/57')).toBeInTheDocument();
    expect(screen.getByText('1:35.000')).toBeInTheDocument();

    // Re-render at lap 2 — simulates replay advancing
    rerender(
      <StandingsBoard standings={standingsLap2} currentLap={2} totalLaps={57} />
    );
    expect(screen.getByText('LAP 2/57')).toBeInTheDocument();
    expect(screen.getByText('1:31.456')).toBeInTheDocument();
    expect(screen.queryByText('1:35.000')).not.toBeInTheDocument();
  });

  it('applies lap-flash class when lap changes', () => {
    jest.useFakeTimers();

    const { rerender } = render(
      <StandingsBoard standings={sampleStandings} currentLap={1} totalLaps={57} />
    );

    // Advance to lap 2
    act(() => {
      rerender(
        <StandingsBoard standings={sampleStandings} currentLap={2} totalLaps={57} />
      );
    });

    // Flash should be active
    const board = document.querySelector('.sb');
    expect(board).toHaveClass('sb--lap-flash');

    // After timeout, flash should clear
    act(() => {
      jest.advanceTimersByTime(700);
    });
    expect(board).not.toHaveClass('sb--lap-flash');

    jest.useRealTimers();
  });

  it('stores data-lap attribute reflecting current lap', () => {
    const { rerender } = render(
      <StandingsBoard standings={sampleStandings} currentLap={5} totalLaps={57} />
    );
    const board = document.querySelector('.sb');
    expect(board?.getAttribute('data-lap')).toBe('5');

    rerender(
      <StandingsBoard standings={sampleStandings} currentLap={10} totalLaps={57} />
    );
    expect(board?.getAttribute('data-lap')).toBe('10');
  });

  it('auto-computes position changes when external positionChanges not provided', () => {
    jest.useFakeTimers();

    const standingsLap1: StandingsRow[] = [
      { ...sampleStandings[0], position: 1, driverAbbr: 'VER' },
      { ...sampleStandings[1], position: 2, driverAbbr: 'HAM' },
    ];
    const standingsLap2: StandingsRow[] = [
      { ...sampleStandings[1], position: 1, driverAbbr: 'HAM' }, // HAM gains P1
      { ...sampleStandings[0], position: 2, driverAbbr: 'VER' }, // VER drops to P2
    ];

    // Render lap 1 (no external positionChanges)
    const { rerender } = render(
      <StandingsBoard standings={standingsLap1} currentLap={1} totalLaps={57} />
    );
    // At lap 1 with no previous data, no arrows
    expect(screen.queryByLabelText(/Gained/)).not.toBeInTheDocument();

    // Advance to lap 2 — position changes should be auto-computed
    act(() => {
      rerender(
        <StandingsBoard standings={standingsLap2} currentLap={2} totalLaps={57} />
      );
    });

    // HAM gained 1 position (2→1), VER lost 1 (1→2)
    expect(screen.getByLabelText('Gained 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Lost 1')).toBeInTheDocument();

    jest.useRealTimers();
  });
});
