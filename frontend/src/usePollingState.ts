import { useEffect, useState } from 'react';
import { fetchPollingState, type PollingState } from './api';

/**
 * Keeps the configs auto update state (pause, working check level) in sync with the backend,
 * including changes made from the system tray. Returns the state and a setter for applying
 * the state returned by a control request without waiting for the next poll.
 */
export function usePollingState(intervalMs = 3000) {
  const [state, setState] = useState<PollingState | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = () => fetchPollingState().then(next => {
      if (!cancelled) setState(next);
    }).catch(console.error);

    load();
    const timer = window.setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [intervalMs]);

  return { state, setState };
}
