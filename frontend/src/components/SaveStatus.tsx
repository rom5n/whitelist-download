import type { ReactNode } from 'react';
import { Check, CircleAlert, Power } from 'lucide-react';
import { useTranslation } from '../i18n';
import type { SaveStatus as AutoSaveStatus } from '../useAutoSaveConfig';
import Spinner from '../ui/Spinner';

type SlotState = AutoSaveStatus | 'restart';

interface SaveStatusProps {
  status: AutoSaveStatus;
  restartRequired: boolean;
  errorMessage: string;
  onRetry: () => void;
}

/**
 * The settings status in one fixed slot: saved, saving, invalid, error or "restart required".
 * All states are stacked in the same grid cell, so the slot is as wide as the longest one and nothing
 * around it moves when the state changes; the states cross-fade.
 */
export default function SaveStatus({ status, restartRequired, errorMessage, onRetry }: SaveStatusProps) {
  const { t } = useTranslation();
  // Problems with the save come first; once everything is saved, a pending restart is what matters
  const current: SlotState = status === 'saved' && restartRequired ? 'restart' : status;

  const states: Record<SlotState, { text: string; content: ReactNode }> = {
    saved: {
      text: t('settings.autosaveSaved'),
      content: (
        <span className="flex items-center gap-2 text-fg-3">
          <Check className="size-4 text-success-text" aria-hidden="true" />
          {t('settings.autosaveSaved')}
        </span>
      ),
    },
    saving: {
      text: t('settings.saving'),
      content: (
        <span className="flex items-center gap-2 text-fg-3">
          <Spinner className="size-3.5" />
          {t('settings.saving')}
        </span>
      ),
    },
    restart: {
      text: t('settings.restartRequired'),
      content: (
        <span className="flex h-8 items-center gap-2 rounded-full bg-warn-soft px-3 font-medium text-warn-text shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--warn)_30%,transparent)]">
          <Power className="size-4" aria-hidden="true" />
          {t('settings.restartRequired')}
        </span>
      ),
    },
    invalid: {
      text: t('settings.autosaveInvalid'),
      content: (
        <span className="flex items-center gap-2 font-medium text-danger-text">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {t('settings.autosaveInvalid')}
        </span>
      ),
    },
    error: {
      text: `${t('settings.autosaveError')}${errorMessage ? `: ${errorMessage}` : ''}`,
      content: (
        <span className="flex items-center gap-1">
          <span className="flex items-center gap-2 font-medium text-danger-text" title={errorMessage}>
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {t('settings.autosaveError')}
          </span>
          <button
            type="button"
            onClick={onRetry}
            className="press relative h-8 rounded-sm px-2 font-medium text-danger-text underline-offset-4 hover:underline cursor-pointer before:absolute before:-inset-y-1.5 before:inset-x-0"
          >
            {t('settings.retry')}
          </button>
        </span>
      ),
    },
  };

  return (
    <div className="text-sm">
      <div className="grid min-h-9 items-center">
        {(Object.keys(states) as SlotState[]).map(state => (
          <div
            key={state}
            // Only the retry button of the error state needs to be reachable; the text is announced below
            aria-hidden={state !== current || state !== 'error'}
            inert={state !== current}
            className={`col-start-1 row-start-1 flex items-center sm:whitespace-nowrap transition-[opacity,visibility] duration-200 ease-out
                        ${state === current ? 'visible opacity-100' : 'invisible opacity-0'}`}
          >
            {states[state].content}
          </div>
        ))}
      </div>
      {/* The visible layers are decorative; this is what screen readers hear */}
      <span role="status" className="sr-only">{states[current].text}</span>
    </div>
  );
}
