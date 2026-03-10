from datetime import timedelta

import pandas as pd

from data_processor import (
    build_replay_view_model,
    filter_interval_history_for_replay,
    filter_interval_history_from_controller,
    get_cached_replay_interval_history,
    get_replay_snapshot_from_controller,
    resolve_replay_lap_from_controller,
)
from replay_controls import (
    advance_replay,
    advance_replay_state,
    initialize_replay_state,
    initialize_replay_session_state,
    jump_replay_to_finish,
    jump_replay_to_start,
    pause_replay,
    restart_replay_state,
    resume_replay,
    resume_replay_state,
    scrub_replay_to_lap,
    scrub_replay_state,
    set_replay_speed_state,
    set_replay_speed,
    start_replay,
    start_replay_state,
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


def test_speed_change_rebases_from_current_effective_lap(replay_session, replay_controller_state, replay_clock_start):
    started = start_replay(replay_controller_state, now=replay_clock_start)

    faster = set_replay_speed(
        started,
        playback_speed=2.0,
        now=replay_clock_start + timedelta(seconds=2),
    )
    advanced = advance_replay(
        faster,
        now=replay_clock_start + timedelta(seconds=3),
    )

    assert faster.status == "playing"
    assert faster.current_lap == 3
    assert faster.anchor_lap == 3
    assert faster.started_at == replay_clock_start + timedelta(seconds=2)
    assert faster.playback_speed == 2.0
    assert advanced.current_lap == 4
    assert resolve_replay_lap_from_controller(
        replay_session,
        advanced,
        now=replay_clock_start + timedelta(seconds=3),
    ) == 4


def test_speed_change_while_paused_keeps_replay_paused(replay_controller_state, replay_clock_start):
    started = start_replay(replay_controller_state, now=replay_clock_start)
    paused = pause_replay(
        started,
        now=replay_clock_start + timedelta(seconds=2),
    )

    changed = set_replay_speed(
        paused,
        playback_speed=7.0,
        now=replay_clock_start + timedelta(seconds=3),
    )

    assert changed.status == "paused"
    assert changed.current_lap == 3
    assert changed.anchor_lap == 3
    assert changed.started_at is None
    assert changed.playback_speed == 5.0


def test_scrub_clamps_requested_lap_to_session_bounds(replay_controller_state, replay_clock_start):
    scrubbed = scrub_replay_to_lap(
        replay_controller_state,
        requested_lap=99,
        now=replay_clock_start,
    )
    rewound = scrub_replay_to_lap(
        replay_controller_state,
        requested_lap=-4,
        now=replay_clock_start,
    )

    assert scrubbed.current_lap == 4
    assert scrubbed.anchor_lap == 4
    assert scrubbed.status == "stopped"
    assert scrubbed.started_at is None
    assert rewound.current_lap == 1
    assert rewound.anchor_lap == 1


def test_jump_helpers_land_on_session_edges(replay_controller_state, replay_clock_start):
    to_finish = jump_replay_to_finish(
        replay_controller_state,
        now=replay_clock_start,
    )
    to_start = jump_replay_to_start(
        to_finish,
        now=replay_clock_start + timedelta(seconds=1),
    )

    assert to_finish.current_lap == 4
    assert to_finish.anchor_lap == 4
    assert to_start.current_lap == 1
    assert to_start.anchor_lap == 1


def test_scrub_while_playing_restarts_anchor_from_requested_lap(replay_session, replay_controller_state, replay_clock_start):
    started = start_replay(replay_controller_state, now=replay_clock_start)

    scrubbed = scrub_replay_to_lap(
        started,
        requested_lap=2,
        now=replay_clock_start + timedelta(seconds=2),
    )
    advanced = advance_replay(
        scrubbed,
        now=replay_clock_start + timedelta(seconds=4),
    )

    assert scrubbed.status == "playing"
    assert scrubbed.current_lap == 2
    assert scrubbed.anchor_lap == 2
    assert scrubbed.started_at == replay_clock_start + timedelta(seconds=2)
    assert advanced.current_lap == 4
    assert resolve_replay_lap_from_controller(
        replay_session,
        advanced,
        now=replay_clock_start + timedelta(seconds=4),
    ) == 4


def test_controller_history_filter_returns_prefix_without_mutating_source(replay_session, replay_controller_state, replay_clock_start):
    interval_history = pd.DataFrame(
        [
            {"lap_number": 1, "interval": 0.5},
            {"lap_number": 2, "interval": 0.8},
            {"lap_number": 3, "interval": 1.1},
            {"lap_number": 4, "interval": 1.4},
        ]
    )
    scrubbed = scrub_replay_to_lap(
        replay_controller_state,
        requested_lap=3,
        now=replay_clock_start,
    )

    visible_history = filter_interval_history_from_controller(
        replay_session,
        interval_history,
        scrubbed,
        now=replay_clock_start,
    )

    assert list(visible_history["lap_number"]) == [1, 2, 3]
    assert list(interval_history["lap_number"]) == [1, 2, 3, 4]


def test_scrubbed_controller_snapshot_uses_new_visible_lap(replay_session, replay_controller_state, replay_clock_start):
    scrubbed = scrub_replay_to_lap(
        replay_controller_state,
        requested_lap=3,
        now=replay_clock_start,
    )

    snapshot = get_replay_snapshot_from_controller(
        replay_session,
        [16, 44],
        scrubbed,
        now=replay_clock_start,
    )

    assert snapshot[16]["replay_lap"] == 3
    assert snapshot[16]["latest_known_lap"] == 3
    assert snapshot[44]["replay_lap"] == 3
    assert snapshot[44]["latest_known_lap"] == 3


def test_session_state_helpers_initialize_at_lap_one_and_first_play_does_not_jump_to_finish(
    replay_session,
    replay_clock_start,
):
    session_state = {}

    initialized = initialize_replay_session_state(
        session_state,
        replay_session.max_lap_number,
    )
    started = start_replay_state(session_state, now=replay_clock_start)
    advanced = advance_replay_state(
        session_state,
        now=replay_clock_start + timedelta(seconds=1),
    )

    assert initialized.current_lap == 1
    assert session_state["replay_status"] == "playing"
    assert started.current_lap == 1
    assert advanced.current_lap == 2
    assert advanced.current_lap != replay_session.max_lap_number


def test_cached_pair_history_refreshes_for_new_driver_pair(replay_session):
    history_cache = {}

    first_key, first_history, first_refreshed = get_cached_replay_interval_history(
        history_cache,
        session_key=999001,
        replay_session=replay_session,
        driver1_num=16,
        driver2_num=44,
    )
    second_key, second_history, second_refreshed = get_cached_replay_interval_history(
        history_cache,
        session_key=999001,
        replay_session=replay_session,
        driver1_num=44,
        driver2_num=16,
    )
    third_key, third_history, third_refreshed = get_cached_replay_interval_history(
        history_cache,
        session_key=999001,
        replay_session=replay_session,
        driver1_num=16,
        driver2_num=1,
    )

    assert first_refreshed is True
    assert second_refreshed is False
    assert third_refreshed is True
    assert first_key == second_key
    assert third_key != first_key
    assert not first_history.empty
    assert third_history.empty


def test_replay_view_model_keeps_visible_history_and_snapshots_on_same_lap(
    replay_session,
    replay_controller_state,
    replay_clock_start,
):
    full_history = pd.DataFrame(
        [
            {"lap_number": 1, "interval": 0.5, "position_d1": 1, "position_d2": 2, "interval_change": None, "closing_rate": None},
            {"lap_number": 2, "interval": 0.8, "position_d1": 1, "position_d2": 2, "interval_change": 0.3, "closing_rate": None},
            {"lap_number": 3, "interval": 1.1, "position_d1": 1, "position_d2": 2, "interval_change": 0.3, "closing_rate": 0.3},
            {"lap_number": 4, "interval": 1.4, "position_d1": 1, "position_d2": 2, "interval_change": 0.3, "closing_rate": 0.3},
        ]
    )
    scrubbed = scrub_replay_to_lap(
        replay_controller_state,
        requested_lap=3,
        now=replay_clock_start,
    )

    view_model = build_replay_view_model(
        replay_session,
        [16, 44],
        full_history,
        scrubbed,
        now=replay_clock_start,
    )

    assert view_model["replay_lap"] == 3
    assert list(view_model["visible_history"]["lap_number"]) == [1, 2, 3]
    assert view_model["stats"]["lap"] == 3
    assert view_model["snapshots"][16]["latest_known_lap"] == 3
    assert view_model["snapshots"][44]["latest_known_lap"] == 3
