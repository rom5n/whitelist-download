import type { ReactNode } from 'react';
import { useTranslation } from '../i18n';
import type { SaveStatus } from '../hooks/useSettings';
import Spinner from './Spinner';

interface SaveStatusSlotProps {
  status: SaveStatus;
  onRetry: () => void;
}

const icons: Record<SaveStatus, ReactNode> = {
  saved: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-4 h-4 shrink-0" aria-hidden>
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  saving: <Spinner className="w-4 h-4" />,
  restart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-4 h-4 shrink-0" aria-hidden>
      <path d="M21 12a9 9 0 11-2.64-6.36M21 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-4 h-4 shrink-0" aria-hidden>
      <path d="M12 8v5m0 3h.01M10.3 3.9L2.4 17.5A2 2 0 004.1 20.5h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  invalid: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-4 h-4 shrink-0" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5m0 3h.01" strokeLinecap="round" />
    </svg>
  ),
};

const tones: Record<SaveStatus, string> = {
  saved: 'text-[var(--color-text-secondary)]',
  saving: 'text-[var(--color-text-secondary)]',
  restart: 'text-warn bg-warn/10 shadow-[0_0_16px_var(--color-restart-soft)]',
  error: 'text-danger bg-danger/10 hover:bg-danger/15 cursor-pointer',
  invalid: 'text-warn',
};

const labels: Record<SaveStatus, string> = {
  saved: 'status.saved',
  saving: 'status.saving',
  restart: 'status.restart',
  error: 'status.error',
  invalid: 'status.invalid',
};

const ORDER: SaveStatus[] = ['saved', 'saving', 'restart', 'error', 'invalid'];

/**
 * One fixed slot for every save state. All states are rendered in the same grid cell,
 * so the slot is as wide as the longest text in the current language and never shifts the header.
 * States crossfade via opacity.
 */
export default function SaveStatusSlot({ status, onRetry }: SaveStatusSlotProps) {
  const { t } = useTranslation();

  return (
    <div className="status-stack" role="status" aria-live="polite">
      {ORDER.map(state => {
        const active = state === status;
        const content = (
          <>
            {icons[state]}
            {/* Narrow screens have no room for the text: the icon stays, the text remains for screen readers */}
            <span className="whitespace-nowrap max-sm:sr-only">{t(labels[state])}</span>
          </>
        );
        // The layer reserves the slot width; the pill hugs its own text, so no empty colored area appears
        const pill = `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tones[state]}`;

        return (
          <div key={state} data-active={active} aria-hidden={!active} title={t(labels[state])} className="flex justify-end">
            {state === 'error' ? (
              <button type="button" tabIndex={active ? 0 : -1} onClick={onRetry} className={pill}>
                {content}
              </button>
            ) : (
              <div className={pill}>{content}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
