import { useMemo } from 'react'
import { useSessionStore } from '@/stores/sessionStore'
import type { StandingRow } from '@/types/session'

/**
 * Display representation for each tire compound.
 * Letter + color are used to render the tire indicator in the standings table.
 */
export const COMPOUND_DISPLAY: Record<string, { letter: string; color: string }> = {
  SOFT: { letter: 'S', color: '#E8002D' },
  MEDIUM: { letter: 'M', color: '#FFF200' },
  HARD: { letter: 'H', color: '#FFFFFF' },
  INTERMEDIATE: { letter: 'I', color: '#39B54A' },
  WET: { letter: 'W', color: '#0067FF' },
}

/**
 * Computes StandingRow[] for the current replay lap from the session store.
 *
 * Gap/interval uses LapRow.Time (session elapsed time at lap end),
 * NOT LapTime (individual lap duration). This avoids cumulative error
 * from safety cars and pit stops.
 */
export function useStandingsData(): StandingRow[] {
  const laps = useSessionStore((s) => s.laps)
  const drivers = useSessionStore((s) => s.drivers)
  const currentLap = useSessionStore((s) => s.currentLap)

  return useMemo(() => {
    if (laps.length === 0) return []

    // Build driver info lookup
    const driverMap = new Map(drivers.map((d) => [d.abbreviation, d]))

    // Rows for the current lap — one per driver
    const currentLapRows = laps.filter((l) => l.LapNumber === currentLap)

    // Rows for the previous lap — for position delta and compound change detection
    const prevLapRows = currentLap > 1 ? laps.filter((l) => l.LapNumber === currentLap - 1) : []

    // O(1) lookup for previous lap position and compound
    const prevPositionMap = new Map(prevLapRows.map((l) => [l.Driver, l.Position]))
    const prevCompoundMap = new Map(prevLapRows.map((l) => [l.Driver, l.Compound]))

    // Sort by position (null positions go to bottom)
    const sortedRows = [...currentLapRows].sort(
      (a, b) => (a.Position ?? 99) - (b.Position ?? 99)
    )

    if (sortedRows.length === 0) return []

    // Compute max completed lap per driver up to currentLap (for lapped car detection)
    const maxLapByDriver = new Map<string, number>()
    for (const l of laps) {
      if (l.LapNumber !== null && l.LapNumber <= currentLap) {
        const prev = maxLapByDriver.get(l.Driver) ?? 0
        if (l.LapNumber > prev) maxLapByDriver.set(l.Driver, l.LapNumber)
      }
    }
    const leaderMaxLap = maxLapByDriver.get(sortedRows[0]?.Driver ?? '') ?? currentLap

    // Compute pit stop count per driver up to currentLap
    const pitCountMap = new Map<string, number>()
    for (const l of laps) {
      if (l.LapNumber !== null && l.LapNumber <= currentLap && l.PitInTime !== null) {
        pitCountMap.set(l.Driver, (pitCountMap.get(l.Driver) ?? 0) + 1)
      }
    }

    // Leader session time for gap calculation
    const leaderTime = sortedRows[0]?.Time ?? null

    // Build StandingRow[] — track last non-null Time for interval calculation
    let lastValidTime: number | null = leaderTime

    return sortedRows.map((row, index) => {
      const info = driverMap.get(row.Driver)
      const driverMaxLap = maxLapByDriver.get(row.Driver) ?? 0
      const lapsDown = Math.max(0, leaderMaxLap - driverMaxLap)
      const isLapped = lapsDown > 0

      // Gap: only for non-leaders on the lead lap with valid times
      let gap: number | null = null
      if (index > 0 && !isLapped && leaderTime !== null && row.Time !== null) {
        gap = row.Time - leaderTime
      }

      // Interval: only for non-leaders on the lead lap
      let interval: number | null = null
      if (index > 0 && !isLapped && row.Time !== null && lastValidTime !== null) {
        interval = row.Time - lastValidTime
      }

      // Advance last valid time for next row's interval calculation
      if (row.Time !== null) {
        lastValidTime = row.Time
      }

      const prevPosition = prevPositionMap.get(row.Driver) ?? null

      // Compound change: only meaningful after lap 1
      const compoundChanged =
        currentLap > 1 &&
        row.Compound !== null &&
        prevCompoundMap.has(row.Driver) &&
        prevCompoundMap.get(row.Driver) !== row.Compound

      return {
        driver: row.Driver,
        fullName: info?.fullName ?? row.Driver,
        teamColor: info?.teamColor ?? '#888888',
        position: row.Position ?? 99,
        prevPosition: prevPosition !== undefined ? prevPosition : null,
        gap,
        interval,
        isLapped,
        lapsDown,
        compound: row.Compound,
        tyreLife: row.TyreLife,
        pitStops: pitCountMap.get(row.Driver) ?? 0,
        compoundChanged,
      } satisfies StandingRow
    })
  }, [laps, drivers, currentLap])
}
