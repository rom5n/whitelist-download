import { useState, useEffect, useRef, useCallback, useEffectEvent, Component, lazy, Suspense } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import Sidebar from './components/Sidebar';
import DetailsView from './components/DetailsView';
import SettingsView from './components/SettingsView';
import LogsView from './components/LogsView';
import StatisticsView from './components/StatisticsView';
import AppHeader from './components/AppHeader';
import { BottomTabs } from './components/NavTabs';
import { fetchStatistics, fetchSubscriptionLink, fetchConfigs, fetchUpdaterStatus, type Statistics, type UpdaterState } from './api';
import { useTranslation } from './i18n';
import { usePollingState } from './usePollingState';
import type { Mode } from './navigation';
import Spinner from './ui/Spinner';

// Release notes need a markdown renderer; it is loaded only when the update view is opened
const UpdateView = lazy(() => import('./components/UpdateView'));

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col justify-center p-8" role="alert">
          <div className="mx-auto w-full max-w-2xl rounded-lg border border-danger/30 bg-danger-soft p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-danger-text">
              <TriangleAlert className="size-5" aria-hidden="true" />
              Something went wrong
            </h2>
            <pre className="overflow-auto whitespace-pre-wrap rounded-md bg-sunken p-4 font-mono text-xs text-fg-2">
              {this.state.error?.toString()}
              {'\n'}
              {this.state.error?.stack}
            </pre>
          </div>
        </div>
      );
    }
    return <>{this.props.children}</>;
  }
}

const isNarrow = () => window.innerWidth < 768;

export default function App() {
  const { t } = useTranslation();

  const [mode, setMode] = useState<Mode>('details');
  const [mobileView, setMobileView] = useState<'sidebar' | 'content'>('sidebar');

  const [stats, setStats] = useState<Statistics | null>(null);
  const [countries, setCountries] = useState<string[]>([]);
  const [activeCountry, setActiveCountry] = useState<string | null>(null);

  const [configs, setConfigs] = useState<string[]>([]);
  const [activeConfigIndex, setActiveConfigIndex] = useState<number | null>(null);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [baseSubLink, setBaseSubLink] = useState('');
  const [loadError, setLoadError] = useState(false);

  const [offset, setOffset] = useState(1);
  const [limit, setLimit] = useState(0); // 0 means "No limit"
  const [githubStars, setGithubStars] = useState<number | null>(null);

  const [updaterState, setUpdaterState] = useState<UpdaterState | null>(null);
  const { state: pollingState, setState: setPollingState } = usePollingState();

  useEffect(() => {
    // Polled twice a second: keep the previous object when nothing changed, so the app doesn't re-render for nothing
    const fetchUpdates = () => fetchUpdaterStatus().then(st => {
      setUpdaterState(prev => (prev && JSON.stringify(prev) === JSON.stringify(st) ? prev : st));
    }).catch(e => {
      setUpdaterState(prev => {
        if (prev?.status === 'installing' || prev?.status === 'downloading') {
          return { ...prev, status: 'reload' };
        }
        return prev;
      });
      console.error(e);
    });

    fetchUpdates();
    const timer = window.setInterval(fetchUpdates, 500);
    return () => clearInterval(timer);
  }, []);

  // Caching mechanism
  const configsCache = useRef<Record<string, { data: string[], lastUpdate: number }>>({});

  const loadInitialData = useCallback(async () => {
    setLoadError(false);
    try {
      const statsData = await fetchStatistics();
      setStats(statsData);
      setCountries(Object.keys(statsData.configs_by_country || {}));

      const link = await fetchSubscriptionLink();
      setBaseSubLink(link);

      try {
        const ghRes = await fetch('https://api.github.com/repos/rom5n/whitelist-download');
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          setGithubStars(ghData.stargazers_count);
        }
      } catch (err) {
        console.error('Failed to fetch github stars', err);
      }
    } catch (err) {
      console.error(err);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInitialData();
  }, [loadInitialData]);

  const loadConfigs = useCallback(async (isLoadMore = false) => {
    if (!stats) return;

    const countryKey = activeCountry || 'ALL';
    const currentCache = configsCache.current[countryKey];

    // Check if we can use cache (only for initial load of this country, not when loading more)
    if (!isLoadMore && currentCache && currentCache.lastUpdate >= stats.last_update) {
      setConfigs(currentCache.data);
      // Assume we fetched everything up to currentCache.data.length
      const totalAvailable = activeCountry ? stats.configs_by_country[activeCountry] : stats.amount_configs;
      setHasMore(currentCache.data.length < totalAvailable);
      return;
    }

    setIsLoadingConfigs(true);

    const chunkLimit = 25;
    const currentOffset = isLoadMore ? configs.length + 1 : 1;

    try {
      const formattedCountry = activeCountry ? activeCountry.toLowerCase().replace(/\s+/g, '-') : undefined;
      const res = await fetchConfigs(formattedCountry, currentOffset, chunkLimit);
      const newConfigs = res.configs || [];

      let updatedConfigs: string[];
      if (isLoadMore) {
        updatedConfigs = [...configs, ...newConfigs];
      } else {
        updatedConfigs = newConfigs;
        // Also reset details view pagination when switching country
        setOffset(1);
        setLimit(0);
      }

      setConfigs(updatedConfigs);

      const totalAvailable = activeCountry ? stats.configs_by_country[activeCountry] : stats.amount_configs;
      setHasMore(updatedConfigs.length < totalAvailable);

      // Update cache
      configsCache.current[countryKey] = {
        data: updatedConfigs,
        lastUpdate: stats.last_update
      };

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingConfigs(false);
    }
  }, [activeCountry, stats, configs]);

  // Reads the latest loadConfigs without making the effect below depend on it: loading more configs
  // must not reload the list (and reset the selected config).
  const reloadConfigs = useEffectEvent(() => {
    loadConfigs(false);
  });

  // When active country changes or stats update, load configs
  useEffect(() => {
    if (stats) reloadConfigs();
  }, [activeCountry, stats]);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingConfigs && hasMore) {
      loadConfigs(true);
    }
  }, [isLoadingConfigs, hasMore, loadConfigs]);

  // Get max limit/offset for the DetailsView
  const maxConfigs = stats
    ? (activeCountry ? stats.configs_by_country[activeCountry] || 0 : stats.amount_configs)
    : 100;

  const selectCountry = useCallback((c: string | null) => {
    setActiveCountry(c);
    setActiveConfigIndex(null);
    setMode('details');
    if (isNarrow()) setMobileView('content');
  }, []);

  const selectConfig = useCallback((i: number | null) => {
    setActiveConfigIndex(i);
    setMode('details');
    if (isNarrow()) setMobileView('content');
  }, []);

  const showList = useCallback(() => setMobileView('sidebar'), []);

  const navigate = useCallback((next: Mode) => {
    setMode(next);
    if (next === 'details') setMobileView('sidebar');
    else if (isNarrow()) setMobileView('content');
  }, []);

  const isDetails = mode === 'details';

  return (
    <div className="flex h-dvh flex-col overflow-hidden text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-3 focus:shadow-lg"
      >
        Skip to content
      </a>

      <AppHeader
        mode={mode}
        onNavigate={navigate}
        updaterState={updaterState}
        paused={pollingState?.paused ?? false}
        githubStars={githubStars}
      />

      <div className="relative flex min-h-0 flex-1">
        {isDetails && (
          <aside
            aria-label={t('sidebar.list')}
            className={`w-full shrink-0 border-r border-line bg-surface/60 md:w-80 lg:w-[22rem] animate-[fade_300ms_var(--ease-out)_60ms_both]
                        ${mobileView === 'sidebar' ? 'flex' : 'hidden md:flex'}`}
          >
            <Sidebar
              countries={countries}
              countryCounts={stats?.configs_by_country ?? {}}
              activeCountry={activeCountry}
              onCountrySelect={selectCountry}
              configs={configs}
              activeConfigIndex={activeConfigIndex}
              onConfigSelect={selectConfig}
              isLoadingConfigs={isLoadingConfigs}
              onLoadMore={handleLoadMore}
              hasMore={hasMore}
              totalAvailableConfigs={maxConfigs}
              ready={stats !== null}
              loadError={loadError}
              onRetry={loadInitialData}
            />
          </aside>
        )}

        <main
          id="main"
          tabIndex={-1}
          className={`min-w-0 flex-1 flex-col outline-none ${isDetails && mobileView === 'sidebar' ? 'hidden md:flex' : 'flex'}`}
        >
          <ErrorBoundary>
            {/* Keyed by the section: each view enters with a short rise; nothing waits for an exit.
                The subscription view animates itself, since it also changes with the selected config. */}
            <div key={mode} className={`flex min-h-0 flex-1 flex-col ${isDetails ? '' : 'animate-enter'}`}>
              {mode === 'details' && (
                <DetailsView
                  key={`${activeCountry ?? 'all'}-${activeConfigIndex ?? 'sub'}`}
                  activeCountry={activeCountry}
                  activeConfigIndex={activeConfigIndex}
                  activeConfig={activeConfigIndex !== null ? configs[activeConfigIndex] ?? null : null}
                  baseSubLink={baseSubLink}
                  offset={offset}
                  limit={limit}
                  onOffsetChange={setOffset}
                  onLimitChange={setLimit}
                  maxConfigs={maxConfigs}
                  onBack={showList}
                />
              )}

              {mode === 'settings' && <SettingsView version={stats?.version} pollingState={pollingState} onPollingStateChange={setPollingState} />}
              {mode === 'logs' && <LogsView />}
              {mode === 'statistics' && <StatisticsView stats={stats} pollingState={pollingState} loadError={loadError} onRetry={loadInitialData} />}
              {mode === 'update' && (
                <Suspense fallback={<div className="flex flex-1 items-center justify-center text-fg-3"><Spinner className="size-6" label={t('settings.loading')} /></div>}>
                  <UpdateView updaterState={updaterState} />
                </Suspense>
              )}
            </div>
          </ErrorBoundary>
        </main>
      </div>

      <BottomTabs mode={mode} onNavigate={navigate} attention={{ settings: pollingState?.paused ?? false }} />
    </div>
  );
}
