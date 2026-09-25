import { useCallback, useEffect, useState } from 'react';
import { fetchStatistics, type Statistics } from '../api';

export type LoadStatus = 'loading' | 'ready' | 'error';

/** How often statistics are polled. New configs appear in the UI within this time */
const POLL_INTERVAL_MS = 5000;

export interface StatisticsState {
  stats: Statistics | null;
  status: LoadStatus;
  retry: () => void;
}

/**
 * Polls server statistics. The object identity only changes when the data changes,
 * so consumers re-render (and refetch configs) only on real updates.
 * Polling pauses while the tab is hidden and resumes immediately when it's shown again.
 */
export function useStatistics(): StatisticsState {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const tick = async () => {
      window.clearTimeout(timer);
      if (!document.hidden) {
        try {
          const next = await fetchStatistics();
          if (cancelled) return;
          setStats(prev => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
          setStatus('ready');
        } catch (err) {
          if (cancelled) return;
          console.error(err);
          // Keep showing the last known data on a transient error
          setStatus(prev => (prev === 'ready' ? prev : 'error'));
        }
      }
      if (!cancelled) timer = window.setTimeout(tick, POLL_INTERVAL_MS);
    };

    const onVisibilityChange = () => {
      if (!document.hidden) tick();
    };

    tick();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [retryToken]);

  const retry = useCallback(() => {
    setStatus('loading');
    setRetryToken(n => n + 1);
  }, []);

  return { stats, status, retry };
}
