import { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import type { Statistics } from '../api';

interface StatisticsViewProps {
  stats: Statistics | null;
}

export default function StatisticsView({ stats }: StatisticsViewProps) {
  const { t } = useTranslation();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!stats) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[var(--color-bg-primary)] p-6">
        <div className="w-10 h-10 border-3 border-[var(--color-border)] border-t-accent rounded-full animate-spin"></div>
      </div>
    );
  }

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
    if (!stats.last_update || !stats.update_interval) return t('statsView.calculating');
    const nextUpdateMs = (stats.last_update + stats.update_interval * 60) * 1000;
    const diff = Math.max(0, Math.floor((nextUpdateMs - now) / 1000));
    
    if (diff === 0) return t('statsView.soon');
    
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  const lastUpdateStr = stats.last_update 
    ? new Date(stats.last_update * 1000).toLocaleString() 
    : t('statsView.never');

  const numCountries = stats.configs_by_country ? Object.keys(stats.configs_by_country).length : 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--color-bg-primary)] p-6 md:p-10 relative overflow-y-auto custom-scrollbar">
      <div className="w-full max-w-4xl mx-auto flex flex-col animate-[fade-in_0.3s_ease-out]">
        
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight mb-2">
            {t('control.statistics')}
          </h2>
          <p className="text-[var(--color-text-secondary)]">
            {t('statsView.description')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
          
          <div className="bg-[var(--color-bg-input)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col gap-2">
            <div className="text-sm font-medium text-[var(--color-text-secondary)] flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {t('statsView.uptime')}
            </div>
            <div className="text-2xl font-semibold text-[var(--color-text-primary)]">
              {formatUptime(stats.up_at)}
            </div>
          </div>
          
          <div className="bg-[var(--color-bg-input)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col gap-2">
            <div className="text-sm font-medium text-[var(--color-text-secondary)] flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {t('statsView.countries')}
            </div>
            <div className="text-2xl font-semibold text-[var(--color-text-primary)]">
              {numCountries}
            </div>
          </div>
          
          <div className="bg-[var(--color-bg-input)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col gap-2">
            <div className="text-sm font-medium text-[var(--color-text-secondary)] flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M21.5 2v6h-6M2.13 15.57a10 10 0 1 0 1.9-9.15l2.45 2.45"/></svg>
              {t('statsView.lastUpdate')}
            </div>
            <div className="text-lg font-semibold text-[var(--color-text-primary)]">
              {lastUpdateStr}
            </div>
          </div>
          
          <div className="bg-[var(--color-bg-input)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col gap-2">
            <div className="text-sm font-medium text-[var(--color-text-secondary)] flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {t('statsView.nextUpdate')}
            </div>
            <div className="text-lg font-semibold text-[var(--color-text-primary)]">
              {formatNextUpdate()}
            </div>
          </div>

        </div>
        
      </div>
    </div>
  );
}
