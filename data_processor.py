"""
Process F1 timing data to calculate intervals between drivers
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import logging

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
        events = []
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