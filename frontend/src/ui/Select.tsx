import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Check, ChevronDown } from 'lucide-react';
import { fade } from '../motion/presets';
import { useScrollFade } from '../useScrollFade';
import Spinner from './Spinner';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** A quiet note on the right, e.g. a count */
  hint?: ReactNode;
}

interface SelectProps<T extends string> {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  /** Shows a loading label with a spinner and keeps the field disabled */
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  /** Error or hint under the field */
  note?: ReactNode;
  className?: string;
}

/**
 * A select with rich options (flags, counts), following the WAI-ARIA "select-only combobox" pattern:
 * focus stays on the button, arrows move through the options, Enter/Space picks, Escape closes,
 * typing jumps to an option by its first letters.
 */
export default function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  loading = false,
  loadingLabel,
  disabled = false,
  note,
  className = '',
}: SelectProps<T>) {
  const id = useId();
  const listId = `${id}-list`;
  const labelId = `${id}-label`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const fadeRef = useScrollFade<HTMLUListElement>();
  const typed = useRef({ text: '', time: 0 });
  const setListRef = useCallback((element: HTMLUListElement | null) => {
    listRef.current = element;
    return fadeRef(element);
  }, [fadeRef]);

  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));
  const selected = options[selectedIndex];
  const inactive = disabled || loading;

  const openList = () => {
    if (inactive) return;
    setActive(selectedIndex);
    setOpen(true);
  };

  const pick = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  };

  // Close on a click outside
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Keep the active option in view
  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const typeahead = (char: string) => {
    const now = Date.now();
    const text = (now - typed.current.time < 700 ? typed.current.text : '') + char.toLowerCase();
    typed.current = { text, time: now };
    const start = open ? active : selectedIndex;
    const order = [...options.keys()].map(i => (start + (text.length === 1 ? 1 : 0) + i) % options.length);
    const match = order.find(i => options[i].label.toLowerCase().startsWith(text));
    if (match === undefined) return;
    if (open) setActive(match);
    else onChange(options[match].value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (inactive) return;
    const last = options.length - 1;

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        openList();
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        typeahead(event.key);
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive(i => Math.min(last, i + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (event.altKey) pick(active);
        else setActive(i => Math.max(0, i - 1));
        break;
      case 'Home':
      case 'PageUp':
        event.preventDefault();
        setActive(0);
        break;
      case 'End':
      case 'PageDown':
        event.preventDefault();
        setActive(last);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        pick(active);
        break;
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        pick(active);
        break;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) typeahead(event.key);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <span id={labelId} className="mb-2 block text-sm font-medium text-fg-2">{label}</span>
      <button
        type="button"
        role="combobox"
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        aria-busy={loading || undefined}
        disabled={inactive}
        onClick={event => {
          // Safari does not focus buttons on click, and the keyboard needs the focus here
          event.currentTarget.focus();
          if (open) setOpen(false);
          else openList();
        }}
        onKeyDown={onKeyDown}
        className={`flex h-11 w-full items-center gap-2.5 rounded-md border bg-sunken px-3.5 text-left text-sm text-fg cursor-pointer
                    transition-[border-color,box-shadow] duration-150 ease-out focus-visible:outline-none
                    disabled:cursor-not-allowed disabled:opacity-70
                    ${open ? 'border-accent shadow-[0_0_0_3px_var(--accent-soft)]' : 'border-line hover:border-line-strong focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]'}`}
      >
        {loading ? (
          <span className="flex min-w-0 flex-1 items-center gap-2.5 text-fg-3">
            <Spinner className="size-4" />
            {loadingLabel}
          </span>
        ) : (
          <>
            {selected?.icon}
            <span className="min-w-0 flex-1 truncate">{selected?.label}</span>
            {selected?.hint !== undefined && <span className="shrink-0 text-xs tabular-nums text-fg-3">{selected.hint}</span>}
          </>
        )}
        <ChevronDown
          className={`size-4 shrink-0 text-fg-3 transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            key="list"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={fade}
            className="absolute inset-x-0 top-full z-30 mt-1.5 origin-top rounded-md border border-line bg-surface shadow-lg"
          >
            <ul
              ref={setListRef}
              id={listId}
              role="listbox"
              aria-labelledby={labelId}
              className="scroll-fade max-h-72 overflow-y-auto p-1"
            >
              {options.map((option, index) => (
                <li
                  key={option.value}
                  id={`${id}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={index === selectedIndex}
                  onPointerMove={() => setActive(index)}
                  onClick={() => pick(index)}
                  className={`flex h-11 items-center gap-2.5 rounded-sm px-2.5 text-sm cursor-pointer
                              ${index === active ? 'bg-raised text-fg' : 'text-fg-2'}`}
                >
                  {option.icon}
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.hint !== undefined && <span className="shrink-0 text-xs tabular-nums text-fg-3">{option.hint}</span>}
                  <Check className={`size-4 shrink-0 text-accent-text ${index === selectedIndex ? '' : 'invisible'}`} aria-hidden="true" />
                </li>
              ))}
            </ul>
          </m.div>
        )}
      </AnimatePresence>

      {note}
    </div>
  );
}
