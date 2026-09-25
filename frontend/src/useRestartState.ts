import { useEffect, useState } from 'react';
import { fetchRestartState, type RestartState } from './api';

const RESTART_POLL_MS = 3000;
const NO_RESTART: RestartState = { required: false, fields: [] };

/**
 * Follows /api/restart-required: which saved settings take effect only after a restart.
 * Lives in App, so the header can show it on every screen; saving settings reports the new state
 * through setRestart right away.
 */
export function useRestartState() {
  const [restart, setRestart] = useState<RestartState>(NO_RESTART);

  useEffect(() => {
    const load = () => fetchRestartState()
      .then(next => setRestart(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next)))
      .catch(() => {
        // The server is restarting or busy: keep what is shown
      });

    load();
    const timer = window.setInterval(load, RESTART_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  return { restart, setRestart };
}
