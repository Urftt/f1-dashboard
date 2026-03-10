import json
from pathlib import Path
from typing import Any, Dict

import pandas as pd
import pytest

from data_fetcher import F1DataFetcher
from replay_data import ReplaySession, normalize_replay_session


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "replay_session.json"


def _load_fixture_payload() -> Dict[str, Any]:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


@pytest.fixture
def replay_fixture_payload() -> Dict[str, Any]:
    return _load_fixture_payload()


@pytest.fixture
def replay_session_row(replay_fixture_payload: Dict[str, Any]) -> Dict[str, Any]:
    return dict(replay_fixture_payload["session"])


@pytest.fixture
def replay_driver_rows(replay_fixture_payload: Dict[str, Any]) -> list[Dict[str, Any]]:
    return [dict(row) for row in replay_fixture_payload["drivers"]]


@pytest.fixture
def replay_lap_rows(replay_fixture_payload: Dict[str, Any]) -> list[Dict[str, Any]]:
    return [dict(row) for row in replay_fixture_payload["laps"]]


@pytest.fixture
def replay_lap_frame(replay_lap_rows: list[Dict[str, Any]]) -> pd.DataFrame:
    return pd.DataFrame(replay_lap_rows)


@pytest.fixture
def replay_session(
    replay_session_row: Dict[str, Any],
    replay_driver_rows: list[Dict[str, Any]],
    replay_lap_frame: pd.DataFrame,
) -> ReplaySession:
    return normalize_replay_session(
        session_row=replay_session_row,
        driver_rows=replay_driver_rows,
        lap_rows=replay_lap_frame,
    )


@pytest.fixture
def replay_fetcher(
    replay_session_row: Dict[str, Any],
    replay_driver_rows: list[Dict[str, Any]],
    replay_lap_frame: pd.DataFrame,
    monkeypatch: pytest.MonkeyPatch,
) -> F1DataFetcher:
    fetcher = F1DataFetcher()

    monkeypatch.setattr(
        fetcher,
        "_get_session_row",
        lambda session_key: dict(replay_session_row) if session_key == 999001 else None,
    )
    monkeypatch.setattr(
        fetcher,
        "_get_driver_rows",
        lambda session_key: [dict(row) for row in replay_driver_rows] if session_key == 999001 else [],
    )
    monkeypatch.setattr(
        fetcher,
        "get_session_lap_data",
        lambda session_key, driver_numbers: replay_lap_frame.copy()
        if session_key == 999001
        else pd.DataFrame(),
    )

    return fetcher
