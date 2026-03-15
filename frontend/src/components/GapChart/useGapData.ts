import { useMemo } from 'react'
import type Plotly from 'plotly.js'
import { useSessionStore } from '@/stores/sessionStore'

/**
 * A Plotly trace segment for dynamic line coloring based on who is leading.
 */
export interface PlotlyTrace {
  x: number[]
  y: number[]
  type: 'scatter'
  mode: 'lines' | 'markers'
  line?: { color: string; width: number }
  marker?: { size: number; opacity: number }
  hovertemplate?: string
  hoverinfo?: string
  showlegend: false
}

/**
 * Result from useGapData.
 * - lapNumbers: shared lap numbers for both drivers
 * - gaps: gap in seconds per lap (positive = driverA leading, i.e. lower session time)
 * - segments: Plotly trace objects split by leader with team colors
 * - pitStopShapes: vertical line shapes for each pit stop (progressive reveal)
 * - pitStopHoverTraces: invisible scatter traces providing pit stop hover tooltips
 * - scShapes: rectangular shading shapes for SC/VSC/RED periods
 */
export interface GapDataResult {
  lapNumbers: number[]
  gaps: number[]
  segments: PlotlyTrace[]
  pitStopShapes: Partial<Plotly.Shape>[]
  pitStopHoverTraces: Partial<Plotly.PlotData>[]
  scShapes: Partial<Plotly.Shape>[]
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
  const drivers = useSessionStore((s) => s.drivers)
  const selectedDrivers = useSessionStore((s) => s.selectedDrivers)
  const currentLap = useSessionStore((s) => s.currentLap)
  const safetyCarPeriods = useSessionStore((s) => s.safetyCarPeriods)

  const gapSegments = useMemo(() => {
    const emptySegments = { lapNumbers: [] as number[], gaps: [] as number[], segments: [] as PlotlyTrace[] }

    const [driverA, driverB] = selectedDrivers
    if (driverA === null || driverB === null) return emptySegments

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

    // Shared laps sorted ascending, filtered to currentLap for progressive reveal
    const sharedLaps = [...mapA.keys()]
      .filter((lap) => mapB.has(lap) && lap <= currentLap)
      .sort((a, b) => a - b)

    if (sharedLaps.length === 0) return emptySegments

    const lapNumbers: number[] = []
    const gaps: number[] = []

    for (const lap of sharedLaps) {
      lapNumbers.push(lap)
      gaps.push((mapB.get(lap) as number) - (mapA.get(lap) as number))
    }

    // Build segments — split on leader changes for dynamic team color lines
    const segments: PlotlyTrace[] = []

    if (lapNumbers.length === 0) return { lapNumbers, gaps, segments }

    // Get team colors from session driver data
    const driverMap = new Map(drivers.map((d) => [d.abbreviation, d]))
    const colorA = driverMap.get(driverA)?.teamColor ?? '#888888'
    const colorB = driverMap.get(driverB)?.teamColor ?? '#888888'

    // Single invisible trace handles all hover — prevents duplicates from overlapping segments
    segments.push({
      x: lapNumbers,
      y: gaps,
      type: 'scatter',
      mode: 'markers',
      marker: { size: 8, opacity: 0 },
      hovertemplate: `Lap %{x}<br>Gap: %{y:.3f}s<extra></extra>`,
      showlegend: false,
    })

    // Colored line segments — hover disabled
    let segStart = 0
    const getColor = (gapVal: number) => (gapVal >= 0 ? colorA : colorB)

    for (let i = 1; i <= lapNumbers.length; i++) {
      const isLast = i === lapNumbers.length
      const leaderChanged = !isLast && Math.sign(gaps[i]) !== Math.sign(gaps[i - 1])

      if (leaderChanged || isLast) {
        const endIdx = isLast ? i : i + 1
        const segX = lapNumbers.slice(segStart, endIdx)
        const segY = gaps.slice(segStart, endIdx)

        segments.push({
          x: segX,
          y: segY,
          type: 'scatter',
          mode: 'lines',
          line: { color: getColor(gaps[segStart]), width: 2 },
          hoverinfo: 'skip',
          showlegend: false,
        })

        segStart = isLast ? i : i
      }
    }

    return { lapNumbers, gaps, segments }
  }, [laps, drivers, selectedDrivers, currentLap])

  const annotationShapes = useMemo(() => {
    const emptyAnnotations = {
      pitStopShapes: [] as Partial<Plotly.Shape>[],
      pitStopHoverTraces: [] as Partial<Plotly.PlotData>[],
      scShapes: [] as Partial<Plotly.Shape>[],
    }

    const [driverA, driverB] = selectedDrivers
    if (driverA === null || driverB === null) return emptyAnnotations

    const driverMap = new Map(drivers.map((d) => [d.abbreviation, d]))
    const colorA = driverMap.get(driverA)?.teamColor ?? '#888888'
    const colorB = driverMap.get(driverB)?.teamColor ?? '#888888'

    // Find pit laps per driver (filtered by currentLap for progressive reveal)
    const pitLapsA = laps
      .filter(
        (l) =>
          l.Driver === driverA &&
          l.LapNumber !== null &&
          l.PitInTime !== null &&
          l.LapNumber <= currentLap
      )
      .map((l) => l.LapNumber as number)

    const pitLapsB = laps
      .filter(
        (l) =>
          l.Driver === driverB &&
          l.LapNumber !== null &&
          l.PitInTime !== null &&
          l.LapNumber <= currentLap
      )
      .map((l) => l.LapNumber as number)

    // Detect same-lap collisions
    const setA = new Set(pitLapsA)
    const setB = new Set(pitLapsB)
    const collision = new Set([...setA].filter((lap) => setB.has(lap)))

    const pitStopShapes: Partial<Plotly.Shape>[] = []
    const pitStopHoverTraces: Partial<Plotly.PlotData>[] = []

    // Build shapes and hover traces for driverA pits
    for (const pitLap of pitLapsA) {
      const xPos = collision.has(pitLap) ? pitLap - 0.15 : pitLap

      pitStopShapes.push({
        type: 'line',
        x0: xPos,
        x1: xPos,
        y0: 0,
        y1: 1,
        xref: 'x',
        yref: 'paper' as const,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        layer: 'above' as any,
        line: { color: colorA, width: 1, dash: 'solid' as const },
        label: {
          text: driverA,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          textposition: 'top left' as any,
          font: { color: colorA, size: 9 },
        },
      })

      // Invisible hover trace: two points spanning y-range, mode lines, width 0
      pitStopHoverTraces.push({
        x: [xPos, xPos],
        y: [0, 1],
        type: 'scatter' as const,
        mode: 'lines' as const,
        line: { width: 0, color: 'transparent' },
        hoverinfo: 'text' as const,
        text: [`${driverA} pit — Lap ${pitLap}`, `${driverA} pit — Lap ${pitLap}`],
        showlegend: false,
        // Use paper yaxis so hover spans full chart height
        yaxis: 'y',
      } as Partial<Plotly.PlotData>)
    }

    // Build shapes and hover traces for driverB pits
    for (const pitLap of pitLapsB) {
      const xPos = collision.has(pitLap) ? pitLap + 0.15 : pitLap

      pitStopShapes.push({
        type: 'line',
        x0: xPos,
        x1: xPos,
        y0: 0,
        y1: 1,
        xref: 'x',
        yref: 'paper' as const,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        layer: 'above' as any,
        line: { color: colorB, width: 1, dash: 'solid' as const },
        label: {
          text: driverB,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          textposition: 'top left' as any,
          font: { color: colorB, size: 9 },
        },
      })

      pitStopHoverTraces.push({
        x: [xPos, xPos],
        y: [0, 1],
        type: 'scatter' as const,
        mode: 'lines' as const,
        line: { width: 0, color: 'transparent' },
        hoverinfo: 'text' as const,
        text: [`${driverB} pit — Lap ${pitLap}`, `${driverB} pit — Lap ${pitLap}`],
        showlegend: false,
        yaxis: 'y',
      } as Partial<Plotly.PlotData>)
    }

    // Build SC/VSC/RED shapes (progressive reveal + growing active periods)
    const scShapes: Partial<Plotly.Shape>[] = []

    for (const period of safetyCarPeriods) {
      // Skip periods that haven't started yet
      if (period.start_lap > currentLap) continue

      // Clamp end_lap to currentLap so active periods grow with replay
      const x1 = Math.min(period.end_lap, currentLap)

      let fillcolor: string
      let lineStyle: Partial<Plotly.ShapeLine> = { width: 0 }
      let labelColor: string

      if (period.type === 'SC') {
        fillcolor = 'rgba(255, 200, 0, 0.18)'
        labelColor = 'rgba(255,200,0,0.7)'
      } else if (period.type === 'VSC') {
        fillcolor = 'rgba(255, 200, 0, 0.08)'
        labelColor = 'rgba(255,200,0,0.7)'
      } else {
        // RED
        fillcolor = 'rgba(255, 0, 0, 0.25)'
        lineStyle = { color: 'rgba(255,0,0,0.5)', width: 2 }
        labelColor = 'rgba(255,0,0,0.7)'
      }

      scShapes.push({
        type: 'rect',
        x0: period.start_lap,
        x1,
        y0: 0,
        y1: 1,
        xref: 'x',
        yref: 'paper' as const,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        layer: 'below' as any,
        fillcolor,
        line: lineStyle,
        label: {
          text: period.type,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          textposition: 'top left' as any,
          font: { color: labelColor, size: 10 },
        },
      })
    }

    return { pitStopShapes, pitStopHoverTraces, scShapes }
  }, [laps, drivers, selectedDrivers, currentLap, safetyCarPeriods])

  return {
    ...gapSegments,
    ...annotationShapes,
  }
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
 * Uses dynamic driver info from the backend (correct for any season/race).
 */
export function useDriverList(): { teams: TeamDrivers[] } {
  const laps = useSessionStore((s) => s.laps)
  const sessionDrivers = useSessionStore((s) => s.drivers)

  return useMemo(() => {
    // Build lookup from session driver data
    const driverMap = new Map(sessionDrivers.map((d) => [d.abbreviation, d]))

    // Collect unique drivers actually present in laps
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

    // Group by team using session data (falls back to lap Team field, then "Unknown")
    const teamMap = new Map<string, string[]>()
    for (const driver of sorted) {
      const info = driverMap.get(driver)
      // Try session driver info first, then fall back to Team from lap data
      const team = info?.team
        ?? laps.find((l) => l.Driver === driver)?.Team
        ?? 'Unknown'
      if (!teamMap.has(team)) {
        teamMap.set(team, [])
      }
      teamMap.get(team)!.push(driver)
    }

    const teams: TeamDrivers[] = []
    for (const [team, drivers] of teamMap.entries()) {
      teams.push({ team, drivers })
    }

    return { teams }
  }, [laps, sessionDrivers])
}
