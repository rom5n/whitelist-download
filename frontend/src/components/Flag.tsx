import { flagUrl } from '../flags';

type FlagSize = 'sm' | 'md' | 'lg';

interface FlagProps {
  /** ISO 3166-1 alpha-2 code */
  code: string | null | undefined;
  /** Accessible name, usually the country name */
  label?: string;
  size?: FlagSize;
}

const sizeClasses: Record<FlagSize, string> = {
  sm: 'w-5 h-[15px] text-[9px]',
  md: 'w-7 h-[21px] text-[10px]',
  lg: 'w-12 h-9 text-sm',
};

/**
 * Country flag rendered from a local SVG.
 * Falls back to the text code (or "?") when there is no flag for the code.
 */
export default function Flag({ code, label, size = 'md' }: FlagProps) {
  const url = flagUrl(code);
  const sizeCls = sizeClasses[size];

  if (url) {
    return (
      <img
        src={url}
        alt={label ?? code ?? ''}
        title={label}
        loading="lazy"
        decoding="async"
        draggable={false}
        className={`flag-img ${sizeCls}`}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={label ?? code ?? '?'}
      title={label}
      className={`${sizeCls} inline-flex items-center justify-center shrink-0 rounded-[0.2rem] font-bold tracking-wide bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] border border-[var(--color-border)]`}
    >
      {code ? code.toUpperCase() : '?'}
    </span>
  );
}
