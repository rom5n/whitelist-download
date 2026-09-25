import { useState, useEffect, useMemo, memo, type ReactNode } from 'react';
import { CalendarClock, CloudOff, Globe, Layers, RefreshCw, RotateCw, Timer } from 'lucide-react';
import { useTranslation } from '../i18n';
import type { PollingState, Statistics } from '../api';
import { formatClock } from '../formatTime';
import { getFlagEmoji } from '../countryFlags';
import Flag from '../ui/Flag';
import Skeleton from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import Button from '../ui/Button';

interface StatisticsViewProps {
  stats: Statistics | null;
  pollingState: PollingState | null;
  loadError?: boolean;
  onRetry?: () => void;
}

/** Bars of the chart that animate in; the rest appear at once */
const ANIMATED_BARS = 12;

function Tile({ icon, label, children, delay, className = '' }: { icon: ReactNode; label: string; children: ReactNode; delay: number; className?: string }) {
  return (
    <div
      className={`rounded-lg border border-line bg-surface p-5 shadow-xs animate-enter ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2 text-sm text-fg-2">
        <span className="text-fg-3" aria-hidden="true">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold tabular-nums text-fg">{children}</div>
    </div>
  );
}

/** Configs by country; memoized, so the per-second uptime tick doesn't re-render it. */
const CountryChart = memo(function CountryChart({ byCountry }: { byCountry: [string, number][] }) {
  const { t } = useTranslation();
  const max = byCountry.length ? byCountry[0][1] : 0;

  return (
    <section className="mt-6 rounded-lg border border-line bg-surface shadow-xs animate-enter [animation-delay:200ms]">
      <h2 className="px-5 pt-5 text-base font-semibold text-fg sm:px-6 sm:pt-6">{t('statsView.byCountry')}</h2>
      {byCountry.length === 0 ? (
        <p className="px-5 pb-6 pt-2 text-sm text-fg-3 sm:px-6">{t('statsView.noData')}</p>
      ) : (
        <ul className="space-y-1 p-3 sm:p-4">
          {byCountry.map(([country, count], i) => (
            <li key={country} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_3.5rem] items-center gap-3 rounded-sm px-2 py-1.5 hover:bg-raised">
              <span className="flex min-w-0 items-center gap-2 text-sm text-fg">
                <Flag emoji={getFlagEmoji(country)} className="text-base" />
                <span className="truncate">{country}</span>
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-raised" aria-hidden="true">
                {/* The outer bar holds the value (a static width), the inner one grows in with a transform */}
                <span className="block h-full" style={{ width: `${max ? Math.max(2, (count / max) * 100) : 0}%` }}>
                  <span
                    className={`block h-full origin-left rounded-full bg-accent ${i < ANIMATED_BARS ? 'animate-[grow-x_700ms_var(--ease-out)_both]' : ''}`}
                    style={i < ANIMATED_BARS ? { animationDelay: `${240 + i * 30}ms` } : undefined}
                  />
                </span>
              </span>
              <span className="text-right text-sm tabular-nums text-fg-2">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
});

export default function StatisticsView({ stats, pollingState, loadError = false, onRetry }: StatisticsViewProps) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const byCountry = useMemo(
    () => Object.entries(stats?.configs_by_country ?? {}).sort((a, b) => b[1] - a[1]),
    [stats],
  );

  if (!stats) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
          {loadError ? (
            <EmptyState
              tone="danger"
              icon={<CloudOff className="size-5" aria-hidden="true" />}
              title={t('control.error')}
              action={onRetry && <Button size="sm" icon={<RotateCw className="size-4" aria-hidden="true" />} onClick={onRetry}>{t('settings.retry')}</Button>}
            >
              {t('common.loadError')}
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
              {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[6.5rem] rounded-lg" />)}
            </div>
          )}
        </div>
      </div>
    );
  }

  const formatDuration = (totalSeconds: number) => {
    const diff = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  const formatUptime = (startSec: number) => {
    const diff = Math.max(0, Math.floor(now / 1000) - startSec);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;

    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || h > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);

    return parts.join(' ');
  };

  const formatNextUpdate = () => {
    if (pollingState?.paused) {
      return pollingState.forever
        ? t('statsView.paused')
        : `${t('statsView.paused')} · ${formatClock(pollingState.paused_until, now)}`;
    }
    if (!stats.last_update || !stats.update_interval) return t('statsView.calculating');
    const nextUpdateMs = (stats.last_update + stats.update_interval * 60) * 1000;
    const diff = Math.max(0, Math.floor((nextUpdateMs - now) / 1000));

    if (diff === 0) return t('statsView.soon');
    return formatDuration(diff);
  };

  const lastUpdateStr = stats.last_update
    ? new Date(stats.last_update * 1000).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : t('statsView.never');

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-fg">{t('control.statistics')}</h1>
          <p className="mt-1 text-sm text-fg-2">{t('statsView.description')}</p>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Tile delay={0} className="lg:col-span-3" icon={<Layers className="size-4" />} label={t('statsView.configs')}>
            {stats.amount_configs.toLocaleString()}
          </Tile>
          <Tile delay={40} className="lg:col-span-3" icon={<Globe className="size-4" />} label={t('statsView.countries')}>
            {byCountry.length}
          </Tile>
          <Tile delay={80} className="lg:col-span-2" icon={<Timer className="size-4" />} label={t('statsView.uptime')}>
            {formatUptime(stats.up_at)}
          </Tile>
          <Tile delay={120} className="lg:col-span-2" icon={<RefreshCw className="size-4" />} label={t('statsView.lastUpdate')}>
            {lastUpdateStr}
          </Tile>
          <Tile delay={160} className="sm:col-span-2 lg:col-span-2" icon={<CalendarClock className="size-4" />} label={t('statsView.nextUpdate')}>
            <span className={pollingState?.paused ? 'text-warn-text' : undefined}>{formatNextUpdate()}</span>
          </Tile>
        </div>

        <CountryChart byCountry={byCountry} />
      </div>
    </div>
  );
}
