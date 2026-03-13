"""Cache service for FastF1 session cache detection."""

from pathlib import Path

# Cache directory relative to this file's parent (backend/)
CACHE_DIR = Path(__file__).parent.parent / "cache"


def is_session_cached(year: int, event: str, session_type: str) -> bool:
    """Best-effort check whether a session's cache files exist on disk.

    FastF1 does not expose a public is_cached() API.
    We use a filesystem check as a pragmatic indicator.
    Comparison is case-insensitive.
    May have false positives if partial cache files exist.
    """
    if not CACHE_DIR.exists():
        return False

    session_type_lower = session_type.lower().replace(" ", "_")

    # Scan all files in the cache directory tree for a case-insensitive match
    for candidate in CACHE_DIR.rglob("*"):
        if candidate.is_file():
            filename_lower = candidate.name.lower()
            if session_type_lower in filename_lower:
                return True

    return False
