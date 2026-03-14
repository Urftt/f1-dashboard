import { useState, useEffect } from 'react'
import type { LapRow } from '@/types/session'
import { useSessionStore } from '@/stores/sessionStore'

/**
 * Computes the default set of visible drivers based on top 2 lap 1 positions.
 * Pure function — testable without React.
 */
export function computeDefaultVisible(laps: LapRow[]): Set<string> {
  const lap1 = laps.filter((l) => l.LapNumber === 1 && l.Position !== null)
  const sorted = [...lap1].sort((a, b) => (a.Position ?? 99) - (b.Position ?? 99))
  const top2 = sorted.slice(0, 2).map((l) => l.Driver)
  return new Set(top2)
}

/**
 * Hook managing visible driver state.
 * Initializes from top 2 lap 1 positions and resets when new session data loads.
 */
export function useVisibleDrivers() {
  const laps = useSessionStore((s) => s.laps)
  const [visibleDrivers, setVisibleDrivers] = useState<Set<string>>(() =>
    computeDefaultVisible(laps)
  )
  // Track previous laps length to detect session transitions (empty -> populated)
  const [prevLapsLength, setPrevLapsLength] = useState(laps.length)

  useEffect(() => {
    // Only reset when transitioning from empty to populated
    if (prevLapsLength === 0 && laps.length > 0) {
      setVisibleDrivers(computeDefaultVisible(laps))
    }
    setPrevLapsLength(laps.length)
  }, [laps, prevLapsLength])

  const toggleDriver = (abbreviation: string) => {
    setVisibleDrivers((prev) => {
      const next = new Set(prev)
      if (next.has(abbreviation)) {
        next.delete(abbreviation)
      } else {
        next.add(abbreviation)
      }
      return next
    })
  }

  return { visibleDrivers, toggleDriver }
}
