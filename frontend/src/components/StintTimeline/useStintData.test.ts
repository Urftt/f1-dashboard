import { describe, it, expect } from 'vitest'
import type { LapRow, DriverInfo } from '@/types/session'
import {
  deriveStints,
  computeVisibleStints,
  computeDriverOrder,
  buildStintTraces,
} from './useStintData'

// ---- Test data helpers ----

function makeLap(
  overrides: Partial<LapRow> & { Driver: string; LapNumber: number }
): LapRow {
  return {
    LapNumber: overrides.LapNumber,
    Driver: overrides.Driver,
    Team: overrides.Team ?? null,
    LapTime: overrides.LapTime ?? null,
    Time: overrides.Time ?? null,
    PitInTime: overrides.PitInTime ?? null,
    PitOutTime: overrides.PitOutTime ?? null,
    Compound: overrides.Compound ?? null,
    TyreLife: overrides.TyreLife ?? null,
    Position: overrides.Position ?? null,
    Stint: overrides.Stint ?? 1,
  }
}

function makeDriver(
  abbreviation: string,
  overrides?: Partial<DriverInfo>
): DriverInfo {
  return {
    abbreviation,
    fullName: overrides?.fullName ?? `${abbreviation} Driver`,
    team: overrides?.team ?? 'TestTeam',
    teamColor: overrides?.teamColor ?? '#ffffff',
  }
}

// 3 drivers, VER: 2 stints, HAM: 2 stints, LEC: 1 stint
// Some null Compounds mid-stint to verify last-non-null logic
const mockLaps: LapRow[] = [
  // VER stint 1: laps 1-20, SOFT
  ...Array.from({ length: 20 }, (_, i) =>
    makeLap({
      Driver: 'VER',
      LapNumber: i + 1,
      Stint: 1,
      Compound: i === 10 ? null : 'SOFT', // lap 11 has null compound
      TyreLife: i + 1,
      Position: 1,
    })
  ),
  // VER stint 2: laps 21-50, MEDIUM
  ...Array.from({ length: 30 }, (_, i) =>
    makeLap({
      Driver: 'VER',
      LapNumber: i + 21,
      Stint: 2,
      Compound: 'MEDIUM',
      TyreLife: i + 1,
      Position: 1,
    })
  ),
  // HAM stint 1: laps 1-25, HARD
  ...Array.from({ length: 25 }, (_, i) =>
    makeLap({
      Driver: 'HAM',
      LapNumber: i + 1,
      Stint: 1,
      Compound: 'HARD',
      TyreLife: i + 1,
      Position: 2,
    })
  ),
  // HAM stint 2: laps 26-50, SOFT
  ...Array.from({ length: 25 }, (_, i) =>
    makeLap({
      Driver: 'HAM',
      LapNumber: i + 26,
      Stint: 2,
      Compound: 'SOFT',
      TyreLife: i + 1,
      Position: 2,
    })
  ),
  // LEC stint 1: laps 1-50, MEDIUM (same compound across whole race)
  ...Array.from({ length: 50 }, (_, i) =>
    makeLap({
      Driver: 'LEC',
      LapNumber: i + 1,
      Stint: 1,
      Compound: 'MEDIUM',
      TyreLife: i + 1,
      Position: 3,
    })
  ),
]

const mockDrivers: DriverInfo[] = [
  makeDriver('VER'),
  makeDriver('HAM'),
  makeDriver('LEC'),
]

// ---- deriveStints ----

describe('deriveStints', () => {
  it('produces one stint per driver-stint combination', () => {
    const stints = deriveStints(mockLaps)
    expect(stints.length).toBe(5) // VER:2, HAM:2, LEC:1
  })

  it('groups by Stint integer, not Compound', () => {
    // VER uses same compound (SOFT) across all of stint 1, so it's one stint
    const stints = deriveStints(mockLaps)
    const verStints = stints.filter((s) => s.driver === 'VER')
    expect(verStints.length).toBe(2)
  })

  it('correctly identifies startLap and endLap for a stint', () => {
    const stints = deriveStints(mockLaps)
    const verStint1 = stints.find((s) => s.driver === 'VER' && s.stintNumber === 1)
    expect(verStint1?.startLap).toBe(1)
    expect(verStint1?.endLap).toBe(20)
  })

  it('uses last non-null Compound in a stint group', () => {
    // VER stint 1 lap 11 has null compound — should still resolve to SOFT
    const stints = deriveStints(mockLaps)
    const verStint1 = stints.find((s) => s.driver === 'VER' && s.stintNumber === 1)
    expect(verStint1?.compound).toBe('SOFT')
  })

  it('skips laps with null LapNumber', () => {
    const lapsWithNull = [
      ...mockLaps,
      { ...mockLaps[0], LapNumber: null, Driver: 'TST', Stint: 1 },
    ]
    const stints = deriveStints(lapsWithNull)
    expect(stints.some((s) => s.driver === 'TST')).toBe(false)
  })

  it('skips laps with null Stint', () => {
    const lapsWithNull = [
      ...mockLaps,
      { ...mockLaps[0], LapNumber: 1, Driver: 'TST', Stint: null },
    ]
    const stints = deriveStints(lapsWithNull)
    expect(stints.some((s) => s.driver === 'TST')).toBe(false)
  })

  it('correctly records tyreLifeAtEnd from last lap of stint', () => {
    const stints = deriveStints(mockLaps)
    const verStint1 = stints.find((s) => s.driver === 'VER' && s.stintNumber === 1)
    // TyreLife on last lap of VER stint 1 (lap 20) = 20
    expect(verStint1?.tyreLifeAtEnd).toBe(20)
  })
})

// ---- computeVisibleStints ----

describe('computeVisibleStints', () => {
  const allStints = deriveStints(mockLaps)

  it('returns only stints where startLap <= currentLap', () => {
    // At lap 20, VER stint 2 starts at lap 21 — should not appear
    const visible = computeVisibleStints(allStints, 20)
    expect(visible.some((s) => s.driver === 'VER' && s.stintNumber === 2)).toBe(false)
  })

  it('includes stints where startLap == currentLap', () => {
    // At lap 21, VER stint 2 starts — should appear
    const visible = computeVisibleStints(allStints, 21)
    expect(visible.some((s) => s.driver === 'VER' && s.stintNumber === 2)).toBe(true)
  })

  it('clips endLap to currentLap when stint is ongoing', () => {
    // At lap 20, VER stint 1 ends at lap 20 — endLap should be min(20, 20) = 20
    const visible = computeVisibleStints(allStints, 15)
    const verStint1 = visible.find((s) => s.driver === 'VER' && s.stintNumber === 1)
    expect(verStint1?.endLap).toBe(15)
  })

  it('does not clip endLap when stint already ended before currentLap', () => {
    // At lap 30, VER stint 1 ended at lap 20 — endLap stays 20
    const visible = computeVisibleStints(allStints, 30)
    const verStint1 = visible.find((s) => s.driver === 'VER' && s.stintNumber === 1)
    expect(verStint1?.endLap).toBe(20)
  })

  it('returns empty array when currentLap is 0', () => {
    expect(computeVisibleStints(allStints, 0)).toEqual([])
  })
})

// ---- computeDriverOrder ----

describe('computeDriverOrder', () => {
  it('sorts drivers by position ascending at currentLap', () => {
    // At lap 1, VER=P1, HAM=P2, LEC=P3
    const order = computeDriverOrder(mockLaps, mockDrivers, 1)
    expect(order[0].driver).toBe('VER')
    expect(order[1].driver).toBe('HAM')
    expect(order[2].driver).toBe('LEC')
  })

  it('formats driver label as "P{pos} {abbreviation}"', () => {
    const order = computeDriverOrder(mockLaps, mockDrivers, 1)
    expect(order[0].label).toBe('P1 VER')
    expect(order[1].label).toBe('P2 HAM')
  })

  it('includes drivers not in laps array with null position sorted to end', () => {
    const driversWithExtra = [...mockDrivers, makeDriver('NOR')]
    const order = computeDriverOrder(mockLaps, driversWithExtra, 1)
    expect(order[order.length - 1].driver).toBe('NOR')
  })

  it('returns correct position at currentLap, not always first lap', () => {
    // At lap 30, we still have VER P1, HAM P2, LEC P3 (unchanged in mock data)
    const order = computeDriverOrder(mockLaps, mockDrivers, 30)
    expect(order[0].driver).toBe('VER')
  })
})

// ---- buildStintTraces ----

describe('buildStintTraces', () => {
  const allStints = deriveStints(mockLaps)
  const visible = computeVisibleStints(allStints, 50)
  const order = computeDriverOrder(mockLaps, mockDrivers, 50)
  const traces = buildStintTraces(visible, order)

  it('returns a single trace', () => {
    expect(traces.length).toBe(1)
  })

  it('trace has horizontal bar orientation', () => {
    expect(traces[0].orientation).toBe('h')
  })

  it('x array length equals number of visible stints', () => {
    // 5 stints total at lap 50
    expect((traces[0].x as number[]).length).toBe(5)
  })

  it('y array contains driver labels', () => {
    const labels = traces[0].y as string[]
    expect(labels.some((l) => l.startsWith('P1 VER'))).toBe(true)
  })

  it('marker.color array contains compound hex colors', () => {
    const colors = (traces[0].marker as { color: string[] }).color
    // SOFT = #e10600, MEDIUM = #ffd700, HARD = #ffffff
    expect(colors.some((c) => c === '#e10600')).toBe(true)
    expect(colors.some((c) => c === '#ffd700')).toBe(true)
  })

  it('text array contains compound letters', () => {
    const text = traces[0].text as string[]
    expect(text.some((t) => t === 'S')).toBe(true) // SOFT
    expect(text.some((t) => t === 'M')).toBe(true) // MEDIUM
    expect(text.some((t) => t === 'H')).toBe(true) // HARD
  })

  it('x values represent stint lengths (endLap - startLap + 1)', () => {
    // VER stint 1: laps 1-20 = length 20
    const verStint1 = allStints.find((s) => s.driver === 'VER' && s.stintNumber === 1)!
    const expectedLength = verStint1.endLap - verStint1.startLap + 1
    const xValues = traces[0].x as number[]
    expect(xValues.some((x) => x === expectedLength)).toBe(true)
  })

  it('base array contains startLap values', () => {
    // VER stint 2 starts at lap 21
    // Cast through unknown because Plotly.PlotData typings omit `base`
    const base = (traces[0] as unknown as { base: number[] }).base
    expect(base.some((b) => b === 21)).toBe(true)
  })

  it('returns empty trace arrays when no visible stints', () => {
    const emptyTraces = buildStintTraces([], order)
    expect(emptyTraces.length).toBe(1)
    expect((emptyTraces[0].x as number[]).length).toBe(0)
  })
})
