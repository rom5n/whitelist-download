/** Formats a remaining time in seconds as "1h 12m", "12m 30s" or "30s". */
export function formatRemaining(totalSeconds: number): string {
  const diff = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Formats a Unix time (seconds) as a local clock time ("18:30"),
 * with the date ("Sep 26, 18:30") when it is not today.
 */
export function formatClock(unixSeconds: number, nowMs: number): string {
  const date = new Date(unixSeconds * 1000);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (date.toDateString() === new Date(nowMs).toDateString()) return time;
  return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`;
}
