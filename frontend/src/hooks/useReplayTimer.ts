import { useEffect, useMemo, useRef } from 'react'
import { useSessionStore } from '@/stores/sessionStore'

export function useReplayTimer(): { maxLap: number } {
  const isPlaying = useSessionStore((s) => s.isPlaying)
  const replaySpeed = useSessionStore((s) => s.replaySpeed)
  const currentLap = useSessionStore((s) => s.currentLap)
  const laps = useSessionStore((s) => s.laps)
  const setCurrentLap = useSessionStore((s) => s.setCurrentLap)
  const setIsPlaying = useSessionStore((s) => s.setIsPlaying)

  const maxLap = useMemo(
    () => (laps.length > 0 ? Math.max(...laps.map((l) => l.LapNumber ?? 0)) : 1),
    [laps]
  )

  // Ref to avoid stale closure inside setInterval
  const lapRef = useRef(currentLap)
  lapRef.current = currentLap

  useEffect(() => {
    if (!isPlaying || currentLap >= maxLap) return

    const intervalMs = 1000 / replaySpeed

    const id = setInterval(() => {
      const next = lapRef.current + 1
      if (next >= maxLap) {
        setCurrentLap(maxLap)
        setIsPlaying(false)
        clearInterval(id)
      } else {
        setCurrentLap(next)
      }
    }, intervalMs)

    return () => clearInterval(id)
  }, [isPlaying, replaySpeed, maxLap, setCurrentLap, setIsPlaying])

  return { maxLap }
}
