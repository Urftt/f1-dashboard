import { useMemo } from 'react'
import { useSessionStore } from '@/stores/sessionStore'
import { getDriverColor, DRIVER_TEAMS } from '@/lib/driverColors'

/**
 * A Plotly trace segment for dynamic line coloring based on who is leading.
 */
export interface PlotlyTrace {
  x: number[]
  y: number[]
  type: 'scatter'
  mode: 'lines'
  line: { color: string; width: number }
  hovertemplate: string
  showlegend: false
}

/**
 * Result from useGapData.
 * - lapNumbers: shared lap numbers for both drivers
 * - gaps: gap in seconds per lap (positive = driverA leading, i.e. lower session time)
 * - segments: Plotly trace objects split by leader with team colors
 */
export interface GapDataResult {
  lapNumbers: number[]
  gaps: number[]
  segments: PlotlyTrace[]
}

/**
 * Computes gap-over-time data from laps in the session store.
 *
 * Gap calculation uses LapRow.Time (session elapsed time at lap end),
 * NOT LapTime (individual lap duration).
 *
 * gap = timeB - timeA (positive = A is leading because lower session time = completed lap sooner)
 */
export function useGapData(): GapDataResult {
  const laps = useSessionStore((s) => s.laps)
  const selectedDrivers = useSessionStore((s) => s.selectedDrivers)

  return useMemo(() => {
    const empty: GapDataResult = { lapNumbers: [], gaps: [], segments: [] }

    const [driverA, driverB] = selectedDrivers
    if (driverA === null || driverB === null) return empty

    // Filter to valid rows (non-null LapNumber and Time) for each driver
    const lapsA = laps.filter(
      (l) => l.Driver === driverA && l.LapNumber !== null && l.Time !== null
    )
    const lapsB = laps.filter(
      (l) => l.Driver === driverB && l.LapNumber !== null && l.Time !== null
    )

    // Build lap number → session time maps
    const mapA = new Map<number, number>()
    for (const l of lapsA) {
      mapA.set(l.LapNumber as number, l.Time as number)
    }
    const mapB = new Map<number, number>()
    for (const l of lapsB) {
      mapB.set(l.LapNumber as number, l.Time as number)
    }

    // Shared laps sorted ascending
    const sharedLaps = [...mapA.keys()]
      .filter((lap) => mapB.has(lap))
      .sort((a, b) => a - b)

    if (sharedLaps.length === 0) return empty

    const lapNumbers: number[] = []
    const gaps: number[] = []

    for (const lap of sharedLaps) {
      lapNumbers.push(lap)
      gaps.push((mapB.get(lap) as number) - (mapA.get(lap) as number))
    }

    // Build segments — split on leader changes for dynamic team color lines
    const segments: PlotlyTrace[] = []

    if (lapNumbers.length === 0) return { lapNumbers, gaps, segments }

    let segStart = 0
    const colorA = getDriverColor(driverA)
    const colorB = getDriverColor(driverB)

    const getColor = (gapVal: number) => (gapVal >= 0 ? colorA : colorB)

    for (let i = 1; i <= lapNumbers.length; i++) {
      const isLast = i === lapNumbers.length
      const leaderChanged = !isLast && Math.sign(gaps[i]) !== Math.sign(gaps[i - 1])

      if (leaderChanged || isLast) {
        // Include current point for overlap at crossovers (not for the very last segment)
        const endIdx = isLast ? i : i + 1
        const segX = lapNumbers.slice(segStart, endIdx)
        const segY = gaps.slice(segStart, endIdx)

        segments.push({
          x: segX,
          y: segY,
          type: 'scatter',
          mode: 'lines',
          line: { color: getColor(gaps[segStart]), width: 2 },
          hovertemplate: `Lap %{x}<br>Gap: %{y:.3f}s<extra></extra>`,
          showlegend: false,
        })

        segStart = isLast ? i : i
      }
    }

    return { lapNumbers, gaps, segments }
  }, [laps, selectedDrivers])
}

/**
 * Team-grouped driver list derived from session laps.
 * Ordered within each team by lap 1 grid position to avoid spoilers.
 */
export interface TeamDrivers {
  team: string
  drivers: string[]
}

/**
 * Returns drivers from the loaded session, grouped by team and ordered
 * by lap 1 grid position (no final position spoilers).
 */
export function useDriverList(): { teams: TeamDrivers[] } {
  const laps = useSessionStore((s) => s.laps)

  return useMemo(() => {
    // Collect unique drivers
    const driversInSession = [...new Set(laps.map((l) => l.Driver))]

    // Build lap 1 position lookup
    const lap1Positions = new Map<string, number>()
    for (const lap of laps) {
      if (lap.LapNumber === 1 && lap.Position !== null) {
        lap1Positions.set(lap.Driver, lap.Position)
      }
    }

    // Sort drivers by lap 1 grid position (unknown drivers go to end)
    const sorted = [...driversInSession].sort((a, b) => {
      const posA = lap1Positions.get(a) ?? 999
      const posB = lap1Positions.get(b) ?? 999
      return posA - posB
    })

    // Group by team
    const teamMap = new Map<string, string[]>()
    for (const driver of sorted) {
      const team = DRIVER_TEAMS[driver] ?? 'Unknown'
      if (!teamMap.has(team)) {
        teamMap.set(team, [])
      }
      teamMap.get(team)!.push(driver)
    }

    // Convert to array — order of teams follows grid order of first driver in each team
    const teams: TeamDrivers[] = []
    for (const [team, drivers] of teamMap.entries()) {
      teams.push({ team, drivers })
    }

    return { teams }
  }, [laps])
}
