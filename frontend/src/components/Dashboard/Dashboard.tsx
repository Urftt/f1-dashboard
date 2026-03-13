import { GapChart } from '@/components/GapChart/GapChart'
import { DriverSelector } from '@/components/GapChart/DriverSelector'
import { StandingsBoard } from '@/components/StandingsBoard/StandingsBoard'

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

      {/* Right column — standings board */}
      <div className="lg:col-span-2">
        <StandingsBoard />
      </div>
    </div>
  )
}
