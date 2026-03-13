import { useMemo } from 'react'
import type Plotly from 'plotly.js'
import type { LapRow, DriverInfo } from '@/types/session'
import { useSessionStore } from '@/stores/sessionStore'
import { getCompoundColor, getCompoundLetter } from '@/lib/compounds'
import { makeReplayCursorShape } from '@/lib/plotlyShapes'

// ---- Exported types ----

export interface Stint {
  driver: string
  stintNumber: number
  compound: string | null
  startLap: number
  endLap: number
  tyreLifeAtEnd: number | null
}

export interface DriverOrderEntry {
  driver: string
  position: number
  label: string
}

// ---- Pure exported functions (testable without React) ----

/**
 * Groups laps by (Driver, Stint integer) to produce Stint objects.
 * Uses the last non-null Compound in each group to handle FastF1 None values.
 * Skips laps with null LapNumber or null Stint.
 */
export function deriveStints(laps: LapRow[]): Stint[] {
  // Group by "Driver::StintNumber"
  const groups = new Map<string, LapRow[]>()

  for (const lap of laps) {
    if (lap.LapNumber === null || lap.Stint === null) continue
    const key = `${lap.Driver}::${lap.Stint}`
    const group = groups.get(key)
    if (group) {
      group.push(lap)
    } else {
      groups.set(key, [lap])
    }
  }

  const stints: Stint[] = []

  for (const [key, group] of groups) {
    const [driver] = key.split('::')
    const sorted = [...group].sort((a, b) => (a.LapNumber ?? 0) - (b.LapNumber ?? 0))

    const stintNumber = sorted[0].Stint!
    const startLap = sorted[0].LapNumber!
    const endLap = sorted[sorted.length - 1].LapNumber!

    // Last non-null compound in group
    let compound: string | null = null
    for (const lap of sorted) {
      if (lap.Compound !== null) {
        compound = lap.Compound
      }
    }

    const tyreLifeAtEnd = sorted[sorted.length - 1].TyreLife ?? null

    stints.push({
      driver,
      stintNumber,
      compound,
      startLap,
      endLap,
      tyreLifeAtEnd,
    })
  }

  return stints
}

/**
 * Filters stints to those that have started by currentLap,
 * clipping endLap to currentLap for stints still in progress.
 */
export function computeVisibleStints(stints: Stint[], currentLap: number): Stint[] {
  if (currentLap <= 0) return []

  return stints
    .filter((s) => s.startLap <= currentLap)
    .map((s) => ({
      ...s,
      endLap: Math.min(s.endLap, currentLap),
    }))
}

/**
 * Returns drivers sorted by Position at currentLap (ascending = P1 first).
 * Drivers with no position data at currentLap sort to end.
 */
export function computeDriverOrder(
  laps: LapRow[],
  drivers: DriverInfo[],
  currentLap: number
): DriverOrderEntry[] {
  // Build a map of driver -> position at currentLap
  const positionAtLap = new Map<string, number>()
  for (const lap of laps) {
    if (lap.LapNumber === currentLap && lap.Position !== null) {
      positionAtLap.set(lap.Driver, lap.Position)
    }
  }

  const FALLBACK_POSITION = 999

  const entries: DriverOrderEntry[] = drivers.map((d) => {
    const position = positionAtLap.get(d.abbreviation) ?? FALLBACK_POSITION
    const label =
      position === FALLBACK_POSITION ? d.abbreviation : `P${position} ${d.abbreviation}`
    return {
      driver: d.abbreviation,
      position,
      label,
    }
  })

  entries.sort((a, b) => a.position - b.position)

  return entries
}

/**
 * Converts visible stints + driver order into a single Plotly horizontal bar trace.
 */
export function buildStintTraces(
  visibleStints: Stint[],
  driverOrder: DriverOrderEntry[]
): Partial<Plotly.PlotData>[] {
  // Build lookup for driver label
  const labelByDriver = new Map<string, string>()
  for (const entry of driverOrder) {
    labelByDriver.set(entry.driver, entry.label)
  }

  const x: number[] = []
  const y: string[] = []
  const base: number[] = []
  const colors: string[] = []
  const text: string[] = []
  const customdata: number[] = []

  // Sort stints by driver order then stint number
  const orderIndex = new Map<string, number>()
  driverOrder.forEach((e, i) => orderIndex.set(e.driver, i))

  const sorted = [...visibleStints].sort((a, b) => {
    const oa = orderIndex.get(a.driver) ?? 999
    const ob = orderIndex.get(b.driver) ?? 999
    if (oa !== ob) return oa - ob
    return a.stintNumber - b.stintNumber
  })

  for (const stint of sorted) {
    const length = stint.endLap - stint.startLap + 1
    const label = labelByDriver.get(stint.driver) ?? stint.driver

    x.push(length)
    y.push(label)
    base.push(stint.startLap)
    colors.push(getCompoundColor(stint.compound))
    text.push(getCompoundLetter(stint.compound))
    customdata.push(stint.endLap)
  }

  // Cast to unknown first because Plotly.PlotData typings omit `base`
  // but it is a valid property for bar traces per the Plotly.js docs.
  const trace = {
    type: 'bar' as const,
    orientation: 'h' as const,
    x,
    y,
    base,
    marker: { color: colors },
    text,
    textposition: 'inside' as const,
    insidetextanchor: 'middle' as const,
    showlegend: false,
    customdata,
    hovertemplate: '%{text} compound<br>Laps %{base} - %{customdata}<extra></extra>',
  } as unknown as Partial<Plotly.PlotData>

  return [trace]
}

// ---- React hook ----

export function useStintData() {
  const laps = useSessionStore((s) => s.laps)
  const drivers = useSessionStore((s) => s.drivers)
  const currentLap = useSessionStore((s) => s.currentLap)

  // Memo 1: derive ALL stints from entire race data — stable on [laps]
  const allStints = useMemo(() => deriveStints(laps), [laps])

  // Memo 2: filter, order, and build bar traces for current lap
  const { traces, driverOrder, yAxisCategories } = useMemo(() => {
    const visibleStints = computeVisibleStints(allStints, currentLap)
    const order = computeDriverOrder(laps, drivers, currentLap)
    const stintTraces = buildStintTraces(visibleStints, order)
    const yAxisCategories = order.map((e) => e.label)
    return { traces: stintTraces, driverOrder: order, yAxisCategories }
  }, [allStints, laps, drivers, currentLap])

  // Memo 3: cursor shape — only depends on currentLap
  const cursorShapes = useMemo(() => {
    const shape = makeReplayCursorShape(currentLap)
    return shape ? [shape] : []
  }, [currentLap])

  return { traces, cursorShapes, driverOrder, yAxisCategories }
}
