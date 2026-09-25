import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface SegmentOption<T extends string | number> {
  value: T;
  label: ReactNode;
}

interface SegmentedControlProps<T extends string | number> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
}

/**
 * A choice between a few options. The thumb slides with a spring (transform only);
 * arrow keys move the choice like in a native radio group.
 */
export default function SegmentedControl<T extends string | number>({ options, value, onChange, label, disabled = false }: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, options.findIndex(option => option.value === value));

  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="relative inline-grid rounded-md border border-line bg-sunken p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 rounded-sm border border-line bg-surface shadow-sm transition-transform duration-[400ms] ease-spring"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((option, i) => {
        const selected = i === index;
        return (
          <button
            key={String(option.value)}
            ref={el => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`press relative z-10 h-9 min-w-24 rounded-sm px-4 text-sm font-medium cursor-pointer disabled:cursor-not-allowed
                        before:absolute before:-inset-y-1 before:inset-x-0
                        ${selected ? 'text-fg' : 'text-fg-2 hover:text-fg'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
