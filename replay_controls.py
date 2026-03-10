"""
Pure replay controller helpers for lap-granular historical playback.
"""
from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime
from math import floor
from typing import Literal, Optional


ReplayStatus = Literal["stopped", "playing", "paused"]
MIN_PLAYBACK_SPEED = 0.5
MAX_PLAYBACK_SPEED = 5.0


@dataclass(frozen=True)
class ReplayControllerState:
    """Immutable replay playback state suitable for Streamlit session state."""

    max_lap_number: Optional[int]
    current_lap: Optional[int]
    status: ReplayStatus
    anchor_lap: Optional[int]
    started_at: Optional[datetime]
    seconds_per_lap: float = 1.0
    playback_speed: float = 1.0


def initialize_replay_state(
    max_lap_number: Optional[int],
    *,
    start_lap: int = 1,
    seconds_per_lap: float = 1.0,
    playback_speed: float = 1.0,
) -> ReplayControllerState:
    """Initialize historical replay at race start instead of the session end."""
    lap = clamp_replay_lap(start_lap, max_lap_number)
    return ReplayControllerState(
        max_lap_number=max_lap_number,
        current_lap=lap,
        status="stopped",
        anchor_lap=lap,
        started_at=None,
        seconds_per_lap=_normalize_positive_float(seconds_per_lap),
        playback_speed=_normalize_playback_speed(playback_speed),
    )


def start_replay(
    state: ReplayControllerState,
    *,
    now: datetime,
    start_lap: int = 1,
) -> ReplayControllerState:
    """Start playback from a chosen lap, defaulting to lap 1."""
    lap = clamp_replay_lap(start_lap, state.max_lap_number)
    return replace(
        state,
        current_lap=lap,
        status="playing",
        anchor_lap=lap,
        started_at=now,
    )


def pause_replay(
    state: ReplayControllerState,
    *,
    now: datetime,
) -> ReplayControllerState:
    """Pause playback while preserving the effective replay lap."""
    effective_lap = get_effective_replay_lap(state, now=now)
    return replace(
        state,
        current_lap=effective_lap,
        status="paused",
        anchor_lap=effective_lap,
        started_at=None,
    )


def resume_replay(
    state: ReplayControllerState,
    *,
    now: datetime,
) -> ReplayControllerState:
    """Resume playback from the paused lap instead of restarting."""
    effective_lap = get_effective_replay_lap(state, now=now)
    return replace(
        state,
        current_lap=effective_lap,
        status="playing",
        anchor_lap=effective_lap,
        started_at=now,
    )


def advance_replay(
    state: ReplayControllerState,
    *,
    now: datetime,
) -> ReplayControllerState:
    """Advance derived replay position and stop automatically at the session end."""
    effective_lap = get_effective_replay_lap(state, now=now)
    reached_end = (
        state.max_lap_number is not None
        and effective_lap is not None
        and effective_lap >= state.max_lap_number
    )
    if not reached_end:
        return replace(state, current_lap=effective_lap)

    return replace(
        state,
        current_lap=state.max_lap_number,
        status="stopped",
        anchor_lap=state.max_lap_number,
        started_at=None,
    )


def set_replay_speed(
    state: ReplayControllerState,
    *,
    playback_speed: float,
    now: datetime,
) -> ReplayControllerState:
    """Rebase playback speed changes on the current effective lap."""
    effective_lap = get_effective_replay_lap(state, now=now)
    normalized_speed = _normalize_playback_speed(playback_speed)
    started_at = now if state.status == "playing" else None
    return replace(
        state,
        current_lap=effective_lap,
        anchor_lap=effective_lap,
        started_at=started_at,
        playback_speed=normalized_speed,
    )


def scrub_replay_to_lap(
    state: ReplayControllerState,
    *,
    requested_lap: Optional[int],
    now: datetime,
) -> ReplayControllerState:
    """Move replay to a requested lap while preserving controller invariants."""
    target_lap = clamp_replay_lap(requested_lap, state.max_lap_number)
    started_at = now if state.status == "playing" else None
    return replace(
        state,
        current_lap=target_lap,
        anchor_lap=target_lap,
        started_at=started_at,
    )


def jump_replay_to_start(
    state: ReplayControllerState,
    *,
    now: datetime,
) -> ReplayControllerState:
    """Jump replay to the earliest visible lap in the session."""
    return scrub_replay_to_lap(state, requested_lap=1, now=now)


def jump_replay_to_finish(
    state: ReplayControllerState,
    *,
    now: datetime,
) -> ReplayControllerState:
    """Jump replay to the session boundary without exceeding max lap."""
    return scrub_replay_to_lap(
        state,
        requested_lap=state.max_lap_number,
        now=now,
    )


def get_effective_replay_lap(
    state: ReplayControllerState,
    *,
    now: Optional[datetime] = None,
) -> Optional[int]:
    """Derive the current replay lap from anchor state and elapsed wall time."""
    if state.current_lap is None:
        return None

    if state.status != "playing" or state.started_at is None or now is None:
        return clamp_replay_lap(state.current_lap, state.max_lap_number)

    elapsed_seconds = max((now - state.started_at).total_seconds(), 0.0)
    laps_advanced = floor(
        elapsed_seconds * state.playback_speed / state.seconds_per_lap
    )
    base_lap = state.anchor_lap if state.anchor_lap is not None else state.current_lap
    return clamp_replay_lap(base_lap + laps_advanced, state.max_lap_number)


def clamp_replay_lap(
    requested_lap: Optional[int],
    max_lap_number: Optional[int],
) -> Optional[int]:
    """Clamp lap requests onto the valid replay contract."""
    if max_lap_number is None:
        return None
    if requested_lap is None:
        return max_lap_number
    if requested_lap < 1:
        return 1
    return min(requested_lap, max_lap_number)


def _normalize_positive_float(value: float) -> float:
    numeric = float(value)
    if numeric <= 0:
        raise ValueError("Replay timing values must be positive")
    return numeric


def _normalize_playback_speed(value: float) -> float:
    numeric = _normalize_positive_float(value)
    return max(MIN_PLAYBACK_SPEED, min(numeric, MAX_PLAYBACK_SPEED))
