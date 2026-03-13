import type { SessionTypeInfo } from '@/types/session'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SessionTypeSelectProps {
  sessionTypes: SessionTypeInfo[]
  value: string
  onChange: (sessionType: string) => void
  disabled?: boolean
  loading?: boolean
}

export function SessionTypeSelect({
  sessionTypes,
  value,
  onChange,
  disabled,
  loading,
}: SessionTypeSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => { if (v !== null) onChange(v) }}
      disabled={disabled ?? loading ?? sessionTypes.length === 0}
    >
      <SelectTrigger className="w-40">
        <SelectValue placeholder={loading ? 'Loading...' : 'Session type'} />
      </SelectTrigger>
      <SelectContent>
        {sessionTypes.map((st) => (
          <SelectItem key={st.key} value={st.key}>
            {st.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
