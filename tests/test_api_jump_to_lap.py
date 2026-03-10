"""Tests for the jump-to-lap API endpoint.

Exercises:
    PUT /api/sessions/{session_key}/jump/{lap}
"""

from unittest.mock import MagicMock

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api import app, _loaded_sessions, _replay_states

client = TestClient(app)

_TEST_KEY = "2024::Bahrain Grand Prix::Race"


def _make_mock_session(num_drivers: int = 3, laps_per_driver: int = 5):
    """Create a mock FastF1 session with realistic lap data."""
    session = MagicMock()

    driver_nums = [str(i + 1) for i in range(num_drivers)]
    session.drivers = driver_nums

    driver_abbrs = ["VER", "HAM", "LEC", "NOR", "PIA"][:num_drivers]
    teams = ["Red Bull Racing", "Mercedes", "Ferrari", "McLaren", "McLaren"][:num_drivers]
    colors = ["3671C6", "6CD3BF", "F91536", "FF8000", "FF8000"][:num_drivers]
    first_names = ["Max", "Lewis", "Charles", "Lando", "Oscar"][:num_drivers]
    last_names = ["Verstappen", "Hamilton", "Leclerc", "Norris", "Piastri"][:num_drivers]

    def get_driver(drv_num):
        idx = driver_nums.index(str(drv_num))
        return {
            "Abbreviation": driver_abbrs[idx],
            "FirstName": first_names[idx],
            "LastName": last_names[idx],
            "TeamName": teams[idx],
            "TeamColor": colors[idx],
            "DriverNumber": drv_num,
        }

    session.get_driver = get_driver

    rows = []
    for d_idx in range(num_drivers):
        for lap in range(1, laps_per_driver + 1):
            lap_time = pd.Timedelta(seconds=90 + d_idx * 0.5 + lap * 0.01)
            elapsed = pd.Timedelta(seconds=lap * 91 + d_idx * 0.5)
            rows.append({
                "Driver": driver_abbrs[d_idx],
                "DriverNumber": driver_nums[d_idx],
                "LapNumber": lap,
                "LapTime": lap_time,
                "Position": d_idx + 1,
                "Sector1Time": pd.Timedelta(seconds=28 + d_idx * 0.1),
                "Sector2Time": pd.Timedelta(seconds=33 + d_idx * 0.2),
                "Sector3Time": pd.Timedelta(seconds=29 + d_idx * 0.2),
                "Compound": "SOFT" if lap <= 2 else "MEDIUM",
                "TyreLife": lap if lap <= 2 else lap - 2,
                "PitOutTime": pd.Timedelta(seconds=20) if lap == 3 else pd.NaT,
                "PitInTime": pd.Timedelta(seconds=85) if lap == 2 else pd.NaT,
                "Time": elapsed,
            })

    session.laps = pd.DataFrame(rows)
    session.total_laps = laps_per_driver

    event_mock = MagicMock()
    event_mock.__getitem__ = lambda self, key: "Bahrain Grand Prix" if key == "EventName" else None
    session.event = event_mock

    return session


@pytest.fixture(autouse=True)
def _cleanup_sessions():
    """Remove test session from in-memory caches after each test."""
    yield
    _loaded_sessions.pop(_TEST_KEY, None)
    _replay_states.pop(_TEST_KEY, None)


# ---------------------------------------------------------------------------
# PUT /api/sessions/{session_key}/jump/{lap}
# ---------------------------------------------------------------------------


class TestJumpToLapBasic:
    """Basic functionality tests."""

    def test_returns_404_when_session_not_loaded(self):
        resp = client.put(f"/api/sessions/{_TEST_KEY}/jump/3")
        assert resp.status_code == 404

    def test_jump_to_valid_lap(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.put(f"/api/sessions/{_TEST_KEY}/jump/3")
        assert resp.status_code == 200
        data = resp.json()

        assert data["session_key"] == _TEST_KEY
        assert data["current_lap"] == 3
        assert data["total_laps"] == 5
        assert data["year"] == 2024
        assert data["event_name"] == "Bahrain Grand Prix"
        assert data["session_type"] == "Race"
        assert data["status"] == "active"

    def test_jump_to_first_lap(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.put(f"/api/sessions/{_TEST_KEY}/jump/1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["current_lap"] == 1
        assert data["status"] == "active"

    def test_jump_to_last_lap_marks_completed(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(laps_per_driver=5)
        resp = client.put(f"/api/sessions/{_TEST_KEY}/jump/5")
        assert resp.status_code == 200
        data = resp.json()
        assert data["current_lap"] == 5
        assert data["status"] == "completed"


class TestJumpToLapValidation:
    """Validation and error case tests."""

    def test_lap_zero_rejected(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.put(f"/api/sessions/{_TEST_KEY}/jump/0")
        assert resp.status_code == 422

    def test_negative_lap_rejected(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.put(f"/api/sessions/{_TEST_KEY}/jump/-1")
        assert resp.status_code == 422

    def test_lap_exceeding_total_rejected(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(laps_per_driver=5)
        resp = client.put(f"/api/sessions/{_TEST_KEY}/jump/6")
        assert resp.status_code == 422
        assert "exceeds total laps" in resp.json()["detail"]

    def test_lap_exceeding_total_by_large_amount(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(laps_per_driver=5)
        resp = client.put(f"/api/sessions/{_TEST_KEY}/jump/100")
        assert resp.status_code == 422

    def test_empty_laps_session_rejected(self):
        session = _make_mock_session(num_drivers=1, laps_per_driver=0)
        session.laps = pd.DataFrame()
        session.total_laps = 0
        _loaded_sessions[_TEST_KEY] = session

        resp = client.put(f"/api/sessions/{_TEST_KEY}/jump/1")
        assert resp.status_code == 422
        assert "no lap data" in resp.json()["detail"]


class TestJumpToLapElapsedTime:
    """Tests for elapsed time computation."""

    def test_elapsed_time_positive(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.put(f"/api/sessions/{_TEST_KEY}/jump/3")
        data = resp.json()
        assert data["elapsed_seconds"] > 0

    def test_elapsed_time_increases_with_lap(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp1 = client.put(f"/api/sessions/{_TEST_KEY}/jump/2")
        resp3 = client.put(f"/api/sessions/{_TEST_KEY}/jump/4")

        elapsed_2 = resp1.json()["elapsed_seconds"]
        elapsed_4 = resp3.json()["elapsed_seconds"]
        assert elapsed_4 > elapsed_2

    def test_elapsed_time_lap1_matches_leader(self):
        """Lap 1 elapsed should match the leader's first finish-line crossing."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=2, laps_per_driver=3)
        resp = client.put(f"/api/sessions/{_TEST_KEY}/jump/1")
        data = resp.json()
        # Leader (VER) lap 1 elapsed: 1 * 91 + 0 = 91s
        assert abs(data["elapsed_seconds"] - 91.0) < 0.01

    def test_elapsed_time_is_leader_time(self):
        """Elapsed should use the minimum Time across all drivers (leader)."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=3, laps_per_driver=5)
        resp = client.put(f"/api/sessions/{_TEST_KEY}/jump/5")
        data = resp.json()
        # Leader elapsed at lap 5: 5 * 91 + 0 = 455s
        assert abs(data["elapsed_seconds"] - 455.0) < 0.01


class TestJumpToLapStandings:
    """Tests for standings included in jump response."""

    def test_standings_included(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.put(f"/api/sessions/{_TEST_KEY}/jump/3")
        data = resp.json()
        assert "standings" in data
        assert isinstance(data["standings"], list)
        assert len(data["standings"]) > 0

    def test_standings_match_lap(self):
        """Standings should reflect the state at the jumped-to lap."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=3, laps_per_driver=5)
        resp = client.put(f"/api/sessions/{_TEST_KEY}/jump/3")
        data = resp.json()

        standings = data["standings"]
        assert len(standings) == 3
        # Positions should be sorted
        positions = [s["position"] for s in standings]
        assert positions == sorted(positions)

    def test_leader_has_leader_gap(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=3, laps_per_driver=5)
        resp = client.put(f"/api/sessions/{_TEST_KEY}/jump/3")
        data = resp.json()

        leader = data["standings"][0]
        assert leader["gap_to_leader"] == "LEADER"

    def test_standings_have_all_required_fields(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1, laps_per_driver=3)
        resp = client.put(f"/api/sessions/{_TEST_KEY}/jump/2")
        data = resp.json()

        entry = data["standings"][0]
        expected_fields = [
            "position", "driver", "driver_number", "full_name",
            "team", "team_color", "gap_to_leader", "interval",
            "last_lap_time", "tire_compound", "tire_age",
            "pit_stops", "has_fastest_lap",
        ]
        for field in expected_fields:
            assert field in entry, f"Missing field: {field}"

    def test_tire_compound_reflects_jumped_lap(self):
        """Tire compound should match the state at the jumped-to lap."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1, laps_per_driver=5)
        # Lap 1-2 = SOFT, Lap 3+ = MEDIUM (based on mock)
        resp_soft = client.put(f"/api/sessions/{_TEST_KEY}/jump/1")
        resp_med = client.put(f"/api/sessions/{_TEST_KEY}/jump/4")

        assert resp_soft.json()["standings"][0]["tire_compound"] == "SOFT"
        assert resp_med.json()["standings"][0]["tire_compound"] == "MEDIUM"

    def test_pit_stops_accumulate_through_jump(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1, laps_per_driver=5)
        # PitInTime on lap 2
        resp_before = client.put(f"/api/sessions/{_TEST_KEY}/jump/1")
        resp_after = client.put(f"/api/sessions/{_TEST_KEY}/jump/3")

        assert resp_before.json()["standings"][0]["pit_stops"] == 0
        assert resp_after.json()["standings"][0]["pit_stops"] == 1


class TestJumpToLapReplayState:
    """Tests that jump properly updates server-side replay state."""

    def test_creates_replay_state_if_not_exists(self):
        """Jump should auto-create replay state if no replay was started."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        assert _TEST_KEY not in _replay_states

        resp = client.put(f"/api/sessions/{_TEST_KEY}/jump/3")
        assert resp.status_code == 200
        assert _TEST_KEY in _replay_states
        assert _replay_states[_TEST_KEY].current_lap == 3

    def test_updates_existing_replay_state(self):
        """Jump should update existing replay state."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        # Start at lap 1
        client.put(f"/api/sessions/{_TEST_KEY}/jump/1")
        assert _replay_states[_TEST_KEY].current_lap == 1

        # Jump to lap 4
        client.put(f"/api/sessions/{_TEST_KEY}/jump/4")
        assert _replay_states[_TEST_KEY].current_lap == 4

    def test_jump_backward_works(self):
        """Should be able to jump backward (re-sync)."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        client.put(f"/api/sessions/{_TEST_KEY}/jump/4")
        resp = client.put(f"/api/sessions/{_TEST_KEY}/jump/2")
        assert resp.status_code == 200
        data = resp.json()
        assert data["current_lap"] == 2
        assert data["status"] == "active"
        assert _replay_states[_TEST_KEY].current_lap == 2

    def test_jump_to_last_lap_then_back_resets_status(self):
        """Jumping to last lap sets completed, jumping back resets to active."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session(laps_per_driver=5)
        resp1 = client.put(f"/api/sessions/{_TEST_KEY}/jump/5")
        assert resp1.json()["status"] == "completed"

        resp2 = client.put(f"/api/sessions/{_TEST_KEY}/jump/3")
        assert resp2.json()["status"] == "active"

    def test_total_laps_derived_when_attr_none(self):
        """total_laps should be derived from data when session attribute is None."""
        session = _make_mock_session(num_drivers=2, laps_per_driver=10)
        session.total_laps = None
        _loaded_sessions[_TEST_KEY] = session

        resp = client.put(f"/api/sessions/{_TEST_KEY}/jump/5")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_laps"] == 10
