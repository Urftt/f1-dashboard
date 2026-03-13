import { useDriverList } from './useGapData'
import { useSessionStore } from '@/stores/sessionStore'
import { DRIVER_FULL_NAMES } from '@/lib/driverColors'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * DriverSelector — Two side-by-side dropdowns for Driver A and Driver B.
 *
 * Items grouped by team using SelectGroup + SelectLabel.
 * Each item shows "ABB — Full Name".
 * Selected value shows abbreviation only.
 * Drivers ordered by lap 1 grid position (no final-result spoilers).
 */
export function DriverSelector() {
  const { teams } = useDriverList()
  const selectedDrivers = useSessionStore((s) => s.selectedDrivers)
  const setSelectedDrivers = useSessionStore((s) => s.setSelectedDrivers)

  const [driverA, driverB] = selectedDrivers

  function handleChangeA(value: string | null) {
    if (value === null) return
    setSelectedDrivers(value, driverB)
  }

  function handleChangeB(value: string | null) {
    if (value === null) return
    setSelectedDrivers(driverA, value)
  }

  const dropdowns = [
    { label: 'Driver A', value: driverA, onChange: handleChangeA },
    { label: 'Driver B', value: driverB, onChange: handleChangeB },
  ]

  return (
    <div className="flex flex-row gap-4">
      {dropdowns.map(({ label, value, onChange }) => (
        <div key={label} className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Select value={value ?? undefined} onValueChange={onChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select driver" />
            </SelectTrigger>
            <SelectContent>
              {teams.map(({ team, drivers }) => (
                <SelectGroup key={team}>
                  <SelectLabel>{team}</SelectLabel>
                  {drivers.map((abbr) => (
                    <SelectItem key={abbr} value={abbr}>
                      {abbr} — {DRIVER_FULL_NAMES[abbr] ?? abbr}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  )
}
