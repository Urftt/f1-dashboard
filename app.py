"""
F1 Interval Tracker - Main Streamlit Application
"""
from __future__ import annotations

from datetime import datetime
import logging
import time

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from config import (
    LIVE_UPDATE_INTERVAL,
    PLOT_HEIGHT,
    PLOT_TEMPLATE,
    POSITIVE_COLOR,
    NEGATIVE_COLOR,
    STREAMLIT_CONFIG,
    ZERO_LINE_COLOR,
)
from data_fetcher import F1DataFetcher, SessionRecorder
from data_processor import (
    IntervalCalculator,
    build_replay_view_model,
    get_cached_replay_interval_history,
    resolve_replay_lap_from_controller,
)
from replay_controls import (
    MAX_PLAYBACK_SPEED,
    MIN_PLAYBACK_SPEED,
    ReplayControllerState,
    advance_replay_state,
    initialize_replay_session_state,
    pause_replay_state,
    restart_replay_state,
    resume_replay_state,
    scrub_replay_state,
    set_replay_speed_state,
    start_replay_state,
)


logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

st.set_page_config(**STREAMLIT_CONFIG)

HISTORICAL_REPLAY_TICK_INTERVAL = "250ms"


def _initialize_session_state() -> None:
    if "fetcher" not in st.session_state:
        st.session_state.fetcher = F1DataFetcher()
    if "calculator" not in st.session_state:
        st.session_state.calculator = IntervalCalculator()
    if "is_tracking" not in st.session_state:
        st.session_state.is_tracking = False
    if "interval_history" not in st.session_state:
        st.session_state.interval_history = pd.DataFrame()
    if "selected_session" not in st.session_state:
        st.session_state.selected_session = None
    if "last_update" not in st.session_state:
        st.session_state.last_update = None
    if "replay_session" not in st.session_state:
        st.session_state.replay_session = None
    if "replay_position_lap" not in st.session_state:
        st.session_state.replay_position_lap = None
    if "replay_controller" not in st.session_state:
        st.session_state.replay_controller = None
    if "replay_status" not in st.session_state:
        st.session_state.replay_status = "stopped"
    if "replay_speed" not in st.session_state:
        st.session_state.replay_speed = 1.0
    if "historical_interval_history_cache" not in st.session_state:
        st.session_state.historical_interval_history_cache = {}
    if "historical_pair_key" not in st.session_state:
        st.session_state.historical_pair_key = None
    if "historical_replay_scrub_lap" not in st.session_state:
        st.session_state.historical_replay_scrub_lap = 1


def _get_driver_number(driver_name: str | None) -> int:
    replay_session = st.session_state.get("replay_session")
    if replay_session:
        for driver_number, driver in replay_session.drivers.items():
            if driver.name_acronym == driver_name:
                return driver_number
    return int(st.session_state.fetcher.driver_numbers.get(driver_name or "", 0))


def _initialize_historical_replay_controller() -> None:
    replay_session = st.session_state.get("replay_session")
    if replay_session is None:
        return

    state = initialize_replay_session_state(
        st.session_state,
        replay_session.max_lap_number,
        playback_speed=st.session_state.get("replay_speed", 1.0),
    )
    st.session_state.historical_replay_scrub_lap = state.current_lap or 1


def _ensure_historical_pair_state(driver1_num: int, driver2_num: int) -> pd.DataFrame:
    replay_session = st.session_state.get("replay_session")
    if replay_session is None:
        return pd.DataFrame()

    pair_key, full_history, _ = get_cached_replay_interval_history(
        st.session_state.historical_interval_history_cache,
        session_key=st.session_state.get("selected_session"),
        replay_session=replay_session,
        driver1_num=driver1_num,
        driver2_num=driver2_num,
    )
    if st.session_state.get("historical_pair_key") != pair_key:
        st.session_state.historical_pair_key = pair_key
        _initialize_historical_replay_controller()
    return full_history


def _resolve_current_replay_lap() -> int | None:
    replay_session = st.session_state.get("replay_session")
    controller_state = st.session_state.get("replay_controller")
    if replay_session and isinstance(controller_state, ReplayControllerState):
        return resolve_replay_lap_from_controller(
            replay_session,
            controller_state,
            now=datetime.now(),
        )
    return st.session_state.get("replay_position_lap")


def _get_selected_driver_snapshots() -> dict[int, dict]:
    replay_session = st.session_state.get("replay_session")
    controller_state = st.session_state.get("replay_controller")
    if not replay_session or not isinstance(controller_state, ReplayControllerState):
        return {}

    driver_numbers = [
        _get_driver_number(st.session_state.get("driver1_select")),
        _get_driver_number(st.session_state.get("driver2_select")),
    ]
    driver_numbers = [driver_number for driver_number in driver_numbers if driver_number]
    if not driver_numbers:
        return {}

    view_model = build_replay_view_model(
        replay_session,
        driver_numbers,
        _ensure_historical_pair_state(driver_numbers[0], driver_numbers[1]),
        controller_state,
        now=datetime.now(),
    )
    return view_model["snapshots"]


def _get_replay_position_caption() -> str | None:
    replay_lap = _resolve_current_replay_lap()
    if replay_lap is None:
        return None
    return f"Replay position is lap-granular: lap {replay_lap} from controller-owned session state"


def _build_interval_figure(driver1: str, driver2: str, interval_history: pd.DataFrame) -> go.Figure:
    fig = go.Figure()
    if not interval_history.empty:
        colors = [
            POSITIVE_COLOR if gap > 0 else NEGATIVE_COLOR
            for gap in interval_history["interval"]
        ]
        fig.add_trace(
            go.Scatter(
                x=interval_history["lap_number"],
                y=interval_history["interval"],
                mode="lines+markers",
                name="Gap",
                line=dict(width=3),
                marker=dict(size=8, color=colors),
                hovertemplate="Lap %{x}<br>Gap: %{y:.3f}s<extra></extra>",
            )
        )

    fig.update_layout(
        title=f"Gap: {driver1} vs {driver2}",
        xaxis_title="Lap",
        yaxis_title="Gap (seconds)",
        height=PLOT_HEIGHT,
        template=PLOT_TEMPLATE,
        hovermode="x unified",
        showlegend=True,
    )
    fig.add_hline(y=0, line_dash="dash", line_color=ZERO_LINE_COLOR, opacity=0.7)
    fig.add_annotation(
        text="↑ Driver 1 ahead<br>↓ Driver 2 ahead",
        xref="paper",
        yref="paper",
        x=1,
        y=1,
        showarrow=False,
        font=dict(size=12),
        bgcolor="rgba(255,255,255,0.8)",
        bordercolor="gray",
        borderwidth=1,
    )
    return fig


def _on_historical_speed_change() -> None:
    controller_state = st.session_state.get("replay_controller")
    if not isinstance(controller_state, ReplayControllerState):
        return
    set_replay_speed_state(
        st.session_state,
        playback_speed=st.session_state.historical_speed_control,
        now=datetime.now(),
    )


def _on_historical_scrub_change() -> None:
    controller_state = st.session_state.get("replay_controller")
    if not isinstance(controller_state, ReplayControllerState):
        return
    scrubbed = scrub_replay_state(
        st.session_state,
        requested_lap=st.session_state.historical_replay_scrub_lap,
        now=datetime.now(),
    )
    st.session_state.historical_replay_scrub_lap = scrubbed.current_lap or 1


@st.fragment(run_every=HISTORICAL_REPLAY_TICK_INTERVAL)
def historical_replay_tick() -> None:
    controller_state = st.session_state.get("replay_controller")
    if not isinstance(controller_state, ReplayControllerState):
        return

    if st.session_state.get("data_source") != "Historical Session":
        return

    if controller_state.status != "playing":
        st.caption(f"Replay {controller_state.status} at lap {controller_state.current_lap or '-'}")
        return

    previous_lap = controller_state.current_lap
    previous_status = controller_state.status
    updated = advance_replay_state(st.session_state, now=datetime.now())
    st.session_state.last_update = datetime.now()

    # Manual verification note: Play should advance one lap at a time, Pause should freeze
    # the current lap, Resume should continue from that lap, and speed/scrub changes should
    # update both the chart prefix and tyre snapshots without jumping to the finish.
    # Streamlit fragments drive the tick; a full rerun keeps the chart and KPIs aligned.
    if updated.current_lap != previous_lap or updated.status != previous_status:
        st.rerun()

    st.caption(f"Replay {updated.status} at lap {updated.current_lap or '-'}")


def _load_historical_session(selected_session_str: str) -> None:
    session_key = int(selected_session_str.split("#")[-1].strip(")"))
    with st.spinner("Loading session data..."):
        replay_session = st.session_state.fetcher.load_replay_session(session_key)
        if replay_session is None:
            st.error("Failed to load session")
            return

        st.session_state.selected_session = session_key
        st.session_state.replay_session = replay_session
        st.session_state.available_drivers = replay_session.driver_acronyms
        st.session_state.interval_history = pd.DataFrame()
        st.session_state.historical_interval_history_cache = {}
        st.session_state.historical_pair_key = None
        st.session_state.is_tracking = False
        _initialize_historical_replay_controller()
        st.success("Session loaded successfully!")


def _render_historical_controls(driver1: str, driver2: str, full_history: pd.DataFrame) -> None:
    controller_state = st.session_state.get("replay_controller")
    if not isinstance(controller_state, ReplayControllerState):
        st.info("Load a historical session to control replay")
        return

    now = datetime.now()
    replay_session = st.session_state.get("replay_session")
    if replay_session is None:
        return

    view_model = build_replay_view_model(
        replay_session,
        [_get_driver_number(driver1), _get_driver_number(driver2)],
        full_history,
        controller_state,
        now=now,
    )
    visible_history = view_model["visible_history"]
    replay_lap = view_model["replay_lap"]
    st.session_state.replay_position_lap = replay_lap
    st.session_state.interval_history = visible_history
    st.session_state.historical_replay_scrub_lap = replay_lap or 1

    play_col, pause_col, resume_col, restart_col = st.columns(4)
    with play_col:
        if st.button("Play", type="primary", disabled=controller_state.status == "playing"):
            start_replay_state(st.session_state, now=now)
            st.rerun()
    with pause_col:
        if st.button("Pause", disabled=controller_state.status != "playing"):
            pause_replay_state(st.session_state, now=now)
            st.rerun()
    with resume_col:
        if st.button("Resume", disabled=controller_state.status != "paused"):
            resume_replay_state(st.session_state, now=now)
            st.rerun()
    with restart_col:
        if st.button("Restart"):
            restart_replay_state(st.session_state, now=now)
            st.rerun()

    st.slider(
        "Replay Speed",
        min_value=MIN_PLAYBACK_SPEED,
        max_value=MAX_PLAYBACK_SPEED,
        value=float(st.session_state.get("replay_speed", 1.0)),
        step=0.5,
        key="historical_speed_control",
        on_change=_on_historical_speed_change,
    )
    st.slider(
        "Scrub Lap",
        min_value=1,
        max_value=replay_session.max_lap_number,
        value=int(replay_lap or 1),
        step=1,
        key="historical_replay_scrub_lap",
        on_change=_on_historical_scrub_change,
    )

    current_stats = view_model["stats"]
    st.metric(
        "Current Gap",
        f"{abs(current_stats['current_interval']):.3f}s" if current_stats["current_interval"] else "---",
        f"{current_stats['closing_rate']:.3f}s/lap" if current_stats["closing_rate"] else None,
    )
    if current_stats["current_interval"]:
        if current_stats["current_interval"] > 0:
            st.caption(f"{driver1} ahead")
        else:
            st.caption(f"{driver2} ahead")
    st.caption(
        f"P{current_stats['position_d1']} vs P{current_stats['position_d2']} | Status: {st.session_state.replay_status}"
    )

    replay_snapshots = view_model["snapshots"]
    if replay_snapshots:
        replay_position_caption = _get_replay_position_caption()
        if replay_position_caption:
            st.caption(replay_position_caption)

        driver1_snapshot = replay_snapshots.get(_get_driver_number(driver1), {})
        driver2_snapshot = replay_snapshots.get(_get_driver_number(driver2), {})
        tyre_col1, tyre_col2 = st.columns(2)
        with tyre_col1:
            st.metric(
                f"{driver1} Tyre",
                driver1_snapshot.get("compound_display", "Compound unavailable"),
                driver1_snapshot.get("tyre_age_display", "Age unavailable"),
            )
        with tyre_col2:
            st.metric(
                f"{driver2} Tyre",
                driver2_snapshot.get("compound_display", "Compound unavailable"),
                driver2_snapshot.get("tyre_age_display", "Age unavailable"),
            )


def main() -> None:
    _initialize_session_state()

    st.title("🏎️ F1 Driver Interval Tracker")
    st.markdown("Track real-time intervals between drivers during F1 sessions")

    with st.sidebar:
        st.header("📊 Configuration")
        data_source = st.radio(
            "Data Source",
            ["Historical Session", "Recorded Session", "Live Session"],
            help="Choose data source for testing and live tracking",
            key="data_source",
        )

        st.divider()

        if data_source == "Historical Session":
            st.subheader("Historical Data")

            if st.button("🔄 Refresh Sessions"):
                with st.spinner("Fetching sessions..."):
                    st.session_state.available_sessions = st.session_state.fetcher.get_recent_sessions()

            if "available_sessions" not in st.session_state:
                st.session_state.available_sessions = st.session_state.fetcher.get_recent_sessions()

            if st.session_state.available_sessions:
                session_options = []
                for session in st.session_state.available_sessions:
                    date = session.get("date_start", "Unknown date")[:10]
                    name = session.get("session_name", "Unknown session")
                    key = session.get("session_key", 0)
                    session_options.append(f"{date} - {name} (#{key})")

                selected_session_str = st.selectbox("Select Session", session_options)
                if st.button("📥 Load Session", type="primary"):
                    _load_historical_session(selected_session_str)

        elif data_source == "Recorded Session":
            st.subheader("Recorded Sessions")
            recordings = SessionRecorder.list_recordings()
            if recordings:
                selected_recording = st.selectbox("Select Recording", recordings)
                if st.button("▶️ Load Recording", type="primary"):
                    recorder = SessionRecorder(selected_recording)
                    if recorder.load():
                        st.session_state.recorder = recorder
                        st.session_state.selected_session = "recorded"
                        st.session_state.replay_session = None
                        st.session_state.replay_position_lap = None
                        drivers_dict = recorder.data["metadata"].get("drivers", {})
                        st.session_state.available_drivers = [
                            driver["name_acronym"] for driver in drivers_dict.values()
                        ]
                        st.success("Recording loaded!")
                    else:
                        st.error("Failed to load recording")
                if "recorder" in st.session_state:
                    st.session_state.replay_speed = st.slider("Replay Speed", 0.5, 5.0, 1.0, 0.5)
            else:
                st.info("No recordings found. Record a session first!")

        else:
            st.subheader("Live Session")
            if st.button("🔴 Check Live Session"):
                with st.spinner("Checking for live session..."):
                    latest = st.session_state.fetcher.get_latest_session()
                    if latest:
                        st.session_state.latest_session = latest
                        st.success(f"Found: {latest.get('session_name', 'Unknown')}")
                    else:
                        st.warning("No live session found")

            if "latest_session" in st.session_state:
                if st.button("Connect to Live Session", type="primary"):
                    session_key = st.session_state.latest_session["session_key"]
                    if st.session_state.fetcher.load_session(session_key):
                        st.session_state.selected_session = session_key
                        st.session_state.replay_session = None
                        st.session_state.replay_position_lap = None
                        st.session_state.available_drivers = st.session_state.fetcher.get_driver_list()
                        st.success("Connected to live session!")

    col1, col2 = st.columns([1, 3])

    with col1:
        st.header("🏁 Driver Selection")
        if st.session_state.selected_session:
            available_drivers = st.session_state.get("available_drivers", [])
            if available_drivers:
                driver1 = st.selectbox("Driver 1", available_drivers, key="driver1_select")
                driver2 = st.selectbox(
                    "Driver 2",
                    [driver for driver in available_drivers if driver != driver1],
                    key="driver2_select",
                )

                st.divider()
                if data_source == "Historical Session":
                    driver1_num = _get_driver_number(driver1)
                    driver2_num = _get_driver_number(driver2)
                    full_history = _ensure_historical_pair_state(driver1_num, driver2_num)
                    _render_historical_controls(driver1, driver2, full_history)
                else:
                    control_col1, control_col2 = st.columns(2)
                    with control_col1:
                        if st.button("▶️ Start", type="primary", disabled=st.session_state.is_tracking):
                            st.session_state.is_tracking = True
                            st.session_state.interval_history = pd.DataFrame()
                    with control_col2:
                        if st.button("⏹️ Stop", disabled=not st.session_state.is_tracking):
                            st.session_state.is_tracking = False
            else:
                st.info("Load a session to see drivers")
        else:
            st.info("Please load a session first")

    with col2:
        st.header("📈 Interval Analysis")
        plot_container = st.empty()
        info_container = st.container()

        if st.session_state.selected_session and "driver1_select" in st.session_state:
            driver1 = st.session_state.get("driver1_select", "Driver 1")
            driver2 = st.session_state.get("driver2_select", "Driver 2")

            if data_source == "Historical Session":
                driver1_num = _get_driver_number(driver1)
                driver2_num = _get_driver_number(driver2)
                full_history = _ensure_historical_pair_state(driver1_num, driver2_num)
                view_model = build_replay_view_model(
                    st.session_state.replay_session,
                    [driver1_num, driver2_num],
                    full_history,
                    st.session_state.replay_controller,
                    now=datetime.now(),
                )
                st.session_state.interval_history = view_model["visible_history"]
                plot_container.plotly_chart(
                    _build_interval_figure(driver1, driver2, view_model["visible_history"]),
                    use_container_width=True,
                )
                with info_container:
                    historical_replay_tick()
            else:
                plot_container.plotly_chart(
                    _build_interval_figure(driver1, driver2, st.session_state.interval_history),
                    use_container_width=True,
                )
                if st.session_state.is_tracking:
                    d1_num = _get_driver_number(driver1)
                    d2_num = _get_driver_number(driver2)
                    with info_container:
                        status_placeholder = st.empty()
                        status_placeholder.info("Tracking active...")

                    while st.session_state.is_tracking:
                        try:
                            if data_source == "Recorded Session" and "recorder" in st.session_state:
                                for position_batch in st.session_state.recorder.replay_positions(
                                    speed=st.session_state.get("replay_speed", 1.0)
                                ):
                                    if not st.session_state.is_tracking:
                                        break
                                    st.session_state.calculator.update_position_data(position_batch)
                                    time.sleep(0.1)
                            else:
                                time.sleep(LIVE_UPDATE_INTERVAL)

                            st.session_state.last_update = datetime.now()
                            history = st.session_state.calculator.calculate_interval_history(d1_num, d2_num)
                            if not history.empty:
                                st.session_state.interval_history = history
                                plot_container.plotly_chart(
                                    _build_interval_figure(driver1, driver2, history),
                                    use_container_width=True,
                                )
                        except Exception as exc:
                            logger.error("Error during tracking: %s", exc)
                            st.session_state.is_tracking = False
                            status_placeholder.error(f"Error: {exc}")
                            break
                        time.sleep(0.1)
        else:
            with info_container:
                st.info("Please load a session and select drivers to begin tracking")

    st.divider()
    footer_col1, footer_col2, footer_col3 = st.columns(3)
    with footer_col1:
        st.caption("Data provided by OpenF1 API")
    with footer_col2:
        if st.session_state.last_update:
            st.caption(f"Last update: {st.session_state.last_update.strftime('%H:%M:%S')}")
    with footer_col3:
        st.caption("Built with Streamlit & Plotly")


main()
