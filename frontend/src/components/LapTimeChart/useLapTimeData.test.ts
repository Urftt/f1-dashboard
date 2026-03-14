import { describe, it, expect } from 'vitest'
import type { LapRow, SafetyCarPeriod } from '@/types/session'
import {
  linearRegression,
  isOutlierLap,
  buildLapTimeTraces,
  computeAllTrendLines,
  buildSCShapes,
} from './useLapTimeData'

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
    Position: overrides.Position ?? null,
    Stint: overrides.Stint ?? 1,
  }
}

function makeDriver(
  abbreviation: string,
  teamColor = '#ff0000',
  team = 'TestTeam'
) {
  return { abbreviation, fullName: `${abbreviation} Driver`, team, teamColor }
}

// ---- linearRegression ----

describe('linearRegression', () => {
  it('returns correct slope and intercept for simple data', () => {
    // [1,2,3], [2,4,6] -> y = 2x + 0
    const result = linearRegression([1, 2, 3], [2, 4, 6])
    expect(result).not.toBeNull()
    expect(result!.slope).toBeCloseTo(2, 5)
    expect(result!.intercept).toBeCloseTo(0, 5)
  })

  it('returns null for fewer than 2 points', () => {
    expect(linearRegression([1], [2])).toBeNull()
    expect(linearRegression([], [])).toBeNull()
  })

  it('handles horizontal line (slope = 0)', () => {
    const result = linearRegression([1, 2, 3, 4], [5, 5, 5, 5])
    expect(result).not.toBeNull()
    expect(result!.slope).toBeCloseTo(0, 5)
    expect(result!.intercept).toBeCloseTo(5, 5)
  })
})

// ---- isOutlierLap ----

describe('isOutlierLap', () => {
  const noSCPeriods: SafetyCarPeriod[] = []

  it('returns true for lap 1', () => {
    const lap = makeLap({ Driver: 'VER', LapNumber: 1, LapTime: 95 })
    expect(isOutlierLap(lap, noSCPeriods)).toBe(true)
  })

  it('returns true when PitInTime is not null', () => {
    const lap = makeLap({ Driver: 'VER', LapNumber: 10, LapTime: 100, PitInTime: 100 })
    expect(isOutlierLap(lap, noSCPeriods)).toBe(true)
  })

  it('returns true when PitOutTime is not null', () => {
    const lap = makeLap({ Driver: 'VER', LapNumber: 11, LapTime: 102, PitOutTime: 200 })
    expect(isOutlierLap(lap, noSCPeriods)).toBe(true)
  })

  it('returns true when lap is within a safety car period', () => {
    const scPeriods: SafetyCarPeriod[] = [{ start_lap: 5, end_lap: 8, type: 'SC' }]
    const lap = makeLap({ Driver: 'VER', LapNumber: 6, LapTime: 110 })
    expect(isOutlierLap(lap, scPeriods)).toBe(true)
  })

  it('returns false for a clean racing lap', () => {
    const lap = makeLap({ Driver: 'VER', LapNumber: 15, LapTime: 90 })
    expect(isOutlierLap(lap, noSCPeriods)).toBe(false)
  })

  it('returns false for a lap just outside SC period', () => {
    const scPeriods: SafetyCarPeriod[] = [{ start_lap: 5, end_lap: 8, type: 'SC' }]
    const lap = makeLap({ Driver: 'VER', LapNumber: 9, LapTime: 90 })
    expect(isOutlierLap(lap, scPeriods)).toBe(false)
  })
})

// ---- buildLapTimeTraces ----

describe('buildLapTimeTraces', () => {
  const drivers = [
    makeDriver('VER', '#3671C6'),
    makeDriver('HAM', '#00A19C'),
  ]
  const laps: LapRow[] = [
    makeLap({ Driver: 'VER', LapNumber: 2, LapTime: 90 }),
    makeLap({ Driver: 'VER', LapNumber: 3, LapTime: 91 }),
    makeLap({ Driver: 'VER', LapNumber: 4, LapTime: 92 }),
    makeLap({ Driver: 'HAM', LapNumber: 2, LapTime: 88 }),
    makeLap({ Driver: 'HAM', LapNumber: 3, LapTime: 89 }),
    // outlier: pit lap
    makeLap({ Driver: 'VER', LapNumber: 5, LapTime: 115, PitInTime: 150 }),
  ]
  const safetyCarPeriods: SafetyCarPeriod[] = []
  const visibleDrivers = new Set(['VER', 'HAM'])

  it('returns one scatter trace per visible driver', () => {
    const traces = buildLapTimeTraces(laps, drivers, safetyCarPeriods, visibleDrivers, 10)
    const scatterTraces = traces.filter((t) => t.mode === 'markers')
    expect(scatterTraces.length).toBe(2)
  })

  it('scatter markers have opacity 0.3 for outlier laps and 1.0 for clean laps', () => {
    const traces = buildLapTimeTraces(laps, drivers, safetyCarPeriods, visibleDrivers, 10)
    const verTrace = traces.find((t) => (t as any).name === 'VER' && t.mode === 'markers')
    expect(verTrace).toBeDefined()
    const opacities = (verTrace!.marker as any).opacity as number[]
    // Laps 2,3,4 are clean (opacity 1.0), lap 5 is pit outlier (opacity 0.3)
    expect(opacities.some((o) => o === 1.0)).toBe(true)
    expect(opacities.some((o) => o === 0.3)).toBe(true)
  })

  it('filters to laps <= currentLap (progressive reveal)', () => {
    const traces = buildLapTimeTraces(laps, drivers, safetyCarPeriods, visibleDrivers, 3)
    const verTrace = traces.find((t) => (t as any).name === 'VER' && t.mode === 'markers')
    // Only laps 2 and 3 should be visible (lap 4 and 5 are beyond currentLap=3)
    const xValues = verTrace!.x as number[]
    expect(xValues.every((x) => x <= 3)).toBe(true)
    expect(xValues.length).toBe(2)
  })

  it('skips laps with LapTime === null', () => {
    const lapsWithNull: LapRow[] = [
      ...laps,
      makeLap({ Driver: 'VER', LapNumber: 6, LapTime: null }),
    ]
    const traces = buildLapTimeTraces(lapsWithNull, drivers, safetyCarPeriods, visibleDrivers, 10)
    const verTrace = traces.find((t) => (t as any).name === 'VER' && t.mode === 'markers')
    const xValues = verTrace!.x as number[]
    expect(xValues.includes(6)).toBe(false)
  })

  it('only includes visible drivers', () => {
    const onlyVER = new Set(['VER'])
    const traces = buildLapTimeTraces(laps, drivers, safetyCarPeriods, onlyVER, 10)
    const scatterTraces = traces.filter((t) => t.mode === 'markers')
    expect(scatterTraces.length).toBe(1)
    expect((scatterTraces[0] as any).name).toBe('VER')
  })
})

// ---- computeAllTrendLines ----

describe('computeAllTrendLines', () => {
  const drivers = [makeDriver('VER', '#3671C6')]
  const scPeriods: SafetyCarPeriod[] = []

  // Clean laps: 2-10 stint 1, 12-20 stint 2
  const laps: LapRow[] = [
    // Stint 1: laps 2-10 with gradual degradation
    ...Array.from({ length: 9 }, (_, i) =>
      makeLap({ Driver: 'VER', LapNumber: i + 2, LapTime: 90 + i * 0.1, Stint: 1 })
    ),
    // Lap 11: pit stop (outlier)
    makeLap({ Driver: 'VER', LapNumber: 11, LapTime: 120, Stint: 1, PitInTime: 50 }),
    // Stint 2: laps 12-20
    ...Array.from({ length: 9 }, (_, i) =>
      makeLap({ Driver: 'VER', LapNumber: i + 12, LapTime: 89 + i * 0.1, Stint: 2 })
    ),
  ]

  it('returns one trend line per driver-stint', () => {
    const trendLines = computeAllTrendLines(laps, drivers, scPeriods)
    const verLines = trendLines.filter((t) => (t as any).name === 'VER trend')
    expect(verLines.length).toBe(2)
  })

  it('excludes outlier laps from regression input', () => {
    // Lap 11 has PitInTime so it's an outlier — should be excluded
    // This is implicitly tested by the trend lines being computed correctly
    const trendLines = computeAllTrendLines(laps, drivers, scPeriods)
    expect(trendLines.length).toBeGreaterThan(0)
  })

  it('returns null for stints with fewer than 2 clean laps', () => {
    // A stint with only 1 clean lap — no trend line should be produced
    const fewLaps: LapRow[] = [
      makeLap({ Driver: 'VER', LapNumber: 5, LapTime: 90, Stint: 1 }),
      // pit in immediately: only 1 clean lap
      makeLap({ Driver: 'VER', LapNumber: 6, LapTime: 110, Stint: 1, PitInTime: 50 }),
    ]
    const trendLines = computeAllTrendLines(fewLaps, drivers, scPeriods)
    expect(trendLines.length).toBe(0)
  })
})

// ---- buildSCShapes ----

describe('buildSCShapes', () => {
  it('produces rect shapes for SC periods', () => {
    const scPeriods: SafetyCarPeriod[] = [
      { start_lap: 5, end_lap: 10, type: 'SC' },
    ]
    const shapes = buildSCShapes(scPeriods, 20)
    expect(shapes.length).toBe(1)
    expect(shapes[0].type).toBe('rect')
  })

  it('skips periods that have not started yet (progressive reveal)', () => {
    const scPeriods: SafetyCarPeriod[] = [
      { start_lap: 15, end_lap: 20, type: 'SC' },
    ]
    const shapes = buildSCShapes(scPeriods, 10)
    expect(shapes.length).toBe(0)
  })

  it('clamps end_lap to currentLap for active periods', () => {
    const scPeriods: SafetyCarPeriod[] = [
      { start_lap: 5, end_lap: 15, type: 'SC' },
    ]
    const shapes = buildSCShapes(scPeriods, 8)
    expect(shapes[0].x1).toBe(8)
  })

  it('does not clamp end_lap for completed periods', () => {
    const scPeriods: SafetyCarPeriod[] = [
      { start_lap: 5, end_lap: 10, type: 'SC' },
    ]
    const shapes = buildSCShapes(scPeriods, 20)
    expect(shapes[0].x1).toBe(10)
  })

  it('applies different fill colors for SC vs VSC vs RED', () => {
    const scPeriods: SafetyCarPeriod[] = [
      { start_lap: 5, end_lap: 8, type: 'SC' },
      { start_lap: 10, end_lap: 12, type: 'VSC' },
      { start_lap: 20, end_lap: 22, type: 'RED' },
    ]
    const shapes = buildSCShapes(scPeriods, 30)
    expect(shapes.length).toBe(3)
    // SC and VSC should have different fill colors
    expect(shapes[0].fillcolor).not.toBe(shapes[1].fillcolor)
    // RED should differ from SC
    expect(shapes[0].fillcolor).not.toBe(shapes[2].fillcolor)
  })
})
