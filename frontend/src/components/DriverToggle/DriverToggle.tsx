import { useDriverList } from '@/components/GapChart/useGapData'
import { useSessionStore } from '@/stores/sessionStore'

interface DriverToggleProps {
  visibleDrivers: Set<string>
  onToggle: (abbreviation: string) => void
}

/**
 * Team-grouped checkbox panel for toggling driver visibility in charts.
 *
 * Features:
 * - Groups drivers by team
 * - Labels each checkbox in the driver's team color
 * - Compact horizontal flex layout
 */
export function DriverToggle({ visibleDrivers, onToggle }: DriverToggleProps) {
  const { teams } = useDriverList()
  const sessionDrivers = useSessionStore((s) => s.drivers)
  const driverColorMap = new Map(sessionDrivers.map((d) => [d.abbreviation, d.teamColor]))

  if (teams.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">No driver data available</div>
    )
  }

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-3">
      {teams.map(({ team, drivers }) => (
        <div key={team} className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            {team}
          </span>
          <div className="flex gap-3">
            {drivers.map((driverAbbr) => {
              const color = driverColorMap.get(driverAbbr) ?? '#888888'
              const isVisible = visibleDrivers.has(driverAbbr)
              return (
                <label
                  key={driverAbbr}
                  className="flex items-center gap-1.5 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => onToggle(driverAbbr)}
                    className="sr-only"
                  />
                  <span
                    className="w-3 h-3 rounded-sm flex-shrink-0 border transition-opacity"
                    style={{
                      backgroundColor: isVisible ? color : 'transparent',
                      borderColor: color,
                      opacity: isVisible ? 1 : 0.5,
                    }}
                  />
                  <span
                    className="text-xs font-mono"
                    style={{ color: isVisible ? color : '#888888' }}
                  >
                    {driverAbbr}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
