import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './ThemeContext';
import { I18nProvider } from './i18n';
import MotionProvider from './motion/MotionProvider';
import App from './App';
import './index.css';

/**
 * Application entry point.
 * Wraps App with ThemeProvider (dark/light), I18nProvider (EN/RU) and MotionProvider (lazy animations).
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <MotionProvider>
          <App />
        </MotionProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);
