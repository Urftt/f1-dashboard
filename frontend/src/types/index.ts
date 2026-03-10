/** API response types matching the FastAPI Pydantic models. */

export interface SeasonInfo {
  year: number;
}

export interface EventInfo {
  round_number: number;
  country: string;
  location: string;
  event_name: string;
  event_date: string;
  event_format: string;
}

export interface SessionTypeInfo {
  session_key: string;
  session_name: string;
  session_date: string | null;
}

export interface LoadSessionRequest {
  year: number;
  grand_prix: string | number;
  session_type: string;
}

export interface LoadSessionResponse {
  status: string;
  session_key: string;
  year: number;
  event_name: string;
  session_type: string;
  num_drivers: number;
  total_laps: number | null;
}

export interface SessionSelection {
  year: number | null;
  grandPrix: string | null;
  sessionType: string | null;
}

/** Progress event from the SSE session-loading endpoint. */
export interface LoadProgressEvent {
  load_id: string;
  percentage: number;
  status: 'loading' | 'complete' | 'error';
  detail: string;
}

export interface DriverInfo {
  abbreviation: string;
  driver_number: string;
  full_name: string;
  team_name: string;
  team_color: string;
}

export interface LapDataEntry {
  driver: string;
  lap_number: number;
  lap_time_ms: number | null;
  position: number | null;
  sector1_ms: number | null;
  sector2_ms: number | null;
  sector3_ms: number | null;
  compound: string | null;
  tyre_life: number | null;
  is_pit_out_lap: boolean;
  is_pit_in_lap: boolean;
  elapsed_ms: number | null;
}

export interface SessionLapData {
  session_key: string;
  year: number;
  event_name: string;
  session_type: string;
  total_laps: number;
  drivers: DriverInfo[];
  laps: LapDataEntry[];
}

/** A single row in the standings board. */
export interface StandingsEntry {
  position: number;
  driver: string;
  driverNumber: string;
  team: string;
  teamColor: string;
  gapToLeader: string;
  interval: string;
  lastLapTime: string;
  tireCompound: string;
  tireAge: number;
  pitStops: number;
  hasFastestLap: boolean;
}

export interface LapDurationEntry {
  lap_number: number;
  duration_seconds: number;
}

export interface LapDurationsResponse {
  session_key: string;
  year: number;
  event_name: string;
  session_type: string;
  total_laps: number;
  lap_durations: LapDurationEntry[];
}

/** Gap chart types for two-driver comparison. */

export interface GapChartPoint {
  lap_number: number;
  gap_seconds: number;  // positive = driver1 ahead
  driver1_position: number;
  driver2_position: number;
  driver1_lap_time_s: number | null;
  driver2_lap_time_s: number | null;
  gap_change: number | null;
  is_pit_lap_d1: boolean;
  is_pit_lap_d2: boolean;
}

export interface GapChartData {
  session_key: string;
  driver1: string;
  driver2: string;
  driver1_color: string;
  driver2_color: string;
  driver1_name: string;
  driver2_name: string;
  total_laps: number;
  points: GapChartPoint[];
}

/** Server-side standings entry (snake_case from API). */
export interface ServerStandingsEntry {
  position: number;
  driver: string;
  driver_number: string;
  full_name: string;
  team: string;
  team_color: string;
  gap_to_leader: string;
  interval: string;
  last_lap_time: string;
  tire_compound: string;
  tire_age: number;
  pit_stops: number;
  has_fastest_lap: boolean;
}

/** Server-side standings board response. */
export interface StandingsBoardResponse {
  session_key: string;
  year: number;
  event_name: string;
  session_type: string;
  lap_number: number;
  total_laps: number;
  standings: ServerStandingsEntry[];
}

/** Combined re-sync data returned to the dashboard after a jump-to-lap. */
export interface ResyncData {
  lap: number;
  standings: StandingsBoardResponse | null;
  gapChart: GapChartData | null;
}

/**
 * Note: ReplayState is defined and exported from hooks/useReplayTimer.ts.
 * Import it from there rather than duplicating here.
 */
