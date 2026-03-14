import { describe, it, expect } from 'vitest'
import type { LapRow, DriverInfo, SectorRow } from '@/types/session'
import { buildHeatmapData, buildLapCursorShapes } from './useSectorData'

// ---- Test data helpers ----

function makeSectorRow(
  overrides: Partial<SectorRow> & { driver: string; lapNumber: number }
): SectorRow {
  return {
    driver: overrides.driver,
    lapNumber: overrides.lapNumber,
    s1: 's1' in overrides ? (overrides.s1 as number | null) : 28.5,
    s2: 's2' in overrides ? (overrides.s2 as number | null) : 33.2,
    s3: 's3' in overrides ? (overrides.s3 as number | null) : 26.1,
  }
}

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

// ---- buildHeatmapData tests ----

describe('buildHeatmapData', () => {
  const drivers = [makeDriver('VER'), makeDriver('HAM'), makeDriver('LEC')]

  // Basic laps: VER P1, HAM P2, LEC P3 at all laps
  const baseLaps: LapRow[] = [
    makeLap({ Driver: 'VER', LapNumber: 1, Position: 1 }),
    makeLap({ Driver: 'HAM', LapNumber: 1, Position: 2 }),
    makeLap({ Driver: 'LEC', LapNumber: 1, Position: 3 }),
    makeLap({ Driver: 'VER', LapNumber: 2, Position: 1 }),
    makeLap({ Driver: 'HAM', LapNumber: 2, Position: 2 }),
    makeLap({ Driver: 'LEC', LapNumber: 2, Position: 3 }),
    makeLap({ Driver: 'VER', LapNumber: 3, Position: 1 }),
    makeLap({ Driver: 'HAM', LapNumber: 3, Position: 2 }),
    makeLap({ Driver: 'LEC', LapNumber: 3, Position: 3 }),
  ]

  it('returns correct z-matrix dimensions: visibleDrivers rows x maxLap*3 cols', () => {
    const sectorRows = [
      makeSectorRow({ driver: 'VER', lapNumber: 2, s1: 28.0, s2: 33.0, s3: 26.0 }),
      makeSectorRow({ driver: 'HAM', lapNumber: 2, s1: 29.0, s2: 34.0, s3: 27.0 }),
    ]
    const visible = new Set(['VER', 'HAM'])
    const result = buildHeatmapData(sectorRows, baseLaps, drivers, visible, 3)

    expect(result.z.length).toBe(2) // 2 visible drivers
    expect(result.z[0].length).toBe(2 * 3) // maxLap=2, 3 sectors per lap
  })

  it('session best cell gets sentinel -1.0', () => {
    // VER has the session best S1 at 28.0
    const sectorRows = [
      makeSectorRow({ driver: 'VER', lapNumber: 2, s1: 28.0, s2: 33.0, s3: 26.0 }),
      makeSectorRow({ driver: 'VER', lapNumber: 3, s1: 29.0, s2: 34.0, s3: 27.0 }),
      makeSectorRow({ driver: 'HAM', lapNumber: 2, s1: 29.5, s2: 34.5, s3: 27.5 }),
      makeSectorRow({ driver: 'HAM', lapNumber: 3, s1: 30.0, s2: 35.0, s3: 28.0 }),
    ]
    const visible = new Set(['VER', 'HAM'])
    const result = buildHeatmapData(sectorRows, baseLaps, drivers, visible, 3)

    // VER is P1, so row 0. Lap 2 S1 = col (2-1)*3+0 = 3
    expect(result.z[0][3]).toBe(-1.0) // VER lap 2 S1 = 28.0 (session best)
  })

  it('personal best cell (not session best) gets sentinel -0.5', () => {
    const sectorRows = [
      makeSectorRow({ driver: 'VER', lapNumber: 2, s1: 28.0, s2: 33.0, s3: 26.0 }),
      makeSectorRow({ driver: 'VER', lapNumber: 3, s1: 29.0, s2: 34.0, s3: 27.0 }),
      makeSectorRow({ driver: 'HAM', lapNumber: 2, s1: 29.5, s2: 34.5, s3: 27.5 }),
      makeSectorRow({ driver: 'HAM', lapNumber: 3, s1: 30.0, s2: 35.0, s3: 28.0 }),
    ]
    const visible = new Set(['VER', 'HAM'])
    const result = buildHeatmapData(sectorRows, baseLaps, drivers, visible, 3)

    // HAM's personal best S1 is 29.5 (lap 2). Session best S1 is VER's 28.0.
    // So HAM lap 2 S1 = personal best (not session best) => -0.5
    // HAM is row 1. Lap 2 S1 = col 3
    expect(result.z[1][3]).toBe(-0.5)
  })

  it('missing sector data (null s1) produces null in z', () => {
    const sectorRows = [
      makeSectorRow({ driver: 'VER', lapNumber: 2, s1: null, s2: 33.0, s3: 26.0 }),
    ]
    const visible = new Set(['VER'])
    const result = buildHeatmapData(sectorRows, baseLaps, drivers, visible, 3)

    // Lap 2 S1 = col (2-1)*3+0 = 3
    expect(result.z[0][3]).toBeNull()
  })

  it('per-driver normalization: value between PB and worst = 0..1', () => {
    // VER: lap 2 S1=28.0 (PB), lap 3 S1=30.0 (worst clean)
    // Normalized lap 3: (30-28)/(30-28) = 1.0
    const sectorRows = [
      makeSectorRow({ driver: 'VER', lapNumber: 2, s1: 28.0, s2: 33.0, s3: 26.0 }),
      makeSectorRow({ driver: 'VER', lapNumber: 3, s1: 30.0, s2: 34.0, s3: 27.0 }),
    ]
    const visible = new Set(['VER'])
    const result = buildHeatmapData(sectorRows, baseLaps, drivers, visible, 3)

    // Lap 3 S1 = col (3-1)*3+0 = 6. 28.0 = session best = -1.0 for lap 2
    // Lap 3 S1 = (30-28)/(30-28) = 1.0
    expect(result.z[0][6]).toBeCloseTo(1.0)
  })

  it('zero denominator guard: single data point returns -0.5', () => {
    const sectorRows = [
      makeSectorRow({ driver: 'VER', lapNumber: 2, s1: 28.0, s2: 33.0, s3: 26.0 }),
    ]
    const visible = new Set(['VER'])
    const result = buildHeatmapData(sectorRows, baseLaps, drivers, visible, 3)

    // Only one data point for VER: worstClean === personalBest => -0.5 or session best -1.0
    // Since it's both session best and personal best, check that it's -1.0 (session best takes priority)
    // Actually with only VER visible, VER's 28.0 IS the session best
    expect(result.z[0][3]).toBe(-1.0)
  })

  it('zero denominator with two drivers: personal best that is not session best', () => {
    // HAM has only one data point per sector — personalBest === worstClean
    const sectorRows = [
      makeSectorRow({ driver: 'VER', lapNumber: 2, s1: 27.0, s2: 32.0, s3: 25.0 }),
      makeSectorRow({ driver: 'HAM', lapNumber: 2, s1: 29.0, s2: 34.0, s3: 27.0 }),
    ]
    const visible = new Set(['VER', 'HAM'])
    const result = buildHeatmapData(sectorRows, baseLaps, drivers, visible, 3)

    // HAM (row 1) lap 2 S1: personal best but not session best, zero denom => -0.5
    expect(result.z[1][3]).toBe(-0.5)
  })

  it('progressive reveal: lap > currentLap not included in z', () => {
    const sectorRows = [
      makeSectorRow({ driver: 'VER', lapNumber: 2, s1: 28.0, s2: 33.0, s3: 26.0 }),
      makeSectorRow({ driver: 'VER', lapNumber: 3, s1: 29.0, s2: 34.0, s3: 27.0 }),
    ]
    const visible = new Set(['VER'])
    // currentLap = 2, so lap 3 data should not be included
    const result = buildHeatmapData(sectorRows, baseLaps, drivers, visible, 2)

    // maxLap should be 2
    expect(result.maxLap).toBe(2)
    expect(result.z[0].length).toBe(6) // 2 laps * 3 sectors
  })

  it('rolling bests: only revealed laps contribute to best calculation', () => {
    // At currentLap=2, only lap 2 is visible. VER S1=28.0 is both session and personal best.
    // At currentLap=3, lap 3 is also visible with VER S1=27.0 — this is the new session best.
    const sectorRows = [
      makeSectorRow({ driver: 'VER', lapNumber: 2, s1: 28.0, s2: 33.0, s3: 26.0 }),
      makeSectorRow({ driver: 'VER', lapNumber: 3, s1: 27.0, s2: 32.0, s3: 25.0 }),
    ]
    const visible = new Set(['VER'])

    // At currentLap=2: VER lap 2 S1 = 28.0 is session best
    const result2 = buildHeatmapData(sectorRows, baseLaps, drivers, visible, 2)
    expect(result2.z[0][3]).toBe(-1.0) // session best

    // At currentLap=3: VER lap 3 S1 = 27.0 becomes session best
    const result3 = buildHeatmapData(sectorRows, baseLaps, drivers, visible, 3)
    // Lap 3 S1 = col 6 = -1.0 (new session best)
    expect(result3.z[0][6]).toBe(-1.0)
    // Lap 2 S1 = col 3 = no longer session best, not personal best either (27.0 is PB now)
    // (28-27)/(28-27) = 1.0 but worstClean for non-excluded laps
    // Wait: lap 2 is not excluded (no pit), lap 3 is not excluded. PB=27.0, worstClean=28.0
    // Lap 2 S1: (28-27)/(28-27) = 1.0
    expect(result3.z[0][3]).toBeCloseTo(1.0)
  })

  it('excluded laps (pit laps) do not affect worst-clean calculation', () => {
    // VER: lap 2 S1=28.0 (clean), lap 3 S1=35.0 (pit in lap = excluded from worst-clean)
    const lapsWithPit = [
      ...baseLaps,
    ]
    // Mark VER lap 3 as pit in
    const pitLaps = baseLaps.map((l) => {
      if (l.Driver === 'VER' && l.LapNumber === 3) {
        return { ...l, PitInTime: 1234.0 }
      }
      return l
    })

    const sectorRows = [
      makeSectorRow({ driver: 'VER', lapNumber: 2, s1: 28.0, s2: 33.0, s3: 26.0 }),
      makeSectorRow({ driver: 'VER', lapNumber: 3, s1: 35.0, s2: 40.0, s3: 32.0 }),
    ]
    const visible = new Set(['VER'])
    const result = buildHeatmapData(sectorRows, pitLaps, drivers, visible, 3)

    // worstClean for VER S1 should be 28.0 (only clean lap), not 35.0 (pit lap)
    // So VER lap 2 S1 = session best (28.0) => -1.0
    expect(result.z[0][3]).toBe(-1.0)
    // VER lap 3 S1 = 35.0, PB=28.0, worstClean=28.0 (zero denom since only one clean lap)
    // With only one clean data point: worstClean === personalBest => zero denom => -0.5 would be wrong
    // Actually PB=28.0. worstClean is computed from clean laps only. With pit laps excluded,
    // only lap 2 is clean, so worstClean=28.0. Zero denom: (35-28)/(28-28) => zero denom.
    // But the pit lap itself still gets a z-value. It should get -0.5 from the zero-denom guard
    // ...but 35.0 !== 28.0 (PB) and !== session best. With zero denom => -0.5
    expect(result.z[0][6]).toBe(-0.5)
  })

  it('driver ordering matches position at currentLap', () => {
    // HAM is P1 at lap 2, VER is P2
    const posLaps = [
      makeLap({ Driver: 'VER', LapNumber: 1, Position: 1 }),
      makeLap({ Driver: 'HAM', LapNumber: 1, Position: 2 }),
      makeLap({ Driver: 'VER', LapNumber: 2, Position: 2 }),
      makeLap({ Driver: 'HAM', LapNumber: 2, Position: 1 }),
    ]
    const sectorRows = [
      makeSectorRow({ driver: 'VER', lapNumber: 2, s1: 28.0, s2: 33.0, s3: 26.0 }),
      makeSectorRow({ driver: 'HAM', lapNumber: 2, s1: 29.0, s2: 34.0, s3: 27.0 }),
    ]
    const visible = new Set(['VER', 'HAM'])
    const result = buildHeatmapData(sectorRows, posLaps, drivers, visible, 2)

    // At lap 2: HAM P1 first, then VER P2
    expect(result.driverOrder[0]).toBe('HAM')
    expect(result.driverOrder[1]).toBe('VER')
    expect(result.y[0]).toBe('HAM')
    expect(result.y[1]).toBe('VER')
  })

  it('customdata contains raw time and delta', () => {
    const sectorRows = [
      makeSectorRow({ driver: 'VER', lapNumber: 2, s1: 28.0, s2: 33.0, s3: 26.0 }),
      makeSectorRow({ driver: 'VER', lapNumber: 3, s1: 29.0, s2: 34.0, s3: 27.0 }),
    ]
    const visible = new Set(['VER'])
    const result = buildHeatmapData(sectorRows, baseLaps, drivers, visible, 3)

    // Lap 3 S1 = col 6
    const cell = result.customdata[0][6]
    expect(cell).not.toBeNull()
    expect(cell!.rawTime).toBe(29.0)
    expect(cell!.delta).toBeCloseTo(1.0) // 29.0 - 28.0 PB
    expect(cell!.sector).toBe(1)
    expect(cell!.lapNumber).toBe(3)
  })

  it('x labels match column structure', () => {
    const sectorRows = [
      makeSectorRow({ driver: 'VER', lapNumber: 2, s1: 28.0, s2: 33.0, s3: 26.0 }),
    ]
    const visible = new Set(['VER'])
    const result = buildHeatmapData(sectorRows, baseLaps, drivers, visible, 3)

    expect(result.x[0]).toBe('L1S1')
    expect(result.x[1]).toBe('L1S2')
    expect(result.x[2]).toBe('L1S3')
    expect(result.x[3]).toBe('L2S1')
  })

  it('returns empty result when no visible drivers', () => {
    const sectorRows = [
      makeSectorRow({ driver: 'VER', lapNumber: 2, s1: 28.0, s2: 33.0, s3: 26.0 }),
    ]
    const visible = new Set<string>()
    const result = buildHeatmapData(sectorRows, baseLaps, drivers, visible, 3)

    expect(result.z).toEqual([])
    expect(result.driverOrder).toEqual([])
  })

  it('returns empty result when no sector data', () => {
    const visible = new Set(['VER'])
    const result = buildHeatmapData([], baseLaps, drivers, visible, 3)

    expect(result.z).toEqual([])
    expect(result.maxLap).toBe(0)
  })

  it('lap 1 is excluded from worst-clean calculation', () => {
    // Lap 1 is always excluded. If VER has high S1 on lap 1, it should not be worstClean.
    const sectorRows = [
      makeSectorRow({ driver: 'VER', lapNumber: 1, s1: 40.0, s2: 45.0, s3: 35.0 }), // lap 1, excluded
      makeSectorRow({ driver: 'VER', lapNumber: 2, s1: 28.0, s2: 33.0, s3: 26.0 }),
      makeSectorRow({ driver: 'VER', lapNumber: 3, s1: 29.0, s2: 34.0, s3: 27.0 }),
    ]
    const visible = new Set(['VER'])
    const result = buildHeatmapData(sectorRows, baseLaps, drivers, visible, 3)

    // VER PB S1 = 28.0, worstClean S1 = 29.0 (lap 1 excluded from worst)
    // Lap 3 S1 = (29-28)/(29-28) = 1.0
    expect(result.z[0][6]).toBeCloseTo(1.0)
    // Lap 2 S1 = 28.0 = session best => -1.0
    expect(result.z[0][3]).toBe(-1.0)
  })
})

// ---- buildLapCursorShapes tests ----

describe('buildLapCursorShapes', () => {
  it('returns rect shape at correct x-coordinates for current lap', () => {
    const shapes = buildLapCursorShapes(3, 10, 5)

    expect(shapes.length).toBe(1)
    const shape = shapes[0]
    expect(shape.type).toBe('rect')
    // Lap 3: x0 = (3-1)*3 - 0.5 = 5.5, x1 = (3-1)*3 + 2.5 = 8.5
    expect(shape.x0).toBe(5.5)
    expect(shape.x1).toBe(8.5)
    expect(shape.y0).toBe(-0.5)
    expect(shape.y1).toBe(4.5) // driverCount - 0.5 = 5 - 0.5
  })

  it('shape has white line color', () => {
    const shapes = buildLapCursorShapes(1, 5, 3)

    expect(shapes.length).toBe(1)
    expect((shapes[0] as any).line.color).toBe('rgba(255, 255, 255, 0.8)')
  })

  it('returns empty array for currentLap < 1', () => {
    expect(buildLapCursorShapes(0, 5, 3)).toEqual([])
  })

  it('returns empty array for currentLap > maxLap', () => {
    expect(buildLapCursorShapes(11, 10, 3)).toEqual([])
  })

  it('returns empty array for driverCount = 0', () => {
    expect(buildLapCursorShapes(3, 10, 0)).toEqual([])
  })

  it('lap 1 cursor at x0=-0.5, x1=2.5', () => {
    const shapes = buildLapCursorShapes(1, 10, 2)
    expect(shapes[0].x0).toBe(-0.5)
    expect(shapes[0].x1).toBe(2.5)
  })
})
