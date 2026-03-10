"""
Replay-oriented session models and normalization helpers.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Iterable, List, Mapping, Optional

import pandas as pd


TYRE_FIELD_CANDIDATES = (
    "compound",
    "tyre_compound",
    "stint_number",
    "tyre_age_at_start",
    "tyre_age",
    "lap_duration",
    "is_pit_out_lap",
)


@dataclass(frozen=True)
class ReplayDriver:
    """Stable driver metadata used across replay features."""

    driver_number: int
    name_acronym: str
    broadcast_name: Optional[str] = None
    full_name: Optional[str] = None
    team_name: Optional[str] = None
    country_code: Optional[str] = None
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ReplayLap:
    """A normalized lap row suitable for lap-granular replay."""

    driver_number: int
    lap_number: int
    date_start: Optional[datetime]
    date_end: Optional[datetime]
    position: Optional[int]
    compound: Optional[str]
    stint_number: Optional[int]
    tyre_age_at_start: Optional[float]
    lap_duration: Optional[float]
    is_pit_out_lap: Optional[bool]
    source_fields: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ReplaySession:
    """One historical session loaded into a reusable replay contract."""

    session_key: int
    session_name: str
    meeting_name: Optional[str]
    country_name: Optional[str]
    date_start: Optional[datetime]
    drivers: Dict[int, ReplayDriver]
    laps_by_driver: Dict[int, List[ReplayLap]]
    ordered_laps: List[ReplayLap]
    raw_session: Dict[str, Any] = field(default_factory=dict)

    @property
    def driver_numbers(self) -> List[int]:
        return list(self.drivers.keys())

    @property
    def driver_acronyms(self) -> List[str]:
        return [
            driver.name_acronym
            for driver in self.drivers.values()
            if driver.name_acronym
        ]


def normalize_replay_session(
    session_row: Mapping[str, Any],
    driver_rows: Iterable[Mapping[str, Any]],
    lap_rows: Iterable[Mapping[str, Any]] | pd.DataFrame,
) -> ReplaySession:
    """
    Build a replay-ready session contract from raw OpenF1-style payloads.

    The replay contract stays lap-granular for Phase 1 so later snapshot helpers
    can answer "latest known state at lap N" without depending on Streamlit.
    """
    normalized_drivers = normalize_drivers(driver_rows)
    normalized_laps = normalize_laps(lap_rows)

    laps_by_driver: Dict[int, List[ReplayLap]] = {
        driver_number: [] for driver_number in normalized_drivers
    }
    for lap in normalized_laps:
        laps_by_driver.setdefault(lap.driver_number, []).append(lap)

    ordered_drivers = dict(sorted(normalized_drivers.items(), key=lambda item: item[0]))
    ordered_laps_by_driver = {
        driver_number: sorted(
            laps,
            key=lambda lap: (
                lap.lap_number,
                lap.date_start or datetime.min,
                lap.date_end or datetime.min,
            ),
        )
        for driver_number, laps in sorted(laps_by_driver.items(), key=lambda item: item[0])
    }

    return ReplaySession(
        session_key=int(session_row["session_key"]),
        session_name=str(session_row.get("session_name") or "Unknown session"),
        meeting_name=_coerce_optional_str(session_row.get("meeting_name")),
        country_name=_coerce_optional_str(session_row.get("country_name")),
        date_start=_coerce_datetime(session_row.get("date_start")),
        drivers=ordered_drivers,
        laps_by_driver=ordered_laps_by_driver,
        ordered_laps=normalized_laps,
        raw_session=dict(session_row),
    )


def normalize_drivers(driver_rows: Iterable[Mapping[str, Any]]) -> Dict[int, ReplayDriver]:
    """Normalize driver payloads into a deterministic driver map."""
    drivers: Dict[int, ReplayDriver] = {}

    for row in driver_rows:
        if "driver_number" not in row:
            continue

        driver_number = int(row["driver_number"])
        name_acronym = _coerce_optional_str(row.get("name_acronym")) or str(driver_number)

        drivers[driver_number] = ReplayDriver(
            driver_number=driver_number,
            name_acronym=name_acronym,
            broadcast_name=_coerce_optional_str(row.get("broadcast_name")),
            full_name=_coerce_optional_str(row.get("full_name") or row.get("first_name")),
            team_name=_coerce_optional_str(row.get("team_name")),
            country_code=_coerce_optional_str(row.get("country_code")),
            extra={
                key: value
                for key, value in row.items()
                if key
                not in {
                    "driver_number",
                    "name_acronym",
                    "broadcast_name",
                    "full_name",
                    "first_name",
                    "team_name",
                    "country_code",
                }
            },
        )

    return dict(sorted(drivers.items(), key=lambda item: item[0]))


def normalize_laps(
    lap_rows: Iterable[Mapping[str, Any]] | pd.DataFrame,
) -> List[ReplayLap]:
    """
    Normalize lap rows into stable, lap-granular replay data.

    Duplicate driver/lap rows are collapsed by keeping the latest timestamped row.
    Missing timestamps are allowed, but ordering still falls back to lap number and
    driver number so the replay contract stays deterministic.
    Tyre-related fields remain optional because OpenF1 payloads are not guaranteed
    to include them on every row.
    """
    if isinstance(lap_rows, pd.DataFrame):
        records = lap_rows.to_dict("records")
    else:
        records = [dict(row) for row in lap_rows]

    deduped: Dict[tuple[int, int], Mapping[str, Any]] = {}
    for row in records:
        if row.get("driver_number") is None or row.get("lap_number") is None:
            continue

        driver_number = int(row["driver_number"])
        lap_number = int(row["lap_number"])
        key = (driver_number, lap_number)

        existing = deduped.get(key)
        if existing is None or _row_sort_key(row) >= _row_sort_key(existing):
            deduped[key] = row

    normalized_laps = [
        ReplayLap(
            driver_number=driver_number,
            lap_number=lap_number,
            date_start=_coerce_datetime(row.get("date_start")),
            date_end=_coerce_datetime(row.get("date")),
            position=_coerce_optional_int(row.get("position")),
            compound=_coerce_optional_str(
                row.get("compound") or row.get("tyre_compound")
            ),
            stint_number=_coerce_optional_int(row.get("stint_number")),
            tyre_age_at_start=_coerce_optional_float(
                row.get("tyre_age_at_start") or row.get("tyre_age")
            ),
            lap_duration=_coerce_optional_float(row.get("lap_duration")),
            is_pit_out_lap=_coerce_optional_bool(row.get("is_pit_out_lap")),
            source_fields={
                field_name: row.get(field_name)
                for field_name in TYRE_FIELD_CANDIDATES
                if field_name in row
            },
        )
        for (driver_number, lap_number), row in deduped.items()
    ]

    return sorted(
        normalized_laps,
        key=lambda lap: (
            lap.lap_number,
            lap.date_start or datetime.min,
            lap.date_end or datetime.min,
            lap.driver_number,
        ),
    )


def _row_sort_key(row: Mapping[str, Any]) -> tuple:
    return (
        _coerce_datetime(row.get("date_start")) or datetime.min,
        _coerce_datetime(row.get("date")) or datetime.min,
    )


def _coerce_datetime(value: Any) -> Optional[datetime]:
    if value in (None, "", pd.NaT):
        return None
    if isinstance(value, datetime):
        return value

    parsed = pd.to_datetime(value, utc=False, errors="coerce")
    if pd.isna(parsed):
        return None
    if isinstance(parsed, pd.Timestamp):
        return parsed.to_pydatetime()
    return parsed


def _coerce_optional_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _coerce_optional_int(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _coerce_optional_float(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _coerce_optional_bool(value: Any) -> Optional[bool]:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes"}:
            return True
        if normalized in {"false", "0", "no"}:
            return False
    return bool(value)
