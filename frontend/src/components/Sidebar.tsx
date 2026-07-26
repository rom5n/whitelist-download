import { useMemo, useEffect, useRef } from 'react';
import { useTranslation } from '../i18n';
import { parseVlessString, type ParsedConfig } from '../api';

interface SidebarProps {
  countries: string[];
  activeCountry: string | null;
  onCountrySelect: (country: string | null) => void;
  configs: string[];
  activeConfigIndex: number | null;
  onConfigSelect: (index: number | null) => void;
  isLoadingConfigs: boolean;
  onLoadMore: () => void;
  hasMore: boolean;
  totalAvailableConfigs: number;
}

export default function Sidebar({
  countries,
  activeCountry,
  onCountrySelect,
  configs,
  activeConfigIndex,
  onConfigSelect,
  isLoadingConfigs,
  onLoadMore,
  hasMore,
  totalAvailableConfigs
}: SidebarProps) {
  const { t } = useTranslation();
  const parsedConfigs = useMemo(() => {
    return configs.map(c => parseVlessString(c)).filter(Boolean) as ParsedConfig[];
  }, [configs]);

  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoadingConfigs) {
          onLoadMore();
        }
      },
      { threshold: 1.0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingConfigs, onLoadMore]);

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)]">
      {/* Filters Header */}
      <div className="p-4 border-b border-[var(--color-border)]">
        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
          <button
            onClick={() => onCountrySelect(null)}
            className={`cursor-pointer px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCountry === null
                ? 'bg-accent/20 text-accent font-bold shadow-sm'
                : 'bg-[var(--color-bg-input)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]'
            }`}
          >
            {t('sidebar.all')}
          </button>
          {countries.map((country) => (
            <button
              key={country}
              onClick={() => onCountrySelect(country)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors
              ${activeCountry === country 
                ? 'bg-accent/20 text-accent' 
                : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-input)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {country}
            </button>
          ))}
        </div>
      </div>

      {/* Configs List */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Aggregate Card */}
        <button
          onClick={() => onConfigSelect(null)}
          className={`cursor-pointer w-full text-left px-5 py-4 transition-colors rounded-none flex items-center gap-3 ${
            activeConfigIndex === null
              ? 'bg-accent/10 border-l-4 border-accent text-[var(--color-text-primary)]'
              : 'bg-transparent hover:bg-black/5 dark:hover:bg-white/5 border-l-4 border-transparent text-[var(--color-text-primary)]'
          }`}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-inner bg-[var(--color-bg-input)] border border-[var(--color-border)]">
            🌍
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[var(--color-text-primary)] flex justify-between items-center">
              {activeCountry ? `${t('sidebar.all')} ${activeCountry}` : t('sidebar.allRegions')}
              <span className="text-xs font-medium bg-[var(--color-border)] text-[var(--color-text-secondary)] px-2 py-0.5 rounded-full">
                {totalAvailableConfigs}
              </span>
            </h3>
            <p className="text-xs mt-1 text-[var(--color-text-secondary)]">
              {t('sidebar.aggregated')}
            </p>
          </div>
        </button>

        {parsedConfigs.map((config, index) => {
          const isActive = activeConfigIndex === index;
          return (
            <button
              key={index}
              onClick={() => onConfigSelect(index)}
              className={`cursor-pointer w-full text-left px-5 py-4 transition-colors rounded-none flex items-center justify-between ${
                isActive
                  ? 'bg-accent/10 border-l-4 border-accent text-[var(--color-text-primary)]'
                  : 'bg-transparent hover:bg-black/5 dark:hover:bg-white/5 border-l-4 border-transparent text-[var(--color-text-primary)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl drop-shadow-sm">{config.flag || '🏳️'}</div>
                <div>
                  <h3 className="font-semibold truncate max-w-[180px] text-[var(--color-text-primary)]">
                    {config.ip}
                  </h3>
                  <p className="text-xs mt-0.5 text-[var(--color-text-secondary)]">
                    {config.country || t('sidebar.unknown')}
                  </p>
                </div>
              </div>
              <div className="text-xs font-mono font-medium px-2 py-1 rounded-md border shadow-inner bg-[var(--color-bg-card)] text-[var(--color-text-muted)] border-[var(--color-border)]">
                {config.sequence}
              </div>
            </button>
          );
        })}

        {/* Intersection Observer Target for Infinite Scroll */}
        <div ref={observerTarget} className="h-4" />
        
        {isLoadingConfigs && (
          <div className="text-center p-4 text-[var(--color-text-muted)] animate-pulse text-sm">
            {t('sidebar.loading')}
          </div>
        )}
      </div>
    </div>
  );
}
