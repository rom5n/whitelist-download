import { useId, useState } from 'react';
import { useTranslation } from '../i18n';
import { MAX_UPDATE_INTERVAL } from '../validateConfig';
import { inputClass } from '../ui/styles';

/** Quick values, in minutes */
const PRESETS = [5, 15, 30, 60, 180, 360, 720, 1440];

/** Returns the i18n key of the problem with a typed interval, or null if it is fine */
function intervalError(text: string): string | null {
  const value = text.trim();
  if (value === '') return 'settings.errIntervalEmpty';
  if (!/^\d+$/.test(value)) return 'settings.errIntervalDigits';
  const minutes = Number(value);
  if (minutes < 1) return 'settings.errIntervalMin';
  if (minutes > MAX_UPDATE_INTERVAL) return 'settings.errIntervalMax';
  return null;
}

interface IntervalFieldProps {
  /** Minutes, as saved in the settings */
  value: number;
  /** Receives the typed minutes (NaN when they are not a number, so the value is never saved); presets apply at once */
  onChange: (minutes: number, immediate: boolean) => void;
}

/** The update interval: a plain number field (no spinner buttons) with quick values next to it. */
export default function IntervalField({ value, onChange }: IntervalFieldProps) {
  const { t } = useTranslation();
  const id = useId();
  const [text, setText] = useState(() => (value > 0 ? String(value) : ''));
  const error = intervalError(text);

  const format = (minutes: number) =>
    minutes < 60 ? `${minutes} ${t('unit.minutes')}` : `${minutes / 60} ${t('unit.hours')}`;

  const type = (next: string) => {
    setText(next);
    onChange(/^\d+$/.test(next.trim()) ? Number(next.trim()) : NaN, false);
  };

  const choose = (minutes: number) => {
    setText(String(minutes));
    onChange(minutes, true);
  };

  const current = error ? null : Number(text.trim());

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-fg-2">
        {t('settings.interval')}
      </label>
      <div className="relative max-w-44">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          onChange={event => type(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-note`}
          className={`${inputClass(error ? 'error' : 'default')} pr-14 tabular-nums`}
        />
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-fg-3">
          {t('settings.intervalUnit')}
        </span>
      </div>
      <p
        id={`${id}-note`}
        key={error ?? 'hint'}
        role={error ? 'alert' : undefined}
        className={`mt-1.5 animate-fade text-xs ${error ? 'text-danger-text' : 'text-fg-3'}`}
      >
        {error ? t(error) : t('settings.intervalHint')}
      </p>

      <div role="group" aria-label={t('settings.intervalPresets')} className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map(minutes => (
          <button
            key={minutes}
            type="button"
            onClick={() => choose(minutes)}
            aria-pressed={current === minutes}
            className={`press relative flex h-9 min-w-11 items-center justify-center rounded-sm border px-3 text-sm font-medium tabular-nums whitespace-nowrap cursor-pointer
                        before:absolute before:-inset-y-1 before:inset-x-0
                        ${current === minutes
                          ? 'border-accent/40 bg-accent-soft text-accent-text'
                          : 'border-line bg-surface text-fg-2 hover:border-line-strong hover:text-fg'}`}
          >
            {format(minutes)}
          </button>
        ))}
      </div>
    </div>
  );
}
