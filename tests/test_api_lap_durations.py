"""Tests for the lap-durations API endpoint.

Exercises:
    GET /api/sessions/{session_key}/lap-durations
"""

from unittest.mock import MagicMock

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api import app, _loaded_sessions

client = TestClient(app)

_TEST_KEY = "2024::Bahrain Grand Prix::Race"


def _make_mock_session(num_drivers: int = 3, laps_per_driver: int = 5):
    """Create a mock FastF1 session with realistic lap data."""
    session = MagicMock()

    driver_nums = [str(i + 1) for i in range(num_drivers)]
    session.drivers = driver_nums

    driver_abbrs = ["VER", "HAM", "LEC"][:num_drivers]
    teams = ["Red Bull Racing", "Mercedes", "Ferrari"][:num_drivers]
    colors = ["3671C6", "6CD3BF", "F91536"][:num_drivers]
    first_names = ["Max", "Lewis", "Charles"][:num_drivers]
    last_names = ["Verstappen", "Hamilton", "Leclerc"][:num_drivers]

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
            # Driver 0 (VER) is fastest → their Time is the minimum per lap
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
                "TyreLife": lap,
                "PitOutTime": pd.NaT,
                "PitInTime": pd.NaT,
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
    """Remove test session from the in-memory cache after each test."""
    yield
    _loaded_sessions.pop(_TEST_KEY, None)


# ---------------------------------------------------------------------------
# GET /api/sessions/{session_key}/lap-durations
# ---------------------------------------------------------------------------


class TestGetLapDurations:
    def test_returns_404_when_session_not_loaded(self):
        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-durations")
        assert resp.status_code == 404

    def test_returns_lap_durations_structure(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-durations")
        assert resp.status_code == 200
        data = resp.json()

        assert data["session_key"] == _TEST_KEY
        assert data["year"] == 2024
        assert data["event_name"] == "Bahrain Grand Prix"
        assert data["session_type"] == "Race"
        assert data["total_laps"] == 5
        assert isinstance(data["lap_durations"], list)
        assert len(data["lap_durations"]) == 5

    def test_lap_duration_entry_fields(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1, laps_per_driver=3)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-durations")
        data = resp.json()

        entry = data["lap_durations"][0]
        assert "lap_number" in entry
        assert "duration_seconds" in entry
        assert isinstance(entry["lap_number"], int)
        assert isinstance(entry["duration_seconds"], float)

    def test_lap_numbers_sequential(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=2, laps_per_driver=5)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-durations")
        data = resp.json()

        lap_numbers = [e["lap_number"] for e in data["lap_durations"]]
        assert lap_numbers == [1, 2, 3, 4, 5]

    def test_durations_are_positive(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=3, laps_per_driver=5)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-durations")
        data = resp.json()

        for entry in data["lap_durations"]:
            assert entry["duration_seconds"] > 0, (
                f"Lap {entry['lap_number']} has non-positive duration: {entry['duration_seconds']}"
            )

    def test_durations_sum_approximately_matches_total_elapsed(self):
        """Sum of all lap durations should match the leader's total elapsed time."""
        num_laps = 5
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=2, laps_per_driver=num_laps)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-durations")
        data = resp.json()

        total_duration = sum(e["duration_seconds"] for e in data["lap_durations"])
        # Leader's elapsed time at last lap: num_laps * 91 + 0 * 0.5 = num_laps * 91
        expected_total = num_laps * 91.0
        assert abs(total_duration - expected_total) < 1.0

    def test_lap1_duration_equals_first_elapsed(self):
        """Lap 1 duration should equal the leader's first lap elapsed time."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=2, laps_per_driver=3)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-durations")
        data = resp.json()

        lap1 = data["lap_durations"][0]
        assert lap1["lap_number"] == 1
        # Leader's lap 1 elapsed: 1 * 91 + 0 = 91s
        assert abs(lap1["duration_seconds"] - 91.0) < 0.01

    def test_leader_lap_durations_used(self):
        """Durations should be based on the fastest (leader) crossing per lap."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=3, laps_per_driver=3)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-durations")
        data = resp.json()

        # With our mock data: elapsed for driver 0 on lap N = N * 91
        # So lap durations should be ~91s each (except rounding)
        for entry in data["lap_durations"]:
            assert abs(entry["duration_seconds"] - 91.0) < 0.1

    def test_empty_laps_returns_empty_durations(self):
        session = _make_mock_session(num_drivers=1, laps_per_driver=0)
        session.laps = pd.DataFrame()
        session.total_laps = 0
        _loaded_sessions[_TEST_KEY] = session

        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-durations")
        assert resp.status_code == 200
        data = resp.json()
        assert data["lap_durations"] == []
        assert data["total_laps"] == 0

    def test_single_driver_session(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1, laps_per_driver=3)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-durations")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["lap_durations"]) == 3

    def test_duration_precision(self):
        """Durations should be rounded to 3 decimal places (millisecond precision)."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1, laps_per_driver=2)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-durations")
        data = resp.json()

        for entry in data["lap_durations"]:
            # Check that the duration string representation has at most 3 decimal digits
            duration_str = str(entry["duration_seconds"])
            if "." in duration_str:
                decimal_part = duration_str.split(".")[1]
                assert len(decimal_part) <= 3
