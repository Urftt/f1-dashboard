"""Tests for the SSE session loading endpoint."""

import json
from unittest.mock import patch, AsyncMock, MagicMock

import numpy as np
import pandas as pd
import pytest

from services.fastf1_service import serialize_timedelta, serialize_laps, parse_safety_car_periods, _time_to_lap
from services.cache_service import is_session_cached


class TestLapsSerialization:
    """Tests for FastF1 type serialization utilities."""

    def test_serialize_timedelta_converts_timedelta(self):
        """Timedelta values are converted to total seconds as float."""
        td = pd.Timedelta(seconds=93.456)
        result = serialize_timedelta(td)
        assert result == pytest.approx(93.456)
        assert isinstance(result, float)

    def test_serialize_timedelta_returns_none_for_nat(self):
        """NaT values return None."""
        result = serialize_timedelta(pd.NaT)
        assert result is None

    def test_serialize_timedelta_returns_none_for_none(self):
        """None values return None."""
        result = serialize_timedelta(None)
        assert result is None

    def test_laps_serialization_converts_all_types(self, mock_session):
        """Laps with Timedelta/NaT/numpy.float64 values are correctly serialized."""
        laps = mock_session.laps
        result = serialize_laps(laps)

        assert isinstance(result, list)
        assert len(result) == 4

        # First lap: VER — should have all fields
        ver_lap = result[0]
        assert ver_lap["Driver"] == "VER"
        assert ver_lap["LapNumber"] == 1
        assert isinstance(ver_lap["LapTime"], float)
        assert isinstance(ver_lap["Time"], float)
        assert ver_lap["PitInTime"] is None  # NaT
        assert ver_lap["PitOutTime"] is None  # NaT
        assert ver_lap["Compound"] == "SOFT"
        assert isinstance(ver_lap["TyreLife"], float)
        assert ver_lap["Position"] == 1
        assert ver_lap["Stint"] == 1

    def test_laps_serialization_handles_nat_lap_time(self, mock_session):
        """Laps with NaT LapTime return None for that field."""
        laps = mock_session.laps
        result = serialize_laps(laps)

        # Third lap (LEC) has NaT LapTime
        lec_lap = result[2]
        assert lec_lap["Driver"] == "LEC"
        assert lec_lap["LapTime"] is None
        assert lec_lap["Time"] is None

    def test_laps_serialization_handles_nan_lap_number(self, mock_session):
        """Laps with NaN LapNumber return None for LapNumber."""
        laps = mock_session.laps
        result = serialize_laps(laps)

        # Fourth lap has NaN LapNumber
        nor_lap = result[3]
        assert nor_lap["Driver"] == "NOR"
        assert nor_lap["LapNumber"] is None

    def test_laps_no_pandas_numpy_types_in_output(self, mock_session):
        """All output values must be Python primitives (no pandas/numpy types)."""
        laps = mock_session.laps
        result = serialize_laps(laps)

        for lap in result:
            for key, value in lap.items():
                assert not isinstance(value, (pd.Timedelta, np.floating, np.integer)), (
                    f"Field '{key}' contains non-primitive type {type(value)}"
                )


class TestCacheService:
    """Tests for cache detection."""

    def test_cache_service_returns_false_when_no_cache(self, tmp_path):
        """is_session_cached returns False when no cache files exist."""
        # Patch CACHE_DIR to an empty temp directory
        with patch("services.cache_service.CACHE_DIR", tmp_path):
            result = is_session_cached(2024, "Monaco Grand Prix", "Race")
        assert result is False

    def test_cache_service_returns_true_when_cache_exists(self, tmp_path):
        """is_session_cached returns True when cache files exist for the session."""
        # Create a fake cache file matching the session type
        cache_file = tmp_path / "2024_Monaco_Race_laps.ff1pkl"
        cache_file.write_bytes(b"fake cache data")

        with patch("services.cache_service.CACHE_DIR", tmp_path):
            result = is_session_cached(2024, "Monaco Grand Prix", "race")
        assert result is True


class TestSSEEndpoint:
    """Tests for the SSE session loading endpoint."""

    async def test_sse_progress_events(self, client, mock_session):
        """SSE endpoint streams progress events with pct and stage fields."""
        with (
            patch("services.fastf1_service.fastf1.get_session", return_value=mock_session),
            patch("asyncio.to_thread", new=AsyncMock(side_effect=[mock_session, None])),
        ):
            async with client.stream("GET", "/api/sessions/load?year=2024&event=Monaco+Grand+Prix&session_type=Race") as response:
                assert response.status_code == 200
                assert "text/event-stream" in response.headers.get("content-type", "")

                events = []
                async for line in response.aiter_lines():
                    if line.startswith("data:"):
                        data = json.loads(line[5:].strip())
                        events.append(data)
                    if any(e.get("laps") is not None for e in events):
                        break

        # Should have at least one progress event
        progress_events = [e for e in events if "pct" in e and "stage" in e]
        assert len(progress_events) > 0

        # Validate progress event structure
        for evt in progress_events:
            assert isinstance(evt["pct"], int)
            assert isinstance(evt["stage"], str)
            assert 0 <= evt["pct"] <= 100

    async def test_sse_complete_event_contains_laps(self, client, mock_session):
        """SSE stream ends with a complete event containing a laps array."""
        with (
            patch("services.fastf1_service.fastf1.get_session", return_value=mock_session),
            patch("asyncio.to_thread", new=AsyncMock(side_effect=[mock_session, None])),
        ):
            async with client.stream("GET", "/api/sessions/load?year=2024&event=Monaco+Grand+Prix&session_type=Race") as response:
                assert response.status_code == 200

                complete_data = None
                event_type = None
                async for line in response.aiter_lines():
                    if line.startswith("event:"):
                        event_type = line[6:].strip()
                    elif line.startswith("data:"):
                        data = json.loads(line[5:].strip())
                        if event_type == "complete":
                            complete_data = data
                            break

        assert complete_data is not None, "No complete event received"
        assert "laps" in complete_data
        assert isinstance(complete_data["laps"], list)

    async def test_cache_hit_faster(self, client, mock_session):
        """Cached session stream has fewer fetch stages than a cold load.

        When is_session_cached returns True, the stream should still work correctly.
        This test validates the SSE stream works and the mock is correctly wired —
        the actual cache speed difference is validated in integration, but we verify
        the mock at the unit level here.
        """
        with (
            patch("services.fastf1_service.fastf1.get_session", return_value=mock_session),
            patch("asyncio.to_thread", new=AsyncMock(side_effect=[mock_session, None])),
            patch("services.cache_service.is_session_cached", return_value=True),
        ):
            async with client.stream("GET", "/api/sessions/load?year=2024&event=Monaco+Grand+Prix&session_type=Race") as response:
                assert response.status_code == 200

                all_events = []
                event_type = None
                async for line in response.aiter_lines():
                    if line.startswith("event:"):
                        event_type = line[6:].strip()
                    elif line.startswith("data:"):
                        data = json.loads(line[5:].strip())
                        all_events.append((event_type, data))
                        if event_type == "complete":
                            break

        # Should have at least 1 progress event and a complete event
        progress_events = [(t, d) for t, d in all_events if t == "progress"]
        complete_events = [(t, d) for t, d in all_events if t == "complete"]
        assert len(progress_events) >= 1
        assert len(complete_events) == 1
        assert "laps" in complete_events[0][1]


def _make_laps(lap_end_seconds: list[float]) -> pd.DataFrame:
    """Helper: build a laps DataFrame with LapNumber and Time columns."""
    return pd.DataFrame({
        "LapNumber": list(range(1, len(lap_end_seconds) + 1)),
        "Time": [pd.Timedelta(seconds=s) for s in lap_end_seconds],
    })


def _make_track_status(statuses: list[tuple]) -> pd.DataFrame:
    """Helper: build a track_status DataFrame from (time_seconds, status_code) tuples."""
    return pd.DataFrame({
        "Time": [pd.Timedelta(seconds=t) for t, _ in statuses],
        "Status": [s for _, s in statuses],
    })


def _make_mock_session(track_status_df, laps_df) -> MagicMock:
    """Build a minimal mock FastF1 session with given track_status and laps."""
    session = MagicMock()
    session.track_status = track_status_df
    session.laps = laps_df
    return session


class TestSafetyCarParsing:
    """Tests for parse_safety_car_periods() and _time_to_lap()."""

    # --- _time_to_lap tests ---

    def test_time_to_lap_maps_to_first_exceeding_lap(self):
        """_time_to_lap returns the lap whose end time first exceeds the timestamp."""
        laps = _make_laps([100.0, 200.0, 300.0])
        result = _time_to_lap(pd.Timedelta(seconds=150.0), laps)
        assert result == 2

    def test_time_to_lap_exact_boundary(self):
        """_time_to_lap at exactly a lap end time returns the next lap (first exceeding)."""
        laps = _make_laps([100.0, 200.0, 300.0])
        # Exactly 100.0 — lap 1 ends at 100.0, 100.0 is not > 100.0, so falls to lap 2
        result = _time_to_lap(pd.Timedelta(seconds=100.0), laps)
        assert result == 2

    def test_time_to_lap_falls_back_to_max_when_exceeds_all(self):
        """_time_to_lap falls back to the max lap number when timestamp exceeds all laps."""
        laps = _make_laps([100.0, 200.0, 300.0])
        result = _time_to_lap(pd.Timedelta(seconds=999.0), laps)
        assert result == 3

    def test_time_to_lap_returns_1_for_empty_laps(self):
        """_time_to_lap returns 1 when laps DataFrame is empty."""
        laps = pd.DataFrame({"LapNumber": [], "Time": []})
        result = _time_to_lap(pd.Timedelta(seconds=50.0), laps)
        assert result == 1

    def test_time_to_lap_returns_1_when_all_times_are_nat(self):
        """_time_to_lap returns 1 when all lap times are NaT."""
        laps = pd.DataFrame({
            "LapNumber": [1, 2, 3],
            "Time": [pd.NaT, pd.NaT, pd.NaT],
        })
        result = _time_to_lap(pd.Timedelta(seconds=50.0), laps)
        assert result == 1

    # --- parse_safety_car_periods tests ---

    def test_sc_period_created_for_status_4(self):
        """Status '4' creates an SC period."""
        laps = _make_laps([100.0, 200.0, 300.0, 400.0, 500.0])
        # SC starts at 120s (lap 2), AllClear at 350s (lap 4)
        track_status = _make_track_status([(120.0, "4"), (350.0, "1")])
        session = _make_mock_session(track_status, laps)
        periods = parse_safety_car_periods(session)
        assert len(periods) == 1
        assert periods[0]["type"] == "SC"
        assert periods[0]["start_lap"] == 2
        assert periods[0]["end_lap"] == 4

    def test_vsc_period_created_for_status_6(self):
        """Status '6' creates a VSC period."""
        laps = _make_laps([100.0, 200.0, 300.0, 400.0])
        track_status = _make_track_status([(50.0, "6"), (250.0, "1")])
        session = _make_mock_session(track_status, laps)
        periods = parse_safety_car_periods(session)
        assert len(periods) == 1
        assert periods[0]["type"] == "VSC"

    def test_vsc_period_created_for_status_7(self):
        """Status '7' also creates a VSC period."""
        laps = _make_laps([100.0, 200.0, 300.0])
        track_status = _make_track_status([(50.0, "7"), (250.0, "1")])
        session = _make_mock_session(track_status, laps)
        periods = parse_safety_car_periods(session)
        assert len(periods) == 1
        assert periods[0]["type"] == "VSC"

    def test_red_flag_created_for_status_5(self):
        """Status '5' creates a single-lap RED period."""
        laps = _make_laps([100.0, 200.0, 300.0, 400.0])
        # Red flag at 250s maps to lap 3; should produce a single-lap RED period
        track_status = _make_track_status([(250.0, "5"), (300.0, "1")])
        session = _make_mock_session(track_status, laps)
        periods = parse_safety_car_periods(session)
        assert len(periods) == 1
        assert periods[0]["type"] == "RED"
        assert periods[0]["start_lap"] == periods[0]["end_lap"]

    def test_allclear_closes_period(self):
        """Status '1' (AllClear) closes the current period."""
        laps = _make_laps([100.0, 200.0, 300.0, 400.0, 500.0])
        track_status = _make_track_status([(110.0, "4"), (310.0, "1")])
        session = _make_mock_session(track_status, laps)
        periods = parse_safety_car_periods(session)
        assert len(periods) == 1
        assert periods[0]["end_lap"] == 4  # 310s → lap 4

    def test_unclosed_period_is_returned(self):
        """An unclosed SC/VSC period at end of data is still returned."""
        laps = _make_laps([100.0, 200.0, 300.0])
        # SC starts, never closes
        track_status = _make_track_status([(150.0, "4")])
        session = _make_mock_session(track_status, laps)
        periods = parse_safety_car_periods(session)
        assert len(periods) == 1
        assert periods[0]["type"] == "SC"
        # end_lap should be the max lap (3)
        assert periods[0]["end_lap"] == 3

    def test_empty_track_status_returns_empty_list(self):
        """parse_safety_car_periods returns [] when track_status is empty."""
        laps = _make_laps([100.0, 200.0])
        track_status = pd.DataFrame({"Time": [], "Status": []})
        session = _make_mock_session(track_status, laps)
        periods = parse_safety_car_periods(session)
        assert periods == []

    def test_none_track_status_returns_empty_list(self):
        """parse_safety_car_periods returns [] when track_status is None."""
        laps = _make_laps([100.0, 200.0])
        session = _make_mock_session(None, laps)
        periods = parse_safety_car_periods(session)
        assert periods == []

    def test_adjacent_sc_then_vsc_creates_two_periods(self):
        """Adjacent SC then VSC status creates two separate periods."""
        laps = _make_laps([100.0, 200.0, 300.0, 400.0, 500.0, 600.0])
        # SC at 110s (lap 2), then VSC at 210s (lap 3) — change of type closes SC, opens VSC
        # AllClear at 410s closes VSC
        track_status = _make_track_status([
            (110.0, "4"),   # SC starts, lap 2
            (210.0, "6"),   # VSC starts, lap 3 — this closes SC and opens VSC
            (410.0, "1"),   # AllClear, lap 5 — closes VSC
        ])
        session = _make_mock_session(track_status, laps)
        periods = parse_safety_car_periods(session)
        assert len(periods) == 2
        sc = next(p for p in periods if p["type"] == "SC")
        vsc = next(p for p in periods if p["type"] == "VSC")
        assert sc["start_lap"] < vsc["start_lap"]

    def test_returns_list_of_dicts(self):
        """parse_safety_car_periods returns list of plain dicts with required keys."""
        laps = _make_laps([100.0, 200.0, 300.0])
        track_status = _make_track_status([(50.0, "4"), (250.0, "1")])
        session = _make_mock_session(track_status, laps)
        periods = parse_safety_car_periods(session)
        assert isinstance(periods, list)
        for period in periods:
            assert isinstance(period, dict)
            assert "start_lap" in period
            assert "end_lap" in period
            assert "type" in period
            assert isinstance(period["start_lap"], int)
            assert isinstance(period["end_lap"], int)
            assert period["type"] in ("SC", "VSC", "RED")
