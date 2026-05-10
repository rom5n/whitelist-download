import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../i18n';
import { fetchStatistics, type Statistics } from '../api';
import { getFlagEmoji } from '../countryFlags';

/**
 * Statistics card displaying live server metrics:
 * config count, uptime, last update with countdown, country distribution.
 */
export default function StatisticsCard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Statistics | null>(null);
  const [countdown, setCountdown] = useState('');

  const loadStats = useCallback(() => {
    fetchStatistics().then(setStats).catch(console.error);
  }, []);

  useEffect(() => {
    loadStats();
    const iv = setInterval(loadStats, 5000);
    return () => clearInterval(iv);
  }, [loadStats]);

  useEffect(() => {
    if (!stats?.last_update) return;
    const timer = setInterval(() => {
      const left = (stats.last_update * 1000 + 3600000) - Date.now();
      if (left <= 0) { setCountdown(t('stats.updating')); loadStats(); }
      else {
        const m = Math.floor((left / 60000) % 60);
        const s = Math.floor((left / 1000) % 60);
        setCountdown(`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [stats?.last_update, loadStats, t]);

  /** Format uptime from unix timestamp */
  const fmt = (upAt: number) => {
    const d = Math.floor(Date.now()/1000) - upAt;
    const days = Math.floor(d/86400), hrs = Math.floor((d%86400)/3600), mins = Math.floor((d%3600)/60);
    if (days > 0) return `${days}${t('time.days')} ${hrs}${t('time.hours')}`;
    if (hrs > 0) return `${hrs}${t('time.hours')} ${mins}${t('time.minutes')}`;
    return `${mins}${t('time.minutes')}`;
  };

  const cc = stats?.configs_by_country ? Object.keys(stats.configs_by_country).length : 0;

  const metricBox = "bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-xl p-4 text-center transition-colors duration-200";
  const metricVal = "text-2xl font-bold text-[var(--color-text-primary)]";
  const metricLbl = "text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mt-1";

  return (
    <div className="glass-card rounded-2xl p-6 animate-slide-up">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-5">
        {t('stats.title')}
      </h2>
      {stats ? (<>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className={metricBox}><div className={metricVal}>{stats.amount_configs}</div><div className={metricLbl}>{t('stats.configs')}</div></div>
          <div className={metricBox}><div className={metricVal}>{fmt(stats.up_at)}</div><div className={metricLbl}>{t('stats.uptime')}</div></div>
          <div className={metricBox}>
            <div className="text-lg font-bold text-[var(--color-text-primary)]">
              {new Date(stats.last_update*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
              <span className="text-xs font-normal text-[var(--color-text-muted)] ml-1.5">({countdown})</span>
            </div>
            <div className={metricLbl}>{t('stats.lastUpdate')}</div>
          </div>
          <div className={metricBox}><div className={metricVal}>{cc}</div><div className={metricLbl}>{t('stats.countries')}</div></div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-3">{t('stats.byRegion')}</div>
          <div className="max-h-48 overflow-y-auto pr-3">
            {Object.entries(stats.configs_by_country).sort(([,a],[,b])=>b-a).map(([c,n])=>(
              <div key={c} className="flex justify-between items-center py-2.5 border-b border-[var(--color-border)] last:border-b-0 text-sm">
                <span className="text-[var(--color-text-primary)]">{getFlagEmoji(c)} {c}</span>
                <span className="text-white-400 font-semibold tabular-nums">{n}</span>
              </div>
            ))}
          </div>
        </div>
      </>) : (
        <div className="text-center py-8 text-[var(--color-text-muted)] text-sm animate-pulse-glow">{t('stats.loading')}</div>
      )}
    </div>
  );
}
