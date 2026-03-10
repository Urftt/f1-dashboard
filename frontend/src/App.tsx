import React, { useCallback, useMemo, useState } from 'react';
import SessionSelector from './components/SessionSelector';
import LoadingProgress from './components/LoadingProgress';
import RaceDashboard from './components/RaceDashboard';
import type { LoadSessionRequest, LoadSessionResponse } from './types';
import './App.css';

type AppPhase = 'selecting' | 'loading' | 'loaded' | 'replaying' | 'error';

function App() {
  const [selection, setSelection] = useState<{
    year: number;
    grandPrix: string;
    sessionType: string;
  } | null>(null);

  const [phase, setPhase] = useState<AppPhase>('selecting');
  const [loadRequest, setLoadRequest] = useState<LoadSessionRequest | null>(null);
  const [loadedSession, setLoadedSession] = useState<LoadSessionResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSessionSelected = useCallback(
    (year: number, grandPrix: string, sessionType: string) => {
      const prev = selection;
      const changed =
        !prev || prev.year !== year || prev.grandPrix !== grandPrix || prev.sessionType !== sessionType;
      setSelection({ year, grandPrix, sessionType });
      // Reset any previous load state when selection changes
      if (changed && (phase === 'loaded' || phase === 'error')) {
        setPhase('selecting');
        setLoadedSession(null);
        setErrorMessage(null);
      }
    },
    [phase, selection],
  );

  const handleLoadSession = useCallback(
    (year: number, grandPrix: string, sessionType: string) => {
      const req: LoadSessionRequest = {
        year,
        grand_prix: grandPrix,
        session_type: sessionType,
      };
      setLoadRequest(req);
      setPhase('loading');
      setErrorMessage(null);
      setLoadedSession(null);
    },
    [],
  );

  const handleLoadComplete = useCallback((response: LoadSessionResponse) => {
    setLoadedSession(response);
    setPhase('loaded');
  }, []);

  const handleLoadError = useCallback((error: string) => {
    setErrorMessage(error);
    setPhase('error');
  }, []);

  const handleLoadCancel = useCallback(() => {
    setPhase('selecting');
    setLoadRequest(null);
  }, []);

  const handleReplayStart = useCallback(() => {
    setPhase('replaying');
  }, []);

  const handleReplayEnd = useCallback(() => {
    setPhase('loaded');
  }, []);

  // Stable reference for LoadingProgress to avoid re-triggering the SSE
  const stableRequest = useMemo(() => loadRequest, [loadRequest]);

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__logo">F1</div>
        <h1 className="app__title">Race Replay Dashboard</h1>
      </header>

      <main className="app__main">
        <SessionSelector
          onSessionSelected={handleSessionSelected}
          onLoadSession={handleLoadSession}
          isLoading={phase === 'loading'}
          isLoaded={phase === 'loaded' || phase === 'replaying'}
          isReplaying={phase === 'replaying'}
        />

        {/* Selection summary before loading */}
        {selection && phase === 'selecting' && (
          <div className="app__selection-summary">
            <span className="app__selection-badge">
              {selection.year} &middot; {selection.grandPrix} &middot; {selection.sessionType}
            </span>
            <span className="app__selection-hint">
              Press Load Session to fetch race data
            </span>
          </div>
        )}

        {/* Loading progress via SSE */}
        {phase === 'loading' && stableRequest && (
          <LoadingProgress
            request={stableRequest}
            onComplete={handleLoadComplete}
            onError={handleLoadError}
            onCancel={handleLoadCancel}
          />
        )}

        {/* Race Dashboard — integrates replay timer, standings, and gap chart */}
        {(phase === 'loaded' || phase === 'replaying') && loadedSession && (
          <RaceDashboard
            session={loadedSession}
            isReplaying={phase === 'replaying'}
            onReplayStart={handleReplayStart}
            onReplayEnd={handleReplayEnd}
          />
        )}

        {/* Error state */}
        {phase === 'error' && errorMessage && (
          <div className="app__error-panel" role="alert">
            <div className="app__error-title">Failed to Load Session</div>
            <div className="app__error-detail">{errorMessage}</div>
            <button
              className="app__error-retry"
              onClick={() => {
                if (selection) {
                  handleLoadSession(selection.year, selection.grandPrix, selection.sessionType);
                }
              }}
              type="button"
            >
              Retry
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
