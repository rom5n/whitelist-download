import { useState, useMemo } from 'react';
import { useTranslation } from '../i18n';
import { updateConfigs, restartServer, setCheckLevel, type AppConfig, type CheckLevel, type PollingState } from '../api';
import { useAutoSaveConfig } from '../useAutoSaveConfig';
import { isValidSource } from '../validateConfig';
import AutoUpdateControl from './AutoUpdateControl';

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mt-8 mb-4 first:mt-0 flex items-center gap-2">
      <span className="h-px flex-1 bg-[var(--color-border)]" />
      <span>{label}</span>
      <span className="h-px flex-1 bg-[var(--color-border)]" />
    </div>
  );
}

interface SettingsViewProps {
  version: string | undefined;
  pollingState: PollingState | null;
  onPollingStateChange: (state: PollingState) => void;
}

export default function SettingsView({ version, pollingState, onPollingStateChange }: SettingsViewProps) {
  const { t } = useTranslation();
  const { config, errors, status, errorMessage, restart, update, retry } = useAutoSaveConfig(pollingState?.working_check_level);
  const [newSource, setNewSource] = useState('');

  const [updateActionText, setUpdateActionText] = useState('');
  const [restartActionText, setRestartActionText] = useState('');
  const [levelFailed, setLevelFailed] = useState(false);

  const isNewSourceValid = useMemo(() => {
    if (!newSource || !config) return false;
    return !(config.sources || []).includes(newSource) && isValidSource(newSource);
  }, [newSource, config]);

  if (!config) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--color-bg-primary)] p-6">
        <div className="text-[var(--color-text-muted)] animate-pulse">{t('settings.loading')}</div>
      </div>
    );
  }

  // The backend is the source of truth: the level can also be changed from the tray
  const workingLevel = pollingState?.working_check_level ?? config.working_check_level;

  const needsRestart = (field: keyof AppConfig) => restart.fields.includes(field);

  const inputCls = (field: keyof AppConfig) =>
    `w-full px-4 py-3 rounded-xl text-sm bg-[var(--color-bg-input)] text-[var(--color-text-primary)] outline-none transition-all duration-200 border ${errors[field]
      ? 'border-danger/60 bg-danger/5 focus:border-danger'
      : needsRestart(field)
        ? 'border-warn bg-warn/5'
        : 'border-[var(--color-border)] focus:border-accent focus:ring-2 focus:ring-accent/20'
    }`;

  const handleLevelChange = async (level: CheckLevel) => {
    if (level === workingLevel) return;
    setLevelFailed(false);
    try {
      onPollingStateChange(await setCheckLevel(level));
    } catch (err) {
      console.error(err);
      setLevelFailed(true);
    }
  };

  const handleUpdateConfigs = async () => {
    setUpdateActionText(t('control.updating'));
    const ok = await updateConfigs();
    setUpdateActionText(ok ? t('control.success') : t('control.error'));
    setTimeout(() => setUpdateActionText(''), 2000);
  };

  const handleRestart = async () => {
    setRestartActionText(t('control.restarting'));
    await restartServer();
    // It closes connection so it might throw, we just let it be.
    setTimeout(() => setRestartActionText(t('control.done')), 2000);
  };

  const addSource = () => {
    if (isNewSourceValid) {
      update('sources', [...(config.sources || []), newSource], true);
      setNewSource('');
    }
  };

  const removeSource = (i: number) => {
    update('sources', (config.sources || []).filter((_, idx) => idx !== i), true);
  };

  /** The message under a field: what is wrong with it, or that changing it needs a restart */
  const fieldNote = (field: keyof AppConfig) => {
    if (errors[field]) {
      return <span className="text-[11px] text-danger mt-1.5 block font-medium">{t(errors[field])}</span>;
    }
    if (needsRestart(field)) {
      return <span className="text-[11px] text-warn mt-1.5 block font-medium">{t('settings.restartRequired')}</span>;
    }
    return null;
  };

  const labelCls = 'block text-sm font-medium text-[var(--color-text-secondary)] mb-2';

  return (
    <div className="flex-1 min-h-0 relative bg-[var(--color-bg-primary)]">
      <div className="absolute inset-0 overflow-y-auto p-6 md:p-10">
        <div className="w-full space-y-8 animate-[fade-in_0.3s_ease-out]">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex flex-wrap items-center gap-3 min-h-10">
              <div className="flex items-center gap-2 text-sm" role="status">
                {status === 'saving' && (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-[var(--color-border)] border-t-accent rounded-full animate-spin" />
                    <span className="text-[var(--color-text-muted)]">{t('settings.saving')}</span>
                  </>
                )}
                {status === 'saved' && (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-success">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[var(--color-text-muted)]">{t('settings.autosaveSaved')}</span>
                  </>
                )}
                {status === 'invalid' && (
                  <span className="text-danger font-medium">{t('settings.autosaveInvalid')}</span>
                )}
                {status === 'error' && (
                  <>
                    <span className="text-danger font-medium" title={errorMessage}>{t('settings.autosaveError')}</span>
                    <button
                      onClick={retry}
                      className="px-3 py-1 rounded-lg text-xs font-bold cursor-pointer border-none bg-danger text-white hover:bg-danger-hover transition-colors"
                    >
                      {t('settings.retry')}
                    </button>
                  </>
                )}
              </div>

              {restart.required && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold text-warn bg-warn/10 border border-warn/25 animate-[fade-in_0.4s_ease-out]">
                  {t('settings.restartRequired')}
                </span>
              )}
            </div>

            <div className="flex gap-3 shrink-0">
              <button
                onClick={handleUpdateConfigs}
                className="px-5 py-2.5 rounded-xl text-sm font-medium border border-[var(--color-border)] hover:border-accent hover:text-accent bg-[var(--color-bg-card)] cursor-pointer transition-colors"
              >
                {updateActionText || t('settings.updateConfigs')}
              </button>
              <button
                onClick={handleRestart}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium border cursor-pointer transition-colors ${restart.required
                  ? 'animate-restart-blink text-warn'
                  : 'border-[var(--color-border)] hover:border-warn hover:text-warn bg-[var(--color-bg-card)]'}`}
              >
                {restartActionText || t('settings.restartServer')}
              </button>
            </div>
          </div>

          <div className="w-full">
            {/* === General === */}
            <SectionDivider label={t('settings.general')} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              <div>
                <label className={labelCls}>{t('settings.appName')}</label>
                <input type="text" className={inputCls('app_name')} value={config.app_name}
                  onChange={e => update('app_name', e.target.value)} />
                {fieldNote('app_name')}
              </div>
              <div>
                <label className={labelCls}>{t('settings.subTitle')}</label>
                <input type="text" className={inputCls('subscription_title')} value={config.subscription_title}
                  onChange={e => update('subscription_title', e.target.value)} />
                {fieldNote('subscription_title')}
              </div>
            </div>

            <div className="mb-5">
              <label className={labelCls}>{t('settings.description')}</label>
              <input type="text" className={inputCls('description_text')} value={config.description_text}
                onChange={e => update('description_text', e.target.value)} />
              {fieldNote('description_text')}
            </div>

            <div className="mb-5">
              <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                {t('settings.workingLevel')}
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] px-2 py-0.5 rounded-md border border-[var(--color-border)]">
                  {t('settings.appliedInstantly')}
                </span>
              </label>
              <div className="flex items-center gap-4">
                <div className="relative grid grid-cols-2 p-1 bg-[var(--color-bg-input)] rounded-xl w-max border border-[var(--color-border)] shrink-0">
                  <div
                    className={`absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] bg-[var(--color-bg-card)] rounded-lg shadow-sm transition-transform duration-300 ease-in-out border border-[var(--color-border)] ${workingLevel === 2 ? 'translate-x-full' : 'translate-x-0'}`}
                  />
                  <button
                    onClick={() => handleLevelChange(1)}
                    className={`relative z-10 px-6 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                      workingLevel === 1
                        ? 'text-accent'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    {t('settings.levelNormal')}
                  </button>
                  <button
                    onClick={() => handleLevelChange(2)}
                    className={`relative z-10 px-6 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                      workingLevel === 2
                        ? 'text-warn'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    {t('settings.levelUltra')}
                  </button>
                </div>
                <p className={`text-xs leading-relaxed max-w-xl ${levelFailed ? 'text-danger' : 'text-[var(--color-text-muted)]'}`}>
                  {levelFailed ? t('settings.saveError') : workingLevel === 1 ? t('settings.levelNormalDesc') : t('settings.levelUltraDesc')}
                </p>
              </div>
            </div>

            {/* === Updates === */}
            <SectionDivider label={t('settings.updates')} />

            <div className="flex flex-col gap-4 mb-8">
              <label className="flex items-center gap-3 cursor-pointer w-max">
                <input
                  type="checkbox"
                  checked={config.auto_update_major}
                  onChange={e => update('auto_update_major', e.target.checked, true)}
                  className="w-5 h-5 rounded border-[var(--color-border)] accent-accent cursor-pointer"
                />
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">{t('settings.autoUpdateMajor')}</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer w-max">
                <input
                  type="checkbox"
                  checked={config.auto_update_patch}
                  onChange={e => update('auto_update_patch', e.target.checked, true)}
                  className="w-5 h-5 rounded border-[var(--color-border)] accent-accent cursor-pointer"
                />
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">{t('settings.autoUpdatePatch')}</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer w-max">
                <input
                  type="checkbox"
                  checked={config.auto_browser_open}
                  onChange={e => update('auto_browser_open', e.target.checked, true)}
                  className="w-5 h-5 rounded border-[var(--color-border)] accent-accent cursor-pointer"
                />
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">{t('settings.autoBrowserOpen')}</span>
              </label>
            </div>

            {/* === Network === */}
            <SectionDivider label={t('settings.network')} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              <div>
                <label className={labelCls}>{t('settings.port')}</label>
                <input type="text" inputMode="numeric" className={inputCls('port')} value={config.port}
                  onChange={e => update('port', e.target.value)} />
                {fieldNote('port')}
              </div>
              <div>
                <label className={labelCls}>{t('settings.forcedIp')}</label>
                <input type="text" className={inputCls('forced_ip')} value={config.forced_ip}
                  onChange={e => update('forced_ip', e.target.value)} />
                {fieldNote('forced_ip')}
              </div>
            </div>

            <div className="mb-5">
              <label className={labelCls}>{t('settings.subPath')}</label>
              <input type="text" className={inputCls('subscription_path')} value={config.subscription_path}
                onChange={e => update('subscription_path', e.target.value)} />
              {fieldNote('subscription_path')}
            </div>

            {/* === Files === */}
            <SectionDivider label={t('settings.files')} />

            <div className="mb-5">
              <label className={labelCls}>{t('settings.configsPath')}</label>
              <input type="text" className={inputCls('configs_path')} value={config.configs_path}
                onChange={e => update('configs_path', e.target.value)} />
              {fieldNote('configs_path')}
            </div>

            {/* === Timing === */}
            <SectionDivider label={t('settings.timing')} />

            <div className="mb-5">
              <label className={labelCls}>{t('settings.autoRefresh')}</label>
              <AutoUpdateControl state={pollingState} onStateChange={onPollingStateChange} />
            </div>

            <div className="mb-5">
              <label className={labelCls}>{t('settings.interval')}</label>
              <input type="number" min={1} className={inputCls('update_interval_minutes')}
                value={config.update_interval_minutes || ''}
                onChange={e => update('update_interval_minutes', e.target.value === '' ? 0 : Number(e.target.value))} />
              {fieldNote('update_interval_minutes')}
            </div>

            {/* === Sources === */}
            <SectionDivider label={t('settings.sources')} />

            <div className="flex gap-3 mb-4">
              <input
                placeholder={t('settings.sourcePlaceholder')}
                value={newSource}
                onChange={e => setNewSource(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSource()}
                className={`flex-1 px-4 py-3 rounded-xl text-sm bg-[var(--color-bg-input)] text-[var(--color-text-primary)] outline-none transition-all cursor-text border ${
                  !isNewSourceValid && newSource
                    ? 'border-red-500/50 focus:border-red-500/80 bg-red-500/5'
                    : 'border-[var(--color-border)] focus:border-accent focus:ring-2 focus:ring-accent/20'
                }`}
              />
              <button
                onClick={addSource}
                disabled={!isNewSourceValid}
                className={`px-6 py-3 rounded-xl text-sm font-medium border-none transition-colors shadow-md ${
                  isNewSourceValid
                    ? 'bg-accent text-white hover:bg-accent-hover cursor-pointer'
                    : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)] cursor-not-allowed opacity-60'
                }`}
              >
                {t('settings.addSource')}
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto flex flex-col gap-2 rounded-xl">
              {(config.sources || []).map((s, i) => (
                <div key={s} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl
                                        bg-[var(--color-bg-input)] border border-[var(--color-border)]">
                  <span className="text-sm text-[var(--color-text-primary)] overflow-hidden text-ellipsis whitespace-nowrap flex-1 font-mono">
                    {s}
                  </span>
                  <button
                    onClick={() => removeSource(i)}
                    className="bg-transparent border-none text-red-400 font-medium text-sm cursor-pointer
                               hover:text-red-300 transition-colors shrink-0"
                  >
                    {t('settings.removeSource')}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {version && (
            <div className="text-center mt-6">
              <a
                href={`https://github.com/rom5n/whitelist-download/releases/tag/v${version}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--color-text-muted)] opacity-60 hover:opacity-100 hover:underline transition-opacity"
                title="Open release in GitHub"
              >
                v{version}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* A soft orange vignette along the edges of the window while a restart is required */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 rounded-3xl transition-opacity duration-700 ease-in-out
                    shadow-[inset_0_0_70px_0_color-mix(in_srgb,var(--color-warn)_20%,transparent)]
                    ${restart.required ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
