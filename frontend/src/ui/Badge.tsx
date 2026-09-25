import type { HTMLAttributes, ReactNode } from 'react';

export type Tone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger';

const tones: Record<Tone, string> = {
  neutral: 'bg-raised text-fg-2 border-line',
  accent: 'bg-accent-soft text-accent-text border-transparent',
  success: 'bg-success-soft text-success-text border-transparent',
  warn: 'bg-warn-soft text-warn-text border-transparent',
  danger: 'bg-danger-soft text-danger-text border-transparent',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  icon?: ReactNode;
}

/** A short status label. */
export default function Badge({ tone = 'neutral', icon, className = '', children, ...rest }: BadgeProps) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 text-xs font-medium tabular-nums whitespace-nowrap ${tones[tone]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}
