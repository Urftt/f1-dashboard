"""Tests for the gap-chart API endpoint.

Exercises:
    GET /api/sessions/{session_key}/gap-chart?driver1=...&driver2=...
"""

from unittest.mock import MagicMock

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api import app, _loaded_sessions

client = TestClient(app)

_TEST_KEY = "2024::Bahrain Grand Prix::Race"


def _make_mock_session(num_drivers: int = 3, laps_per_driver: int = 10):
    """Create a mock FastF1 session with realistic lap data for gap testing.

    Driver ordering:
        VER (driver 1) is the fastest, HAM (driver 2) is ~0.5s slower per lap,
        LEC (driver 3) is ~1.0s slower per lap.  The cumulative gap grows
        linearly with laps.
    """
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
            # Each driver's lap time differs by ~0.5s per driver index
            lap_time = pd.Timedelta(seconds=90 + d_idx * 0.5)
            # Cumulative elapsed time grows with lap and driver gap
            elapsed = pd.Timedelta(seconds=lap * 90 + lap * d_idx * 0.5)
            rows.append({
                "Driver": driver_abbrs[d_idx],
                "DriverNumber": driver_nums[d_idx],
                "LapNumber": lap,
                "LapTime": lap_time,
                "Position": d_idx + 1,
                "Time": elapsed,
                "Compound": "SOFT" if lap <= 3 else "MEDIUM",
                "TyreLife": lap,
                "PitOutTime": pd.Timedelta(seconds=20) if lap == 4 else pd.NaT,
                "PitInTime": pd.Timedelta(seconds=85) if lap == 3 else pd.NaT,
            })

    session.laps = pd.DataFrame(rows)
    session.total_laps = laps_per_driver

    event_mock = MagicMock()
    event_mock.__getitem__ = lambda self, key: "Bahrain Grand Prix" if key == "EventName" else None
    session.event = event_mock

    return session


@pytest.fixture(autouse=True)
def _cleanup_sessions():
    """Remove test session after each test."""
    yield
    _loaded_sessions.pop(_TEST_KEY, None)


# ---------------------------------------------------------------------------
# GET /api/sessions/{session_key}/gap-chart
# ---------------------------------------------------------------------------


class TestGetGapChart:
    """Tests for the two-driver gap chart endpoint."""

    def test_returns_404_when_session_not_loaded(self):
        resp = client.get(
            f"/api/sessions/{_TEST_KEY}/gap-chart",
            params={"driver1": "VER", "driver2": "HAM"},
        )
        assert resp.status_code == 404

    def test_returns_gap_data_for_two_drivers(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.get(
            f"/api/sessions/{_TEST_KEY}/gap-chart",
            params={"driver1": "VER", "driver2": "HAM"},
        )
        assert resp.status_code == 200
        data = resp.json()

        assert data["session_key"] == _TEST_KEY
        assert data["driver1"] == "VER"
        assert data["driver2"] == "HAM"
        assert len(data["points"]) > 0

    def test_gap_sign_convention(self):
        """Positive gap means driver1 is ahead (crossed line first)."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.get(
            f"/api/sessions/{_TEST_KEY}/gap-chart",
            params={"driver1": "VER", "driver2": "HAM"},
        )
        data = resp.json()

        # VER is faster, so all gaps should be positive (VER ahead)
        for point in data["points"]:
            assert point["gap_seconds"] > 0, (
                f"Expected positive gap at lap {point['lap_number']}, "
                f"got {point['gap_seconds']}"
            )

    def test_gap_grows_cumulatively(self):
        """Gap should increase over laps since VER is consistently faster."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session(laps_per_driver=10)
        resp = client.get(
            f"/api/sessions/{_TEST_KEY}/gap-chart",
            params={"driver1": "VER", "driver2": "HAM"},
        )
        data = resp.json()
        points = data["points"]

        # Gap should be monotonically increasing
        for i in range(1, len(points)):
            assert points[i]["gap_seconds"] >= points[i - 1]["gap_seconds"], (
                f"Gap should increase: lap {points[i]['lap_number']} "
                f"({points[i]['gap_seconds']}) < lap {points[i-1]['lap_number']} "
                f"({points[i-1]['gap_seconds']})"
            )

    def test_max_lap_parameter(self):
        """max_lap should limit the data returned."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session(laps_per_driver=10)
        resp = client.get(
            f"/api/sessions/{_TEST_KEY}/gap-chart",
            params={"driver1": "VER", "driver2": "HAM", "max_lap": 5},
        )
        data = resp.json()
        points = data["points"]

        assert len(points) > 0
        assert all(p["lap_number"] <= 5 for p in points)

    def test_driver_colors_returned(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.get(
            f"/api/sessions/{_TEST_KEY}/gap-chart",
            params={"driver1": "VER", "driver2": "HAM"},
        )
        data = resp.json()

        assert data["driver1_color"] == "3671C6"
        assert data["driver2_color"] == "6CD3BF"

    def test_driver_names_returned(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.get(
            f"/api/sessions/{_TEST_KEY}/gap-chart",
            params={"driver1": "VER", "driver2": "HAM"},
        )
        data = resp.json()

        assert data["driver1_name"] == "Max Verstappen"
        assert data["driver2_name"] == "Lewis Hamilton"

    def test_total_laps_in_response(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session(laps_per_driver=10)
        resp = client.get(
            f"/api/sessions/{_TEST_KEY}/gap-chart",
            params={"driver1": "VER", "driver2": "HAM"},
        )
        data = resp.json()
        assert data["total_laps"] == 10

    def test_gap_data_point_fields(self):
        """Each point should have all expected fields."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.get(
            f"/api/sessions/{_TEST_KEY}/gap-chart",
            params={"driver1": "VER", "driver2": "HAM"},
        )
        data = resp.json()
        point = data["points"][0]

        expected_fields = [
            "lap_number", "gap_seconds",
            "driver1_position", "driver2_position",
            "driver1_lap_time_s", "driver2_lap_time_s",
            "gap_change", "is_pit_lap_d1", "is_pit_lap_d2",
        ]
        for field in expected_fields:
            assert field in point, f"Missing field: {field}"

    def test_positions_in_points(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.get(
            f"/api/sessions/{_TEST_KEY}/gap-chart",
            params={"driver1": "VER", "driver2": "HAM"},
        )
        data = resp.json()

        for point in data["points"]:
            assert point["driver1_position"] == 1  # VER is P1
            assert point["driver2_position"] == 2  # HAM is P2

    def test_lap_times_in_seconds(self):
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.get(
            f"/api/sessions/{_TEST_KEY}/gap-chart",
            params={"driver1": "VER", "driver2": "HAM"},
        )
        data = resp.json()

        for point in data["points"]:
            if point["driver1_lap_time_s"] is not None:
                assert 85 < point["driver1_lap_time_s"] < 95
            if point["driver2_lap_time_s"] is not None:
                assert 85 < point["driver2_lap_time_s"] < 95

    def test_gap_change_first_lap_is_none(self):
        """First data point should have gap_change=None (no previous lap)."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.get(
            f"/api/sessions/{_TEST_KEY}/gap-chart",
            params={"driver1": "VER", "driver2": "HAM"},
        )
        data = resp.json()
        assert data["points"][0]["gap_change"] is None

    def test_same_driver_returns_422(self):
        """Requesting the same driver for both should return 422."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.get(
            f"/api/sessions/{_TEST_KEY}/gap-chart",
            params={"driver1": "VER", "driver2": "VER"},
        )
        assert resp.status_code == 422

    def test_unknown_driver_returns_404(self):
        """Unknown driver abbreviation should return 404."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.get(
            f"/api/sessions/{_TEST_KEY}/gap-chart",
            params={"driver1": "VER", "driver2": "XXX"},
        )
        assert resp.status_code == 404

    def test_unknown_driver_error_lists_available(self):
        """Error message should include available drivers."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.get(
            f"/api/sessions/{_TEST_KEY}/gap-chart",
            params={"driver1": "VER", "driver2": "XXX"},
        )
        detail = resp.json()["detail"]
        assert "XXX" in detail
        assert "VER" in detail  # available drivers listed

    def test_empty_laps_returns_422(self):
        """Session with no lap data should return 422."""
        session = _make_mock_session()
        session.laps = pd.DataFrame()
        _loaded_sessions[_TEST_KEY] = session

        resp = client.get(
            f"/api/sessions/{_TEST_KEY}/gap-chart",
            params={"driver1": "VER", "driver2": "HAM"},
        )
        assert resp.status_code == 422

    def test_reversed_drivers_negates_gap(self):
        """Swapping driver1 and driver2 should negate the gap values."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session()

        resp1 = client.get(
            f"/api/sessions/{_TEST_KEY}/gap-chart",
            params={"driver1": "VER", "driver2": "HAM"},
        )
        resp2 = client.get(
            f"/api/sessions/{_TEST_KEY}/gap-chart",
            params={"driver1": "HAM", "driver2": "VER"},
        )
        data1 = resp1.json()
        data2 = resp2.json()

        for p1, p2 in zip(data1["points"], data2["points"]):
            assert p1["lap_number"] == p2["lap_number"]
            # Gaps should be equal in magnitude but opposite in sign
            assert abs(p1["gap_seconds"] + p2["gap_seconds"]) < 0.01

    def test_missing_driver1_param_returns_422(self):
        """Missing required query param should return 422."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session()
        resp = client.get(
            f"/api/sessions/{_TEST_KEY}/gap-chart",
            params={"driver2": "HAM"},
        )
        assert resp.status_code == 422

    def test_three_drivers_any_pair(self):
        """Should work for any pair of drivers, not just the top two."""
        _loaded_sessions[_TEST_KEY] = _make_mock_session(num_drivers=3)
        resp = client.get(
            f"/api/sessions/{_TEST_KEY}/gap-chart",
            params={"driver1": "VER", "driver2": "LEC"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["points"]) > 0
        # LEC is slower than HAM, so gap VER-LEC should be bigger than VER-HAM
        resp2 = client.get(
            f"/api/sessions/{_TEST_KEY}/gap-chart",
            params={"driver1": "VER", "driver2": "HAM"},
        )
        data2 = resp2.json()
        # Compare last point gaps
        gap_lec = data["points"][-1]["gap_seconds"]
        gap_ham = data2["points"][-1]["gap_seconds"]
        assert gap_lec > gap_ham
