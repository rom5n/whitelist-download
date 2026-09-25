import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchConfig, fetchRestartStatus, restartServer, saveConfig, type AppConfig, type RestartStatus } from '../api';

/** Delay after the last edit before the settings are saved */
const AUTOSAVE_DELAY_MS = 600;
const RESTART_POLL_MS = 1000;
const RESTART_POLL_ATTEMPTS = 30;

export type SaveStatus = 'saved' | 'saving' | 'error' | 'invalid' | 'restart';

export interface SettingsState {
  config: AppConfig | null;
  loadError: boolean;
  reload: () => void;
  /** Applies a change and schedules an autosave */
  update: (patch: Partial<AppConfig>) => void;
  /** Marks a field as having an invalid draft; saving pauses while any field is invalid */
  setFieldInvalid: (field: string, invalid: boolean) => void;
  status: SaveStatus;
  restart: RestartStatus | null;
  retrySave: () => void;
  restartServerAndWait: () => Promise<void>;
  isRestarting: boolean;
}

const sleep = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

/** Settings with debounced autosave, one save request at a time, and restart tracking */
export function useSettings(): SettingsState {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [invalidFields, setInvalidFields] = useState<ReadonlySet<string>>(new Set());
  const [restart, setRestart] = useState<RestartStatus | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);

  const configRef = useRef<AppConfig | null>(null);
  const pending = useRef<AppConfig | null>(null);
  const inFlight = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchConfig()
      .then(data => {
        if (cancelled) return;
        configRef.current = data;
        setConfig(data);
        setLoadError(false);
      })
      .catch(err => {
        if (cancelled) return;
        console.error(err);
        setLoadError(true);
      });
    fetchRestartStatus()
      .then(status => !cancelled && setRestart(status))
      .catch(err => console.error(err));
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    // A running save picks up the latest pending config when it finishes
    if (inFlight.current || !pending.current) return;

    inFlight.current = true;
    setSaveState('saving');
    try {
      // Edits made while a request is in flight are sent right after it, one request at a time
      while (pending.current) {
        const next = pending.current;
        pending.current = null;
        try {
          setRestart(await saveConfig(next));
        } catch (err) {
          console.error(err);
          pending.current ??= next;
          setSaveState('error');
          return;
        }
      }
      setSaveState('saved');
    } finally {
      inFlight.current = false;
    }
  }, []);

  const update = useCallback((patch: Partial<AppConfig>) => {
    if (!configRef.current) return;
    const next = { ...configRef.current, ...patch };
    configRef.current = next;
    pending.current = next;
    setConfig(next);
    setSaveState('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
  }, [flush]);

  const setFieldInvalid = useCallback((field: string, invalid: boolean) => {
    setInvalidFields(prev => {
      if (prev.has(field) === invalid) return prev;
      const next = new Set(prev);
      if (invalid) next.add(field);
      else next.delete(field);
      return next;
    });
  }, []);

  const retrySave = useCallback(() => void flush(), [flush]);

  // Don't lose an edit made right before closing the tab
  useEffect(() => {
    const onPageHide = () => {
      if (pending.current) navigator.sendBeacon('/api/set-config', JSON.stringify(pending.current));
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, []);

  const restartServerAndWait = useCallback(async () => {
    setIsRestarting(true);
    const newPort = configRef.current?.port;
    const portChanged = restart?.fields.includes('port') ?? false;

    await restartServer();

    // The dashboard is served by the backend itself: after a port change it lives on the new port
    if (portChanged && newPort && import.meta.env.PROD) {
      await sleep(RESTART_POLL_MS * 2);
      const url = new URL(window.location.href);
      url.port = newPort;
      window.location.assign(url.toString());
      return;
    }

    for (let attempt = 0; attempt < RESTART_POLL_ATTEMPTS; attempt++) {
      await sleep(RESTART_POLL_MS);
      try {
        setRestart(await fetchRestartStatus());
        break;
      } catch {
        // The server is still starting
      }
    }
    setIsRestarting(false);
  }, [restart]);

  const reload = useCallback(() => {
    setLoadError(false);
    setReloadToken(n => n + 1);
  }, []);

  let status: SaveStatus = saveState;
  if (saveState === 'saved' && invalidFields.size > 0) status = 'invalid';
  else if (saveState === 'saved' && restart?.restart_required) status = 'restart';

  return {
    config,
    loadError,
    reload,
    update,
    setFieldInvalid,
    status,
    restart,
    retrySave,
    restartServerAndWait,
    isRestarting,
  };
}
