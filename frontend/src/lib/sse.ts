import { fetchEventSource } from '@microsoft/fetch-event-source'
import type { SessionStore } from '@/stores/sessionStore'

export function loadSession(
  year: number,
  event: string,
  sessionType: string,
  store: SessionStore
): void {
  const url = `/api/sessions/load?year=${year}&event=${encodeURIComponent(event)}&session_type=${encodeURIComponent(sessionType)}`

  store.setProgress(0, 'Connecting...')

  fetchEventSource(url, {
    openWhenHidden: true,

    onmessage(ev) {
      if (ev.event === 'progress') {
        const data = JSON.parse(ev.data) as { pct: number; stage: string }
        store.setProgress(data.pct, data.stage)
      } else if (ev.event === 'complete') {
        const data = JSON.parse(ev.data) as { laps: Parameters<SessionStore['setLaps']>[0] }
        store.setLaps(data.laps)
      } else if (ev.event === 'error') {
        const data = JSON.parse(ev.data) as { message: string }
        store.setError(data.message)
      }
    },

    onerror(err) {
      store.setError(
        err instanceof Error ? err.message : 'Network error — failed to load session'
      )
      // Prevent automatic retry by rethrowing
      throw err
    },
  }).catch(() => {
    // Already handled via onerror; suppress unhandled promise rejection
  })
}
