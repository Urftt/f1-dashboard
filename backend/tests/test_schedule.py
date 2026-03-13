"""Tests for the schedule API endpoints."""

from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock

import pandas as pd
import pytest


class TestGetSchedule:
    """Tests for GET /api/schedule/{year}."""

    async def test_get_schedule_returns_events(self, client, mock_schedule):
        """GET /api/schedule/2024 returns 200 with list of EventSummary objects."""
        with patch("services.fastf1_service.fastf1.get_event_schedule", return_value=mock_schedule):
            response = await client.get("/api/schedule/2024")

        assert response.status_code == 200
        events = response.json()
        assert isinstance(events, list)
        assert len(events) > 0

        # Check EventSummary structure
        event = events[0]
        assert "round" in event
        assert "name" in event
        assert "country" in event
        assert "is_cached" in event

    async def test_only_completed_events(self, client, mock_schedule):
        """Schedule endpoint returns only past events (EventDate < now)."""
        with patch("services.fastf1_service.fastf1.get_event_schedule", return_value=mock_schedule):
            response = await client.get("/api/schedule/2024")

        assert response.status_code == 200
        events = response.json()
        # mock_schedule has 2 past events and 1 future — only 2 should be returned
        assert len(events) == 2
        names = [e["name"] for e in events]
        assert "Bahrain Grand Prix" in names
        assert "Saudi Arabian Grand Prix" in names
        assert "Australian Grand Prix" not in names

    async def test_schedule_invalid_year_below_min(self, client):
        """GET /api/schedule/2015 returns 400 (below 2018 minimum)."""
        response = await client.get("/api/schedule/2015")
        assert response.status_code == 400
        assert "2018" in response.json()["detail"]

    async def test_schedule_invalid_year_future(self, client):
        """GET /api/schedule with future year returns 400."""
        future_year = datetime.now(timezone.utc).year + 1
        response = await client.get(f"/api/schedule/{future_year}")
        assert response.status_code == 400

    async def test_schedule_valid_year_2018(self, client, mock_schedule):
        """GET /api/schedule/2018 returns 200 (minimum valid year)."""
        with patch("services.fastf1_service.fastf1.get_event_schedule", return_value=mock_schedule):
            response = await client.get("/api/schedule/2018")
        assert response.status_code == 200


class TestSessionTypes:
    """Tests for GET /api/schedule/{year}/{event_name}/session-types."""

    async def test_session_types_for_event(self, client):
        """GET /api/schedule/2024/{event}/session-types returns available session types."""
        mock_event = MagicMock()
        mock_event.Session1 = "Practice 1"
        mock_event.Session2 = "Practice 2"
        mock_event.Session3 = "Practice 3"
        mock_event.Session4 = "Qualifying"
        mock_event.Session5 = "Race"

        with patch("services.fastf1_service.fastf1.get_event", return_value=mock_event):
            response = await client.get("/api/schedule/2024/Monaco Grand Prix/session-types")

        assert response.status_code == 200
        session_types = response.json()
        assert isinstance(session_types, list)
        assert len(session_types) == 5

        keys = [st["key"] for st in session_types]
        assert "Race" in keys
        assert "Qualifying" in keys
        assert "Practice 1" in keys

    async def test_session_types_invalid_year(self, client):
        """GET /api/schedule/2015/{event}/session-types returns 400."""
        response = await client.get("/api/schedule/2015/Monaco Grand Prix/session-types")
        assert response.status_code == 400
