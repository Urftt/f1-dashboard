import { useSessionStore } from '@/stores/sessionStore'
import { SessionSelector } from '@/components/SessionSelector/SessionSelector'
import { LoadingProgress } from '@/components/LoadingProgress/LoadingProgress'
import { EmptyState } from '@/components/Dashboard/EmptyState'
import { Dashboard } from '@/components/Dashboard/Dashboard'
import { ReplayControls } from '@/components/ReplayControls/ReplayControls'

function App() {
  const stage = useSessionStore((s) => s.stage)

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky header: app title + session selector + replay controls */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-7xl px-4 pt-4 pb-2 space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">F1 Dashboard</h1>
          <SessionSelector />
          <LoadingProgress />
        </div>
        <ReplayControls />
      </header>

      {/* Body */}
      <main className="mx-auto max-w-7xl px-4 py-4">
        {stage === 'idle' && <EmptyState />}
        {stage === 'complete' && <Dashboard />}
      </main>
    </div>
  )
}

export default App
