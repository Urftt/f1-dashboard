"""
Process F1 timing data to calculate intervals between drivers
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Any, Dict, List, Tuple, Optional
import logging

from replay_controls import (
    ReplayControllerState,
    clamp_replay_lap,
    get_effective_replay_lap,
)
from replay_data import ReplayLap, ReplaySession

logger = logging.getLogger(__name__)


class IntervalCalculator:
    """Calculate time intervals between drivers"""
    
    def __init__(self):
        self.position_data = pd.DataFrame()
        self.lap_data = pd.DataFrame()
        self.interval_history = []
        
    def update_position_data(self, new_data: pd.DataFrame):
        """Update position data with new information"""
        if new_data.empty:
            return
            
        # Append new data
        self.position_data = pd.concat([self.position_data, new_data], ignore_index=True)
        
        # Remove duplicates, keeping the latest
        self.position_data = self.position_data.drop_duplicates(
            subset=['driver_number', 'date'], 
            keep='last'
        )
        
        # Ensure datetime format
        if 'date' in self.position_data.columns:
            self.position_data['date'] = pd.to_datetime(self.position_data['date'])
            
    def update_lap_data(self, new_data: pd.DataFrame):
        """Update lap timing data"""
        if new_data.empty:
            return
            
        self.lap_data = pd.concat([self.lap_data, new_data], ignore_index=True)
        self.lap_data = self.lap_data.drop_duplicates(
            subset=['driver_number', 'lap_number'], 
            keep='last'
        )
        
    def calculate_interval_at_line(self, driver1_num: int, driver2_num: int, 
                                  lap: Optional[int] = None) -> Optional[float]:
        """
        Calculate interval between two drivers at start/finish line
        Returns positive if driver1 is ahead, negative if driver2 is ahead
        """
        if self.lap_data.empty:
            return None
            
        # Filter for specific lap if provided
        lap_data = self.lap_data
        if lap is not None:
            lap_data = lap_data[lap_data['lap_number'] == lap]
            
        # Get latest lap data for each driver
        driver1_data = lap_data[lap_data['driver_number'] == driver1_num]
        driver2_data = lap_data[lap_data['driver_number'] == driver2_num]
        
        if driver1_data.empty or driver2_data.empty:
            return None
            
        # Get the most recent lap crossing for each driver
        latest_d1 = driver1_data.loc[driver1_data['date_start'].idxmax()]
        latest_d2 = driver2_data.loc[driver2_data['date_start'].idxmax()]
        
        # If on different laps, calculate based on lap difference
        lap_diff = latest_d1['lap_number'] - latest_d2['lap_number']
        
        if lap_diff != 0:
            # Estimate based on average lap time
            avg_lap_time = self._get_average_lap_time(driver2_num)
            if avg_lap_time:
                return lap_diff * avg_lap_time
            return None
            
        # Same lap - calculate time difference at line crossing
        time_diff = (latest_d1['date_start'] - latest_d2['date_start']).total_seconds()
        return time_diff
    
    def calculate_interval_history(self, driver1_num: int, driver2_num: int) -> pd.DataFrame:
        """
        Calculate interval history between two drivers for all laps
        """
        if self.lap_data.empty:
            return pd.DataFrame()
            
        # Get lap data for both drivers
        d1_laps = self.lap_data[self.lap_data['driver_number'] == driver1_num].copy()
        d2_laps = self.lap_data[self.lap_data['driver_number'] == driver2_num].copy()
        
        if d1_laps.empty or d2_laps.empty:
            return pd.DataFrame()
            
        # Merge on lap number
        merged = pd.merge(
            d1_laps[['lap_number', 'date_start', 'position']],
            d2_laps[['lap_number', 'date_start', 'position']],
            on='lap_number',
            suffixes=('_d1', '_d2')
        )
        
        # Calculate interval (positive = driver1 ahead)
        merged['interval'] = (merged['date_start_d2'] - merged['date_start_d1']).dt.total_seconds()
        
        # Add position information
        merged['position_d1'] = merged['position_d1'].astype(int)
        merged['position_d2'] = merged['position_d2'].astype(int)
        
        # Calculate cumulative gap trend
        merged['interval_change'] = merged['interval'].diff()
        merged['closing_rate'] = merged['interval_change'].rolling(window=3).mean()
        
        return merged[['lap_number', 'interval', 'position_d1', 'position_d2', 
                      'interval_change', 'closing_rate']]
    
    def get_current_interval(self, driver1_num: int, driver2_num: int) -> Dict:
        """
        Get current interval and related statistics
        """
        # Calculate full history
        history = self.calculate_interval_history(driver1_num, driver2_num)
        
        if history.empty:
            return {
                'current_interval': None,
                'lap': 0,
                'trend': 'unknown',
                'closing_rate': 0.0,
                'position_d1': 0,
                'position_d2': 0
            }
            
        # Get latest data
        latest = history.iloc[-1]
        
        # Determine trend
        if len(history) >= 3:
            recent_changes = history['interval_change'].tail(3).mean()
            if recent_changes < -0.1:
                trend = 'closing'  # Gap is reducing (driver1 catching)
            elif recent_changes > 0.1:
                trend = 'extending'  # Gap is increasing
            else:
                trend = 'stable'
        else:
            trend = 'unknown'
            
        return {
            'current_interval': latest['interval'],
            'lap': int(latest['lap_number']),
            'trend': trend,
            'closing_rate': latest['closing_rate'] if pd.notna(latest['closing_rate']) else 0.0,
            'position_d1': int(latest['position_d1']),
            'position_d2': int(latest['position_d2'])
        }
    
    def _get_average_lap_time(self, driver_num: int) -> Optional[float]:
        """Calculate average lap time for a driver"""
        driver_laps = self.lap_data[self.lap_data['driver_number'] == driver_num]
        
        if len(driver_laps) < 2:
            return None
            
        # Calculate lap times from consecutive laps
        driver_laps_sorted = driver_laps.sort_values('lap_number')
        lap_times = []
        
        for i in range(1, len(driver_laps_sorted)):
            lap_time = (driver_laps_sorted.iloc[i]['date_start'] - 
                       driver_laps_sorted.iloc[i-1]['date_start']).total_seconds()
            
            # Filter out outliers (pit stops, safety car, etc.)
            if 60 < lap_time < 150:  # Reasonable F1 lap time range
                lap_times.append(lap_time)
                
        return np.mean(lap_times) if lap_times else None
    
    def detect_events(self, driver_num: int) -> List[Dict]:
        """
        Detect events like pit stops, fastest laps, etc.
        """
        events: list = []
        driver_laps = self.lap_data[self.lap_data['driver_number'] == driver_num]
        
        if len(driver_laps) < 2:
            return events
            
        driver_laps_sorted = driver_laps.sort_values('lap_number')
        
        for i in range(1, len(driver_laps_sorted)):
            lap_time = (driver_laps_sorted.iloc[i]['date_start'] - 
                       driver_laps_sorted.iloc[i-1]['date_start']).total_seconds()
            
            # Detect pit stop (lap time > 30s longer than average)
            avg_lap = self._get_average_lap_time(driver_num)
            if avg_lap and lap_time > avg_lap + 30:
                events.append({
                    'type': 'pit_stop',
                    'lap': int(driver_laps_sorted.iloc[i]['lap_number']),
                    'duration': lap_time - avg_lap
                })
                
        return events


def resolve_replay_lap(
    replay_session: ReplaySession,
    replay_lap: Optional[int],
) -> Optional[int]:
    """Clamp a requested replay lap onto the normalized session contract."""
    requested_lap = 1 if replay_lap is None else replay_lap
    return clamp_replay_lap(requested_lap, replay_session.max_lap_number)


def resolve_replay_lap_from_controller(
    replay_session: ReplaySession,
    controller_state: Optional[ReplayControllerState],
    *,
    now: Optional[datetime] = None,
) -> Optional[int]:
    """Resolve the lap from controller-owned replay state instead of chart history."""
    if controller_state is None:
        return resolve_replay_lap(replay_session, None)

    effective_lap = get_effective_replay_lap(controller_state, now=now)
    return resolve_replay_lap(replay_session, effective_lap)


def filter_interval_history_for_replay(
    interval_history: pd.DataFrame,
    replay_lap: Optional[int],
) -> pd.DataFrame:
    """Return only the interval rows visible at the active replay lap."""
    if interval_history.empty or "lap_number" not in interval_history.columns:
        return interval_history.copy()

    if replay_lap is None:
        return interval_history.iloc[0:0].copy()

    visible_history = interval_history[interval_history["lap_number"] <= replay_lap]
    return visible_history.reset_index(drop=True)


def get_latest_known_lap(
    replay_session: ReplaySession,
    driver_number: int,
    replay_lap: Optional[int],
) -> Optional[ReplayLap]:
    """Return the latest known lap row at or before the replay position."""
    target_lap = resolve_replay_lap(replay_session, replay_lap)
    if target_lap is None:
        return None

    latest_match: Optional[ReplayLap] = None
    for lap in replay_session.get_driver_laps(driver_number):
        if lap.lap_number > target_lap:
            break
        latest_match = lap
    return latest_match


def get_current_tyre_compound(
    replay_session: ReplaySession,
    driver_number: int,
    replay_lap: Optional[int],
) -> Optional[str]:
    """Resolve the current compound, falling back to earlier known stint rows."""
    target_lap = resolve_replay_lap(replay_session, replay_lap)
    if target_lap is None:
        return None

    driver_laps = replay_session.get_driver_laps(driver_number)
    for lap in reversed(driver_laps):
        if lap.lap_number > target_lap:
            continue
        if lap.compound:
            return lap.compound
        source_compound = lap.source_fields.get("tyre_compound")
        if source_compound:
            return str(source_compound)
    return None


def get_current_tyre_age(
    replay_session: ReplaySession,
    driver_number: int,
    replay_lap: Optional[int],
) -> Optional[int]:
    """
    Resolve the tyre age at the lap-granular replay position.

    When the API provides tyre age on a row, the helper advances that value
    forward within the same stint. Otherwise it falls back to a stint-start
    inference using compound/stint boundaries.
    """
    target_lap = resolve_replay_lap(replay_session, replay_lap)
    if target_lap is None:
        return None

    latest_lap = get_latest_known_lap(replay_session, driver_number, target_lap)
    if latest_lap is None:
        return None

    lap_offset = max(target_lap - latest_lap.lap_number, 0)
    if latest_lap.tyre_age_at_start is not None:
        return int(max(latest_lap.tyre_age_at_start + lap_offset, 0))

    stint_start_lap = _infer_stint_start_lap(replay_session, driver_number, latest_lap)
    if stint_start_lap is None:
        return None
    return max(target_lap - stint_start_lap, 0)


def get_driver_snapshot(
    replay_session: ReplaySession,
    driver_number: int,
    replay_lap: Optional[int],
) -> Dict[str, Any]:
    """Build a stable per-driver replay snapshot for UI and test callers."""
    target_lap = resolve_replay_lap(replay_session, replay_lap)
    latest_lap = get_latest_known_lap(replay_session, driver_number, target_lap)
    driver = replay_session.drivers.get(driver_number)

    compound = get_current_tyre_compound(replay_session, driver_number, target_lap)
    tyre_age = get_current_tyre_age(replay_session, driver_number, target_lap)

    return {
        "driver_number": driver_number,
        "driver_name": driver.name_acronym if driver else str(driver_number),
        "replay_lap": target_lap,
        "latest_known_lap": latest_lap.lap_number if latest_lap else None,
        "position": latest_lap.position if latest_lap else None,
        "current_compound": compound or "Unknown",
        "compound_display": compound or "Compound unavailable",
        "current_tyre_age": tyre_age,
        "tyre_age_display": f"{tyre_age} laps" if tyre_age is not None else "Age unavailable",
    }


def get_replay_snapshot(
    replay_session: ReplaySession,
    driver_numbers: List[int],
    replay_lap: Optional[int],
) -> Dict[int, Dict[str, Any]]:
    """Return driver snapshots keyed by driver number for one replay lap."""
    target_lap = resolve_replay_lap(replay_session, replay_lap)
    return {
        driver_number: get_driver_snapshot(replay_session, driver_number, target_lap)
        for driver_number in driver_numbers
    }


def _infer_stint_start_lap(
    replay_session: ReplaySession,
    driver_number: int,
    latest_lap: ReplayLap,
) -> Optional[int]:
    driver_laps = replay_session.get_driver_laps(driver_number)
    if not driver_laps:
        return None

    stint_start = latest_lap.lap_number
    current_compound = latest_lap.compound
    current_stint = latest_lap.stint_number

    for lap in reversed(driver_laps):
        if lap.lap_number > latest_lap.lap_number:
            continue
        if lap.lap_number == latest_lap.lap_number:
            stint_start = lap.lap_number
            continue

        compound_changed = (
            current_compound is not None
            and lap.compound is not None
            and lap.compound != current_compound
        )
        stint_changed = (
            current_stint is not None
            and lap.stint_number is not None
            and lap.stint_number != current_stint
        )
        stint_unknown = current_stint is not None and lap.stint_number is None
        pit_boundary = bool(latest_lap.is_pit_out_lap)

        if compound_changed or stint_changed or stint_unknown or pit_boundary:
            break

        stint_start = lap.lap_number

    return stint_start


class RaceAnalyzer:
    """Advanced race analysis functions"""
    
    @staticmethod
    def predict_catch_point(current_interval: float, closing_rate: float,
                           current_lap: int, total_laps: int) -> Optional[int]:
        """
        Predict at which lap driver1 will catch driver2
        Returns None if catch is not possible within race distance
        """
        if closing_rate >= 0:  # Not closing
            return None
            
        laps_to_catch = abs(current_interval / closing_rate)
        catch_lap = current_lap + laps_to_catch
        
        if catch_lap <= total_laps:
            return int(catch_lap)
        return None
    
    @staticmethod
    def calculate_gap_percentage(interval: float, lap_time: float) -> float:
        """Calculate gap as percentage of lap time"""
        if lap_time <= 0:
            return 0.0
        return (interval / lap_time) * 100
    
    @staticmethod
    def is_in_drs_range(interval: float) -> bool:
        """Check if cars are within DRS range (1 second)"""
        return 0 <= interval <= 1.0
