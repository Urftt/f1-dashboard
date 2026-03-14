import { useMemo } from 'react'
import type Plotly from 'plotly.js'
import type { LapRow, DriverInfo, SafetyCarPeriod } from '@/types/session'
import { useSessionStore } from '@/stores/sessionStore'
import { makeReplayCursorShape } from '@/lib/plotlyShapes'

// ---- Constants ----

const CLIP_MAX = 12

// ---- Pure exported functions (testable without React) ----

/**
 * Builds a time lookup: Map<lapNumber, Map<position, cumulativeTime>>.
 * Skips laps with null LapNumber, Position, or Time.
 */
export function buildTimeLookup(laps: LapRow[]): Map<number, Map<number, number>> {
  const lookup = new Map<number, Map<number, number>>()

  for (const lap of laps) {
    if (lap.LapNumber === null || lap.Position === null || lap.Time === null) continue

    let posMap = lookup.get(lap.LapNumber)
    if (!posMap) {
      posMap = new Map<number, number>()
      lookup.set(lap.LapNumber, posMap)
    }
    posMap.set(lap.Position, lap.Time)
  }

  return lookup
}

/**
 * Builds gap-to-car-ahead traces for all visible drivers.
 *
 * Each driver gets TWO traces:
 * - Normal trace: regular laps (not lap 1, not pit laps)
 * - Dim trace (opacity 0.3): lap 1 and pit laps
 *
 * P1 laps excluded (leader has no car ahead).
 * Interval computed as: subject.Time - carAhead.Time (positive = behind).
 * Clipped at CLIP_MAX (12s). connectgaps false on all traces.
 */
export function buildIntervalTraces(
  laps: LapRow[],
  drivers: DriverInfo[],
  visibleDrivers: Set<string>,
  currentLap: number
): Partial<Plotly.PlotData>[] {
  const timeLookup = buildTimeLookup(laps)
  const driverMap = new Map(drivers.map((d) => [d.abbreviation, d]))
  const traces: Partial<Plotly.PlotData>[] = []

  for (const driverAbbr of visibleDrivers) {
    const driverInfo = driverMap.get(driverAbbr)
    const color = driverInfo?.teamColor ?? '#888888'

    // Collect qualifying laps: LapNumber <= currentLap, Position > 1, not null
    const driverLaps = laps
      .filter(
        (l) =>
          l.Driver === driverAbbr &&
          l.LapNumber !== null &&
          l.Position !== null &&
          l.Time !== null &&
          l.Position > 1 &&
          l.LapNumber <= currentLap
      )
      .sort((a, b) => (a.LapNumber as number) - (b.LapNumber as number))

    const normalX: number[] = []
    const normalY: (number | null)[] = []
    const dimX: number[] = []
    const dimY: (number | null)[] = []

    for (const lap of driverLaps) {
      const lapNum = lap.LapNumber as number
      const pos = lap.Position as number
      const subjectTime = lap.Time as number

      // Determine if this lap is dim (lap 1 or pit lap)
      const isDim =
        lapNum === 1 ||
        lap.PitInTime !== null ||
        lap.PitOutTime !== null

      // Find car-ahead time
      const carAheadTime = timeLookup.get(lapNum)?.get(pos - 1)
      const interval =
        carAheadTime !== undefined
          ? Math.min(subjectTime - carAheadTime, CLIP_MAX)
          : null

      if (isDim) {
        dimX.push(lapNum)
        dimY.push(interval)
      } else {
        normalX.push(lapNum)
        normalY.push(interval)
      }
    }

    const hovertemplate = `${driverAbbr}<br>Lap %{x}<br>%{y:.2f}s<extra></extra>`

    // Normal trace
    traces.push({
      type: 'scattergl' as const,
      mode: 'lines' as const,
      name: driverAbbr,
      x: normalX,
      y: normalY,
      line: { color, width: 2 },
      connectgaps: false,
      showlegend: false,
      hovertemplate,
    } as Partial<Plotly.PlotData>)

    // Dim trace
    traces.push({
      type: 'scattergl' as const,
      mode: 'lines' as const,
      name: `${driverAbbr}_dim`,
      x: dimX,
      y: dimY,
      line: { color, width: 2 },
      opacity: 0.3,
      connectgaps: false,
      showlegend: false,
      hovertemplate,
    } as Partial<Plotly.PlotData>)
  }

  return traces
}

/**
 * Builds the DRS reference shapes:
 * 1. A green shaded rect from y=0 to y=1.0 (DRS zone)
 * 2. A dashed line at y=1.0 (DRS threshold)
 */
export function buildDRSShapes(): Partial<Plotly.Shape>[] {
  return [
    {
      type: 'rect',
      x0: 0,
      x1: 1,
      xref: 'paper' as const,
      y0: 0,
      y1: 1.0,
      yref: 'y' as const,
      fillcolor: 'rgba(0, 200, 80, 0.08)',
      line: { width: 0 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      layer: 'below' as any,
    },
    {
      type: 'line',
      x0: 0,
      x1: 1,
      xref: 'paper' as const,
      y0: 1.0,
      y1: 1.0,
      yref: 'y' as const,
      line: { color: 'rgba(0, 200, 80, 0.6)', width: 1, dash: 'dash' },
    },
  ]
}

/**
 * Builds SC/VSC/RED rectangular shapes for the interval chart.
 * Applies progressive reveal: skips periods that haven't started yet,
 * clamps end_lap to currentLap for active periods.
 *
 * Note: Duplicated from usePositionData.ts to keep hooks self-contained
 * (per Phase 6 decision: buildSCShapes duplicated in each hook).
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
 * Builds end-of-line annotations for visible drivers.
 * Places label at last visible lap where driver is not P1 and interval is computable.
 * y-value is the gap-to-car-ahead (not position).
 */
export function buildEndOfLineAnnotations(
  laps: LapRow[],
  drivers: DriverInfo[],
  visibleDrivers: Set<string>,
  currentLap: number,
  timeLookup: Map<number, Map<number, number>>
): Partial<Plotly.Annotations>[] {
  const driverMap = new Map(drivers.map((d) => [d.abbreviation, d]))
  const annotations: Partial<Plotly.Annotations>[] = []

  for (const driverAbbr of visibleDrivers) {
    const driverInfo = driverMap.get(driverAbbr)
    const color = driverInfo?.teamColor ?? '#e0e0f0'

    // Find qualifying laps: LapNumber <= currentLap, Position > 1, Time not null
    const driverLaps = laps
      .filter(
        (l) =>
          l.Driver === driverAbbr &&
          l.LapNumber !== null &&
          l.Position !== null &&
          l.Time !== null &&
          l.Position > 1 &&
          l.LapNumber <= currentLap
      )
      .sort((a, b) => (a.LapNumber as number) - (b.LapNumber as number))

    if (driverLaps.length === 0) continue

    // Find last lap with a computable interval
    let lastLap: LapRow | null = null
    let lastInterval: number | null = null

    for (let i = driverLaps.length - 1; i >= 0; i--) {
      const lap = driverLaps[i]
      const lapNum = lap.LapNumber as number
      const pos = lap.Position as number
      const subjectTime = lap.Time as number
      const carAheadTime = timeLookup.get(lapNum)?.get(pos - 1)
      if (carAheadTime !== undefined) {
        lastInterval = Math.min(subjectTime - carAheadTime, CLIP_MAX)
        lastLap = lap
        break
      }
    }

    if (lastLap === null || lastInterval === null) continue

    annotations.push({
      x: lastLap.LapNumber as number,
      y: lastInterval,
      text: driverAbbr,
      showarrow: false,
      xanchor: 'left' as const,
      xshift: 4,
      font: { color, size: 10 },
    })
  }

  return annotations
}

// ---- React hook ----

export function useIntervalData(visibleDrivers: Set<string>) {
  const laps = useSessionStore((s) => s.laps)
  const drivers = useSessionStore((s) => s.drivers)
  const currentLap = useSessionStore((s) => s.currentLap)
  const safetyCarPeriods = useSessionStore((s) => s.safetyCarPeriods)

  // Memo 1: timeLookup — stable on [laps]
  const timeLookup = useMemo(() => buildTimeLookup(laps), [laps])

  // Memo 2: interval traces, annotations, SC shapes, DRS shapes
  const { intervalTraces, annotations, scShapes, drsShapes } = useMemo(() => {
    const intervalTraces = buildIntervalTraces(laps, drivers, visibleDrivers, currentLap)
    const annotations = buildEndOfLineAnnotations(
      laps,
      drivers,
      visibleDrivers,
      currentLap,
      timeLookup
    )
    const scShapes = buildSCShapes(safetyCarPeriods, currentLap)
    const drsShapes = buildDRSShapes()
    return { intervalTraces, annotations, scShapes, drsShapes }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLookup, drivers, visibleDrivers, currentLap, safetyCarPeriods])

  // Memo 3: cursor shape — only depends on currentLap
  const cursorShapes = useMemo(() => {
    const shape = makeReplayCursorShape(currentLap)
    return shape ? [shape] : []
  }, [currentLap])

  return { intervalTraces, annotations, scShapes, drsShapes, cursorShapes }
}
