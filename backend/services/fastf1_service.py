"""FastF1 service: wraps FastF1 calls with async-safe thread offloading and serialization."""

import asyncio
import json
from collections.abc import AsyncIterable
from datetime import datetime, timezone
from typing import Any

import fastf1
import pandas as pd
from sse_starlette.sse import ServerSentEvent

from services.cache_service import is_session_cached


def get_completed_events(year: int) -> list[dict]:
    """Return list of completed F1 events for the given year.

    Filters to events where EventDate is in the past (data available).
    Calls blocking FastF1 API — must be wrapped in asyncio.to_thread at call site.
    """
    schedule = fastf1.get_event_schedule(year, include_testing=False)
    now = datetime.now(timezone.utc)

    # FastF1 EventDate may be tz-naive (datetime64[ns]) — normalize for comparison.
    # Use tz_localize if tz-naive, strip tzinfo if tz-aware, then compare as UTC.
    event_dates = schedule["EventDate"]
    if hasattr(event_dates.dtype, "tz") and event_dates.dtype.tz is not None:
        # Already tz-aware — convert to UTC naive for comparison
        now_naive = now.replace(tzinfo=None)
        event_dates_cmp = event_dates.dt.tz_convert("UTC").dt.tz_localize(None)
        past = schedule[event_dates_cmp < now_naive]
    else:
        # tz-naive — compare with naive datetime
        now_naive = now.replace(tzinfo=None)
        past = schedule[event_dates < now_naive]
    return [
        {
            "round": int(row["RoundNumber"]),
            "name": str(row["EventName"]),
            "country": str(row["Country"]),
        }
        for _, row in past.iterrows()
    ]


def get_session_types(year: int, event: str) -> list[dict]:
    """Return list of available session types for the given event.

    Inspects Session1-5 fields to find which session types are available.
    Calls blocking FastF1 API — must be wrapped in asyncio.to_thread at call site.
    """
    event_obj = fastf1.get_event(year, event)
    session_types = []
    for i in range(1, 6):
        session_field = f"Session{i}"
        if hasattr(event_obj, session_field):
            session_name = getattr(event_obj, session_field)
            if session_name and str(session_name) not in ("", "None", "nan"):
                session_types.append({
                    "key": str(session_name),
                    "name": str(session_name),
                })
    return session_types


def serialize_timedelta(td: Any) -> float | None:
    """Convert pd.Timedelta to total seconds (float). Returns None for NaT/None."""
    if td is None:
        return None
    try:
        if pd.isna(td):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(td, pd.Timedelta):
        return float(td.total_seconds())
    return None


def _time_to_lap(ts: pd.Timedelta, laps: pd.DataFrame) -> int:
    """Map a session timestamp to the lap number whose end time first exceeds ts.

    Falls back to max lap number if ts exceeds all lap end times.
    Returns 1 if laps is empty or all times are NaT.
    """
    if laps is None or laps.empty:
        return 1

    ts_seconds = serialize_timedelta(ts)
    if ts_seconds is None:
        return 1

    found_any_valid_time = False
    max_lap_seen: int | None = None

    for _, row in laps.iterrows():
        lap_time_seconds = serialize_timedelta(row.get("Time"))
        lap_number = row.get("LapNumber")
        if lap_number is not None:
            try:
                if not pd.isna(lap_number):
                    int_lap = int(lap_number)
                    if max_lap_seen is None or int_lap > max_lap_seen:
                        max_lap_seen = int_lap
            except (TypeError, ValueError):
                pass

        if lap_time_seconds is None:
            continue
        found_any_valid_time = True
        if lap_time_seconds > ts_seconds:
            if lap_number is None:
                continue
            try:
                if pd.isna(lap_number):
                    continue
            except (TypeError, ValueError):
                pass
            return int(lap_number)

    if not found_any_valid_time:
        # All times were NaT — spec says return 1
        return 1

    # Fallback: return max lap number
    if max_lap_seen is None:
        return 1
    return max_lap_seen


def parse_safety_car_periods(session: Any) -> list[dict]:
    """Parse FastF1 track_status DataFrame into lap-indexed safety car periods.

    Status codes:
      '4'     = Safety Car (SC)
      '6'/'7' = Virtual Safety Car (VSC)
      '5'     = Red Flag (single-lap period)
      '1'     = AllClear (closes current period)

    Returns a list of dicts with start_lap, end_lap, and type ('SC'|'VSC'|'RED').
    Returns [] when track_status is empty or None.
    """
    try:
        track_status = session.track_status
    except AttributeError:
        return []

    if track_status is None:
        return []

    try:
        if track_status.empty:
            return []
    except AttributeError:
        return []

    laps = session.laps
    periods: list[dict] = []
    current_start_lap: int | None = None
    current_type: str | None = None

    status_map = {
        "4": "SC",
        "6": "VSC",
        "7": "VSC",
        "5": "RED",
    }

    for _, row in track_status.iterrows():
        ts = row.get("Time")
        status = str(row.get("Status", ""))
        lap = _time_to_lap(ts, laps)

        if status in status_map:
            new_type = status_map[status]

            if status == "5":
                # Red flag: close any current period first, then add single-lap RED period
                if current_type is not None and current_start_lap is not None:
                    periods.append({
                        "start_lap": current_start_lap,
                        "end_lap": lap,
                        "type": current_type,
                    })
                    current_type = None
                    current_start_lap = None
                periods.append({
                    "start_lap": lap,
                    "end_lap": lap,
                    "type": "RED",
                })
            else:
                # SC or VSC
                if current_type is None:
                    # Start new period
                    current_type = new_type
                    current_start_lap = lap
                elif current_type != new_type:
                    # Type changed — close current and start new
                    periods.append({
                        "start_lap": current_start_lap,
                        "end_lap": lap,
                        "type": current_type,
                    })
                    current_type = new_type
                    current_start_lap = lap
                # Same type continuing — do nothing

        elif status == "1":
            # AllClear — close any current open period
            if current_type is not None and current_start_lap is not None:
                periods.append({
                    "start_lap": current_start_lap,
                    "end_lap": lap,
                    "type": current_type,
                })
                current_type = None
                current_start_lap = None

    # Close any unclosed period at end of data
    if current_type is not None and current_start_lap is not None:
        valid_laps = laps["LapNumber"].dropna()
        max_lap = int(valid_laps.max()) if not valid_laps.empty else current_start_lap
        periods.append({
            "start_lap": current_start_lap,
            "end_lap": max_lap,
            "type": current_type,
        })

    return periods


def serialize_laps(laps: pd.DataFrame) -> list[dict]:
    """Convert FastF1 Laps DataFrame to JSON-safe list of dicts.

    Converts all pandas/numpy types to Python primitives.
    Handles Timedelta, NaT, numpy.float64 edge cases.
    Includes Team and FullName from FastF1 session data.
    """
    result = []
    for _, row in laps.iterrows():
        lap_number = row.get("LapNumber")
        position = row.get("Position")
        tyre_life = row.get("TyreLife")
        stint = row.get("Stint")
        compound = row.get("Compound")
        team = row.get("Team")
        full_name = row.get("DriverNumber")  # We'll get full name from results

        result.append({
            "LapNumber": int(lap_number) if lap_number is not None and not pd.isna(lap_number) else None,
            "Driver": str(row["Driver"]),
            "Team": str(team) if team is not None and pd.notna(team) else None,
            "LapTime": serialize_timedelta(row.get("LapTime")),
            "Time": serialize_timedelta(row.get("Time")),
            "PitInTime": serialize_timedelta(row.get("PitInTime")),
            "PitOutTime": serialize_timedelta(row.get("PitOutTime")),
            "Compound": str(compound) if compound is not None and pd.notna(compound) else None,
            "TyreLife": float(tyre_life) if tyre_life is not None and pd.notna(tyre_life) else None,
            "Position": int(position) if position is not None and pd.notna(position) else None,
            "Stint": int(stint) if stint is not None and pd.notna(stint) else None,
        })
    return result


def serialize_drivers(session: Any) -> list[dict]:
    """Extract driver info from a FastF1 session's results.

    Returns abbreviation, full name, team name, and team color for each driver.
    """
    drivers = []
    try:
        results = session.results
        if results is None or results.empty:
            return drivers
        for _, row in results.iterrows():
            abbr = row.get("Abbreviation")
            if abbr is None or pd.isna(abbr):
                continue
            full_name = row.get("FullName", "")
            team = row.get("TeamName", "")
            team_color = row.get("TeamColor", "")
            drivers.append({
                "abbreviation": str(abbr),
                "fullName": str(full_name) if full_name and pd.notna(full_name) else str(abbr),
                "team": str(team) if team and pd.notna(team) else "Unknown",
                "teamColor": f"#{team_color}" if team_color and pd.notna(team_color) else "#888888",
            })
    except Exception:
        pass
    return drivers


async def load_session_stream(
    year: int, event: str, session_type: str, app: Any
) -> AsyncIterable[ServerSentEvent]:
    """Async generator that streams SSE progress events while loading a session.

    Uses asyncio.to_thread for all blocking FastF1 calls.
    Uses per-session asyncio.Lock to prevent concurrent duplicate loads.
    Yields progress events at named stages, then a complete event with lap data.
    """
    session_key = f"{year}_{event}_{session_type}"

    # Ensure a lock exists for this session key
    if session_key not in app.state.session_locks:
        app.state.session_locks[session_key] = asyncio.Lock()

    lock = app.state.session_locks[session_key]

    # If lock is already held, yield a waiting event before blocking
    if lock.locked():
        yield ServerSentEvent(
            data=json.dumps({"pct": 0, "stage": "Waiting for concurrent load..."}),
            event="progress",
        )

    async with lock:
        def _make_progress(stage: str, pct: int) -> ServerSentEvent:
            return ServerSentEvent(
                data=json.dumps({"pct": pct, "stage": stage}),
                event="progress",
            )

        yield _make_progress("Connecting to F1 data...", 5)

        session = await asyncio.to_thread(
            fastf1.get_session, year, event, session_type
        )

        yield _make_progress("Fetching session info...", 20)

        await asyncio.to_thread(
            session.load,
            laps=True,
            telemetry=False,
            weather=False,
            messages=False,
        )

        yield _make_progress("Loading lap data...", 50)

        yield _make_progress("Processing...", 80)

        laps_data = serialize_laps(session.laps)
        drivers_data = serialize_drivers(session)
        safety_car_data = parse_safety_car_periods(session)

        yield ServerSentEvent(
            data=json.dumps({
                "laps": laps_data,
                "drivers": drivers_data,
                "safetyCarPeriods": safety_car_data,
            }),
            event="complete",
        )
