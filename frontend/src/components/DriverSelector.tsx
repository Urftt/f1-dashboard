import React, { useEffect, useState, useCallback } from 'react';
import type { DriverInfo } from '../types';
import './DriverSelector.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

interface DriverSelectorProps {
  sessionKey: string;
  driver1: string;
  driver2: string;
  onDriversChanged: (driver1: string, driver2: string) => void;
}

function DriverSelector({ sessionKey, driver1, driver2, onDriversChanged }: DriverSelectorProps) {
  const [drivers, setDrivers] = useState<DriverInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionKey) return;
    setLoading(true);

    fetch(`${API_BASE}/api/sessions/${encodeURIComponent(sessionKey)}/lap-data`)
      .then((res) => res.json())
      .then((data) => {
        setDrivers(data.drivers || []);
        // Auto-select first two drivers if not already selected
        if (data.drivers && data.drivers.length >= 2) {
          if (!driver1 && !driver2) {
            onDriversChanged(data.drivers[0].abbreviation, data.drivers[1].abbreviation);
          }
        }
      })
      .catch((err) => console.error('Failed to load drivers:', err))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  const handleDriver1Change = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onDriversChanged(e.target.value, driver2);
    },
    [driver2, onDriversChanged],
  );

  const handleDriver2Change = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onDriversChanged(driver1, e.target.value);
    },
    [driver1, onDriversChanged],
  );

  if (loading) {
    return (
      <div className="driver-selector driver-selector--loading">
        <span className="driver-selector__spinner" />
        Loading drivers...
      </div>
    );
  }

  if (drivers.length === 0) return null;

  return (
    <div className="driver-selector">
      <div className="driver-selector__group">
        <label className="driver-selector__label" htmlFor="driver1-select">
          Driver 1
        </label>
        <select
          id="driver1-select"
          className="driver-selector__select"
          value={driver1}
          onChange={handleDriver1Change}
          style={
            driver1
              ? { borderColor: `#${drivers.find((d) => d.abbreviation === driver1)?.team_color || 'fff'}` }
              : undefined
          }
        >
          <option value="">Select driver...</option>
          {drivers.map((d) => (
            <option key={d.abbreviation} value={d.abbreviation} disabled={d.abbreviation === driver2}>
              {d.abbreviation} - {d.full_name} ({d.team_name})
            </option>
          ))}
        </select>
      </div>

      <span className="driver-selector__vs">VS</span>

      <div className="driver-selector__group">
        <label className="driver-selector__label" htmlFor="driver2-select">
          Driver 2
        </label>
        <select
          id="driver2-select"
          className="driver-selector__select"
          value={driver2}
          onChange={handleDriver2Change}
          style={
            driver2
              ? { borderColor: `#${drivers.find((d) => d.abbreviation === driver2)?.team_color || 'fff'}` }
              : undefined
          }
        >
          <option value="">Select driver...</option>
          {drivers.map((d) => (
            <option key={d.abbreviation} value={d.abbreviation} disabled={d.abbreviation === driver1}>
              {d.abbreviation} - {d.full_name} ({d.team_name})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default DriverSelector;
