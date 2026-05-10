import { useTranslation, type Language } from '../i18n';
import { useTheme } from '../ThemeContext';

/**
 * Dashboard header with app branding, GitHub link, theme toggle, and language selector.
 * Renders the gradient title, subtitle, and top-right controls.
 */
export default function Header() {
  const { t, language, setLanguage } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  /** Cycles language between English and Russian */
  const handleLangToggle = () => {
    const next: Language = language === 'en' ? 'ru' : 'en';
    setLanguage(next);
  };

  return (
    <header className="text-center mb-10 animate-fade-in">
      {/* App title with gradient effect */}
      <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent mb-2">
        {t('header.title')}
      </h1>

      <p className="text-[var(--color-text-secondary)] text-sm md:text-base mb-5">
        {t('header.subtitle')}
      </p>

      {/* Action buttons row */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {/* GitHub button */}
        <a
          id="github-link"
          href="https://github.com/rom5n/whitelist-download"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                     bg-[var(--color-bg-card)] border border-[var(--color-border)]
                     text-[var(--color-text-primary)] no-underline
                     transition-all duration-200 hover:border-[var(--color-border-hover)] hover:-translate-y-0.5"
        >
          <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 fill-current">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>
          {t('header.github')}
        </a>

        {/* Theme toggle button */}
        <button
          id="theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer
                     bg-[var(--color-bg-card)] border border-[var(--color-border)]
                     text-[var(--color-text-primary)]
                     transition-all duration-200 hover:border-[var(--color-border-hover)] hover:-translate-y-0.5"
        >
          {theme === 'dark' ? (
            /* Sun icon for switching to light */
            <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 fill-current text-amber-400">
              <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
            </svg>
          ) : (
            /* Moon icon for switching to dark */
            <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 fill-current text-indigo-400">
              <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
            </svg>
          )}
          {theme === 'dark' ? t('theme.light') : t('theme.dark')}
        </button>

        {/* Language toggle button */}
        <button
          id="lang-toggle"
          onClick={handleLangToggle}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer
                     bg-[var(--color-bg-card)] border border-[var(--color-border)]
                     text-[var(--color-text-primary)]
                     transition-all duration-200 hover:border-[var(--color-border-hover)] hover:-translate-y-0.5"
        >
          <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 fill-current">
            <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" />
          </svg>
          {language === 'en' ? 'RU' : 'EN'}
        </button>
      </div>
    </header>
  );
}
