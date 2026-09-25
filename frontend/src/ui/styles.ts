export type FieldTone = 'default' | 'error' | 'warn';

/** Classes of a text input in each state; shared by Field and inputs that are not wrapped in one. */
export const inputClass = (tone: FieldTone, mono = false) =>
  `h-11 w-full rounded-md border bg-sunken px-3.5 text-sm text-fg placeholder:text-fg-3 outline-none
   transition-[border-color,box-shadow,background-color] duration-150 ease-out
   ${mono ? 'font-mono text-[13px]' : ''}
   ${tone === 'error'
    ? 'border-danger/70 shadow-[0_0_0_3px_var(--danger-soft)]'
    : tone === 'warn'
      ? 'border-warn/70 shadow-[0_0_0_3px_var(--warn-soft)]'
      : 'border-line hover:border-line-strong focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]'}
   focus-visible:outline-none disabled:opacity-60`;
