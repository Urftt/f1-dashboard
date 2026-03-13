import type { EventSummary, SessionTypeInfo } from '@/types/session'

export async function fetchSchedule(year: number): Promise<EventSummary[]> {
  const res = await fetch(`/api/schedule/${year}`)
  if (!res.ok) {
    throw new Error(
      `Failed to fetch schedule for ${year}: ${res.status} ${res.statusText}`
    )
  }
  return res.json() as Promise<EventSummary[]>
}

export async function fetchSessionTypes(
  year: number,
  event: string
): Promise<SessionTypeInfo[]> {
  const res = await fetch(
    `/api/schedule/${year}/${encodeURIComponent(event)}/session-types`
  )
  if (!res.ok) {
    throw new Error(
      `Failed to fetch session types for ${year} ${event}: ${res.status} ${res.statusText}`
    )
  }
  return res.json() as Promise<SessionTypeInfo[]>
}
