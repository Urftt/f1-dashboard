"""Tests for serialize_sectors and the GET /sessions/sectors endpoint."""

from unittest.mock import MagicMock

import pandas as pd
import pytest

from services.fastf1_service import serialize_sectors


def _make_laps_df(rows: list[dict]) -> pd.DataFrame:
    """Build a laps DataFrame from a list of row dicts."""
    return pd.DataFrame(rows)


class TestSerializeSectors:
    """Tests for serialize_sectors()."""

    def test_normal_rows_return_float_seconds(self):
        """Sector times are converted from Timedelta to float seconds."""
        laps = _make_laps_df([
            {
                "LapNumber": 1,
                "Driver": "VER",
                "Sector1Time": pd.Timedelta(seconds=28.5),
                "Sector2Time": pd.Timedelta(seconds=33.2),
                "Sector3Time": pd.Timedelta(seconds=26.1),
            },
        ])
        session = MagicMock()
        session.laps = laps

        result = serialize_sectors(session)

        assert len(result) == 1
        assert result[0]["driver"] == "VER"
        assert result[0]["lapNumber"] == 1
        assert result[0]["s1"] == pytest.approx(28.5)
        assert result[0]["s2"] == pytest.approx(33.2)
        assert result[0]["s3"] == pytest.approx(26.1)

    def test_nat_sector_times_return_none(self):
        """NaT sector times are serialized as None."""
        laps = _make_laps_df([
            {
                "LapNumber": 2,
                "Driver": "HAM",
                "Sector1Time": pd.NaT,
                "Sector2Time": pd.Timedelta(seconds=34.0),
                "Sector3Time": pd.NaT,
            },
        ])
        session = MagicMock()
        session.laps = laps

        result = serialize_sectors(session)

        assert len(result) == 1
        assert result[0]["s1"] is None
        assert result[0]["s2"] == pytest.approx(34.0)
        assert result[0]["s3"] is None

    def test_none_lap_number_skipped(self):
        """Rows with None LapNumber are skipped."""
        laps = _make_laps_df([
            {
                "LapNumber": None,
                "Driver": "LEC",
                "Sector1Time": pd.Timedelta(seconds=28.0),
                "Sector2Time": pd.Timedelta(seconds=33.0),
                "Sector3Time": pd.Timedelta(seconds=26.0),
            },
        ])
        session = MagicMock()
        session.laps = laps

        result = serialize_sectors(session)
        assert len(result) == 0

    def test_nan_lap_number_skipped(self):
        """Rows with NaN LapNumber are skipped."""
        laps = _make_laps_df([
            {
                "LapNumber": float("nan"),
                "Driver": "NOR",
                "Sector1Time": pd.Timedelta(seconds=29.0),
                "Sector2Time": pd.Timedelta(seconds=34.0),
                "Sector3Time": pd.Timedelta(seconds=27.0),
            },
        ])
        session = MagicMock()
        session.laps = laps

        result = serialize_sectors(session)
        assert len(result) == 0

    def test_none_driver_skipped(self):
        """Rows with None Driver are skipped."""
        laps = _make_laps_df([
            {
                "LapNumber": 3,
                "Driver": None,
                "Sector1Time": pd.Timedelta(seconds=28.0),
                "Sector2Time": pd.Timedelta(seconds=33.0),
                "Sector3Time": pd.Timedelta(seconds=26.0),
            },
        ])
        session = MagicMock()
        session.laps = laps

        result = serialize_sectors(session)
        assert len(result) == 0

    def test_multiple_drivers_multiple_laps(self):
        """Multiple rows for different drivers and laps are all returned."""
        laps = _make_laps_df([
            {
                "LapNumber": 1,
                "Driver": "VER",
                "Sector1Time": pd.Timedelta(seconds=28.5),
                "Sector2Time": pd.Timedelta(seconds=33.2),
                "Sector3Time": pd.Timedelta(seconds=26.1),
            },
            {
                "LapNumber": 1,
                "Driver": "HAM",
                "Sector1Time": pd.Timedelta(seconds=29.0),
                "Sector2Time": pd.Timedelta(seconds=34.0),
                "Sector3Time": pd.Timedelta(seconds=27.0),
            },
            {
                "LapNumber": 2,
                "Driver": "VER",
                "Sector1Time": pd.Timedelta(seconds=28.3),
                "Sector2Time": pd.Timedelta(seconds=33.0),
                "Sector3Time": pd.Timedelta(seconds=25.9),
            },
        ])
        session = MagicMock()
        session.laps = laps

        result = serialize_sectors(session)

        assert len(result) == 3
        drivers = [r["driver"] for r in result]
        assert "VER" in drivers
        assert "HAM" in drivers

    def test_output_types_are_primitives(self):
        """All output values are Python primitives (no pandas/numpy types)."""
        laps = _make_laps_df([
            {
                "LapNumber": 1,
                "Driver": "VER",
                "Sector1Time": pd.Timedelta(seconds=28.5),
                "Sector2Time": pd.NaT,
                "Sector3Time": pd.Timedelta(seconds=26.1),
            },
        ])
        session = MagicMock()
        session.laps = laps

        result = serialize_sectors(session)

        for row in result:
            assert isinstance(row["driver"], str)
            assert isinstance(row["lapNumber"], int)
            for key in ("s1", "s2", "s3"):
                assert row[key] is None or isinstance(row[key], float)
