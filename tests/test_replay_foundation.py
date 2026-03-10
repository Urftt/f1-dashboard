from data_fetcher import F1DataFetcher
from data_processor import (
    get_current_tyre_age,
    get_current_tyre_compound,
    get_driver_snapshot,
    get_latest_known_lap,
)
from replay_data import normalize_replay_session


def test_load_replay_session_uses_local_fixture_contract(
    replay_fetcher: F1DataFetcher,
) -> None:
    replay_session = replay_fetcher.load_replay_session(999001)

    assert replay_session is not None
    assert replay_session.session_key == 999001
    assert replay_session.driver_numbers == [16, 44]
    assert replay_session.max_lap_number == 4

    assert replay_fetcher.current_session_key == 999001
    assert replay_fetcher.current_replay_session == replay_session
    assert replay_fetcher.get_driver_list() == ["LEC", "HAM"]


def test_normalize_replay_session_collapses_duplicate_lap_rows_deterministically(
    replay_session_row,
    replay_driver_rows,
    replay_lap_frame,
) -> None:
    replay_session = normalize_replay_session(
        session_row=replay_session_row,
        driver_rows=replay_driver_rows,
        lap_rows=replay_lap_frame,
    )

    driver_laps = replay_session.get_driver_laps(44)
    lap_two = next(lap for lap in driver_laps if lap.lap_number == 2)

    assert len(replay_session.ordered_laps) == 8
    assert [lap.lap_number for lap in driver_laps] == [1, 2, 3, 4]
    assert lap_two.position == 1
    assert lap_two.lap_duration == 89.0
    assert lap_two.date_start.isoformat() == "2024-07-07T14:01:32"


def test_latest_known_lap_uses_replay_position_and_session_clamp(
    replay_session,
) -> None:
    lap_at_three = get_latest_known_lap(replay_session, 44, 3)
    lap_past_finish = get_latest_known_lap(replay_session, 44, 99)
    lap_before_first = get_latest_known_lap(replay_session, 44, 0)

    assert lap_at_three is not None
    assert lap_at_three.lap_number == 3

    assert lap_past_finish is not None
    assert lap_past_finish.lap_number == 4

    assert lap_before_first is not None
    assert lap_before_first.lap_number == 1


def test_current_tyre_compound_handles_pit_stop_and_source_field_fallback(
    replay_session,
) -> None:
    assert get_current_tyre_compound(replay_session, 44, 3) == "MEDIUM"
    assert get_current_tyre_compound(replay_session, 44, 4) == "SOFT"

    assert get_current_tyre_compound(replay_session, 16, 1) is None
    assert get_current_tyre_compound(replay_session, 16, 3) == "HARD"
    assert get_current_tyre_compound(replay_session, 16, 4) == "HARD"


def test_current_tyre_age_uses_explicit_values_and_stint_inference(
    replay_session,
) -> None:
    assert get_current_tyre_age(replay_session, 44, 4) == 0

    assert get_current_tyre_age(replay_session, 16, 1) == 0
    assert get_current_tyre_age(replay_session, 16, 2) == 0
    assert get_current_tyre_age(replay_session, 16, 3) == 1
    assert get_current_tyre_age(replay_session, 16, 4) == 2


def test_driver_snapshot_returns_stable_missing_field_fallbacks(
    replay_session,
) -> None:
    opening_snapshot = get_driver_snapshot(replay_session, 16, 1)
    pit_exit_snapshot = get_driver_snapshot(replay_session, 44, 4)

    assert opening_snapshot == {
        "driver_number": 16,
        "driver_name": "LEC",
        "replay_lap": 1,
        "latest_known_lap": 1,
        "position": 2,
        "current_compound": "Unknown",
        "compound_display": "Compound unavailable",
        "current_tyre_age": 0,
        "tyre_age_display": "0 laps",
    }

    assert pit_exit_snapshot["driver_number"] == 44
    assert pit_exit_snapshot["driver_name"] == "HAM"
    assert pit_exit_snapshot["replay_lap"] == 4
    assert pit_exit_snapshot["latest_known_lap"] == 4
    assert pit_exit_snapshot["position"] == 1
    assert pit_exit_snapshot["current_compound"] == "SOFT"
    assert pit_exit_snapshot["compound_display"] == "SOFT"
    assert pit_exit_snapshot["current_tyre_age"] == 0
    assert pit_exit_snapshot["tyre_age_display"] == "0 laps"
