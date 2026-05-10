import { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import { fetchConfig, saveConfig, type AppConfig } from '../api';

/** Config fields that require a server restart to take effect */
const RESTART_FIELDS: (keyof AppConfig)[] = [
  'port', 'logs_path', 'subscription_path', 'app_name',
];

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Renders a section divider with a centered label */
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mt-6 mb-3 first:mt-0 flex items-center gap-2">
      <span className="h-px flex-1 bg-[var(--color-border)]" />
      <span>{label}</span>
      <span className="h-px flex-1 bg-[var(--color-border)]" />
    </div>
  );
}

/**
 * Full-screen modal for managing server configuration.
 * Organized into sections: General, Network, Files, Timing, Sources.
 * Highlights modified fields and shows restart warnings.
 *
 * NOTE: Field rendering is inlined rather than wrapped in inner components
 * to prevent React from unmounting/remounting inputs on every keystroke
 * (which would cause cursor/focus loss).
 */
export default function SettingsModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [original, setOriginal] = useState<AppConfig | null>(null);
  const [newSource, setNewSource] = useState('');
  const [saveText, setSaveText] = useState('');

  /** Load config when modal opens */
  useEffect(() => {
    if (!open) return;
    fetchConfig().then(data => {
      setConfig(data);
      setOriginal(data);
    }).catch(console.error);
  }, [open]);

  if (!open || !config) return null;

  /** Check if a field value differs from the original */
  const isModified = (field: keyof AppConfig) =>
    original && JSON.stringify(config[field]) !== JSON.stringify(original[field]);

  /** Check if a modified field requires restart */
  const needsRestart = (field: keyof AppConfig) =>
    isModified(field) && RESTART_FIELDS.includes(field);

  /** Build dynamic input class based on modification/restart state */
  const inputCls = (field: keyof AppConfig) =>
    `w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--color-bg-input)] text-[var(--color-text-primary)] outline-none transition-all duration-200 border ${needsRestart(field)
      ? 'border-warn bg-warn/5'
      : isModified(field)
        ? 'border-accent/50'
        : 'border-[var(--color-border)] focus:border-accent'
    }`;

  /** Updates a single config field value */
  const updateField = (field: keyof AppConfig, value: string | number) => {
    setConfig({ ...config, [field]: value });
  };

  /** Save config to backend */
  const handleSave = async () => {
    if (!config) return;
    setSaveText(t('settings.saving'));
    const ok = await saveConfig(config);
    setSaveText(ok ? t('settings.saved') : t('settings.saveError'));
    if (ok) setOriginal(config);
    setTimeout(() => setSaveText(''), 2000);
  };

  /** Add a new source URL */
  const addSource = () => {
    if (newSource && !config.sources.includes(newSource)) {
      setConfig({ ...config, sources: [...config.sources, newSource] });
      setNewSource('');
    }
  };

  /** Remove a source URL by index */
  const removeSource = (i: number) => {
    setConfig({ ...config, sources: config.sources.filter((_, idx) => idx !== i) });
  };

  /** Renders a restart warning badge if the field was modified and requires restart */
  const restartBadge = (field: keyof AppConfig) =>
    needsRestart(field)
      ? <span className="text-[11px] text-warn mt-1 block">{t('settings.restartRequired')}</span>
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-bg-card)] border border-[var(--color-glass-border)] rounded-2xl
                    w-[92%] max-w-lg max-h-[85vh] flex flex-col shadow-2xl animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] m-0">
            {t('settings.title')}
          </h2>
          <button
            id="settings-close-btn"
            onClick={onClose}
            className="bg-transparent border-none text-[var(--color-text-muted)] text-xl cursor-pointer
                       hover:text-[var(--color-text-primary)] transition-colors p-1"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content — all fields are inlined to preserve input focus */}
        <div className="px-6 py-5 overflow-y-auto flex-1">

          {/* === General === */}
          <SectionDivider label={t('settings.general')} />

          <div className="mb-3">
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">{t('settings.appName')}</label>
            <input type="text" className={inputCls('app_name')} value={config.app_name}
              onChange={e => updateField('app_name', e.target.value)} />
            {restartBadge('app_name')}
          </div>

          <div className="mb-3">
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">{t('settings.subTitle')}</label>
            <input type="text" className={inputCls('subscription_title')} value={config.subscription_title}
              onChange={e => updateField('subscription_title', e.target.value)} />
            {restartBadge('subscription_title')}
          </div>

          <div className="mb-3">
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">{t('settings.description')}</label>
            <input type="text" className={inputCls('description_text')} value={config.description_text}
              onChange={e => updateField('description_text', e.target.value)} />
            {restartBadge('description_text')}
          </div>

          {/* === Network === */}
          <SectionDivider label={t('settings.network')} />

          <div className="grid grid-cols-2 gap-3">
            <div className="mb-3">
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">{t('settings.port')}</label>
              <input type="text" className={inputCls('port')} value={config.port}
                onChange={e => updateField('port', e.target.value)} />
              {restartBadge('port')}
            </div>
            <div className="mb-3">
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">{t('settings.forcedIp')}</label>
              <input type="text" className={inputCls('forced_ip')} value={config.forced_ip}
                onChange={e => updateField('forced_ip', e.target.value)} />
              {restartBadge('forced_ip')}
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">{t('settings.subPath')}</label>
            <input type="text" className={inputCls('subscription_path')} value={config.subscription_path}
              onChange={e => updateField('subscription_path', e.target.value)} />
            {restartBadge('subscription_path')}
          </div>

          {/* === Files === */}
          <SectionDivider label={t('settings.files')} />

          <div className="mb-3">
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">{t('settings.configsPath')}</label>
            <input type="text" className={inputCls('configs_path')} value={config.configs_path}
              onChange={e => updateField('configs_path', e.target.value)} />
            {restartBadge('configs_path')}
          </div>

          <div className="mb-3">
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">{t('settings.logsPath')}</label>
            <input type="text" className={inputCls('logs_path')} value={config.logs_path}
              onChange={e => updateField('logs_path', e.target.value)} />
            {restartBadge('logs_path')}
          </div>

          {/* === Timing === */}
          <SectionDivider label={t('settings.timing')} />

          <div className="mb-3">
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">{t('settings.interval')}</label>
            <input type="number" className={inputCls('update_interval_minutes')} value={config.update_interval_minutes}
              onChange={e => updateField('update_interval_minutes', Number(e.target.value))} />
            {restartBadge('update_interval_minutes')}
          </div>

          {/* === Sources === */}
          <SectionDivider label={t('settings.sources')} />

          <div className="flex gap-2 mb-3">
            <input
              placeholder={t('settings.sourcePlaceholder')}
              value={newSource}
              onChange={e => setNewSource(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSource()}
              className="flex-1 px-3 py-2.5 rounded-lg text-sm bg-[var(--color-bg-input)]
                         border border-[var(--color-border)] text-[var(--color-text-primary)]
                         outline-none focus:border-accent transition-colors"
            />
            <button
              onClick={addSource}
              className="px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer border-none
                         bg-accent text-white hover:bg-accent-hover transition-colors"
            >
              {t('settings.addSource')}
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto flex flex-col gap-2">
            {config.sources.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg
                                      bg-[var(--color-bg-input)] border border-[var(--color-border)]">
                <span className="text-xs text-[var(--color-text-primary)] overflow-hidden text-ellipsis whitespace-nowrap flex-1 font-mono">
                  {s}
                </span>
                <button
                  onClick={() => removeSource(i)}
                  className="bg-transparent border-none text-red-400 text-xs cursor-pointer
                             hover:text-red-300 transition-colors shrink-0"
                >
                  {t('settings.removeSource')}
                </button>
              </div>
            ))}
          </div>
          {restartBadge('sources')}

          {/* Save button */}
          <button
            id="save-config-btn"
            onClick={handleSave}
            className={`w-full mt-6 py-3 rounded-xl text-sm font-semibold cursor-pointer border-none
                        transition-all duration-200 hover:-translate-y-0.5
                        ${saveText === t('settings.saved')
                ? 'bg-success text-white'
                : saveText === t('settings.saveError')
                  ? 'bg-danger text-white'
                  : 'bg-accent text-white hover:bg-accent-hover'}`}
          >
            {saveText || t('settings.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
