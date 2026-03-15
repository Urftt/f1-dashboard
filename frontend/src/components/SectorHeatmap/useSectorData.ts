import { useState, useEffect, useMemo } from 'react'
import type Plotly from 'plotly.js'
import type { LapRow, DriverInfo, SectorRow, SafetyCarPeriod } from '@/types/session'
import { useSessionStore } from '@/stores/sessionStore'
import { computeDriverOrder } from '@/components/StintTimeline/useStintData'
import { fetchSectors } from '@/api/client'

// ---- Exported types ----

export interface HeatmapCell {
  label: string
  rawTime: number | null
  delta: number | null
  sector: 1 | 2 | 3
  lapNumber: number
  driver: string
}

export interface HeatmapResult {
  z: (number | null)[][]
  x: string[]
  y: string[]
  customdata: (HeatmapCell | null)[][]
  driverOrder: string[]
  maxLap: number
}

// ---- Pure exported functions (testable without React) ----

type SectorKey = 's1' | 's2' | 's3'
const SECTOR_KEYS: SectorKey[] = ['s1', 's2', 's3']

/**
 * Build a lookup map: "driver::lapNumber" -> SectorRow
 */
function buildSectorLookup(rows: SectorRow[]): Map<string, SectorRow> {
  const map = new Map<string, SectorRow>()
  for (const row of rows) {
    map.set(`${row.driver}::${row.lapNumber}`, row)
  }
  return map
}

/**
 * Build the set of excluded lap keys ("driver::lapNumber") for laps that
 * should not contribute to worst-clean calculation.
 * Excluded: PitInTime !== null, PitOutTime !== null, or LapNumber === 1.
 * When excludeSC is true, also excludes SC/VSC/RED laps and restart laps.
 */
export function buildExcludedLapSet(
  laps: LapRow[],
  currentLap: number,
  safetyCarPeriods: SafetyCarPeriod[] = [],
  excludeSC: boolean = false
): Set<string> {
  const excluded = new Set<string>()
  for (const lap of laps) {
    if (lap.LapNumber === null || lap.LapNumber > currentLap) continue

    const isBasicOutlier =
      lap.PitInTime !== null || lap.PitOutTime !== null || lap.LapNumber === 1

    let isSCOutlier = false
    if (excludeSC) {
      for (const period of safetyCarPeriods) {
        if (lap.LapNumber >= period.start_lap && lap.LapNumber <= period.end_lap) {
          isSCOutlier = true
          break
        }
        // Restart lap
        if (lap.LapNumber === period.end_lap + 1) {
          isSCOutlier = true
          break
        }
      }
    }

    if (isBasicOutlier || isSCOutlier) {
      excluded.add(`${lap.Driver}::${lap.LapNumber}`)
    }
  }
  return excluded
}

/**
 * Build the heatmap z-matrix, x/y labels, and customdata for hover tooltips.
 *
 * Per-driver normalization with rolling bests:
 * - Session best cell: z = -1.0 (sentinel for purple)
 * - Personal best cell: z = -0.5 (sentinel for green)
 * - Normalized: z in [0, 1] where 0 = personal best, 1 = worst clean
 * - Missing data: z = null
 */
export function buildHeatmapData(
  sectorRows: SectorRow[],
  laps: LapRow[],
  drivers: DriverInfo[],
  visibleDrivers: Set<string>,
  currentLap: number,
  safetyCarPeriods: SafetyCarPeriod[] = [],
  excludeSC: boolean = false
): HeatmapResult {
  // 1. Get driver order filtered to visible drivers
  const allOrder = computeDriverOrder(laps, drivers, currentLap)
  const driverOrder = allOrder.filter((e) => visibleDrivers.has(e.driver))

  if (driverOrder.length === 0) {
    return { z: [], x: [], y: [], customdata: [], driverOrder: [], maxLap: 0 }
  }

  // 2. Filter sector data to revealed laps only
  const revealed = sectorRows.filter((r) => r.lapNumber <= currentLap)
  const sectorLookup = buildSectorLookup(revealed)

  // 3. Compute maxLap from revealed data
  let maxLap = 0
  for (const r of revealed) {
    if (r.lapNumber > maxLap) maxLap = r.lapNumber
  }
  if (maxLap === 0) {
    return { z: [], x: [], y: [], customdata: [], driverOrder: driverOrder.map((e) => e.driver), maxLap: 0 }
  }

  // 4. Build excluded lap set
  const excludedLaps = buildExcludedLapSet(laps, currentLap, safetyCarPeriods, excludeSC)

  // 5. Visible driver set for session-best computation
  const visibleDriverSet = new Set(driverOrder.map((e) => e.driver))

  // 6. Compute session bests per sector (from visible drivers, non-excluded clean laps)
  const sessionBest: Record<SectorKey, number> = { s1: Infinity, s2: Infinity, s3: Infinity }
  for (const row of revealed) {
    if (!visibleDriverSet.has(row.driver)) continue
    const lapKey = `${row.driver}::${row.lapNumber}`
    const isClean = !excludedLaps.has(lapKey)
    for (const sk of SECTOR_KEYS) {
      const val = row[sk]
      if (val !== null && isClean && val < sessionBest[sk]) {
        sessionBest[sk] = val
      }
    }
  }

  // 7. Per-driver stats: personal best and worst clean per sector
  type DriverStats = { personalBest: Record<SectorKey, number>; worstClean: Record<SectorKey, number> }
  const driverStats = new Map<string, DriverStats>()

  for (const entry of driverOrder) {
    const stats: DriverStats = {
      personalBest: { s1: Infinity, s2: Infinity, s3: Infinity },
      worstClean: { s1: -Infinity, s2: -Infinity, s3: -Infinity },
    }

    for (const row of revealed) {
      if (row.driver !== entry.driver) continue
      const lapKey = `${row.driver}::${row.lapNumber}`
      const isClean = !excludedLaps.has(lapKey)

      for (const sk of SECTOR_KEYS) {
        const val = row[sk]
        if (val === null) continue
        if (val < stats.personalBest[sk]) stats.personalBest[sk] = val
        if (isClean && val > stats.worstClean[sk]) stats.worstClean[sk] = val
      }
    }

    driverStats.set(entry.driver, stats)
  }

  // 8. Build z-matrix and customdata
  const totalCols = maxLap * 3
  const z: (number | null)[][] = []
  const customdata: (HeatmapCell | null)[][] = []
  const y: string[] = driverOrder.map((e) => e.driver)

  for (const entry of driverOrder) {
    const zRow: (number | null)[] = new Array(totalCols).fill(null)
    const cdRow: (HeatmapCell | null)[] = new Array(totalCols).fill(null)
    const stats = driverStats.get(entry.driver)!

    for (let lap = 1; lap <= maxLap; lap++) {
      const sectorRow = sectorLookup.get(`${entry.driver}::${lap}`)

      for (let si = 0; si < 3; si++) {
        const colIdx = (lap - 1) * 3 + si
        const sk = SECTOR_KEYS[si]
        const sectorNum = (si + 1) as 1 | 2 | 3
        const val = sectorRow ? sectorRow[sk] : null

        if (val === null) {
          // Missing data stays null
          cdRow[colIdx] = {
            label: `L${lap} S${sectorNum}: No data`,
            rawTime: null,
            delta: null,
            sector: sectorNum,
            lapNumber: lap,
            driver: entry.driver,
          }
          continue
        }

        const pb = stats.personalBest[sk]
        const wc = stats.worstClean[sk]
        const sb = sessionBest[sk]
        const delta = pb !== Infinity ? val - pb : null
        const deltaStr = delta !== null ? (delta >= 0 ? `+${delta.toFixed(3)}s` : `${delta.toFixed(3)}s`) : ''
        const label = `L${lap} S${sectorNum}: ${val.toFixed(3)}s${deltaStr ? ` | ${deltaStr} vs PB` : ''}`

        let zVal: number
        if (sb !== Infinity && val === sb) {
          // Session best
          zVal = -1.0
        } else if (pb !== Infinity && val === pb) {
          // Personal best (not session best)
          zVal = -0.5
        } else if (wc === -Infinity || wc === pb) {
          // Zero denominator: only one value or all same => personal best
          zVal = -0.5
        } else {
          // Normalize to [0, 1]
          zVal = (val - pb) / (wc - pb)
          if (zVal < 0) zVal = 0
          if (zVal > 1) zVal = 1
        }

        zRow[colIdx] = zVal
        cdRow[colIdx] = {
          label,
          rawTime: val,
          delta,
          sector: sectorNum,
          lapNumber: lap,
          driver: entry.driver,
        }
      }
    }

    z.push(zRow)
    customdata.push(cdRow)
  }

  // 9. Build x labels
  const x: string[] = []
  for (let lap = 1; lap <= maxLap; lap++) {
    for (let s = 1; s <= 3; s++) {
      x.push(`L${lap}S${s}`)
    }
  }

  return {
    z,
    x,
    y,
    customdata,
    driverOrder: driverOrder.map((e) => e.driver),
    maxLap,
  }
}

/**
 * Build Plotly shape(s) highlighting the current lap's 3 sector columns.
 */
export function buildLapCursorShapes(
  currentLap: number,
  maxLap: number,
  driverCount: number
): Partial<Plotly.Shape>[] {
  if (currentLap < 1 || currentLap > maxLap || driverCount === 0) return []

  const x0 = (currentLap - 1) * 3 - 0.5
  const x1 = (currentLap - 1) * 3 + 2.5

  return [
    {
      type: 'rect',
      x0,
      x1,
      y0: -0.5,
      y1: driverCount - 0.5,
      xref: 'x',
      yref: 'y',
      line: { color: 'rgba(255, 255, 255, 0.8)', width: 2 },
      fillcolor: 'transparent',
    } as Partial<Plotly.Shape>,
  ]
}

// ---- React hook ----

export function useSectorData(visibleDrivers: Set<string>, excludeSC: boolean = false) {
  const year = useSessionStore((s) => s.year)
  const event = useSessionStore((s) => s.event)
  const sessionType = useSessionStore((s) => s.sessionType)
  const laps = useSessionStore((s) => s.laps)
  const drivers = useSessionStore((s) => s.drivers)
  const currentLap = useSessionStore((s) => s.currentLap)
  const safetyCarPeriods = useSessionStore((s) => s.safetyCarPeriods)

  const [sectorRows, setSectorRows] = useState<SectorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch sector data when session params are available
  useEffect(() => {
    if (!year || !event) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    fetchSectors(year, event, sessionType)
      .then((rows) => {
        setSectorRows(rows)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [year, event, sessionType])

  // Memo 1: heatmap data — recomputed when sector data or visible state changes
  const heatmapResult = useMemo(() => {
    if (sectorRows.length === 0) return null
    return buildHeatmapData(sectorRows, laps, drivers, visibleDrivers, currentLap, safetyCarPeriods, excludeSC)
  }, [sectorRows, laps, drivers, visibleDrivers, currentLap, safetyCarPeriods, excludeSC])

  // Memo 2: cursor shapes — only depends on currentLap and heatmap dimensions
  const cursorShapes = useMemo(() => {
    if (!heatmapResult || heatmapResult.maxLap === 0) return []
    return buildLapCursorShapes(currentLap, heatmapResult.maxLap, heatmapResult.driverOrder.length)
  }, [currentLap, heatmapResult])

  return { loading, error, heatmapResult, cursorShapes }
}
