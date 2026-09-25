import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AnimatePresence, m } from 'motion/react';
import { ArrowDown, FileText, TriangleAlert } from 'lucide-react';
import { useTranslation } from '../i18n';
import { fetchLogs } from '../api';
import { popVariants, spring } from '../motion/presets';
import EmptyState from '../ui/EmptyState';
import Skeleton from '../ui/Skeleton';

const POLL_INTERVAL = 3000;
const LINE_HEIGHT = 22;

interface LogEntry {
  time?: string;
  level?: string;
  message: string;
  fields: [string, string][];
}

/** Parses a zap JSON line; other lines are shown as they are. */
function parseLine(line: string): LogEntry {
  if (line.trimStart().startsWith('{')) {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      return {
        time: typeof obj.ts === 'number' ? new Date(obj.ts * 1000).toLocaleTimeString() : undefined,
        level: typeof obj.level === 'string' ? obj.level.toLowerCase() : undefined,
        message: typeof obj.msg === 'string' ? obj.msg : line,
        fields: Object.entries(obj)
          .filter(([key]) => !['level', 'ts', 'msg', 'caller'].includes(key))
          .map(([key, value]) => [key, JSON.stringify(value)]),
      };
    } catch {
      // Not JSON after all
    }
  }

  const level = /error|fail|fatal/i.test(line) ? 'error' : /warn/i.test(line) ? 'warn' : undefined;
  return { level, message: line, fields: [] };
}

const levelClass = (level?: string) =>
  level === 'error' || level === 'fatal' || level === 'panic' ? 'text-danger-text'
    : level === 'warn' ? 'text-warn-text'
      : level === 'debug' ? 'text-fg-3'
        : 'text-success-text';

/** One log line; parsed only when it is rendered, i.e. when it is in view. */
const LogLine = memo(function LogLine({ line }: { line: string }) {
  const entry = useMemo(() => parseLine(line), [line]);

  return (
    <div className="flex flex-wrap gap-x-3 px-4 py-px hover:bg-raised">
      {entry.time && <span className="shrink-0 text-fg-3">{entry.time}</span>}
      {entry.level && <span className={`w-12 shrink-0 font-semibold uppercase ${levelClass(entry.level)}`}>{entry.level}</span>}
      <span className="min-w-0 break-words text-fg">{entry.message}</span>
      {entry.fields.map(([key, value]) => (
        <span key={key} className="min-w-0 break-all text-fg-3">
          {key}=<span className="text-fg-2">{value}</span>
        </span>
      ))}
    </div>
  );
});

export default function LogsView() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasAtBottom = useRef(true);

  const lines = useMemo(() => {
    const all = logs.split('\n');
    return all[all.length - 1] === '' ? all.slice(0, -1) : all;
  }, [logs]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => LINE_HEIGHT,
    overscan: 12,
  });

  const checkIfAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 40;
    wasAtBottom.current = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
    setAtBottom(wasAtBottom.current);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (lines.length) virtualizer.scrollToIndex(lines.length - 1, { align: 'end' });
  }, [lines.length, virtualizer]);

  const loadLogs = useCallback(async () => {
    try {
      const text = await fetchLogs();
      setLogs(text);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    wasAtBottom.current = true;
    loadLogs();
    const iv = setInterval(loadLogs, POLL_INTERVAL);
    return () => clearInterval(iv);
  }, [loadLogs]);

  // Follow new lines while the reader is at the end
  useEffect(() => {
    if (wasAtBottom.current) requestAnimationFrame(scrollToBottom);
  }, [lines.length, scrollToBottom]);

  const empty = !loading && !error && !logs.trim();

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-8 sm:py-8">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-sunken shadow-xs">
        {loading ? (
          <div className="space-y-3 p-4" aria-busy="true" aria-label={t('logs.loading')}>
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-3" />)}
          </div>
        ) : error && !logs ? (
          <EmptyState tone="danger" icon={<TriangleAlert className="size-5" aria-hidden="true" />} title={t('logs.error')}>
            {t('common.loadError')}
          </EmptyState>
        ) : empty ? (
          <EmptyState icon={<FileText className="size-5" aria-hidden="true" />} title={t('logs.empty')} />
        ) : (
          <div
            ref={scrollRef}
            onScroll={checkIfAtBottom}
            role="log"
            aria-label={t('logs.title')}
            tabIndex={0}
            className="min-h-0 flex-1 overflow-y-auto py-3 font-mono text-[12.5px] leading-[1.375rem] select-text focus-visible:-outline-offset-2"
          >
            <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map(item => (
                <div
                  key={item.key}
                  data-index={item.index}
                  ref={virtualizer.measureElement}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <LogLine line={lines[item.index]} />
                </div>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {!atBottom && !loading && (
            <m.button
              key="latest"
              type="button"
              variants={popVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={spring.snappy}
              onClick={() => {
                wasAtBottom.current = true;
                setAtBottom(true);
                scrollToBottom();
              }}
              className="press absolute bottom-4 right-4 flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-medium text-fg shadow-md cursor-pointer hover:bg-raised"
            >
              <ArrowDown className="size-4" aria-hidden="true" />
              {t('logs.jumpLatest')}
            </m.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
