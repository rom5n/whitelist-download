import { m } from 'motion/react';
import { useTranslation } from '../i18n';
import { navItems, type Mode } from '../navigation';
import { spring } from '../motion/presets';

interface NavTabsProps {
  mode: Mode;
  onNavigate: (mode: Mode) => void;
  /** Dots next to sections that need attention (e.g. updates are paused) */
  attention?: Partial<Record<Mode, boolean>>;
}

/** Top navigation on wide screens: the active pill slides between tabs (a layout animation, transform only). */
export function NavTabs({ mode, onNavigate, attention = {} }: NavTabsProps) {
  const { t } = useTranslation();

  return (
    <nav aria-label={t('nav.main')} className="hidden md:block">
      <ul className="flex items-center gap-1 rounded-md border border-line bg-surface p-1 shadow-xs">
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
                    className="absolute inset-0 rounded-sm bg-raised shadow-sm"
                    aria-hidden="true"
                  />
                )}
                <Icon className="relative size-4" aria-hidden="true" />
                <span className="relative">{t(labelKey)}</span>
                {attention[itemMode] && <span className="relative size-1.5 rounded-full bg-warn" aria-hidden="true" />}
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
      className="shrink-0 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] md:hidden"
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
                  {attention[itemMode] && <span className="absolute right-3 top-0.5 size-1.5 rounded-full bg-warn" aria-hidden="true" />}
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
