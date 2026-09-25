import type { ReactNode } from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

/** An on/off setting. The whole row is the target; the knob moves on a spring. */
export default function Switch({ checked, onChange, label, description, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group flex min-h-11 w-full items-center justify-between gap-4 rounded-md py-2 text-left cursor-pointer
                 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-fg-3">{description}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors duration-200 ease-out
                    ${checked ? 'border-accent bg-accent' : 'border-line-strong bg-raised group-hover:border-fg-3'}`}
      >
        <span
          className={`absolute left-0.5 size-[18px] rounded-full bg-white shadow-sm transition-transform duration-300 ease-spring
                      group-active:scale-90 ${checked ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </span>
    </button>
  );
}
