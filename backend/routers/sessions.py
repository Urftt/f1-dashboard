"""Sessions router: SSE session loading endpoint."""

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from services.fastf1_service import load_session_stream

router = APIRouter()


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
