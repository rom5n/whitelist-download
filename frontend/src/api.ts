/**
 * TypeScript interfaces matching the backend data models.
 * See: backend/domain/statistic.go and backend/config/config.go
 */

/** Statistics response from GET /api/statistics */
export interface Statistics {
  amount_configs: number;
  configs_by_country: Record<string, number>;
  last_update: number;
  up_at: number;
  update_interval: number;
  version: string;
}

/** Configs response from GET /api/configs */
export interface ConfigsResponse {
  configs: string[];
}

/** Application config from GET /api/get-config and POST /api/set-config */
export interface AppConfig {
  app_name: string;
  subscription_title: string;
  description_text: string;
  port: string;
  configs_path: string;
  logs_path: string;
  subscription_path: string;
  update_interval_minutes: number;
  sources: string[];
  forced_ip: string;
  working_check_level: number;
  auto_update_major: boolean;
  auto_update_patch: boolean;
  auto_browser_open: boolean;
  /** Read-only here: managed via the polling endpoints, ignored by POST /api/set-config */
  paused_until: number;
  /** Managed from the system tray, ignored by POST /api/set-config */
  auto_start: boolean;
  /** Managed from the system tray, ignored by POST /api/set-config */
  notifications: boolean;
  /** Tray language: "auto", "ru" or "en". Managed from the system tray, ignored by POST /api/set-config */
  language: string;
}

/** Working check levels for AppConfig.working_check_level */
export type CheckLevel = 1 | 2;

/** Configs auto update state from GET /api/polling */
export interface PollingState {
  paused: boolean;
  /** Paused until resumed manually */
  forever: boolean;
  /** Unix time (seconds) when updates resume; 0 if not paused or paused forever */
  paused_until: number;
  /** 1 - ping test, 2 - sing-box core test */
  working_check_level: number;
}

export interface UpdaterState {
  status: 'checking' | 'available' | 'downloading' | 'installing' | 'reload' | 'up-to-date' | 'error';
  version: string;
  title: string;
  description: string;
  error: string;
  progress: number;
}

/**
 * Fetches live server statistics.
 * Endpoint: GET /api/statistics
 */
export async function fetchStatistics(): Promise<Statistics> {
  const res = await fetch('/api/statistics');
  if (!res.ok) throw new Error('Failed to fetch statistics');
  return res.json();
}

/**
 * Fetches the list of VLESS configurations.
 * Endpoint: GET /api/configs
 */
export async function fetchConfigs(country?: string, offset: number = 1, limit: number = 0): Promise<ConfigsResponse> {
  const params = new URLSearchParams();
  if (country) params.set('country', country);
  if (offset > 1) params.set('offset', offset.toString());
  if (limit > 0) params.set('limit', limit.toString());
  
  const res = await fetch(`/api/configs?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch configs');
  return res.json();
}

/**
 * Fetches the subscription link from the server.
 * Returns the raw text URL.
 * Endpoint: GET /api/subscription-link
 */
export async function fetchSubscriptionLink(): Promise<string> {
  const res = await fetch('/api/subscription-link');
  if (!res.ok) throw new Error('Failed to fetch subscription link');
  return res.text();
}

/**
 * Fetches the current application config.
 * Endpoint: GET /api/get-config
 */
export async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch('/api/get-config');
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}

/** Settings that were changed after the server started and only take effect after a restart */
export interface RestartState {
  required: boolean;
  /** JSON keys of the settings, e.g. "port" */
  fields: string[];
}

export type SaveResult =
  | { ok: true; restart: RestartState }
  | { ok: false; message: string };

/**
 * Saves updated application config to the server. The server validates it and rejects invalid values.
 * Endpoint: POST /api/set-config
 * @param config - The full config object to save
 * @param keepalive - Let the request finish even if the page is being closed
 */
export async function saveConfig(config: AppConfig, keepalive = false): Promise<SaveResult> {
  try {
    const res = await fetch('/api/set-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
      keepalive,
    });
    if (!res.ok) {
      const message = (await res.text()).trim();
      return { ok: false, message: message || `HTTP ${res.status}` };
    }
    return { ok: true, restart: await res.json() };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Fetches the settings that await a restart.
 * Endpoint: GET /api/restart-required
 */
export async function fetchRestartState(): Promise<RestartState> {
  const res = await fetch('/api/restart-required');
  if (!res.ok) throw new Error('Failed to fetch restart state');
  return res.json();
}

/**
 * Triggers a force update of VPN configs from all sources.
 * This will re-fetch, deduplicate, ping-test, and geo-format all configs.
 * Endpoint: GET /api/update-configs
 * @returns true if update succeeded
 */
export async function updateConfigs(): Promise<boolean> {
  const res = await fetch('/api/update-configs');
  return res.ok;
}

/**
 * Triggers a server restart.
 * The server process will terminate and re-launch itself.
 * Endpoint: GET /api/restart
 */
export async function restartServer(): Promise<void> {
  await fetch('/api/restart').catch(() => {
    // Expected: server will terminate the connection during restart
  });
}

/**
 * Fetches server logs as plain text.
 * Endpoint: GET /api/logs
 * @returns Raw log file contents
 */
export async function fetchLogs(): Promise<string> {
  const res = await fetch('/api/logs');
  if (!res.ok) throw new Error('Failed to fetch logs');
  return res.text();
}

/**
 * Extracts the base subscription URL from a full subscription link.
 * Removes trailing numeric segments like /15 or /10-30.
 * @param rawLink - Full subscription link from the API
 * @returns Base URL without limit/offset suffix
 */
export function parseBaseSubLink(rawLink: string): string {
  try {
    const url = new URL(rawLink);
    const parts = url.pathname.split('/');
    const lastPart = parts[parts.length - 1];
    if (/^\d+(-\d+)?$/.test(lastPart)) parts.pop();
    url.pathname = parts.join('/');
    let base = url.toString();
    if (base.endsWith('/')) base = base.slice(0, -1);
    return base;
  } catch {
    const parts = rawLink.split('/');
    const lastPart = parts[parts.length - 1];
    if (/^\d+(-\d+)?$/.test(lastPart)) parts.pop();
    return parts.join('/');
  }
}

export interface ParsedConfig {
  protocol: string;
  uuid: string;
  ip: string;
  port: string;
  params: URLSearchParams;
  name: string;
  flag: string;
  country: string;
  sequence: string;
}

export function parseVlessString(rawLink: string): ParsedConfig | null {
  try {
    const url = new URL(rawLink);
    const protocol = url.protocol.replace(':', '');
    const uuid = url.username;
    const ip = url.hostname;
    const port = url.port;
    const params = url.searchParams;
    const name = decodeURIComponent(url.hash.substring(1));
    
    // Extract flag, country, and sequence if possible
    // Example: "🇺🇸 United States — #1"
    let flag = '';
    let country = '';
    let sequence = '';
    
    const parts = name.split(' — ');
    if (parts.length === 2) {
      sequence = parts[1];
      const countryPart = parts[0];
      const match = countryPart.match(/^([\uD800-\uDBFF][\uDC00-\uDFFF]|\S+)\s+(.+)$/);
      if (match) {
        flag = match[1];
        country = match[2];
      } else {
        country = countryPart;
      }
    } else {
      country = name;
    }

    return { protocol, uuid, ip, port, params, name, flag, country, sequence };
  } catch {
    return null;
  }
}

export async function fetchUpdaterStatus(): Promise<UpdaterState> {
  const res = await fetch('/api/updater/status');
  if (!res.ok) throw new Error('Failed to fetch updater status');
  return res.json();
}

export async function triggerUpdaterDownload(): Promise<boolean> {
  const res = await fetch('/api/updater/download', { method: 'POST' });
  return res.ok;
}

async function pollingRequest(path: string, body?: object): Promise<PollingState> {
  const res = await fetch(path, body === undefined ? undefined : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Request to ${path} failed: ${res.status}`);
  return res.json();
}

/**
 * Fetches the configs auto update state (pause and working check level).
 * Endpoint: GET /api/polling
 */
export function fetchPollingState(): Promise<PollingState> {
  return pollingRequest('/api/polling');
}

/**
 * Pauses the configs auto update. Pass a number of minutes, or 'forever' to pause until resumed.
 * Endpoint: POST /api/polling/pause
 */
export function pauseUpdates(minutes: number | 'forever'): Promise<PollingState> {
  return pollingRequest('/api/polling/pause', minutes === 'forever' ? { forever: true } : { minutes });
}

/**
 * Resumes the configs auto update (an update starts right away).
 * Endpoint: POST /api/polling/resume
 */
export function resumeUpdates(): Promise<PollingState> {
  return pollingRequest('/api/polling/resume', {});
}

/**
 * Changes the working check level. Applies from the next update.
 * Endpoint: POST /api/polling/check-level
 */
export function setCheckLevel(level: CheckLevel): Promise<PollingState> {
  return pollingRequest('/api/polling/check-level', { level });
}
