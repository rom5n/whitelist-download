import { useMemo, useEffect, useRef } from 'react';
import { useTranslation } from '../i18n';
import { configKey, parseVlessString, type ParsedConfig } from '../api';
import type { ConfigsFeed } from '../hooks/useConfigsFeed';
import type { LoadStatus } from '../hooks/useStatistics';
import type { CountryOption } from './CountrySelect';
import FadeScroll from './FadeScroll';
import Flag from './Flag';
import Spinner from './Spinner';

interface SidebarProps {
  countries: CountryOption[];
  countriesStatus: LoadStatus;
  onRetryCountries: () => void;
  activeCountry: string | null;
  onCountrySelect: (country: string | null) => void;
  feed: ConfigsFeed;
  /** configKey of the selected config, null for the aggregated subscription */
  selectedKey: string | null;
  onConfigSelect: (config: string | null) => void;
  totalAvailableConfigs: number;
}

export default function Sidebar({
  countries,
  countriesStatus,
  onRetryCountries,
  activeCountry,
  onCountrySelect,
  feed,
  selectedKey,
  onConfigSelect,
  totalAvailableConfigs,
}: SidebarProps) {
  const { t } = useTranslation();
  const { items, isLoading, isLoadingMore, hasError, hasMore, loadMore, retry } = feed;

  const parsedConfigs = useMemo(() => {
    return items
      .map(raw => ({ raw, key: configKey(raw), parsed: parseVlessString(raw) }))
      .filter((c): c is { raw: string; key: string; parsed: ParsedConfig } => c.parsed !== null);
  }, [items]);

  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 1.0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMore]);

  const chipCls = (active: boolean) =>
    `inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
      active
        ? 'bg-accent/20 text-accent'
        : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-input)] hover:text-[var(--color-text-primary)]'
    }`;

  return (
    <div className="flex flex-col h-full">
      {/* Country filter */}
      <div className="px-4 pt-3 pb-2">
        {countriesStatus === 'error' ? (
          <div role="alert" className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-danger/10 text-sm">
            <span className="text-danger">{t('country.error')}</span>
            <button type="button" onClick={onRetryCountries} className="shrink-0 px-2 py-1 rounded-lg font-medium text-accent hover:bg-accent/10 cursor-pointer">
              {t('country.retry')}
            </button>
          </div>
        ) : countriesStatus === 'loading' ? (
          <div aria-busy="true" aria-disabled="true" className="flex items-center gap-2 px-3 py-1.5 w-max rounded-full text-sm bg-[var(--color-bg-input)] text-[var(--color-text-muted)] cursor-not-allowed">
            <Spinner className="w-3.5 h-3.5" />
            {t('country.loading')}
          </div>
        ) : (
          <FadeScroll className="max-h-32">
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('sidebar.filter')}>
              <button type="button" onClick={() => onCountrySelect(null)} aria-pressed={activeCountry === null} className={chipCls(activeCountry === null)}>
                {t('sidebar.all')}
              </button>
              {countries.map(country => (
                <button
                  type="button"
                  key={country.name}
                  onClick={() => onCountrySelect(country.name)}
                  aria-pressed={activeCountry === country.name}
                  className={chipCls(activeCountry === country.name)}
                >
                  <Flag code={country.code} label={country.name} size="sm" />
                  {country.name}
                </button>
              ))}
            </div>
          </FadeScroll>
        )}
      </div>

      {/* Configs list */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Aggregate card */}
        <button
          type="button"
          onClick={() => onConfigSelect(null)}
          className={`cursor-pointer w-full text-left px-5 py-4 transition-colors rounded-none flex items-center gap-3 ${
            selectedKey === null
              ? 'bg-accent/10 border-l-4 border-accent text-[var(--color-text-primary)]'
              : 'bg-transparent hover:bg-black/5 dark:hover:bg-white/5 border-l-4 border-transparent text-[var(--color-text-primary)]'
          }`}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-inner bg-[var(--color-bg-input)] text-accent shrink-0">
            {activeCountry ? (
              <Flag code={countries.find(c => c.name === activeCountry)?.code} label={activeCountry} size="sm" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="w-5 h-5">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[var(--color-text-primary)] flex justify-between items-center gap-2">
              <span className="truncate">{activeCountry ? `${t('sidebar.all')} ${activeCountry}` : t('sidebar.allRegions')}</span>
              <span className="text-xs font-medium bg-[var(--color-border)] text-[var(--color-text-secondary)] px-2 py-0.5 rounded-full tabular-nums">
                {totalAvailableConfigs}
              </span>
            </h3>
            <p className="text-xs mt-1 text-[var(--color-text-secondary)]">
              {t('sidebar.aggregated')}
            </p>
          </div>
        </button>

        {parsedConfigs.map(({ raw, key, parsed }) => {
          const isActive = selectedKey === key;
          return (
            <button
              type="button"
              key={key}
              onClick={() => onConfigSelect(raw)}
              aria-current={isActive || undefined}
              className={`cursor-pointer w-full text-left px-5 py-4 transition-colors rounded-none flex items-center justify-between gap-3 ${
                isActive
                  ? 'bg-accent/10 border-l-4 border-accent text-[var(--color-text-primary)]'
                  : 'bg-transparent hover:bg-black/5 dark:hover:bg-white/5 border-l-4 border-transparent text-[var(--color-text-primary)]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Flag code={parsed.countryCode} label={parsed.country || t('sidebar.unknown')} size="md" />
                <div className="min-w-0">
                  <h3 className="font-semibold truncate max-w-[180px] text-[var(--color-text-primary)]">
                    {parsed.ip}
                  </h3>
                  <p className="text-xs mt-0.5 text-[var(--color-text-secondary)] truncate">
                    {parsed.country || t('sidebar.unknown')}
                  </p>
                </div>
              </div>
              <div className="text-xs font-mono font-medium px-2 py-1 rounded-md border shadow-inner bg-[var(--color-bg-card)] text-[var(--color-text-muted)] border-[var(--color-border)] shrink-0">
                {parsed.sequence}
              </div>
            </button>
          );
        })}

        {hasError && (
          <div role="alert" className="mx-4 my-3 flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-danger/10 text-sm">
            <span className="text-danger">{t('sidebar.loadError')}</span>
            <button type="button" onClick={retry} className="shrink-0 px-2 py-1 rounded-lg font-medium text-accent hover:bg-accent/10 cursor-pointer">
              {t('country.retry')}
            </button>
          </div>
        )}

        {/* Intersection Observer Target for Infinite Scroll */}
        <div ref={observerTarget} className="h-4" />

        {(isLoading || isLoadingMore) && (
          <div className="flex items-center justify-center gap-2 p-4 text-[var(--color-text-muted)] text-sm">
            <Spinner />
            {t('sidebar.loading')}
          </div>
        )}
      </div>
    </div>
  );
}
