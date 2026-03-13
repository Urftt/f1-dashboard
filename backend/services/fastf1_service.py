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


def serialize_laps(laps: pd.DataFrame) -> list[dict]:
    """Convert FastF1 Laps DataFrame to JSON-safe list of dicts.

    Converts all pandas/numpy types to Python primitives.
    Handles Timedelta, NaT, numpy.float64 edge cases.
    """
    result = []
    for _, row in laps.iterrows():
        lap_number = row.get("LapNumber")
        position = row.get("Position")
        tyre_life = row.get("TyreLife")
        stint = row.get("Stint")
        compound = row.get("Compound")

        result.append({
            "LapNumber": int(lap_number) if lap_number is not None and not pd.isna(lap_number) else None,
            "Driver": str(row["Driver"]),
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

        yield ServerSentEvent(
            data=json.dumps({"laps": laps_data}),
            event="complete",
        )
