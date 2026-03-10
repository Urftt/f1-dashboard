"""Tests for the standings board API endpoint.

Exercises:
    GET /api/sessions/{session_key}/standings?lap=N
"""

from unittest.mock import MagicMock

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api import app, _loaded_sessions

client = TestClient(app)

# Unique key for test sessions
_TEST_KEY = "2024::Bahrain Grand Prix::Race"


def _make_mock_session(num_drivers: int = 3, laps_per_driver: int = 5):
    """Create a mock FastF1 session with realistic lap data for standings tests."""
    session = MagicMock()

    # Drivers list
    driver_nums = [str(i + 1) for i in range(num_drivers)]
    session.drivers = driver_nums

    # Driver info lookup
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
                "TyreLife": lap if lap <= 2 else lap - 2,
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
# GET /api/sessions/{session_key}/standings?lap=N
# ---------------------------------------------------------------------------


class TestStandingsEndpoint:
    """Tests for the standings board endpoint."""

    def test_returns_404_when_session_not_loaded(self):
        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=1")
        assert resp.status_code == 404

    def test_returns_standings_for_valid_lap(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=3")
        assert resp.status_code == 200
        data = resp.json()

        assert data["session_key"] == _TEST_KEY
        assert data["year"] == 2024
        assert data["event_name"] == "Bahrain Grand Prix"
        assert data["session_type"] == "Race"
        assert data["lap_number"] == 3
        assert data["total_laps"] == 5
        assert len(data["standings"]) == 3

    def test_requires_lap_parameter(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings")
        assert resp.status_code == 422  # missing required query param

    def test_lap_must_be_positive(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=0")
        assert resp.status_code == 422  # ge=1 validation

    def test_returns_empty_standings_for_nonexistent_lap(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(laps_per_driver=5)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=99")
        assert resp.status_code == 200
        data = resp.json()
        assert data["standings"] == []


class TestStandingsEntryFields:
    """Tests for individual standings entry fields."""

    def test_all_required_fields_present(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1, laps_per_driver=1)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=1")
        data = resp.json()

        assert len(data["standings"]) == 1
        entry = data["standings"][0]
        expected_fields = [
            "position", "driver", "driver_number", "full_name",
            "team", "team_color", "gap_to_leader", "interval",
            "last_lap_time", "tire_compound", "tire_age",
            "pit_stops", "has_fastest_lap",
        ]
        for field in expected_fields:
            assert field in entry, f"Missing field: {field}"

    def test_driver_metadata_correct(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1, laps_per_driver=1)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=1")
        entry = resp.json()["standings"][0]

        assert entry["driver"] == "VER"
        assert entry["driver_number"] == "1"
        assert entry["full_name"] == "Max Verstappen"
        assert entry["team"] == "Red Bull Racing"
        assert entry["team_color"] == "3671C6"

    def test_position_values(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=3, laps_per_driver=3)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=3")
        data = resp.json()

        positions = [e["position"] for e in data["standings"]]
        assert positions == [1, 2, 3]

    def test_positions_sorted_correctly(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=5, laps_per_driver=3)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=3")
        data = resp.json()

        positions = [e["position"] for e in data["standings"]]
        assert positions == sorted(positions)


class TestGapAndInterval:
    """Tests for gap to leader and interval calculations."""

    def test_leader_gap_is_labelled(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=3, laps_per_driver=3)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=3")
        data = resp.json()

        leader = data["standings"][0]
        assert leader["gap_to_leader"] == "LEADER"
        assert leader["interval"] == ""

    def test_non_leader_has_positive_gap(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=3, laps_per_driver=3)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=3")
        data = resp.json()

        for entry in data["standings"][1:]:
            assert entry["gap_to_leader"].startswith("+")
            assert entry["gap_to_leader"].endswith("s")

    def test_interval_has_positive_value(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=3, laps_per_driver=3)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=3")
        data = resp.json()

        for entry in data["standings"][1:]:
            assert entry["interval"].startswith("+")
            assert entry["interval"].endswith("s")

    def test_gap_values_increase_down_standings(self):
        """Gap to leader should increase for lower positions."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=3, laps_per_driver=3)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=3")
        data = resp.json()

        gaps = []
        for entry in data["standings"]:
            if entry["gap_to_leader"] == "LEADER":
                gaps.append(0.0)
            else:
                gaps.append(float(entry["gap_to_leader"].strip("+s")))

        # Each subsequent gap should be >= previous
        for i in range(1, len(gaps)):
            assert gaps[i] >= gaps[i - 1]


class TestLapTimeFormatting:
    """Tests for last lap time formatting."""

    def test_lap_time_format(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1, laps_per_driver=1)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=1")
        entry = resp.json()["standings"][0]

        # Lap time should be in M:SS.mmm format
        assert entry["last_lap_time"] != ""
        parts = entry["last_lap_time"].split(":")
        assert len(parts) == 2
        assert "." in parts[1]  # has milliseconds


class TestTireInfo:
    """Tests for tire compound and age."""

    def test_tire_compound_present(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1, laps_per_driver=1)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=1")
        entry = resp.json()["standings"][0]

        assert entry["tire_compound"] == "SOFT"

    def test_tire_compound_changes_after_pit(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1, laps_per_driver=5)
        # Lap 1-2 = SOFT, Lap 3+ = MEDIUM (based on mock)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=4")
        entry = resp.json()["standings"][0]

        assert entry["tire_compound"] == "MEDIUM"

    def test_tire_age_is_integer(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1, laps_per_driver=3)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=3")
        entry = resp.json()["standings"][0]

        assert isinstance(entry["tire_age"], int)
        assert entry["tire_age"] >= 0


class TestPitStops:
    """Tests for pit stop counting."""

    def test_pit_stops_counted_correctly(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1, laps_per_driver=5)
        # Driver has PitInTime on lap 2
        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=5")
        entry = resp.json()["standings"][0]

        assert entry["pit_stops"] == 1

    def test_no_pit_stops_at_early_lap(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1, laps_per_driver=5)
        # Before lap 2 PitInTime, no pits
        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=1")
        entry = resp.json()["standings"][0]

        assert entry["pit_stops"] == 0

    def test_pit_stops_accumulate(self):
        """Pit stops at lap N should include only pits up to lap N."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1, laps_per_driver=5)
        # PitInTime is on lap 2 in the mock
        resp_before = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=1")
        resp_after = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=3")

        before = resp_before.json()["standings"][0]["pit_stops"]
        after = resp_after.json()["standings"][0]["pit_stops"]

        assert before == 0
        assert after == 1


class TestFastestLap:
    """Tests for fastest lap indicator."""

    def test_exactly_one_driver_has_fastest_lap(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=3, laps_per_driver=5)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=5")
        data = resp.json()

        fastest_count = sum(1 for e in data["standings"] if e["has_fastest_lap"])
        assert fastest_count == 1

    def test_fastest_lap_driver_is_correct(self):
        """The driver with the shortest LapTime should have the fastest lap."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=3, laps_per_driver=5)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=5")
        data = resp.json()

        # In the mock, VER (d_idx=0) has the shortest lap times
        fastest_entry = next(e for e in data["standings"] if e["has_fastest_lap"])
        assert fastest_entry["driver"] == "VER"


class TestEmptyAndEdgeCases:
    """Tests for edge cases."""

    def test_empty_laps_returns_empty_standings(self):
        session = _make_mock_session(num_drivers=1, laps_per_driver=0)
        session.laps = pd.DataFrame()
        session.total_laps = 0
        _loaded_sessions[_TEST_KEY] = session

        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["standings"] == []

    def test_single_driver_standings(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=1, laps_per_driver=3)
        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=3")
        data = resp.json()

        assert len(data["standings"]) == 1
        entry = data["standings"][0]
        assert entry["position"] == 1
        assert entry["gap_to_leader"] == "LEADER"
        assert entry["interval"] == ""

    def test_multiple_laps_return_correct_lap_data(self):
        """Querying different laps should return data for the requested lap."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=2, laps_per_driver=5)

        resp1 = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=1")
        resp3 = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=3")

        data1 = resp1.json()
        data3 = resp3.json()

        assert data1["lap_number"] == 1
        assert data3["lap_number"] == 3

        # Tire compounds differ: lap 1 = SOFT, lap 3 = MEDIUM
        assert data1["standings"][0]["tire_compound"] == "SOFT"
        assert data3["standings"][0]["tire_compound"] == "MEDIUM"

    def test_total_laps_derived_from_data_when_attr_none(self):
        session = _make_mock_session(num_drivers=1, laps_per_driver=10)
        session.total_laps = None
        _loaded_sessions[_TEST_KEY] = session

        resp = client.get(f"/api/sessions/{_TEST_KEY}/standings?lap=5")
        data = resp.json()
        assert data["total_laps"] == 10
