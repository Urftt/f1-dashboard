"""
Gap chart data layer for two-driver interval comparison.

Takes two selected drivers and lap-by-lap timing data from a loaded FastF1
session, computes the cumulative interval (gap in seconds) between them for
each lap, and exposes the resulting array for charting.

The gap is defined as:
    gap = driver2_line_crossing_time - driver1_line_crossing_time

A positive gap means driver1 crossed the line first (driver1 is ahead).
A negative gap means driver2 is ahead.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd

from fastf1_service import SessionData

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data containers
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class GapPoint:
    """A single lap's gap data point."""

    lap_number: int
    gap_seconds: float          # positive = driver1 ahead
    driver1_position: int
    driver2_position: int
    driver1_lap_time_s: Optional[float]   # seconds, None if unavailable
    driver2_lap_time_s: Optional[float]
    gap_change: Optional[float]  # change from previous lap (None for first)
    is_pit_lap_d1: bool
    is_pit_lap_d2: bool


@dataclass
class GapChartResult:
    """Full result of a gap chart computation, ready for charting."""

    driver1: str
    driver2: str
    points: list[GapPoint] = field(default_factory=list)

    # -- Convenience accessors for charting --------------------------------

    @property
    def lap_numbers(self) -> list[int]:
        return [p.lap_number for p in self.points]

    @property
    def gaps(self) -> list[float]:
        return [p.gap_seconds for p in self.points]

    @property
    def gap_changes(self) -> list[Optional[float]]:
        return [p.gap_change for p in self.points]

    @property
    def is_empty(self) -> bool:
        return len(self.points) == 0

    def up_to_lap(self, lap: int) -> "GapChartResult":
        """Return a new GapChartResult sliced up to (and including) *lap*.

        Useful for replay mode where data is progressively revealed.
        """
        sliced = [p for p in self.points if p.lap_number <= lap]
        return GapChartResult(
            driver1=self.driver1,
            driver2=self.driver2,
            points=sliced,
        )

    def to_dataframe(self) -> pd.DataFrame:
        """Convert the gap data to a pandas DataFrame for easy plotting."""
        if self.is_empty:
            return pd.DataFrame()
        records = [
            {
                "lap_number": p.lap_number,
                "gap_seconds": p.gap_seconds,
                "driver1_position": p.driver1_position,
                "driver2_position": p.driver2_position,
                "driver1_lap_time_s": p.driver1_lap_time_s,
                "driver2_lap_time_s": p.driver2_lap_time_s,
                "gap_change": p.gap_change,
                "is_pit_lap_d1": p.is_pit_lap_d1,
                "is_pit_lap_d2": p.is_pit_lap_d2,
            }
            for p in self.points
        ]
        return pd.DataFrame(records)


# ---------------------------------------------------------------------------
# Core computation
# ---------------------------------------------------------------------------

# Pit-stop detection: if a lap time exceeds the median by this factor,
# we flag it as a pit lap.
_PIT_LAP_FACTOR = 1.35


def _detect_pit_laps(driver_laps: pd.DataFrame) -> set[int]:
    """Return set of lap numbers that are likely pit in/out laps."""
    if driver_laps.empty or "LapTime" not in driver_laps.columns:
        return set()

    valid = driver_laps.dropna(subset=["LapTime"]).copy()
    if valid.empty:
        return set()

    lap_times_s = valid["LapTime"].dt.total_seconds()
    median_time = lap_times_s.median()

    pit_mask = lap_times_s > (median_time * _PIT_LAP_FACTOR)
    return set(valid.loc[pit_mask, "LapNumber"].astype(int))


def compute_gap_chart(
    session_data: SessionData,
    driver1: str,
    driver2: str,
    *,
    max_lap: Optional[int] = None,
) -> GapChartResult:
    """Compute the lap-by-lap gap between two drivers.

    Parameters
    ----------
    session_data:
        A loaded ``SessionData`` from ``FastF1Service``.
    driver1, driver2:
        Driver abbreviations (e.g. ``"VER"``, ``"HAM"``).
    max_lap:
        If given, only compute up to this lap number (inclusive).
        Handy for replay-sync mode.

    Returns
    -------
    GapChartResult
        Contains a list of ``GapPoint`` objects, one per common lap.
    """
    laps = session_data.laps

    if laps.empty:
        logger.warning("Session has no lap data")
        return GapChartResult(driver1=driver1, driver2=driver2)

    # Filter laps for each driver
    d1_laps = laps[laps["Driver"] == driver1].copy()
    d2_laps = laps[laps["Driver"] == driver2].copy()

    if d1_laps.empty:
        logger.warning("No laps found for driver %s", driver1)
        return GapChartResult(driver1=driver1, driver2=driver2)
    if d2_laps.empty:
        logger.warning("No laps found for driver %s", driver2)
        return GapChartResult(driver1=driver1, driver2=driver2)

    # We need the 'Time' column (session-elapsed timedelta at line crossing)
    for label, df in [("driver1", d1_laps), ("driver2", d2_laps)]:
        if "Time" not in df.columns or df["Time"].isna().all():
            logger.warning(
                "No 'Time' column for %s (%s) — cannot compute gap", label, driver1 if label == "driver1" else driver2,
            )
            return GapChartResult(driver1=driver1, driver2=driver2)

    # Drop rows where Time is NaT (e.g. lap 1 sometimes)
    d1_laps = d1_laps.dropna(subset=["Time"])
    d2_laps = d2_laps.dropna(subset=["Time"])

    # Filter by LapTime not null for cleaner data (keep rows even if LapTime
    # is NaN — we still need Time for gap, but LapTime may be missing on lap 1)
    # We keep all rows with valid Time; LapTime is optional metadata.

    # Detect pit laps
    d1_pits = _detect_pit_laps(d1_laps)
    d2_pits = _detect_pit_laps(d2_laps)

    # Prepare merge columns
    d1_merge = d1_laps[["LapNumber", "Time", "Position", "LapTime"]].copy()
    d2_merge = d2_laps[["LapNumber", "Time", "Position", "LapTime"]].copy()

    # Ensure LapNumber is int for merge
    d1_merge["LapNumber"] = d1_merge["LapNumber"].astype(int)
    d2_merge["LapNumber"] = d2_merge["LapNumber"].astype(int)

    merged = pd.merge(
        d1_merge,
        d2_merge,
        on="LapNumber",
        suffixes=("_d1", "_d2"),
    )

    if merged.empty:
        logger.warning("No common laps between %s and %s", driver1, driver2)
        return GapChartResult(driver1=driver1, driver2=driver2)

    merged = merged.sort_values("LapNumber").reset_index(drop=True)

    # Apply max_lap filter
    if max_lap is not None:
        merged = merged[merged["LapNumber"] <= max_lap]

    # Compute gap: positive means driver1 ahead (crossed line first)
    merged["gap_seconds"] = (
        merged["Time_d2"] - merged["Time_d1"]
    ).dt.total_seconds()

    # Compute gap change lap over lap
    merged["gap_change"] = merged["gap_seconds"].diff()

    # Extract lap times in seconds
    def _td_to_seconds(td: pd.Timedelta) -> Optional[float]:
        if pd.isna(td):
            return None
        return td.total_seconds()

    # Build GapPoint list
    points: list[GapPoint] = []
    for idx, row in merged.iterrows():
        lap_num = int(row["LapNumber"])

        d1_lt = _td_to_seconds(row.get("LapTime_d1"))
        d2_lt = _td_to_seconds(row.get("LapTime_d2"))

        pos_d1 = int(row["Position_d1"]) if pd.notna(row.get("Position_d1")) else 0
        pos_d2 = int(row["Position_d2"]) if pd.notna(row.get("Position_d2")) else 0

        gap_chg = float(row["gap_change"]) if pd.notna(row.get("gap_change")) else None

        points.append(
            GapPoint(
                lap_number=lap_num,
                gap_seconds=float(row["gap_seconds"]),
                driver1_position=pos_d1,
                driver2_position=pos_d2,
                driver1_lap_time_s=d1_lt,
                driver2_lap_time_s=d2_lt,
                gap_change=gap_chg,
                is_pit_lap_d1=lap_num in d1_pits,
                is_pit_lap_d2=lap_num in d2_pits,
            )
        )

    result = GapChartResult(driver1=driver1, driver2=driver2, points=points)
    logger.info(
        "Computed gap chart: %s vs %s — %d data points",
        driver1, driver2, len(points),
    )
    return result
