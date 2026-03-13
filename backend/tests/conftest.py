"""Shared test fixtures for F1 Dashboard backend tests."""

import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock

import numpy as np
import pandas as pd
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from main import app


@pytest.fixture
def mock_schedule():
    """Pandas DataFrame mimicking fastf1.get_event_schedule output.

    Includes both past events (data available) and a future event (no data yet).
    """
    now = datetime.now(timezone.utc)
    data = {
        "RoundNumber": [1, 2, 3],
        "EventName": [
            "Bahrain Grand Prix",
            "Saudi Arabian Grand Prix",
            "Australian Grand Prix",  # future
        ],
        "Country": ["Bahrain", "Saudi Arabia", "Australia"],
        "EventDate": [
            now - timedelta(days=60),
            now - timedelta(days=30),
            now + timedelta(days=30),  # future — should be filtered out
        ],
        "Session1": ["Practice 1", "Practice 1", "Practice 1"],
        "Session2": ["Practice 2", "Practice 2", "Practice 2"],
        "Session3": ["Practice 3", "Practice 3", "Practice 3"],
        "Session4": ["Qualifying", "Qualifying", "Qualifying"],
        "Session5": ["Race", "Race", "Race"],
    }
    return pd.DataFrame(data)


@pytest.fixture
def mock_session():
    """Mock FastF1 session object with realistic lap data.

    Includes edge cases: Timedelta values, NaT for missing laps, numpy.float64 for positions.
    """
    session = MagicMock()

    # Build a realistic laps DataFrame with edge cases
    laps_data = {
        "LapNumber": pd.array([1, 2, 3, np.nan], dtype="Float64"),
        "Driver": ["VER", "HAM", "LEC", "NOR"],
        "LapTime": [
            pd.Timedelta(seconds=93.456),
            pd.Timedelta(seconds=92.123),
            pd.NaT,  # NaT for missing lap time
            pd.Timedelta(seconds=94.789),
        ],
        "Time": [
            pd.Timedelta(seconds=93.456),
            pd.Timedelta(seconds=185.579),
            pd.NaT,
            pd.Timedelta(seconds=374.824),
        ],
        "PitInTime": [
            pd.NaT,
            pd.Timedelta(seconds=90.0),
            pd.NaT,
            pd.NaT,
        ],
        "PitOutTime": [
            pd.NaT,
            pd.Timedelta(seconds=115.0),
            pd.NaT,
            pd.NaT,
        ],
        "Compound": ["SOFT", "MEDIUM", None, "HARD"],
        "TyreLife": pd.array([1.0, 12.0, np.nan, 5.0], dtype="Float64"),
        "Position": pd.array([1, 2, 3, np.nan], dtype="Float64"),
        "Stint": pd.array([1, 1, 1, np.nan], dtype="Float64"),
    }
    session.laps = pd.DataFrame(laps_data)
    session.load = MagicMock(return_value=None)
    return session


@pytest_asyncio.fixture
async def client():
    """Async HTTP client for testing against the FastAPI app.

    Uses lifespan=True to ensure FastAPI startup/shutdown events run
    (which initializes app.state.session_locks and FastF1 cache).
    """
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=True),
        base_url="http://test",
    ) as ac:
        # Manually initialize app.state.session_locks if lifespan didn't run
        if not hasattr(app.state, "session_locks"):
            app.state.session_locks = {}
        yield ac
