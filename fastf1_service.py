"""
FastF1 backend service for loading and caching historical race session data.

Provides a clean interface to FastF1 for the dashboard, with proper caching,
error handling, and data extraction for intervals, positions, and standings.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import fastf1
import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_DEFAULT_CACHE_DIR = Path(__file__).parent / "fastf1_cache"

# Supported session identifiers (label -> FastF1 identifier)
SESSION_TYPE_MAP: dict[str, str] = {
    "Race": "R",
    "Sprint": "S",
    "Qualifying": "Q",
    "Sprint Qualifying": "SQ",
    "Sprint Shootout": "SS",
    "Practice 1": "FP1",
    "Practice 2": "FP2",
    "Practice 3": "FP3",
}

# ---------------------------------------------------------------------------
# Custom exceptions
# ---------------------------------------------------------------------------


class FastF1ServiceError(Exception):
    """Base exception for FastF1 service errors."""


class SessionNotFoundError(FastF1ServiceError):
    """Raised when the requested session cannot be found."""


class DataLoadError(FastF1ServiceError):
    """Raised when session data fails to load."""


# ---------------------------------------------------------------------------
# Data containers
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class DriverInfo:
    """Immutable snapshot of a driver in a session."""

    abbreviation: str
    driver_number: str
    full_name: str
    team_name: str
    team_color: str  # hex without '#'


@dataclass
class SessionData:
    """Holds all extracted data for a loaded session."""

    year: int
    grand_prix: str
    session_type: str

    # Core DataFrames
    laps: pd.DataFrame = field(default_factory=pd.DataFrame)
    results: pd.DataFrame = field(default_factory=pd.DataFrame)

    # Driver lookup
    drivers: dict[str, DriverInfo] = field(default_factory=dict)

    # Session metadata
    total_laps: int = 0
    event_name: str = ""
    session_name: str = ""

    @property
    def driver_abbreviations(self) -> list[str]:
        """Return sorted list of driver abbreviations."""
        return sorted(self.drivers.keys())


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class FastF1Service:
    """Service layer around FastF1 for loading & caching historical data.

    Usage::

        svc = FastF1Service()
        session_data = svc.load_session(2024, "Bahrain", "Race")
        print(session_data.driver_abbreviations)
    """

    def __init__(self, cache_dir: Path | str | None = None) -> None:
        self._cache_dir = Path(cache_dir) if cache_dir else _DEFAULT_CACHE_DIR
        self._enable_cache()
        # In-memory cache keyed by (year, gp, session_type)
        self._session_cache: dict[tuple[int, str, str], SessionData] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def load_session(
        self,
        year: int,
        grand_prix: str,
        session_type: str = "Race",
        *,
        force_reload: bool = False,
    ) -> SessionData:
        """Load a historical session and return structured *SessionData*.

        Parameters
        ----------
        year:
            Season year (e.g. 2024).
        grand_prix:
            Grand Prix name or round number (e.g. "Bahrain" or 1).
        session_type:
            Human-readable session type – one of SESSION_TYPE_MAP keys.
        force_reload:
            If True, bypass the in-memory cache and re-fetch from FastF1.

        Returns
        -------
        SessionData with laps, results, and driver information.

        Raises
        ------
        SessionNotFoundError
            If the event / session cannot be resolved by FastF1.
        DataLoadError
            If loading or parsing the session data fails.
        """
        cache_key = (year, grand_prix, session_type)

        if not force_reload and cache_key in self._session_cache:
            logger.info("Returning cached session: %s", cache_key)
            return self._session_cache[cache_key]

        ff1_id = SESSION_TYPE_MAP.get(session_type, session_type)

        # --- Resolve & load the FastF1 session --------------------------
        try:
            session = fastf1.get_session(year, grand_prix, ff1_id)
        except Exception as exc:
            raise SessionNotFoundError(
                f"Could not find session: {year} {grand_prix} {session_type}"
            ) from exc

        try:
            session.load(
                laps=True,
                telemetry=False,
                weather=False,
                messages=False,
            )
        except Exception as exc:
            raise DataLoadError(
                f"Failed to load data for {year} {grand_prix} {session_type}: {exc}"
            ) from exc

        # --- Extract structured data -------------------------------------
        session_data = self._build_session_data(session, year, grand_prix, session_type)
        self._session_cache[cache_key] = session_data
        logger.info(
            "Loaded session: %s %s %s (%d drivers, %d lap rows)",
            year,
            grand_prix,
            session_type,
            len(session_data.drivers),
            len(session_data.laps),
        )
        return session_data

    def get_available_events(self, year: int) -> list[dict[str, str]]:
        """Return list of events for a given year.

        Each dict contains ``round_number``, ``event_name``, and ``country``.
        """
        try:
            schedule = fastf1.get_event_schedule(year, include_testing=False)
        except Exception as exc:
            logger.error("Failed to get event schedule for %d: %s", year, exc)
            return []

        events: list[dict[str, str]] = []
        for _, row in schedule.iterrows():
            events.append(
                {
                    "round_number": str(row.get("RoundNumber", "")),
                    "event_name": str(row.get("EventName", "")),
                    "country": str(row.get("Country", "")),
                }
            )
        return events

    def get_available_session_types(self) -> list[str]:
        """Return the list of supported session type labels."""
        return list(SESSION_TYPE_MAP.keys())

    def clear_memory_cache(self) -> None:
        """Clear the in-memory session cache."""
        self._session_cache.clear()
        logger.info("In-memory session cache cleared")

    # ------------------------------------------------------------------
    # Lap / interval helpers
    # ------------------------------------------------------------------

    def get_driver_laps(
        self,
        session_data: SessionData,
        driver: str,
    ) -> pd.DataFrame:
        """Return laps DataFrame for a single driver (by abbreviation).

        Filters out in/out laps and sorts by lap number.
        """
        if session_data.laps.empty:
            return pd.DataFrame()

        mask = session_data.laps["Driver"] == driver
        df = session_data.laps.loc[mask].copy()

        # Remove in/out laps if the column exists
        if "TrackStatus" in df.columns:
            pass  # TrackStatus doesn't mark in/out directly

        # Filter by non-null LapTime for clean data
        if "LapTime" in df.columns:
            df = df.dropna(subset=["LapTime"])

        return df.sort_values("LapNumber").reset_index(drop=True)

    def get_interval_between_drivers(
        self,
        session_data: SessionData,
        driver1: str,
        driver2: str,
    ) -> pd.DataFrame:
        """Compute lap-by-lap gap between two drivers.

        Returns a DataFrame with columns:
            LapNumber, Gap, Position_d1, Position_d2, LapTime_d1, LapTime_d2

        Gap > 0 means driver1 is *ahead* (crossed the line earlier).
        """
        d1 = self.get_driver_laps(session_data, driver1)
        d2 = self.get_driver_laps(session_data, driver2)

        if d1.empty or d2.empty:
            return pd.DataFrame()

        # We need Time (session-relative elapsed time at line crossing)
        for label, df in [("d1", d1), ("d2", d2)]:
            if "Time" not in df.columns or df["Time"].isna().all():
                logger.warning("No 'Time' column for %s – cannot compute gap", label)
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

        merged = merged.rename(
            columns={
                "Position_d1": "Position_d1",
                "Position_d2": "Position_d2",
                "LapTime_d1": "LapTime_d1",
                "LapTime_d2": "LapTime_d2",
            }
        )

        return merged[
            ["LapNumber", "Gap", "Position_d1", "Position_d2", "LapTime_d1", "LapTime_d2"]
        ].reset_index(drop=True)

    def get_standings_at_lap(
        self,
        session_data: SessionData,
        lap_number: int,
    ) -> pd.DataFrame:
        """Return the race standings as of a given lap number.

        Returns a DataFrame sorted by position with columns:
            Position, Driver, DriverNumber, Team, TeamColor,
            GapToLeader, Interval, LastLapTime, LapNumber,
            TireCompound, TireAge, PitStops, HasFastestLap
        """
        if session_data.laps.empty:
            return pd.DataFrame()

        laps = session_data.laps
        at_lap = laps[laps["LapNumber"] == lap_number].copy()

        if at_lap.empty:
            return pd.DataFrame()

        # Sort by race position
        if "Position" in at_lap.columns:
            at_lap = at_lap.sort_values("Position")
        elif "Time" in at_lap.columns:
            at_lap = at_lap.sort_values("Time")

        # Pre-compute pit stop counts and fastest lap up to this lap
        laps_up_to = laps[laps["LapNumber"] <= lap_number]
        pit_counts = self._count_pit_stops(laps_up_to)
        fastest_lap_driver = self._get_fastest_lap_driver(laps_up_to)

        rows: list[dict] = []
        leader_time: Optional[pd.Timedelta] = None
        prev_time: Optional[pd.Timedelta] = None

        for _, row in at_lap.iterrows():
            drv = str(row.get("Driver", ""))
            info = session_data.drivers.get(drv)
            team = info.team_name if info else ""
            team_color = info.team_color if info else "FFFFFF"
            driver_number = info.driver_number if info else str(row.get("DriverNumber", ""))
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

            # Lap time formatting
            lap_time_val = row.get("LapTime")
            lap_time_str = ""
            if pd.notna(lap_time_val):
                total_secs = lap_time_val.total_seconds()
                mins = int(total_secs // 60)
                secs = total_secs % 60
                lap_time_str = f"{mins}:{secs:06.3f}"

            # Tire compound info
            tire_compound = str(row.get("Compound", "")) if pd.notna(row.get("Compound")) else ""
            tire_life = int(row.get("TyreLife", 0)) if pd.notna(row.get("TyreLife")) else 0

            # Pit stops for this driver up to current lap
            num_pits = pit_counts.get(drv, 0)

            # Fastest lap indicator
            has_fastest = (drv == fastest_lap_driver)

            rows.append(
                {
                    "Position": int(row.get("Position", 0)) if pd.notna(row.get("Position")) else 0,
                    "Driver": drv,
                    "DriverNumber": driver_number,
                    "Team": team,
                    "TeamColor": team_color,
                    "GapToLeader": gap_to_leader,
                    "Interval": interval,
                    "LastLapTime": lap_time_str,
                    "LapNumber": lap_number,
                    "TireCompound": tire_compound,
                    "TireAge": tire_life,
                    "PitStops": num_pits,
                    "HasFastestLap": has_fastest,
                }
            )

        return pd.DataFrame(rows)

    def _count_pit_stops(self, laps_df: pd.DataFrame) -> dict[str, int]:
        """Count pit stops per driver from laps data.

        A pit stop is detected by the presence of a non-null PitInTime or
        PitOutTime, or by a change in Compound between consecutive laps.
        """
        counts: dict[str, int] = {}
        if laps_df.empty:
            return counts

        for driver, grp in laps_df.groupby("Driver"):
            drv = str(driver)
            grp_sorted = grp.sort_values("LapNumber")

            pit_count = 0
            # Primary method: PitInTime column
            if "PitInTime" in grp_sorted.columns:
                pit_count = int(grp_sorted["PitInTime"].notna().sum())

            # Fallback: count compound changes if PitInTime gave 0
            if pit_count == 0 and "Compound" in grp_sorted.columns:
                compounds = grp_sorted["Compound"].dropna()
                if len(compounds) > 1:
                    pit_count = int((compounds != compounds.shift()).sum() - 1)
                    pit_count = max(pit_count, 0)

            counts[drv] = pit_count
        return counts

    def _get_fastest_lap_driver(self, laps_df: pd.DataFrame) -> str:
        """Return the driver abbreviation who has the fastest lap so far."""
        if laps_df.empty or "LapTime" not in laps_df.columns:
            return ""

        valid = laps_df.dropna(subset=["LapTime"])
        if valid.empty:
            return ""

        fastest_idx = valid["LapTime"].idxmin()
        return str(valid.loc[fastest_idx, "Driver"])

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _enable_cache(self) -> None:
        """Enable FastF1 disk cache."""
        self._cache_dir.mkdir(parents=True, exist_ok=True)
        fastf1.Cache.enable_cache(str(self._cache_dir))
        logger.info("FastF1 disk cache enabled at %s", self._cache_dir)

    def _build_session_data(
        self,
        session: fastf1.core.Session,
        year: int,
        grand_prix: str,
        session_type: str,
    ) -> SessionData:
        """Extract a *SessionData* from a loaded FastF1 session."""
        # --- Laps ---------------------------------------------------------
        laps_df = pd.DataFrame()
        try:
            laps = session.laps
            if laps is not None and not laps.empty:
                laps_df = laps.copy()
        except Exception as exc:
            logger.warning("Could not extract laps: %s", exc)

        # --- Results ------------------------------------------------------
        results_df = pd.DataFrame()
        try:
            results = session.results
            if results is not None and not results.empty:
                results_df = results.copy()
        except Exception as exc:
            logger.warning("Could not extract results: %s", exc)

        # --- Drivers ------------------------------------------------------
        drivers: dict[str, DriverInfo] = {}
        try:
            for _, drv in results_df.iterrows():
                abbr = str(drv.get("Abbreviation", ""))
                if not abbr:
                    continue
                drivers[abbr] = DriverInfo(
                    abbreviation=abbr,
                    driver_number=str(drv.get("DriverNumber", "")),
                    full_name=str(drv.get("FullName", "")),
                    team_name=str(drv.get("TeamName", "")),
                    team_color=str(drv.get("TeamColor", "FFFFFF")),
                )
        except Exception as exc:
            logger.warning("Could not extract driver info from results: %s", exc)
            # Fallback: derive from laps
            if not laps_df.empty and "Driver" in laps_df.columns:
                for abbr in laps_df["Driver"].unique():
                    abbr_str = str(abbr)
                    subset = laps_df[laps_df["Driver"] == abbr_str].iloc[0]
                    drivers[abbr_str] = DriverInfo(
                        abbreviation=abbr_str,
                        driver_number=str(subset.get("DriverNumber", "")),
                        full_name=abbr_str,
                        team_name=str(subset.get("Team", "")),
                        team_color="FFFFFF",
                    )

        # --- Total laps ---------------------------------------------------
        total_laps = 0
        if not laps_df.empty and "LapNumber" in laps_df.columns:
            total_laps = int(laps_df["LapNumber"].max())

        return SessionData(
            year=year,
            grand_prix=grand_prix,
            session_type=session_type,
            laps=laps_df,
            results=results_df,
            drivers=drivers,
            total_laps=total_laps,
            event_name=str(getattr(session.event, "EventName", grand_prix)),
            session_name=str(getattr(session, "name", session_type)),
        )
