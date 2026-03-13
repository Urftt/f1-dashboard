import { useMemo } from 'react'
import { useSessionStore } from '@/stores/sessionStore'
import type { StandingRow, DriverStatus } from '@/types/session'

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
 * Drivers who DNF or finish early remain in the standings, marked with
 * their status and sorted below active drivers.
 */
export function useStandingsData(): StandingRow[] {
  const laps = useSessionStore((s) => s.laps)
  const drivers = useSessionStore((s) => s.drivers)
  const currentLap = useSessionStore((s) => s.currentLap)
  return useMemo(() => {
    if (laps.length === 0) return []

    // Build driver info lookup
    const driverMap = new Map(drivers.map((d) => [d.abbreviation, d]))

    // Collect all unique drivers and their last available lap data
    const lastLapByDriver = new Map<string, typeof laps[number]>()
    const maxLapByDriver = new Map<string, number>()

    for (const l of laps) {
      if (l.LapNumber !== null && l.LapNumber <= currentLap) {
        const prev = maxLapByDriver.get(l.Driver) ?? 0
        if (l.LapNumber > prev) {
          maxLapByDriver.set(l.Driver, l.LapNumber)
          lastLapByDriver.set(l.Driver, l)
        }
      }
    }

    // Rows for the current lap — one per driver
    const currentLapRows = new Map(
      laps.filter((l) => l.LapNumber === currentLap).map((l) => [l.Driver, l])
    )

    // Rows for the previous lap — for position delta and compound change detection
    const prevLapRows = currentLap > 1 ? laps.filter((l) => l.LapNumber === currentLap - 1) : []
    const prevPositionMap = new Map(prevLapRows.map((l) => [l.Driver, l.Position]))
    const prevCompoundMap = new Map(prevLapRows.map((l) => [l.Driver, l.Compound]))

    // Find the overall max lap any driver has reached (to detect race length)
    let globalMaxLap = 0
    for (const lap of maxLapByDriver.values()) {
      if (lap > globalMaxLap) globalMaxLap = lap
    }

    // Determine status for each driver
    const allDriverAbbrevs = new Set<string>()
    for (const l of laps) allDriverAbbrevs.add(l.Driver)

    // Pit stop count per driver up to currentLap
    const pitCountMap = new Map<string, number>()
    for (const l of laps) {
      if (l.LapNumber !== null && l.LapNumber <= currentLap && l.PitInTime !== null) {
        pitCountMap.set(l.Driver, (pitCountMap.get(l.Driver) ?? 0) + 1)
      }
    }

    // Build rows for ALL drivers
    const activeRows: Array<{ row: typeof laps[number]; status: DriverStatus; retiredOnLap: number | null }> = []
    const inactiveRows: Array<{ row: typeof laps[number]; status: DriverStatus; retiredOnLap: number | null }> = []

    for (const abbrev of allDriverAbbrevs) {
      const currentRow = currentLapRows.get(abbrev)
      const lastRow = lastLapByDriver.get(abbrev)
      const driverMaxLap = maxLapByDriver.get(abbrev) ?? 0

      if (!lastRow) continue // no data at all for this driver

      if (currentRow) {
        // Driver has data at current lap — still racing
        activeRows.push({ row: currentRow, status: 'racing', retiredOnLap: null })
      } else {
        // Driver missing from current lap — DNF or finished
        // If their last lap is near the total laps, they finished; otherwise DNF
        // If the driver's last lap is close to the global max, they finished the race
        const isFinished = driverMaxLap >= globalMaxLap - 1
        const status: DriverStatus = isFinished ? 'finished' : 'dnf'
        inactiveRows.push({ row: lastRow, status, retiredOnLap: driverMaxLap })
      }
    }

    // Normalize position: treat 99 from the API as "no real position"
    const realPosition = (p: number | null) => (p !== null && p < 99) ? p : null
    const sortByPosition = (a: typeof activeRows[number], b: typeof activeRows[number]) =>
      (realPosition(a.row.Position) ?? 999) - (realPosition(b.row.Position) ?? 999)

    // Sort active rows by position (null/99 positions sink to bottom)
    activeRows.sort(sortByPosition)

    // Sort inactive rows by their last known position
    inactiveRows.sort(sortByPosition)

    const allRows = [...activeRows, ...inactiveRows]
    if (allRows.length === 0) return []

    // Leader time for gap calculation (first active row)
    const leaderTime = activeRows[0]?.row.Time ?? null
    const leaderMaxLap = maxLapByDriver.get(activeRows[0]?.row.Driver ?? '') ?? currentLap

    let lastValidTime: number | null = leaderTime

    return allRows.map((entry, index) => {
      const { row, status, retiredOnLap } = entry
      const info = driverMap.get(row.Driver)
      const driverMaxLap = maxLapByDriver.get(row.Driver) ?? 0
      const lapsDown = Math.max(0, leaderMaxLap - driverMaxLap)
      const isLapped = status === 'racing' && lapsDown > 0

      // Gap/interval only for active racing drivers
      let gap: number | null = null
      let interval: number | null = null

      if (status === 'racing') {
        if (index > 0 && !isLapped && leaderTime !== null && row.Time !== null) {
          gap = row.Time - leaderTime
        }
        if (index > 0 && !isLapped && row.Time !== null && lastValidTime !== null) {
          interval = row.Time - lastValidTime
        }
        if (row.Time !== null) {
          lastValidTime = row.Time
        }
      }

      const prevPosition = prevPositionMap.get(row.Driver) ?? null

      const compoundChanged =
        status === 'racing' &&
        currentLap > 1 &&
        row.Compound !== null &&
        prevCompoundMap.has(row.Driver) &&
        prevCompoundMap.get(row.Driver) !== row.Compound

      return {
        driver: row.Driver,
        fullName: info?.fullName ?? row.Driver,
        teamColor: info?.teamColor ?? '#888888',
        position: realPosition(row.Position),
        prevPosition: status === 'racing' ? prevPosition : null,
        gap,
        interval,
        isLapped,
        lapsDown,
        compound: row.Compound,
        tyreLife: row.TyreLife,
        pitStops: pitCountMap.get(row.Driver) ?? 0,
        compoundChanged,
        status,
        retiredOnLap,
      } satisfies StandingRow
    })
  }, [laps, drivers, currentLap])
}
