"""Schedule router: event listing and session type endpoints."""

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from models.schemas import EventSummary, SessionTypeInfo
from services.cache_service import is_session_cached
from services.fastf1_service import get_completed_events, get_session_types

router = APIRouter()

_CURRENT_YEAR = datetime.now(timezone.utc).year
_MIN_YEAR = 2018


@router.get("/schedule/{year}", response_model=list[EventSummary])
async def get_schedule(year: int) -> list[EventSummary]:
    """Return list of completed events for the given year.

    Year must be between 2018 and the current year.
    Events are filtered to only those with EventDate in the past.
    Each event includes an is_cached flag for UI indicators.
    """
    if year < _MIN_YEAR or year > _CURRENT_YEAR:
        raise HTTPException(
            status_code=400,
            detail=f"Year must be between {_MIN_YEAR} and {_CURRENT_YEAR}",
        )

    events = await asyncio.to_thread(get_completed_events, year)
    return [
        EventSummary(
            round=e["round"],
            name=e["name"],
            country=e["country"],
            is_cached=is_session_cached(year, e["name"], "Race"),
        )
        for e in events
    ]


@router.get("/schedule/{year}/{event_name}/session-types", response_model=list[SessionTypeInfo])
async def get_event_session_types(year: int, event_name: str) -> list[SessionTypeInfo]:
    """Return list of available session types for the given event.

    Year must be between 2018 and the current year.
    """
    if year < _MIN_YEAR or year > _CURRENT_YEAR:
        raise HTTPException(
            status_code=400,
            detail=f"Year must be between {_MIN_YEAR} and {_CURRENT_YEAR}",
        )

    session_types = await asyncio.to_thread(get_session_types, year, event_name)
    return [
        SessionTypeInfo(key=st["key"], name=st["name"])
        for st in session_types
    ]
