"""Tests for the SSE session-loading endpoint and progress reporting.

Exercises:
    GET /api/sessions/load/stream — SSE progress events
    Internal: _emit_progress, _load_session_with_progress
"""

import asyncio
import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from api import (
    _emit_progress,
    _load_events,
    _load_progress,
    _loaded_sessions,
    app,
)

client = TestClient(app)


# ---------------------------------------------------------------------------
# Unit tests for _emit_progress
# ---------------------------------------------------------------------------


class TestEmitProgress:
    def setup_method(self):
        _load_progress.clear()
        _load_events.clear()

    def test_creates_progress_list_on_first_emit(self):
        _emit_progress("test-1", 0, "loading", "Starting...")
        assert "test-1" in _load_progress
        assert len(_load_progress["test-1"]) == 1
        assert _load_progress["test-1"][0]["percentage"] == 0
        assert _load_progress["test-1"][0]["status"] == "loading"

    def test_appends_to_existing_progress(self):
        _emit_progress("test-2", 0, "loading", "Step 1")
        _emit_progress("test-2", 50, "loading", "Step 2")
        _emit_progress("test-2", 100, "complete", "Done")
        assert len(_load_progress["test-2"]) == 3
        assert _load_progress["test-2"][-1]["status"] == "complete"

    def test_event_structure(self):
        _emit_progress("test-3", 42, "loading", "Downloading...")
        evt = _load_progress["test-3"][0]
        assert evt == {
            "load_id": "test-3",
            "percentage": 42,
            "status": "loading",
            "detail": "Downloading...",
        }

    def test_signals_asyncio_event_when_present(self):
        ae = asyncio.Event()
        _load_events["test-4"] = ae
        _emit_progress("test-4", 10, "loading", "test")
        assert ae.is_set()

    def test_no_error_when_no_event(self):
        """Should not raise even if there's no asyncio.Event for the load_id."""
        _emit_progress("no-event", 10, "loading", "test")
        assert len(_load_progress["no-event"]) == 1


# ---------------------------------------------------------------------------
# SSE endpoint integration tests
# ---------------------------------------------------------------------------


class TestSSEEndpoint:
    """Test the GET /api/sessions/load/stream SSE endpoint."""

    @patch("api._load_session_with_progress")
    def test_stream_returns_sse_content_type(self, mock_load):
        """The response should be text/event-stream."""

        def fake_load(load_id, year, gp, st):
            _emit_progress(load_id, 0, "loading", "Starting")
            _emit_progress(load_id, 100, "complete", json.dumps({
                "status": "loaded",
                "session_key": "2024::test::Race",
                "year": 2024,
                "event_name": "Test GP",
                "session_type": "Race",
                "num_drivers": 20,
                "total_laps": 57,
            }))

        mock_load.side_effect = fake_load

        with client.stream(
            "GET",
            "/api/sessions/load/stream",
            params={"year": 2024, "grand_prix": "test", "session_type": "Race"},
        ) as resp:
            assert resp.status_code == 200
            assert "text/event-stream" in resp.headers.get("content-type", "")

    @patch("api._load_session_with_progress")
    def test_stream_emits_progress_events(self, mock_load):
        """SSE stream should contain progress and completion events."""
        events_received = []

        def fake_load(load_id, year, gp, st):
            _emit_progress(load_id, 0, "loading", "Resolving session...")
            _emit_progress(load_id, 50, "loading", "Downloading...")
            _emit_progress(load_id, 100, "complete", json.dumps({
                "status": "loaded",
                "session_key": f"{year}::{gp}::{st}",
                "year": year,
                "event_name": "Test",
                "session_type": st,
                "num_drivers": 20,
                "total_laps": 50,
            }))

        mock_load.side_effect = fake_load

        with client.stream(
            "GET",
            "/api/sessions/load/stream",
            params={"year": 2024, "grand_prix": "Monaco", "session_type": "Race"},
        ) as resp:
            for line in resp.iter_lines():
                if line.startswith("data: "):
                    evt = json.loads(line[6:])
                    events_received.append(evt)
                    if evt["status"] in ("complete", "error"):
                        break

        assert len(events_received) >= 2
        # First event should be loading
        assert events_received[0]["status"] == "loading"
        # Last event should be complete
        assert events_received[-1]["status"] == "complete"
        assert events_received[-1]["percentage"] == 100

        # The complete event detail should be valid JSON with session info
        result = json.loads(events_received[-1]["detail"])
        assert result["status"] == "loaded"
        assert result["num_drivers"] == 20

    @patch("api._load_session_with_progress")
    def test_stream_emits_error_on_failure(self, mock_load):
        """If loading fails, the stream should emit an error event."""

        def fake_load(load_id, year, gp, st):
            _emit_progress(load_id, 0, "loading", "Starting...")
            _emit_progress(load_id, -1, "error", "Session not found")

        mock_load.side_effect = fake_load

        events_received = []
        with client.stream(
            "GET",
            "/api/sessions/load/stream",
            params={"year": 1999, "grand_prix": "Fake", "session_type": "Race"},
        ) as resp:
            for line in resp.iter_lines():
                if line.startswith("data: "):
                    evt = json.loads(line[6:])
                    events_received.append(evt)
                    if evt["status"] in ("complete", "error"):
                        break

        assert events_received[-1]["status"] == "error"
        assert "Session not found" in events_received[-1]["detail"]

    def test_stream_requires_query_params(self):
        """Missing query parameters should return 422."""
        resp = client.get("/api/sessions/load/stream")
        assert resp.status_code == 422

    def test_stream_requires_year(self):
        resp = client.get(
            "/api/sessions/load/stream",
            params={"grand_prix": "Monaco", "session_type": "Race"},
        )
        assert resp.status_code == 422

    @patch("api._load_session_with_progress")
    def test_all_events_have_load_id(self, mock_load):
        """Every SSE event should contain a load_id."""

        def fake_load(load_id, year, gp, st):
            _emit_progress(load_id, 0, "loading", "Step 1")
            _emit_progress(load_id, 100, "complete", json.dumps({
                "status": "loaded", "session_key": "k", "year": 2024,
                "event_name": "E", "session_type": "Race",
                "num_drivers": 1, "total_laps": 1,
            }))

        mock_load.side_effect = fake_load

        events_received = []
        with client.stream(
            "GET",
            "/api/sessions/load/stream",
            params={"year": 2024, "grand_prix": "test", "session_type": "Race"},
        ) as resp:
            for line in resp.iter_lines():
                if line.startswith("data: "):
                    evt = json.loads(line[6:])
                    events_received.append(evt)
                    if evt["status"] in ("complete", "error"):
                        break

        for evt in events_received:
            assert "load_id" in evt
            assert isinstance(evt["load_id"], str)
            assert len(evt["load_id"]) > 0

    @patch("api._load_session_with_progress")
    def test_percentage_increases_monotonically(self, mock_load):
        """Progress percentage should not decrease (except for error=-1)."""

        def fake_load(load_id, year, gp, st):
            _emit_progress(load_id, 0, "loading", "A")
            _emit_progress(load_id, 25, "loading", "B")
            _emit_progress(load_id, 50, "loading", "C")
            _emit_progress(load_id, 85, "loading", "D")
            _emit_progress(load_id, 100, "complete", json.dumps({
                "status": "loaded", "session_key": "k", "year": 2024,
                "event_name": "E", "session_type": "Race",
                "num_drivers": 1, "total_laps": 1,
            }))

        mock_load.side_effect = fake_load

        percentages = []
        with client.stream(
            "GET",
            "/api/sessions/load/stream",
            params={"year": 2024, "grand_prix": "test", "session_type": "Race"},
        ) as resp:
            for line in resp.iter_lines():
                if line.startswith("data: "):
                    evt = json.loads(line[6:])
                    percentages.append(evt["percentage"])
                    if evt["status"] in ("complete", "error"):
                        break

        # Check monotonic increase
        for i in range(1, len(percentages)):
            assert percentages[i] >= percentages[i - 1]
