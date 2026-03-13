import { useSessionStore } from '@/stores/sessionStore'
import { SessionSelector } from '@/components/SessionSelector/SessionSelector'
import { LoadingProgress } from '@/components/LoadingProgress/LoadingProgress'
import { EmptyState } from '@/components/Dashboard/EmptyState'

function App() {
  const stage = useSessionStore((s) => s.stage)
  const laps = useSessionStore((s) => s.laps)
  const event = useSessionStore((s) => s.event)
  const year = useSessionStore((s) => s.year)
  const sessionType = useSessionStore((s) => s.sessionType)

  const drivers = new Set(laps.map((l) => l.Driver))

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">F1 Dashboard</h1>

        <SessionSelector />

        <LoadingProgress />

        <div
          className={[
            'transition-opacity duration-500',
            stage === 'complete' ? 'opacity-100' : 'opacity-0 pointer-events-none',
          ].join(' ')}
        >
          {stage === 'complete' && (
            <div className="p-4 border rounded-lg bg-card">
              <p className="text-sm font-medium">
                Session loaded: {laps.length} laps from {drivers.size} drivers
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {event} {year} — {sessionType}
              </p>
            </div>
          )}
        </div>

        {stage === 'idle' && <EmptyState />}
      </div>
    </div>
  )
}

export default App
