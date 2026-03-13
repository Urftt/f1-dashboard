import { create } from 'zustand'
import type { LapRow, LoadingStage, ReplaySpeed } from '@/types/session'

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
  selectedDrivers: [string | null, string | null]
  currentLap: number
  isPlaying: boolean
  replaySpeed: ReplaySpeed
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
  setSelectedDrivers: (a: string | null, b: string | null) => void
  setCurrentLap: (lap: number) => void
  setIsPlaying: (playing: boolean) => void
  setReplaySpeed: (speed: ReplaySpeed) => void
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
  selectedDrivers: [null, null],
  currentLap: 1,
  isPlaying: false,
  replaySpeed: 1,
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

  setLaps: (laps) => {
    const lap1 = laps.filter(l => l.LapNumber === 1 && l.Position !== null)
    const sorted = [...lap1].sort((a, b) => (a.Position ?? 99) - (b.Position ?? 99))
    const driverA = sorted[0]?.Driver ?? null
    const driverB = sorted[1]?.Driver ?? null
    set({
      laps,
      stage: 'complete',
      progress: 100,
      isCompact: true,
      selectedDrivers: [driverA, driverB],
      currentLap: 1,
      isPlaying: false,
    })
  },

  setError: (error) => set({ error, stage: 'error' }),

  reset: () => set({ ...initialState }),

  toggleCompact: () => set((state) => ({ isCompact: !state.isCompact })),

  setSelectedDrivers: (a, b) => set({ selectedDrivers: [a, b] }),

  setCurrentLap: (lap) => set({ currentLap: lap }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setReplaySpeed: (speed) => set({ replaySpeed: speed }),
}))
