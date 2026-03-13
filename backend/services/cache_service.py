"""Cache service for FastF1 session cache detection."""

from pathlib import Path

# Cache directory relative to this file's parent (backend/)
CACHE_DIR = Path(__file__).parent.parent / "cache"


def is_session_cached(year: int, event: str, session_type: str) -> bool:
    """Best-effort check whether a session's cache files exist on disk.

    FastF1 does not expose a public is_cached() API.
    We use a filesystem glob check as a pragmatic indicator.
    May have false positives if partial cache files exist.
    """
    if not CACHE_DIR.exists():
        return False

    # FastF1 caches files with the session type in the filename
    # Search for any file containing the session_type identifier
    session_type_normalized = session_type.lower().replace(" ", "_")
    candidates = list(CACHE_DIR.glob(f"**/*{session_type_normalized}*"))
    if candidates:
        return True

    # Also check with original casing (FastF1 may use different conventions)
    candidates = list(CACHE_DIR.glob(f"**/*{session_type}*"))
    return len(candidates) > 0
