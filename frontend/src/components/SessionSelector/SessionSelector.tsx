import { useState, useEffect, useCallback } from 'react'
import { useSessionStore } from '@/stores/sessionStore'
import { fetchSchedule, fetchSessionTypes } from '@/lib/api'
import { loadSession } from '@/lib/sse'
import type { EventSummary, SessionTypeInfo } from '@/types/session'
import { YearSelect } from './YearSelect'
import { EventSelect } from './EventSelect'
import { SessionTypeSelect } from './SessionTypeSelect'
import { Button } from '@/components/ui/button'

export function SessionSelector() {
  const year = useSessionStore((s) => s.year)
  const event = useSessionStore((s) => s.event)
  const sessionType = useSessionStore((s) => s.sessionType)
  const stage = useSessionStore((s) => s.stage)
  const isCompact = useSessionStore((s) => s.isCompact)
  const setYear = useSessionStore((s) => s.setYear)
  const setEvent = useSessionStore((s) => s.setEvent)
  const setSessionType = useSessionStore((s) => s.setSessionType)
  const toggleCompact = useSessionStore((s) => s.toggleCompact)
  const store = useSessionStore()

  const [events, setEvents] = useState<EventSummary[]>([])
  const [sessionTypes, setSessionTypes] = useState<SessionTypeInfo[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [sessionTypesLoading, setSessionTypesLoading] = useState(false)

  const loadEvents = useCallback(async (y: number) => {
    setEventsLoading(true)
    setEvents([])
    try {
      const data = await fetchSchedule(y)
      setEvents(data)
    } catch {
      setEvents([])
    } finally {
      setEventsLoading(false)
    }
  }, [])

  const loadSessionTypes = useCallback(async (y: number, ev: string) => {
    setSessionTypesLoading(true)
    setSessionTypes([])
    try {
      const data = await fetchSessionTypes(y, ev)
      setSessionTypes(data)
    } catch {
      setSessionTypes([])
    } finally {
      setSessionTypesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (year !== null) {
      void loadEvents(year)
    }
  }, [year, loadEvents])

  useEffect(() => {
    if (year !== null && event !== null) {
      void loadSessionTypes(year, event)
    } else {
      setSessionTypes([])
    }
  }, [year, event, loadSessionTypes])

  const handleYearChange = (y: number) => {
    setYear(y)
    setEvents([])
    setSessionTypes([])
  }

  const handleEventChange = (ev: string) => {
    setEvent(ev)
    setSessionTypes([])
  }

  const handleLoadSession = () => {
    if (year !== null && event !== null) {
      loadSession(year, event, sessionType, store)
    }
  }

  const isLoading = stage === 'loading'
  const canLoad =
    year !== null && event !== null && sessionType !== '' && !isLoading

  if (isCompact) {
    return (
      <div className="flex items-center gap-3 p-4 border rounded-lg bg-card">
        <span className="text-sm font-medium">
          {event} {year} — {sessionType}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => toggleCompact()}
        >
          Change
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-end gap-3 p-4 border rounded-lg bg-card">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground font-medium">
          Year
        </label>
        <YearSelect value={year} onChange={handleYearChange} disabled={isLoading} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground font-medium">
          Event
        </label>
        <EventSelect
          events={events}
          value={event}
          onChange={handleEventChange}
          disabled={isLoading || year === null}
          loading={eventsLoading}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground font-medium">
          Session Type
        </label>
        <SessionTypeSelect
          sessionTypes={sessionTypes}
          value={sessionType}
          onChange={setSessionType}
          disabled={isLoading || event === null}
          loading={sessionTypesLoading}
        />
      </div>
      <Button
        onClick={handleLoadSession}
        disabled={!canLoad}
        className="shrink-0"
      >
        {isLoading ? 'Loading...' : 'Load Session'}
      </Button>
    </div>
  )
}
