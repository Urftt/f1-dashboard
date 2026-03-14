import { useMemo } from 'react'
import type Plotly from 'plotly.js'
import type { LapRow, DriverInfo, SafetyCarPeriod } from '@/types/session'
import { useSessionStore } from '@/stores/sessionStore'
import { makeReplayCursorShape } from '@/lib/plotlyShapes'

// ---- Pure exported functions (testable without React) ----

/**
 * Builds SC/VSC/RED rectangular shapes for the position chart.
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
 * Builds scattergl position traces for all visible drivers.
 * Each trace shows the driver's race position (y) over laps (x).
 * Filters to laps <= currentLap (progressive reveal).
 * Skips laps with null Position.
 */
export function buildPositionTraces(
  laps: LapRow[],
  drivers: DriverInfo[],
  visibleDrivers: Set<string>,
  currentLap: number
): Partial<Plotly.PlotData>[] {
  const driverMap = new Map(drivers.map((d) => [d.abbreviation, d]))
  const traces: Partial<Plotly.PlotData>[] = []

  for (const driverAbbr of visibleDrivers) {
    const driverInfo = driverMap.get(driverAbbr)
    const color = driverInfo?.teamColor ?? '#888888'

    const driverLaps = laps
      .filter(
        (l) =>
          l.Driver === driverAbbr &&
          l.LapNumber !== null &&
          l.Position !== null &&
          l.LapNumber <= currentLap
      )
      .sort((a, b) => (a.LapNumber as number) - (b.LapNumber as number))

    const x: number[] = driverLaps.map((l) => l.LapNumber as number)
    const y: number[] = driverLaps.map((l) => l.Position as number)

    traces.push({
      type: 'scattergl' as const,
      mode: 'lines+markers' as const,
      name: driverAbbr,
      x,
      y,
      line: { color, width: 2 },
      marker: { size: 4, color },
      hovertemplate: `${driverAbbr}<br>Lap %{x}<br>P%{y}<extra></extra>`,
      showlegend: false,
    } as Partial<Plotly.PlotData>)
  }

  return traces
}

/**
 * Builds end-of-line annotations for all visible drivers.
 * Each annotation shows the driver abbreviation at their last visible lap position.
 */
export function buildEndOfLineAnnotations(
  laps: LapRow[],
  drivers: DriverInfo[],
  visibleDrivers: Set<string>,
  currentLap: number
): Partial<Plotly.Annotations>[] {
  const driverMap = new Map(drivers.map((d) => [d.abbreviation, d]))
  const annotations: Partial<Plotly.Annotations>[] = []

  for (const driverAbbr of visibleDrivers) {
    const driverInfo = driverMap.get(driverAbbr)
    const color = driverInfo?.teamColor ?? '#e0e0f0'

    // Find the last lap with valid position at or before currentLap
    const driverLaps = laps.filter(
      (l) =>
        l.Driver === driverAbbr &&
        l.LapNumber !== null &&
        l.Position !== null &&
        l.LapNumber <= currentLap
    )

    if (driverLaps.length === 0) continue

    const lastLap = driverLaps.reduce((prev, curr) =>
      (curr.LapNumber as number) > (prev.LapNumber as number) ? curr : prev
    )

    annotations.push({
      x: lastLap.LapNumber as number,
      y: lastLap.Position as number,
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

export function usePositionData(visibleDrivers: Set<string>) {
  const laps = useSessionStore((s) => s.laps)
  const drivers = useSessionStore((s) => s.drivers)
  const currentLap = useSessionStore((s) => s.currentLap)
  const safetyCarPeriods = useSessionStore((s) => s.safetyCarPeriods)

  // Memo 1: group laps by driver — stable on [laps]
  const lapsByDriver = useMemo(() => {
    const map = new Map<string, LapRow[]>()
    for (const lap of laps) {
      const group = map.get(lap.Driver)
      if (group) {
        group.push(lap)
      } else {
        map.set(lap.Driver, [lap])
      }
    }
    // Sort each driver's laps by LapNumber
    for (const [, driverLaps] of map) {
      driverLaps.sort((a, b) => (a.LapNumber ?? 0) - (b.LapNumber ?? 0))
    }
    return map
  }, [laps])

  // Memo 2: build visible traces, annotations, SC shapes
  const { positionTraces, annotations, scShapes } = useMemo(() => {
    const positionTraces = buildPositionTraces(laps, drivers, visibleDrivers, currentLap)
    const annotations = buildEndOfLineAnnotations(laps, drivers, visibleDrivers, currentLap)
    const scShapes = buildSCShapes(safetyCarPeriods, currentLap)
    return { positionTraces, annotations, scShapes }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lapsByDriver, drivers, visibleDrivers, currentLap, safetyCarPeriods])

  // Memo 3: cursor shape — only depends on currentLap
  const cursorShapes = useMemo(() => {
    const shape = makeReplayCursorShape(currentLap)
    return shape ? [shape] : []
  }, [currentLap])

  return { positionTraces, annotations, scShapes, cursorShapes }
}
