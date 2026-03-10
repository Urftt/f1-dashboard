from datetime import timedelta

import pandas as pd

from data_processor import (
    filter_interval_history_for_replay,
    resolve_replay_lap_from_controller,
)
from replay_controls import (
    advance_replay,
    initialize_replay_state,
    pause_replay,
    resume_replay,
    start_replay,
)


def test_start_initializes_replay_at_lap_one(replay_session, replay_clock_start):
    state = initialize_replay_state(replay_session.max_lap_number)

    started = start_replay(state, now=replay_clock_start)

    assert started.status == "playing"
    assert started.current_lap == 1
    assert started.anchor_lap == 1
    assert started.started_at == replay_clock_start
    assert resolve_replay_lap_from_controller(replay_session, started, now=replay_clock_start) == 1


def test_tick_advances_replay_lap_from_elapsed_time(replay_session, replay_controller_state, replay_clock_start):
    started = start_replay(replay_controller_state, now=replay_clock_start)

    advanced = advance_replay(
        started,
        now=replay_clock_start + timedelta(seconds=2),
    )

    assert advanced.status == "playing"
    assert advanced.current_lap == 3
    assert resolve_replay_lap_from_controller(
        replay_session,
        advanced,
        now=replay_clock_start + timedelta(seconds=2),
    ) == 3


def test_tick_stops_at_max_lap(replay_session, replay_controller_state, replay_clock_start):
    started = start_replay(replay_controller_state, now=replay_clock_start)

    advanced = advance_replay(
        started,
        now=replay_clock_start + timedelta(seconds=replay_session.max_lap_number + 10),
    )

    assert advanced.status == "stopped"
    assert advanced.current_lap == replay_session.max_lap_number
    assert advanced.anchor_lap == replay_session.max_lap_number
    assert advanced.started_at is None


def test_pause_preserves_effective_lap(replay_controller_state, replay_clock_start):
    started = start_replay(replay_controller_state, now=replay_clock_start)

    paused = pause_replay(
        started,
        now=replay_clock_start + timedelta(seconds=2),
    )

    assert paused.status == "paused"
    assert paused.current_lap == 3
    assert paused.anchor_lap == 3
    assert paused.started_at is None


def test_resume_continues_from_paused_lap(replay_controller_state, replay_clock_start):
    started = start_replay(replay_controller_state, now=replay_clock_start)
    paused = pause_replay(
        started,
        now=replay_clock_start + timedelta(seconds=2),
    )

    resumed = resume_replay(
        paused,
        now=replay_clock_start + timedelta(seconds=5),
    )
    advanced = advance_replay(
        resumed,
        now=replay_clock_start + timedelta(seconds=7),
    )

    assert resumed.status == "playing"
    assert resumed.current_lap == 3
    assert resumed.anchor_lap == 3
    assert advanced.current_lap == 4


def test_replay_history_filter_returns_visible_prefix():
    interval_history = pd.DataFrame(
        [
            {"lap_number": 1, "interval": 0.5},
            {"lap_number": 2, "interval": 0.8},
            {"lap_number": 3, "interval": 1.1},
        ]
    )

    visible_history = filter_interval_history_for_replay(interval_history, replay_lap=2)

    assert list(visible_history["lap_number"]) == [1, 2]
