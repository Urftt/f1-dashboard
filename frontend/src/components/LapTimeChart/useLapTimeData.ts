import { useMemo } from 'react'
import type Plotly from 'plotly.js'
import type { LapRow, DriverInfo, SafetyCarPeriod } from '@/types/session'
import { useSessionStore } from '@/stores/sessionStore'
import { makeReplayCursorShape } from '@/lib/plotlyShapes'

// ---- Pure exported functions (testable without React) ----

/**
 * Computes linear regression (slope, intercept) from x and y arrays.
 * Returns null if fewer than 2 points.
 */
export function linearRegression(
  xs: number[],
  ys: number[]
): { slope: number; intercept: number } | null {
  if (xs.length < 2 || ys.length < 2) return null

  const n = xs.length
  const sumX = xs.reduce((acc, x) => acc + x, 0)
  const sumY = ys.reduce((acc, y) => acc + y, 0)
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0)
  const sumXX = xs.reduce((acc, x) => acc + x * x, 0)

  const denominator = n * sumXX - sumX * sumX
  if (denominator === 0) return null

  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  return { slope, intercept }
}

/**
 * Returns true if a lap should be treated as an outlier (excluded from regression,
 * rendered at 30% opacity).
 *
 * Outlier conditions:
 * - Lap 1 (formation/standing start)
 * - Lap has PitInTime (pit-in lap)
 * - Lap has PitOutTime (pit-out lap)
 * - Lap falls within a SC/VSC/RED period
 */
export function isOutlierLap(lap: LapRow, safetyCarPeriods: SafetyCarPeriod[]): boolean {
  if (lap.LapNumber === 1) return true
  if (lap.PitInTime !== null) return true
  if (lap.PitOutTime !== null) return true

  for (const period of safetyCarPeriods) {
    if (lap.LapNumber !== null && lap.LapNumber >= period.start_lap && lap.LapNumber <= period.end_lap) {
      return true
    }
  }

  return false
}

/**
 * Builds SC/VSC/RED rectangular shapes for the lap time chart.
 * Applies progressive reveal: skips periods that haven't started yet,
 * clamps end_lap to currentLap for active periods.
 */
export function buildSCShapes(
  safetyCarPeriods: SafetyCarPeriod[],
  currentLap: number
): Partial<Plotly.Shape>[] {
  const shapes: Partial<Plotly.Shape>[] = []

  for (const period of safetyCarPeriods) {
    if (period.start_lap > currentLap) continue

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

    shapes.push({
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

  return shapes
}

/**
 * Builds scatter traces for all visible drivers.
 * Each trace has per-point opacity (0.3 for outlier laps, 1.0 for clean laps).
 * Filters to laps <= currentLap (progressive reveal).
 * Skips laps with null LapTime.
 */
export function buildLapTimeTraces(
  laps: LapRow[],
  drivers: DriverInfo[],
  safetyCarPeriods: SafetyCarPeriod[],
  visibleDrivers: Set<string>,
  currentLap: number
): Partial<Plotly.PlotData>[] {
  const driverMap = new Map(drivers.map((d) => [d.abbreviation, d]))
  const traces: Partial<Plotly.PlotData>[] = []

  for (const driverAbbr of visibleDrivers) {
    const driverInfo = driverMap.get(driverAbbr)
    const color = driverInfo?.teamColor ?? '#888888'

    const driverLaps = laps.filter(
      (l) =>
        l.Driver === driverAbbr &&
        l.LapNumber !== null &&
        l.LapTime !== null &&
        l.LapNumber <= currentLap
    )

    const x: number[] = []
    const y: number[] = []
    const opacities: number[] = []

    for (const lap of driverLaps) {
      x.push(lap.LapNumber as number)
      y.push(lap.LapTime as number)
      opacities.push(isOutlierLap(lap, safetyCarPeriods) ? 0.3 : 1.0)
    }

    traces.push({
      type: 'scattergl' as const,
      mode: 'markers' as const,
      name: driverAbbr,
      x,
      y,
      marker: {
        color,
        size: 6,
        opacity: opacities,
      },
      hovertemplate: `${driverAbbr}<br>Lap %{x}<br>%{y:.3f}s<extra></extra>`,
      showlegend: false,
    } as Partial<Plotly.PlotData>)
  }

  return traces
}

/**
 * Computes trend lines for each visible driver and stint.
 * Uses only clean (non-outlier) laps for regression.
 * Returns null for stints with fewer than 2 clean laps.
 */
export function computeAllTrendLines(
  laps: LapRow[],
  drivers: DriverInfo[],
  safetyCarPeriods: SafetyCarPeriod[]
): Partial<Plotly.PlotData>[] {
  const driverMap = new Map(drivers.map((d) => [d.abbreviation, d]))
  const trendTraces: Partial<Plotly.PlotData>[] = []

  // Group laps by driver and stint
  const stintMap = new Map<string, LapRow[]>()
  for (const lap of laps) {
    if (lap.LapNumber === null || lap.Stint === null || lap.LapTime === null) continue
    const key = `${lap.Driver}::${lap.Stint}`
    const group = stintMap.get(key)
    if (group) {
      group.push(lap)
    } else {
      stintMap.set(key, [lap])
    }
  }

  for (const [key, stintLaps] of stintMap) {
    const [driverAbbr] = key.split('::')
    const driverInfo = driverMap.get(driverAbbr)
    const color = driverInfo?.teamColor ?? '#888888'

    // Filter to clean laps only
    const cleanLaps = stintLaps.filter((l) => !isOutlierLap(l, safetyCarPeriods))

    if (cleanLaps.length < 2) continue

    const xs = cleanLaps.map((l) => l.LapNumber as number)
    const ys = cleanLaps.map((l) => l.LapTime as number)

    const regression = linearRegression(xs, ys)
    if (!regression) continue

    // Draw 2-point line from stint start to stint end
    const startLap = Math.min(...xs)
    const endLap = Math.max(...xs)

    const x0 = startLap
    const x1 = endLap
    const y0 = regression.slope * x0 + regression.intercept
    const y1 = regression.slope * x1 + regression.intercept

    trendTraces.push({
      type: 'scatter' as const,
      mode: 'lines' as const,
      name: `${driverAbbr} trend`,
      x: [x0, x1],
      y: [y0, y1],
      line: { color, width: 1.5, dash: 'dot' as const },
      hoverinfo: 'skip' as const,
      showlegend: false,
    } as Partial<Plotly.PlotData>)
  }

  return trendTraces
}

// ---- React hook ----

export function useLapTimeData(visibleDrivers: Set<string>) {
  const laps = useSessionStore((s) => s.laps)
  const drivers = useSessionStore((s) => s.drivers)
  const currentLap = useSessionStore((s) => s.currentLap)
  const safetyCarPeriods = useSessionStore((s) => s.safetyCarPeriods)

  // Memo 1: compute all lap data and trend lines — stable on [laps, drivers, safetyCarPeriods]
  const { allLapsByDriver, allTrendLines } = useMemo(() => {
    const allLapsByDriver = new Map<string, LapRow[]>()
    for (const driver of drivers) {
      allLapsByDriver.set(
        driver.abbreviation,
        laps.filter((l) => l.Driver === driver.abbreviation)
      )
    }
    const allTrendLines = computeAllTrendLines(laps, drivers, safetyCarPeriods)
    return { allLapsByDriver, allTrendLines }
  }, [laps, drivers, safetyCarPeriods])

  // Memo 2: build visible traces for current lap and visible drivers
  const { scatterTraces, trendTraces, scShapes } = useMemo(() => {
    const scatterTraces = buildLapTimeTraces(laps, drivers, safetyCarPeriods, visibleDrivers, currentLap)

    // Filter trend lines to visible drivers and current lap
    const trendTraces = allTrendLines.filter((t) => {
      const name = (t as any).name as string
      // name is "DRIVER trend" — extract driver abbreviation
      const driver = name.replace(' trend', '')
      if (!visibleDrivers.has(driver)) return false
      // Only show trend lines for data up to currentLap
      const xs = t.x as number[]
      return xs[0] <= currentLap
    }).map((t) => {
      // Clamp trend line end to currentLap
      const xs = t.x as number[]
      const ys = t.y as number[]
      if (xs[1] <= currentLap) return t
      // Recompute y1 at currentLap using slope/intercept
      const slope = (ys[1] - ys[0]) / (xs[1] - xs[0])
      const intercept = ys[0] - slope * xs[0]
      return {
        ...t,
        x: [xs[0], currentLap],
        y: [ys[0], slope * currentLap + intercept],
      }
    })

    const scShapes = buildSCShapes(safetyCarPeriods, currentLap)

    return { scatterTraces, trendTraces, scShapes }
  }, [laps, drivers, safetyCarPeriods, visibleDrivers, currentLap, allLapsByDriver, allTrendLines])

  // Memo 3: cursor shape — only depends on currentLap
  const cursorShapes = useMemo(() => {
    const shape = makeReplayCursorShape(currentLap)
    return shape ? [shape] : []
  }, [currentLap])

  return { scatterTraces, trendTraces, scShapes, cursorShapes }
}
