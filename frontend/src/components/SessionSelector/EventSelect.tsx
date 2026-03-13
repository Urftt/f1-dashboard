import { ZapIcon } from 'lucide-react'
import type { EventSummary } from '@/types/session'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface EventSelectProps {
  events: EventSummary[]
  value: string | null
  onChange: (event: string) => void
  disabled?: boolean
  loading?: boolean
}

export function EventSelect({
  events,
  value,
  onChange,
  disabled,
  loading,
}: EventSelectProps) {
  return (
    <Select
      value={value ?? undefined}
      onValueChange={(v) => { if (v !== null) onChange(v) }}
      disabled={disabled ?? loading ?? events.length === 0}
    >
      <SelectTrigger className="w-56">
        <SelectValue placeholder={loading ? 'Loading...' : 'Select event'} />
      </SelectTrigger>
      <SelectContent>
        {events.map((event) => (
          <SelectItem key={event.round} value={event.name}>
            <span className="flex items-center gap-1.5">
              {event.is_cached && (
                <ZapIcon className="size-3 text-yellow-500 shrink-0" />
              )}
              <span>
                {event.name}
                <span className="ml-1 text-muted-foreground text-xs">
                  ({event.country})
                </span>
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
