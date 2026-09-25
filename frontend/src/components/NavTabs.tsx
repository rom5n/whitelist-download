import { m } from 'motion/react';
import { useTranslation } from '../i18n';
import { navItems, type Attention, type Mode } from '../navigation';
import { spring } from '../motion/presets';

interface NavTabsProps {
  mode: Mode;
  onNavigate: (mode: Mode) => void;
  /** Dots next to sections where something runs or needs the user (e.g. saving, a restart, a pause) */
  attention?: Partial<Record<Mode, Attention>>;
}

/**
 * The small dot of a section: lights up (pops in) when something happens there. `busy` is an accent dot that
 * sends out rings while it lasts, `action` a still warning dot. The meaning is also told to screen readers.
 */
function AttentionDot({ kind, className = '' }: { kind: Attention; className?: string }) {
  const { t } = useTranslation();

  return (
    <span key={kind} className={`relative flex size-2 animate-pop ${className}`}>
      {kind === 'busy' && (
        <span aria-hidden="true" className="absolute inset-0 animate-[ring-out_1.4s_var(--ease-out)_infinite] rounded-full bg-accent" />
      )}
      <span aria-hidden="true" className={`relative size-2 rounded-full ${kind === 'busy' ? 'bg-accent' : 'bg-warn'}`} />
      <span className="sr-only">{t(kind === 'busy' ? 'nav.busy' : 'nav.action')}</span>
    </span>
  );
}

/** Top navigation on wide screens: the active pill slides between tabs (a layout animation, transform only). */
export function NavTabs({ mode, onNavigate, attention = {} }: NavTabsProps) {
  const { t } = useTranslation();

  return (
    <nav aria-label={t('nav.main')} className="hidden md:block">
      <ul className="flex items-center gap-1 rounded-md bg-bg p-1">
        {navItems.map(({ mode: itemMode, labelKey, icon: Icon }) => {
          const active = mode === itemMode;
          return (
            <li key={itemMode}>
              <button
                type="button"
                onClick={() => onNavigate(itemMode)}
                aria-current={active ? 'page' : undefined}
                className={`press relative flex h-9 items-center gap-2 rounded-sm px-3 text-sm font-medium cursor-pointer
                            before:absolute before:-inset-y-1 before:inset-x-0
                            ${active ? 'text-fg' : 'text-fg-2 hover:text-fg'}`}
              >
                {active && (
                  <m.span
                    layoutId="nav-pill"
                    transition={spring.snappy}
                    className="absolute inset-0 rounded-sm bg-tab shadow-sm"
                    aria-hidden="true"
                  />
                )}
                {/* Icons join the labels once there is room for both */}
                <Icon className="relative hidden size-4 lg:block" aria-hidden="true" />
                <span className="relative">{t(labelKey)}</span>
                {attention[itemMode] && <AttentionDot kind={attention[itemMode]} />}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Bottom tab bar on phones: within thumb reach, 64px tall targets. */
export function BottomTabs({ mode, onNavigate, attention = {} }: NavTabsProps) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t('nav.main')}
      className="shrink-0 bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-4">
        {navItems.map(({ mode: itemMode, labelKey, icon: Icon }) => {
          const active = mode === itemMode;
          return (
            <li key={itemMode}>
              <button
                type="button"
                onClick={() => onNavigate(itemMode)}
                aria-current={active ? 'page' : undefined}
                className={`press flex h-16 w-full flex-col items-center justify-center gap-1 text-xs font-medium cursor-pointer
                            ${active ? 'text-accent-text' : 'text-fg-2'}`}
              >
                <span className="relative flex h-7 w-14 items-center justify-center">
                  {active && (
                    <m.span
                      layoutId="tab-pill"
                      transition={spring.snappy}
                      className="absolute inset-0 rounded-full bg-accent-soft"
                      aria-hidden="true"
                    />
                  )}
                  <Icon className="relative size-5" aria-hidden="true" />
                  {attention[itemMode] && <AttentionDot kind={attention[itemMode]} className="absolute! right-3 top-0.5" />}
                </span>
                {t(labelKey)}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
