"""
OpenF1 API interface for fetching race data
"""
import requests
import pandas as pd
from datetime import datetime
import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Generator
import logging

from config import (
    OPENF1_BASE_URL, API_TIMEOUT, RETRY_ATTEMPTS,
    RECORDED_SESSIONS_DIR, RECORDING_FORMAT
)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class F1DataFetcher:
    """Interface for fetching data from OpenF1 API"""
    
    def __init__(self):
        self.base_url = OPENF1_BASE_URL
        self.session = requests.Session()
        self.current_session_key = None
        self.drivers = {}
        self.driver_numbers = {}  # Map acronym to number
        
    def _make_request(self, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict]:
        """Make API request with retry logic"""
        url = f"{self.base_url}/{endpoint}"
        
        for attempt in range(RETRY_ATTEMPTS):
            try:
                response = self.session.get(url, params=params, timeout=API_TIMEOUT)
                response.raise_for_status()
                return response.json()
            except requests.exceptions.RequestException as e:
                logger.warning(f"Request failed (attempt {attempt + 1}/{RETRY_ATTEMPTS}): {e}")
                if attempt < RETRY_ATTEMPTS - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff
                else:
                    logger.error(f"Failed to fetch data from {endpoint}: {e}")
        return None
    
    def get_recent_sessions(self, limit: int = 20) -> List[Dict]:
        """Get list of recent sessions"""
        # Get sessions from recent years
        current_year = datetime.now().year
        all_sessions = []
        
        # Fetch sessions for current and previous year
        for year in [current_year, current_year - 1]:
            data = self._make_request("sessions", {"year": year})
            if data:
                all_sessions.extend(data)
        
        # Sort by date, most recent first
        all_sessions.sort(key=lambda x: x.get('date_start', ''), reverse=True)
        
        # Return only the requested limit
        return all_sessions[:limit]
    
    def get_latest_session(self) -> Optional[Dict]:
        """Get the most recent session"""
        data = self._make_request("sessions", {"limit": 1})
        return data[0] if data else None
    
    def load_session(self, session_key: int) -> bool:
        """Load a specific session and its drivers"""
        # Verify session exists
        session_data = self._make_request("sessions", {"session_key": session_key})
        if not session_data:
            return False
            
        self.current_session_key = session_key
        self._load_drivers()
        return True
    
    def _load_drivers(self):
        """Load driver information for the current session"""
        if not self.current_session_key:
            return
            
        data = self._make_request("drivers", {"session_key": self.current_session_key})
        if data:
            self.drivers = {d['driver_number']: d for d in data}
            self.driver_numbers = {d['name_acronym']: d['driver_number'] for d in data}
            logger.info(f"Loaded {len(self.drivers)} drivers for session {self.current_session_key}")
    
    def get_driver_list(self) -> List[str]:
        """Get list of driver acronyms for current session"""
        return list(self.driver_numbers.keys())
    
    def get_position_data(self, driver_numbers: List[int], 
                         min_date: Optional[str] = None) -> pd.DataFrame:
        """Get position data for specified drivers"""
        params = {
            "session_key": self.current_session_key,
            "driver_number": ",".join(map(str, driver_numbers))
        }
        if min_date:
            params["date>"] = min_date
            
        data = self._make_request("position", params)
        if data:
            return pd.DataFrame(data)
        return pd.DataFrame()
    
    def get_lap_data(self, driver_numbers: List[int]) -> pd.DataFrame:
        """Get lap timing data for specified drivers"""
        params = {
            "session_key": self.current_session_key,
            "driver_number": ",".join(map(str, driver_numbers))
        }
        
        data = self._make_request("laps", params)
        if data:
            df = pd.DataFrame(data)
            if not df.empty:
                df['date_start'] = pd.to_datetime(df['date_start'])
            return df
        return pd.DataFrame()
    
    def stream_live_positions(self, driver_numbers: List[int], 
                            interval: float = 5.0) -> Generator[pd.DataFrame, None, None]:
        """Stream live position updates for specified drivers"""
        last_date = None
        
        while True:
            try:
                # Get latest positions
                df = self.get_position_data(driver_numbers, min_date=last_date)
                
                if not df.empty:
                    # Update last date for next request
                    last_date = df['date'].max()
                    yield df
                
                time.sleep(interval)
                
            except KeyboardInterrupt:
                logger.info("Stopped streaming live positions")
                break
            except Exception as e:
                logger.error(f"Error streaming positions: {e}")
                time.sleep(interval)


class SessionRecorder:
    """Record and replay F1 session data for testing"""
    
    def __init__(self, session_name: str):
        self.session_name = session_name
        self.filepath = RECORDED_SESSIONS_DIR / f"{session_name}.{RECORDING_FORMAT}"
        self.data = {
            "metadata": {
                "session_name": session_name,
                "recorded_at": datetime.now().isoformat(),
                "drivers": {}
            },
            "position_data": [],
            "lap_data": []
        }
        
    def add_position_data(self, df: pd.DataFrame):
        """Add position data to recording"""
        if not df.empty:
            records = df.to_dict('records')
            for record in records:
                # Convert datetime objects to strings
                if 'date' in record and hasattr(record['date'], 'isoformat'):
                    record['date'] = record['date'].isoformat()
            self.data["position_data"].extend(records)
            
    def add_lap_data(self, df: pd.DataFrame):
        """Add lap data to recording"""
        if not df.empty:
            records = df.to_dict('records')
            for record in records:
                # Convert datetime objects to strings
                for date_field in ['date_start', 'date']:
                    if date_field in record and hasattr(record[date_field], 'isoformat'):
                        record[date_field] = record[date_field].isoformat()
            self.data["lap_data"].extend(records)
    
    def set_drivers(self, drivers: Dict):
        """Set driver information"""
        self.data["metadata"]["drivers"] = drivers
        
    def save(self):
        """Save recorded data to file"""
        self.filepath.parent.mkdir(exist_ok=True)
        with open(self.filepath, 'w') as f:
            json.dump(self.data, f, indent=2)
        logger.info(f"Saved recording to {self.filepath}")
        
    def load(self) -> bool:
        """Load recorded data from file"""
        if not self.filepath.exists():
            logger.error(f"Recording file not found: {self.filepath}")
            return False
            
        try:
            with open(self.filepath, 'r') as f:
                self.data = json.load(f)
            logger.info(f"Loaded recording from {self.filepath}")
            return True
        except Exception as e:
            logger.error(f"Error loading recording: {e}")
            return False
    
    @classmethod
    def list_recordings(cls) -> List[str]:
        """List available recordings"""
        recordings = []
        for file in RECORDED_SESSIONS_DIR.glob(f"*.{RECORDING_FORMAT}"):
            recordings.append(file.stem)
        return sorted(recordings)
    
    def get_position_dataframe(self) -> pd.DataFrame:
        """Get position data as DataFrame"""
        df = pd.DataFrame(self.data["position_data"])
        if not df.empty:
            df['date'] = pd.to_datetime(df['date'])
        return df
    
    def get_lap_dataframe(self) -> pd.DataFrame:
        """Get lap data as DataFrame"""
        df = pd.DataFrame(self.data["lap_data"])
        if not df.empty:
            df['date_start'] = pd.to_datetime(df['date_start'])
        return df
    
    def replay_positions(self, speed: float = 1.0) -> Generator[pd.DataFrame, None, None]:
        """Replay recorded position data at specified speed"""
        df = self.get_position_dataframe()
        if df.empty:
            return
            
        # Group by timestamp
        grouped = df.groupby('date')
        timestamps = sorted(grouped.groups.keys())
        
        if not timestamps:
            return
            
        start_time = timestamps[0]
        real_start = datetime.now()
        
        for timestamp in timestamps:
            # Calculate how long to wait
            elapsed = (timestamp - start_time).total_seconds()
            target_time = real_start + pd.Timedelta(seconds=elapsed / speed)
            wait_time = (target_time - datetime.now()).total_seconds()
            
            if wait_time > 0:
                time.sleep(wait_time)
                
            yield grouped.get_group(timestamp)