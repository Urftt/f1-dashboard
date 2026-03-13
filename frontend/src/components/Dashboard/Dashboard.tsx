import { GapChart } from '@/components/GapChart/GapChart'
import { DriverSelector } from '@/components/GapChart/DriverSelector'

/**
 * Dashboard — Two-column layout for the main app body.
 *
 * Left column (~60%): DriverSelector above GapChart
 * Right column (~40%): Standings placeholder for Phase 3
 *
 * Only rendered when stage === 'complete' (enforced by App.tsx).
 */
export function Dashboard() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-full">
      {/* Left column — gap chart area */}
      <div className="lg:col-span-3 flex flex-col gap-3">
        <DriverSelector />
        <GapChart />
      </div>

      {/* Right column — standings placeholder */}
      <div className="lg:col-span-2">
        <div className="h-full min-h-[200px] flex items-center justify-center bg-card border border-border rounded-lg p-6">
          <p className="text-sm text-muted-foreground text-center">
            Standings coming in Phase 3
          </p>
        </div>
      </div>
    </div>
  )
}
