"""
Visibility filter for replay mode — ensures dashboard components only see
data up to the current replay lap, never the full pre-loaded dataset.

The ReplayState tracks current lap progress.  VisibilityFilter wraps a
SessionData object and exposes only the rows whose LapNumber <= current_lap.
All dashboard consumers (standings board, gap chart, replay controls) must
go through VisibilityFilter rather than touching SessionData.laps directly.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import pandas as pd

from fastf1_service import SessionData

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Replay state
# ---------------------------------------------------------------------------


@dataclass
class ReplayState:
    """Mutable state for the race-replay clock.

    Attributes
    ----------
    current_lap : int
        The latest lap that should be visible to consumers.  0 means nothing
        is visible yet (pre-race).
    is_playing : bool
        Whether the replay is actively advancing.
    speed_multiplier : float
        Playback speed (1.0 = real-time, 2.0 = 2x, etc.).
    total_laps : int
        Total number of laps in the loaded session (set once on load).
    """

    current_lap: int = 0
    is_playing: bool = False
    speed_multiplier: float = 1.0
    total_laps: int = 0

    # -- helpers -------------------------------------------------------------

    def advance(self, laps: int = 1) -> int:
        """Advance the replay by *laps* and return the new current_lap.

        Clamps to [0, total_laps].
        """
        self.current_lap = min(self.current_lap + laps, self.total_laps)
        return self.current_lap

    def set_lap(self, lap: int) -> int:
        """Jump to a specific lap.  Clamps to [0, total_laps]."""
        self.current_lap = max(0, min(lap, self.total_laps))
        return self.current_lap

    def reset(self) -> None:
        """Reset replay to the beginning."""
        self.current_lap = 0
        self.is_playing = False

    @property
    def is_complete(self) -> bool:
        """Return True if the replay has reached the final lap."""
        return self.total_laps > 0 and self.current_lap >= self.total_laps

    @property
    def progress_fraction(self) -> float:
        """Return replay progress as a float in [0, 1]."""
        if self.total_laps <= 0:
            return 0.0
        return self.current_lap / self.total_laps


# ---------------------------------------------------------------------------
# Visibility filter
# ---------------------------------------------------------------------------


class VisibilityFilter:
    """Gate-keeper that clips SessionData to the current replay lap.

    All dashboard components should call methods on *this* class instead of
    reading ``session_data.laps`` directly, so that future-lap information
    is never leaked.

    Usage::

        vf = VisibilityFilter(session_data, replay_state)

        # Standings board
        standings = vf.get_standings()

        # Gap chart between two drivers
        gap_df = vf.get_interval_between_drivers("VER", "HAM")

        # Filtered laps for a single driver
        laps = vf.get_driver_laps("VER")
    """

    def __init__(self, session_data: SessionData, replay_state: ReplayState) -> None:
        self._session_data = session_data
        self._replay_state = replay_state

    # -- properties ----------------------------------------------------------

    @property
    def session_data(self) -> SessionData:
        """Expose metadata (drivers dict, event info, etc.) — NOT laps."""
        return self._session_data

    @property
    def replay_state(self) -> ReplayState:
        return self._replay_state

    @property
    def current_lap(self) -> int:
        return self._replay_state.current_lap

    @property
    def total_laps(self) -> int:
        return self._replay_state.total_laps

    @property
    def driver_abbreviations(self) -> list[str]:
        return self._session_data.driver_abbreviations

    # -- filtered data access ------------------------------------------------

    def get_visible_laps(self) -> pd.DataFrame:
        """Return all lap rows with LapNumber <= current_lap.

        This is the **single** entry-point for lap data — no consumer should
        bypass this method.
        """
        laps = self._session_data.laps
        if laps.empty or self._replay_state.current_lap <= 0:
            return pd.DataFrame(columns=laps.columns if not laps.empty else [])

        mask = laps["LapNumber"] <= self._replay_state.current_lap
        return laps.loc[mask].copy()

    def get_driver_laps(self, driver: str) -> pd.DataFrame:
        """Return visible laps for a single driver (by abbreviation).

        Filters out rows without a valid LapTime and sorts by LapNumber.
        """
        visible = self.get_visible_laps()
        if visible.empty:
            return pd.DataFrame()

        mask = visible["Driver"] == driver
        df = visible.loc[mask].copy()

        # Filter by non-null LapTime for clean data
        if "LapTime" in df.columns:
            df = df.dropna(subset=["LapTime"])

        return df.sort_values("LapNumber").reset_index(drop=True)

    def get_interval_between_drivers(
        self,
        driver1: str,
        driver2: str,
    ) -> pd.DataFrame:
        """Compute lap-by-lap gap between two drivers up to current_lap.

        Returns a DataFrame with columns:
            LapNumber, Gap, Position_d1, Position_d2, LapTime_d1, LapTime_d2

        Gap > 0 means driver1 is *ahead* (crossed the line earlier).
        """
        d1 = self.get_driver_laps(driver1)
        d2 = self.get_driver_laps(driver2)

        if d1.empty or d2.empty:
            return pd.DataFrame()

        # We need the Time column (session-relative elapsed time at line crossing)
        for label, df in [("d1", d1), ("d2", d2)]:
            if "Time" not in df.columns or df["Time"].isna().all():
                logger.warning(
                    "No 'Time' column for %s — cannot compute gap", label
                )
                return pd.DataFrame()

        merged = pd.merge(
            d1[["LapNumber", "Time", "Position", "LapTime"]],
            d2[["LapNumber", "Time", "Position", "LapTime"]],
            on="LapNumber",
            suffixes=("_d1", "_d2"),
        )

        if merged.empty:
            return pd.DataFrame()

        # Gap = d2.Time - d1.Time  (positive => d1 crossed line first => d1 ahead)
        merged["Gap"] = (
            merged["Time_d2"] - merged["Time_d1"]
        ).dt.total_seconds()

        return merged[
            [
                "LapNumber",
                "Gap",
                "Position_d1",
                "Position_d2",
                "LapTime_d1",
                "LapTime_d2",
            ]
        ].reset_index(drop=True)

    def get_standings(self) -> pd.DataFrame:
        """Return race standings as of the current visible lap.

        Returns a DataFrame sorted by position with columns:
            Position, Driver, Team, GapToLeader, Interval,
            LastLapTime, LapNumber, TeamColor
        """
        if self._replay_state.current_lap <= 0:
            return pd.DataFrame()

        visible = self.get_visible_laps()
        if visible.empty:
            return pd.DataFrame()

        # Use the most recent visible lap for each driver
        lap_num = self._replay_state.current_lap

        # Find the actual latest lap <= current_lap that has data
        at_lap = visible[visible["LapNumber"] == lap_num]

        # If no data at exactly this lap, find the highest lap with data
        if at_lap.empty:
            max_available = int(visible["LapNumber"].max())
            at_lap = visible[visible["LapNumber"] == max_available]
            lap_num = max_available

        if at_lap.empty:
            return pd.DataFrame()

        # Sort by race position
        if "Position" in at_lap.columns:
            at_lap = at_lap.sort_values("Position")
        elif "Time" in at_lap.columns:
            at_lap = at_lap.sort_values("Time")

        rows: list[dict] = []
        leader_time: Optional[pd.Timedelta] = None
        prev_time: Optional[pd.Timedelta] = None

        for _, row in at_lap.iterrows():
            drv = str(row.get("Driver", ""))
            info = self._session_data.drivers.get(drv)
            team = info.team_name if info else ""
            team_color = f"#{info.team_color}" if info else "#FFFFFF"
            time_val = row.get("Time")

            # Gap to leader
            gap_to_leader = ""
            interval = ""
            if leader_time is None:
                leader_time = time_val
                gap_to_leader = "LEADER"
                interval = ""
            else:
                if pd.notna(time_val) and pd.notna(leader_time):
                    gap_sec = (time_val - leader_time).total_seconds()
                    gap_to_leader = f"+{gap_sec:.3f}s"
                if pd.notna(time_val) and pd.notna(prev_time):
                    int_sec = (time_val - prev_time).total_seconds()
                    interval = f"+{int_sec:.3f}s"

            prev_time = time_val

            lap_time_val = row.get("LapTime")
            lap_time_str = ""
            if pd.notna(lap_time_val):
                total_secs = lap_time_val.total_seconds()
                mins = int(total_secs // 60)
                secs = total_secs % 60
                lap_time_str = f"{mins}:{secs:06.3f}"

            rows.append(
                {
                    "Position": (
                        int(row.get("Position", 0))
                        if pd.notna(row.get("Position"))
                        else 0
                    ),
                    "Driver": drv,
                    "Team": team,
                    "TeamColor": team_color,
                    "GapToLeader": gap_to_leader,
                    "Interval": interval,
                    "LastLapTime": lap_time_str,
                    "LapNumber": lap_num,
                }
            )

        return pd.DataFrame(rows)

    def get_latest_positions(self) -> dict[str, int]:
        """Return {driver_abbr: position} at the current visible lap.

        Useful for quick position lookups without building full standings.
        """
        standings = self.get_standings()
        if standings.empty:
            return {}
        return dict(zip(standings["Driver"], standings["Position"]))

    def get_visible_lap_range(self) -> tuple[int, int]:
        """Return (min_lap, max_lap) currently visible.

        Returns (0, 0) if nothing is visible yet.
        """
        visible = self.get_visible_laps()
        if visible.empty:
            return (0, 0)
        return (int(visible["LapNumber"].min()), int(visible["LapNumber"].max()))


# ---------------------------------------------------------------------------
# Factory helper
# ---------------------------------------------------------------------------


def create_visibility_filter(
    session_data: SessionData,
    *,
    start_lap: int = 0,
    speed: float = 1.0,
) -> VisibilityFilter:
    """Convenience factory to create a filter with a fresh ReplayState.

    Parameters
    ----------
    session_data : SessionData
        The fully loaded session data from FastF1Service.
    start_lap : int
        Initial lap to reveal (0 = nothing visible).
    speed : float
        Playback speed multiplier.
    """
    state = ReplayState(
        current_lap=start_lap,
        total_laps=session_data.total_laps,
        speed_multiplier=speed,
    )
    return VisibilityFilter(session_data, state)
