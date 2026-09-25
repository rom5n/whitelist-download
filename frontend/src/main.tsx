import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill';
import flagFontUrl from 'country-flag-emoji-polyfill/dist/TwemojiCountryFlags.woff2?url';
import { ThemeProvider } from './ThemeContext';
import { I18nProvider } from './i18n';
import MotionProvider from './motion/MotionProvider';
import App from './App';
import './index.css';

// Windows has no flag emoji ("🇩🇪" shows as "DE"): add a flag font there. It is bundled, so no CDN is needed.
polyfillCountryFlagEmojis('Twemoji Country Flags', flagFontUrl);

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
