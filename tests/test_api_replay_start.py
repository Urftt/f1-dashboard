"""Tests for POST /api/replay/start endpoint.

Exercises:
    - Starting a replay for a loaded session
    - Replay initializes with correct state (lap 1, active status, timestamp)
    - 404 for non-loaded sessions
    - 422 for sessions with no lap data
    - Re-starting a replay resets state
"""

import time
from unittest.mock import MagicMock, PropertyMock, patch

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api import _loaded_sessions, _replay_states, app

client = TestClient(app)

# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

SESSION_KEY = "2023::Bahrain::Race"


def _make_mock_session(total_laps: int = 57, has_laps: bool = True) -> MagicMock:
    """Create a mock FastF1 session object."""
    session = MagicMock()
    session.total_laps = total_laps

    event = MagicMock()
    event.__getitem__ = lambda self, key: "Bahrain Grand Prix" if key == "EventName" else None
    session.event = event

    if has_laps:
        laps_df = pd.DataFrame({
            "LapNumber": list(range(1, total_laps + 1)),
            "Driver": ["VER"] * total_laps,
            "LapTime": [pd.Timedelta(seconds=95)] * total_laps,
        })
        session.laps = laps_df
    else:
        session.laps = pd.DataFrame()

    session.drivers = ["1"]
    info = {"Abbreviation": "VER", "FirstName": "Max", "LastName": "Verstappen",
            "TeamName": "Red Bull Racing", "TeamColor": "3671C6"}
    session.get_driver = MagicMock(return_value=info)

    return session


@pytest.fixture(autouse=True)
def _cleanup():
    """Clean up global state before/after each test."""
    _loaded_sessions.clear()
    _replay_states.clear()
    yield
    _loaded_sessions.clear()
    _replay_states.clear()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestReplayStart:
    def test_start_replay_success(self):
        """POST /api/replay/start returns 200 with correct initial state."""
        _loaded_sessions[SESSION_KEY] = _make_mock_session()

        before = time.time()
        resp = client.post("/api/replay/start", json={"session_key": SESSION_KEY})
        after = time.time()

        assert resp.status_code == 200
        data = resp.json()

        assert data["session_key"] == SESSION_KEY
        assert data["status"] == "active"
        assert data["current_lap"] == 1
        assert data["total_laps"] == 57
        assert data["year"] == 2023
        assert data["event_name"] == "Bahrain Grand Prix"
        assert data["session_type"] == "Race"
        # start_timestamp should be close to now
        assert before <= data["start_timestamp"] <= after
        # elapsed_seconds should be very small (< 1 second)
        assert 0 <= data["elapsed_seconds"] < 1.0

    def test_start_replay_session_not_loaded(self):
        """POST /api/replay/start returns 404 for unknown session."""
        resp = client.post("/api/replay/start", json={"session_key": "bogus::key::Race"})
        assert resp.status_code == 404
        assert "not loaded" in resp.json()["detail"].lower()

    def test_start_replay_no_lap_data(self):
        """POST /api/replay/start returns 422 when session has no laps."""
        session = _make_mock_session(total_laps=0, has_laps=False)
        session.total_laps = 0
        _loaded_sessions[SESSION_KEY] = session

        resp = client.post("/api/replay/start", json={"session_key": SESSION_KEY})
        assert resp.status_code == 422
        assert "no lap data" in resp.json()["detail"].lower()

    def test_start_replay_resets_existing(self):
        """Starting a replay again resets the state (current_lap back to 1)."""
        _loaded_sessions[SESSION_KEY] = _make_mock_session()

        # Start first time
        resp1 = client.post("/api/replay/start", json={"session_key": SESSION_KEY})
        assert resp1.status_code == 200
        ts1 = resp1.json()["start_timestamp"]

        # Simulate some time passing
        time.sleep(0.05)

        # Start again — should reset
        resp2 = client.post("/api/replay/start", json={"session_key": SESSION_KEY})
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2["current_lap"] == 1
        assert data2["status"] == "active"
        # New timestamp should be later
        assert data2["start_timestamp"] > ts1

    def test_start_replay_stores_state_in_memory(self):
        """Replay state is stored in _replay_states dict."""
        _loaded_sessions[SESSION_KEY] = _make_mock_session()

        resp = client.post("/api/replay/start", json={"session_key": SESSION_KEY})
        assert resp.status_code == 200

        assert SESSION_KEY in _replay_states
        state = _replay_states[SESSION_KEY]
        assert state.current_lap == 1
        assert state.status == "active"
        assert state.total_laps == 57

    def test_start_replay_infers_total_laps_from_data(self):
        """If total_laps is 0, it should infer from lap data."""
        session = _make_mock_session(total_laps=0, has_laps=True)
        session.total_laps = 0
        # Override laps with actual data so max LapNumber = 44
        session.laps = pd.DataFrame({
            "LapNumber": list(range(1, 45)),
            "Driver": ["VER"] * 44,
        })
        _loaded_sessions[SESSION_KEY] = session

        resp = client.post("/api/replay/start", json={"session_key": SESSION_KEY})
        assert resp.status_code == 200
        assert resp.json()["total_laps"] == 44

    def test_start_replay_missing_session_key(self):
        """POST /api/replay/start with missing body returns 422."""
        resp = client.post("/api/replay/start", json={})
        assert resp.status_code == 422
