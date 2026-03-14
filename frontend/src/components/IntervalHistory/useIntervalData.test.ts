import { describe, it, expect } from 'vitest'
import type { LapRow, DriverInfo, SafetyCarPeriod } from '@/types/session'
import {
  buildTimeLookup,
  buildIntervalTraces,
  buildDRSShapes,
  buildSCShapes,
  buildEndOfLineAnnotations,
} from './useIntervalData'

// ---- Test data helpers ----

function makeLap(
  overrides: Partial<LapRow> & { Driver: string; LapNumber: number }
): LapRow {
  return {
    LapNumber: overrides.LapNumber,
    Driver: overrides.Driver,
    Team: overrides.Team ?? null,
    LapTime: 'LapTime' in overrides ? (overrides.LapTime as number | null) : 90.0,
    Time: 'Time' in overrides ? (overrides.Time as number | null) : null,
    PitInTime: overrides.PitInTime ?? null,
    PitOutTime: overrides.PitOutTime ?? null,
    Compound: overrides.Compound ?? 'SOFT',
    TyreLife: overrides.TyreLife ?? null,
    Position: 'Position' in overrides ? (overrides.Position as number | null) : 1,
    Stint: overrides.Stint ?? 1,
  }
}

function makeDriver(
  abbreviation: string,
  teamColor = '#ff0000',
  team = 'TestTeam'
): DriverInfo {
  return { abbreviation, fullName: `${abbreviation} Driver`, team, teamColor }
}

// Mock data: 3 drivers, 5 laps
// Positions and cumulative times (seconds since session start)
// Lap 1: VER P1 (100s), HAM P2 (101s), LEC P3 (103s)
// Lap 2: VER P1 (200s), HAM P2 (201.5s), LEC P3 (204s)
// Lap 3: HAM P1 (300s), VER P2 (301.2s), LEC P3 (304s)
// Lap 4: VER P1 (400s), HAM P2 (401.8s), LEC P3 (405s)
// Lap 5: VER P1 (500s), HAM P2 (502s), LEC P3 (506s)
const drivers: DriverInfo[] = [
  makeDriver('VER', '#3671C6'),
  makeDriver('HAM', '#00A19C'),
  makeDriver('LEC', '#E8002D'),
]

const laps: LapRow[] = [
  // Lap 1
  makeLap({ Driver: 'VER', LapNumber: 1, Position: 1, Time: 100 }),
  makeLap({ Driver: 'HAM', LapNumber: 1, Position: 2, Time: 101 }),
  makeLap({ Driver: 'LEC', LapNumber: 1, Position: 3, Time: 103 }),
  // Lap 2
  makeLap({ Driver: 'VER', LapNumber: 2, Position: 1, Time: 200 }),
  makeLap({ Driver: 'HAM', LapNumber: 2, Position: 2, Time: 201.5 }),
  makeLap({ Driver: 'LEC', LapNumber: 2, Position: 3, Time: 204 }),
  // Lap 3: HAM overtakes to P1
  makeLap({ Driver: 'HAM', LapNumber: 3, Position: 1, Time: 300 }),
  makeLap({ Driver: 'VER', LapNumber: 3, Position: 2, Time: 301.2 }),
  makeLap({ Driver: 'LEC', LapNumber: 3, Position: 3, Time: 304 }),
  // Lap 4
  makeLap({ Driver: 'VER', LapNumber: 4, Position: 1, Time: 400 }),
  makeLap({ Driver: 'HAM', LapNumber: 4, Position: 2, Time: 401.8 }),
  makeLap({ Driver: 'LEC', LapNumber: 4, Position: 3, Time: 405 }),
  // Lap 5
  makeLap({ Driver: 'VER', LapNumber: 5, Position: 1, Time: 500 }),
  makeLap({ Driver: 'HAM', LapNumber: 5, Position: 2, Time: 502 }),
  makeLap({ Driver: 'LEC', LapNumber: 5, Position: 3, Time: 506 }),
]

// ---- buildTimeLookup ----

describe('buildTimeLookup', () => {
  it('returns a Map keyed by lap number', () => {
    const lookup = buildTimeLookup(laps)
    expect(lookup.has(1)).toBe(true)
    expect(lookup.has(5)).toBe(true)
  })

  it('inner map is keyed by position with correct Time values', () => {
    const lookup = buildTimeLookup(laps)
    const lap1 = lookup.get(1)!
    expect(lap1.get(1)).toBe(100)
    expect(lap1.get(2)).toBe(101)
    expect(lap1.get(3)).toBe(103)
  })

  it('skips laps with null LapNumber', () => {
    const lapsWithNull: LapRow[] = [
      ...laps,
      makeLap({ Driver: 'VER', LapNumber: 99, Position: 1, Time: null }),
    ]
    // Make one with null LapNumber by constructing directly
    const nullLap: LapRow = { ...makeLap({ Driver: 'VER', LapNumber: 1, Position: 2, Time: 999 }), LapNumber: null }
    const lookup = buildTimeLookup([...laps, nullLap])
    // The null lap shouldn't create any new entries that break the valid data
    const lap1 = lookup.get(1)!
    expect(lap1.get(1)).toBe(100) // original VER P1 still correct
  })

  it('skips laps with null Position', () => {
    const nullPosLap: LapRow = { ...makeLap({ Driver: 'HAM', LapNumber: 6, Position: 1, Time: 600 }), Position: null }
    const lookup = buildTimeLookup([...laps, nullPosLap])
    expect(lookup.has(6)).toBe(false)
  })

  it('skips laps with null Time', () => {
    const nullTimeLap = makeLap({ Driver: 'VER', LapNumber: 7, Position: 1, Time: null })
    const lookup = buildTimeLookup([...laps, nullTimeLap])
    expect(lookup.has(7)).toBe(false)
  })
})

// ---- buildIntervalTraces ----

describe('buildIntervalTraces', () => {
  const visibleAll = new Set(['VER', 'HAM', 'LEC'])

  it('returns scattergl traces', () => {
    const traces = buildIntervalTraces(laps, drivers, visibleAll, 5)
    expect(traces.every((t) => t.type === 'scattergl')).toBe(true)
  })

  it('returns two traces per visible driver (normal + dim)', () => {
    const traces = buildIntervalTraces(laps, drivers, visibleAll, 5)
    // 3 drivers x 2 = 6 traces max (dim trace may be empty but still returned)
    // Each driver should have exactly 2 traces: normal and dim
    const verTraces = traces.filter((t) => {
      const name = (t as any).name as string
      return name === 'VER' || name === 'VER_dim'
    })
    expect(verTraces.length).toBe(2)
  })

  it('excludes P1 laps (leader has no car ahead)', () => {
    const traces = buildIntervalTraces(laps, drivers, visibleAll, 5)
    const verNormal = traces.find((t) => (t as any).name === 'VER')!
    // VER is P1 on laps 1, 2, 4, 5 — only P2 on lap 3
    // So VER normal trace y-values should not contain many points
    // VER lap 3 position is P2 so interval should be computable
    const yValues = verNormal.y as (number | null)[]
    // All non-null y values should be positive (behind car ahead)
    yValues.filter((v) => v !== null).forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0)
    })
  })

  it('computes interval correctly: subject.Time - carAhead.Time', () => {
    // HAM is P2 on lap 2, VER is P1. Time: HAM=201.5, VER=200. Interval = 1.5s
    const traces = buildIntervalTraces(laps, drivers, new Set(['HAM']), 5)
    const hamNormal = traces.find((t) => (t as any).name === 'HAM')!
    const x = hamNormal.x as number[]
    const y = hamNormal.y as (number | null)[]
    const lap2Idx = x.indexOf(2)
    expect(lap2Idx).toBeGreaterThanOrEqual(0)
    expect(y[lap2Idx]).toBeCloseTo(1.5, 5)
  })

  it('clips intervals at CLIP_MAX (12s)', () => {
    // Create a scenario where interval is > 12s
    const bigGapLaps: LapRow[] = [
      makeLap({ Driver: 'VER', LapNumber: 1, Position: 1, Time: 100 }),
      makeLap({ Driver: 'HAM', LapNumber: 1, Position: 2, Time: 120 }), // 20s gap
    ]
    const traces = buildIntervalTraces(bigGapLaps, drivers, new Set(['HAM']), 5)
    const hamNormal = traces.find((t) => (t as any).name === 'HAM')!
    const y = hamNormal.y as (number | null)[]
    const nonNull = y.filter((v) => v !== null) as number[]
    expect(nonNull.every((v) => v <= 12)).toBe(true)
  })

  it('inserts null y when car-ahead data is missing (line break)', () => {
    // Only HAM visible; for laps where P1 data is missing, y should be null
    const incompleteLaps: LapRow[] = [
      makeLap({ Driver: 'HAM', LapNumber: 2, Position: 2, Time: 201.5 }),
      // VER (P1) lap 2 missing — so no car-ahead data
    ]
    const traces = buildIntervalTraces(incompleteLaps, drivers, new Set(['HAM']), 5)
    const hamNormal = traces.find((t) => (t as any).name === 'HAM')!
    const y = hamNormal.y as (number | null)[]
    // Since P1 data missing, HAM lap 2 y should be null
    expect(y.includes(null)).toBe(true)
  })

  it('connectgaps is false on all traces', () => {
    const traces = buildIntervalTraces(laps, drivers, visibleAll, 5)
    expect(traces.every((t) => (t as any).connectgaps === false)).toBe(true)
  })

  it('dim trace has opacity 0.3', () => {
    const traces = buildIntervalTraces(laps, drivers, visibleAll, 5)
    const dimTrace = traces.find((t) => ((t as any).name as string).endsWith('_dim'))!
    expect((dimTrace as any).opacity).toBe(0.3)
  })

  it('normal and dim traces for same driver share the same line color', () => {
    const traces = buildIntervalTraces(laps, drivers, new Set(['HAM']), 5)
    const normal = traces.find((t) => (t as any).name === 'HAM')!
    const dim = traces.find((t) => (t as any).name === 'HAM_dim')!
    expect((normal as any).line?.color).toBe((dim as any).line?.color)
    expect((normal as any).line?.color).toBe('#00A19C')
  })

  it('progressive reveal: only includes laps <= currentLap', () => {
    const traces = buildIntervalTraces(laps, drivers, new Set(['HAM']), 3)
    const hamNormal = traces.find((t) => (t as any).name === 'HAM')!
    const x = (hamNormal.x as number[]).filter((v) => v !== null)
    expect(x.every((v) => v <= 3)).toBe(true)
  })

  it('lap 1 goes into dim trace', () => {
    // Lap 1 should be in dim traces
    const lap1Only: LapRow[] = [
      makeLap({ Driver: 'VER', LapNumber: 1, Position: 1, Time: 100 }),
      makeLap({ Driver: 'HAM', LapNumber: 1, Position: 2, Time: 101 }),
    ]
    const traces = buildIntervalTraces(lap1Only, drivers, new Set(['HAM']), 5)
    const hamDim = traces.find((t) => (t as any).name === 'HAM_dim')!
    const hamNormal = traces.find((t) => (t as any).name === 'HAM')!
    const dimX = (hamDim.x as number[])
    const normalY = (hamNormal.y as (number | null)[]).filter((v) => v !== null)
    expect(dimX.includes(1)).toBe(true)
    expect(normalY.length).toBe(0)
  })

  it('pit laps go into dim trace', () => {
    const pitLaps: LapRow[] = [
      makeLap({ Driver: 'VER', LapNumber: 3, Position: 1, Time: 300 }),
      makeLap({ Driver: 'HAM', LapNumber: 3, Position: 2, Time: 302, PitInTime: 301.5 }), // HAM pitting
    ]
    const traces = buildIntervalTraces(pitLaps, drivers, new Set(['HAM']), 5)
    const hamDim = traces.find((t) => (t as any).name === 'HAM_dim')!
    const dimX = (hamDim.x as number[])
    expect(dimX.includes(3)).toBe(true)
  })

  it('returns empty array when no visible drivers', () => {
    const traces = buildIntervalTraces(laps, drivers, new Set(), 5)
    expect(traces.length).toBe(0)
  })

  it('showlegend is false on all traces', () => {
    const traces = buildIntervalTraces(laps, drivers, visibleAll, 5)
    expect(traces.every((t) => t.showlegend === false)).toBe(true)
  })
})

// ---- buildDRSShapes ----

describe('buildDRSShapes', () => {
  it('returns exactly 2 shapes', () => {
    const shapes = buildDRSShapes()
    expect(shapes.length).toBe(2)
  })

  it('first shape is a rect', () => {
    const shapes = buildDRSShapes()
    expect(shapes[0].type).toBe('rect')
  })

  it('second shape is a line', () => {
    const shapes = buildDRSShapes()
    expect(shapes[1].type).toBe('line')
  })

  it('rect has yref=y, y0=0, y1=1.0', () => {
    const shapes = buildDRSShapes()
    const rect = shapes[0]
    expect(rect.yref).toBe('y')
    expect(rect.y0).toBe(0)
    expect(rect.y1).toBe(1.0)
  })

  it('rect uses xref=paper for full width', () => {
    const shapes = buildDRSShapes()
    const rect = shapes[0]
    expect(rect.xref).toBe('paper')
  })

  it('dashed line has y0=y1=1.0 and yref=y', () => {
    const shapes = buildDRSShapes()
    const line = shapes[1]
    expect(line.y0).toBe(1.0)
    expect(line.y1).toBe(1.0)
    expect(line.yref).toBe('y')
  })

  it('dashed line uses xref=paper', () => {
    const shapes = buildDRSShapes()
    const line = shapes[1]
    expect(line.xref).toBe('paper')
  })
})

// ---- buildSCShapes ----

describe('buildSCShapes (interval chart)', () => {
  it('produces rect shapes for SC periods', () => {
    const scPeriods: SafetyCarPeriod[] = [
      { start_lap: 2, end_lap: 4, type: 'SC' },
    ]
    const shapes = buildSCShapes(scPeriods, 5)
    expect(shapes.length).toBe(1)
    expect(shapes[0].type).toBe('rect')
  })

  it('skips periods that have not started yet (progressive reveal)', () => {
    const scPeriods: SafetyCarPeriod[] = [
      { start_lap: 10, end_lap: 15, type: 'SC' },
    ]
    const shapes = buildSCShapes(scPeriods, 5)
    expect(shapes.length).toBe(0)
  })

  it('clamps end_lap to currentLap for active periods', () => {
    const scPeriods: SafetyCarPeriod[] = [
      { start_lap: 2, end_lap: 8, type: 'SC' },
    ]
    const shapes = buildSCShapes(scPeriods, 4)
    expect(shapes[0].x1).toBe(4)
  })

  it('does not clamp end_lap for completed periods', () => {
    const scPeriods: SafetyCarPeriod[] = [
      { start_lap: 2, end_lap: 4, type: 'SC' },
    ]
    const shapes = buildSCShapes(scPeriods, 5)
    expect(shapes[0].x1).toBe(4)
  })

  it('handles VSC periods with different fill color', () => {
    const vscPeriods: SafetyCarPeriod[] = [
      { start_lap: 3, end_lap: 5, type: 'VSC' },
    ]
    const shapes = buildSCShapes(vscPeriods, 5)
    expect(shapes.length).toBe(1)
    expect(shapes[0].fillcolor).toContain('rgba(255, 200, 0')
  })
})

// ---- buildEndOfLineAnnotations ----

describe('buildEndOfLineAnnotations (interval chart)', () => {
  it('returns one annotation per visible driver with valid interval data', () => {
    // All 3 drivers have at least one lap where Position > 1 with computable interval
    // VER is P2 on lap 3, HAM is P2 on laps 2/4/5, LEC is P3 on laps 1-4
    const timeLookup = buildTimeLookup(laps)
    const visibleDrivers = new Set(['VER', 'HAM', 'LEC'])
    const annotations = buildEndOfLineAnnotations(laps, drivers, visibleDrivers, 5, timeLookup)
    // VER last P2 lap is lap 3 (behind HAM), HAM last P2 is lap 5 (behind VER), LEC last P3 is lap 5
    expect(annotations.length).toBe(3)
  })

  it('annotation text is driver abbreviation', () => {
    const timeLookup = buildTimeLookup(laps)
    const annotations = buildEndOfLineAnnotations(laps, drivers, new Set(['HAM']), 5, timeLookup)
    expect(annotations[0].text).toBe('HAM')
  })

  it('annotation placed at interval y-value (not position)', () => {
    // HAM on lap 5: P2, Time=502. VER P1 Time=500. Interval = 2.0s
    const timeLookup = buildTimeLookup(laps)
    const annotations = buildEndOfLineAnnotations(laps, drivers, new Set(['HAM']), 5, timeLookup)
    expect(annotations[0].x).toBe(5)
    expect(annotations[0].y).toBeCloseTo(2.0, 5)
  })

  it('annotation xanchor is left', () => {
    const timeLookup = buildTimeLookup(laps)
    const annotations = buildEndOfLineAnnotations(laps, drivers, new Set(['HAM']), 5, timeLookup)
    expect(annotations[0].xanchor).toBe('left')
  })

  it('annotation xshift is 4', () => {
    const timeLookup = buildTimeLookup(laps)
    const annotations = buildEndOfLineAnnotations(laps, drivers, new Set(['HAM']), 5, timeLookup)
    expect((annotations[0] as any).xshift).toBe(4)
  })

  it('annotation showarrow is false', () => {
    const timeLookup = buildTimeLookup(laps)
    const annotations = buildEndOfLineAnnotations(laps, drivers, new Set(['HAM']), 5, timeLookup)
    expect(annotations[0].showarrow).toBe(false)
  })

  it('uses teamColor for font color', () => {
    const timeLookup = buildTimeLookup(laps)
    const annotations = buildEndOfLineAnnotations(laps, drivers, new Set(['HAM']), 5, timeLookup)
    expect((annotations[0] as any).font?.color).toBe('#00A19C')
  })

  it('respects progressive reveal - uses last lap <= currentLap', () => {
    const timeLookup = buildTimeLookup(laps)
    const annotations = buildEndOfLineAnnotations(laps, drivers, new Set(['HAM']), 3, timeLookup)
    // HAM at currentLap=3 is P1 on lap 3, so no interval — annotation at lap 2
    expect(annotations[0].x).toBe(2)
  })

  it('returns empty for no visible drivers', () => {
    const timeLookup = buildTimeLookup(laps)
    const annotations = buildEndOfLineAnnotations(laps, drivers, new Set(), 5, timeLookup)
    expect(annotations.length).toBe(0)
  })
})
