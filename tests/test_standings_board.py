"""Tests for the StandingsBoard component."""

import pandas as pd
import pytest

from fastf1_service import DriverInfo


def _make_standings_df(n_drivers: int = 5) -> pd.DataFrame:
    """Create a sample standings DataFrame."""
    drivers = ["VER", "NOR", "LEC", "HAM", "PIA"][:n_drivers]
    teams = ["Red Bull", "McLaren", "Ferrari", "Mercedes", "McLaren"][:n_drivers]
    gaps = ["LEADER", "+2.345s", "+5.678s", "+8.123s", "+10.456s"][:n_drivers]
    intervals = ["", "+2.345s", "+3.333s", "+2.445s", "+2.333s"][:n_drivers]
    lap_times = ["1:32.456", "1:32.789", "1:33.012", "1:32.999", "1:33.100"][:n_drivers]

    return pd.DataFrame(
        {
            "Position": list(range(1, n_drivers + 1)),
            "Driver": drivers,
            "Team": teams,
            "GapToLeader": gaps,
            "Interval": intervals,
            "LastLapTime": lap_times,
            "LapNumber": [42] * n_drivers,
        }
    )


def _make_driver_info() -> dict[str, DriverInfo]:
    """Create sample driver info."""
    return {
        "VER": DriverInfo("VER", "1", "Max Verstappen", "Red Bull Racing", "3671C6"),
        "NOR": DriverInfo("NOR", "4", "Lando Norris", "McLaren", "FF8000"),
        "LEC": DriverInfo("LEC", "16", "Charles Leclerc", "Ferrari", "E8002D"),
        "HAM": DriverInfo("HAM", "44", "Lewis Hamilton", "Mercedes", "27F4D2"),
        "PIA": DriverInfo("PIA", "81", "Oscar Piastri", "McLaren", "FF8000"),
    }


class TestStandingsBoardData:
    """Test data preparation and validation (non-Streamlit tests)."""

    def test_standings_df_has_required_columns(self):
        df = _make_standings_df()
        required = {"Position", "Driver", "Team", "GapToLeader", "Interval", "LastLapTime"}
        assert required.issubset(set(df.columns))

    def test_standings_df_positions_are_sequential(self):
        df = _make_standings_df()
        assert list(df["Position"]) == [1, 2, 3, 4, 5]

    def test_leader_gap_is_labelled(self):
        df = _make_standings_df()
        assert df.iloc[0]["GapToLeader"] == "LEADER"

    def test_driver_info_keys_match_standings(self):
        df = _make_standings_df()
        drivers = _make_driver_info()
        for abbr in df["Driver"]:
            assert abbr in drivers

    def test_empty_standings_df(self):
        df = pd.DataFrame()
        assert df.empty

    def test_team_color_formatting(self):
        from components.standings_board import _team_color_css

        assert _team_color_css("3671C6") == "#3671C6"
        assert _team_color_css("#E8002D") == "#E8002D"
        assert _team_color_css("") == "#FFFFFF"  # fallback
        assert _team_color_css("XYZ") == "#FFFFFF"  # invalid

    def test_single_driver_standings(self):
        df = _make_standings_df(1)
        assert len(df) == 1
        assert df.iloc[0]["Position"] == 1
        assert df.iloc[0]["Driver"] == "VER"
