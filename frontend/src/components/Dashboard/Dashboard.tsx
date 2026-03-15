import { GapChart } from '@/components/GapChart/GapChart'
import { DriverSelector } from '@/components/GapChart/DriverSelector'
import { StandingsBoard } from '@/components/StandingsBoard/StandingsBoard'
import { StintTimeline } from '@/components/StintTimeline/StintTimeline'
import { DriverToggle } from '@/components/DriverToggle/DriverToggle'
import { LapTimeChart } from '@/components/LapTimeChart/LapTimeChart'
import { PositionChart } from '@/components/PositionChart/PositionChart'
import { IntervalHistory } from '@/components/IntervalHistory/IntervalHistory'
import { SectorHeatmap } from '@/components/SectorHeatmap/SectorHeatmap'
import { useVisibleDrivers } from '@/components/DriverToggle/useVisibleDrivers'
import { useSessionStore } from '@/stores/sessionStore'

/**
 * Dashboard — Two-section layout for the main app body.
 *
 * Section 1 (always visible): Two-column grid
 *   - Left column (~60%): DriverSelector above GapChart
 *   - Right column (~40%): StandingsBoard
 *
 * Section 2 (visible during active replay only): Analysis section
 *   - Labeled "STRATEGY & ANALYSIS" divider
 *   - StintTimeline full-width chart card
 *
 * Only rendered when stage === 'complete' (enforced by App.tsx).
 */
export function Dashboard() {
  // Active when the user has started playback or scrubbed past lap 1
  const isReplayActive = useSessionStore((s) => s.isPlaying || s.currentLap > 1)
  const { visibleDrivers, toggleDriver } = useVisibleDrivers()

  return (
    <div className="space-y-6">
      {/* Section 1: gap chart + standings board grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left column — gap chart area */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          <DriverSelector />
          <GapChart />
        </div>

        {/* Right column — standings board */}
        <div className="lg:col-span-2 min-h-0 overflow-hidden">
          <StandingsBoard />
        </div>
      </div>

      {/* Section 2: strategy & analysis — only visible during active replay */}
      {isReplayActive && (
        <section className="space-y-4">
          {/* Divider with label */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
              Strategy &amp; Analysis
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Stint Timeline card */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Stint Timeline</h3>
            <StintTimeline />
          </div>

          {/* Driver Toggle card */}
          <div className="bg-card border border-border rounded-lg p-4">
            <DriverToggle visibleDrivers={visibleDrivers} onToggle={toggleDriver} />
          </div>

          {/* Lap Time Chart card */}
          <div className="bg-card border border-border rounded-lg p-4">
            <LapTimeChart visibleDrivers={visibleDrivers} />
          </div>

          {/* Position Chart card */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Race Position</h3>
            <PositionChart visibleDrivers={visibleDrivers} />
          </div>

          {/* Interval History card */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Interval to Car Ahead</h3>
            <IntervalHistory visibleDrivers={visibleDrivers} />
          </div>

          {/* Sector Heatmap card */}
          <div className="bg-card border border-border rounded-lg p-4">
            <SectorHeatmap visibleDrivers={visibleDrivers} />
          </div>
        </section>
      )}
    </div>
  )
}
