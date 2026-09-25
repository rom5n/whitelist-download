import type { AppConfig } from './api';

/** Maps a config field to the i18n key of its error message */
export type ConfigErrors = Partial<Record<keyof AppConfig, string>>;

/** The longest update interval in minutes (one week), as config.MaxUpdateInterval on the backend */
export const MAX_UPDATE_INTERVAL = 7 * 24 * 60;
const SUBSCRIPTION_PATH = /^\/[A-Za-z0-9._~-]+(\/[A-Za-z0-9._~-]+)*$/;
const RESERVED_PATHS = ['api', 'assets'];

/**
 * Checks the settings before they are sent to the server. The rules mirror config.Validate on the backend,
 * which rejects the same values: settings are saved as they change, so a half-typed value must never be sent.
 */
export function validateConfig(config: AppConfig): ConfigErrors {
  const errors: ConfigErrors = {};

  if (!config.app_name.trim() || /[/\\]/.test(config.app_name)) errors.app_name = 'settings.errName';

  const port = Number(config.port);
  if (!/^\d{1,5}$/.test(config.port) || port < 1 || port > 65535) errors.port = 'settings.errPort';

  if (!SUBSCRIPTION_PATH.test(config.subscription_path)) {
    errors.subscription_path = 'settings.errSubPath';
  } else if (RESERVED_PATHS.includes(config.subscription_path.slice(1).split('/')[0])) {
    errors.subscription_path = 'settings.errSubPathReserved';
  }

  const interval = config.update_interval_minutes;
  if (!Number.isInteger(interval) || interval < 1 || interval > MAX_UPDATE_INTERVAL) {
    errors.update_interval_minutes = 'settings.errInterval';
  }

  if (/[\s/]/.test(config.forced_ip)) errors.forced_ip = 'settings.errForcedIp';

  return errors;
}

/** Whether a source is an absolute http(s) URL */
export function isValidSource(source: string): boolean {
  try {
    const url = new URL(source);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.host !== '';
  } catch {
    return false;
  }
}
