"""
Session selection UI component with cascading dropdowns (year → grand prix → session type).
Uses FastF1 for schedule data.
"""
import streamlit as st
import fastf1
from datetime import datetime
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)

# Session types in preferred display order
SESSION_KEYS = [
    ("Session5", "Race"),
    ("Session4", "Qualifying"),
    ("Session3", None),  # varies: Practice 3 or Sprint
    ("Session2", None),  # varies: Practice 2 or Sprint Qualifying
    ("Session1", "Practice 1"),
]


def _get_available_years() -> list[int]:
    """Return list of years with F1 data available (2018–current)."""
    current_year = datetime.now().year
    return list(range(current_year, 2017, -1))


@st.cache_data(ttl=3600, show_spinner=False)
def _fetch_schedule(year: int) -> list[dict]:
    """Fetch and cache the event schedule for a given year.

    Returns a list of dicts with keys: round, name, event_format, sessions.
    Each session entry is (session_key, session_name, session_date_utc).
    """
    try:
        schedule = fastf1.get_event_schedule(year)
        events = []
        for _, row in schedule.iterrows():
            round_num = int(row["RoundNumber"])
            if round_num == 0:
                continue  # skip pre-season testing
            sessions = []
            for i in range(1, 6):
                sname = row.get(f"Session{i}", "")
                sdate = row.get(f"Session{i}DateUtc", None)
                if sname:
                    sessions.append({
                        "key": f"Session{i}",
                        "name": str(sname),
                        "date_utc": str(sdate) if sdate else "",
                    })
            events.append({
                "round": round_num,
                "name": str(row["EventName"]),
                "country": str(row.get("Country", "")),
                "event_format": str(row.get("EventFormat", "conventional")),
                "event_date": str(row.get("EventDate", "")),
                "sessions": sessions,
            })
        return events
    except Exception as e:
        logger.error(f"Failed to fetch schedule for {year}: {e}")
        raise


class SessionSelection:
    """Holds the result of the session selector."""

    def __init__(self, year: int, event_name: str, round_number: int,
                 session_name: str, session_key: str):
        self.year = year
        self.event_name = event_name
        self.round_number = round_number
        self.session_name = session_name
        self.session_key = session_key  # e.g. "Session5"

    def __repr__(self) -> str:
        return (f"SessionSelection({self.year} {self.event_name} "
                f"- {self.session_name})")


def render_session_selector(sidebar: bool = True) -> Optional[SessionSelection]:
    """Render cascading session selector dropdowns.

    Parameters
    ----------
    sidebar : bool
        If True, render inside st.sidebar; otherwise render in main area.

    Returns
    -------
    SessionSelection or None
        The user's selection, or None if not yet fully selected / load not clicked.
    """
    container = st.sidebar if sidebar else st

    container.subheader("📅 Session Selection")

    # ── Year dropdown ──────────────────────────────────────────────
    years = _get_available_years()
    selected_year = container.selectbox(
        "Year",
        years,
        index=0,
        key="sel_year",
    )

    # ── Fetch schedule for selected year ───────────────────────────
    events: list[dict] = []
    schedule_error: Optional[str] = None

    try:
        with container.container():
            schedule_placeholder = container.empty()
            # Show a small spinner only while loading
            if f"_schedule_cache_{selected_year}" not in st.session_state:
                schedule_placeholder.info(f"⏳ Loading {selected_year} schedule…")
            events = _fetch_schedule(selected_year)
            st.session_state[f"_schedule_cache_{selected_year}"] = True
            schedule_placeholder.empty()
    except Exception as e:
        schedule_error = str(e)

    if schedule_error:
        container.error(f"❌ Failed to load schedule: {schedule_error}")
        if container.button("🔄 Retry", key="retry_schedule"):
            _fetch_schedule.clear()
            st.rerun()
        return None

    if not events:
        container.warning("No events found for this year.")
        return None

    # ── Grand Prix dropdown ────────────────────────────────────────
    event_names = [f"R{e['round']:02d} – {e['name']}" for e in events]
    selected_event_idx = container.selectbox(
        "Grand Prix",
        range(len(event_names)),
        format_func=lambda i: event_names[i],
        key="sel_gp",
    )
    selected_event = events[selected_event_idx]

    # ── Session type dropdown ──────────────────────────────────────
    sessions = selected_event["sessions"]
    if not sessions:
        container.warning("No sessions available for this event.")
        return None

    # Reverse so Race is first in dropdown
    sessions_reversed = list(reversed(sessions))
    session_labels = [s["name"] for s in sessions_reversed]

    selected_session_idx = container.selectbox(
        "Session",
        range(len(session_labels)),
        format_func=lambda i: session_labels[i],
        key="sel_session_type",
    )
    selected_session = sessions_reversed[selected_session_idx]

    # ── Summary & Load button ──────────────────────────────────────
    container.caption(
        f"**{selected_event['name']}** · {selected_session['name']} · "
        f"{selected_session['date_utc'][:10] if selected_session['date_utc'] else 'TBD'}"
    )

    load_clicked = container.button("📥 Load Session", type="primary", key="btn_load_session")

    if load_clicked:
        selection = SessionSelection(
            year=selected_year,
            event_name=selected_event["name"],
            round_number=selected_event["round"],
            session_name=selected_session["name"],
            session_key=selected_session["key"],
        )
        return selection

    return None
