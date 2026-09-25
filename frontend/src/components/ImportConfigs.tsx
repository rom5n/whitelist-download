import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Check, CircleAlert, Download, Globe, Inbox, RotateCcw, RotateCw } from 'lucide-react';
import { fetchConfigs, toCountryParam } from '../api';
import { getCountryCode } from '../countryFlags';
import { useTranslation } from '../i18n';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Field from '../ui/Field';
import Flag from '../ui/Flag';
import Select, { type SelectOption } from '../ui/Select';

interface ImportConfigsProps {
  /** Configs per country (from the statistics); null while they load */
  countries: Record<string, number> | null;
  total: number;
  loadError: boolean;
  onRetry: () => void;
  className?: string;
  style?: CSSProperties;
}

type DownloadState = 'idle' | 'loading' | 'done' | 'empty' | 'error';

/** No characters that file systems reject in a name, and no control characters */
const isValidFileName = (name: string) =>
  name.trim() !== '' && !/[\\/:*?"<>|]/.test(name) && ![...name].some(char => char.charCodeAt(0) < 32);

/** Parses a whole non-negative number; null when the text is not one */
const parseWhole = (text: string): number | null => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null);

/** A file name that describes the filters, e.g. configs_DE_50_offset0.txt */
function defaultFileName(country: string, count: number | null, offset: number): string {
  const place = country ? (getCountryCode(country)?.toUpperCase() ?? toCountryParam(country)) : 'all';
  return `configs_${place}_${count ?? 'all'}_offset${offset}.txt`;
}

/** Downloads text as a file without leaving the page */
function saveText(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Downloads a .txt file with the configs picked by country, count and offset, to import them into a VPN client. */
export default function ImportConfigs({ countries, total, loadError, onRetry, className = '', style }: ImportConfigsProps) {
  const { t } = useTranslation();
  const [country, setCountry] = useState('');
  const [countText, setCountText] = useState('');
  const [offsetText, setOffsetText] = useState('0');
  const [customName, setCustomName] = useState<string | null>(null); // null: the name follows the filters
  const [state, setState] = useState<DownloadState>('idle');
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  // A country that disappeared after an update falls back to all countries
  const selectedCountry = country && countries && !(country in countries) ? '' : country;
  const available = countries ? (selectedCountry ? countries[selectedCountry] ?? 0 : total) : null;

  const count = countText.trim() === '' ? null : parseWhole(countText);
  const offset = parseWhole(offsetText);
  const countError = countText.trim() !== '' && (count === null || count < 1) ? t('import.errCount') : undefined;
  const offsetError = offset === null
    ? t('import.errOffset')
    : available !== null && available > 0 && offset >= available ? t('import.errOffsetTooBig') : undefined;

  const generatedName = defaultFileName(selectedCountry, countError ? null : count, offset ?? 0);
  const fileName = customName ?? generatedName;
  const fileNameError = isValidFileName(fileName) ? undefined : t('import.errFileName');

  const options = useMemo<SelectOption<string>[]>(() => [
    { value: '', label: t('import.allCountries'), icon: <Globe className="size-5 text-fg-3" aria-hidden="true" />, hint: total },
    ...Object.entries(countries ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, amount]) => ({ value: name, label: name, icon: <Flag country={name} className="size-5" />, hint: amount })),
  ], [countries, total, t]);

  // Any change of the filters clears the result of the previous download
  const edit = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    if (state !== 'loading') setState('idle');
  };

  const download = async () => {
    if (countError || offsetError || fileNameError || offset === null) return;
    window.clearTimeout(resetTimer.current);
    setState('loading');

    try {
      const response = await fetchConfigs(selectedCountry ? toCountryParam(selectedCountry) : undefined, offset + 1, count ?? 0);
      const configs = response.configs ?? [];
      if (configs.length === 0) {
        setState('empty');
        return;
      }

      const name = fileName.trim();
      saveText(`${configs.join('\n')}\n`, name.toLowerCase().endsWith('.txt') ? name : `${name}.txt`);
      setState('done');
      resetTimer.current = window.setTimeout(() => setState('idle'), 2500);
    } catch (err) {
      console.error(err);
      setState('error');
    }
  };

  const invalid = Boolean(countError || offsetError || fileNameError);

  return (
    // Raised above the next cards, so the open country list is drawn over them (each entering card is a
    // stacking context of its own); still below the sticky settings header
    <Card title={t('import.title')} description={t('import.description')} className={`relative z-[5] ${className}`} style={style}>
      <form
        noValidate
        onSubmit={event => {
          event.preventDefault();
          void download();
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Select
            className="sm:col-span-2 lg:col-span-1"
            label={t('import.country')}
            value={selectedCountry}
            options={options}
            onChange={edit(setCountry)}
            loading={!countries && !loadError}
            loadingLabel={t('sidebar.loading')}
            disabled={!countries}
            note={loadError && !countries ? (
              <p role="alert" className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-danger-text">
                {t('import.countriesError')}
                <button
                  type="button"
                  onClick={onRetry}
                  className="press relative inline-flex h-8 items-center gap-1 rounded-sm px-1.5 font-medium underline-offset-4 hover:underline cursor-pointer before:absolute before:-inset-y-1.5 before:inset-x-0"
                >
                  <RotateCw className="size-3.5" aria-hidden="true" />
                  {t('settings.retry')}
                </button>
              </p>
            ) : undefined}
          />
          <Field
            label={t('import.count')}
            inputMode="numeric"
            autoComplete="off"
            placeholder={t('import.countPlaceholder')}
            value={countText}
            onChange={event => edit(setCountText)(event.target.value)}
            error={countError}
            hint={available !== null ? `${t('import.countHint')} · ${t('import.available')}: ${available}` : t('import.countHint')}
          />
          <Field
            label={t('import.offset')}
            inputMode="numeric"
            autoComplete="off"
            value={offsetText}
            onChange={event => edit(setOffsetText)(event.target.value)}
            error={offsetError}
            hint={t('import.offsetHint')}
          />
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="relative min-w-0 flex-1">
            <Field
              mono
              label={t('import.fileName')}
              autoComplete="off"
              spellCheck={false}
              value={fileName}
              onChange={event => edit(setCustomName)(event.target.value)}
              error={fileNameError}
            />
            {customName !== null && (
              <button
                type="button"
                onClick={() => setCustomName(null)}
                className="press absolute right-0 top-0 inline-flex h-6 animate-fade items-center gap-1 rounded-sm px-1.5 text-xs font-medium text-accent-text hover:underline cursor-pointer
                           before:absolute before:-inset-y-2.5 before:inset-x-0"
              >
                <RotateCcw className="size-3" aria-hidden="true" />
                {t('import.fileNameReset')}
              </button>
            )}
          </div>
          <Button
            type="submit"
            variant="primary"
            loading={state === 'loading'}
            disabled={invalid || !countries}
            icon={state === 'done'
              ? <Check key="done" className="size-4 animate-pop" aria-hidden="true" />
              : <Download className="size-4" aria-hidden="true" />}
            className="sm:mt-7 sm:min-w-36"
          >
            {state === 'loading' ? t('import.downloading') : state === 'done' ? t('import.done') : t('import.download')}
          </Button>
        </div>

        <div role="status" aria-live="polite">
          {state === 'empty' && (
            <p className="mt-4 flex animate-fade items-start gap-2 rounded-md bg-warn-soft px-3.5 py-3 text-sm text-warn-text">
              <Inbox className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t('import.empty')}
            </p>
          )}
          {state === 'error' && (
            <p className="mt-4 flex animate-fade items-start gap-2 rounded-md bg-danger-soft px-3.5 py-3 text-sm text-danger-text">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t('import.error')}
            </p>
          )}
        </div>
      </form>
    </Card>
  );
}
