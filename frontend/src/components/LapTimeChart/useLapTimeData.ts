import { useMemo } from 'react'
import type Plotly from 'plotly.js'
import type { LapRow, DriverInfo, SafetyCarPeriod } from '@/types/session'
import { useSessionStore } from '@/stores/sessionStore'
import { makeReplayCursorShape } from '@/lib/plotlyShapes'

// ---- Helpers ----

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

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
 * Computes the standard deviation of residuals from a regression line.
 */
export function computeStdDev(
  xs: number[],
  ys: number[],
  slope: number,
  intercept: number
): number {
  if (xs.length < 3) return 0
  const residuals = xs.map((x, i) => ys[i] - (slope * x + intercept))
  const mean = residuals.reduce((a, b) => a + b, 0) / residuals.length
  const variance = residuals.reduce((a, r) => a + (r - mean) ** 2, 0) / (residuals.length - 1)
  return Math.sqrt(variance)
}

/**
 * Metadata for a single stint trend line.
 */
export interface StintTrendInfo {
  driver: string
  stint: number
  slope: number
  intercept: number
  stdDev: number
  startLap: number
  endLap: number
  color: string
}

/**
 * Computes trend lines, std dev bands, and slope annotations for each driver/stint.
 * Uses only clean (non-outlier) laps for regression.
 */
export function computeAllTrendLines(
  laps: LapRow[],
  drivers: DriverInfo[],
  safetyCarPeriods: SafetyCarPeriod[],
  currentLap: number = Infinity
): { trendTraces: Partial<Plotly.PlotData>[]; stdDevTraces: Partial<Plotly.PlotData>[]; stintInfos: StintTrendInfo[] } {
  const driverMap = new Map(drivers.map((d) => [d.abbreviation, d]))
  const trendTraces: Partial<Plotly.PlotData>[] = []
  const stdDevTraces: Partial<Plotly.PlotData>[] = []
  const stintInfos: StintTrendInfo[] = []

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
    const [driverAbbr, stintStr] = key.split('::')
    const driverInfo = driverMap.get(driverAbbr)
    const color = driverInfo?.teamColor ?? '#888888'

    // Filter to clean laps up to currentLap only (no spoilers)
    const cleanLaps = stintLaps.filter(
      (l) => !isOutlierLap(l, safetyCarPeriods) && l.LapNumber !== null && l.LapNumber <= currentLap
    )

    if (cleanLaps.length < 2) continue

    const xs = cleanLaps.map((l) => l.LapNumber as number)
    const ys = cleanLaps.map((l) => l.LapTime as number)

    const regression = linearRegression(xs, ys)
    if (!regression) continue

    const startLap = Math.min(...xs)
    const endLap = Math.max(...xs)
    const stdDev = computeStdDev(xs, ys, regression.slope, regression.intercept)

    stintInfos.push({
      driver: driverAbbr,
      stint: parseInt(stintStr),
      slope: regression.slope,
      intercept: regression.intercept,
      stdDev,
      startLap,
      endLap,
      color,
    })

    const y0 = regression.slope * startLap + regression.intercept
    const y1 = regression.slope * endLap + regression.intercept

    // Trend line trace
    trendTraces.push({
      type: 'scatter' as const,
      mode: 'lines' as const,
      name: `${driverAbbr} trend`,
      x: [startLap, endLap],
      y: [y0, y1],
      line: { color, width: 1.5, dash: 'dot' as const },
      hoverinfo: 'skip' as const,
      showlegend: false,
    } as Partial<Plotly.PlotData>)

    // Std dev band: upper boundary, then lower boundary (fill='tonexty')
    if (stdDev > 0 && cleanLaps.length >= 3) {
      // Generate points along the trend line for smooth bands
      const bandX: number[] = []
      for (let lap = startLap; lap <= endLap; lap++) bandX.push(lap)

      const upperY = bandX.map((x) => regression.slope * x + regression.intercept + stdDev)
      const lowerY = bandX.map((x) => regression.slope * x + regression.intercept - stdDev)

      // Upper boundary (invisible line)
      stdDevTraces.push({
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: `${driverAbbr} std+`,
        x: bandX,
        y: upperY,
        line: { width: 0 },
        hoverinfo: 'skip' as const,
        showlegend: false,
      } as Partial<Plotly.PlotData>)

      // Lower boundary with fill to upper
      stdDevTraces.push({
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: `${driverAbbr} std-`,
        x: bandX,
        y: lowerY,
        line: { width: 0 },
        fill: 'tonexty' as const,
        fillcolor: hexToRgba(color, 0.08),
        hoverinfo: 'skip' as const,
        showlegend: false,
      } as Partial<Plotly.PlotData>)
    }
  }

  return { trendTraces, stdDevTraces, stintInfos }
}

// ---- React hook ----

export function useLapTimeData(visibleDrivers: Set<string>) {
  const laps = useSessionStore((s) => s.laps)
  const drivers = useSessionStore((s) => s.drivers)
  const currentLap = useSessionStore((s) => s.currentLap)
  const safetyCarPeriods = useSessionStore((s) => s.safetyCarPeriods)

  // Memo 1: build all visible traces, trend lines, and annotations for current lap
  const { scatterTraces, trendTraces, stdDevTraces, slopeAnnotations, scShapes, cleanYRange } = useMemo(() => {
    const scatterTraces = buildLapTimeTraces(laps, drivers, safetyCarPeriods, visibleDrivers, currentLap)

    // Compute y-axis range from clean (non-outlier) laps only
    let cleanMin = Infinity
    let cleanMax = -Infinity
    for (const driverAbbr of visibleDrivers) {
      const driverLaps = laps.filter(
        (l) =>
          l.Driver === driverAbbr &&
          l.LapNumber !== null &&
          l.LapTime !== null &&
          l.LapNumber <= currentLap &&
          !isOutlierLap(l, safetyCarPeriods)
      )
      for (const lap of driverLaps) {
        const t = lap.LapTime as number
        if (t < cleanMin) cleanMin = t
        if (t > cleanMax) cleanMax = t
      }
    }
    const cleanYRange = cleanMin <= cleanMax ? { min: cleanMin, max: cleanMax } : null

    // Compute trend lines from laps up to currentLap only (no spoilers)
    const trendData = computeAllTrendLines(laps, drivers, safetyCarPeriods, currentLap)

    // Filter to visible drivers
    const isVisible = (name: string) => {
      const driver = name.replace(/ trend$/, '').replace(/ std[+-]$/, '')
      return visibleDrivers.has(driver)
    }

    const trendTraces = trendData.trendTraces
      .filter((t) => isVisible((t as any).name))

    const stdDevTraces = trendData.stdDevTraces
      .filter((t) => isVisible((t as any).name))

    // Build slope annotations — placed at midpoint of each visible trend line
    const slopeAnnotations: Partial<Plotly.Annotations>[] = trendData.stintInfos
      .filter((info) => visibleDrivers.has(info.driver))
      .map((info) => {
        const midLap = Math.round((info.startLap + info.endLap) / 2)
        const yMid = info.slope * midLap + info.intercept
        const sign = info.slope >= 0 ? '+' : ''
        const slopeText = `${sign}${(info.slope * 1000).toFixed(0)}ms/lap`
        const sigmaText = `\u03C3 ${(info.stdDev * 1000).toFixed(0)}ms`
        return {
          x: midLap,
          y: yMid,
          text: `${slopeText}<br>${sigmaText}`,
          showarrow: false,
          font: { color: info.color, size: 9 },
          yshift: -16,
          bgcolor: 'rgba(0,0,0,0.6)',
          borderpad: 2,
        }
      })

    const scShapes = buildSCShapes(safetyCarPeriods, currentLap)

    return { scatterTraces, trendTraces, stdDevTraces, slopeAnnotations, scShapes, cleanYRange }
  }, [laps, drivers, safetyCarPeriods, visibleDrivers, currentLap])

  // Memo 3: cursor shape — only depends on currentLap
  const cursorShapes = useMemo(() => {
    const shape = makeReplayCursorShape(currentLap)
    return shape ? [shape] : []
  }, [currentLap])

  return { scatterTraces, trendTraces, stdDevTraces, slopeAnnotations, scShapes, cursorShapes, cleanYRange }
}
