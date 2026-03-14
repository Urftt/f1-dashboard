import { describe, it, expect } from 'vitest'
import type { LapRow, DriverInfo, SafetyCarPeriod } from '@/types/session'
import {
  buildPositionTraces,
  buildEndOfLineAnnotations,
  buildSCShapes,
} from './usePositionData'

// ---- Test data helpers ----

function makeLap(
  overrides: Partial<LapRow> & { Driver: string; LapNumber: number }
): LapRow {
  return {
    LapNumber: overrides.LapNumber,
    Driver: overrides.Driver,
    Team: overrides.Team ?? null,
    LapTime: 'LapTime' in overrides ? (overrides.LapTime as number | null) : 90.0,
    Time: overrides.Time ?? null,
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

// Mock data: 3 drivers, 5 laps each, varying positions
const drivers: DriverInfo[] = [
  makeDriver('VER', '#3671C6'),
  makeDriver('HAM', '#00A19C'),
  makeDriver('LEC', '#E8002D'),
]

const laps: LapRow[] = [
  // VER: P1 -> P1 -> P2 -> P2 -> P1
  makeLap({ Driver: 'VER', LapNumber: 1, Position: 1 }),
  makeLap({ Driver: 'VER', LapNumber: 2, Position: 1 }),
  makeLap({ Driver: 'VER', LapNumber: 3, Position: 2 }),
  makeLap({ Driver: 'VER', LapNumber: 4, Position: 2 }),
  makeLap({ Driver: 'VER', LapNumber: 5, Position: 1 }),
  // HAM: P2 -> P2 -> P1 -> P3 -> P3
  makeLap({ Driver: 'HAM', LapNumber: 1, Position: 2 }),
  makeLap({ Driver: 'HAM', LapNumber: 2, Position: 2 }),
  makeLap({ Driver: 'HAM', LapNumber: 3, Position: 1 }),
  makeLap({ Driver: 'HAM', LapNumber: 4, Position: 3 }),
  makeLap({ Driver: 'HAM', LapNumber: 5, Position: 3 }),
  // LEC: P3 -> P3 -> P3 -> P1 -> P2
  makeLap({ Driver: 'LEC', LapNumber: 1, Position: 3 }),
  makeLap({ Driver: 'LEC', LapNumber: 2, Position: 3 }),
  makeLap({ Driver: 'LEC', LapNumber: 3, Position: 3 }),
  makeLap({ Driver: 'LEC', LapNumber: 4, Position: 1 }),
  makeLap({ Driver: 'LEC', LapNumber: 5, Position: 2 }),
]

// ---- buildPositionTraces ----

describe('buildPositionTraces', () => {
  it('returns one scattergl trace per visible driver', () => {
    const visibleDrivers = new Set(['VER', 'HAM', 'LEC'])
    const traces = buildPositionTraces(laps, drivers, visibleDrivers, 5)
    expect(traces.length).toBe(3)
    expect(traces.every((t) => t.type === 'scattergl')).toBe(true)
  })

  it('returns empty array when no visible drivers', () => {
    const traces = buildPositionTraces(laps, drivers, new Set(), 5)
    expect(traces.length).toBe(0)
  })

  it('returns only visible drivers traces', () => {
    const visibleDrivers = new Set(['VER'])
    const traces = buildPositionTraces(laps, drivers, visibleDrivers, 5)
    expect(traces.length).toBe(1)
    expect((traces[0] as any).name).toBe('VER')
  })

  it('uses mode lines+markers', () => {
    const visibleDrivers = new Set(['VER'])
    const traces = buildPositionTraces(laps, drivers, visibleDrivers, 5)
    expect(traces[0].mode).toBe('lines+markers')
  })

  it('line color matches driver teamColor', () => {
    const visibleDrivers = new Set(['VER'])
    const traces = buildPositionTraces(laps, drivers, visibleDrivers, 5)
    expect((traces[0] as any).line?.color).toBe('#3671C6')
  })

  it('progressive reveal: only shows laps up to currentLap', () => {
    const visibleDrivers = new Set(['VER'])
    const traces = buildPositionTraces(laps, drivers, visibleDrivers, 3)
    const xValues = traces[0].x as number[]
    expect(xValues.every((x) => x <= 3)).toBe(true)
    expect(xValues.length).toBe(3)
  })

  it('skips laps with Position === null', () => {
    const lapsWithNull: LapRow[] = [
      ...laps,
      makeLap({ Driver: 'VER', LapNumber: 6, Position: null }),
    ]
    const visibleDrivers = new Set(['VER'])
    const traces = buildPositionTraces(lapsWithNull, drivers, visibleDrivers, 10)
    const xValues = traces[0].x as number[]
    expect(xValues.includes(6)).toBe(false)
  })

  it('x values are LapNumber and y values are Position', () => {
    const visibleDrivers = new Set(['VER'])
    const traces = buildPositionTraces(laps, drivers, visibleDrivers, 2)
    const xValues = traces[0].x as number[]
    const yValues = traces[0].y as number[]
    expect(xValues).toEqual([1, 2])
    expect(yValues).toEqual([1, 1])
  })

  it('showlegend is false', () => {
    const visibleDrivers = new Set(['VER'])
    const traces = buildPositionTraces(laps, drivers, visibleDrivers, 5)
    expect(traces[0].showlegend).toBe(false)
  })
})

// ---- buildEndOfLineAnnotations ----

describe('buildEndOfLineAnnotations', () => {
  it('returns one annotation per visible driver', () => {
    const visibleDrivers = new Set(['VER', 'HAM'])
    const annotations = buildEndOfLineAnnotations(laps, drivers, visibleDrivers, 5)
    expect(annotations.length).toBe(2)
  })

  it('annotation text is driver abbreviation', () => {
    const visibleDrivers = new Set(['VER'])
    const annotations = buildEndOfLineAnnotations(laps, drivers, visibleDrivers, 5)
    expect(annotations[0].text).toBe('VER')
  })

  it('annotation is placed at the last visible lap', () => {
    const visibleDrivers = new Set(['VER'])
    const annotations = buildEndOfLineAnnotations(laps, drivers, visibleDrivers, 3)
    expect(annotations[0].x).toBe(3)
    expect(annotations[0].y).toBe(2) // VER position at lap 3 is P2
  })

  it('annotation xanchor is left', () => {
    const visibleDrivers = new Set(['VER'])
    const annotations = buildEndOfLineAnnotations(laps, drivers, visibleDrivers, 5)
    expect(annotations[0].xanchor).toBe('left')
  })

  it('annotation xshift is 4', () => {
    const visibleDrivers = new Set(['VER'])
    const annotations = buildEndOfLineAnnotations(laps, drivers, visibleDrivers, 5)
    expect((annotations[0] as any).xshift).toBe(4)
  })

  it('annotation showarrow is false', () => {
    const visibleDrivers = new Set(['VER'])
    const annotations = buildEndOfLineAnnotations(laps, drivers, visibleDrivers, 5)
    expect(annotations[0].showarrow).toBe(false)
  })

  it('returns empty array for no visible drivers', () => {
    const annotations = buildEndOfLineAnnotations(laps, drivers, new Set(), 5)
    expect(annotations.length).toBe(0)
  })

  it('respects progressive reveal - uses last lap <= currentLap', () => {
    const visibleDrivers = new Set(['VER'])
    const annotations = buildEndOfLineAnnotations(laps, drivers, visibleDrivers, 2)
    expect(annotations[0].x).toBe(2) // last lap at currentLap=2
  })
})

// ---- buildSCShapes ----

describe('buildSCShapes (position chart)', () => {
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
})
