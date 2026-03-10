"""Tests for the session lap-data API endpoint.

Exercises:
    GET /api/sessions/{session_key}/lap-data
"""

from unittest.mock import MagicMock, PropertyMock, patch

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api import app, _loaded_sessions

client = TestClient(app)

# Unique key for test sessions
_TEST_KEY = "2024::Bahrain Grand Prix::Race"


def _make_mock_session(num_drivers: int = 3, laps_per_driver: int = 5):
    """Create a mock FastF1 session with realistic lap data."""
    session = MagicMock()

    # Drivers list
    driver_nums = [str(i + 1) for i in range(num_drivers)]
    session.drivers = driver_nums

    # Driver info lookup
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

    # Build laps DataFrame
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
                "TyreLife": lap,
                "PitOutTime": pd.Timedelta(seconds=20) if lap == 3 else pd.NaT,
                "PitInTime": pd.Timedelta(seconds=85) if lap == 2 else pd.NaT,
                "Time": elapsed,
            })

    session.laps = pd.DataFrame(rows)
    session.total_laps = laps_per_driver

    # Event info
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
# GET /api/sessions/{session_key}/lap-data
# ---------------------------------------------------------------------------


class TestGetSessionLapData:
    def test_returns_404_when_session_not_loaded(self):
        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-data")
        assert resp.status_code == 404

    def test_returns_structured_lap_data(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-data")
        assert resp.status_code == 200
        data = resp.json()

        # Top-level fields
        assert data["session_key"] == _TEST_KEY
        assert data["year"] == 2024
        assert data["event_name"] == "Bahrain Grand Prix"
        assert data["session_type"] == "Race"
        assert data["total_laps"] == 5

    def test_drivers_list(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=3)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-data")
        data = resp.json()

        assert len(data["drivers"]) == 3
        driver = data["drivers"][0]
        assert "abbreviation" in driver
        assert "driver_number" in driver
        assert "full_name" in driver
        assert "team_name" in driver
        assert "team_color" in driver

    def test_driver_fields_correct(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-data")
        data = resp.json()

        driver = data["drivers"][0]
        assert driver["abbreviation"] == "VER"
        assert driver["full_name"] == "Max Verstappen"
        assert driver["team_name"] == "Red Bull Racing"
        assert driver["team_color"] == "3671C6"

    def test_laps_count(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=2, laps_per_driver=10)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-data")
        data = resp.json()

        # 2 drivers x 10 laps = 20 lap entries
        assert len(data["laps"]) == 20

    def test_lap_entry_fields(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1, laps_per_driver=1)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-data")
        data = resp.json()

        lap = data["laps"][0]
        expected_fields = [
            "driver", "lap_number", "lap_time_ms", "position",
            "sector1_ms", "sector2_ms", "sector3_ms",
            "compound", "tyre_life",
            "is_pit_out_lap", "is_pit_in_lap", "elapsed_ms",
        ]
        for field in expected_fields:
            assert field in lap, f"Missing field: {field}"

    def test_lap_time_in_milliseconds(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1, laps_per_driver=1)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-data")
        data = resp.json()

        lap = data["laps"][0]
        # Lap time should be around 90s = 90000ms
        assert lap["lap_time_ms"] is not None
        assert 89000 < lap["lap_time_ms"] < 92000

    def test_sector_times_in_milliseconds(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1, laps_per_driver=1)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-data")
        data = resp.json()

        lap = data["laps"][0]
        assert lap["sector1_ms"] is not None
        assert lap["sector2_ms"] is not None
        assert lap["sector3_ms"] is not None
        # Sector 1 ~ 28s = 28000ms
        assert 27000 < lap["sector1_ms"] < 30000

    def test_pit_stop_flags(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1, laps_per_driver=5)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-data")
        data = resp.json()

        # Filter laps for the single driver
        laps = data["laps"]
        # Lap 2 has PitInTime set
        lap2 = next(l for l in laps if l["lap_number"] == 2)
        assert lap2["is_pit_in_lap"] is True
        assert lap2["is_pit_out_lap"] is False

        # Lap 3 has PitOutTime set
        lap3 = next(l for l in laps if l["lap_number"] == 3)
        assert lap3["is_pit_out_lap"] is True
        assert lap3["is_pit_in_lap"] is False

        # Lap 1 has neither
        lap1 = next(l for l in laps if l["lap_number"] == 1)
        assert lap1["is_pit_in_lap"] is False
        assert lap1["is_pit_out_lap"] is False

    def test_tyre_compound_info(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1, laps_per_driver=5)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-data")
        data = resp.json()

        laps = data["laps"]
        lap1 = next(l for l in laps if l["lap_number"] == 1)
        assert lap1["compound"] == "SOFT"
        assert lap1["tyre_life"] == 1

        lap4 = next(l for l in laps if l["lap_number"] == 4)
        assert lap4["compound"] == "MEDIUM"

    def test_elapsed_time_present(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1, laps_per_driver=2)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-data")
        data = resp.json()

        for lap in data["laps"]:
            assert lap["elapsed_ms"] is not None
            assert lap["elapsed_ms"] > 0

    def test_position_data(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=3, laps_per_driver=2)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-data")
        data = resp.json()

        # Check that positions 1, 2, 3 are present
        positions = {l["position"] for l in data["laps"]}
        assert {1, 2, 3} == positions

    def test_empty_laps_returns_empty_list(self):
        """Session with no laps should return empty laps list."""
        session = _make_mock_session(num_drivers=1, laps_per_driver=0)
        session.laps = pd.DataFrame()
        session.total_laps = 0
        _loaded_sessions[_TEST_KEY] = session

        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-data")
        assert resp.status_code == 200
        data = resp.json()
        assert data["laps"] == []
        assert data["total_laps"] == 0

    def test_total_laps_from_data_when_attr_missing(self):
        """total_laps should be derived from lap data if attribute is unavailable."""
        session = _make_mock_session(num_drivers=1, laps_per_driver=10)
        session.total_laps = None
        _loaded_sessions[_TEST_KEY] = session

        resp = client.get(f"/api/sessions/{_TEST_KEY}/lap-data")
        data = resp.json()
        assert data["total_laps"] == 10
