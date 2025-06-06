"""
Configuration settings for F1 Interval Dashboard
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Base paths
BASE_DIR = Path(__file__).parent
RECORDED_SESSIONS_DIR = BASE_DIR / "recorded_sessions"

# Create directories if they don't exist
RECORDED_SESSIONS_DIR.mkdir(exist_ok=True)

# API Configuration
OPENF1_BASE_URL = "https://api.openf1.org/v1"
API_TIMEOUT = 30  # seconds
RETRY_ATTEMPTS = 3

# Data refresh settings
LIVE_UPDATE_INTERVAL = 5  # seconds between updates during live sessions
SIMULATION_SPEED = 100.0  # Speed multiplier for replay (1.0 = real-time)

# Visualization settings
PLOT_HEIGHT = 600
PLOT_TEMPLATE = "plotly_white"
POSITIVE_COLOR = "#1E90FF"  # Blue for positive intervals
NEGATIVE_COLOR = "#FF6347"  # Red for negative intervals
ZERO_LINE_COLOR = "#808080"  # Gray for zero line

# Driver colors (official F1 2024 colors)
DRIVER_COLORS = {
    "VER": "#3671C6",  # Red Bull
    "PER": "#3671C6",
    "HAM": "#27F4D2",  # Mercedes
    "RUS": "#27F4D2",
    "LEC": "#E8002D",  # Ferrari
    "SAI": "#E8002D",
    "NOR": "#FF8000",  # McLaren
    "PIA": "#FF8000",
    "ALO": "#229971",  # Aston Martin
    "STR": "#229971",
    "OCO": "#FF87BC",  # Alpine
    "GAS": "#FF87BC",
    "ZHO": "#52E252",  # Alfa Romeo
    "BOT": "#52E252",
    "TSU": "#6692FF",  # AlphaTauri
    "RIC": "#6692FF",
    "ALB": "#B6BABD",  # Williams
    "SAR": "#B6BABD",
    "MAG": "#B6BABD",  # Haas
    "HUL": "#B6BABD",
}

# Session settings
DEFAULT_SESSION_TYPE = "Race"
AVAILABLE_SESSION_TYPES = ["Race", "Qualifying", "Practice 3", "Practice 2", "Practice 1"]

# Recording settings
RECORDING_FORMAT = "json"
COMPRESSION = False

# Streamlit configuration
STREAMLIT_CONFIG = {
    "page_title": "F1 Interval Tracker",
    "page_icon": "🏎️",
    "layout": "wide",
    "initial_sidebar_state": "expanded"
}

# Debug settings
DEBUG = os.getenv("DEBUG", "False").lower() == "true"
LOG_LEVEL = "DEBUG" if DEBUG else "INFO"