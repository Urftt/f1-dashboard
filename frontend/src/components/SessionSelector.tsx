/**
 * SessionSelector — Three cascading dropdowns for selecting an F1 session,
 * plus a "Load Session" button that triggers data loading.
 *
 * Flow: Year → Grand Prix → Session Type → Load
 *
 * When an upstream dropdown changes, all downstream dropdowns are reset
 * and disabled until the parent selection is made.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { SeasonInfo, EventInfo, SessionTypeInfo } from '../types';
import { fetchSeasons, fetchEvents, fetchSessions } from '../api/client';
import './SessionSelector.css';

export interface SessionSelectorProps {
  /** Called when all three selections are made (for preview display). */
  onSessionSelected: (year: number, grandPrix: string, sessionType: string) => void;
  /** Called when user clicks "Load Session". */
  onLoadSession?: (year: number, grandPrix: string, sessionType: string) => void;
  /** Whether a session is currently being loaded. */
  isLoading?: boolean;
  /** Whether a session has been successfully loaded. */
  isLoaded?: boolean;
  /** Whether a replay is currently active — disables all session selection controls. */
  isReplaying?: boolean;
}

type LoadingState = 'idle' | 'loading' | 'error';

const SessionSelector: React.FC<SessionSelectorProps> = ({
  onSessionSelected,
  onLoadSession,
  isLoading = false,
  isLoaded = false,
  isReplaying = false,
}) => {
  // --- Data state ---
  const [seasons, setSeasons] = useState<SeasonInfo[]>([]);
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [sessions, setSessions] = useState<SessionTypeInfo[]>([]);

  // --- Selection state ---
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedGrandPrix, setSelectedGrandPrix] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  // --- Loading / error state ---
  const [seasonsLoading, setSeasonsLoading] = useState<LoadingState>('idle');
  const [eventsLoading, setEventsLoading] = useState<LoadingState>('idle');
  const [sessionsLoading, setSessionsLoading] = useState<LoadingState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Whether all three selections have been made
  const isFullySelected =
    selectedYear !== null && selectedGrandPrix !== null && selectedSession !== null;

  // ─── Fetch seasons on mount ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setSeasonsLoading('loading');
    setErrorMessage(null);

    fetchSeasons()
      .then((data) => {
        if (!cancelled) {
          setSeasons(data);
          setSeasonsLoading('idle');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSeasonsLoading('error');
          setErrorMessage(`Failed to load seasons: ${err.message}`);
        }
      });

    return () => { cancelled = true; };
  }, []);

  // ─── Fetch events when year changes ───────────────────────────────
  useEffect(() => {
    if (selectedYear === null) {
      setEvents([]);
      return;
    }

    let cancelled = false;
    setEventsLoading('loading');
    setErrorMessage(null);
    // Reset downstream
    setSelectedGrandPrix(null);
    setSelectedSession(null);
    setSessions([]);

    fetchEvents(selectedYear)
      .then((data) => {
        if (!cancelled) {
          setEvents(data);
          setEventsLoading('idle');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setEvents([]);
          setEventsLoading('error');
          setErrorMessage(`Failed to load events for ${selectedYear}: ${err.message}`);
        }
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  // ─── Fetch sessions when grand prix changes ──────────────────────
  useEffect(() => {
    if (selectedYear === null || selectedGrandPrix === null) {
      setSessions([]);
      return;
    }

    let cancelled = false;
    setSessionsLoading('loading');
    setErrorMessage(null);
    // Reset downstream
    setSelectedSession(null);

    fetchSessions(selectedYear, selectedGrandPrix)
      .then((data) => {
        if (!cancelled) {
          setSessions(data);
          setSessionsLoading('idle');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSessions([]);
          setSessionsLoading('error');
          setErrorMessage(`Failed to load sessions: ${err.message}`);
        }
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedGrandPrix]);

  // ─── Notify parent when all three are selected ────────────────────
  useEffect(() => {
    if (selectedYear !== null && selectedGrandPrix !== null && selectedSession !== null) {
      onSessionSelected(selectedYear, selectedGrandPrix, selectedSession);
    }
  }, [selectedYear, selectedGrandPrix, selectedSession, onSessionSelected]);

  // ─── Handlers ────────────────────────────────────────────────────
  const handleYearChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedYear(value ? parseInt(value, 10) : null);
  }, []);

  const handleGrandPrixChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedGrandPrix(value || null);
  }, []);

  const handleSessionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedSession(value || null);
  }, []);

  const handleLoadClick = useCallback(() => {
    if (isFullySelected && onLoadSession) {
      onLoadSession(selectedYear!, selectedGrandPrix!, selectedSession!);
    }
  }, [isFullySelected, onLoadSession, selectedYear, selectedGrandPrix, selectedSession]);

  // ─── Render ──────────────────────────────────────────────────────
  const isEventsDisabled = selectedYear === null || eventsLoading === 'loading';
  const isSessionsDisabled = selectedGrandPrix === null || sessionsLoading === 'loading';
  const isDisabledByReplay = isReplaying || isLoading;

  return (
    <div className={`session-selector ${isReplaying ? 'session-selector--replaying' : ''}`}>
      <div className="session-selector__title-row">
        <h2 className="session-selector__title">Select Session</h2>
        {isReplaying && (
          <span className="session-selector__replay-badge" data-testid="replay-active-badge">
            REPLAY ACTIVE
          </span>
        )}
      </div>

      {errorMessage && (
        <div className="session-selector__error" role="alert">
          {errorMessage}
        </div>
      )}

      <div className="session-selector__dropdowns">
        {/* ── Year ────────────────────── */}
        <div className="session-selector__field">
          <label htmlFor="year-select" className="session-selector__label">
            Season
          </label>
          <select
            id="year-select"
            className="session-selector__select"
            value={selectedYear ?? ''}
            onChange={handleYearChange}
            disabled={seasonsLoading === 'loading' || isDisabledByReplay}
            data-testid="year-select"
          >
            <option value="">
              {seasonsLoading === 'loading' ? 'Loading\u2026' : '\u2014 Select Year \u2014'}
            </option>
            {seasons.map((s) => (
              <option key={s.year} value={s.year}>
                {s.year}
              </option>
            ))}
          </select>
          {seasonsLoading === 'loading' && <span className="session-selector__spinner" />}
        </div>

        {/* ── Grand Prix ──────────────── */}
        <div className="session-selector__field">
          <label htmlFor="gp-select" className="session-selector__label">
            Grand Prix
          </label>
          <select
            id="gp-select"
            className="session-selector__select"
            value={selectedGrandPrix ?? ''}
            onChange={handleGrandPrixChange}
            disabled={isEventsDisabled || isDisabledByReplay}
            data-testid="gp-select"
          >
            <option value="">
              {eventsLoading === 'loading' ? 'Loading\u2026' : '\u2014 Select Grand Prix \u2014'}
            </option>
            {events.map((ev) => (
              <option key={ev.round_number} value={ev.event_name}>
                {ev.event_name} \u2014 {ev.location}, {ev.country}
              </option>
            ))}
          </select>
          {eventsLoading === 'loading' && <span className="session-selector__spinner" />}
        </div>

        {/* ── Session Type ────────────── */}
        <div className="session-selector__field">
          <label htmlFor="session-select" className="session-selector__label">
            Session
          </label>
          <select
            id="session-select"
            className="session-selector__select"
            value={selectedSession ?? ''}
            onChange={handleSessionChange}
            disabled={isSessionsDisabled || isDisabledByReplay}
            data-testid="session-select"
          >
            <option value="">
              {sessionsLoading === 'loading' ? 'Loading\u2026' : '\u2014 Select Session \u2014'}
            </option>
            {sessions.map((s) => (
              <option key={s.session_key} value={s.session_key}>
                {s.session_name}
                {s.session_date ? ` (${s.session_date.slice(0, 10)})` : ''}
              </option>
            ))}
          </select>
          {sessionsLoading === 'loading' && <span className="session-selector__spinner" />}
        </div>

        {/* ── Load Button ────────────── */}
        <div className="session-selector__field session-selector__field--action">
          <label className="session-selector__label">&nbsp;</label>
          <button
            className={`session-selector__load-btn ${isLoaded ? 'session-selector__load-btn--loaded' : ''}`}
            onClick={handleLoadClick}
            disabled={!isFullySelected || isDisabledByReplay}
            data-testid="load-session-btn"
            type="button"
          >
            {isLoading ? (
              <>
                <span className="session-selector__btn-spinner" />
                Loading...
              </>
            ) : isLoaded ? (
              <>
                <span className="session-selector__btn-check" />
                Loaded
              </>
            ) : (
              'Load Session'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionSelector;
