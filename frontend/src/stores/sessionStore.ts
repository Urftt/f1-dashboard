import { create } from 'zustand'
import type { LapRow, LoadingStage } from '@/types/session'

interface SessionState {
  year: number | null
  event: string | null
  sessionType: string
  stage: LoadingStage
  progress: number
  stageLabel: string
  laps: LapRow[]
  error: string | null
  isCompact: boolean
}

interface SessionActions {
  setYear: (year: number) => void
  setEvent: (event: string) => void
  setSessionType: (sessionType: string) => void
  setProgress: (pct: number, label: string) => void
  setLaps: (laps: LapRow[]) => void
  setError: (msg: string) => void
  reset: () => void
  toggleCompact: () => void
}

export type SessionStore = SessionState & SessionActions

const currentYear = new Date().getFullYear()

const initialState: SessionState = {
  year: currentYear,
  event: null,
  sessionType: 'Race',
  stage: 'idle',
  progress: 0,
  stageLabel: '',
  laps: [],
  error: null,
  isCompact: false,
}

export const useSessionStore = create<SessionStore>((set) => ({
  ...initialState,

  setYear: (year) =>
    set({
      year,
      event: null,
      sessionType: 'Race',
      stage: 'idle',
      progress: 0,
      error: null,
    }),

  setEvent: (event) =>
    set({
      event,
      sessionType: 'Race',
    }),

  setSessionType: (sessionType) => set({ sessionType }),

  setProgress: (progress, stageLabel) =>
    set({ progress, stageLabel, stage: 'loading' }),

  setLaps: (laps) =>
    set({ laps, stage: 'complete', progress: 100, isCompact: true }),

  setError: (error) => set({ error, stage: 'error' }),

  reset: () => set({ ...initialState }),

  toggleCompact: () => set((state) => ({ isCompact: !state.isCompact })),
}))
