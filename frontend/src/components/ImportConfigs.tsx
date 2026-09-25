import { useEffect, useId, useState } from 'react';
import { fetchConfigs } from '../api';
import { useTranslation } from '../i18n';
import type { LoadStatus } from '../hooks/useStatistics';
import CountrySelect, { type CountryOption } from './CountrySelect';
import Spinner from './Spinner';

interface ImportConfigsProps {
  countries: CountryOption[];
  countriesStatus: LoadStatus;
  onRetryCountries: () => void;
  totalCount: number;
}

type DownloadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error' }
  | { kind: 'done'; count: number };

const DONE_MESSAGE_MS = 4000;
const MAX_FILE_NAME = 120;
const WHOLE_NUMBER = /^\d+$/;
// Characters that are invalid in file names on Windows/macOS/Linux
// eslint-disable-next-line no-control-regex
const INVALID_FILE_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

/** Makes a safe .txt file name, or returns null if nothing usable is left */
function sanitizeFileName(raw: string): string | null {
  const base = raw
    .replace(INVALID_FILE_CHARS, '_')
    .trim()
    .replace(/\.txt$/i, '')
    .replace(/[. ]+$/, '')
    .slice(0, MAX_FILE_NAME);
  return base ? `${base}.txt` : null;
}

function defaultFileName(countryCode: string | null, country: string | null, count: number | null, offset: number): string {
  const region = country ? (countryCode ?? country.replace(/\s+/g, '-')) : 'ALL';
  return `configs_${region}_${count ?? 'all'}_offset${offset}.txt`;
}

function saveTextFile(fileName: string, lines: string[]) {
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Downloads configs filtered by country, count and offset as a .txt file */
export default function ImportConfigs({ countries, countriesStatus, onRetryCountries, totalCount }: ImportConfigsProps) {
  const { t } = useTranslation();
  const ids = { country: useId(), count: useId(), offset: useId(), fileName: useId() };

  const [country, setCountry] = useState<string | null>(null);
  const [countText, setCountText] = useState('');
  const [offsetText, setOffsetText] = useState('0');
  const [customFileName, setCustomFileName] = useState<string | null>(null);
  const [state, setState] = useState<DownloadState>({ kind: 'idle' });

  useEffect(() => {
    if (state.kind !== 'done') return;
    const timer = window.setTimeout(() => setState({ kind: 'idle' }), DONE_MESSAGE_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  const selected = countries.find(c => c.name === country) ?? null;
  const available = country ? (selected?.count ?? 0) : totalCount;

  // Validation. Empty count means "all"
  let countError: string | null = null;
  let count: number | null = null;
  if (countText.trim() !== '') {
    if (!WHOLE_NUMBER.test(countText.trim())) countError = t('import.errInteger');
    else {
      count = Number(countText);
      if (count < 1) countError = t('import.errCountMin');
      else if (available > 0 && count > available) countError = t('import.errCountMax', { max: available });
    }
  }

  let offsetError: string | null = null;
  let offset = 0;
  if (offsetText.trim() !== '') {
    if (!WHOLE_NUMBER.test(offsetText.trim())) offsetError = t('import.errInteger');
    else {
      offset = Number(offsetText);
      if (available > 0 && offset >= available) offsetError = t('import.errOffsetMax', { total: available });
    }
  }

  const generatedName = defaultFileName(selected?.code ?? null, country, count, offset);
  const fileNameValue = customFileName ?? generatedName;
  const fileName = sanitizeFileName(fileNameValue);
  const fileNameError = fileName ? null : t('import.errFileName');

  const countriesReady = countriesStatus === 'ready';
  const isLoading = state.kind === 'loading';
  const canDownload = countriesReady && !countError && !offsetError && !fileNameError && !isLoading;

  const resetResult = () => {
    if (state.kind !== 'loading') setState({ kind: 'idle' });
  };

  const handleDownload = async () => {
    if (!canDownload || !fileName) return;
    setState({ kind: 'loading' });
    try {
      const res = await fetchConfigs(country, offset + 1, count ?? 0);
      const configs = res.configs ?? [];
      if (configs.length === 0) {
        setState({ kind: 'empty' });
        return;
      }
      saveTextFile(fileName, configs);
      setState({ kind: 'done', count: configs.length });
    } catch (err) {
      console.error(err);
      setState({ kind: 'error' });
    }
  };

  const fieldCls = (invalid: boolean) =>
    `w-full px-4 py-3 rounded-xl text-sm bg-[var(--color-bg-input)] text-[var(--color-text-primary)] outline-none transition-colors border ${
      invalid
        ? 'border-danger/60 focus:border-danger focus:ring-2 focus:ring-danger/20'
        : 'border-[var(--color-border)] focus:border-accent focus:ring-2 focus:ring-accent/20'
    }`;
  const labelCls = 'block text-sm font-medium text-[var(--color-text-secondary)] mb-2';
  // Fixed-height hint line, so an error message never pushes the layout
  const hintCls = (isError: boolean) => `min-h-5 mt-1.5 text-xs ${isError ? 'text-danger' : 'text-[var(--color-text-muted)]'}`;

  const resultMessage =
    state.kind === 'empty' ? { text: t('import.empty'), cls: 'text-warn' }
    : state.kind === 'error' ? { text: t('import.error'), cls: 'text-danger' }
    : state.kind === 'done' ? { text: t('import.done', { n: state.count }), cls: 'text-success' }
    : null;

  return (
    <div className="space-y-1">
      <p className="text-sm text-[var(--color-text-muted)] mb-4">{t('import.description')}</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-x-5 gap-y-1">
        <div className="md:col-span-2">
          <span id={ids.country} className={labelCls}>{t('country.select')}</span>
          <CountrySelect
            labelId={ids.country}
            options={countries}
            value={country}
            onChange={c => {
              setCountry(c);
              resetResult();
            }}
            status={countriesStatus}
            onRetry={onRetryCountries}
            totalCount={totalCount}
          />
          <p className={hintCls(false)}>{countriesReady && t('import.available', { n: available })}</p>
        </div>

        <div>
          <label htmlFor={ids.count} className={labelCls}>{t('import.count')}</label>
          <input
            id={ids.count}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={t('import.countPlaceholder')}
            value={countText}
            onChange={e => {
              setCountText(e.target.value);
              resetResult();
            }}
            aria-invalid={countError !== null}
            aria-describedby={`${ids.count}-hint`}
            className={fieldCls(countError !== null)}
          />
          <p id={`${ids.count}-hint`} className={hintCls(countError !== null)}>{countError}</p>
        </div>

        <div>
          <label htmlFor={ids.offset} className={labelCls}>{t('import.offset')}</label>
          <input
            id={ids.offset}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            title={t('import.offsetHint')}
            value={offsetText}
            onChange={e => {
              setOffsetText(e.target.value);
              resetResult();
            }}
            aria-invalid={offsetError !== null}
            aria-describedby={`${ids.offset}-hint`}
            className={fieldCls(offsetError !== null)}
          />
          <p id={`${ids.offset}-hint`} className={hintCls(offsetError !== null)}>{offsetError ?? t('import.offsetHint')}</p>
        </div>
      </div>

      <div>
        <label htmlFor={ids.fileName} className={labelCls}>{t('import.fileName')}</label>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              id={ids.fileName}
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={fileNameValue}
              onChange={e => setCustomFileName(e.target.value)}
              onBlur={() => {
                if (customFileName !== null && fileName) setCustomFileName(fileName);
              }}
              aria-invalid={fileNameError !== null}
              aria-describedby={`${ids.fileName}-hint`}
              className={`${fieldCls(fileNameError !== null)} font-mono pr-11`}
            />
            {customFileName !== null && (
              <button
                type="button"
                onClick={() => setCustomFileName(null)}
                title={t('import.resetName')}
                aria-label={t('import.resetName')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-accent hover:bg-accent/10 cursor-pointer transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden>
                  <path d="M3 12a9 9 0 102.64-6.36M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!canDownload}
            aria-busy={isLoading}
            className={`inline-grid px-6 py-3 rounded-xl text-sm font-bold transition-colors shadow-md ${
              canDownload
                ? 'bg-accent text-white hover:bg-accent-hover cursor-pointer'
                : isLoading
                  ? 'bg-accent/70 text-white cursor-progress'
                  : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)] cursor-not-allowed'
            }`}
          >
            {/* Both labels share one cell, so the button keeps its width while loading */}
            <span className={`[grid-area:1/1] flex items-center justify-center gap-2 ${isLoading ? 'opacity-0' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden>
                <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('import.download')}
            </span>
            <span className={`[grid-area:1/1] flex items-center justify-center gap-2 ${isLoading ? '' : 'opacity-0'}`} aria-hidden={!isLoading}>
              <Spinner />
              {t('import.downloading')}
            </span>
          </button>
        </div>
        <p id={`${ids.fileName}-hint`} className={hintCls(fileNameError !== null)}>{fileNameError}</p>
      </div>

      <p role="status" aria-live="polite" className={`min-h-5 text-sm font-medium ${resultMessage?.cls ?? ''}`}>
        {resultMessage?.text}
      </p>
    </div>
  );
}
