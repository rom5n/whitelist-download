import { useState } from 'react';
import { useTranslation } from '../i18n';
import { updateConfigs, restartServer } from '../api';

interface Props {
  onOpenSettings: () => void;
  onOpenLogs: () => void;
}

/**
 * Control panel card with action buttons:
 * - Update configs (force re-fetch from sources)
 * - Restart server
 * - Open settings modal (gear icon)
 */
export default function ControlPanel({ onOpenSettings, onOpenLogs }: Props) {
  const { t } = useTranslation();
  const [updateText, setUpdateText] = useState('');
  const [restartText, setRestartText] = useState('');

  /** Triggers a force update of all VPN configs */
  const handleUpdate = async () => {
    setUpdateText(t('control.updating'));
    const ok = await updateConfigs();
    setUpdateText(ok ? t('control.success') : t('control.error'));
    setTimeout(() => setUpdateText(''), 2000);
  };

  /** Triggers server restart; reloads page after delay */
  const handleRestart = async () => {
    setRestartText(t('control.restarting'));
    await restartServer();
    setTimeout(() => { setRestartText(t('control.done')); window.location.reload(); }, 2000);
  };

  return (
    <div className="glass-card rounded-2xl p-6 pt-3 animate-slide-up">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] m-0">
          {t('control.title')}
        </h2>
        <div className="flex items-center gap-1">
          {/* Logs button */}
          <button
            id="logs-btn"
            onClick={onOpenLogs}
            title={t('control.logs')}
            className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer
                       text-[var(--color-text-secondary)] transition-all duration-200
                       hover:text-accent hover:bg-[var(--color-bg-input)]"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
              <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
            </svg>
          </button>
          {/* Settings gear button */}
          <button
            id="settings-btn"
            onClick={onOpenSettings}
            title={t('control.settings')}
            className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer
                       text-[var(--color-text-secondary)] transition-all duration-200
                       hover:text-accent hover:bg-[var(--color-bg-input)]"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
              <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.73,8.87C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.06,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.43-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.49-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-3">
        {/* Update configs button */}
        <button
          id="update-configs-btn"
          onClick={handleUpdate}
          className={`py-3 rounded-xl text-sm font-semibold cursor-pointer border-none text-white transition-all duration-200 hover:-translate-y-0.5
    ${updateText === t('control.updating')
            ? 'bg-orange-400/95'
              : updateText === t('control.success')
                ? 'bg-success'
                : updateText === t('control.error')
                  ? 'bg-danger'
                  : 'bg-accent'
            }
  `}
        >
          {updateText || t('control.updateConfigs')}
        </button>

        {/* Restart button */}
        <button
          id="restart-btn"
          onClick={handleRestart}
          className="py-3 rounded-xl text-sm font-semibold cursor-pointer
                     bg-danger/10 text-red-400 border border-danger/30
                     transition-all duration-200 hover:bg-danger hover:text-white hover:-translate-y-0.5"
        >
          {restartText || t('control.restart')}
        </button>
      </div>
    </div>
  );
}
