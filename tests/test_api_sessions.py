"""Tests for the cascading session-selection API endpoints.

Exercises:
    GET /api/seasons
    GET /api/seasons/{year}/events
    GET /api/seasons/{year}/events/{grand_prix}/sessions
"""

from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# GET /api/seasons
# ---------------------------------------------------------------------------


class TestListSeasons:
    def test_returns_list_of_seasons(self):
        resp = client.get("/api/seasons")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_seasons_are_descending(self):
        resp = client.get("/api/seasons")
        years = [s["year"] for s in resp.json()]
        assert years == sorted(years, reverse=True)

    def test_seasons_start_from_2018(self):
        resp = client.get("/api/seasons")
        years = [s["year"] for s in resp.json()]
        assert min(years) == 2018

    def test_each_season_has_year_field(self):
        resp = client.get("/api/seasons")
        for season in resp.json():
            assert "year" in season
            assert isinstance(season["year"], int)


# ---------------------------------------------------------------------------
# GET /api/seasons/{year}/events
# ---------------------------------------------------------------------------


def _mock_schedule() -> pd.DataFrame:
    """Create a minimal mock event schedule DataFrame."""
    return pd.DataFrame(
        {
            "RoundNumber": [1, 2, 0],
            "Country": ["Bahrain", "Saudi Arabia", "Testing"],
            "Location": ["Sakhir", "Jeddah", "Bahrain"],
            "EventName": ["Bahrain Grand Prix", "Saudi Arabian Grand Prix", "Pre-Season Testing"],
            "EventDate": pd.to_datetime(["2024-03-02", "2024-03-09", "2024-02-21"]),
            "EventFormat": ["conventional", "conventional", "testing"],
        }
    )


class TestListEvents:
    @patch("api.fastf1.get_event_schedule")
    def test_returns_events_for_year(self, mock_sched):
        mock_sched.return_value = _mock_schedule()
        resp = client.get("/api/seasons/2024/events")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        # Testing events should be filtered out
        names = [e["event_name"] for e in data]
        assert "Pre-Season Testing" not in names
        assert "Bahrain Grand Prix" in names

    @patch("api.fastf1.get_event_schedule")
    def test_event_fields(self, mock_sched):
        mock_sched.return_value = _mock_schedule()
        resp = client.get("/api/seasons/2024/events")
        event = resp.json()[0]
        assert "round_number" in event
        assert "country" in event
        assert "location" in event
        assert "event_name" in event
        assert "event_date" in event
        assert "event_format" in event

    @patch("api.fastf1.get_event_schedule", side_effect=Exception("no data"))
    def test_invalid_year_returns_404(self, mock_sched):
        resp = client.get("/api/seasons/1900/events")
        assert resp.status_code == 404

    @patch("api.fastf1.get_event_schedule")
    def test_empty_schedule_returns_404(self, mock_sched):
        mock_sched.return_value = pd.DataFrame()
        resp = client.get("/api/seasons/2024/events")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/seasons/{year}/events/{grand_prix}/sessions
# ---------------------------------------------------------------------------


def _mock_event() -> pd.Series:
    """Create a minimal mock event Series with session columns."""
    return pd.Series(
        {
            "Session1": "Practice 1",
            "Session1Date": pd.Timestamp("2024-03-01 11:30:00"),
            "Session2": "Practice 2",
            "Session2Date": pd.Timestamp("2024-03-01 15:00:00"),
            "Session3": "Practice 3",
            "Session3Date": pd.Timestamp("2024-03-02 12:30:00"),
            "Session4": "Qualifying",
            "Session4Date": pd.Timestamp("2024-03-02 16:00:00"),
            "Session5": "Race",
            "Session5Date": pd.Timestamp("2024-03-03 15:00:00"),
        }
    )


class TestListSessions:
    @patch("api.fastf1.get_event")
    def test_returns_sessions_for_event(self, mock_event):
        mock_event.return_value = _mock_event()
        resp = client.get("/api/seasons/2024/events/Bahrain Grand Prix/sessions")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 5
        session_names = [s["session_name"] for s in data]
        assert "Race" in session_names
        assert "Qualifying" in session_names
        assert "Practice 1" in session_names

    @patch("api.fastf1.get_event")
    def test_session_fields(self, mock_event):
        mock_event.return_value = _mock_event()
        resp = client.get("/api/seasons/2024/events/Bahrain Grand Prix/sessions")
        session = resp.json()[0]
        assert "session_key" in session
        assert "session_name" in session
        assert "session_date" in session

    @patch("api.fastf1.get_event", side_effect=Exception("not found"))
    def test_invalid_event_returns_404(self, mock_event):
        resp = client.get("/api/seasons/2024/events/Nonexistent/sessions")
        assert resp.status_code == 404

    @patch("api.fastf1.get_event")
    def test_numeric_grand_prix(self, mock_event):
        """Round numbers should be accepted as grand_prix identifier."""
        mock_event.return_value = _mock_event()
        resp = client.get("/api/seasons/2024/events/1/sessions")
        assert resp.status_code == 200
        # Verify it was called with int(1) not str("1")
        mock_event.assert_called_once_with(2024, 1)

    @patch("api.fastf1.get_event")
    def test_sprint_weekend_sessions(self, mock_event):
        """Sprint weekends have different session structure."""
        sprint_event = pd.Series(
            {
                "Session1": "Practice 1",
                "Session1Date": pd.Timestamp("2024-04-05 12:30:00"),
                "Session2": "Sprint Qualifying",
                "Session2Date": pd.Timestamp("2024-04-05 16:30:00"),
                "Session3": "Sprint",
                "Session3Date": pd.Timestamp("2024-04-06 12:00:00"),
                "Session4": "Qualifying",
                "Session4Date": pd.Timestamp("2024-04-06 16:00:00"),
                "Session5": "Race",
                "Session5Date": pd.Timestamp("2024-04-07 15:00:00"),
            }
        )
        mock_event.return_value = sprint_event
        resp = client.get("/api/seasons/2024/events/Chinese Grand Prix/sessions")
        assert resp.status_code == 200
        names = [s["session_name"] for s in resp.json()]
        assert "Sprint Qualifying" in names
        assert "Sprint" in names


# ---------------------------------------------------------------------------
# GET /api/health
# ---------------------------------------------------------------------------


class TestHealthCheck:
    def test_health_check(self):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# Cascading dependency test (integration-style with mocks)
# ---------------------------------------------------------------------------


class TestCascadingFlow:
    """Verify the cascading selection flow: seasons → events → sessions."""

    @patch("api.fastf1.get_event")
    @patch("api.fastf1.get_event_schedule")
    def test_full_cascade(self, mock_sched, mock_event):
        # Step 1: Get seasons
        resp = client.get("/api/seasons")
        assert resp.status_code == 200
        years = [s["year"] for s in resp.json()]
        assert 2024 in years

        # Step 2: Get events for a year
        mock_sched.return_value = _mock_schedule()
        resp = client.get("/api/seasons/2024/events")
        assert resp.status_code == 200
        events = resp.json()
        gp_name = events[0]["event_name"]
        assert gp_name == "Bahrain Grand Prix"

        # Step 3: Get sessions for that event
        mock_event.return_value = _mock_event()
        resp = client.get(f"/api/seasons/2024/events/{gp_name}/sessions")
        assert resp.status_code == 200
        sessions = resp.json()
        assert any(s["session_name"] == "Race" for s in sessions)
