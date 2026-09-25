import { memo, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { CircleArrowUp, Heart, Moon, Pause, Play, RotateCw, Star, Sun, TriangleAlert } from 'lucide-react';
import type { UpdaterState } from '../api';
import { useTranslation } from '../i18n';
import { useTheme } from '../ThemeContext';
import type { Attention, Mode } from '../navigation';
import { popVariants, spring } from '../motion/presets';
import IconButton from '../ui/IconButton';
import Spinner from '../ui/Spinner';
import GithubIcon from '../ui/GithubIcon';
import { NavTabs } from './NavTabs';

interface AppHeaderProps {
  mode: Mode;
  onNavigate: (mode: Mode) => void;
  updaterState: UpdaterState | null;
  paused: boolean;
  /** Resumes paused updates; resolves to false if it failed */
  onResume: () => Promise<boolean>;
  /** The dot next to Settings */
  settingsAttention?: Attention;
  githubStars: number | null;
}

const pillClass = `press flex h-9 items-center gap-2 rounded-sm px-3 text-sm font-medium cursor-pointer
                   before:absolute before:-inset-y-1 before:inset-x-0 relative`;

/**
 * Shown while configs auto update is paused; a click resumes it (an update starts right away).
 * The pause icon turns into a play icon on hover and focus, to say what the click does.
 */
function PausedPill({ onResume }: { onResume: () => Promise<boolean> }) {
  const { t } = useTranslation();
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle');

  const resume = async () => {
    setState('busy');
    // On success the pill goes away with the pause; it only stays to show the failure
    setState((await onResume()) ? 'idle' : 'failed');
  };

  const label = state === 'failed' ? t('pause.resumeFailed') : t('pause.badgeResume');

  return (
    <button
      type="button"
      onClick={resume}
      disabled={state === 'busy'}
      aria-label={label}
      title={label}
      className={`${pillClass} group bg-warn-soft text-warn-text hover:bg-warn hover:text-bg focus-visible:bg-warn focus-visible:text-bg
                  disabled:cursor-wait ${state === 'failed' ? 'shadow-[inset_0_0_0_1px_var(--danger)]' : ''}`}
    >
      {state === 'busy' ? (
        <Spinner className="size-4" />
      ) : (
        <span className="relative size-4">
          <Pause className="absolute inset-0 size-4 transition-[opacity,transform] duration-150 ease-out group-hover:scale-75 group-hover:opacity-0 group-focus-visible:opacity-0" fill="currentColor" aria-hidden="true" />
          <Play className="absolute inset-0 size-4 scale-75 opacity-0 transition-[opacity,transform] duration-150 ease-out group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100" fill="currentColor" aria-hidden="true" />
        </span>
      )}
      <span className="hidden xl:inline">{state === 'busy' ? t('pause.resuming') : t('pause.badge')}</span>
    </button>
  );
}

/** App update state as a compact pill; clicking it opens the update view. */
function UpdatePill({ state, onOpen }: { state: UpdaterState; onOpen: () => void }) {
  const { t } = useTranslation();

  switch (state.status) {
    case 'available':
      return (
        <button type="button" onClick={onOpen} className={`${pillClass} bg-accent-soft text-accent-text hover:bg-accent hover:text-accent-fg`}>
          <CircleArrowUp className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t('update.newVersion')}</span> {state.version}
        </button>
      );
    case 'downloading':
      return (
        <button type="button" onClick={onOpen} className={`${pillClass} overflow-hidden bg-accent-soft text-accent-text`}>
          <span
            aria-hidden="true"
            className="absolute inset-0 origin-left bg-accent/20 transition-transform duration-300 ease-out"
            style={{ transform: `scaleX(${state.progress / 100})` }}
          />
          <Spinner className="relative size-4" />
          <span className="relative tabular-nums">{state.progress}%</span>
        </button>
      );
    case 'installing':
      return (
        <button type="button" onClick={onOpen} className={`${pillClass} bg-accent-soft text-accent-text`}>
          <Spinner className="size-4" />
          <span className="hidden sm:inline">{t('update.installing')}</span>
        </button>
      );
    case 'reload':
      return (
        <button type="button" onClick={() => window.location.reload()} className={`${pillClass} bg-warn-soft text-warn-text hover:bg-warn hover:text-bg`}>
          <RotateCw className="size-4" aria-hidden="true" />
          {t('update.reload')}
        </button>
      );
    case 'error':
      return (
        <button type="button" onClick={onOpen} className={`${pillClass} bg-danger-soft text-danger-text`}>
          <TriangleAlert className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t('update.error')}</span>
        </button>
      );
    default:
      return null;
  }
}

export default memo(function AppHeader({ mode, onNavigate, updaterState, paused, onResume, settingsAttention, githubStars }: AppHeaderProps) {
  const { t, language, setLanguage } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  const updateVisible = updaterState && ['available', 'downloading', 'installing', 'reload', 'error'].includes(updaterState.status);

  return (
    <header className="relative z-20 flex h-16 shrink-0 items-center gap-3 bg-surface px-4 sm:px-6 animate-fade">
      <button
        type="button"
        onClick={() => onNavigate('details')}
        className="press flex h-11 shrink-0 items-center gap-2.5 rounded-md pr-2 cursor-pointer"
        aria-label={t('header.title')}
      >
        <img src="/favicon.png" alt="" width={28} height={28} className="size-7" />
        <span className="hidden text-base font-semibold tracking-tight text-fg lg:inline">{t('header.title')}</span>
      </button>

      <div className="flex flex-1 justify-center">
        <NavTabs mode={mode} onNavigate={onNavigate} attention={{ settings: settingsAttention }} />
      </div>

      <div className="flex items-center gap-1">
        <AnimatePresence initial={false}>
          {paused && (
            <m.span key="paused" variants={popVariants} initial="hidden" animate="visible" exit="hidden" transition={spring.snappy} className="inline-flex">
              <PausedPill onResume={onResume} />
            </m.span>
          )}
          {updateVisible && updaterState && (
            <m.span key="update" variants={popVariants} initial="hidden" animate="visible" exit="hidden" transition={spring.snappy} className="inline-flex">
              <UpdatePill state={updaterState} onOpen={() => onNavigate('update')} />
            </m.span>
          )}
        </AnimatePresence>

        <a
          href="https://github.com/rom5n/whitelist-download"
          target="_blank"
          rel="noreferrer"
          className="press hidden h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-fg-2 hover:bg-raised hover:text-fg sm:flex"
          aria-label={githubStars !== null ? `GitHub, ${githubStars} ★` : 'GitHub'}
        >
          <GithubIcon />
          {githubStars !== null && (
            <span className="flex animate-fade items-center gap-1 tabular-nums">
              <Star className="size-3.5 fill-warn text-warn" aria-hidden="true" />
              {githubStars}
            </span>
          )}
        </a>
        <a
          href="https://pay.cloudtips.ru/p/c6662c22"
          target="_blank"
          rel="noreferrer"
          aria-label={t('header.donate')}
          title={t('header.donate')}
          className="press group hidden size-11 items-center justify-center rounded-md text-fg-2 hover:bg-danger-soft hover:text-danger-text sm:flex"
        >
          <Heart className="size-[18px] transition-transform duration-300 ease-spring group-hover:scale-110 group-hover:fill-current" aria-hidden="true" />
        </a>

        <IconButton
          label={`${t('header.language')}: ${language === 'en' ? 'RU' : 'EN'}`}
          onClick={() => setLanguage(language === 'en' ? 'ru' : 'en')}
          className="text-xs font-semibold tracking-wide"
        >
          <span key={language} className="animate-pop" lang={language === 'en' ? 'ru' : 'en'}>{language === 'en' ? 'RU' : 'EN'}</span>
        </IconButton>
        <IconButton label={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')} onClick={toggleTheme} tooltipAlign="end">
          <span key={theme} className="animate-pop">
            {theme === 'dark' ? <Sun className="size-[18px]" aria-hidden="true" /> : <Moon className="size-[18px]" aria-hidden="true" />}
          </span>
        </IconButton>
      </div>
    </header>
  );
});
