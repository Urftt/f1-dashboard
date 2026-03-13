import { Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSessionStore } from '@/stores/sessionStore'
import { useReplayTimer } from '@/hooks/useReplayTimer'
import type { ReplaySpeed } from '@/types/session'

const SPEEDS: ReplaySpeed[] = [0.5, 1, 2, 4]

export function ReplayControls() {
  const stage = useSessionStore((s) => s.stage)
  const isPlaying = useSessionStore((s) => s.isPlaying)
  const replaySpeed = useSessionStore((s) => s.replaySpeed)
  const currentLap = useSessionStore((s) => s.currentLap)
  const setIsPlaying = useSessionStore((s) => s.setIsPlaying)
  const setReplaySpeed = useSessionStore((s) => s.setReplaySpeed)
  const setCurrentLap = useSessionStore((s) => s.setCurrentLap)

  const { maxLap } = useReplayTimer()

  if (stage !== 'complete') return null

  function handlePlayPause() {
    if (currentLap >= maxLap) {
      // Restart from lap 1 then play
      setCurrentLap(1)
      setIsPlaying(true)
    } else {
      setIsPlaying(!isPlaying)
    }
  }

  return (
    <div className="flex items-center gap-4 w-full px-4 py-2 bg-card border-b border-border">
      {/* Play/Pause */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePlayPause}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
      </Button>

      {/* Speed buttons */}
      <div className="flex items-center gap-1">
        {SPEEDS.map((speed) => (
          <Button
            key={speed}
            variant={replaySpeed === speed ? 'default' : 'ghost'}
            size="xs"
            onClick={() => setReplaySpeed(speed)}
            aria-pressed={replaySpeed === speed}
          >
            {speed === 0.5 ? '0.5x' : `${speed}x`}
          </Button>
        ))}
      </div>

      {/* Lap scrubber */}
      <input
        type="range"
        className="flex-1 accent-primary cursor-pointer"
        min={1}
        max={maxLap}
        step={1}
        value={currentLap}
        onChange={(e) => setCurrentLap(Number(e.target.value))}
        aria-label="Lap scrubber"
      />

      {/* Lap counter */}
      <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap min-w-[5rem] text-right">
        Lap {currentLap}/{maxLap}
      </span>
    </div>
  )
}
