import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name; also shown as a tooltip */
  label: string;
  children: ReactNode;
  active?: boolean;
  tooltip?: 'bottom' | 'top' | 'none';
  /** Align the tooltip with the button's end, for buttons at the right edge of the screen */
  tooltipAlign?: 'center' | 'end';
}

/** A 44×44 icon button with an accessible name and a quiet tooltip for pointer and keyboard users. */
export default function IconButton({ label, children, active = false, tooltip = 'bottom', tooltipAlign = 'center', className = '', type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={`press group relative inline-flex size-11 shrink-0 items-center justify-center rounded-md cursor-pointer
                  disabled:cursor-not-allowed disabled:opacity-50
                  ${active ? 'text-accent-text bg-accent-soft' : 'text-fg-2 hover:text-fg hover:bg-raised'} ${className}`}
      {...rest}
    >
      {children}
      {tooltip !== 'none' && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute z-50 whitespace-nowrap ${tooltipAlign === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2'} rounded-sm bg-fg px-2 py-1 text-xs font-medium text-bg
                      opacity-0 transition-[opacity,transform] duration-150 ease-out
                      group-hover:opacity-100 group-hover:delay-500 group-focus-visible:opacity-100 group-focus-visible:delay-0
                      ${tooltip === 'bottom' ? 'top-full mt-1.5 translate-y-[-2px] group-hover:translate-y-0' : 'bottom-full mb-1.5 translate-y-[2px] group-hover:translate-y-0'}
                      hidden [@media(hover:hover)]:block`}
        >
          {label}
        </span>
      )}
    </button>
  );
}
