import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  /** Controls placed on the right of the title */
  action?: ReactNode;
  children?: ReactNode;
}

/** A surface for a group of related content. Titled cards are sections with a heading. */
export default function Card({ title, description, action, children, className = '', ...rest }: CardProps) {
  return (
    <section className={`rounded-lg border border-line bg-surface shadow-xs ${className}`} {...rest}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-fg">{title}</h2>}
            {description && <p className="mt-1 text-sm text-fg-2">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}
