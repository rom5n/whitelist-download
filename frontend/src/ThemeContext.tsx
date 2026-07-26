import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

/** Supported theme modes */
export type Theme = 'dark' | 'light';

/** Context value shape for theming */
interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Provides dark/light theme context to all child components.
 * Applies the theme class to the <html> element and persists preference in localStorage.
 * Defaults to dark theme.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('wl-theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'dark';
  });

  /** Applies theme class to the document root element */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
  }, [theme]);

  /** Toggles between dark and light themes */
  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('wl-theme', next);
      return next;
    });
  }, []);

  /** Sets a specific theme and persists to localStorage */
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem('wl-theme', t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme state and toggle function.
 * Must be used within a ThemeProvider.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
