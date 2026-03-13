"""Pydantic models for the F1 Dashboard API."""

from pydantic import BaseModel


class EventSummary(BaseModel):
    """Summary of a completed F1 Grand Prix event."""

    round: int
    name: str
    country: str
    is_cached: bool


class SessionTypeInfo(BaseModel):
    """Information about an available session type for an event."""

    key: str
    name: str



class ProgressEvent(BaseModel):
    """SSE progress event during session loading."""

    pct: int
    stage: str


class SafetyCarPeriod(BaseModel):
    """A period during a race when the safety car or virtual safety car was deployed."""

    start_lap: int
    end_lap: int
    type: str  # 'SC' | 'VSC' | 'RED'
