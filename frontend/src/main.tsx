import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './ThemeContext';
import { I18nProvider } from './i18n';
import App from './App';
import './index.css';

/**
 * Application entry point.
 * Wraps App with ThemeProvider (dark/light) and I18nProvider (EN/RU).
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);
