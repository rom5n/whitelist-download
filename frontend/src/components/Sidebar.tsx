import { memo, useCallback, useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CloudOff, Globe, Inbox, RotateCw } from 'lucide-react';
import { useTranslation } from '../i18n';
import { parseVlessString } from '../api';
import { useScrollFade } from '../useScrollFade';
import Flag from '../ui/Flag';
import Skeleton from '../ui/Skeleton';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';
import Button from '../ui/Button';

interface SidebarProps {
  countries: string[];
  countryCounts: Record<string, number>;
  activeCountry: string | null;
  onCountrySelect: (country: string | null) => void;
  configs: string[];
  activeConfigIndex: number | null;
  onConfigSelect: (index: number | null) => void;
  isLoadingConfigs: boolean;
  onLoadMore: () => void;
  hasMore: boolean;
  totalAvailableConfigs: number;
  /** Statistics have loaded, so the list can be shown */
  ready: boolean;
  loadError: boolean;
  onRetry: () => void;
}

const ROW_HEIGHT = 60;
const SKELETON_ROWS = 3;

function CountryChip({ label, country, count, active, onClick }: { label: string; country?: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`press relative flex h-9 min-w-11 items-center justify-center gap-2 rounded-sm border px-3 text-sm font-medium whitespace-nowrap cursor-pointer
                  before:absolute before:-inset-y-1 before:inset-x-0
                  ${active
                    ? 'border-accent/40 bg-accent-soft text-accent-text'
                    : 'border-line bg-surface text-fg-2 hover:border-line-strong hover:text-fg'}`}
    >
      {country && <Flag country={country} className="size-4" />}
      {label}
      {count !== undefined && <span className={`text-xs tabular-nums ${active ? 'text-accent-text/80' : 'text-fg-3'}`}>{count}</span>}
    </button>
  );
}

/** A row of the config list; memoized, so scrolling only renders rows that come into view. */
const ConfigRow = memo(function ConfigRow({ raw, index, active, onSelect }: { raw: string; index: number; active: boolean; onSelect: (index: number) => void }) {
  const { t } = useTranslation();
  const config = useMemo(() => parseVlessString(raw), [raw]);

  return (
    <button
      type="button"
      data-index={index}
      onClick={() => onSelect(index)}
      aria-current={active ? 'true' : undefined}
      className={`group relative flex h-full w-full items-center gap-3 rounded-md px-3 text-left cursor-pointer transition-colors duration-150
                  focus-visible:-outline-offset-2
                  ${active ? 'bg-accent-soft' : 'hover:bg-raised'}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-3 left-0 w-[3px] origin-center rounded-r-full bg-accent transition-transform duration-300 ease-spring
                    ${active ? 'scale-y-100' : 'scale-y-0'}`}
      />
      <Flag emoji={config?.flag ?? ''} className="size-6" />
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-mono text-[13px] ${active ? 'text-accent-text' : 'text-fg'}`}>{config?.ip ?? raw}</span>
        <span className="block truncate text-xs text-fg-3">{config?.country || t('sidebar.unknown')}</span>
      </span>
      <span className="shrink-0 text-xs tabular-nums text-fg-3">{config?.sequence}</span>
    </button>
  );
});

export default function Sidebar({
  countries,
  countryCounts,
  activeCountry,
  onCountrySelect,
  configs,
  activeConfigIndex,
  onConfigSelect,
  isLoadingConfigs,
  onLoadMore,
  hasMore,
  totalAvailableConfigs,
  ready,
  loadError,
  onRetry,
}: SidebarProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const chipsRef = useScrollFade<HTMLDivElement>();
  const selectConfig = useCallback((index: number) => onConfigSelect(index), [onConfigSelect]);

  const showSkeletons = !ready || isLoadingConfigs || (hasMore && configs.length > 0);
  const count = configs.length + (showSkeletons ? SKELETON_ROWS : 0);

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });
  const items = virtualizer.getVirtualItems();
  const lastIndex = items.length ? items[items.length - 1].index : -1;

  // Infinite loading: fetch the next page when the end of the list comes into view
  useEffect(() => {
    if (ready && hasMore && !isLoadingConfigs && configs.length > 0 && lastIndex >= configs.length - 5) {
      onLoadMore();
    }
  }, [ready, hasMore, isLoadingConfigs, configs.length, lastIndex, onLoadMore]);

  // Arrow keys move through the configs, scrolling rows into view as needed
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const current = (document.activeElement as HTMLElement | null)?.dataset.index;
    if (current === undefined) return;

    event.preventDefault();
    const next = Math.min(configs.length - 1, Math.max(0, Number(current) + (event.key === 'ArrowDown' ? 1 : -1)));
    virtualizer.scrollToIndex(next, { align: 'auto' });
    requestAnimationFrame(() => scrollRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.focus());
  };

  const aggregateActive = activeConfigIndex === null;
  const empty = ready && !isLoadingConfigs && configs.length === 0 && !hasMore;

  return (
    <div className="flex h-full w-full flex-col">
      {/* Country filter; zones of the sidebar are told apart by spacing, not by lines */}
      <div className="px-4 pb-2 pt-3">
        {!ready && !loadError ? (
          <div aria-busy="true">
            <p className="mb-2 flex h-6 items-center gap-2 text-sm text-fg-3">
              <Spinner className="size-3.5" />
              {t('sidebar.loading')}
            </p>
            <div className="flex flex-wrap gap-2" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-9 w-24 rounded-sm" />)}
            </div>
          </div>
        ) : (
          <div ref={chipsRef} role="group" aria-label={t('sidebar.filter')} className="scroll-fade -mx-1 flex max-h-[7.75rem] flex-wrap gap-2 overflow-y-auto px-1 py-1">
            <CountryChip label={t('sidebar.all')} active={activeCountry === null} onClick={() => onCountrySelect(null)} />
            {countries.map(country => (
              <CountryChip
                key={country}
                label={country}
                country={country}
                count={countryCounts[country]}
                active={activeCountry === country}
                onClick={() => onCountrySelect(country)}
              />
            ))}
          </div>
        )}
      </div>

      {/* The whole subscription (or the whole country) */}
      <button
        type="button"
        onClick={() => onConfigSelect(null)}
        aria-current={aggregateActive ? 'true' : undefined}
        className={`group relative mx-2 mb-2 flex h-[4.5rem] shrink-0 items-center gap-3 rounded-lg px-3 text-left cursor-pointer transition-colors duration-150
                    focus-visible:-outline-offset-2 ${aggregateActive ? 'bg-accent-soft' : 'hover:bg-raised'}`}
      >
        <span
          aria-hidden="true"
          className={`absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-accent transition-transform duration-300 ease-spring ${aggregateActive ? 'scale-y-100' : 'scale-y-0'}`}
        />
        <span className={`flex size-10 items-center justify-center rounded-md ${aggregateActive ? 'bg-accent text-accent-fg' : 'bg-raised text-fg-2'} transition-colors duration-200`}>
          {activeCountry ? <Flag country={activeCountry} className="size-6" /> : <Globe className="size-5" aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-fg">
            {activeCountry ? `${t('sidebar.all')} · ${activeCountry}` : t('sidebar.allRegions')}
          </span>
          <span className="block text-xs text-fg-3">{t('sidebar.aggregated')}</span>
        </span>
        {ready && <span className="shrink-0 rounded-sm bg-raised px-2 py-0.5 text-xs font-medium tabular-nums text-fg-2">{totalAvailableConfigs}</span>}
      </button>

      {/* Configs: only the rows in view are rendered */}
      {loadError ? (
        <EmptyState
          tone="danger"
          icon={<CloudOff className="size-5" aria-hidden="true" />}
          title={t('control.error')}
          action={<Button size="sm" icon={<RotateCw className="size-4" aria-hidden="true" />} onClick={onRetry}>{t('settings.retry')}</Button>}
        >
          {t('common.loadError')}
        </EmptyState>
      ) : empty ? (
        <EmptyState icon={<Inbox className="size-5" aria-hidden="true" />} title={t('sidebar.emptyTitle')}>
          {t('sidebar.emptyText')}
        </EmptyState>
      ) : (
        <div ref={scrollRef} onKeyDown={onKeyDown} className="min-h-0 flex-1 overflow-y-auto" aria-busy={isLoadingConfigs || undefined}>
          <ul className="relative w-full" style={{ height: virtualizer.getTotalSize() }} aria-label={t('sidebar.list')}>
            {items.map(item => (
              <li
                key={item.key}
                className="absolute left-0 top-0 w-full px-2"
                style={{ height: item.size, transform: `translateY(${item.start}px)` }}
              >
                {item.index < configs.length ? (
                  <ConfigRow
                    raw={configs[item.index]}
                    index={item.index}
                    active={activeConfigIndex === item.index}
                    onSelect={selectConfig}
                  />
                ) : (
                  <div className="flex h-full items-center gap-3 px-3" aria-hidden="true">
                    <Skeleton className="size-6 rounded-full" />
                    <span className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-3/5" />
                      <Skeleton className="h-2.5 w-1/3" />
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
