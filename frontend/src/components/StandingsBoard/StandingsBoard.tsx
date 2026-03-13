import { useState } from 'react'
import { Tooltip } from '@base-ui/react/tooltip'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { useStandingsData, COMPOUND_DISPLAY } from './useStandingsData'
import type { StandingRow } from '@/types/session'

type GapMode = 'interval' | 'gap'

/**
 * Single driver row in the standings table.
 */
function StandingRowItem({ row, mode }: { row: StandingRow; mode: GapMode }) {
  const compoundDisplay = row.compound ? COMPOUND_DISPLAY[row.compound] : null
  const isInactive = row.status === 'dnf' || row.status === 'finished'

  // Gap/interval cell content
  let gapCell: string
  if (row.status === 'dnf') {
    gapCell = `DNF L${row.retiredOnLap}`
  } else if (row.status === 'finished') {
    gapCell = 'FIN'
  } else if (row.position === 1) {
    gapCell = '---'
  } else if (row.isLapped) {
    gapCell = row.lapsDown === 1 ? '+1 LAP' : `+${row.lapsDown} LAPS`
  } else if (mode === 'gap' && row.gap !== null) {
    gapCell = `+${row.gap.toFixed(1)}s`
  } else if (mode === 'interval' && row.interval !== null) {
    gapCell = `+${row.interval.toFixed(1)}s`
  } else {
    gapCell = '---'
  }

  return (
    <div
      className={`flex items-center gap-1 px-2 py-1.5 border-l-2 transition-all duration-200${isInactive ? ' opacity-40' : ''}`}
      style={{ borderLeftColor: row.teamColor }}
    >
      {/* Position */}
      <div className="w-9 flex items-center gap-0.5 text-sm font-mono shrink-0">
        <span>{isInactive && row.position >= 99 ? '—' : row.position}</span>
        {row.prevPosition !== null && row.position < row.prevPosition && (
          <ChevronUp size={12} className="text-green-500" />
        )}
        {row.prevPosition !== null && row.position > row.prevPosition && (
          <ChevronDown size={12} className="text-red-500" />
        )}
      </div>

      {/* Driver abbreviation with tooltip showing full name */}
      <div className="w-12 shrink-0">
        <Tooltip.Root>
          <Tooltip.Trigger className="text-sm font-mono cursor-default">
            {row.driver}
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup className="bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md z-50">
                {row.fullName}
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>

      {/* Gap / Interval */}
      <div className={`flex-1 text-right text-sm font-mono${row.status === 'dnf' ? ' text-red-400' : ''}`}>
        {gapCell}
      </div>

      {/* Tire compound */}
      <div className="w-6 text-center shrink-0">
        {compoundDisplay ? (
          <span
            style={{ color: compoundDisplay.color }}
            className={`font-bold font-mono${row.compoundChanged ? ' animate-pulse' : ''}`}
          >
            {compoundDisplay.letter}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </div>

      {/* Tire age */}
      <div className="w-8 text-right text-sm font-mono shrink-0">
        {row.tyreLife ?? '—'}
      </div>

      {/* Pit count */}
      <div className="w-6 text-center text-sm font-mono shrink-0">
        {row.pitStops}
      </div>
    </div>
  )
}

/**
 * StandingsBoard — Shows all drivers sorted by race position at the current replay lap.
 *
 * Columns: POS | DRIVER | INT/GAP (toggle) | TIRE | AGE | PIT
 *
 * The INT/GAP column header is a toggle button switching between interval
 * (gap to car directly ahead) and gap (gap to race leader) modes.
 *
 * ~10 rows visible, rest accessible by scrolling. DNF/finished drivers
 * appear at the bottom with dimmed styling.
 */
export function StandingsBoard() {
  const [mode, setMode] = useState<GapMode>('interval')
  const rows = useStandingsData()

  return (
    <Tooltip.Provider>
      <div className="h-full max-h-[360px] bg-card border border-border rounded-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border shrink-0">
          <div className="w-9 text-xs text-muted-foreground uppercase tracking-wider shrink-0">
            POS
          </div>
          <div className="w-12 text-xs text-muted-foreground uppercase tracking-wider shrink-0">
            DRV
          </div>
          <div className="flex-1 text-right">
            <button
              onClick={() => setMode((m) => (m === 'interval' ? 'gap' : 'interval'))}
              className="text-xs text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
              {mode === 'interval' ? 'INT' : 'GAP'}
            </button>
          </div>
          <div className="w-6 text-center text-xs text-muted-foreground uppercase tracking-wider shrink-0">
            T
          </div>
          <div className="w-8 text-right text-xs text-muted-foreground uppercase tracking-wider shrink-0">
            AGE
          </div>
          <div className="w-6 text-center text-xs text-muted-foreground uppercase tracking-wider shrink-0">
            PIT
          </div>
        </div>

        {/* Rows */}
        {rows.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground text-center">No standings data</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/50">
            {rows.map((row) => (
              <StandingRowItem key={row.driver} row={row} mode={mode} />
            ))}
          </div>
        )}
      </div>
    </Tooltip.Provider>
  )
}
