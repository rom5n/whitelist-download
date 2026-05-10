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

/**
 * Saves updated application config to the server.
 * Endpoint: POST /api/set-config
 * @param config - The full config object to save
 * @returns true if save succeeded
 */
export async function saveConfig(config: AppConfig): Promise<boolean> {
  const res = await fetch('/api/set-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.ok;
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
