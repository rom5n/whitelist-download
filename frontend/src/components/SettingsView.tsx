import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from '../i18n';
import { updateConfigs, UPDATE_INTERVAL, type AppConfig } from '../api';
import type { SettingsState } from '../hooks/useSettings';
import type { LoadStatus } from '../hooks/useStatistics';
import type { CountryOption } from './CountrySelect';
import FadeScroll from './FadeScroll';
import ImportConfigs from './ImportConfigs';
import Spinner from './Spinner';

const INTERVAL_PRESETS = [5, 15, 30, 60, 180, 360, 720, 1440];
const WHOLE_NUMBER = /^\d+$/;

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mt-8 mb-4 first:mt-0 flex items-center gap-2">
      <span className="h-px flex-1 bg-[var(--color-border)]" />
      <span>{label}</span>
      <span className="h-px flex-1 bg-[var(--color-border)]" />
    </div>
  );
}

/** Renders all labels in one grid cell and shows the active one: the element never changes its width */
function StableLabel<K extends string>({ labels, active }: { labels: Record<K, ReactNode>; active: K }) {
  return (
    <span className="status-stack">
      {(Object.keys(labels) as K[]).map(key => (
        <span key={key} data-active={key === active} aria-hidden={key !== active} className="flex items-center justify-center gap-2">
          {labels[key]}
        </span>
      ))}
    </span>
  );
}

function validateInterval(text: string): { value: number | null; error: string | null; params?: Record<string, number> } {
  const trimmed = text.trim();
  if (!WHOLE_NUMBER.test(trimmed)) return { value: null, error: 'interval.errNumber' };
  const value = Number(trimmed);
  if (value < UPDATE_INTERVAL.min) return { value: null, error: 'interval.errMin', params: { min: UPDATE_INTERVAL.min } };
  if (value > UPDATE_INTERVAL.max) return { value: null, error: 'interval.errMax', params: { max: UPDATE_INTERVAL.max } };
  return { value, error: null };
}

function validatePort(text: string): boolean {
  const trimmed = text.trim();
  return WHOLE_NUMBER.test(trimmed) && Number(trimmed) >= 1 && Number(trimmed) <= 65535;
}

interface SettingsViewProps {
  version: string | undefined;
  settings: SettingsState;
  countries: CountryOption[];
  countriesStatus: LoadStatus;
  onRetryCountries: () => void;
  totalCount: number;
}

export default function SettingsView({ version, settings, countries, countriesStatus, onRetryCountries, totalCount }: SettingsViewProps) {
  const { t } = useTranslation();
  const { config, loadError, reload } = settings;

  if (loadError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-danger">{t('settings.loadError')}</p>
        <button type="button" onClick={reload} className="px-4 py-2 rounded-xl text-sm font-medium text-accent hover:bg-accent/10 cursor-pointer">
          {t('country.retry')}
        </button>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
          <Spinner />
          {t('settings.loading')}
        </div>
      </div>
    );
  }

  return (
    <SettingsForm
      config={config}
      version={version}
      settings={settings}
      countries={countries}
      countriesStatus={countriesStatus}
      onRetryCountries={onRetryCountries}
      totalCount={totalCount}
    />
  );
}

interface SettingsFormProps extends SettingsViewProps {
  config: AppConfig;
}

function SettingsForm({ config, version, settings, countries, countriesStatus, onRetryCountries, totalCount }: SettingsFormProps) {
  const { t } = useTranslation();
  const { update, setFieldInvalid, restart, restartServerAndWait, isRestarting } = settings;
  const ids = { interval: useId(), port: useId() };

  const [newSource, setNewSource] = useState('');
  const [intervalText, setIntervalText] = useState(String(config.update_interval_minutes));
  const [portText, setPortText] = useState(config.port);
  const [updateState, setUpdateState] = useState<'idle' | 'updating' | 'success' | 'error'>('idle');

  // A draft left invalid must not block saving after the form is closed
  useEffect(() => () => {
    setFieldInvalid('update_interval_minutes', false);
    setFieldInvalid('port', false);
  }, [setFieldInvalid]);

  const intervalCheck = validateInterval(intervalText);
  const portValid = validatePort(portText);

  const isNewSourceValid = useMemo(() => {
    if (!newSource) return false;
    if ((config.sources || []).includes(newSource)) return false;
    try {
      new URL(newSource);
      return true;
    } catch {
      return false;
    }
  }, [newSource, config.sources]);

  const needsRestart = (field: keyof AppConfig) => restart?.fields.includes(field) ?? false;

  const inputCls = (field: keyof AppConfig, invalid = false) =>
    `w-full px-4 py-3 rounded-xl text-sm bg-[var(--color-bg-input)] text-[var(--color-text-primary)] outline-none transition-colors duration-200 border ${
      invalid
        ? 'border-danger/60 focus:border-danger focus:ring-2 focus:ring-danger/20'
        : needsRestart(field)
          ? 'border-warn bg-warn/5 focus:ring-2 focus:ring-warn/20'
          : 'border-[var(--color-border)] focus:border-accent focus:ring-2 focus:ring-accent/20'
    }`;
  const labelCls = 'block text-sm font-medium text-[var(--color-text-secondary)] mb-2';
  const hintCls = (isError: boolean) => `min-h-5 mt-1.5 text-xs ${isError ? 'text-danger' : 'text-[var(--color-text-muted)]'}`;

  const changeInterval = (text: string) => {
    setIntervalText(text);
    const check = validateInterval(text);
    setFieldInvalid('update_interval_minutes', check.error !== null);
    if (check.value !== null && check.value !== config.update_interval_minutes) {
      update({ update_interval_minutes: check.value });
    }
  };

  const changePort = (text: string) => {
    setPortText(text);
    const valid = validatePort(text);
    setFieldInvalid('port', !valid);
    if (valid) update({ port: text.trim() });
  };

  const handleUpdateConfigs = async () => {
    setUpdateState('updating');
    let ok = false;
    try {
      ok = await updateConfigs();
    } catch (err) {
      console.error(err);
    }
    setUpdateState(ok ? 'success' : 'error');
    window.setTimeout(() => setUpdateState('idle'), 2000);
  };

  const addSource = () => {
    if (isNewSourceValid) {
      update({ sources: [...(config.sources || []), newSource] });
      setNewSource('');
    }
  };

  const removeSource = (i: number) => {
    update({ sources: (config.sources || []).filter((_, idx) => idx !== i) });
  };

  const formatPreset = (minutes: number) =>
    minutes < 60 ? t('time.min', { n: minutes }) : t('time.hour', { n: minutes / 60 });

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 relative">
      <div className="w-full space-y-8 animate-[fade-in_0.3s_ease-out]">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">{t('settings.title')}</h2>
          <div className="flex gap-3 shrink-0">
            <button
              type="button"
              onClick={handleUpdateConfigs}
              disabled={updateState === 'updating'}
              className="px-5 py-2.5 rounded-xl text-sm font-medium border border-[var(--color-border)] hover:border-accent hover:text-accent bg-[var(--color-bg-card)] cursor-pointer transition-colors disabled:cursor-progress"
            >
              <StableLabel
                active={updateState}
                labels={{
                  idle: t('settings.updateConfigs'),
                  updating: <><Spinner />{t('control.updating')}</>,
                  success: <span className="text-success">{t('control.success')}</span>,
                  error: <span className="text-danger">{t('control.error')}</span>,
                }}
              />
            </button>
            <button
              type="button"
              onClick={restartServerAndWait}
              disabled={isRestarting}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium border cursor-pointer transition-colors disabled:cursor-progress ${
                restart?.restart_required
                  ? 'border-warn text-warn bg-warn/10 hover:bg-warn/20'
                  : 'border-[var(--color-border)] hover:border-warn hover:text-warn bg-[var(--color-bg-card)]'
              }`}
            >
              <StableLabel
                active={isRestarting ? 'restarting' : 'idle'}
                labels={{
                  idle: t('settings.restartServer'),
                  restarting: <><Spinner />{t('control.restarting')}</>,
                }}
              />
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
                onChange={e => update({ app_name: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>{t('settings.subTitle')}</label>
              <input type="text" className={inputCls('subscription_title')} value={config.subscription_title}
                onChange={e => update({ subscription_title: e.target.value })} />
            </div>
          </div>

          <div className="mb-5">
            <label className={labelCls}>{t('settings.description')}</label>
            <input type="text" className={inputCls('description_text')} value={config.description_text}
              onChange={e => update({ description_text: e.target.value })} />
          </div>

          <div className="mb-5">
            <label className={labelCls}>{t('settings.workingLevel')}</label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="relative grid grid-cols-2 p-1 bg-[var(--color-bg-input)] rounded-xl w-max border border-[var(--color-border)] shrink-0">
                <div
                  className={`absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] bg-[var(--color-bg-card)] rounded-lg shadow-sm transition-transform duration-300 ease-in-out border border-[var(--color-border)] ${config.working_check_level === 2 ? 'translate-x-full' : 'translate-x-0'}`}
                />
                <button
                  type="button"
                  onClick={() => update({ working_check_level: 1 })}
                  aria-pressed={config.working_check_level === 1}
                  className={`relative z-10 px-6 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                    config.working_check_level === 1
                      ? 'text-accent'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {t('settings.levelNormal')}
                </button>
                <button
                  type="button"
                  onClick={() => update({ working_check_level: 2 })}
                  aria-pressed={config.working_check_level === 2}
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
            {([
              ['auto_update_major', 'settings.autoUpdateMajor'],
              ['auto_update_patch', 'settings.autoUpdatePatch'],
              ['auto_browser_open', 'settings.autoBrowserOpen'],
            ] as const).map(([field, label]) => (
              <label key={field} className="flex items-center gap-3 cursor-pointer w-max max-w-full">
                <input
                  type="checkbox"
                  checked={config[field]}
                  onChange={e => update({ [field]: e.target.checked })}
                  className="w-5 h-5 rounded border-[var(--color-border)] accent-accent cursor-pointer shrink-0"
                />
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">{t(label)}</span>
              </label>
            ))}
          </div>

          {/* === Network === */}
          <SectionDivider label={t('settings.network')} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-1 mb-4">
            <div>
              <label htmlFor={ids.port} className={labelCls}>{t('settings.port')}</label>
              <input id={ids.port} type="text" inputMode="numeric" className={inputCls('port', !portValid)} value={portText}
                aria-invalid={!portValid}
                onChange={e => changePort(e.target.value)} />
              <p className={hintCls(!portValid)}>{!portValid && '1 – 65535'}</p>
            </div>
            <div>
              <label className={labelCls}>{t('settings.forcedIp')}</label>
              <input type="text" className={inputCls('forced_ip')} value={config.forced_ip}
                onChange={e => update({ forced_ip: e.target.value })} />
            </div>
          </div>

          <div className="mb-5">
            <label className={labelCls}>{t('settings.subPath')}</label>
            <input type="text" className={inputCls('subscription_path')} value={config.subscription_path}
              onChange={e => update({ subscription_path: e.target.value })} />
          </div>

          {/* === Timing === */}
          <SectionDivider label={t('settings.timing')} />

          <div className="mb-5">
            <label htmlFor={ids.interval} className={labelCls}>{t('settings.interval')}</label>
            <div className="flex flex-col lg:flex-row lg:items-start gap-3">
              <input
                id={ids.interval}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className={`${inputCls('update_interval_minutes', intervalCheck.error !== null)} lg:w-40 shrink-0 tabular-nums`}
                value={intervalText}
                aria-invalid={intervalCheck.error !== null}
                aria-describedby={`${ids.interval}-hint`}
                onChange={e => changeInterval(e.target.value)}
              />
              <div role="group" aria-label={t('interval.presets')} className="flex flex-wrap gap-2">
                {INTERVAL_PRESETS.map(minutes => {
                  const active = intervalCheck.value === minutes;
                  return (
                    <button
                      key={minutes}
                      type="button"
                      aria-pressed={active}
                      onClick={() => changeInterval(String(minutes))}
                      className={`px-3.5 py-2 rounded-full text-sm font-medium cursor-pointer transition-colors border ${
                        active
                          ? 'bg-accent/15 text-accent border-accent/40'
                          : 'bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)]'
                      }`}
                    >
                      {formatPreset(minutes)}
                    </button>
                  );
                })}
              </div>
            </div>
            <p id={`${ids.interval}-hint`} className={hintCls(intervalCheck.error !== null)}>
              {intervalCheck.error && t(intervalCheck.error, intervalCheck.params)}
            </p>
          </div>

          {/* === Import configs === */}
          <SectionDivider label={t('import.title')} />

          <div className="mb-5">
            <ImportConfigs
              countries={countries}
              countriesStatus={countriesStatus}
              onRetryCountries={onRetryCountries}
              totalCount={totalCount}
            />
          </div>

          {/* === Sources === */}
          <SectionDivider label={t('settings.sources')} />

          <div className="flex gap-3 mb-4">
            <input
              placeholder={t('settings.sourcePlaceholder')}
              value={newSource}
              onChange={e => setNewSource(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSource()}
              className={`flex-1 min-w-0 px-4 py-3 rounded-xl text-sm bg-[var(--color-bg-input)] text-[var(--color-text-primary)] outline-none transition-colors cursor-text border ${
                !isNewSourceValid && newSource
                  ? 'border-red-500/50 focus:border-red-500/80 bg-red-500/5'
                  : 'border-[var(--color-border)] focus:border-accent focus:ring-2 focus:ring-accent/20'
              }`}
            />
            <button
              type="button"
              onClick={addSource}
              disabled={!isNewSourceValid}
              className={`px-6 py-3 rounded-xl text-sm font-medium border-none transition-colors shadow-md shrink-0 ${
                isNewSourceValid
                  ? 'bg-accent text-white hover:bg-accent-hover cursor-pointer'
                  : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)] cursor-not-allowed opacity-60'
              }`}
            >
              {t('settings.addSource')}
            </button>
          </div>
          <FadeScroll className="max-h-72 rounded-xl">
            <ul className="flex flex-col gap-2">
              {(config.sources || []).map((s, i) => (
                <li key={s} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border)]">
                  <span className="text-sm text-[var(--color-text-primary)] overflow-hidden text-ellipsis whitespace-nowrap flex-1 font-mono" title={s}>
                    {s}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSource(i)}
                    className="bg-transparent border-none text-red-400 font-medium text-sm cursor-pointer hover:text-red-300 transition-colors shrink-0"
                  >
                    {t('settings.removeSource')}
                  </button>
                </li>
              ))}
            </ul>
          </FadeScroll>
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
