import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchConfig, fetchRestartState, saveConfig, type AppConfig, type RestartState } from './api';
import { validateConfig, type ConfigErrors } from './validateConfig';

/**
 * - saved: the server has everything the user entered
 * - saving: changes are waiting to be sent or are being sent
 * - invalid: the settings have invalid values, so nothing is sent until they are fixed
 * - error: the server did not accept the settings, or is not reachable
 */
export type SaveStatus = 'saved' | 'saving' | 'invalid' | 'error';

/** Settings edited in the form; the others are applied immediately through their own endpoints */
const EDITABLE_FIELDS: (keyof AppConfig)[] = [
  'app_name', 'subscription_title', 'description_text', 'port', 'configs_path', 'subscription_path',
  'update_interval_minutes', 'sources', 'forced_ip', 'auto_update_major', 'auto_update_patch', 'auto_browser_open',
];

/** Pause after the last keystroke before the settings are sent */
const SAVE_DELAY_MS = 600;
const RESTART_POLL_MS = 3000;

const NO_RESTART: RestartState = { required: false, fields: [] };

const hasChanges = (draft: AppConfig, saved: AppConfig) =>
  EDITABLE_FIELDS.some(field => JSON.stringify(draft[field]) !== JSON.stringify(saved[field]));

/**
 * Loads the settings and sends every change to the server on its own (text fields wait for a short pause in typing),
 * so there is no "Save" button. Invalid values are never sent. Also tracks which changes await a server restart.
 *
 * @param workingLevel - The working check level currently used by the server; it is changed separately
 *   (also from the tray) and has to be sent back unchanged with the rest of the settings.
 */
export function useAutoSaveConfig(workingLevel: number | undefined) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [errorMessage, setErrorMessage] = useState('');
  const [restart, setRestart] = useState<RestartState>(NO_RESTART);

  const draftRef = useRef<AppConfig | null>(null); // What the user has entered
  const savedRef = useRef<AppConfig | null>(null); // What the server has
  const levelRef = useRef(workingLevel);
  const timerRef = useRef<number | undefined>(undefined);
  const savingRef = useRef(false);

  useEffect(() => {
    levelRef.current = workingLevel;
  }, [workingLevel]);

  const flush = useCallback(async (keepalive = false) => {
    window.clearTimeout(timerRef.current);
    timerRef.current = undefined;

    // The running save picks up newer changes when it finishes
    if (savingRef.current) return;
    savingRef.current = true;

    try {
      for (;;) {
        const draft = draftRef.current;
        const saved = savedRef.current;
        if (!draft || !saved || !hasChanges(draft, saved)) {
          setStatus('saved');
          return;
        }
        if (Object.keys(validateConfig(draft)).length > 0) {
          setStatus('invalid');
          return;
        }

        setStatus('saving');
        const payload = { ...draft, working_check_level: levelRef.current ?? draft.working_check_level };
        const result = await saveConfig(payload, keepalive);
        if (!result.ok) {
          setErrorMessage(result.message);
          setStatus('error');
          return;
        }

        savedRef.current = payload;
        setRestart(result.restart);
        // Loop again: the user may have changed something while the request was running
      }
    } finally {
      savingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchConfig().then(data => {
      draftRef.current = data;
      savedRef.current = data;
      setConfig(data);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    const load = () => fetchRestartState().then(setRestart).catch(() => {
      // The server is restarting or busy: keep what is shown
    });

    load();
    const timer = window.setInterval(load, RESTART_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  // Send changes that are still waiting for the typing pause when the user leaves
  useEffect(() => {
    const flushPending = () => {
      if (timerRef.current !== undefined) void flush(true);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPending();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flushPending);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flushPending);
      flushPending();
    };
  }, [flush]);

  /** Changes a setting. Text fields are sent after a pause in typing, everything else right away. */
  const update = useCallback(<K extends keyof AppConfig>(field: K, value: AppConfig[K], immediate = false) => {
    const current = draftRef.current;
    if (!current) return;

    const next = { ...current, [field]: value };
    draftRef.current = next;
    setConfig(next);
    setStatus(Object.keys(validateConfig(next)).length > 0 ? 'invalid' : 'saving');

    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void flush(), immediate ? 0 : SAVE_DELAY_MS);
  }, [flush]);

  const retry = useCallback(() => void flush(), [flush]);

  const errors: ConfigErrors = useMemo(() => (config ? validateConfig(config) : {}), [config]);

  return { config, errors, status, errorMessage, restart, update, retry };
}
