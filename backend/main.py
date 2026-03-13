"""FastAPI application entrypoint for the F1 Dashboard backend."""

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

import fastf1
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import schedule, sessions

CACHE_DIR = Path(__file__).parent / "cache"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan: initialize FastF1 cache and session locks on startup."""
    # Create cache directory if it doesn't exist
    CACHE_DIR.mkdir(exist_ok=True)
    # Enable FastF1 disk cache — call once at startup, never per-request
    fastf1.Cache.enable_cache(str(CACHE_DIR))
    # Per-session locks prevent concurrent duplicate loads
    app.state.session_locks: dict[str, asyncio.Lock] = {}
    yield
    # Shutdown — nothing to clean up for FastF1


app = FastAPI(
    title="F1 Dashboard API",
    description="FastAPI backend for F1 historical session data via FastF1",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS: allow localhost dev origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(schedule.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}
