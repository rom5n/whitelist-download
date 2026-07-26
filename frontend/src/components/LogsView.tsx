import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '../i18n';
import { fetchLogs } from '../api';

const POLL_INTERVAL = 3000;

export default function LogsView() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLPreElement>(null);
  const wasAtBottom = useRef(true);

  const checkIfAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 40;
    wasAtBottom.current = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const text = await fetchLogs();
      setLogs(text);
      setError(false);

      if (wasAtBottom.current) {
        requestAnimationFrame(scrollToBottom);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [scrollToBottom]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);
    setLogs('');
    wasAtBottom.current = true;

    loadLogs();
    const iv = setInterval(loadLogs, POLL_INTERVAL);
    return () => clearInterval(iv);
  }, [loadLogs]);

  const formatLine = (line: string, idx: number) => {
    try {
      if (line.trim().startsWith('{')) {
        const obj = JSON.parse(line);
        const lvl = (obj.level || '').toLowerCase();
        const levelColor = lvl === 'error' || lvl === 'fatal' ? 'text-red-400' 
                         : lvl === 'warn' ? 'text-amber-400' 
                         : 'text-emerald-400';
        const dateStr = obj.ts ? new Date(obj.ts * 1000).toLocaleTimeString() : '';
        
        return (
          <div key={idx} className="flex flex-wrap gap-2 items-start py-0.5">
            {dateStr && <span className="text-gray-500 shrink-0">{dateStr}</span>}
            {lvl && <span className={`uppercase font-bold ${levelColor} shrink-0`}>[{lvl}]</span>}
            <span className="text-gray-200 break-words">{obj.msg || line}</span>
            {Object.keys(obj).filter(k => !['level', 'ts', 'msg', 'caller'].includes(k)).map(k => (
              <span key={k} className="text-xs text-gray-400 break-all bg-white/5 px-1 rounded">
                {k}={JSON.stringify(obj[k])}
              </span>
            ))}
          </div>
        );
      }
    } catch {
      // ignore
    }

    let color = 'text-gray-200';
    if (/error|fail|fatal/i.test(line)) {
      color = 'text-red-400';
    } else if (/warn/i.test(line)) {
      color = 'text-amber-400';
    } else if (/success|done|started|updated/i.test(line)) {
      color = 'text-emerald-400';
    }

    return <span key={idx} className={color}>{line}</span>;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--color-bg-primary)] p-6 md:p-10 relative">
      <div className="w-full h-full flex flex-col animate-[fade-in_0.3s_ease-out]">

        <div className="flex-1 flex flex-col overflow-hidden">
          <pre
            ref={scrollRef}
            onScroll={checkIfAtBottom}
            className="flex-1 overflow-y-auto p-6 m-0 text-sm leading-7 font-mono
                       bg-[#0a0a0f] text-[#f0f0f5] whitespace-pre-wrap break-all select-text custom-scrollbar"
          >
            {loading ? (
              <span className="text-[var(--color-text-muted)] animate-pulse-glow">{t('logs.loading')}</span>
            ) : error ? (
              <span className="text-red-400">{t('logs.error')}</span>
            ) : !logs.trim() ? (
              <span className="text-[var(--color-text-muted)]">{t('logs.empty')}</span>
            ) : (
              logs.split('\n').map((line, i) => (
                <div key={i} className="hover:bg-white/[0.04] px-2 -mx-2 rounded transition-colors duration-150">
                  {formatLine(line, i)}
                </div>
              ))
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
