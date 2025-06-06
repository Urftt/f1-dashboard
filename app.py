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
from data_processor import IntervalCalculator, RaceAnalyzer

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
                    if st.session_state.fetcher.load_session(session_key):
                        st.session_state.selected_session = session_key
                        
                        # Load initial data
                        drivers = st.session_state.fetcher.get_driver_list()
                        st.session_state.available_drivers = drivers
                        
                        # Load lap data
                        driver_numbers = list(st.session_state.fetcher.driver_numbers.values())
                        lap_data = st.session_state.fetcher.get_lap_data(driver_numbers)
                        st.session_state.calculator.update_lap_data(lap_data)
                        
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
                    drivers = st.session_state.fetcher.get_driver_list()
                    st.session_state.available_drivers = drivers
                    st.success("Connected to live session!")
                else:
                    st.error("Failed to connect")

# Main content area
col1, col2 = st.columns([1, 3])

with col1:
    st.subheader("🏁 Driver Selection")
    
    # Check if we have drivers loaded
    if 'available_drivers' in st.session_state and st.session_state.available_drivers:
        drivers = sorted(st.session_state.available_drivers)
        
        # Driver selection
        driver1 = st.selectbox(
            "Driver 1", 
            drivers, 
            index=0,
            help="Select the first driver to track"
        )
        
        driver2 = st.selectbox(
            "Driver 2", 
            drivers, 
            index=1 if len(drivers) > 1 else 0,
            help="Select the second driver to compare"
        )
        
        # Get driver numbers
        if driver1 != driver2:
            driver1_num = st.session_state.fetcher.driver_numbers.get(driver1, 0)
            driver2_num = st.session_state.fetcher.driver_numbers.get(driver2, 0)
            st.session_state.driver1_num = driver1_num
            st.session_state.driver2_num = driver2_num
        
        st.divider()
        
        # Control buttons
        col_start, col_stop = st.columns(2)
        
        with col_start:
            if st.button("▶️ Start", type="primary", disabled=st.session_state.is_tracking):
                if driver1 != driver2:
                    st.session_state.is_tracking = True
                    st.session_state.interval_history = pd.DataFrame()
                else:
                    st.warning("Please select different drivers")
        
        with col_stop:
            if st.button("⏹️ Stop", disabled=not st.session_state.is_tracking):
                st.session_state.is_tracking = False
        
        st.divider()
        
        # Current status display
        if st.session_state.is_tracking and 'driver1_num' in st.session_state:
            current_stats = st.session_state.calculator.get_current_interval(
                st.session_state.driver1_num,
                st.session_state.driver2_num
            )
            
            if current_stats['current_interval'] is not None:
                interval = current_stats['current_interval']
                trend = current_stats['trend']
                
                # Format interval display
                if interval > 0:
                    interval_str = f"+{interval:.3f}s"
                    delta_color = "normal"
                elif interval < 0:
                    interval_str = f"{interval:.3f}s"
                    delta_color = "inverse"
                else:
                    interval_str = "0.000s"
                    delta_color = "off"
                
                # Trend indicator
                if trend == 'closing':
                    trend_str = "↘️ Closing"
                elif trend == 'extending':
                    trend_str = "↗️ Extending"
                else:
                    trend_str = "→ Stable"
                
                st.metric(
                    "Current Gap",
                    interval_str,
                    delta=f"{current_stats['closing_rate']:.3f}s/lap" if current_stats['closing_rate'] else None,
                    delta_color=delta_color
                )
                
                st.caption(f"Lap {current_stats['lap']} • {trend_str}")
                
                # Position info
                st.caption(f"P{current_stats['position_d1']} vs P{current_stats['position_d2']}")
            else:
                st.info("Waiting for data...")
                
        # Recording controls
        if data_source == "Live Session" and st.session_state.is_tracking:
            st.divider()
            if st.button("💾 Save Recording"):
                session_name = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                recorder = SessionRecorder(session_name)
                
                # Save current data
                recorder.set_drivers(st.session_state.fetcher.drivers)
                recorder.add_lap_data(st.session_state.calculator.lap_data)
                recorder.add_position_data(st.session_state.calculator.position_data)
                recorder.save()
                
                st.success(f"Saved as {session_name}")
    
    else:
        st.info("Please load a session first")

with col2:
    if 'available_drivers' in st.session_state and st.session_state.available_drivers:
        st.subheader(f"📈 Interval: {driver1} vs {driver2}")
        
        # Create the plot
        plot_placeholder = st.empty()
        
        # Information tabs
        tab1, tab2, tab3 = st.tabs(["Live Plot", "Statistics", "Events"])
        
        with tab1:
            # Plot controls
            col_controls1, col_controls2, col_controls3 = st.columns(3)
            with col_controls1:
                show_trend = st.checkbox("Show Trend Line", value=True)
            with col_controls2:
                show_events = st.checkbox("Show Events", value=False)
            with col_controls3:
                auto_scale = st.checkbox("Auto Scale", value=True)
        
        with tab2:
            stats_placeholder = st.empty()
        
        with tab3:
            events_placeholder = st.empty()
        
        # Main update loop
        if st.session_state.is_tracking:
            # Create containers for live updates
            while st.session_state.is_tracking:
                try:
                    # Update data based on source
                    if data_source == "Historical Session":
                        # For historical, we already have all data loaded
                        history = st.session_state.calculator.calculate_interval_history(
                            st.session_state.driver1_num,
                            st.session_state.driver2_num
                        )
                        st.session_state.interval_history = history
                        
                    elif data_source == "Recorded Session":
                        # Replay recorded data
                        if 'recorder' in st.session_state:
                            # This would need to be implemented with proper replay logic
                            pass
                    
                    else:  # Live Session
                        # Fetch new data
                        new_laps = st.session_state.fetcher.get_lap_data(
                            [st.session_state.driver1_num, st.session_state.driver2_num]
                        )
                        st.session_state.calculator.update_lap_data(new_laps)
                        
                        history = st.session_state.calculator.calculate_interval_history(
                            st.session_state.driver1_num,
                            st.session_state.driver2_num
                        )
                        st.session_state.interval_history = history
                    
                    # Update plot
                    if not st.session_state.interval_history.empty:
                        fig = create_interval_plot(
                            st.session_state.interval_history,
                            driver1, driver2,
                            show_trend, show_events, auto_scale
                        )
                        plot_placeholder.plotly_chart(fig, use_container_width=True)
                        
                        # Update statistics
                        with stats_placeholder.container():
                            display_statistics(st.session_state.interval_history)
                        
                        # Update events
                        with events_placeholder.container():
                            display_events(
                                st.session_state.calculator,
                                st.session_state.driver1_num,
                                st.session_state.driver2_num
                            )
                    
                    # Update timestamp
                    st.session_state.last_update = datetime.now()
                    
                    # Sleep before next update
                    time.sleep(LIVE_UPDATE_INTERVAL)
                    
                except Exception as e:
                    logger.error(f"Error in update loop: {e}")
                    st.error(f"Update error: {str(e)}")
                    time.sleep(LIVE_UPDATE_INTERVAL)
    
    else:
        st.info("👈 Please load a session and select drivers to begin tracking")

# Footer
st.divider()
col_footer1, col_footer2, col_footer3 = st.columns(3)

with col_footer1:
    if st.session_state.last_update:
        st.caption(f"Last update: {st.session_state.last_update.strftime('%H:%M:%S')}")
    else:
        st.caption("Not tracking")

with col_footer2:
    st.caption("Data provided by OpenF1 API")

with col_footer3:
    st.caption("Built with Streamlit & Plotly")


def create_interval_plot(history_df, driver1, driver2, show_trend, show_events, auto_scale):
    """Create the interval plot with Plotly"""
    fig = go.Figure()
    
    # Main interval line
    fig.add_trace(go.Scatter(
        x=history_df['lap_number'],
        y=history_df['interval'],
        mode='lines+markers',
        name=f'{driver1} vs {driver2}',
        line=dict(color=POSITIVE_COLOR, width=3),
        marker=dict(size=8),
        hovertemplate='Lap %{x}<br>Gap: %{y:.3f}s<extra></extra>'
    ))
    
    # Add trend line if requested
    if show_trend and len(history_df) > 5:
        # Simple moving average for trend
        history_df['trend'] = history_df['interval'].rolling(window=5, center=True).mean()
        fig.add_trace(go.Scatter(
            x=history_df['lap_number'],
            y=history_df['trend'],
            mode='lines',
            name='Trend',
            line=dict(color='orange', width=2, dash='dash'),
            hovertemplate='Trend: %{y:.3f}s<extra></extra>'
        ))
    
    # Add zero line
    fig.add_hline(
        y=0, 
        line_dash="dash", 
        line_color=ZERO_LINE_COLOR, 
        opacity=0.5,
        annotation_text="Equal",
        annotation_position="right"
    )
    
    # Add DRS zone indicator
    fig.add_hrect(
        y0=0, y1=1,
        fillcolor="green", opacity=0.1,
        line_width=0,
        annotation_text="DRS Zone",
        annotation_position="top right"
    )
    
    # Update layout
    fig.update_layout(
        title=dict(
            text=f"Interval Analysis: {driver1} vs {driver2}",
            x=0.5,
            xanchor='center'
        ),
        xaxis_title="Lap Number",
        yaxis_title="Gap (seconds)",
        hovermode='x unified',
        height=PLOT_HEIGHT,
        template=PLOT_TEMPLATE,
        showlegend=True,
        legend=dict(
            yanchor="top",
            y=0.99,
            xanchor="left",
            x=0.01
        )
    )
    
    # Auto scale or fixed scale
    if not auto_scale:
        fig.update_yaxis(range=[-10, 10])
    
    # Add annotations
    fig.add_annotation(
        text=f"Positive = {driver1} ahead<br>Negative = {driver2} ahead",
        xref="paper", yref="paper",
        x=0.99, y=0.01,
        showarrow=False,
        font=dict(size=10, color="gray"),
        align="right"
    )
    
    return fig


def display_statistics(history_df):
    """Display interval statistics"""
    if history_df.empty:
        st.info("No data available yet")
        return
    
    col1, col2, col3, col4 = st.columns(4)
    
    latest = history_df.iloc[-1]
    
    with col1:
        st.metric("Current Gap", f"{latest['interval']:.3f}s")
    
    with col2:
        avg_gap = history_df['interval'].mean()
        st.metric("Average Gap", f"{avg_gap:.3f}s")
    
    with col3:
        min_gap = history_df['interval'].min()
        st.metric("Minimum Gap", f"{min_gap:.3f}s")
    
    with col4:
        max_gap = history_df['interval'].max()
        st.metric("Maximum Gap", f"{max_gap:.3f}s")
    
    # Trend analysis
    if len(history_df) > 5:
        recent_trend = history_df['interval_change'].tail(5).mean()
        if recent_trend < -0.1:
            st.success("Gap is closing rapidly")
        elif recent_trend > 0.1:
            st.warning("Gap is extending")
        else:
            st.info("Gap is stable")


def display_events(calculator, driver1_num, driver2_num):
    """Display detected events"""
    events1 = calculator.detect_events(driver1_num)
    events2 = calculator.detect_events(driver2_num)
    
    if not events1 and not events2:
        st.info("No events detected yet")
        return
    
    # Combine and sort events
    all_events = []
    for event in events1:
        event['driver'] = 'Driver 1'
        all_events.append(event)
    for event in events2:
        event['driver'] = 'Driver 2'
        all_events.append(event)
    
    all_events.sort(key=lambda x: x['lap'])
    
    # Display events
    for event in all_events:
        if event['type'] == 'pit_stop':
            st.write(f"🛑 Lap {event['lap']}: {event['driver']} pit stop ({event['duration']:.1f}s)")


# Run the app
if __name__ == "__main__":
    st.sidebar.markdown("---")
    st.sidebar.caption("F1 Interval Tracker v1.0")