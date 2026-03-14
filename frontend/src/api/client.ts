/**
 * API client for the F1 Dashboard backend.
 *
 * All fetch calls target the FastAPI server at localhost:8000.
 */

import type {
  SeasonInfo,
  EventInfo,
  SessionTypeInfo,
  LoadSessionRequest,
  LoadSessionResponse,
  LoadProgressEvent,
  SessionLapData,
  LapDurationsResponse,
  GapChartData,
  StandingsBoardResponse,
} from '../types';
import type { SectorRow } from '../types/session';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`API error ${response.status}: ${detail}`);
  }
  return response.json();
}

/** Fetch available seasons (years). */
export async function fetchSeasons(): Promise<SeasonInfo[]> {
  return fetchJson<SeasonInfo[]>('/api/seasons');
}

/** Fetch grand prix events for a given year. */
export async function fetchEvents(year: number): Promise<EventInfo[]> {
  return fetchJson<EventInfo[]>(`/api/seasons/${year}/events`);
}

/** Fetch session types for a given year + grand prix. */
export async function fetchSessions(year: number, grandPrix: string): Promise<SessionTypeInfo[]> {
  return fetchJson<SessionTypeInfo[]>(
    `/api/seasons/${year}/events/${encodeURIComponent(grandPrix)}/sessions`
  );
}

/** Load a session's data via FastF1 (triggers backend caching). */
export async function loadSession(req: LoadSessionRequest): Promise<LoadSessionResponse> {
  return fetchJson<LoadSessionResponse>('/api/sessions/load', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

/** Fetch structured lap data for a previously loaded session. */
export async function fetchSessionLapData(sessionKey: string): Promise<SessionLapData> {
  return fetchJson<SessionLapData>(`/api/sessions/${encodeURIComponent(sessionKey)}/lap-data`);
}

/** Fetch lap duration data for replay timing (real historical seconds per lap). */
export async function fetchLapDurations(sessionKey: string): Promise<LapDurationsResponse> {
  return fetchJson<LapDurationsResponse>(`/api/sessions/${encodeURIComponent(sessionKey)}/lap-durations`);
}

/** Fetch gap chart data for two drivers in a loaded session. */
export async function fetchGapChart(
  sessionKey: string,
  driver1: string,
  driver2: string,
  maxLap?: number,
): Promise<GapChartData> {
  const params = new URLSearchParams({ driver1, driver2 });
  if (maxLap !== undefined) {
    params.set('max_lap', String(maxLap));
  }
  return fetchJson<GapChartData>(
    `/api/sessions/${encodeURIComponent(sessionKey)}/gap-chart?${params}`
  );
}

/** Fetch server-side standings at a specific lap (for re-sync on jump-to-lap). */
export async function fetchStandings(
  sessionKey: string,
  lap: number,
): Promise<StandingsBoardResponse> {
  return fetchJson<StandingsBoardResponse>(
    `/api/sessions/${encodeURIComponent(sessionKey)}/standings?lap=${lap}`
  );
}

/** Fetch per-driver per-lap sector times (lazy load for heatmap). */
export async function fetchSectors(
  year: number,
  event: string,
  sessionType: string
): Promise<SectorRow[]> {
  const params = new URLSearchParams({
    year: String(year),
    event,
    session_type: sessionType,
  });
  return fetchJson<{ sectors: SectorRow[] }>(`/api/sessions/sectors?${params}`)
    .then((data) => data.sectors);
}

/**
 * Load a session via SSE, receiving real-time progress updates.
 *
 * @param req - Session parameters (year, grand_prix, session_type)
 * @param onProgress - Called for each progress event (percentage, status, detail)
 * @param abortSignal - Optional AbortSignal to cancel the loading
 * @returns Promise that resolves with the final LoadSessionResponse on completion
 */
export function loadSessionWithProgress(
  req: LoadSessionRequest,
  onProgress: (event: LoadProgressEvent) => void,
  abortSignal?: AbortSignal,
): Promise<LoadSessionResponse> {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      year: String(req.year),
      grand_prix: String(req.grand_prix),
      session_type: req.session_type,
    });

    const url = `${API_BASE}/api/sessions/load/stream?${params}`;

    // Use the Fetch API to consume SSE manually so we can support AbortSignal
    fetch(url, { signal: abortSignal })
      .then(async (response) => {
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(`API error ${response.status}: ${detail}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No readable stream in response');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE lines: each event is "data: {...}\n\n"
          const lines = buffer.split('\n');
          buffer = '';

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Check for incomplete line (no trailing newline) - keep in buffer
            if (i === lines.length - 1 && line !== '') {
              buffer = line;
              continue;
            }

            // Skip empty lines and keepalive comments
            if (!line || line.startsWith(':')) continue;

            if (line.startsWith('data: ')) {
              try {
                const event: LoadProgressEvent = JSON.parse(line.slice(6));
                onProgress(event);

                if (event.status === 'complete') {
                  const result: LoadSessionResponse = JSON.parse(event.detail);
                  reader.cancel();
                  resolve(result);
                  return;
                }

                if (event.status === 'error') {
                  reader.cancel();
                  reject(new Error(event.detail));
                  return;
                }
              } catch (parseErr) {
                // Ignore unparseable lines (keepalive comments, etc.)
              }
            }
          }
        }

        // Stream ended without a terminal event
        reject(new Error('SSE stream ended unexpectedly'));
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          reject(new Error('Session loading was cancelled'));
        } else {
          reject(err);
        }
      });
  });
}
