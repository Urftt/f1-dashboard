"""Sessions router: SSE session loading endpoint and sector data endpoint."""

import asyncio

import fastf1
from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from services.fastf1_service import load_session_stream, serialize_sectors

router = APIRouter()


@router.get("/sessions/sectors")
async def get_sectors(year: int, event: str, session_type: str):
    """Return per-driver per-lap sector times for a loaded session.

    Reuses FastF1 disk cache — no network fetch if session was already loaded.
    """
    session = await asyncio.to_thread(fastf1.get_session, year, event, session_type)
    await asyncio.to_thread(
        session.load, laps=True, telemetry=False, weather=False, messages=False
    )
    sectors = serialize_sectors(session)
    return {"sectors": sectors}


@router.get("/sessions/load")
async def load_session(
    year: int,
    event: str,
    session_type: str,
    request: Request,
) -> EventSourceResponse:
    """Stream SSE progress events while loading a FastF1 session.

    Yields progress events at named stages (5%, 20%, 50%, 80%),
    then a final complete event with serialized lap data.

    Query params:
        year: Season year (2018 - current)
        event: Event name (e.g. "Monaco Grand Prix")
        session_type: Session type (e.g. "Race", "Qualifying", "Practice 1")
    """
    return EventSourceResponse(
        load_session_stream(year, event, session_type, request.app)
    )
