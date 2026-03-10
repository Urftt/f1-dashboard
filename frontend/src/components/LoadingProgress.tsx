/**
 * LoadingProgress — Displays real-time progress during FastF1 session loading.
 *
 * Shows a progress bar with percentage, status text, stage indicators, and
 * a cancel button. Consumes SSE events from the backend via loadSessionWithProgress().
 * F1-themed dark UI with smooth animations.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { LoadProgressEvent, LoadSessionRequest, LoadSessionResponse } from '../types';
import { loadSessionWithProgress } from '../api/client';
import './LoadingProgress.css';

export interface LoadingProgressProps {
  /** The session to load — triggers loading when set. */
  request: LoadSessionRequest;
  /** Called when loading completes successfully. */
  onComplete: (response: LoadSessionResponse) => void;
  /** Called when loading fails. */
  onError: (error: string) => void;
  /** Called when user cancels. */
  onCancel?: () => void;
}

const LoadingProgress: React.FC<LoadingProgressProps> = ({
  request,
  onComplete,
  onError,
  onCancel,
}) => {
  const [percentage, setPercentage] = useState(0);
  const [statusText, setStatusText] = useState('Initializing...');
  const [status, setStatus] = useState<'loading' | 'complete' | 'error'>('loading');
  const abortRef = useRef<AbortController | null>(null);

  const handleProgress = useCallback((event: LoadProgressEvent) => {
    if (event.status === 'loading') {
      setPercentage(event.percentage);
      setStatusText(event.detail || 'Loading...');
    } else if (event.status === 'complete') {
      setPercentage(100);
      setStatusText('Session loaded successfully!');
      setStatus('complete');
    } else if (event.status === 'error') {
      setPercentage(0);
      setStatusText(event.detail || 'An error occurred');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    setPercentage(0);
    setStatusText('Connecting to server...');
    setStatus('loading');

    loadSessionWithProgress(request, handleProgress, controller.signal)
      .then((response) => {
        onComplete(response);
      })
      .catch((err) => {
        if (err.message !== 'Session loading was cancelled') {
          onError(err.message);
        }
      });

    return () => {
      controller.abort();
    };
  }, [request, handleProgress, onComplete, onError]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    onCancel?.();
  }, [onCancel]);

  const barWidth = status === 'error' ? 100 : Math.max(percentage, 0);
  const barModifier =
    status === 'error'
      ? 'loading-progress__bar-fill--error'
      : status === 'complete'
        ? 'loading-progress__bar-fill--complete'
        : '';

  return (
    <div
      className={`loading-progress loading-progress--${status}`}
      role="status"
      aria-live="polite"
      data-testid="loading-progress"
    >
      {/* Header row */}
      <div className="loading-progress__header">
        <div className="loading-progress__title-row">
          {status === 'loading' && <span className="loading-progress__pulse" />}
          <span className="loading-progress__title">
            {status === 'complete'
              ? 'Session Loaded'
              : status === 'error'
                ? 'Loading Failed'
                : 'Loading Session Data'}
          </span>
        </div>
        <div className="loading-progress__header-right">
          {status === 'loading' && (
            <span className="loading-progress__percentage" data-testid="loading-percentage">
              {percentage}%
            </span>
          )}
          {status === 'loading' && onCancel && (
            <button
              className="loading-progress__cancel"
              onClick={handleCancel}
              type="button"
              aria-label="Cancel loading"
              data-testid="cancel-loading"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="loading-progress__bar"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`loading-progress__bar-fill ${barModifier}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {/* Status text */}
      <div className="loading-progress__status" data-testid="loading-status">
        {status === 'loading' && <span className="loading-progress__spinner" />}
        <span className="loading-progress__status-text" data-testid="loading-detail">
          {statusText}
        </span>
      </div>

      {/* Stage indicators */}
      {status === 'loading' && (
        <div className="loading-progress__stages">
          <span className={`loading-progress__stage ${percentage >= 0 ? 'loading-progress__stage--active' : ''} ${percentage >= 10 ? 'loading-progress__stage--done' : ''}`}>
            Resolve
          </span>
          <span className="loading-progress__stage-divider" />
          <span className={`loading-progress__stage ${percentage >= 10 ? 'loading-progress__stage--active' : ''} ${percentage >= 85 ? 'loading-progress__stage--done' : ''}`}>
            Download
          </span>
          <span className="loading-progress__stage-divider" />
          <span className={`loading-progress__stage ${percentage >= 85 ? 'loading-progress__stage--active' : ''} ${percentage >= 100 ? 'loading-progress__stage--done' : ''}`}>
            Process
          </span>
        </div>
      )}

      {/* Hint for first-time loads */}
      {status === 'loading' && (
        <div className="loading-progress__hint">
          FastF1 is downloading historical race data. First loads may take 30-60 seconds.
        </div>
      )}
    </div>
  );
};

export default LoadingProgress;
