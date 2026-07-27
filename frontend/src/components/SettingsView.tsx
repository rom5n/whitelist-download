import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../i18n';
import { fetchConfig, saveConfig, updateConfigs, restartServer, type AppConfig } from '../api';

const RESTART_FIELDS: (keyof AppConfig)[] = [
  'port', 'logs_path', 'subscription_path', 'app_name',
];

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
}

export default function SettingsView({ version }: SettingsViewProps) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [original, setOriginal] = useState<AppConfig | null>(null);
  const [newSource, setNewSource] = useState('');
  const [saveText, setSaveText] = useState('');
  
  const [updateActionText, setUpdateActionText] = useState('');
  const [restartActionText, setRestartActionText] = useState('');

  useEffect(() => {
    fetchConfig().then(data => {
      setConfig(data);
      setOriginal(data);
    }).catch(console.error);
  }, []);

  const isNewSourceValid = useMemo(() => {
    if (!newSource || !config) return false;
    const sources = config.sources || [];
    if (sources.includes(newSource)) return false;
    try {
      new URL(newSource);
      return true;
    } catch {
      return false;
    }
  }, [newSource, config]);

  if (!config) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--color-bg-primary)] p-6">
        <div className="text-[var(--color-text-muted)] animate-pulse">{t('settings.loading')}</div>
      </div>
    );
  }

  const isModified = (field: keyof AppConfig) =>
    original && JSON.stringify(config[field]) !== JSON.stringify(original[field]);

  const needsRestart = (field: keyof AppConfig) =>
    isModified(field) && RESTART_FIELDS.includes(field);

  const inputCls = (field: keyof AppConfig) =>
    `w-full px-4 py-3 rounded-xl text-sm bg-[var(--color-bg-input)] text-[var(--color-text-primary)] outline-none transition-all duration-200 border ${needsRestart(field)
      ? 'border-warn bg-warn/5'
      : isModified(field)
        ? 'border-accent/50'
        : 'border-[var(--color-border)] focus:border-accent focus:ring-2 focus:ring-accent/20'
    }`;

  const updateField = (field: keyof AppConfig, value: string | number | boolean) => {
    setConfig({ ...config, [field]: value });
  };

  const handleSave = async () => {
    if (!config) return;
    setSaveText(t('settings.saving'));
    const ok = await saveConfig(config);
    setSaveText(ok ? t('settings.saved') : t('settings.saveError'));
    if (ok) setOriginal(config);
    setTimeout(() => setSaveText(''), 2000);
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
      setConfig({ ...config, sources: [...(config.sources || []), newSource] });
      setNewSource('');
    }
  };

  const removeSource = (i: number) => {
    const sources = config.sources || [];
    setConfig({ ...config, sources: sources.filter((_, idx) => idx !== i) });
  };

  const restartBadge = (field: keyof AppConfig) =>
    needsRestart(field)
      ? <span className="text-[11px] text-warn mt-1.5 block font-medium">{t('settings.restartRequired')}</span>
      : null;

  const hasUnsavedChanges = original && JSON.stringify(config) !== JSON.stringify(original);

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--color-bg-primary)] p-6 md:p-10 relative">
      <div className="w-full space-y-8 animate-[fade-in_0.3s_ease-out]">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          {hasUnsavedChanges ? (
            <div className="flex items-center gap-3 animate-[fade-in_0.2s_ease-out]">
              <div className="flex items-center gap-2 text-warn bg-warn/10 px-4 py-2 rounded-xl border border-warn/20 w-fit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm font-medium">{t('settings.unsavedChanges')}</span>
              </div>
              <button
                onClick={handleSave}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer border-none
                            transition-colors shadow-md
                            ${saveText === t('settings.saved')
                    ? 'bg-success text-white'
                    : saveText === t('settings.saveError')
                      ? 'bg-danger text-white'
                      : 'bg-accent text-white hover:bg-accent-hover hover:shadow-accent/30'}`}
              >
                {saveText || t('settings.save')}
              </button>
            </div>
          ) : <div />}
          <div className="flex gap-3 shrink-0">
            <button
              onClick={handleUpdateConfigs}
              className="px-5 py-2.5 rounded-xl text-sm font-medium border border-[var(--color-border)] hover:border-accent hover:text-accent bg-[var(--color-bg-card)] cursor-pointer transition-colors"
            >
              {updateActionText || t('settings.updateConfigs')}
            </button>
            <button
              onClick={handleRestart}
              className="px-5 py-2.5 rounded-xl text-sm font-medium border border-[var(--color-border)] hover:border-warn hover:text-warn bg-[var(--color-bg-card)] cursor-pointer transition-colors"
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
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">{t('settings.appName')}</label>
              <input type="text" className={inputCls('app_name')} value={config.app_name}
                onChange={e => updateField('app_name', e.target.value)} />
              {restartBadge('app_name')}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">{t('settings.subTitle')}</label>
              <input type="text" className={inputCls('subscription_title')} value={config.subscription_title}
                onChange={e => updateField('subscription_title', e.target.value)} />
              {restartBadge('subscription_title')}
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">{t('settings.description')}</label>
            <input type="text" className={inputCls('description_text')} value={config.description_text}
              onChange={e => updateField('description_text', e.target.value)} />
            {restartBadge('description_text')}
          </div>

          <div className="mb-5">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">{t('settings.workingLevel')}</label>
            <div className="flex items-center gap-4">
              <div className="relative grid grid-cols-2 p-1 bg-[var(--color-bg-input)] rounded-xl w-max border border-[var(--color-border)] shrink-0">
                <div 
                  className={`absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] bg-[var(--color-bg-card)] rounded-lg shadow-sm transition-transform duration-300 ease-in-out border border-[var(--color-border)] ${config.working_check_level === 2 ? 'translate-x-full' : 'translate-x-0'}`} 
                />
                <button
                  onClick={() => updateField('working_check_level', 1)}
                  className={`relative z-10 px-6 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                    config.working_check_level === 1 
                      ? 'text-accent' 
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {t('settings.levelNormal')}
                </button>
                <button
                  onClick={() => updateField('working_check_level', 2)}
                  className={`relative z-10 px-6 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                    config.working_check_level === 2 
                      ? 'text-warn' 
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {t('settings.levelUltra')}
                </button>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed max-w-xl">
                {config.working_check_level === 1 ? t('settings.levelNormalDesc') : t('settings.levelUltraDesc')}
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
                onChange={e => updateField('auto_update_major', e.target.checked)}
                className="w-5 h-5 rounded border-[var(--color-border)] accent-accent cursor-pointer"
              />
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">{t('settings.autoUpdateMajor')}</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer w-max">
              <input 
                type="checkbox" 
                checked={config.auto_update_patch} 
                onChange={e => updateField('auto_update_patch', e.target.checked)}
                className="w-5 h-5 rounded border-[var(--color-border)] accent-accent cursor-pointer"
              />
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">{t('settings.autoUpdatePatch')}</span>
            </label>
          </div>

          {/* === Network === */}
          <SectionDivider label={t('settings.network')} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">{t('settings.port')}</label>
              <input type="text" className={inputCls('port')} value={config.port}
                onChange={e => updateField('port', e.target.value)} />
              {restartBadge('port')}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">{t('settings.forcedIp')}</label>
              <input type="text" className={inputCls('forced_ip')} value={config.forced_ip}
                onChange={e => updateField('forced_ip', e.target.value)} />
              {restartBadge('forced_ip')}
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">{t('settings.subPath')}</label>
            <input type="text" className={inputCls('subscription_path')} value={config.subscription_path}
              onChange={e => updateField('subscription_path', e.target.value)} />
            {restartBadge('subscription_path')}
          </div>

          {/* === Files === */}
          <SectionDivider label={t('settings.files')} />

          <div className="mb-5">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">{t('settings.configsPath')}</label>
            <input type="text" className={inputCls('configs_path')} value={config.configs_path}
              onChange={e => updateField('configs_path', e.target.value)} />
            {restartBadge('configs_path')}
          </div>

          {/* === Timing === */}
          <SectionDivider label={t('settings.timing')} />

          <div className="mb-5">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">{t('settings.interval')}</label>
            <input type="number" className={inputCls('update_interval_minutes')} value={config.update_interval_minutes}
              onChange={e => updateField('update_interval_minutes', Number(e.target.value))} />
            {restartBadge('update_interval_minutes')}
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
              <div key={i} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl
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
          {restartBadge('sources')}
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
  );
}
