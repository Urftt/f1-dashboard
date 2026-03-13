import { useSessionStore } from '@/stores/sessionStore'
import { loadSession } from '@/lib/sse'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'

export function LoadingProgress() {
  const stage = useSessionStore((s) => s.stage)
  const progress = useSessionStore((s) => s.progress)
  const stageLabel = useSessionStore((s) => s.stageLabel)
  const error = useSessionStore((s) => s.error)
  const year = useSessionStore((s) => s.year)
  const event = useSessionStore((s) => s.event)
  const sessionType = useSessionStore((s) => s.sessionType)
  const store = useSessionStore()

  if (stage !== 'loading' && stage !== 'error') {
    return null
  }

  const handleRetry = () => {
    if (year !== null && event !== null) {
      loadSession(year, event, sessionType, store)
    }
  }

  if (stage === 'error') {
    return (
      <div className="mt-3 p-3 border border-destructive/30 rounded-lg bg-destructive/5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-destructive">
            {error ?? 'An error occurred while loading the session.'}
          </span>
          <Button variant="outline" size="sm" onClick={handleRetry}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{stageLabel}</span>
        <span className="tabular-nums font-medium">{Math.round(progress)}%</span>
      </div>
      <Progress value={progress} />
    </div>
  )
}
