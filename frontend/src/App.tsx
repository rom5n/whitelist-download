import { useState, useEffect, useRef, useCallback, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import Sidebar from './components/Sidebar';
import DetailsView from './components/DetailsView';
import SettingsView from './components/SettingsView';
import LogsView from './components/LogsView';
import { fetchStatistics, fetchSubscriptionLink, fetchConfigs, type Statistics } from './api';
import { useTranslation } from './i18n';
import { useTheme } from './ThemeContext';

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
        <div className="p-8 text-[var(--color-text-primary)] bg-red-500/10 h-full flex flex-col justify-center">
          <h2 className="text-xl font-bold text-red-500 mb-4">Something went wrong</h2>
          <pre className="text-xs bg-black/50 p-4 rounded-xl text-left text-red-200 overflow-auto whitespace-pre-wrap">
            {this.state.error?.toString()}
            {'\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return <>{this.props.children}</>;
  }
}

type RightPaneMode = 'details' | 'settings' | 'logs';

export default function App() {
  const { t, language, setLanguage } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  const [mode, setMode] = useState<RightPaneMode>('details');
  const [mobileView, setMobileView] = useState<'sidebar' | 'content'>('sidebar');
  
  const [stats, setStats] = useState<Statistics | null>(null);
  const [countries, setCountries] = useState<string[]>([]);
  const [activeCountry, setActiveCountry] = useState<string | null>(null);
  
  const [configs, setConfigs] = useState<string[]>([]);
  const [activeConfigIndex, setActiveConfigIndex] = useState<number | null>(null);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  const [baseSubLink, setBaseSubLink] = useState('');
  
  const [offset, setOffset] = useState(1);
  const [limit, setLimit] = useState(0); // 0 means "No limit"
  const [githubStars, setGithubStars] = useState<number | null>(null);

  // Caching mechanism
  const configsCache = useRef<Record<string, { data: string[], lastUpdate: number }>>({});
  
  const loadInitialData = async () => {
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
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInitialData();
  }, []);

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

  // When active country changes or stats update, load configs
  useEffect(() => {
    if (stats) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveConfigIndex(null);
      loadConfigs(false);
    }
  }, [activeCountry, stats, loadConfigs]);

  const handleLoadMore = () => {
    if (!isLoadingConfigs && hasMore) {
      loadConfigs(true);
    }
  };

  // Get max limit/offset for the DetailsView
  const maxConfigs = stats 
    ? (activeCountry ? stats.configs_by_country[activeCountry] || 0 : stats.amount_configs)
    : 100;

  return (
    <div className="h-screen flex flex-col text-[var(--color-text-primary)] overflow-hidden bg-[var(--color-bg-primary)]">
      <div className="stars-layer">
        <div className="stars-sm" />
        <div className="stars-sm" />
        <div className="stars-md" />
        <div className="stars-md" />
        <div className="stars-lg" />
      </div>

      <header className="h-16 flex-shrink-0 border-b border-[var(--color-border)] bg-[var(--color-glass)] backdrop-blur-md px-6 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent hidden sm:block mr-2">
            {t('header.title')}
          </h1>

          <a href="https://github.com/rom5n/whitelist-download" target="_blank" rel="noreferrer" 
             className="flex items-center gap-2 px-3 py-1.5 rounded-lg border-1 border-[var(--color-text-primary)] text-[var(--color-text-primary)] hover:bg-[var(--color-text-primary)] hover:text-[var(--color-bg-primary)] text-sm font-bold tracking-wide transition-colors cursor-pointer no-underline"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
            <div className="flex items-center gap-1.5 border-l border-current pl-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-amber-400 text-amber-400">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
              <span>{githubStars !== null ? githubStars : '...'}</span>
            </div>
          </a>

          <a href="https://pay.cloudtips.ru/p/c6662c22" target="_blank" rel="noreferrer" 
            className="group cursor-pointer hover:bg-red-500 transition-colors flex items-center gap-2 px-3 py-1.5 rounded-lg border-1 border-red-500 text-red-500 hover:text-white font-medium text-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 group-hover:fill-white group-hover:stroke-white transition-colors">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            {t('header.donate')}
          </a>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setMode('details');
              setMobileView('sidebar');
            }}
            title="Dashboard"
            className={`p-2 rounded-lg cursor-pointer transition-colors ${mode === 'details' ? 'bg-accent/20 text-accent' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-input)] hover:text-[var(--color-text-primary)]'}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </button>
          
          <button
            onClick={() => {
              setMode('logs');
              if (window.innerWidth < 768) setMobileView('content');
            }}
            title={t('control.logs')}
            className={`p-2 rounded-lg cursor-pointer transition-colors ${mode === 'logs' ? 'bg-accent/20 text-accent' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-input)] hover:text-[var(--color-text-primary)]'}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          
          <button
            onClick={() => {
              setMode('settings');
              if (window.innerWidth < 768) setMobileView('content');
            }}
            title={t('control.settings')}
            className={`p-2 rounded-lg cursor-pointer transition-colors ${mode === 'settings' ? 'bg-accent/20 text-accent' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-input)] hover:text-[var(--color-text-primary)]'}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>

          <div className="w-px h-6 bg-[var(--color-border)] mx-1"></div>

          <button
            onClick={() => setLanguage(language === 'en' ? 'ru' : 'en')}
            title="Switch Language"
            className="px-3 py-1.5 rounded-lg text-sm font-bold cursor-pointer text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-input)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            {language === 'en' ? 'RU' : 'EN'}
          </button>

          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
            className="p-2 rounded-lg cursor-pointer text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-input)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-amber-400"><path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-indigo-500"><path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" /></svg>
            )}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative z-10">
        <div className={`w-full md:w-80 lg:w-96 flex-shrink-0 shadow-2xl z-20 h-full ${mobileView === 'sidebar' ? 'block' : 'hidden md:block'}`}>
          <Sidebar
            countries={countries}
            activeCountry={activeCountry}
            onCountrySelect={(c) => {
              setActiveCountry(c);
              setMode('details');
              if (window.innerWidth < 768) setMobileView('content');
            }}
            configs={configs}
            activeConfigIndex={activeConfigIndex}
            onConfigSelect={(i) => {
              setActiveConfigIndex(i);
              setMode('details');
              if (window.innerWidth < 768) setMobileView('content');
            }}
            isLoadingConfigs={isLoadingConfigs}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            totalAvailableConfigs={maxConfigs}
          />
        </div>
        
        <div className={`flex-1 flex flex-col min-w-0 ${mobileView === 'content' ? 'flex' : 'hidden md:flex'}`}>
          <ErrorBoundary>
            {mode === 'details' && (
              <DetailsView
                activeCountry={activeCountry}
                activeConfigIndex={activeConfigIndex}
                configs={configs}
                baseSubLink={baseSubLink}
                offset={offset}
                limit={limit}
                onOffsetChange={setOffset}
                onLimitChange={setLimit}
                maxConfigs={maxConfigs}
              />
            )}
            
            {mode === 'settings' && <SettingsView />}
            {mode === 'logs' && <LogsView />}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}