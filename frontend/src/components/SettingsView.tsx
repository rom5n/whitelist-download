import { useState, useMemo, useRef, useEffect } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Check, ExternalLink, Heart, Plus, Power, RefreshCw, X } from 'lucide-react';
import { useTranslation } from '../i18n';
import { updateConfigs, restartServer, setCheckLevel, type AppConfig, type CheckLevel, type PollingState, type RestartState } from '../api';
import type { Attention } from '../navigation';
import { useAutoSaveConfig } from '../useAutoSaveConfig';
import { useScrollFade } from '../useScrollFade';
import { isValidSource } from '../validateConfig';
import { itemVariants, spring } from '../motion/presets';
import AutoUpdateControl from './AutoUpdateControl';
import ImportConfigs from './ImportConfigs';
import IntervalField from './IntervalField';
import RestartVignette from './RestartVignette';
import SaveStatus from './SaveStatus';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Field from '../ui/Field';
import Switch from '../ui/Switch';
import SegmentedControl from '../ui/SegmentedControl';
import Skeleton from '../ui/Skeleton';
import GithubIcon from '../ui/GithubIcon';
import { inputClass } from '../ui/styles';

interface SettingsViewProps {
  version: string | undefined;
  pollingState: PollingState | null;
  onPollingStateChange: (state: PollingState) => void;
  /** Configs per country, for the import filters; null while the statistics load */
  countries: Record<string, number> | null;
  totalConfigs: number;
  countriesError: boolean;
  onRetryCountries: () => void;
  /** Saved changes that await a restart; followed by App, so the header shows it on every screen */
  restart: RestartState;
  onRestartChange: (restart: RestartState) => void;
  /** Tells the header whether something runs here (saving, updating, restarting) or needs the user */
  onActivityChange: (activity: Attention | null) => void;
}

type ActionState = 'idle' | 'busy' | 'done' | 'failed';

export default function SettingsView({
  version,
  pollingState,
  onPollingStateChange,
  countries,
  totalConfigs,
  countriesError,
  onRetryCountries,
  restart,
  onRestartChange,
  onActivityChange,
}: SettingsViewProps) {
  const { t } = useTranslation();
  const { config, errors, status, errorMessage, update, retry } = useAutoSaveConfig(pollingState?.working_check_level, onRestartChange);
  const [newSource, setNewSource] = useState('');

  const [updateState, setUpdateState] = useState<ActionState>('idle');
  const [restartState, setRestartState] = useState<ActionState>('idle');
  const [levelFailed, setLevelFailed] = useState(false);
  const timers = useRef<number[]>([]);
  const sourcesRef = useScrollFade<HTMLUListElement>();

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const activity: Attention | null = status === 'saving' || updateState === 'busy' || restartState === 'busy'
    ? 'busy'
    : status === 'invalid' || status === 'error' ? 'action' : null;

  useEffect(() => {
    onActivityChange(activity);
  }, [activity, onActivityChange]);

  // Leaving the settings stops nothing that would keep the dot lit
  useEffect(() => () => onActivityChange(null), [onActivityChange]);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const isNewSourceValid = useMemo(() => {
    if (!newSource || !config) return false;
    return !(config.sources || []).includes(newSource) && isValidSource(newSource);
  }, [newSource, config]);

  if (!config) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 sm:px-8 sm:py-10" aria-busy="true" aria-label={t('settings.loading')}>
        <Skeleton className="h-9 w-48" />
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
      </div>
    );
  }

  // The backend is the source of truth: the level can also be changed from the tray
  const workingLevel = pollingState?.working_check_level ?? config.working_check_level;

  const restartNote = (field: keyof AppConfig) => (restart.fields.includes(field) ? t('settings.restartRequired') : undefined);
  const errorNote = (field: keyof AppConfig) => (errors[field] ? t(errors[field]) : undefined);

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
    setUpdateState('busy');
    const ok = await updateConfigs();
    setUpdateState(ok ? 'done' : 'failed');
    later(() => setUpdateState('idle'), 2000);
  };

  const handleRestart = async () => {
    setRestartState('busy');
    await restartServer();
    // It closes connection so it might throw, we just let it be.
    later(() => setRestartState('done'), 2000);
  };

  const addSource = () => {
    if (isNewSourceValid) {
      update('sources', [...(config.sources || []), newSource], true);
      setNewSource('');
    }
  };

  const removeSource = (source: string) => {
    update('sources', (config.sources || []).filter(s => s !== source), true);
  };

  const cardDelay = (i: number) => ({ animationDelay: `${i * 40}ms` });

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 pb-10 sm:px-8">
          {/* Status and actions stay in view while scrolling */}
          <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-3 border-b border-line bg-bg px-4 py-4 sm:-mx-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="flex min-w-0 flex-col">
              <h1 className="text-xl font-semibold text-fg">{t('control.settings')}</h1>
              <SaveStatus status={status} restartRequired={restart.required} errorMessage={errorMessage} onRetry={retry} />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleUpdateConfigs}
                loading={updateState === 'busy'}
                icon={updateState === 'done'
                  ? <Check key="done" className="size-4 animate-pop text-success-text" aria-hidden="true" />
                  : updateState === 'failed'
                    ? <X key="failed" className="size-4 animate-pop text-danger-text" aria-hidden="true" />
                    : <RefreshCw className="size-4" aria-hidden="true" />}
                className="flex-1 sm:flex-none"
              >
                {updateState === 'busy' ? t('control.updating') : updateState === 'done' ? t('control.success') : updateState === 'failed' ? t('control.error') : (
                  <>
                    {/* Phones get short labels, so both buttons fit in one row */}
                    <span className="sm:hidden">{t('settings.updateConfigsShort')}</span>
                    <span className="hidden sm:inline">{t('settings.updateConfigs')}</span>
                  </>
                )}
              </Button>

              <Button
                onClick={handleRestart}
                loading={restartState === 'busy'}
                icon={<Power className="size-4" aria-hidden="true" />}
                className={`flex-1 sm:flex-none ${restart.required ? 'border-warn/60! text-warn-text!' : ''}`}
              >
                {/* The glow breathes while a restart is required: only its opacity is animated */}
                {restart.required && (
                  <span aria-hidden="true" className="breathe pointer-events-none absolute -inset-px rounded-md bg-warn-soft shadow-[0_0_16px_var(--warn-soft)]" />
                )}
                <span className="relative">
                  {restartState === 'busy' ? t('control.restarting') : restartState === 'done' ? t('control.done') : (
                    <>
                      <span className="sm:hidden">{t('settings.restartServerShort')}</span>
                      <span className="hidden sm:inline">{t('settings.restartServer')}</span>
                    </>
                  )}
                </span>
              </Button>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <Card title={t('settings.general')} className="animate-enter" style={cardDelay(0)}>
              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label={t('settings.appName')}
                  value={config.app_name}
                  onChange={e => update('app_name', e.target.value)}
                  error={errorNote('app_name')}
                  warning={restartNote('app_name')}
                />
                <Field
                  label={t('settings.subTitle')}
                  value={config.subscription_title}
                  onChange={e => update('subscription_title', e.target.value)}
                  error={errorNote('subscription_title')}
                />
                <Field
                  className="md:col-span-2"
                  label={t('settings.description')}
                  value={config.description_text}
                  onChange={e => update('description_text', e.target.value)}
                  error={errorNote('description_text')}
                />
              </div>
              <div className="mt-4 border-t border-line pt-3">
                <Switch
                  label={t('settings.autoBrowserOpen')}
                  checked={config.auto_browser_open}
                  onChange={checked => update('auto_browser_open', checked, true)}
                />
              </div>
            </Card>

            <Card title={t('settings.workingLevel')} className="animate-enter" style={cardDelay(1)}>
              <SegmentedControl<CheckLevel>
                label={t('settings.workingLevel')}
                value={workingLevel === 2 ? 2 : 1}
                onChange={handleLevelChange}
                options={[
                  { value: 1, label: t('settings.levelNormal') },
                  { value: 2, label: t('settings.levelUltra') },
                ]}
              />
              <p key={`${workingLevel}-${levelFailed}`} className={`mt-3 animate-fade text-sm ${levelFailed ? 'text-danger-text' : 'text-fg-2'}`}>
                {levelFailed ? t('settings.saveError') : workingLevel === 1 ? t('settings.levelNormalDesc') : t('settings.levelUltraDesc')}
              </p>
            </Card>

            <Card title={t('settings.autoRefresh')} className="animate-enter" style={cardDelay(2)}>
              <AutoUpdateControl state={pollingState} onStateChange={onPollingStateChange} />
              <div className="mt-5 border-t border-line pt-5">
                <IntervalField
                  value={config.update_interval_minutes}
                  onChange={(minutes, immediate) => update('update_interval_minutes', minutes, immediate)}
                />
              </div>
            </Card>

            <Card title={t('settings.network')} className="animate-enter" style={cardDelay(3)}>
              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label={t('settings.port')}
                  inputMode="numeric"
                  value={config.port}
                  onChange={e => update('port', e.target.value)}
                  error={errorNote('port')}
                  warning={restartNote('port')}
                />
                <Field
                  label={t('settings.forcedIp')}
                  value={config.forced_ip}
                  onChange={e => update('forced_ip', e.target.value)}
                  error={errorNote('forced_ip')}
                />
                <Field
                  className="md:col-span-2"
                  mono
                  label={t('settings.subPath')}
                  value={config.subscription_path}
                  onChange={e => update('subscription_path', e.target.value)}
                  error={errorNote('subscription_path')}
                  warning={restartNote('subscription_path')}
                />
              </div>
            </Card>

            <Card title={t('settings.updates')} className="animate-enter" style={cardDelay(4)}>
              <div className="divide-y divide-line">
                <Switch
                  label={t('settings.autoUpdateMajor')}
                  checked={config.auto_update_major}
                  onChange={checked => update('auto_update_major', checked, true)}
                />
                <Switch
                  label={t('settings.autoUpdatePatch')}
                  checked={config.auto_update_patch}
                  onChange={checked => update('auto_update_patch', checked, true)}
                />
              </div>
            </Card>

            <ImportConfigs
              countries={countries}
              total={totalConfigs}
              loadError={countriesError}
              onRetry={onRetryCountries}
              className="animate-enter"
              style={cardDelay(5)}
            />

            <Card title={t('settings.sources')} className="animate-enter" style={cardDelay(6)}>
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={event => {
                  event.preventDefault();
                  addSource();
                }}
              >
                <input
                  type="url"
                  aria-label={t('settings.sourcePlaceholder')}
                  placeholder={t('settings.sourcePlaceholder')}
                  value={newSource}
                  onChange={e => setNewSource(e.target.value)}
                  aria-invalid={newSource && !isNewSourceValid ? true : undefined}
                  className={`${inputClass(newSource && !isNewSourceValid ? 'error' : 'default', true)} flex-1`}
                />
                <Button type="submit" variant="primary" disabled={!isNewSourceValid} icon={<Plus className="size-4" aria-hidden="true" />}>
                  {t('settings.addSource')}
                </Button>
              </form>

              {/* A long list scrolls inside; its edges fade only where there is more to see */}
              <div className="mt-4 overflow-hidden rounded-md border border-line">
                <ul ref={sourcesRef} aria-label={t('settings.sources')} className="scroll-fade max-h-[21rem] overflow-y-auto overscroll-contain">
                  <AnimatePresence initial={false}>
                    {(config.sources || []).map(source => (
                      <m.li
                        key={source}
                        layout="position"
                        variants={itemVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={spring.gentle}
                        className="flex items-center gap-3 border-b border-line bg-surface pl-4 last:border-b-0"
                      >
                        <span className="min-w-0 flex-1 truncate py-3 font-mono text-[13px] text-fg" title={source}>{source}</span>
                        <button
                          type="button"
                          onClick={() => removeSource(source)}
                          aria-label={`${t('settings.removeSource')}: ${source}`}
                          className="press flex size-11 shrink-0 items-center justify-center rounded-md text-fg-3 cursor-pointer hover:bg-danger-soft hover:text-danger-text"
                        >
                          <X className="size-4" aria-hidden="true" />
                        </button>
                      </m.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            </Card>
          </div>

          <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-fg-3">
            {version && (
              <a
                href={`https://github.com/rom5n/whitelist-download/releases/tag/v${version}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-1 rounded-md px-3 hover:text-fg"
              >
                v{version}
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            )}
            <a href="https://github.com/rom5n/whitelist-download" target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-1.5 rounded-md px-3 hover:text-fg sm:hidden">
              <GithubIcon className="size-3.5" />
              GitHub
            </a>
            <a href="https://pay.cloudtips.ru/p/c6662c22" target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-1.5 rounded-md px-3 hover:text-danger-text sm:hidden">
              <Heart className="size-3.5" aria-hidden="true" />
              {t('header.donate')}
            </a>
          </footer>
        </div>
      </div>

      <RestartVignette visible={restart.required} />
    </div>
  );
}
