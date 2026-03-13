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


class LapData(BaseModel):
    """Lap data for a single lap from a session."""

    LapNumber: int | None
    Driver: str
    LapTime: float | None  # seconds
    Time: float | None  # session timestamp at lap end (seconds)
    PitInTime: float | None
    PitOutTime: float | None
    Compound: str | None
    TyreLife: float | None
    Position: int | None
    Stint: int | None


class ProgressEvent(BaseModel):
    """SSE progress event during session loading."""

    pct: int
    stage: str
