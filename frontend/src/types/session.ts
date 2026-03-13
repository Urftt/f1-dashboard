export interface EventSummary {
  round: number
  name: string
  country: string
  is_cached: boolean
}

export interface SessionTypeInfo {
  key: string
  name: string
}

export interface LapRow {
  LapNumber: number | null
  Driver: string
  Team: string | null
  LapTime: number | null
  Time: number | null
  PitInTime: number | null
  PitOutTime: number | null
  Compound: string | null
  TyreLife: number | null
  Position: number | null
  Stint: number | null
}

export interface DriverInfo {
  abbreviation: string
  fullName: string
  team: string
  teamColor: string
}

export type LoadingStage = 'idle' | 'loading' | 'complete' | 'error'

export type ReplaySpeed = 0.5 | 1 | 2 | 4

export type DriverStatus = 'racing' | 'dnf' | 'finished'

export interface StandingRow {
  driver: string           // abbreviation (e.g., "VER")
  fullName: string         // from DriverInfo
  teamColor: string        // hex from DriverInfo
  position: number | null    // null when no valid position (e.g. DNF)
  prevPosition: number | null  // position at currentLap - 1 (null at lap 1)
  gap: number | null       // seconds behind leader (null for leader)
  interval: number | null  // seconds behind car ahead (null for leader)
  isLapped: boolean
  lapsDown: number         // 0 = lead lap, 1 = +1 LAP, etc.
  compound: string | null  // 'SOFT' | 'MEDIUM' | 'HARD' | 'INTERMEDIATE' | 'WET'
  tyreLife: number | null
  pitStops: number
  compoundChanged: boolean // true if compound differs from previous lap
  status: DriverStatus     // 'racing' | 'dnf' | 'finished'
  retiredOnLap: number | null // last lap completed before retiring (null if still racing)
}
