import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface YearSelectProps {
  value: number | null
  onChange: (year: number) => void
  disabled?: boolean
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from(
  { length: CURRENT_YEAR - 2018 + 1 },
  (_, i) => CURRENT_YEAR - i
)

export function YearSelect({ value, onChange, disabled }: YearSelectProps) {
  return (
    <Select
      value={value !== null ? String(value) : undefined}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
    >
      <SelectTrigger className="w-32">
        <SelectValue placeholder="Year" />
      </SelectTrigger>
      <SelectContent>
        {YEARS.map((year) => (
          <SelectItem key={year} value={String(year)}>
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
