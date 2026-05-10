import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '../i18n';
import { fetchLogs } from '../api';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Interval in ms between automatic log refreshes */
const POLL_INTERVAL = 3000;

/**
 * Modal window for viewing live server logs.
 * Auto-refreshes every 3 seconds while open.
 * Auto-scrolls to the bottom when new logs arrive.
 */
export default function LogsModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLPreElement>(null);
  const wasAtBottom = useRef(true);

  /** Checks if the user has scrolled to the bottom of the log container */
  const checkIfAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 40;
    wasAtBottom.current = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
  }, []);

  /** Scrolls the log container to the very bottom */
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  /** Fetches logs from the backend and updates state */
  const loadLogs = useCallback(async () => {
    try {
      const text = await fetchLogs();
      setLogs(text);
      setError(false);

      // Auto-scroll only if user was already at the bottom
      if (wasAtBottom.current) {
        requestAnimationFrame(scrollToBottom);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [scrollToBottom]);

  /** Initial load + polling while modal is open */
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(false);
    setLogs('');
    wasAtBottom.current = true;

    loadLogs();
    const iv = setInterval(loadLogs, POLL_INTERVAL);
    return () => clearInterval(iv);
  }, [open, loadLogs]);

  if (!open) return null;

  /** Colorize log lines based on content keywords */
  const formatLine = (line: string, idx: number) => {
    let color = 'text-[var(--color-text-primary)]';

    if (/error|fail|fatal/i.test(line)) {
      color = 'text-red-400';
    } else if (/warn/i.test(line)) {
      color = 'text-amber-400';
    } else if (/success|done|started|updated/i.test(line)) {
      color = 'text-emerald-400';
    } else if (/\d{4}\/\d{2}\/\d{2}/.test(line)) {
      // Lines starting with timestamp get muted timestamp, normal text
      const match = line.match(/^(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})\s*(.*)/);
      if (match) {
        return (
          <span key={idx}>
            <span className="text-[var(--color-text-muted)]">{match[1]}</span>
            {' '}
            <span className="text-[var(--color-text-primary)]">{match[2]}</span>
          </span>
        );
      }
    }

    return <span key={idx} className={color}>{line}</span>;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-bg-card)] border border-[var(--color-glass-border)] rounded-2xl
                    w-[94%] max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] m-0">
              {t('logs.title')}
            </h2>
            {/* Live indicator dot */}
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          </div>
          <button
            id="logs-close-btn"
            onClick={onClose}
            className="bg-transparent border-none text-[var(--color-text-muted)] text-xl cursor-pointer
                       hover:text-[var(--color-text-primary)] transition-colors p-1"
          >
            ✕
          </button>
        </div>

        {/* Log content area */}
        <pre
          ref={scrollRef}
          onScroll={checkIfAtBottom}
          className="flex-1 overflow-y-auto px-5 py-4 m-0 text-[13px] leading-6 font-mono
                     bg-[var(--color-bg-input)] whitespace-pre-wrap break-all select-text"
        >
          {loading ? (
            <span className="text-[var(--color-text-muted)] animate-pulse-glow">{t('logs.loading')}</span>
          ) : error ? (
            <span className="text-red-400">{t('logs.error')}</span>
          ) : !logs.trim() ? (
            <span className="text-[var(--color-text-muted)]">{t('logs.empty')}</span>
          ) : (
            logs.split('\n').map((line, i) => (
              <div key={i} className="hover:bg-white/[0.03] px-1 -mx-1 rounded">
                {formatLine(line, i)}
              </div>
            ))
          )}
        </pre>
      </div>
    </div>
  );
}
