import { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Pause, Play } from 'lucide-react';
import { useTranslation } from '../i18n';
import { pauseUpdates, resumeUpdates, type PollingState } from '../api';
import { formatClock, formatRemaining } from '../formatTime';
import { popVariants, spring } from '../motion/presets';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';

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

/** Shows whether the configs auto-update is running and lets the user pause it for a while or forever. */
export default function AutoUpdateControl({ state, onStateChange }: AutoUpdateControlProps) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const paused = state?.paused ?? false;
  const forever = state?.forever ?? false;
  const pausedUntil = state?.paused_until ?? 0;

  useEffect(() => {
    if (!paused || forever) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [paused, forever]);

  const apply = async (key: string, request: () => Promise<PollingState>) => {
    setBusy(key);
    setFailed(false);
    try {
      onStateChange(await request());
    } catch (err) {
      console.error(err);
      setFailed(true);
    } finally {
      setBusy(null);
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
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-md transition-colors duration-300
                        ${paused ? 'bg-warn-soft text-warn-text' : 'bg-success-soft text-success-text'}`}
            aria-hidden="true"
          >
            {paused
              ? <Pause key="paused" className="size-4 animate-pop" fill="currentColor" />
              : <span key="active" className="relative flex size-2.5 animate-pop">
                  <span className="absolute inset-0 rounded-full bg-success [animation:ring-out_2s_var(--ease-out)_infinite]" />
                  <span className="relative size-2.5 rounded-full bg-success" />
                </span>}
          </span>
          <div className="min-w-0" aria-live="polite">
            <p className="text-sm font-semibold text-fg">{paused ? t('pause.paused') : t('pause.active')}</p>
            <p className="text-xs tabular-nums text-fg-2">{describe()}</p>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {paused && (
            <m.div key="resume" variants={popVariants} initial="hidden" animate="visible" exit="hidden" transition={spring.snappy}>
              <Button
                variant="primary"
                size="sm"
                loading={busy === 'resume'}
                onClick={() => apply('resume', resumeUpdates)}
                icon={<Play className="size-4" fill="currentColor" aria-hidden="true" />}
              >
                {t('pause.resume')}
              </Button>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label={t('pause.pauseFor')}>
        <span className="mr-1 text-sm text-fg-2">{t('pause.pauseFor')}</span>
        {PAUSE_OPTIONS.map(option => {
          const key = String(option.value);
          const active = option.value === 'forever' && forever;
          return (
            <button
              key={key}
              type="button"
              onClick={() => apply(key, () => pauseUpdates(option.value))}
              disabled={busy !== null}
              aria-pressed={option.value === 'forever' ? active : undefined}
              className={`press relative flex h-9 items-center gap-1.5 rounded-sm border px-3 text-sm font-medium cursor-pointer
                          before:absolute before:-inset-y-1 before:inset-x-0 disabled:cursor-not-allowed disabled:opacity-60
                          ${active
                            ? 'border-warn/50 bg-warn-soft text-warn-text'
                            : 'border-line bg-surface text-fg-2 hover:border-warn/50 hover:text-warn-text'}`}
            >
              {busy === key && <Spinner className="size-3.5" />}
              {t(option.labelKey)}
            </button>
          );
        })}
      </div>

      <p className={`mt-3 text-xs ${failed ? 'text-danger-text' : 'text-fg-3'}`} role={failed ? 'alert' : undefined}>
        {failed ? t('pause.error') : t('pause.note')}
      </p>
    </div>
  );
}
