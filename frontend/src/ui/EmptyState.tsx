import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  tone?: 'neutral' | 'danger';
}

/** What to show when there is nothing to show — or something went wrong — and what to do next. */
export default function EmptyState({ icon, title, children, action, tone = 'neutral' }: EmptyStateProps) {
  return (
    <div className="flex animate-enter flex-col items-center justify-center px-6 py-12 text-center" role={tone === 'danger' ? 'alert' : undefined}>
      <div className={`mb-4 flex size-12 items-center justify-center rounded-lg ${tone === 'danger' ? 'bg-danger-soft text-danger-text' : 'bg-raised text-fg-2'}`}>
        {icon}
      </div>
      <p className="text-base font-semibold text-fg">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-fg-2">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
