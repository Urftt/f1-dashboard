import { describe, it, expect } from 'vitest'
import type { LapRow } from '@/types/session'
import { computeDefaultVisible } from './useVisibleDrivers'

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

// ---- computeDefaultVisible ----

describe('computeDefaultVisible', () => {
  it('returns top 2 drivers by lap 1 Position', () => {
    const laps: LapRow[] = [
      makeLap({ Driver: 'VER', LapNumber: 1, Position: 1 }),
      makeLap({ Driver: 'HAM', LapNumber: 1, Position: 2 }),
      makeLap({ Driver: 'LEC', LapNumber: 1, Position: 3 }),
      makeLap({ Driver: 'VER', LapNumber: 2, Position: 1 }),
      makeLap({ Driver: 'HAM', LapNumber: 2, Position: 2 }),
    ]
    const result = computeDefaultVisible(laps)
    expect(result.has('VER')).toBe(true)
    expect(result.has('HAM')).toBe(true)
    expect(result.has('LEC')).toBe(false)
    expect(result.size).toBe(2)
  })

  it('returns empty set when laps is empty', () => {
    const result = computeDefaultVisible([])
    expect(result.size).toBe(0)
  })

  it('handles ties by taking first two sorted by position', () => {
    // Two drivers at position 1 (tie) — both should be included as top 2
    const laps: LapRow[] = [
      makeLap({ Driver: 'VER', LapNumber: 1, Position: 1 }),
      makeLap({ Driver: 'HAM', LapNumber: 1, Position: 1 }),
      makeLap({ Driver: 'LEC', LapNumber: 1, Position: 2 }),
    ]
    const result = computeDefaultVisible(laps)
    // VER and HAM both have position 1 — they should be the first two
    expect(result.size).toBe(2)
    expect(result.has('VER')).toBe(true)
    expect(result.has('HAM')).toBe(true)
  })

  it('returns only available drivers when fewer than 2 have lap 1 data', () => {
    const laps: LapRow[] = [
      makeLap({ Driver: 'VER', LapNumber: 1, Position: 1 }),
    ]
    const result = computeDefaultVisible(laps)
    expect(result.size).toBe(1)
    expect(result.has('VER')).toBe(true)
  })

  it('ignores laps with null Position at lap 1', () => {
    const laps: LapRow[] = [
      makeLap({ Driver: 'VER', LapNumber: 1, Position: null }),
      makeLap({ Driver: 'HAM', LapNumber: 1, Position: 1 }),
      makeLap({ Driver: 'LEC', LapNumber: 1, Position: 2 }),
    ]
    const result = computeDefaultVisible(laps)
    expect(result.has('HAM')).toBe(true)
    expect(result.has('LEC')).toBe(true)
    expect(result.has('VER')).toBe(false)
  })
})
