"""
F1 Interval Tracker - Main Streamlit Application
"""
import streamlit as st
import plotly.graph_objects as go
import pandas as pd
from datetime import datetime
import time
import logging

from config import (
    STREAMLIT_CONFIG, PLOT_HEIGHT, PLOT_TEMPLATE,
    POSITIVE_COLOR, NEGATIVE_COLOR, ZERO_LINE_COLOR,
    DRIVER_COLORS, LIVE_UPDATE_INTERVAL, SIMULATION_SPEED
)
from data_fetcher import F1DataFetcher, SessionRecorder
from data_processor import (
    IntervalCalculator,
    RaceAnalyzer,
    get_replay_snapshot,
    resolve_replay_lap,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Page configuration
st.set_page_config(**STREAMLIT_CONFIG)

# Initialize session state
if 'fetcher' not in st.session_state:
    st.session_state.fetcher = F1DataFetcher()
if 'calculator' not in st.session_state:
    st.session_state.calculator = IntervalCalculator()
if 'is_tracking' not in st.session_state:
    st.session_state.is_tracking = False
if 'interval_history' not in st.session_state:
    st.session_state.interval_history = pd.DataFrame()
if 'selected_session' not in st.session_state:
    st.session_state.selected_session = None
if 'last_update' not in st.session_state:
    st.session_state.last_update = None
if 'replay_session' not in st.session_state:
    st.session_state.replay_session = None
if 'replay_position_lap' not in st.session_state:
    st.session_state.replay_position_lap = None


def _get_driver_number(driver_name: str) -> int:
    replay_session = st.session_state.get('replay_session')
    if replay_session:
        for driver_number, driver in replay_session.drivers.items():
            if driver.name_acronym == driver_name:
                return driver_number
    return int(st.session_state.fetcher.driver_numbers.get(driver_name, 0))


def _resolve_current_replay_lap() -> int | None:
    replay_session = st.session_state.get('replay_session')
    if not replay_session:
        return None

    interval_history = st.session_state.get('interval_history', pd.DataFrame())
    if (
        isinstance(interval_history, pd.DataFrame)
        and not interval_history.empty
        and 'lap_number' in interval_history
    ):
        return resolve_replay_lap(
            replay_session,
            int(interval_history['lap_number'].max()),
        )

    return resolve_replay_lap(
        replay_session,
        st.session_state.get('replay_position_lap'),
    )


def _get_selected_driver_snapshots() -> dict[int, dict]:
    replay_session = st.session_state.get('replay_session')
    if not replay_session:
        return {}

    driver_names = [
        st.session_state.get('driver1_select'),
        st.session_state.get('driver2_select'),
    ]
    driver_numbers = [
        _get_driver_number(driver_name)
        for driver_name in driver_names
        if driver_name
    ]
    driver_numbers = [driver_number for driver_number in driver_numbers if driver_number]
    if not driver_numbers:
        return {}

    replay_lap = _resolve_current_replay_lap()
    if replay_lap is None:
        return {}

    st.session_state.replay_position_lap = replay_lap
    return get_replay_snapshot(replay_session, driver_numbers, replay_lap)


def _get_replay_position_caption() -> str | None:
    replay_lap = st.session_state.get('replay_position_lap')
    if replay_lap is None:
        return None

    interval_history = st.session_state.get('interval_history', pd.DataFrame())
    source = "preloaded replay session"
    if (
        isinstance(interval_history, pd.DataFrame)
        and not interval_history.empty
        and 'lap_number' in interval_history
    ):
        source = "calculated interval history"

    return f"Replay position is lap-granular: lap {replay_lap} from {source}"

# Title and description
st.title("🏎️ F1 Driver Interval Tracker")
st.markdown("Track real-time intervals between drivers during F1 sessions")

# Sidebar configuration
with st.sidebar:
    st.header("📊 Configuration")
    
    # Data source selection
    data_source = st.radio(
        "Data Source", 
        ["Historical Session", "Recorded Session", "Live Session"],
        help="Choose data source for testing and live tracking"
    )
    
    st.divider()
    
    if data_source == "Historical Session":
        # Historical session selection
        st.subheader("Historical Data")
        
        if st.button("🔄 Refresh Sessions"):
            with st.spinner("Fetching sessions..."):
                sessions = st.session_state.fetcher.get_recent_sessions()
                st.session_state.available_sessions = sessions
        
        # Get sessions if not already loaded
        if 'available_sessions' not in st.session_state:
            sessions = st.session_state.fetcher.get_recent_sessions()
            st.session_state.available_sessions = sessions
        
        if st.session_state.available_sessions:
            # Create session options
            session_options = []
            for session in st.session_state.available_sessions:
                date = session.get('date_start', 'Unknown date')[:10]
                name = session.get('session_name', 'Unknown session')
                key = session.get('session_key', 0)
                session_options.append(f"{date} - {name} (#{key})")
            
            selected_session_str = st.selectbox("Select Session", session_options)
            
            if st.button("📥 Load Session", type="primary"):
                # Extract session key from selection
                session_key = int(selected_session_str.split('#')[-1].strip(')'))
                
                with st.spinner("Loading session data..."):
                    replay_session = st.session_state.fetcher.load_replay_session(session_key)
                    if replay_session:
                        st.session_state.selected_session = session_key
                        st.session_state.replay_session = replay_session
                        st.session_state.replay_position_lap = replay_session.max_lap_number
                        st.session_state.available_drivers = replay_session.driver_acronyms
                        st.session_state.interval_history = pd.DataFrame()
                        st.session_state.calculator = IntervalCalculator()
                        
                        st.success("Session loaded successfully!")
                    else:
                        st.error("Failed to load session")
    
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
                    
                    # Extract driver list from recording
                    drivers_dict = recorder.data['metadata'].get('drivers', {})
                    st.session_state.available_drivers = [
                        d['name_acronym'] for d in drivers_dict.values()
                    ]
                    
                    st.success("Recording loaded!")
                else:
                    st.error("Failed to load recording")
                    
            # Replay speed control
            if 'recorder' in st.session_state:
                speed = st.slider("Replay Speed", 0.5, 5.0, 1.0, 0.5)
                st.session_state.replay_speed = speed
        else:
            st.info("No recordings found. Record a session first!")
    
    else:  # Live Session
        st.subheader("Live Session")
        
        if st.button("🔴 Check Live Session"):
            with st.spinner("Checking for live session..."):
                latest = st.session_state.fetcher.get_latest_session()
                if latest:
                    st.session_state.latest_session = latest
                    st.success(f"Found: {latest.get('session_name', 'Unknown')}")
                else:
                    st.warning("No live session found")
        
        if 'latest_session' in st.session_state:
            if st.button("Connect to Live Session", type="primary"):
                session_key = st.session_state.latest_session['session_key']
                if st.session_state.fetcher.load_session(session_key):
                    st.session_state.selected_session = session_key
                    st.session_state.replay_session = None
                    st.session_state.replay_position_lap = None
                    drivers = st.session_state.fetcher.get_driver_list()
                    st.session_state.available_drivers = drivers
                    st.success("Connected to live session!")

# Main content area
col1, col2 = st.columns([1, 3])

with col1:
    st.header("🏁 Driver Selection")
    
    if st.session_state.selected_session:
        # Get available drivers
        if 'available_drivers' in st.session_state and st.session_state.available_drivers:
            driver1 = st.selectbox(
                "Driver 1",
                st.session_state.available_drivers,
                key="driver1_select"
            )
            
            driver2 = st.selectbox(
                "Driver 2",
                [d for d in st.session_state.available_drivers if d != driver1],
                key="driver2_select"
            )
            
            st.divider()
            
            # Control buttons
            col_start, col_stop = st.columns(2)
            
            with col_start:
                if st.button("▶️ Start", type="primary", disabled=st.session_state.is_tracking):
                    st.session_state.is_tracking = True
                    st.session_state.interval_history = pd.DataFrame()
                    
            with col_stop:
                if st.button("⏹️ Stop", disabled=not st.session_state.is_tracking):
                    st.session_state.is_tracking = False
            
            # Display current stats
            st.divider()
            if st.session_state.is_tracking and not st.session_state.interval_history.empty:
                # Get driver numbers
                d1_num = _get_driver_number(driver1)
                d2_num = _get_driver_number(driver2)
                
                # Get current stats
                current_stats = st.session_state.calculator.get_current_interval(d1_num, d2_num)
                
                # Display metrics
                st.metric(
                    "Current Gap",
                    f"{abs(current_stats['current_interval']):.3f}s" if current_stats['current_interval'] else "---",
                    f"{current_stats['closing_rate']:.3f}s/lap" if current_stats['closing_rate'] else None
                )
                
                # Show who's ahead
                if current_stats['current_interval']:
                    if current_stats['current_interval'] > 0:
                        st.caption(f"🟢 {driver1} ahead")
                    else:
                        st.caption(f"🔴 {driver2} ahead")
                
                # Show positions
                st.caption(f"P{current_stats['position_d1']} vs P{current_stats['position_d2']}")

            replay_snapshots = _get_selected_driver_snapshots()
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
                        driver1_snapshot.get('compound_display', 'Compound unavailable'),
                        driver1_snapshot.get('tyre_age_display', 'Age unavailable'),
                    )
                with tyre_col2:
                    st.metric(
                        f"{driver2} Tyre",
                        driver2_snapshot.get('compound_display', 'Compound unavailable'),
                        driver2_snapshot.get('tyre_age_display', 'Age unavailable'),
                    )
        else:
            st.info("Load a session to see drivers")
    else:
        st.info("Please load a session first")

with col2:
    st.header("📈 Interval Analysis")
    
    # Create placeholder for the plot
    plot_container = st.empty()
    
    # Info container
    info_container = st.container()
    
    if st.session_state.selected_session and 'driver1_select' in st.session_state:
        # Initial empty plot
        fig = go.Figure()
        
        # Configure the plot
        fig.update_layout(
            title=f"Gap: {st.session_state.get('driver1_select', 'Driver 1')} vs {st.session_state.get('driver2_select', 'Driver 2')}",
            xaxis_title="Lap",
            yaxis_title="Gap (seconds)",
            height=PLOT_HEIGHT,
            template=PLOT_TEMPLATE,
            hovermode='x unified',
            showlegend=True
        )
        
        # Add zero line
        fig.add_hline(y=0, line_dash="dash", line_color=ZERO_LINE_COLOR, opacity=0.7)
        
        # Add annotations
        fig.add_annotation(
            text="↑ Driver 1 ahead<br>↓ Driver 2 ahead",
            xref="paper", yref="paper",
            x=1, y=1,
            showarrow=False,
            font=dict(size=12),
            bgcolor="rgba(255,255,255,0.8)",
            bordercolor="gray",
            borderwidth=1
        )
        
        plot_container.plotly_chart(fig, use_container_width=True)
        
        # Run tracking loop
        if st.session_state.is_tracking:
            # Get driver numbers
            d1_num = _get_driver_number(st.session_state.driver1_select)
            d2_num = _get_driver_number(st.session_state.driver2_select)
            
            # Create a placeholder for updates
            with info_container:
                status_placeholder = st.empty()
                status_placeholder.info("🔄 Tracking active...")
            
            # Continuous update loop
            while st.session_state.is_tracking:
                try:
                    # Fetch latest data based on source
                    if data_source == "Historical Session":
                        # Historical replay stays lap-granular in Phase 1.
                        if st.session_state.interval_history.empty:
                            replay_session = st.session_state.get('replay_session')
                            if replay_session is None:
                                raise ValueError("Historical replay session is not loaded")

                            lap_data = pd.DataFrame(
                                [
                                    {
                                        'driver_number': lap.driver_number,
                                        'lap_number': lap.lap_number,
                                        'date_start': lap.date_start,
                                        'position': lap.position,
                                    }
                                    for driver_number in [d1_num, d2_num]
                                    for lap in replay_session.get_driver_laps(driver_number)
                                ]
                            )
                            st.session_state.calculator.update_lap_data(lap_data)
                            
                            # Calculate full history
                            history = st.session_state.calculator.calculate_interval_history(d1_num, d2_num)
                            st.session_state.interval_history = history
                            if not history.empty:
                                st.session_state.replay_position_lap = int(history['lap_number'].max())
                            
                            # Update plot with full data
                            if not history.empty:
                                fig = go.Figure()
                                
                                # Determine colors based on gap
                                colors = [POSITIVE_COLOR if gap > 0 else NEGATIVE_COLOR 
                                         for gap in history['interval']]
                                
                                fig.add_trace(go.Scatter(
                                    x=history['lap_number'],
                                    y=history['interval'],
                                    mode='lines+markers',
                                    name='Gap',
                                    line=dict(width=3),
                                    marker=dict(size=8, color=colors),
                                    hovertemplate='Lap %{x}<br>Gap: %{y:.3f}s<extra></extra>'
                                ))
                                
                                # Update layout
                                fig.update_layout(
                                    title=f"Gap: {st.session_state.driver1_select} vs {st.session_state.driver2_select}",
                                    xaxis_title="Lap",
                                    yaxis_title="Gap (seconds)",
                                    height=PLOT_HEIGHT,
                                    template=PLOT_TEMPLATE,
                                    hovermode='x unified'
                                )
                                
                                # Add zero line
                                fig.add_hline(y=0, line_dash="dash", line_color=ZERO_LINE_COLOR, opacity=0.7)
                                
                                plot_container.plotly_chart(fig, use_container_width=True)
                                
                            # For historical data, stop after loading
                            st.session_state.is_tracking = False
                            status_placeholder.success("✅ Data loaded!")
                    
                    elif data_source == "Recorded Session" and 'recorder' in st.session_state:
                        # Replay recorded data
                        for position_batch in st.session_state.recorder.replay_positions(
                            speed=st.session_state.get('replay_speed', 1.0)
                        ):
                            if not st.session_state.is_tracking:
                                break
                                
                            # Update with batch data
                            st.session_state.calculator.update_position_data(position_batch)
                            
                            # Update plot
                            # ... (similar plotting logic)
                            
                            time.sleep(0.1)  # Small delay for UI updates
                    
                    else:  # Live session
                        # Stream live data
                        # ... (implement live streaming)
                        time.sleep(LIVE_UPDATE_INTERVAL)
                    
                    # Update last update time
                    st.session_state.last_update = datetime.now()
                    
                except Exception as e:
                    logger.error(f"Error during tracking: {e}")
                    st.session_state.is_tracking = False
                    status_placeholder.error(f"❌ Error: {str(e)}")
                    break
                
                # Allow Streamlit to update
                time.sleep(0.1)
    else:
        # No session loaded
        with info_container:
            st.info("👈 Please load a session and select drivers to begin tracking")

# Footer
st.divider()
col1, col2, col3 = st.columns(3)
with col1:
    st.caption("📡 Data provided by OpenF1 API")
with col2:
    if st.session_state.last_update:
        st.caption(f"🕒 Last update: {st.session_state.last_update.strftime('%H:%M:%S')}")
with col3:
    st.caption("Built with Streamlit & Plotly")
