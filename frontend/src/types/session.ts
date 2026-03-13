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
  LapTime: number | null
  Time: number | null
  PitInTime: number | null
  PitOutTime: number | null
  Compound: string | null
  TyreLife: number | null
  Position: number | null
  Stint: number | null
}

export type LoadingStage = 'idle' | 'loading' | 'complete' | 'error'

export type ReplaySpeed = 0.5 | 1 | 2 | 4
