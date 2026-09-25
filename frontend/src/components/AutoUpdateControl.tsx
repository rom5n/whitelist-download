import { useEffect, useState } from 'react';
import { useTranslation } from '../i18n';
import { pauseUpdates, resumeUpdates, type PollingState } from '../api';
import { formatClock, formatRemaining } from '../formatTime';

interface PauseOption {
  labelKey: string;
  value: number | 'forever';
}

const PAUSE_OPTIONS: PauseOption[] = [
  { labelKey: 'pause.m15', value: 15 },
  { labelKey: 'pause.h1', value: 60 },
  { labelKey: 'pause.h4', value: 240 },
  { labelKey: 'pause.h24', value: 1440 },
  { labelKey: 'pause.forever', value: 'forever' },
];

interface AutoUpdateControlProps {
  state: PollingState | null;
  onStateChange: (state: PollingState) => void;
}

/** Shows whether the configs auto-update is running and lets the user pause it for a while or until resumed. */
export default function AutoUpdateControl({ state, onStateChange }: AutoUpdateControlProps) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const paused = state?.paused ?? false;
  const forever = state?.forever ?? false;
  const pausedUntil = state?.paused_until ?? 0;

  useEffect(() => {
    if (!paused || forever) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [paused, forever]);

  const apply = async (request: () => Promise<PollingState>) => {
    setBusy(true);
    setFailed(false);
    try {
      onStateChange(await request());
    } catch (err) {
      console.error(err);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const describe = () => {
    if (!paused) return t('pause.activeDesc');
    if (forever) return t('pause.foreverDesc');

    const remaining = pausedUntil - now / 1000;
    if (remaining <= 0) return t('pause.resuming');
    return `${t('pause.resumesAt')} ${formatClock(pausedUntil, now)} · ${formatRemaining(remaining)}`;
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-input)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="relative flex h-3 w-3 shrink-0">
            {!paused && <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />}
            <span className={`relative inline-flex h-3 w-3 rounded-full ${paused ? 'bg-warn' : 'bg-success'}`} />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">
              {paused ? t('pause.paused') : t('pause.active')}
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{describe()}</div>
          </div>
        </div>

        {paused && (
          <button
            onClick={() => apply(resumeUpdates)}
            disabled={busy}
            className="px-5 py-2 rounded-xl text-sm font-bold border-none bg-accent text-white hover:bg-accent-hover
                       shadow-md cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {t('pause.resume')}
          </button>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-[var(--color-text-secondary)] mr-1">{t('pause.pauseFor')}</span>
        {PAUSE_OPTIONS.map(option => {
          const active = option.value === 'forever' && forever;
          return (
            <button
              key={option.labelKey}
              onClick={() => apply(() => pauseUpdates(option.value))}
              disabled={busy}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border cursor-pointer transition-colors
                          disabled:opacity-60 disabled:cursor-not-allowed ${active
                  ? 'border-warn bg-warn/10 text-warn'
                  : 'border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:border-warn hover:text-warn'}`}
            >
              {t(option.labelKey)}
            </button>
          );
        })}
      </div>

      <p className={`text-xs mt-3 ${failed ? 'text-danger' : 'text-[var(--color-text-muted)]'}`}>
        {failed ? t('pause.error') : t('pause.note')}
      </p>
    </div>
  );
}
