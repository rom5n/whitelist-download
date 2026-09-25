import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from '../i18n';
import type { LoadStatus } from '../hooks/useStatistics';
import Flag from './Flag';
import FadeScroll from './FadeScroll';
import Spinner from './Spinner';

export interface CountryOption {
  name: string;
  code: string | null;
  count: number;
}

interface CountrySelectProps {
  options: CountryOption[];
  /** null means "all countries" */
  value: string | null;
  onChange: (country: string | null) => void;
  status: LoadStatus;
  onRetry: () => void;
  totalCount: number;
  labelId?: string;
}

const ALL = '__all__';
/** Height of the open list (max-h-72) plus its offset; opens upwards when there's less room below */
const POPUP_SPACE_PX = 300;

/**
 * Country picker with SVG flags (a native <select> can't show images).
 * Disabled with a "Loading…" label until countries are known; shows an error with a retry button on failure.
 */
export default function CountrySelect({ options, value, onChange, status, onRetry, totalCount, labelId }: CountrySelectProps) {
  const { t } = useTranslation();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropUp, setDropUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const items: { key: string; name: string; code: string | null; count: number; value: string | null }[] = [
    { key: ALL, name: t('country.all'), code: null, count: totalCount, value: null },
    ...options.map(o => ({ key: o.name, name: o.name, code: o.code, count: o.count, value: o.name })),
  ];
  const selected = items.find(item => item.value === value) ?? items[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const openList = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < POPUP_SPACE_PX && rect.top > spaceBelow);
    }
    setActiveIndex(Math.max(0, items.indexOf(selected)));
    setOpen(true);
  };

  const choose = (index: number) => {
    onChange(items[index].value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const last = items.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(last, activeIndex + 1),
      ArrowUp: Math.max(0, activeIndex - 1),
      Home: 0,
      End: last,
      PageDown: Math.min(last, activeIndex + 8),
      PageUp: Math.max(0, activeIndex - 8),
    };
    if (e.key in moves) {
      e.preventDefault();
      setActiveIndex(moves[e.key]);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(activeIndex);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false);
      if (e.key === 'Escape') buttonRef.current?.focus();
    } else if (e.key.length === 1) {
      // Type-ahead by the first letter
      const letter = e.key.toLowerCase();
      const start = activeIndex + 1;
      const match = [...items.slice(start), ...items.slice(0, start)].find(item => item.name.toLowerCase().startsWith(letter));
      if (match) setActiveIndex(items.indexOf(match));
    }
  };

  const fieldCls = 'w-full min-h-12 px-4 py-3 rounded-xl text-sm border bg-[var(--color-bg-input)] flex items-center gap-3 text-left';

  if (status === 'error') {
    return (
      <div role="alert" className={`${fieldCls} border-danger/40 bg-danger/5 justify-between`}>
        <span className="text-danger">{t('country.error')}</span>
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 px-3 py-1 rounded-lg text-sm font-medium text-accent hover:bg-accent/10 cursor-pointer transition-colors"
        >
          {t('country.retry')}
        </button>
      </div>
    );
  }

  const isLoading = status === 'loading';
  const isEmpty = !isLoading && options.length === 0;
  const disabled = isLoading || isEmpty;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={labelId}
        aria-busy={isLoading}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={e => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            openList();
          }
        }}
        className={`${fieldCls} border-[var(--color-border)] transition-colors ${
          disabled
            ? 'cursor-not-allowed text-[var(--color-text-muted)]'
            : 'cursor-pointer text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)] focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20'
        }`}
      >
        {isLoading ? (
          <>
            <Spinner />
            <span>{t('country.loading')}</span>
          </>
        ) : isEmpty ? (
          <span>{t('country.empty')}</span>
        ) : (
          <>
            <OptionIcon code={selected.code} name={selected.name} isAll={selected.value === null} />
            <span className="flex-1 truncate">{selected.name}</span>
            <span className="text-xs text-[var(--color-text-muted)] tabular-nums">{selected.count}</span>
          </>
        )}
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className={`w-4 h-4 shrink-0 text-[var(--color-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`}>
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className={`absolute z-30 w-full ${dropUp ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
        <div className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-xl animate-[fade-in_0.12s_ease-out] overflow-hidden">
          <FadeScroll className="max-h-72">
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-labelledby={labelId}
              aria-activedescendant={`${listId}-${activeIndex}`}
              onKeyDown={onListKeyDown}
              className="py-1 outline-none"
            >
              {items.map((item, index) => {
                const isSelected = item === selected;
                return (
                  <li
                    key={item.key}
                    id={`${listId}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    onPointerEnter={() => setActiveIndex(index)}
                    onClick={() => choose(index)}
                    className={`mx-1 px-3 py-2 rounded-lg flex items-center gap-3 text-sm cursor-pointer ${
                      index === activeIndex ? 'bg-accent/10' : ''
                    } ${isSelected ? 'text-accent font-semibold' : 'text-[var(--color-text-primary)]'}`}
                  >
                    <OptionIcon code={item.code} name={item.name} isAll={item.value === null} />
                    <span className="flex-1 truncate">{item.name}</span>
                    <span className="text-xs text-[var(--color-text-muted)] tabular-nums">{item.count}</span>
                  </li>
                );
              })}
            </ul>
          </FadeScroll>
        </div>
        </div>
      )}
    </div>
  );
}

function OptionIcon({ code, name, isAll }: { code: string | null; name: string; isAll: boolean }) {
  if (isAll) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="w-5 h-5 shrink-0 text-accent">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" strokeLinecap="round" />
      </svg>
    );
  }
  return <Flag code={code} label={name} size="sm" />;
}
