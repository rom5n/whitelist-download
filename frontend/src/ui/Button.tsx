import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Spinner from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg shadow-sm hover:bg-accent-hover',
  secondary: 'bg-surface text-fg border border-line shadow-xs hover:border-line-strong hover:bg-raised',
  ghost: 'text-fg-2 hover:text-fg hover:bg-raised',
  danger: 'bg-danger-soft text-danger-text hover:bg-danger hover:text-accent-fg',
};

const sizes: Record<ButtonSize, string> = {
  md: 'h-11 px-4 gap-2 text-sm rounded-md',
  // Visually compact, but the touch target is still 44px tall thanks to the ::before layer
  sm: 'h-9 px-3 gap-1.5 text-sm rounded-sm before:absolute before:-inset-y-1 before:inset-x-0',
};

/** The base button: every variant reacts to hover, press, keyboard focus, disabled and loading. */
export default function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`press relative inline-flex items-center justify-center font-medium whitespace-nowrap select-none cursor-pointer
                  disabled:cursor-not-allowed disabled:opacity-50 ${loading ? 'disabled:opacity-80' : ''}
                  ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}
