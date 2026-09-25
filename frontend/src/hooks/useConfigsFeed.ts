import { useCallback, useEffect, useRef, useState } from 'react';
import { configKey, fetchConfigs } from '../api';

const PAGE_SIZE = 25;

interface FeedData {
  /** undefined until the first load finishes */
  country: string | null | undefined;
  /** last_update of the statistics these items were loaded for */
  version: number | null;
  items: string[];
  /** The server returned less than requested, nothing more to load */
  exhausted: boolean;
}

interface RequestKey {
  country: string | null;
  version: number | null;
}

export interface ConfigsFeed {
  items: string[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasError: boolean;
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
}

function sameItems(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

function appendUnique(items: string[], more: string[]): string[] {
  const seen = new Set(items.map(configKey));
  return [...items, ...more.filter(item => !seen.has(configKey(item)))];
}

/**
 * Paginated list of configs for the sidebar.
 *
 * When the server reports new data (`lastUpdate` changes), the already loaded window is refetched
 * in one request and replaced in place: the list keeps its size, so the scroll position, focus and
 * the selected config (matched by `configKey`) survive the update.
 */
export function useConfigsFeed(country: string | null, lastUpdate: number | null): ConfigsFeed {
  const [data, setData] = useState<FeedData>({ country: undefined, version: null, items: [], exhausted: false });
  const [failedRequest, setFailedRequest] = useState<RequestKey | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  const dataRef = useRef(data);
  const generation = useRef(0);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (lastUpdate === null) return;

    const gen = ++generation.current;
    const controller = new AbortController();
    const current = dataRef.current;
    const isRefresh = current.country === country;
    const limit = isRefresh ? Math.max(PAGE_SIZE, current.items.length) : PAGE_SIZE;

    fetchConfigs(country, 1, limit, controller.signal)
      .then(res => {
        if (gen !== generation.current) return;
        const items = res.configs ?? [];
        setData(prev => ({
          country,
          version: lastUpdate,
          items: prev.country === country && sameItems(prev.items, items) ? prev.items : items,
          exhausted: items.length < limit,
        }));
        setFailedRequest(null);
      })
      .catch(err => {
        if (controller.signal.aborted || gen !== generation.current) return;
        console.error(err);
        setFailedRequest({ country, version: lastUpdate });
      });

    return () => controller.abort();
  }, [country, lastUpdate, retryToken]);

  const loadMore = useCallback(() => {
    const current = dataRef.current;
    if (isLoadingMore || current.exhausted || current.country !== country || current.version !== lastUpdate) return;
    const loadedCountry = current.country;

    const gen = generation.current;
    setIsLoadingMore(true);
    fetchConfigs(loadedCountry, current.items.length + 1, PAGE_SIZE)
      .then(res => {
        if (gen !== generation.current) return;
        const more = res.configs ?? [];
        setData(prev => ({ ...prev, items: appendUnique(prev.items, more), exhausted: more.length < PAGE_SIZE }));
      })
      .catch(err => console.error(err))
      .finally(() => setIsLoadingMore(false));
  }, [country, lastUpdate, isLoadingMore]);

  const retry = useCallback(() => {
    setFailedRequest(null);
    setRetryToken(n => n + 1);
  }, []);

  const isCurrent = data.country === country;
  const hasError = failedRequest !== null && failedRequest.country === country && failedRequest.version === lastUpdate;
  const isLoading = lastUpdate === null || (!hasError && (!isCurrent || data.version !== lastUpdate));

  return {
    // Items of another country are never shown while the new ones load
    items: isCurrent ? data.items : [],
    // A background refresh of the same country keeps the list visible, only the first load shows a loader
    isLoading: isLoading && !isCurrent,
    isLoadingMore,
    hasError: hasError && !isCurrent,
    hasMore: isCurrent && !data.exhausted,
    loadMore,
    retry,
  };
}
