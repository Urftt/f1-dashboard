"""
REST API endpoints for F1 Dashboard.

Provides endpoints for listing available seasons, grand prix events,
session types, and triggering session data loading via FastF1.
Cascading data dependencies: year → events → sessions → load.

Includes SSE (Server-Sent Events) endpoint for real-time progress
reporting during session data loading.
"""

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import AsyncGenerator, Optional

import fastf1
import pandas as pd
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import BASE_DIR

logger = logging.getLogger(__name__)

# FastF1 cache directory
CACHE_DIR = BASE_DIR / "fastf1_cache"
CACHE_DIR.mkdir(exist_ok=True)
fastf1.Cache.enable_cache(str(CACHE_DIR))

# Supported year range for FastF1 data
FASTF1_MIN_YEAR = 2018
FASTF1_MAX_YEAR = datetime.now().year

app = FastAPI(
    title="F1 Dashboard API",
    description="REST API for F1 race data — seasons, events, sessions, and data loading",
    version="0.2.0",
)

# Enable CORS for the React frontend (dev on localhost:3000/5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for the currently loaded session data
_loaded_sessions: dict[str, object] = {}

# In-memory progress tracking for SSE-based session loading
# Maps load_id → list of progress event dicts
_load_progress: dict[str, list[dict]] = {}
_load_events: dict[str, asyncio.Event] = {}  # signaled when new progress arrives


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class SeasonInfo(BaseModel):
    year: int


class EventInfo(BaseModel):
    round_number: int
    country: str
    location: str
    event_name: str
    event_date: str
    event_format: str


class SessionTypeInfo(BaseModel):
    session_key: str  # e.g. "Race", "Qualifying", "FP1"
    session_name: str
    session_date: Optional[str] = None


class LoadSessionRequest(BaseModel):
    year: int
    grand_prix: str | int  # event name or round number
    session_type: str  # e.g. "Race", "Qualifying", "FP1"


class LoadSessionResponse(BaseModel):
    status: str
    session_key: str
    year: int
    event_name: str
    session_type: str
    num_drivers: int
    total_laps: Optional[int] = None


class HealthResponse(BaseModel):
    status: str


class DriverInfoResponse(BaseModel):
    abbreviation: str
    driver_number: str
    full_name: str
    team_name: str
    team_color: str  # hex color without '#'


class LapDataEntry(BaseModel):
    driver: str
    lap_number: int
    lap_time_ms: Optional[float] = None  # lap time in milliseconds
    position: Optional[int] = None
    sector1_ms: Optional[float] = None
    sector2_ms: Optional[float] = None
    sector3_ms: Optional[float] = None
    compound: Optional[str] = None
    tyre_life: Optional[int] = None
    is_pit_out_lap: bool = False
    is_pit_in_lap: bool = False
    elapsed_ms: Optional[float] = None  # session elapsed time at line crossing


class SessionLapDataResponse(BaseModel):
    session_key: str
    year: int
    event_name: str
    session_type: str
    total_laps: int
    drivers: list[DriverInfoResponse]
    laps: list[LapDataEntry]


class LapDurationEntry(BaseModel):
    lap_number: int
    duration_seconds: float  # real historical duration for this lap


class LapDurationsResponse(BaseModel):
    session_key: str
    year: int
    event_name: str
    session_type: str
    total_laps: int
    lap_durations: list[LapDurationEntry]


class StandingsEntry(BaseModel):
    """A single row on the F1 TV-style standings board."""
    position: int
    driver: str  # 3-letter abbreviation
    driver_number: str
    full_name: str
    team: str
    team_color: str  # hex without '#'
    gap_to_leader: str  # "LEADER" or "+X.XXXs"
    interval: str  # gap to car ahead, "" for leader
    last_lap_time: str  # "M:SS.mmm" or ""
    tire_compound: str  # "SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET", or ""
    tire_age: int  # stint length in laps
    pit_stops: int
    has_fastest_lap: bool


class StandingsBoardResponse(BaseModel):
    """Full standings board for a given lap."""
    session_key: str
    year: int
    event_name: str
    session_type: str
    lap_number: int
    total_laps: int
    standings: list[StandingsEntry]


class ReplayStartRequest(BaseModel):
    session_key: str


class ReplayStatusResponse(BaseModel):
    session_key: str
    status: str  # "active", "paused", "stopped", "completed"
    current_lap: int
    total_laps: int
    start_timestamp: float  # Unix epoch seconds when replay started
    elapsed_seconds: float  # seconds since replay started
    year: int
    event_name: str
    session_type: str


class ReplayJumpResponse(BaseModel):
    """Response returned when jumping to a specific lap in the replay."""
    session_key: str
    current_lap: int
    total_laps: int
    elapsed_seconds: float  # cumulative elapsed time from lights-out to end of current_lap
    status: str  # "active", "completed"
    year: int
    event_name: str
    session_type: str
    standings: list[StandingsEntry]


# ---------------------------------------------------------------------------
# In-memory replay state
# ---------------------------------------------------------------------------

class _ReplayState:
    """Tracks the state of a single replay."""
    __slots__ = ("session_key", "current_lap", "total_laps", "start_timestamp",
                 "status", "year", "event_name", "session_type")

    def __init__(
        self,
        session_key: str,
        total_laps: int,
        year: int,
        event_name: str,
        session_type: str,
    ):
        self.session_key = session_key
        self.current_lap = 1
        self.total_laps = total_laps
        self.start_timestamp = time.time()
        self.status = "active"
        self.year = year
        self.event_name = event_name
        self.session_type = session_type

    def to_response(self) -> ReplayStatusResponse:
        return ReplayStatusResponse(
            session_key=self.session_key,
            status=self.status,
            current_lap=self.current_lap,
            total_laps=self.total_laps,
            start_timestamp=self.start_timestamp,
            elapsed_seconds=round(time.time() - self.start_timestamp, 3),
            year=self.year,
            event_name=self.event_name,
            session_type=self.session_type,
        )


# Keyed by session_key — only one replay per session at a time
_replay_states: dict[str, _ReplayState] = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_event_schedule(year: int) -> fastf1.events.EventSchedule:
    """Fetch the event schedule for a given year, raising 404 on failure."""
    try:
        schedule = fastf1.get_event_schedule(year)
    except Exception as exc:
        logger.error("Failed to fetch event schedule for %d: %s", year, exc)
        raise HTTPException(status_code=404, detail=f"No schedule found for {year}") from exc

    if schedule is None or schedule.empty:
        raise HTTPException(status_code=404, detail=f"No events found for {year}")
    return schedule


def _session_key(year: int, gp: str | int, session_type: str) -> str:
    """Build a deterministic cache key for a loaded session."""
    return f"{year}::{gp}::{session_type}"


# Mapping of FastF1 session identifier columns
_SESSION_COLS = [
    ("Session1", "Session1Date"),
    ("Session2", "Session2Date"),
    ("Session3", "Session3Date"),
    ("Session4", "Session4Date"),
    ("Session5", "Session5Date"),
]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Simple health-check."""
    return HealthResponse(status="ok")


@app.get("/api/seasons", response_model=list[SeasonInfo])
async def list_seasons():
    """
    Return a list of seasons for which FastF1 can provide data.

    FastF1 supports seasons from 2018 onwards, listed newest-first.
    """
    seasons = [SeasonInfo(year=y) for y in range(FASTF1_MAX_YEAR, FASTF1_MIN_YEAR - 1, -1)]
    return seasons


@app.get("/api/seasons/{year}/events", response_model=list[EventInfo])
async def list_events(year: int):
    """
    List all grand-prix events for a given season year.
    """
    schedule = _get_event_schedule(year)

    events: list[EventInfo] = []
    for _, row in schedule.iterrows():
        # Skip testing events
        if "testing" in str(row.get("EventName", "")).lower():
            continue
        event_date = ""
        if pd.notna(row.get("EventDate")):
            event_date = str(row["EventDate"])[:10]
        events.append(
            EventInfo(
                round_number=int(row.get("RoundNumber", 0)),
                country=str(row.get("Country", "")),
                location=str(row.get("Location", "")),
                event_name=str(row.get("EventName", "")),
                event_date=event_date,
                event_format=str(row.get("EventFormat", "conventional")),
            )
        )
    return events


@app.get("/api/seasons/{year}/events/{grand_prix}/sessions", response_model=list[SessionTypeInfo])
async def list_sessions(year: int, grand_prix: str):
    """
    List available session types for a specific event.

    ``grand_prix`` can be an event name (e.g. "Bahrain") or round number.
    """
    try:
        gp_identifier: int | str = int(grand_prix)
    except ValueError:
        gp_identifier = grand_prix

    try:
        event = fastf1.get_event(year, gp_identifier)
    except Exception as exc:
        logger.error("Failed to get event %s/%s: %s", year, grand_prix, exc)
        raise HTTPException(
            status_code=404,
            detail=f"Event '{grand_prix}' not found for {year}",
        ) from exc

    sessions: list[SessionTypeInfo] = []
    for col_name, col_date in _SESSION_COLS:
        session_name = event.get(col_name)
        if pd.isna(session_name) or not session_name:
            continue
        session_date = None
        raw_date = event.get(col_date)
        if pd.notna(raw_date):
            session_date = str(raw_date)[:19]
        sessions.append(
            SessionTypeInfo(
                session_key=str(session_name),
                session_name=str(session_name),
                session_date=session_date,
            )
        )
    return sessions


@app.post("/api/sessions/load", response_model=LoadSessionResponse)
async def load_session(req: LoadSessionRequest):
    """
    Trigger loading of session data via FastF1.

    This fetches and caches the session telemetry / lap data so that
    subsequent replay and analysis endpoints can use it quickly.
    """
    try:
        gp_identifier: int | str
        try:
            gp_identifier = int(req.grand_prix)
        except (ValueError, TypeError):
            gp_identifier = req.grand_prix

        session = fastf1.get_session(req.year, gp_identifier, req.session_type)
        session.load()
    except Exception as exc:
        logger.error(
            "Failed to load session %s/%s/%s: %s",
            req.year, req.grand_prix, req.session_type, exc,
        )
        raise HTTPException(
            status_code=422,
            detail=f"Could not load session: {exc}",
        ) from exc

    key = _session_key(req.year, req.grand_prix, req.session_type)
    _loaded_sessions[key] = session

    # Gather summary info
    num_drivers = len(session.drivers) if session.drivers else 0
    total_laps = int(session.total_laps) if hasattr(session, "total_laps") and session.total_laps else None
    event_name = str(session.event["EventName"]) if session.event is not None else str(req.grand_prix)

    return LoadSessionResponse(
        status="loaded",
        session_key=key,
        year=req.year,
        event_name=event_name,
        session_type=req.session_type,
        num_drivers=num_drivers,
        total_laps=total_laps,
    )


# ---------------------------------------------------------------------------
# SSE Progress Reporting for Session Loading
# ---------------------------------------------------------------------------


def _emit_progress(load_id: str, percentage: int, status: str, detail: str = "") -> None:
    """Push a progress event into the tracking store for a given load_id.

    Thread-safe: can be called from the background thread that runs
    ``_load_session_with_progress``.  The asyncio.Event is set via
    ``call_soon_threadsafe`` so the SSE generator wakes up correctly.
    """
    event = {
        "load_id": load_id,
        "percentage": percentage,
        "status": status,
        "detail": detail,
    }
    if load_id not in _load_progress:
        _load_progress[load_id] = []
    _load_progress[load_id].append(event)
    # Signal any waiting SSE consumers (thread-safe)
    if load_id in _load_events:
        evt = _load_events[load_id]
        try:
            loop = asyncio.get_running_loop()
            loop.call_soon_threadsafe(evt.set)
        except RuntimeError:
            # No running loop (e.g. during tests) — set directly
            evt.set()


def _load_session_with_progress(
    load_id: str,
    year: int,
    grand_prix: str | int,
    session_type: str,
) -> None:
    """Synchronous session loading with progress emissions.

    Designed to run in a background thread via asyncio.to_thread().
    Emits percentage/status updates at each significant stage.
    """
    try:
        # Stage 1: Resolving session (0-10%)
        _emit_progress(load_id, 0, "loading", "Resolving session...")

        gp_identifier: int | str
        try:
            gp_identifier = int(grand_prix)
        except (ValueError, TypeError):
            gp_identifier = grand_prix

        _emit_progress(load_id, 5, "loading", f"Fetching {year} {grand_prix} {session_type}...")
        session = fastf1.get_session(year, gp_identifier, session_type)
        _emit_progress(load_id, 10, "loading", "Session resolved, starting data download...")

        # Stage 2: Loading session data (10-85%)
        # FastF1's session.load() is a single blocking call; we report
        # intermediate milestones based on what we're requesting.
        _emit_progress(load_id, 15, "loading", "Downloading lap data...")

        session.load(
            laps=True,
            telemetry=False,
            weather=False,
            messages=False,
        )

        _emit_progress(load_id, 85, "loading", "Data downloaded, processing...")

        # Stage 3: Store session and build summary (85-100%)
        key = _session_key(year, grand_prix, session_type)
        _loaded_sessions[key] = session

        num_drivers = len(session.drivers) if session.drivers else 0
        total_laps = (
            int(session.total_laps)
            if hasattr(session, "total_laps") and session.total_laps
            else None
        )
        event_name = (
            str(session.event["EventName"])
            if session.event is not None
            else str(grand_prix)
        )

        _emit_progress(load_id, 95, "loading", f"Loaded {num_drivers} drivers...")

        # Final "complete" event carries the full response payload
        _emit_progress(load_id, 100, "complete", json.dumps({
            "status": "loaded",
            "session_key": key,
            "year": year,
            "event_name": event_name,
            "session_type": session_type,
            "num_drivers": num_drivers,
            "total_laps": total_laps,
        }))

    except Exception as exc:
        logger.error(
            "SSE load failed %s/%s/%s: %s", year, grand_prix, session_type, exc,
        )
        _emit_progress(load_id, -1, "error", str(exc))


async def _sse_generator(load_id: str, request: Request) -> AsyncGenerator[str, None]:
    """Yield SSE-formatted events for a given load_id until completion or error."""
    cursor = 0

    while True:
        # Check if client disconnected
        if await request.is_disconnected():
            break

        events = _load_progress.get(load_id, [])
        while cursor < len(events):
            evt = events[cursor]
            cursor += 1
            data = json.dumps(evt)
            yield f"data: {data}\n\n"

            # Terminal states: stop streaming
            if evt["status"] in ("complete", "error"):
                # Clean up tracking data after a short delay
                _load_progress.pop(load_id, None)
                _load_events.pop(load_id, None)
                return

        # Wait for new events (with timeout to check for disconnection)
        if load_id in _load_events:
            _load_events[load_id].clear()
            try:
                await asyncio.wait_for(_load_events[load_id].wait(), timeout=1.0)
            except asyncio.TimeoutError:
                # Send a keep-alive comment to prevent connection timeout
                yield ": keepalive\n\n"


@app.get("/api/sessions/load/stream")
async def load_session_stream(
    request: Request,
    year: int = Query(..., description="Season year"),
    grand_prix: str = Query(..., description="Grand Prix name or round number"),
    session_type: str = Query(..., description="Session type (e.g. Race, Qualifying)"),
):
    """
    SSE endpoint for loading a session with real-time progress updates.

    Streams JSON events with fields: load_id, percentage (0-100), status, detail.

    Status values:
    - "loading": In progress; percentage indicates completion (0-100).
    - "complete": Finished successfully; detail contains the LoadSessionResponse JSON.
    - "error": Failed; detail contains the error message.

    Example event::

        data: {"load_id": "abc123", "percentage": 15, "status": "loading", "detail": "Downloading lap data..."}

    The final event will have status="complete" with the full session info in detail.
    """
    load_id = str(uuid.uuid4())

    # Initialize progress tracking
    _load_progress[load_id] = []
    _load_events[load_id] = asyncio.Event()

    # Kick off the blocking FastF1 load in a background thread
    asyncio.get_running_loop().run_in_executor(
        None,
        _load_session_with_progress,
        load_id,
        year,
        grand_prix,
        session_type,
    )

    return StreamingResponse(
        _sse_generator(load_id, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/sessions/{session_key:path}/lap-data", response_model=SessionLapDataResponse)
async def get_session_lap_data(session_key: str):
    """
    Return structured lap data for a previously loaded session.

    Includes per-lap timing, positions, tyre info, and pit-stop flags
    for every driver, plus driver metadata (name, team, colors).

    The session must first be loaded via ``POST /api/sessions/load``.
    """
    session = _loaded_sessions.get(session_key)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Session not loaded. Call POST /api/sessions/load first.",
        )

    # --- Build driver info list -------------------------------------------
    drivers: list[DriverInfoResponse] = []
    for drv_num in session.drivers:
        info = session.get_driver(drv_num)
        drivers.append(
            DriverInfoResponse(
                abbreviation=str(info.get("Abbreviation", "")),
                driver_number=str(drv_num),
                full_name=f"{info.get('FirstName', '')} {info.get('LastName', '')}".strip(),
                team_name=str(info.get("TeamName", "")),
                team_color=str(info.get("TeamColor", "FFFFFF")),
            )
        )

    # --- Build lap data entries -------------------------------------------
    laps_list: list[LapDataEntry] = []
    laps_df = session.laps

    if laps_df is not None and not laps_df.empty:
        for _, row in laps_df.iterrows():
            driver = str(row.get("Driver", ""))
            lap_number = int(row.get("LapNumber", 0))

            # Lap time in milliseconds
            lap_time_ms: Optional[float] = None
            lt = row.get("LapTime")
            if pd.notna(lt):
                lap_time_ms = lt.total_seconds() * 1000.0

            # Position
            position: Optional[int] = None
            pos = row.get("Position")
            if pd.notna(pos):
                position = int(pos)

            # Sector times in milliseconds
            sector1_ms: Optional[float] = None
            sector2_ms: Optional[float] = None
            sector3_ms: Optional[float] = None
            for attr, col in [("sector1_ms", "Sector1Time"), ("sector2_ms", "Sector2Time"), ("sector3_ms", "Sector3Time")]:
                val = row.get(col)
                if pd.notna(val):
                    if attr == "sector1_ms":
                        sector1_ms = val.total_seconds() * 1000.0
                    elif attr == "sector2_ms":
                        sector2_ms = val.total_seconds() * 1000.0
                    else:
                        sector3_ms = val.total_seconds() * 1000.0

            # Tyre info
            compound: Optional[str] = None
            comp_val = row.get("Compound")
            if pd.notna(comp_val):
                compound = str(comp_val)

            tyre_life: Optional[int] = None
            tl = row.get("TyreLife")
            if pd.notna(tl):
                tyre_life = int(tl)

            # Pit stop flags
            is_pit_out_lap = pd.notna(row.get("PitOutTime"))
            is_pit_in_lap = pd.notna(row.get("PitInTime"))

            # Session elapsed time at line crossing
            elapsed_ms: Optional[float] = None
            time_val = row.get("Time")
            if pd.notna(time_val):
                elapsed_ms = time_val.total_seconds() * 1000.0

            laps_list.append(
                LapDataEntry(
                    driver=driver,
                    lap_number=lap_number,
                    lap_time_ms=lap_time_ms,
                    position=position,
                    sector1_ms=sector1_ms,
                    sector2_ms=sector2_ms,
                    sector3_ms=sector3_ms,
                    compound=compound,
                    tyre_life=tyre_life,
                    is_pit_out_lap=is_pit_out_lap,
                    is_pit_in_lap=is_pit_in_lap,
                    elapsed_ms=elapsed_ms,
                )
            )

    # --- Total laps -------------------------------------------------------
    total_laps = (
        int(session.total_laps)
        if hasattr(session, "total_laps") and session.total_laps
        else 0
    )
    if total_laps == 0 and laps_list:
        total_laps = max(lap.lap_number for lap in laps_list)

    event_name = (
        str(session.event["EventName"])
        if session.event is not None
        else session_key.split("::")[1]
    )

    # Parse session_type from the key
    parts = session_key.split("::")
    session_type = parts[2] if len(parts) >= 3 else ""
    year = int(parts[0]) if parts[0].isdigit() else 0

    return SessionLapDataResponse(
        session_key=session_key,
        year=year,
        event_name=event_name,
        session_type=session_type,
        total_laps=total_laps,
        drivers=drivers,
        laps=laps_list,
    )


@app.get("/api/sessions/{session_key:path}/lap-durations", response_model=LapDurationsResponse)
async def get_lap_durations(session_key: str):
    """
    Return the real historical lap duration (in seconds) for each lap in a session.

    For each lap number the duration is computed as the time elapsed between
    the leader crossing the start/finish line on the previous lap and the
    current lap.  Specifically, we take the **minimum** ``Time`` (session-
    elapsed time at the finish line) across all drivers for each lap, then
    compute successive differences.  Lap 1's duration is simply the minimum
    elapsed time recorded at the end of lap 1 (i.e. from lights-out to the
    first crossing).

    This powers the replay timer: the frontend waits ``duration_seconds``
    real seconds before revealing the next lap's data.

    The session must first be loaded via ``POST /api/sessions/load``.
    """
    session = _loaded_sessions.get(session_key)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Session not loaded. Call POST /api/sessions/load first.",
        )

    laps_df = session.laps

    if laps_df is None or laps_df.empty:
        # No laps → return empty durations
        total_laps = 0
        lap_durations: list[LapDurationEntry] = []
    else:
        # For each lap number, find the earliest finish-line crossing time
        # across all drivers (i.e. the leader's crossing time).
        valid = laps_df.dropna(subset=["Time", "LapNumber"]).copy()
        valid["LapNumber"] = valid["LapNumber"].astype(int)

        if valid.empty:
            total_laps = 0
            lap_durations = []
        else:
            # Min elapsed time per lap (leader crossing)
            leader_times = (
                valid.groupby("LapNumber")["Time"]
                .min()
                .sort_index()
            )

            lap_durations = []
            prev_time = pd.Timedelta(0)  # lights-out reference

            for lap_num, elapsed in leader_times.items():
                duration_sec = (elapsed - prev_time).total_seconds()
                # Guard against negative/zero durations from data quirks
                if duration_sec < 0:
                    duration_sec = 0.0
                lap_durations.append(
                    LapDurationEntry(
                        lap_number=int(lap_num),
                        duration_seconds=round(duration_sec, 3),
                    )
                )
                prev_time = elapsed

            total_laps = int(leader_times.index.max())

    # Derive metadata from session
    event_name = (
        str(session.event["EventName"])
        if session.event is not None
        else session_key.split("::")[1]
    )
    parts = session_key.split("::")
    session_type = parts[2] if len(parts) >= 3 else ""
    year = int(parts[0]) if parts[0].isdigit() else 0

    return LapDurationsResponse(
        session_key=session_key,
        year=year,
        event_name=event_name,
        session_type=session_type,
        total_laps=total_laps,
        lap_durations=lap_durations,
    )


class GapChartPoint(BaseModel):
    lap_number: int
    gap_seconds: float  # positive = driver1 ahead
    driver1_position: int
    driver2_position: int
    driver1_lap_time_s: Optional[float] = None
    driver2_lap_time_s: Optional[float] = None
    gap_change: Optional[float] = None
    is_pit_lap_d1: bool = False
    is_pit_lap_d2: bool = False


class GapChartResponse(BaseModel):
    session_key: str
    driver1: str
    driver2: str
    driver1_color: str  # hex color without '#'
    driver2_color: str
    driver1_name: str
    driver2_name: str
    total_laps: int
    points: list[GapChartPoint]


@app.get("/api/sessions/{session_key:path}/gap-chart", response_model=GapChartResponse)
async def get_gap_chart(
    session_key: str,
    driver1: str = Query(..., description="First driver abbreviation (e.g. VER)"),
    driver2: str = Query(..., description="Second driver abbreviation (e.g. HAM)"),
    max_lap: Optional[int] = Query(None, description="Only return data up to this lap"),
):
    """
    Compute lap-by-lap cumulative gap between two drivers.

    The gap is computed from session-elapsed ``Time`` at each driver's
    start/finish line crossing:

        gap = driver2_crossing_time - driver1_crossing_time

    **Positive** gap → driver1 crossed the line first (driver1 is ahead).
    **Negative** gap → driver2 is ahead.

    Supports ``max_lap`` for replay-sync / jump-to-lap-N.

    The session must first be loaded via ``POST /api/sessions/load``.
    """
    session = _loaded_sessions.get(session_key)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not loaded. Call POST /api/sessions/load first.")

    if driver1 == driver2:
        raise HTTPException(status_code=422, detail="driver1 and driver2 must be different drivers.")

    laps_df = session.laps
    if laps_df is None or laps_df.empty:
        raise HTTPException(status_code=422, detail="Session has no lap data.")

    # Validate drivers exist in the session
    available_drivers: set[str] = set()
    for drv_num in session.drivers:
        info = session.get_driver(drv_num)
        abbr = str(info.get("Abbreviation", ""))
        if abbr:
            available_drivers.add(abbr)

    if driver1 not in available_drivers:
        raise HTTPException(
            status_code=404,
            detail=f"Driver '{driver1}' not found in session. Available: {sorted(available_drivers)}",
        )
    if driver2 not in available_drivers:
        raise HTTPException(
            status_code=404,
            detail=f"Driver '{driver2}' not found in session. Available: {sorted(available_drivers)}",
        )

    d1_laps = laps_df[laps_df["Driver"] == driver1].copy()
    d2_laps = laps_df[laps_df["Driver"] == driver2].copy()

    if d1_laps.empty:
        raise HTTPException(status_code=404, detail=f"No lap data for driver {driver1}")
    if d2_laps.empty:
        raise HTTPException(status_code=404, detail=f"No lap data for driver {driver2}")

    # Drop rows with no elapsed time
    d1_laps = d1_laps.dropna(subset=["Time"])
    d2_laps = d2_laps.dropna(subset=["Time"])

    # Merge on LapNumber
    d1_merge = d1_laps[["LapNumber", "Time", "Position", "LapTime"]].copy()
    d2_merge = d2_laps[["LapNumber", "Time", "Position", "LapTime"]].copy()
    d1_merge["LapNumber"] = d1_merge["LapNumber"].astype(int)
    d2_merge["LapNumber"] = d2_merge["LapNumber"].astype(int)

    merged = pd.merge(d1_merge, d2_merge, on="LapNumber", suffixes=("_d1", "_d2"))
    merged = merged.sort_values("LapNumber").reset_index(drop=True)

    if max_lap is not None:
        merged = merged[merged["LapNumber"] <= max_lap]

    # Compute gap
    merged["gap_seconds"] = (merged["Time_d2"] - merged["Time_d1"]).dt.total_seconds()
    merged["gap_change"] = merged["gap_seconds"].diff()

    # Pit lap detection: lap time > 1.35 * median
    def _pit_laps(driver_laps_df: pd.DataFrame) -> set[int]:
        valid = driver_laps_df.dropna(subset=["LapTime"])
        if valid.empty:
            return set()
        times_s = valid["LapTime"].dt.total_seconds()
        median_t = times_s.median()
        return set(valid.loc[times_s > median_t * 1.35, "LapNumber"].astype(int))

    d1_pits = _pit_laps(d1_laps)
    d2_pits = _pit_laps(d2_laps)

    points: list[GapChartPoint] = []
    for _, row in merged.iterrows():
        lap_num = int(row["LapNumber"])
        d1_lt = None
        if pd.notna(row.get("LapTime_d1")):
            d1_lt = round(row["LapTime_d1"].total_seconds(), 3)
        d2_lt = None
        if pd.notna(row.get("LapTime_d2")):
            d2_lt = round(row["LapTime_d2"].total_seconds(), 3)
        gap_chg = round(float(row["gap_change"]), 3) if pd.notna(row.get("gap_change")) else None

        points.append(GapChartPoint(
            lap_number=lap_num,
            gap_seconds=round(float(row["gap_seconds"]), 3),
            driver1_position=int(row["Position_d1"]) if pd.notna(row.get("Position_d1")) else 0,
            driver2_position=int(row["Position_d2"]) if pd.notna(row.get("Position_d2")) else 0,
            driver1_lap_time_s=d1_lt,
            driver2_lap_time_s=d2_lt,
            gap_change=gap_chg,
            is_pit_lap_d1=lap_num in d1_pits,
            is_pit_lap_d2=lap_num in d2_pits,
        ))

    # Get driver colors and names
    def _driver_info(abbr: str) -> tuple[str, str]:
        for drv_num in session.drivers:
            info = session.get_driver(drv_num)
            if str(info.get("Abbreviation", "")) == abbr:
                color = str(info.get("TeamColor", "FFFFFF"))
                name = f"{info.get('FirstName', '')} {info.get('LastName', '')}".strip()
                return color, name
        return "FFFFFF", abbr

    d1_color, d1_name = _driver_info(driver1)
    d2_color, d2_name = _driver_info(driver2)

    # Compute total laps
    total_laps = (
        int(session.total_laps)
        if hasattr(session, "total_laps") and session.total_laps
        else 0
    )
    if total_laps == 0 and not laps_df.empty and "LapNumber" in laps_df.columns:
        total_laps = int(laps_df["LapNumber"].max())

    return GapChartResponse(
        session_key=session_key,
        driver1=driver1,
        driver2=driver2,
        driver1_color=d1_color,
        driver2_color=d2_color,
        driver1_name=d1_name,
        driver2_name=d2_name,
        total_laps=total_laps,
        points=points,
    )


# ---------------------------------------------------------------------------
# Standings Board helpers
# ---------------------------------------------------------------------------


def _count_pit_stops(laps_df: pd.DataFrame) -> dict[str, int]:
    """Count pit stops per driver from laps data.

    A pit stop is detected by non-null PitInTime. Falls back to compound
    changes if PitInTime yields nothing.
    """
    counts: dict[str, int] = {}
    if laps_df.empty:
        return counts

    for driver, grp in laps_df.groupby("Driver"):
        drv = str(driver)
        grp_sorted = grp.sort_values("LapNumber")

        pit_count = 0
        if "PitInTime" in grp_sorted.columns:
            pit_count = int(grp_sorted["PitInTime"].notna().sum())

        # Fallback: count compound changes
        if pit_count == 0 and "Compound" in grp_sorted.columns:
            compounds = grp_sorted["Compound"].dropna()
            if len(compounds) > 1:
                pit_count = int((compounds != compounds.shift()).sum() - 1)
                pit_count = max(pit_count, 0)

        counts[drv] = pit_count
    return counts


def _get_fastest_lap_driver(laps_df: pd.DataFrame) -> str:
    """Return the driver abbreviation with the fastest lap in the DataFrame."""
    if laps_df.empty or "LapTime" not in laps_df.columns:
        return ""

    valid = laps_df.dropna(subset=["LapTime"])
    if valid.empty:
        return ""

    fastest_idx = valid["LapTime"].idxmin()
    return str(valid.loc[fastest_idx, "Driver"])


def _get_session_meta(session: object, session_key: str) -> tuple[str, str, int, int]:
    """Extract (event_name, session_type, year, total_laps) from a loaded session."""
    event_name = (
        str(session.event["EventName"])
        if session.event is not None
        else session_key.split("::")[1]
    )
    parts = session_key.split("::")
    session_type = parts[2] if len(parts) >= 3 else ""
    year = int(parts[0]) if parts[0].isdigit() else 0
    total_laps = (
        int(session.total_laps)
        if hasattr(session, "total_laps") and session.total_laps
        else 0
    )
    return event_name, session_type, year, total_laps


# ---------------------------------------------------------------------------
# Standings Board endpoint
# ---------------------------------------------------------------------------


@app.get("/api/sessions/{session_key:path}/standings", response_model=StandingsBoardResponse)
async def get_standings_at_lap(
    session_key: str,
    lap: int = Query(..., ge=1, description="Lap number to get standings for"),
):
    """
    Return the F1 TV-style standings board for a specific lap.

    Includes position, driver info, gap to leader, interval to car ahead,
    last lap time, tire compound/age, pit stop count, and fastest-lap
    indicator for every driver at the requested lap.

    The session must first be loaded via ``POST /api/sessions/load``.
    """
    session = _loaded_sessions.get(session_key)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Session not loaded. Call POST /api/sessions/load first.",
        )

    laps_df = session.laps
    if laps_df is None or laps_df.empty:
        event_name, session_type, year, total_laps = _get_session_meta(session, session_key)
        return StandingsBoardResponse(
            session_key=session_key,
            year=year,
            event_name=event_name,
            session_type=session_type,
            lap_number=lap,
            total_laps=total_laps,
            standings=[],
        )

    # Get laps at the requested lap number
    at_lap = laps_df[laps_df["LapNumber"] == lap].copy()
    if at_lap.empty:
        event_name, session_type, year, total_laps = _get_session_meta(session, session_key)
        return StandingsBoardResponse(
            session_key=session_key,
            year=year,
            event_name=event_name,
            session_type=session_type,
            lap_number=lap,
            total_laps=total_laps,
            standings=[],
        )

    # Sort by position (or elapsed time as fallback)
    if "Position" in at_lap.columns:
        at_lap = at_lap.sort_values("Position")
    elif "Time" in at_lap.columns:
        at_lap = at_lap.sort_values("Time")

    # Pre-compute pit stops and fastest lap across all laps up to this point
    laps_up_to = laps_df[laps_df["LapNumber"] <= lap]
    pit_counts = _count_pit_stops(laps_up_to)
    fastest_lap_driver = _get_fastest_lap_driver(laps_up_to)

    # Build driver info lookup from the session
    driver_lookup: dict[str, dict] = {}
    for drv_num in session.drivers:
        info = session.get_driver(drv_num)
        abbr = str(info.get("Abbreviation", ""))
        if abbr:
            driver_lookup[abbr] = {
                "driver_number": str(drv_num),
                "full_name": f"{info.get('FirstName', '')} {info.get('LastName', '')}".strip(),
                "team_name": str(info.get("TeamName", "")),
                "team_color": str(info.get("TeamColor", "FFFFFF")),
            }

    standings: list[StandingsEntry] = []
    leader_time: Optional[pd.Timedelta] = None
    prev_time: Optional[pd.Timedelta] = None

    for _, row in at_lap.iterrows():
        drv = str(row.get("Driver", ""))
        drv_info = driver_lookup.get(drv, {})
        time_val = row.get("Time")

        # Gap to leader and interval to car ahead
        gap_to_leader = ""
        interval = ""
        if leader_time is None:
            leader_time = time_val
            gap_to_leader = "LEADER"
            interval = ""
        else:
            if pd.notna(time_val) and pd.notna(leader_time):
                gap_sec = (time_val - leader_time).total_seconds()
                gap_to_leader = f"+{gap_sec:.3f}s"
            if pd.notna(time_val) and pd.notna(prev_time):
                int_sec = (time_val - prev_time).total_seconds()
                interval = f"+{int_sec:.3f}s"

        prev_time = time_val

        # Lap time formatting (M:SS.mmm)
        lap_time_val = row.get("LapTime")
        lap_time_str = ""
        if pd.notna(lap_time_val):
            total_secs = lap_time_val.total_seconds()
            mins = int(total_secs // 60)
            secs = total_secs % 60
            lap_time_str = f"{mins}:{secs:06.3f}"

        # Tire info
        tire_compound = str(row.get("Compound", "")) if pd.notna(row.get("Compound")) else ""
        tire_age = int(row.get("TyreLife", 0)) if pd.notna(row.get("TyreLife")) else 0

        standings.append(
            StandingsEntry(
                position=int(row.get("Position", 0)) if pd.notna(row.get("Position")) else 0,
                driver=drv,
                driver_number=drv_info.get("driver_number", ""),
                full_name=drv_info.get("full_name", drv),
                team=drv_info.get("team_name", ""),
                team_color=drv_info.get("team_color", "FFFFFF"),
                gap_to_leader=gap_to_leader,
                interval=interval,
                last_lap_time=lap_time_str,
                tire_compound=tire_compound,
                tire_age=tire_age,
                pit_stops=pit_counts.get(drv, 0),
                has_fastest_lap=(drv == fastest_lap_driver),
            )
        )

    event_name, session_type, year, total_laps = _get_session_meta(session, session_key)
    if total_laps == 0 and not laps_df.empty:
        total_laps = int(laps_df["LapNumber"].max())

    return StandingsBoardResponse(
        session_key=session_key,
        year=year,
        event_name=event_name,
        session_type=session_type,
        lap_number=lap,
        total_laps=total_laps,
        standings=standings,
    )


@app.get("/api/sessions/{session_key:path}/drivers")
async def list_drivers(session_key: str):
    """
    List drivers for a previously loaded session.
    """
    session = _loaded_sessions.get(session_key)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not loaded. Call POST /api/sessions/load first.")

    drivers = []
    for drv in session.drivers:
        info = session.get_driver(drv)
        drivers.append({
            "driver_number": str(drv),
            "abbreviation": str(info.get("Abbreviation", "")),
            "full_name": f"{info.get('FirstName', '')} {info.get('LastName', '')}".strip(),
            "team": str(info.get("TeamName", "")),
        })
    return drivers


# ---------------------------------------------------------------------------
# Replay endpoints
# ---------------------------------------------------------------------------


@app.post("/api/replay/start", response_model=ReplayStatusResponse)
async def start_replay(req: ReplayStartRequest):
    """
    Initialize a replay for a previously loaded session.

    Sets current lap to 1, records the start timestamp, marks the replay
    as active, and returns the initial replay status.

    The session must first be loaded via ``POST /api/sessions/load``.
    """
    session = _loaded_sessions.get(req.session_key)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Session not loaded. Call POST /api/sessions/load first.",
        )

    # Derive metadata
    event_name, session_type, year, total_laps = _get_session_meta(session, req.session_key)

    # If total_laps is 0, try to infer from laps data
    if total_laps == 0:
        laps_df = session.laps
        if laps_df is not None and not laps_df.empty and "LapNumber" in laps_df.columns:
            total_laps = int(laps_df["LapNumber"].max())

    if total_laps == 0:
        raise HTTPException(
            status_code=422,
            detail="Session has no lap data — cannot start replay.",
        )

    # Create (or reset) the replay state for this session
    state = _ReplayState(
        session_key=req.session_key,
        total_laps=total_laps,
        year=year,
        event_name=event_name,
        session_type=session_type,
    )
    _replay_states[req.session_key] = state

    return state.to_response()


def _compute_elapsed_at_lap(session: object, target_lap: int) -> float:
    """Compute cumulative elapsed time (seconds) from lights-out to the end of target_lap.

    Uses the minimum session-elapsed ``Time`` across all drivers for the
    target lap (i.e. the leader's crossing time).  Falls back to summing
    approximate lap durations if exact timing is unavailable.
    """
    laps_df = session.laps
    if laps_df is None or laps_df.empty:
        return 0.0

    valid = laps_df.dropna(subset=["Time", "LapNumber"]).copy()
    if valid.empty:
        return 0.0

    valid["LapNumber"] = valid["LapNumber"].astype(int)
    at_lap = valid[valid["LapNumber"] == target_lap]

    if not at_lap.empty:
        # Leader's crossing time at target_lap
        min_time = at_lap["Time"].min()
        return round(min_time.total_seconds(), 3)

    # If exact lap data is missing, sum leader times up to the highest available lap
    leader_times = valid.groupby("LapNumber")["Time"].min().sort_index()
    available = leader_times[leader_times.index <= target_lap]
    if not available.empty:
        return round(available.iloc[-1].total_seconds(), 3)

    return 0.0


def _build_standings_for_lap(session: object, session_key: str, lap: int) -> list[StandingsEntry]:
    """Build standings entries for a given lap, reusing the same logic as the standings endpoint."""
    laps_df = session.laps
    if laps_df is None or laps_df.empty:
        return []

    at_lap = laps_df[laps_df["LapNumber"] == lap].copy()
    if at_lap.empty:
        return []

    # Sort by position (or elapsed time as fallback)
    if "Position" in at_lap.columns:
        at_lap = at_lap.sort_values("Position")
    elif "Time" in at_lap.columns:
        at_lap = at_lap.sort_values("Time")

    # Pre-compute pit stops and fastest lap across all laps up to this point
    laps_up_to = laps_df[laps_df["LapNumber"] <= lap]
    pit_counts = _count_pit_stops(laps_up_to)
    fastest_lap_driver = _get_fastest_lap_driver(laps_up_to)

    # Build driver info lookup from the session
    driver_lookup: dict[str, dict] = {}
    for drv_num in session.drivers:
        info = session.get_driver(drv_num)
        abbr = str(info.get("Abbreviation", ""))
        if abbr:
            driver_lookup[abbr] = {
                "driver_number": str(drv_num),
                "full_name": f"{info.get('FirstName', '')} {info.get('LastName', '')}".strip(),
                "team_name": str(info.get("TeamName", "")),
                "team_color": str(info.get("TeamColor", "FFFFFF")),
            }

    standings: list[StandingsEntry] = []
    leader_time: Optional[pd.Timedelta] = None
    prev_time: Optional[pd.Timedelta] = None

    for _, row in at_lap.iterrows():
        drv = str(row.get("Driver", ""))
        drv_info = driver_lookup.get(drv, {})
        time_val = row.get("Time")

        # Gap to leader and interval to car ahead
        gap_to_leader = ""
        interval = ""
        if leader_time is None:
            leader_time = time_val
            gap_to_leader = "LEADER"
            interval = ""
        else:
            if pd.notna(time_val) and pd.notna(leader_time):
                gap_sec = (time_val - leader_time).total_seconds()
                gap_to_leader = f"+{gap_sec:.3f}s"
            if pd.notna(time_val) and pd.notna(prev_time):
                int_sec = (time_val - prev_time).total_seconds()
                interval = f"+{int_sec:.3f}s"

        prev_time = time_val

        # Lap time formatting (M:SS.mmm)
        lap_time_val = row.get("LapTime")
        lap_time_str = ""
        if pd.notna(lap_time_val):
            total_secs = lap_time_val.total_seconds()
            mins = int(total_secs // 60)
            secs = total_secs % 60
            lap_time_str = f"{mins}:{secs:06.3f}"

        # Tire info
        tire_compound = str(row.get("Compound", "")) if pd.notna(row.get("Compound")) else ""
        tire_age = int(row.get("TyreLife", 0)) if pd.notna(row.get("TyreLife")) else 0

        standings.append(
            StandingsEntry(
                position=int(row.get("Position", 0)) if pd.notna(row.get("Position")) else 0,
                driver=drv,
                driver_number=drv_info.get("driver_number", ""),
                full_name=drv_info.get("full_name", drv),
                team=drv_info.get("team_name", ""),
                team_color=drv_info.get("team_color", "FFFFFF"),
                gap_to_leader=gap_to_leader,
                interval=interval,
                last_lap_time=lap_time_str,
                tire_compound=tire_compound,
                tire_age=tire_age,
                pit_stops=pit_counts.get(drv, 0),
                has_fastest_lap=(drv == fastest_lap_driver),
            )
        )

    return standings


@app.put(
    "/api/sessions/{session_key:path}/jump/{lap}",
    response_model=ReplayJumpResponse,
)
async def jump_to_lap(session_key: str, lap: int):
    """
    Jump the replay to a specific lap number.

    Validates the target lap against the session's total laps, updates the
    server-side replay state (current lap, elapsed time), computes the
    standings at that lap, and returns the full updated state.

    The session must first be loaded via ``POST /api/sessions/load``.
    A replay must be started via ``POST /api/replay/start`` before jumping
    (if no replay exists, one is created automatically).
    """
    session = _loaded_sessions.get(session_key)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Session not loaded. Call POST /api/sessions/load first.",
        )

    # Derive metadata
    event_name, session_type, year, total_laps = _get_session_meta(session, session_key)

    # Fallback total_laps from data
    if total_laps == 0:
        laps_df = session.laps
        if laps_df is not None and not laps_df.empty and "LapNumber" in laps_df.columns:
            total_laps = int(laps_df["LapNumber"].max())

    if total_laps == 0:
        raise HTTPException(
            status_code=422,
            detail="Session has no lap data — cannot jump to lap.",
        )

    # Validate target lap
    if lap < 1:
        raise HTTPException(
            status_code=422,
            detail=f"Lap must be >= 1, got {lap}.",
        )
    if lap > total_laps:
        raise HTTPException(
            status_code=422,
            detail=f"Lap {lap} exceeds total laps ({total_laps}) for this session.",
        )

    # Get or create replay state
    state = _replay_states.get(session_key)
    if state is None:
        state = _ReplayState(
            session_key=session_key,
            total_laps=total_laps,
            year=year,
            event_name=event_name,
            session_type=session_type,
        )
        _replay_states[session_key] = state

    # Update replay state
    state.current_lap = lap
    if lap >= total_laps:
        state.status = "completed"
    else:
        state.status = "active"

    # Compute elapsed time from lights-out to end of this lap
    elapsed_seconds = _compute_elapsed_at_lap(session, lap)

    # Build standings at this lap
    standings = _build_standings_for_lap(session, session_key, lap)

    return ReplayJumpResponse(
        session_key=session_key,
        current_lap=lap,
        total_laps=total_laps,
        elapsed_seconds=elapsed_seconds,
        status=state.status,
        year=year,
        event_name=event_name,
        session_type=session_type,
        standings=standings,
    )


# ---------------------------------------------------------------------------
# Entrypoint (for running standalone: python api.py)
# ---------------------------------------------------------------------------

def main():
    """Run the API server directly."""
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    main()
